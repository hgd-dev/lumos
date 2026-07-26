import { DOMAINS } from "../../config/domains.js";
import { WATER_INDICATORS, loadNationalWaterScenario } from "../../data/water/national.js";
import { optimizeNetwork } from "../optimizer.js";
import { attachWaterInference } from "./inference.js";
import { runWaterSensitivityAnalysis } from "./sensitivity.js";

export const WATER_PUBLIC_CASE_STUDIES = Object.freeze([
  {
    key: "denver-temperature",
    label: "Denver, Colorado",
    indicator: "temperature",
    systemType: "surface",
    bounds: { south: 39.55, north: 39.95, west: -105.25, east: -104.70 },
    rationale: "Urban river temperature and source-to-receptor monitoring."
  },
  {
    key: "houston-turbidity",
    label: "Houston, Texas",
    indicator: "turbidity",
    systemType: "surface",
    bounds: { south: 29.45, north: 30.10, west: -95.75, east: -95.05 },
    rationale: "Bayou, runoff, and stormwater turbidity monitoring."
  },
  {
    key: "pittsburgh-conductance",
    label: "Pittsburgh, Pennsylvania",
    indicator: "specific_conductance",
    systemType: "surface",
    bounds: { south: 40.28, north: 40.58, west: -80.18, east: -79.78 },
    rationale: "River-confluence and source-pressure conductance monitoring."
  },
  {
    key: "portland-discharge",
    label: "Portland, Oregon",
    indicator: "discharge",
    systemType: "surface",
    bounds: { south: 45.35, north: 45.68, west: -122.88, east: -122.45 },
    rationale: "Watershed discharge and branch-aware station placement."
  }
]);

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  return value;
}

function checksumObject(value) {
  const text = JSON.stringify(stableObject(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hashNumber(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function controlledValue(cell, indicator, index) {
  const base = Number(cell.priorWaterIndicatorValue ?? cell.waterIndicatorValue ?? WATER_INDICATORS[indicator]?.fallback ?? 1);
  const wave = 0.52 * Math.sin((cell.x * 2.6 + cell.y * 1.8) * Math.PI)
    + 0.28 * Math.cos((cell.x * 1.2 - cell.y * 2.4) * Math.PI)
    + 0.30 * ((cell.upstreamSourcePressure ?? 0.5) - 0.5)
    + 0.18 * ((cell.downstreamExposure ?? 0.5) - 0.5)
    + 0.05 * Math.sin((index + 1) * 2.173);
  if (indicator === "temperature") return clamp(base + 2.2 * wave, -2, 45);
  if (indicator === "dissolved_oxygen") return clamp(base - 1.15 * wave, 0, 25);
  if (indicator === "ph") return clamp(base + 0.65 * wave, 0, 14);
  if (indicator === "specific_conductance") return Math.max(0, base * Math.exp(0.34 * wave));
  if (indicator === "turbidity") return Math.max(0, base * Math.exp(0.65 * wave));
  if (indicator === "discharge") return Math.max(0, base * Math.exp(0.48 * wave));
  return Math.max(0, base * (1 + 0.25 * wave));
}

function sensorNoise(indicator, value) {
  if (["specific_conductance", "turbidity", "discharge"].includes(indicator)) return 0.05;
  if (indicator === "ph") return 0.025;
  return Math.max(0.025, Math.min(0.08, Math.abs(value) * 0.006));
}

export function createControlledWaterBenchmarkObservations(scenario, definition, count = 16) {
  const eligible = (scenario?.cells ?? []).filter((cell) => Number.isFinite(cell.waterIndicatorValue));
  if (eligible.length < 8) throw new Error(`The ${definition?.label ?? "Water"} case has insufficient evaluation points for a controlled benchmark.`);
  const ordered = [...eligible].sort((left, right) => hashNumber(`${definition.key}:${left.id ?? `${left.x}:${left.y}`}`) - hashNumber(`${definition.key}:${right.id ?? `${right.x}:${right.y}`}`));
  const selected = [];
  const desired = Math.min(count, ordered.length);
  for (const cell of ordered) {
    if (selected.length >= desired) break;
    const separated = selected.every((sample) => Math.hypot(sample.x - cell.x, sample.y - cell.y) >= 0.11 || sample.networkBranch !== cell.networkBranch);
    if (!separated && ordered.length > desired * 2) continue;
    const observedValue = controlledValue(cell, definition.indicator, selected.length);
    selected.push({
      ...cell,
      id: `controlled-water-${definition.key}-${selected.length + 1}`,
      siteCode: `CW-${String(selected.length + 1).padStart(3, "0")}`,
      name: `Controlled Water benchmark station ${selected.length + 1}`,
      observedValue,
      sampledAt: null,
      unit: WATER_INDICATORS[definition.indicator]?.unit ?? "source units",
      indicator: definition.indicator,
      reliability: 0.94,
      feasibility: 1,
      sensorNoise: sensorNoise(definition.indicator, observedValue),
      official: false,
      existing: true,
      qualifiers: ["controlled_benchmark"],
      sourceType: "controlled_water_benchmark_observation",
      controlledBenchmark: true
    });
  }
  if (selected.length < Math.min(8, desired)) throw new Error("Controlled Water benchmark sampling could not form a sufficiently distributed station set.");
  return selected;
}

function selectedSolution(result, activeProfile) {
  return result?.solutions?.find((entry) => entry.profileKey === activeProfile) ?? result?.solutions?.[0] ?? null;
}

function scenarioSummary(scenario, definition) {
  return {
    scenarioId: scenario?.scenarioId ?? scenario?.id ?? definition.key,
    label: scenario?.cityLabel ?? definition.label,
    indicator: definition.indicator,
    indicatorLabel: WATER_INDICATORS[definition.indicator]?.label ?? definition.indicator,
    indicatorUnit: WATER_INDICATORS[definition.indicator]?.unit ?? "",
    systemType: definition.systemType,
    bounds: scenario?.geoBounds ?? definition.bounds,
    evaluationPoints: scenario?.cells?.length ?? 0,
    candidates: scenario?.candidates?.length ?? 0,
    observations: scenario?.observations?.length ?? 0,
    groups: scenario?.groups?.length ?? 0,
    flowDirectionConfidence: scenario?.model?.flowDirectionConfidence ?? null,
    sourceProxyCount: scenario?.model?.sourceProxyCount ?? 0,
    evidenceType: "controlled_benchmark_over_public_water_context"
  };
}

function solutionSummary(solution) {
  return {
    profileKey: solution?.profileKey ?? "balanced",
    profileLabel: solution?.profileLabel ?? solution?.profile?.label ?? "Balanced",
    feasible: solution?.constraintStatus?.feasible ?? null,
    paretoOptimal: Boolean(solution?.paretoOptimal ?? solution?.pareto),
    selected: (solution?.selected ?? []).map((site) => ({
      id: site.id,
      lat: site.lat,
      lng: site.lng,
      x: site.x,
      y: site.y,
      cost: site.cost,
      reliability: site.reliability,
      waterRole: site.waterRole ?? null,
      networkBranch: site.networkBranch ?? null,
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
    feasible: baseline.constraintStatus?.feasible ?? null,
    metrics: baseline.metrics ?? null
  }));
}

function optimizeWaterScenario(scenario, settings) {
  const inference = scenario.model?.waterInference ?? {};
  const domain = { ...DOMAINS.water, transportAngle: scenario.model?.transportAngle ?? DOMAINS.water.transportAngle };
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain,
    weights: DOMAINS.water.weights,
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
      measurementNoise: inference.measurementNoise ?? settings.measurementNoise,
      lengthScaleMultiplier: inference.lengthScaleMultiplier ?? settings.lengthScaleMultiplier,
      transportAngle: scenario.model?.transportAngle,
      gpAlongScale: inference.gpAlongScale,
      gpAcrossScale: inference.gpAcrossScale,
      branchPenalty: inference.branchPenalty
    },
    seed: scenario.seed
  }, settings.monitorCount, { minimumSeparation: true, beamWidth: 3 });
  return { result, domain, solution: selectedSolution(result, settings.activeProfile) };
}

export async function runNationalWaterEvidenceSuite({
  caseStudies = WATER_PUBLIC_CASE_STUDIES,
  fetchImpl = globalThis.fetch,
  signal = null,
  includeSensitivity = false,
  settings = {},
  loadScenarioImpl = loadNationalWaterScenario,
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
    activeProfile: settings.activeProfile ?? "balanced",
    benchmarkObservationCount: Number(settings.benchmarkObservationCount ?? 16)
  };
  const cases = [];
  for (let index = 0; index < caseStudies.length; index += 1) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const definition = caseStudies[index];
    onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage: "Loading public Water and social context" });
    const scenario = await loadScenarioImpl(definition.bounds, {
      indicator: definition.indicator,
      systemType: definition.systemType,
      candidateStrategy: "systematic",
      candidateTarget: 121,
      candidateCap: 150,
      maxPoints: 64,
      monitorCount: resolved.monitorCount,
      label: definition.label,
      signal,
      fetchImpl,
      onProgress: (stage) => onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage })
    });
    const observations = createControlledWaterBenchmarkObservations(scenario, definition, resolved.benchmarkObservationCount);
    scenario.observations = observations;
    const domain = { ...DOMAINS.water, transportAngle: scenario.model?.transportAngle ?? DOMAINS.water.transportAngle };
    attachWaterInference(scenario, domain, {
      indicator: definition.indicator,
      indicatorDefinition: WATER_INDICATORS[definition.indicator],
      lockedSeed: 1901 + index * 101
    });
    scenario.model.evidenceType = "controlled_benchmark_over_public_water_context";
    scenario.model.evidenceBoundary = "Benchmark station values are deterministic simulation observations, not USGS measurements or water-quality determinations.";
    onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage: "Running portfolio and scientific benchmarks" });
    const optimized = optimizeWaterScenario(scenario, resolved);
    const sensitivity = includeSensitivity
      ? runWaterSensitivityAnalysis({ scenario, domain: optimized.domain, calibrationSettings: scenario.model?.waterInference ?? resolved, splitSeeds: [1901, 2903] })
      : null;
    cases.push({
      key: definition.key,
      definition,
      scenario: scenarioSummary(scenario, definition),
      validation: scenario.model?.waterValidation ?? null,
      selectedNetwork: solutionSummary(optimized.solution),
      benchmarks: benchmarkSummary(optimized.result),
      sensitivity
    });
  }
  const scientificInputs = { caseStudies, settings: resolved, includeSensitivity, cases };
  return {
    format: "lumos-water-public-evidence-v1",
    version: "1.9.1",
    generatedAt: new Date().toISOString(),
    checksum: checksumObject(scientificInputs),
    methodology: {
      spatialProtocol: "Public Water, hydrologic-proxy, and Census context with deterministic distributed benchmark observations and one frozen optimization protocol.",
      coreModel: "Full LUMOS flow-aware Bayesian information, social constraints, Pareto portfolio, and scientific benchmark architecture.",
      evidenceBoundary: "The benchmark observations are controlled simulations. They validate computational behavior and comparative design performance, not water quality, hydraulic conditions, regulatory compliance, or public-health safety."
    },
    settings: resolved,
    cases
  };
}

export function waterEvidenceRows(bundle) {
  const rows = [];
  for (const caseStudy of bundle?.cases ?? []) {
    const base = {
      case_key: caseStudy.key,
      case_label: caseStudy.definition?.label ?? caseStudy.key,
      indicator: caseStudy.scenario?.indicator ?? caseStudy.definition?.indicator ?? null,
      system_type: caseStudy.scenario?.systemType ?? caseStudy.definition?.systemType ?? null
    };
    for (const [metric, value] of Object.entries(caseStudy.scenario ?? {})) {
      if (value && typeof value === "object") continue;
      rows.push({ table: "scenario", ...base, method: "LUMOS", metric, value });
    }
    for (const [metric, value] of Object.entries(caseStudy.selectedNetwork?.metrics ?? {})) {
      if (value && typeof value === "object") continue;
      rows.push({ table: "selected_network", ...base, method: caseStudy.selectedNetwork.profileLabel, metric, value });
    }
    for (const benchmark of caseStudy.benchmarks ?? []) {
      for (const [metric, value] of Object.entries(benchmark.metrics ?? {})) {
        if (value && typeof value === "object") continue;
        rows.push({ table: "benchmark", ...base, method: benchmark.name, metric, value });
      }
    }
    if (caseStudy.validation?.available) {
      for (const [method, metrics] of Object.entries(caseStudy.validation.locked ?? {})) {
        if (!metrics || Array.isArray(metrics) || typeof metrics !== "object") continue;
        for (const [metric, value] of Object.entries(metrics)) {
          if (value && typeof value === "object") continue;
          rows.push({ table: "locked_validation", ...base, method, metric, value });
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

export function rowsToWaterEvidenceCsv(rows = []) {
  const columns = ["table", "case_key", "case_label", "indicator", "system_type", "method", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
