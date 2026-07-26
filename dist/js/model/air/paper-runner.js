import { DOMAINS } from "../../config/domains.js";
import { loadNationalAirScenario } from "../../data/air/national.js";
import { checksumObject } from "../heat/experiments.js";
import { optimizeNetwork } from "../optimizer.js";
import { runAirSensitivityAnalysis } from "./sensitivity.js";

export const AIR_PAPER_CASE_STUDIES = [
  {
    key: "los-angeles-pm25",
    label: "Los Angeles PM2.5",
    pollutant: "pm2_5",
    bounds: { west: -118.55, south: 33.75, east: -117.85, north: 34.25 }
  },
  {
    key: "houston-ozone",
    label: "Houston ozone",
    pollutant: "ozone",
    bounds: { west: -95.75, south: 29.45, east: -95.05, north: 30.10 }
  },
  {
    key: "chicago-no2",
    label: "Chicago nitrogen dioxide",
    pollutant: "nitrogen_dioxide",
    bounds: { west: -88.15, south: 41.55, east: -87.45, north: 42.10 }
  },
  {
    key: "new-york-pm25",
    label: "New York PM2.5",
    pollutant: "pm2_5",
    bounds: { west: -74.27, south: 40.48, east: -73.68, north: 40.95 }
  }
];

function selectedSolution(result, profileKey) {
  return result?.solutions?.find((solution) => solution.profileKey === profileKey)
    ?? result?.solutions?.[0]
    ?? result;
}

function mean(cells, key) {
  const values = (cells ?? []).map((cell) => Number(cell[key])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function scenarioSummary(scenario) {
  return {
    scenarioId: scenario?.scenarioId ?? scenario?.id ?? null,
    label: scenario?.cityLabel ?? "Air case study",
    pollutant: scenario?.model?.pollutant ?? null,
    pollutantLabel: scenario?.model?.pollutantLabel ?? null,
    pollutantUnit: scenario?.model?.pollutantUnit ?? null,
    bounds: scenario?.geoBounds ?? null,
    evaluationPoints: scenario?.cells?.length ?? 0,
    candidates: scenario?.candidates?.length ?? 0,
    observations: scenario?.observations?.length ?? 0,
    groups: scenario?.groups?.length ?? 0,
    meanConcentration: mean(scenario?.cells, "pollutantValue"),
    meanRisk: mean(scenario?.cells, "risk"),
    meanExposure: mean(scenario?.cells, "exposure"),
    meanVulnerability: mean(scenario?.cells, "vulnerability"),
    sourceStatus: scenario?.model?.airSourceStatus ?? null,
    referenceStatus: scenario?.model?.referenceMonitorStatus ?? null
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
      airRole: site.airRole ?? null,
      sourceType: site.sourceType ?? null
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

function optimizeAirScenario(scenario, settings) {
  const domain = { ...DOMAINS.air, transportAngle: scenario.model?.transportAngle ?? 0 };
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain,
    weights: DOMAINS.air.weights,
    fairnessConstraint: true,
    fairnessLimit: settings.fairnessLimit,
    constraints: {
      enforceSocialConstraints: true,
      fairnessLimit: settings.fairnessLimit,
      minimumGroupInformation: settings.minimumGroupInformation,
      minimumReliability: settings.minimumReliability,
      budget: settings.budget
    },
    modelSettings: {
      measurementNoise: settings.measurementNoise,
      lengthScaleMultiplier: settings.lengthScaleMultiplier,
      transportAngle: scenario.model?.transportAngle ?? 0
    },
    seed: scenario.seed
  }, settings.monitorCount, { minimumSeparation: true, beamWidth: 3 });
  return { result, domain, solution: selectedSolution(result, settings.activeProfile) };
}

export async function runNationalAirPaperSuite({
  caseStudies = AIR_PAPER_CASE_STUDIES,
  fetchImpl = globalThis.fetch,
  signal = null,
  openAqApiKey = "",
  includeSensitivity = true,
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
    onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage: "Loading public Air inputs" });
    const scenario = await loadNationalAirScenario(definition.bounds, {
      pollutant: definition.pollutant,
      openAqApiKey,
      maxPoints: 64,
      candidateTarget: 144,
      candidateCap: 180,
      candidateStrategy: "systematic",
      monitorCount: resolved.monitorCount,
      label: definition.label,
      signal,
      fetchImpl,
      onProgress: (stage) => onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage })
    });
    onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage: "Running portfolio and scientific benchmarks" });
    const optimized = optimizeAirScenario(scenario, resolved);
    const sensitivity = includeSensitivity
      ? runAirSensitivityAnalysis({
          scenario,
          domain: optimized.domain,
          calibrationSettings: scenario.model?.airInference ?? resolved,
          monitorCount: resolved.monitorCount,
          budget: resolved.budget,
          fairnessLimit: resolved.fairnessLimit,
          minimumGroupInformation: resolved.minimumGroupInformation,
          minimumReliability: resolved.minimumReliability,
          splitSeeds: [1207, 3301]
        })
      : null;
    cases.push({
      key: definition.key,
      definition,
      scenario: scenarioSummary(scenario),
      validation: scenario.model?.airValidation ?? null,
      selectedNetwork: solutionSummary(optimized.solution),
      benchmarks: benchmarkSummary(optimized.result),
      sensitivity
    });
  }
  const generatedAt = new Date().toISOString();
  const scientificInputs = { caseStudies, settings: resolved, includeSensitivity, cases };
  return {
    format: "lumos-air-paper-suite-v1",
    version: "1.9.1",
    generatedAt,
    checksum: checksumObject(scientificInputs),
    methodology: {
      spatialResolution: "64 evaluation points and up to 180 systematic candidates per case",
      coreModel: "Full LUMOS Bayesian, social-constraint, Pareto portfolio, scientific benchmark, and Air transport architecture",
      referenceBoundary: openAqApiKey ? "Compatible OpenAQ readings were requested and keys were excluded from output." : "No OpenAQ key was used; cases are atmospheric-model screening experiments."
    },
    settings: resolved,
    cases
  };
}

export function buildCurrentAirPaperBundle({ scenario, result, activeProfile = "balanced", sensitivity = null, settings = {} } = {}) {
  if (!scenario?.cells?.length || scenario.domainKey !== "air" || !result) throw new Error("Generate an Air portfolio before building the paper bundle.");
  const solution = selectedSolution(result, activeProfile);
  const scientificInputs = {
    settings,
    scenario: scenarioSummary(scenario),
    selectedNetwork: solutionSummary(solution),
    benchmarks: benchmarkSummary(result),
    validation: scenario.model?.airValidation ?? null,
    sensitivity
  };
  return {
    format: "lumos-air-paper-suite-v1",
    version: "1.9.1",
    generatedAt: new Date().toISOString(),
    checksum: checksumObject(scientificInputs),
    methodology: {
      spatialResolution: `${scenario.cells.length} active evaluation points and ${scenario.candidates?.length ?? 0} active candidates`,
      coreModel: "Current fitted LUMOS Air Bayesian, fairness, Pareto, benchmark, validation, and sensitivity architecture",
      referenceBoundary: "OpenAQ credentials are never included in the bundle."
    },
    settings,
    cases: [{
      key: scenario.scenarioId ?? scenario.id ?? "current-air-workspace",
      definition: { label: scenario.cityLabel ?? "Current Air workspace", pollutant: scenario.model?.pollutant, bounds: scenario.geoBounds ?? null },
      scenario: scenarioSummary(scenario),
      validation: scenario.model?.airValidation ?? null,
      selectedNetwork: solutionSummary(solution),
      benchmarks: benchmarkSummary(result),
      sensitivity
    }]
  };
}

export function airPaperRows(bundle) {
  const rows = [];
  for (const caseStudy of bundle?.cases ?? []) {
    const base = {
      case_key: caseStudy.key,
      case_label: caseStudy.definition?.label ?? caseStudy.key,
      pollutant: caseStudy.scenario?.pollutant ?? caseStudy.definition?.pollutant ?? null
    };
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
    const validation = caseStudy.validation;
    if (validation?.available) {
      for (const [name, metrics] of Object.entries(validation.locked ?? {})) {
        if (!metrics || Array.isArray(metrics) || typeof metrics !== "object") continue;
        for (const [metric, value] of Object.entries(metrics)) {
          if (typeof value === "object") continue;
          rows.push({ table: "locked_validation", ...base, method: name, metric, value });
        }
      }
    }
  }
  return rows;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToAirPaperCsv(rows) {
  const columns = ["table", "case_key", "case_label", "pollutant", "method", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
