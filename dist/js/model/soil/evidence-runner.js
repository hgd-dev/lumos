import { DOMAINS } from "../../config/domains.js";
import { SOIL_PROPERTIES, loadNationalSoilScenario } from "../../data/soil/national.js";
import { optimizeNetwork } from "../optimizer.js";
import { attachSoilInference } from "./inference.js";
import { runSoilSensitivityAnalysis } from "./sensitivity.js";

export const SOIL_PUBLIC_CASE_STUDIES = Object.freeze([
  {
    key: "fresno-organic-matter",
    label: "Fresno, California",
    property: "organic_matter",
    depth: "0-15",
    bounds: { south: 36.60, north: 36.92, west: -119.98, east: -119.55 },
    rationale: "Agricultural and urban-edge organic-matter sampling."
  },
  {
    key: "phoenix-salinity",
    label: "Phoenix, Arizona",
    property: "salinity",
    depth: "0-15",
    bounds: { south: 33.28, north: 33.66, west: -112.32, east: -111.78 },
    rationale: "Arid-region electrical-conductivity and salinity screening."
  },
  {
    key: "des-moines-water-capacity",
    label: "Des Moines, Iowa",
    property: "available_water",
    depth: "15-30",
    bounds: { south: 41.42, north: 41.75, west: -93.86, east: -93.42 },
    rationale: "Subsurface available-water-capacity sampling."
  },
  {
    key: "atlanta-soil-ph",
    label: "Atlanta, Georgia",
    property: "ph",
    depth: "0-15",
    bounds: { south: 33.56, north: 33.94, west: -84.62, east: -84.12 },
    rationale: "Urban and vegetated topsoil-pH sampling."
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
  const input = String(text);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function propertyValue(cell, property) {
  const field = SOIL_PROPERTIES[property]?.field;
  const value = field ? Number(cell?.[field]) : Number(cell?.propertyValue);
  return Number.isFinite(value) ? value : null;
}

function propertyAmplitude(property, values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const low = finite[Math.floor((finite.length - 1) * 0.10)] ?? 0;
  const high = finite[Math.floor((finite.length - 1) * 0.90)] ?? low + 1;
  const spread = Math.max(1e-6, high - low);
  const minimum = {
    ph: 0.28,
    organic_matter: 0.45,
    clay: 4,
    available_water: 0.025,
    salinity: 0.18,
    composite: 0.10
  }[property] ?? spread * 0.25;
  return Math.max(minimum, spread * 0.28);
}

function controlledTruth(cell, base, amplitude, index) {
  const spatialWave = Math.sin((cell.x * 2.7 + cell.y * 1.9) * Math.PI) * 0.44
    + Math.cos((cell.x * 1.3 - cell.y * 2.2) * Math.PI) * 0.24;
  const context = 0.34 * ((cell.disturbancePressure ?? 0.5) - 0.5)
    + 0.22 * ((cell.vulnerability ?? 0.5) - 0.5)
    - 0.18 * ((cell.ecology ?? 0.5) - 0.5);
  const deterministicNoise = Math.sin((index + 1) * 2.173) * 0.045;
  return base + amplitude * (spatialWave + context + deterministicNoise);
}

export function createControlledSoilBenchmarkSamples(scenario, definition, count = 16) {
  const property = definition?.property ?? scenario?.model?.property ?? "ph";
  const eligible = (scenario?.cells ?? []).filter((cell) => propertyValue(cell, property) !== null);
  if (eligible.length < 8) throw new Error(`The ${definition?.label ?? "Soil"} case has insufficient survey-supported cells for a controlled benchmark.`);
  const amplitude = propertyAmplitude(property, eligible.map((cell) => propertyValue(cell, property)));
  const ordered = [...eligible].sort((left, right) => {
    const leftHash = hashNumber(`${definition?.key ?? property}:${left.id ?? `${left.x}:${left.y}`}`);
    const rightHash = hashNumber(`${definition?.key ?? property}:${right.id ?? `${right.x}:${right.y}`}`);
    return leftHash - rightHash;
  });
  const selected = [];
  const desired = Math.min(count, ordered.length);
  for (const cell of ordered) {
    if (selected.length >= desired) break;
    const separated = selected.every((sample) => Math.hypot(sample.x - cell.x, sample.y - cell.y) >= 0.11);
    if (!separated && ordered.length > desired * 2) continue;
    const base = propertyValue(cell, property);
    const observedValue = controlledTruth(cell, base, amplitude, selected.length);
    selected.push({
      ...cell,
      id: `controlled-${definition?.key ?? property}-${selected.length + 1}`,
      sampleId: `CONTROLLED-${String(selected.length + 1).padStart(2, "0")}`,
      analyte: property,
      analyteLabel: SOIL_PROPERTIES[property]?.label ?? property,
      unit: SOIL_PROPERTIES[property]?.unit ?? "",
      observedValue: property === "ph" ? clamp(observedValue, 0, 14) : Math.max(0, observedValue),
      depthTopCm: definition?.depth === "15-30" ? 15 : definition?.depth === "30-60" ? 30 : 0,
      depthBottomCm: definition?.depth === "15-30" ? 30 : definition?.depth === "30-60" ? 60 : 15,
      depthOverlapFraction: 1,
      sampledAt: null,
      detectionLimit: null,
      censored: false,
      qaFlag: "controlled_benchmark",
      reliability: 0.93,
      feasibility: 1,
      sensorNoise: Math.max(amplitude * 0.08, property === "ph" ? 0.03 : 0.005),
      source: "Deterministic controlled benchmark generated over public survey context",
      sourceType: "controlled_benchmark_sample",
      requiresFieldVerification: false,
      controlledBenchmark: true
    });
  }
  if (selected.length < Math.min(8, desired)) throw new Error("Controlled benchmark sampling could not form a sufficiently distributed sample set.");
  return selected;
}

function selectedSolution(result, activeProfile) {
  return result?.solutions?.find((entry) => entry.profileKey === activeProfile) ?? result?.solutions?.[0] ?? null;
}

function scenarioSummary(scenario, definition) {
  const values = (scenario?.cells ?? []).map((cell) => cell.posteriorSoilValue ?? propertyValue(cell, definition.property)).filter(Number.isFinite);
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    scenarioId: scenario?.scenarioId ?? scenario?.id ?? definition.key,
    label: scenario?.cityLabel ?? definition.label,
    property: definition.property,
    propertyLabel: SOIL_PROPERTIES[definition.property]?.label ?? definition.property,
    propertyUnit: SOIL_PROPERTIES[definition.property]?.unit ?? "",
    depth: definition.depth,
    bounds: scenario?.geoBounds ?? definition.bounds,
    evaluationPoints: scenario?.cells?.length ?? 0,
    candidates: scenario?.candidates?.length ?? 0,
    observations: scenario?.observations?.length ?? 0,
    groups: scenario?.groups?.length ?? 0,
    soilSurveyCoverage: scenario?.model?.soilCoverageRate ?? null,
    meanPosteriorValue: mean,
    evidenceType: "controlled_benchmark_over_public_survey_context"
  };
}

function solutionSummary(solution) {
  return {
    profileKey: solution?.profileKey ?? "balanced",
    profileLabel: solution?.profileLabel ?? solution?.profile?.label ?? "Balanced",
    feasible: solution?.constraintStatus?.feasible ?? null,
    paretoOptimal: Boolean(solution?.paretoOptimal),
    selected: (solution?.selected ?? []).map((site) => ({
      id: site.id,
      lat: site.lat,
      lng: site.lng,
      x: site.x,
      y: site.y,
      cost: site.cost,
      reliability: site.reliability,
      hostType: site.hostType ?? null,
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

function optimizeSoilScenario(scenario, settings) {
  const inference = scenario.model?.soilInference ?? {};
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.soil,
    weights: DOMAINS.soil.weights,
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
      lengthScaleMultiplier: inference.lengthScaleMultiplier ?? settings.lengthScaleMultiplier
    },
    seed: scenario.seed
  }, settings.monitorCount, { minimumSeparation: true, beamWidth: 3 });
  return { result, solution: selectedSolution(result, settings.activeProfile) };
}

export async function runNationalSoilEvidenceSuite({
  caseStudies = SOIL_PUBLIC_CASE_STUDIES,
  fetchImpl = globalThis.fetch,
  signal = null,
  includeSensitivity = false,
  settings = {},
  loadScenarioImpl = loadNationalSoilScenario,
  onProgress = () => {}
} = {}) {
  const resolved = {
    monitorCount: Number(settings.monitorCount ?? 10),
    budget: Number(settings.budget ?? 10),
    fairnessLimit: Number(settings.fairnessLimit ?? 0.18),
    minimumGroupInformation: Number(settings.minimumGroupInformation ?? 0.08),
    minimumReliability: Number(settings.minimumReliability ?? 0.65),
    measurementNoise: Number(settings.measurementNoise ?? 0.07),
    lengthScaleMultiplier: Number(settings.lengthScaleMultiplier ?? 1),
    activeProfile: settings.activeProfile ?? "balanced",
    benchmarkSampleCount: Number(settings.benchmarkSampleCount ?? 16)
  };
  const cases = [];
  for (let index = 0; index < caseStudies.length; index += 1) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const definition = caseStudies[index];
    onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage: "Loading public Soil survey and social context" });
    const scenario = await loadScenarioImpl(definition.bounds, {
      property: definition.property,
      depth: definition.depth,
      candidateStrategy: "systematic",
      candidateTarget: 121,
      candidateCap: 150,
      monitorCount: resolved.monitorCount,
      label: definition.label,
      signal,
      fetchImpl,
      onProgress: (stage) => onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage })
    });
    const samples = createControlledSoilBenchmarkSamples(scenario, definition, resolved.benchmarkSampleCount);
    attachSoilInference(scenario, DOMAINS.soil, { samples, analyte: definition.property, lockedSeed: 1701 + index * 101 });
    scenario.model.evidenceType = "controlled_benchmark_over_public_survey_context";
    scenario.model.evidenceBoundary = "Benchmark sample values are deterministic simulation observations, not field or laboratory measurements.";
    onProgress({ caseIndex: index, caseCount: caseStudies.length, caseLabel: definition.label, stage: "Running portfolio and scientific benchmarks" });
    const optimized = optimizeSoilScenario(scenario, resolved);
    const sensitivity = includeSensitivity
      ? runSoilSensitivityAnalysis({
          scenario,
          domain: DOMAINS.soil,
          calibrationSettings: scenario.model?.soilInference ?? resolved,
          splitSeeds: [1701, 2701]
        })
      : null;
    cases.push({
      key: definition.key,
      definition,
      scenario: scenarioSummary(scenario, definition),
      validation: scenario.model?.soilValidation ?? null,
      selectedNetwork: solutionSummary(optimized.solution),
      benchmarks: benchmarkSummary(optimized.result),
      sensitivity
    });
  }
  const scientificInputs = { caseStudies, settings: resolved, includeSensitivity, cases };
  return {
    format: "lumos-soil-public-evidence-v1",
    version: "1.9.1",
    generatedAt: new Date().toISOString(),
    checksum: checksumObject(scientificInputs),
    methodology: {
      spatialProtocol: "Public SSURGO and Census context with deterministic distributed benchmark samples and one frozen optimization protocol.",
      coreModel: "Full LUMOS Bayesian information, social constraints, Pareto portfolio, and scientific benchmark architecture.",
      evidenceBoundary: "The benchmark observations are controlled simulations. They validate computational behavior and comparative design performance, not real contaminant concentrations or regulatory compliance."
    },
    settings: resolved,
    cases
  };
}

export function soilEvidenceRows(bundle) {
  const rows = [];
  for (const caseStudy of bundle?.cases ?? []) {
    const base = {
      case_key: caseStudy.key,
      case_label: caseStudy.definition?.label ?? caseStudy.key,
      property: caseStudy.scenario?.property ?? caseStudy.definition?.property ?? null,
      depth: caseStudy.scenario?.depth ?? caseStudy.definition?.depth ?? null
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
        for (const [metric, value] of Object.entries(metrics ?? {})) {
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

export function rowsToSoilEvidenceCsv(rows = []) {
  const columns = ["table", "case_key", "case_label", "property", "depth", "method", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
