import { DOMAINS } from "../../config/domains.js";
import { loadNationalHeatScenario } from "../../data/heat/national.js";
import { checksumObject } from "./experiments.js";
import { optimizeNetwork } from "../optimizer.js";

export const PAPER_CASE_STUDIES = [
  {
    key: "phoenix",
    label: "Phoenix metropolitan Heat",
    bounds: { west: -112.27, south: 33.25, east: -111.82, north: 33.68 }
  },
  {
    key: "denver",
    label: "Denver metropolitan Heat",
    bounds: { west: -105.18, south: 39.56, east: -104.73, north: 39.93 }
  },
  {
    key: "atlanta",
    label: "Atlanta metropolitan Heat",
    bounds: { west: -84.66, south: 33.55, east: -84.15, north: 34.02 }
  },
  {
    key: "new-york",
    label: "New York City metropolitan Heat",
    bounds: { west: -74.27, south: 40.48, east: -73.68, north: 40.95 }
  }
];

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function selectedSolution(result, profileKey) {
  return result?.solutions?.find((solution) => solution.profileKey === profileKey)
    ?? result?.solutions?.[0]
    ?? result;
}

function scenarioSummary(scenario) {
  const mean = (key) => {
    const values = (scenario?.cells ?? []).map((cell) => finite(cell[key])).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  return {
    scenarioId: scenario?.scenarioId ?? scenario?.id ?? null,
    label: scenario?.cityLabel ?? "Heat case study",
    bounds: scenario?.geoBounds ?? null,
    evaluationPoints: scenario?.cells?.length ?? 0,
    candidates: scenario?.candidates?.length ?? 0,
    groups: scenario?.groups?.length ?? 0,
    meanApparentTemperatureF: mean("apparentTemperature"),
    meanRisk: mean("risk"),
    meanExposure: mean("exposure"),
    meanVulnerability: mean("vulnerability"),
    landCoverStatus: scenario?.model?.landCoverStatus ?? null,
    censusStatus: scenario?.model?.censusStatus ?? null,
    sourceMetadata: scenario?.sourceMetadata ?? null
  };
}

function solutionSummary(solution) {
  return {
    profileKey: solution?.profileKey ?? "balanced",
    profileLabel: solution?.profileLabel ?? "Balanced",
    feasible: solution?.constraintStatus?.feasible ?? null,
    pareto: Boolean(solution?.pareto),
    selected: (solution?.selected ?? []).map((site) => ({
      id: site.id,
      lat: site.lat,
      lng: site.lng,
      cost: site.cost,
      reliability: site.reliability,
      sourceType: site.sourceType,
      hostCategory: site.hostCategory ?? null
    })),
    metrics: solution?.metrics ?? null,
    constraintStatus: solution?.constraintStatus ?? null
  };
}

function benchmarkSummary(result) {
  return (result?.baselines ?? []).map((baseline) => ({
    name: baseline.name,
    runtimeMs: baseline.runtimeMs ?? null,
    metrics: baseline.metrics,
    feasible: baseline.constraintStatus?.feasible ?? null
  }));
}

async function optimizeCase(scenario, {
  monitorCount,
  budget,
  fairnessLimit,
  minimumGroupInformation,
  minimumReliability,
  measurementNoise,
  lengthScaleMultiplier,
  activeProfile,
  onProgress
}) {
  onProgress?.("Running full constrained portfolio and scientific benchmarks...");
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    weights: DOMAINS.heat.weights,
    fairnessConstraint: true,
    fairnessLimit,
    constraints: {
      enforceSocialConstraints: true,
      fairnessLimit,
      minimumGroupInformation,
      minimumReliability,
      budget
    },
    modelSettings: {
      measurementNoise,
      lengthScaleMultiplier,
      transportAngle: scenario.model?.transportAngle ?? 0
    },
    seed: scenario.seed
  }, monitorCount, {
    minimumSeparation: true,
    beamWidth: 3
  });
  const solution = selectedSolution(result, activeProfile);
  return { result, solution };
}

async function runFairnessScreen(scenario, settings, onProgress) {
  const thresholds = [0.12, 0.18, 0.24, 0.30];
  const rows = [];
  for (let index = 0; index < thresholds.length; index += 1) {
    const limit = thresholds[index];
    onProgress?.(`Fairness screen ${index + 1} of ${thresholds.length}...`);
    const result = optimizeNetwork({
      cells: scenario.cells,
      candidates: scenario.candidates,
      observations: scenario.observations,
      domain: DOMAINS.heat,
      weights: DOMAINS.heat.weights,
      fairnessConstraint: true,
      fairnessLimit: limit,
      constraints: {
        enforceSocialConstraints: true,
        fairnessLimit: limit,
        minimumGroupInformation: settings.minimumGroupInformation,
        minimumReliability: settings.minimumReliability,
        budget: settings.budget
      },
      modelSettings: {
        measurementNoise: settings.measurementNoise,
        lengthScaleMultiplier: settings.lengthScaleMultiplier
      },
      seed: scenario.seed
    }, settings.monitorCount, {
      minimumSeparation: true,
      beamWidth: 2,
      profileKeys: ["balanced"],
      exactPoolSize: 8,
      exactSelectionCount: 3
    });
    rows.push({
      fairnessLimit: limit,
      information: result.metrics.information,
      minimumGroupInformation: result.metrics.minimumGroupInformation,
      fairnessGap: result.metrics.fairnessGap,
      totalCost: result.metrics.totalCost,
      feasible: result.constraintStatus?.feasible ?? false
    });
  }
  return rows;
}

export async function runNationalPaperSuite({
  caseStudies = PAPER_CASE_STUDIES,
  fetchImpl = globalThis.fetch,
  signal = null,
  includeFairnessScreen = true,
  settings = {},
  onProgress = () => {}
} = {}) {
  const resolved = {
    monitorCount: Number(settings.monitorCount ?? 10),
    budget: Number(settings.budget ?? 10),
    fairnessLimit: Number(settings.fairnessLimit ?? 0.18),
    minimumGroupInformation: Number(settings.minimumGroupInformation ?? 0.08),
    minimumReliability: Number(settings.minimumReliability ?? 0.65),
    measurementNoise: Number(settings.measurementNoise ?? 0.06),
    lengthScaleMultiplier: Number(settings.lengthScaleMultiplier ?? 1),
    activeProfile: settings.activeProfile ?? "balanced"
  };
  const cases = [];
  for (let index = 0; index < caseStudies.length; index += 1) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const definition = caseStudies[index];
    onProgress({
      caseIndex: index,
      caseCount: caseStudies.length,
      caseLabel: definition.label,
      stage: "Loading frozen-resolution public inputs"
    });
    const scenario = await loadNationalHeatScenario(definition.bounds, {
      maxPoints: 64,
      candidateTarget: 144,
      candidateCap: 180,
      candidateStrategy: "systematic",
      monitorCount: resolved.monitorCount,
      label: definition.label,
      signal,
      fetchImpl,
      onProgress: (message) => onProgress({
        caseIndex: index,
        caseCount: caseStudies.length,
        caseLabel: definition.label,
        stage: message
      })
    });
    const { result, solution } = await optimizeCase(scenario, {
      ...resolved,
      onProgress: (message) => onProgress({
        caseIndex: index,
        caseCount: caseStudies.length,
        caseLabel: definition.label,
        stage: message
      })
    });
    const fairnessScreen = includeFairnessScreen
      ? await runFairnessScreen(scenario, resolved, (message) => onProgress({
        caseIndex: index,
        caseCount: caseStudies.length,
        caseLabel: definition.label,
        stage: message
      }))
      : [];
    cases.push({
      key: definition.key,
      definition,
      scenario: scenarioSummary(scenario),
      selectedNetwork: solutionSummary(solution),
      benchmarks: benchmarkSummary(result),
      fairnessScreen
    });
  }
  const generatedAt = new Date().toISOString();
  const scientificInputs = {
    caseStudies,
    settings: resolved,
    includeFairnessScreen,
    cases
  };
  return {
    format: "lumos-heat-paper-suite-v1",
    version: "0.10.0",
    generatedAt,
    checksum: checksumObject(scientificInputs),
    methodology: {
      spatialResolution: "64 evaluation points and up to 180 systematic candidates per case",
      coreModel: "Full Bayesian, social-constraint, Pareto portfolio, scientific benchmark, and exact micro-benchmark architecture",
      liveDataBoundary: "The exported inputs freeze the weather, Census, land-cover, and candidate data received during this run."
    },
    settings: resolved,
    cases
  };
}

export function paperSuiteRows(bundle) {
  const rows = [];
  for (const caseStudy of bundle?.cases ?? []) {
    const base = { case_key: caseStudy.key, case_label: caseStudy.definition?.label ?? caseStudy.key };
    for (const [metric, value] of Object.entries(caseStudy.scenario ?? {})) {
      if (typeof value === "object") continue;
      rows.push({ table: "scenario", ...base, method: "LUMOS", metric, value });
    }
    for (const [metric, value] of Object.entries(caseStudy.selectedNetwork?.metrics ?? {})) {
      if (typeof value === "object") continue;
      rows.push({ table: "selected_network", ...base, method: caseStudy.selectedNetwork.profileLabel, metric, value });
    }
    for (const benchmark of caseStudy.benchmarks ?? []) {
      for (const [metric, value] of Object.entries(benchmark.metrics ?? {})) {
        if (typeof value === "object") continue;
        rows.push({ table: "benchmark", ...base, method: benchmark.name, metric, value });
      }
    }
    for (const screen of caseStudy.fairnessScreen ?? []) {
      for (const [metric, value] of Object.entries(screen)) {
        if (metric === "fairnessLimit") continue;
        rows.push({
          table: "fairness_screen",
          ...base,
          method: "Balanced",
          fairness_limit: screen.fairnessLimit,
          metric,
          value
        });
      }
    }
  }
  return rows;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToPaperSuiteCsv(rows) {
  const columns = ["table", "case_key", "case_label", "method", "fairness_limit", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

export function buildCurrentWorkspacePaperBundle({
  scenario,
  result,
  activeProfile = "balanced",
  settings = {},
  fairnessScreen = [],
  generatedAt = new Date().toISOString()
} = {}) {
  if (!scenario?.cells?.length || !result) throw new Error("Generate a portfolio before building the current-workspace paper bundle.");
  const solution = selectedSolution(result, activeProfile);
  const caseStudy = {
    key: scenario.scenarioId ?? scenario.id ?? "current-workspace",
    definition: {
      key: scenario.scenarioId ?? scenario.id ?? "current-workspace",
      label: scenario.cityLabel ?? "Current fitted Heat workspace",
      bounds: scenario.geoBounds ?? null
    },
    scenario: scenarioSummary(scenario),
    selectedNetwork: solutionSummary(solution),
    benchmarks: benchmarkSummary(result),
    fairnessScreen
  };
  const scientificInputs = { settings, caseStudy };
  return {
    format: "lumos-heat-paper-suite-v1",
    version: "0.10.0",
    generatedAt,
    checksum: checksumObject(scientificInputs),
    methodology: {
      spatialResolution: `${scenario.cells.length} active evaluation points and ${scenario.candidates?.length ?? 0} active candidates`,
      coreModel: "Current fitted LUMOS Bayesian, social-constraint, Pareto portfolio, and scientific benchmark architecture",
      liveDataBoundary: "The bundle freezes the exact transformed inputs and result metrics active when exported."
    },
    settings,
    cases: [caseStudy]
  };
}
