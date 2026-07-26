import { DOMAINS } from "../../config/domains.js";
import { optimizeNetwork } from "../optimizer.js";
import {
  DEFAULT_TRANSPORT_REGIMES,
  crossValidateAir,
  runAirValidationExperiment
} from "./inference.js";

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function stableHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicSample(items, maximum, seed, prefix) {
  if (items.length <= maximum) return [...items];
  return [...items]
    .map((item, index) => ({ item, rank: stableHash(`${seed}:${prefix}:${item.id ?? index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, maximum)
    .map(({ item }) => item);
}

function reducedScenario(scenario, seed, candidateFilter = () => true) {
  return {
    cells: deterministicSample(scenario.cells ?? [], 480, seed, "air-cell"),
    candidates: deterministicSample((scenario.candidates ?? []).filter(candidateFilter), 84, seed, "air-candidate"),
    observations: scenario.observations ?? []
  };
}

function runReducedNetwork({
  scenario,
  domain,
  monitorCount,
  budget,
  fairnessLimit,
  minimumGroupInformation,
  minimumReliability,
  measurementNoise,
  lengthScaleMultiplier,
  enforceSocialConstraints,
  seed,
  candidateFilter = () => true
}) {
  const reduced = reducedScenario(scenario, seed, candidateFilter);
  if (!reduced.cells.length || !reduced.candidates.length) {
    return { available: false, selected: [], candidateCount: reduced.candidates.length, metrics: null, feasible: false };
  }
  const result = optimizeNetwork({
    cells: reduced.cells,
    candidates: reduced.candidates,
    observations: reduced.observations,
    domain,
    weights: DOMAINS.air.weights,
    fairnessConstraint: enforceSocialConstraints,
    fairnessLimit,
    constraints: {
      enforceSocialConstraints,
      fairnessLimit,
      minimumGroupInformation,
      minimumReliability,
      budget
    },
    modelSettings: {
      measurementNoise,
      lengthScaleMultiplier,
      transportAngle: scenario.model?.transportAngle ?? domain.transportAngle ?? 0
    },
    seed
  }, Math.min(monitorCount, reduced.candidates.length), {
    minimumSeparation: true,
    beamWidth: 2,
    profileKeys: ["balanced"],
    exactPoolSize: 8,
    exactSelectionCount: 3
  });
  return {
    available: true,
    selected: result.selected,
    candidateCount: reduced.candidates.length,
    metrics: result.metrics,
    feasible: result.constraintStatus?.feasible ?? false
  };
}

function splitSeedSensitivity(observations, domain, settings, seeds) {
  return seeds.map((seed) => {
    const experiment = runAirValidationExperiment(observations, domain, {
      seed,
      lengthScaleGrid: [settings.lengthScaleMultiplier],
      noiseGrid: [settings.measurementNoise],
      transportRegimes: DEFAULT_TRANSPORT_REGIMES
    });
    const locked = experiment.locked?.lumos;
    const methods = experiment.available
      ? [
          ["LUMOS", experiment.locked.lumos.rmse],
          ["Atmospheric", experiment.locked.atmospheric.rmse],
          ["Trend", experiment.locked.trend.rmse],
          ["IDW", experiment.locked.idw.rmse],
          ["Nearest", experiment.locked.nearest.rmse]
        ].sort((left, right) => left[1] - right[1])
      : [];
    return {
      seed,
      available: experiment.available,
      developmentCount: experiment.split?.development?.length ?? 0,
      lockedCount: experiment.split?.locked?.length ?? 0,
      rmse: locked?.rmse ?? null,
      mae: locked?.mae ?? null,
      bias: locked?.bias ?? null,
      coverage95: locked?.coverage95 ?? null,
      lumosRank: methods.findIndex(([name]) => name === "LUMOS") + 1 || null
    };
  });
}

function covarianceTransportSensitivity(observations, domain, settings, lengthFactors, noiseFactors) {
  const rows = [];
  for (const regime of DEFAULT_TRANSPORT_REGIMES) {
    const activeDomain = { ...domain, gpAlongScale: regime.along, gpAcrossScale: regime.across };
    for (const lengthFactor of lengthFactors) {
      for (const noiseFactor of noiseFactors) {
        const modelSettings = {
          lengthScaleMultiplier: Math.max(0.15, settings.lengthScaleMultiplier * lengthFactor),
          measurementNoise: Math.max(0.001, settings.measurementNoise * noiseFactor)
        };
        const validation = crossValidateAir(observations, activeDomain, modelSettings, 4);
        rows.push({
          transportRegime: regime.key,
          transportLabel: regime.label,
          alongScale: regime.along,
          acrossScale: regime.across,
          lengthScaleMultiplier: modelSettings.lengthScaleMultiplier,
          measurementNoise: modelSettings.measurementNoise,
          available: validation.available,
          rmse: validation.available ? validation.model.rmse : null,
          mae: validation.available ? validation.model.mae : null,
          coverage95: validation.available ? validation.model.coverage95 : null,
          intervalWidth95: validation.available ? validation.model.meanIntervalWidth95 : null
        });
      }
    }
  }
  return rows.sort((left, right) => finite(left.rmse, Infinity) - finite(right.rmse, Infinity));
}

function observationRobustness(observations, domain, settings, seed) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  const rankedReliability = [...usable].sort((left, right) => finite(right.reliability) - finite(left.reliability));
  const deterministicKeep = (fraction) => usable.filter((entry, index) => (
    stableHash(`${seed}:air-observation:${entry.id ?? index}`) / 4294967296
  ) >= fraction);
  const scenarios = [
    { key: "all", label: "All compatible readings", records: usable },
    { key: "reference-only", label: "Reference monitors only", records: usable.filter((entry) => entry.monitorType === "reference" || entry.official) },
    { key: "drop-low-quality", label: "Remove lowest-reliability 25%", records: rankedReliability.slice(0, Math.max(1, Math.ceil(rankedReliability.length * 0.75))) },
    { key: "random-25", label: "Deterministically remove 25%", records: deterministicKeep(0.25) },
    { key: "double-noise", label: "Double measurement noise", records: usable.map((entry) => ({ ...entry, sensorNoise: finite(entry.sensorNoise, 0.5) * 2 })) }
  ];
  return scenarios.map((scenario) => {
    const validation = crossValidateAir(scenario.records, domain, settings, 4);
    return {
      key: scenario.key,
      label: scenario.label,
      count: scenario.records.length,
      available: validation.available,
      rmse: validation.available ? validation.model.rmse : null,
      mae: validation.available ? validation.model.mae : null,
      bias: validation.available ? validation.model.bias : null,
      coverage95: validation.available ? validation.model.coverage95 : null
    };
  });
}

function candidateRoleStress(scenario, domain, base) {
  const roles = ["roadside", "source-oriented", "calibration-collocation", "background"];
  const scenarios = [
    { key: "all", label: "All candidate roles", filter: () => true },
    ...roles.map((role) => ({
      key: `without-${role}`,
      label: `Remove ${role}`,
      filter: (candidate) => candidate.airRole !== role
    }))
  ];
  return scenarios.map((entry) => {
    const result = runReducedNetwork({ ...base, scenario, domain, candidateFilter: entry.filter });
    const roleCounts = {};
    for (const candidate of result.selected ?? []) {
      const role = candidate.airRole ?? "unclassified";
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }
    return {
      key: entry.key,
      label: entry.label,
      candidateCount: result.candidateCount,
      monitorCount: result.selected?.length ?? 0,
      information: result.metrics?.information ?? null,
      minimumGroupInformation: result.metrics?.minimumGroupInformation ?? null,
      fairnessGap: result.metrics?.fairnessGap ?? null,
      reliability: result.metrics?.reliability ?? null,
      totalCost: result.metrics?.totalCost ?? null,
      feasible: result.feasible,
      roleCounts
    };
  });
}

function fairnessSensitivity(scenario, domain, base, thresholds) {
  return thresholds.map((fairnessLimit) => {
    const result = runReducedNetwork({ ...base, scenario, domain, fairnessLimit });
    return {
      fairnessLimit,
      candidateCount: result.candidateCount,
      monitorCount: result.selected?.length ?? 0,
      information: result.metrics?.information ?? null,
      minimumGroupInformation: result.metrics?.minimumGroupInformation ?? null,
      fairnessGap: result.metrics?.fairnessGap ?? null,
      reliability: result.metrics?.reliability ?? null,
      totalCost: result.metrics?.totalCost ?? null,
      feasible: result.feasible
    };
  });
}

export function runAirSensitivityAnalysis({
  scenario,
  domain,
  calibrationSettings = {},
  monitorCount = 10,
  budget = 10,
  fairnessLimit = 0.18,
  minimumGroupInformation = 0.08,
  minimumReliability = 0.65,
  enforceSocialConstraints = true,
  seed = 1307,
  splitSeeds = [1207, 2203, 3301, 4409],
  lengthFactors = [0.75, 1, 1.25],
  noiseFactors = [0.75, 1, 1.25],
  fairnessThresholds = [0.08, 0.12, 0.18, 0.24, 0.30]
} = {}) {
  if (!scenario?.cells?.length) throw new Error("A fitted Air scenario is required.");
  const observations = scenario.observations?.filter((entry) => Number.isFinite(entry.observedValue)) ?? [];
  const settings = {
    lengthScaleMultiplier: finite(calibrationSettings.lengthScaleMultiplier, 1),
    measurementNoise: finite(calibrationSettings.measurementNoise, 0.06),
    transportRegime: calibrationSettings.transportRegime ?? "moderate"
  };
  const started = globalThis.performance?.now?.() ?? Date.now();
  const base = {
    monitorCount,
    budget,
    fairnessLimit,
    minimumGroupInformation,
    minimumReliability,
    measurementNoise: settings.measurementNoise,
    lengthScaleMultiplier: settings.lengthScaleMultiplier,
    enforceSocialConstraints,
    seed
  };
  return {
    format: "lumos-air-sensitivity-v1",
    version: "1.9.1",
    generatedAt: new Date().toISOString(),
    settings: { ...base, splitSeeds, lengthFactors, noiseFactors, fairnessThresholds },
    observationCount: observations.length,
    splitSeeds: splitSeedSensitivity(observations, domain, settings, splitSeeds),
    covarianceTransport: covarianceTransportSensitivity(observations, domain, settings, lengthFactors, noiseFactors),
    observationRobustness: observationRobustness(observations, domain, settings, seed),
    candidateRoles: candidateRoleStress(scenario, domain, base),
    fairness: fairnessSensitivity(scenario, domain, base, fairnessThresholds),
    runtimeMs: (globalThis.performance?.now?.() ?? Date.now()) - started
  };
}

export function buildAirPaperRows(sensitivity, scenario = null) {
  const rows = [];
  const base = {
    scenario_id: scenario?.scenarioId ?? scenario?.id ?? "air-workspace",
    scenario_label: scenario?.cityLabel ?? "Air workspace",
    pollutant: scenario?.model?.pollutant ?? null,
    pollutant_label: scenario?.model?.pollutantLabel ?? null,
    unit: scenario?.model?.pollutantUnit ?? null
  };
  const pushMetrics = (table, scenarioLabel, record, ignored = []) => {
    for (const [metric, value] of Object.entries(record ?? {})) {
      if (ignored.includes(metric) || typeof value === "object") continue;
      rows.push({ table, ...base, scenario: scenarioLabel, metric, value });
    }
  };
  for (const entry of sensitivity?.splitSeeds ?? []) pushMetrics("split_seed", String(entry.seed), entry, ["seed", "available"]);
  for (const entry of sensitivity?.covarianceTransport ?? []) pushMetrics("covariance_transport", `${entry.transportRegime}-${entry.lengthScaleMultiplier}-${entry.measurementNoise}`, entry, ["available"]);
  for (const entry of sensitivity?.observationRobustness ?? []) pushMetrics("observation_robustness", entry.label, entry, ["key", "label", "available"]);
  for (const entry of sensitivity?.candidateRoles ?? []) pushMetrics("candidate_role_stress", entry.label, entry, ["key", "label", "roleCounts"]);
  for (const entry of sensitivity?.fairness ?? []) pushMetrics("fairness_threshold", String(entry.fairnessLimit), entry, ["fairnessLimit"]);
  return rows;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToAirCsv(rows) {
  const columns = ["table", "scenario_id", "scenario_label", "pollutant", "pollutant_label", "unit", "scenario", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
