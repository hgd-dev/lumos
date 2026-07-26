import { prepareBayesianDesign, evaluateSelectedOrder } from "../bayesian/design.js";
import { calculateBayesianMetrics } from "../bayesian/metrics.js";
import { selectSocialGreedy } from "../benchmarks/selectors.js";
import { evaluateConstraintStatus, normalizeConstraints } from "../optimization/constraints.js";
import { profileWeights } from "../optimization/profiles.js";
import { runLockedHeatExperiment } from "./experiments.js";

function stableHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function deterministicSample(items, maximum, seed, keyPrefix) {
  if (items.length <= maximum) return [...items];
  return [...items]
    .map((item, index) => ({
      item,
      rank: stableHash(`${seed}:${keyPrefix}:${item.id ?? index}`)
    }))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, maximum)
    .map(({ item }) => item);
}

function hostType(candidate) {
  return String(candidate.hostType ?? candidate.type ?? "Other").trim() || "Other";
}

function reducedScenario(scenario, seed, candidateFilter = () => true) {
  const candidates = deterministicSample(
    scenario.candidates.filter((candidate) => candidateFilter(candidate)),
    72,
    seed,
    "candidate"
  );
  const cells = deterministicSample(scenario.cells, 480, seed, "cell");
  return {
    cells,
    candidates,
    observations: scenario.observations ?? []
  };
}

function runLeanBalancedNetwork({
  scenario,
  domain,
  modelSettings,
  count,
  budget,
  fairnessLimit,
  minimumGroupInformation,
  minimumReliability,
  enforceSocialConstraints,
  minimumSeparation,
  seed,
  candidateFilter
}) {
  const reduced = reducedScenario(scenario, seed, candidateFilter);
  if (!reduced.candidates.length || !reduced.cells.length) {
    return {
      available: false,
      selected: [],
      candidateCount: reduced.candidates.length,
      cellCount: reduced.cells.length,
      reason: "No eligible candidates or evaluation points remained."
    };
  }

  const constraints = normalizeConstraints({
    budget,
    fairnessLimit,
    minimumGroupInformation,
    minimumReliability,
    enforceSocialConstraints
  });
  const context = {
    ...reduced,
    domain,
    observations: reduced.observations,
    constraints
  };
  const baseDesign = prepareBayesianDesign({
    evaluationPoints: reduced.cells,
    candidates: reduced.candidates,
    observations: reduced.observations,
    domain,
    modelSettings
  });
  const weights = profileWeights(domain.weights, "balanced");
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const evaluator = (design, selectedIndices, metricWeights, covariance) => calculateBayesianMetrics({
    points: design.evaluationPoints,
    candidates: design.candidates,
    selectedIndices,
    baselineVariance: design.baselineVariance,
    posteriorVariance: design.posteriorVariance,
    baseCandidateCovariance: covariance,
    weights: metricWeights,
    fairnessConstraint: constraints.enforceSocialConstraints,
    fairnessLimit: constraints.fairnessLimit
  });

  const started = globalThis.performance?.now?.() ?? Date.now();
  const selectedResult = selectSocialGreedy(
    baseDesign,
    Math.min(count, reduced.candidates.length),
    context,
    weights,
    evaluator,
    { minimumSeparation }
  );
  const evaluated = evaluateSelectedOrder(baseDesign, selectedResult.selectedIndices);
  const metrics = calculateBayesianMetrics({
    points: evaluated.evaluationPoints,
    candidates: evaluated.candidates,
    selectedIndices: selectedResult.selectedIndices,
    baselineVariance: evaluated.baselineVariance,
    posteriorVariance: evaluated.posteriorVariance,
    baseCandidateCovariance,
    weights,
    fairnessConstraint: constraints.enforceSocialConstraints,
    fairnessLimit: constraints.fairnessLimit
  });
  const runtimeMs = (globalThis.performance?.now?.() ?? Date.now()) - started;
  return {
    available: true,
    selected: selectedResult.selectedIndices.map((index) => reduced.candidates[index]),
    selectedIds: selectedResult.selectedIndices.map((index) => reduced.candidates[index].id),
    candidateCount: reduced.candidates.length,
    cellCount: reduced.cells.length,
    metrics,
    constraintStatus: evaluateConstraintStatus(metrics, constraints),
    runtimeMs
  };
}

function splitSensitivity(scenario, domain, settings, seeds) {
  return seeds.map((seed) => {
    const experiment = runLockedHeatExperiment({
      observations: scenario.observations ?? [],
      domain,
      settings,
      splitOptions: { seed }
    });
    const lumos = experiment.lumos;
    return {
      seed,
      available: experiment.available,
      developmentCount: experiment.split?.development?.length ?? 0,
      testCount: experiment.split?.test?.length ?? 0,
      strata: experiment.split?.strata ?? 0,
      mae: lumos?.metrics.mae ?? null,
      rmse: lumos?.metrics.rmse ?? null,
      bias: lumos?.metrics.bias ?? null,
      coverage95: lumos?.metrics.coverage95 ?? null,
      bestMethod: experiment.bestMethod ?? null,
      lumosRank: experiment.available
        ? experiment.methods.findIndex((method) => method.name === "LUMOS covariate + GP") + 1
        : null
    };
  });
}

function covarianceSensitivity(scenario, domain, baseSettings, lengthFactors, noiseFactors, seed) {
  const rows = [];
  for (const lengthFactor of lengthFactors) {
    for (const noiseFactor of noiseFactors) {
      const settings = {
        ...baseSettings,
        lengthScaleMultiplier: Math.max(0.15, finite(baseSettings.lengthScaleMultiplier, 1) * lengthFactor),
        measurementNoise: Math.max(0.001, finite(baseSettings.measurementNoise, 0.06) * noiseFactor)
      };
      const experiment = runLockedHeatExperiment({
        observations: scenario.observations ?? [],
        domain,
        settings,
        splitOptions: { seed }
      });
      rows.push({
        lengthFactor,
        noiseFactor,
        lengthScaleMultiplier: settings.lengthScaleMultiplier,
        measurementNoise: settings.measurementNoise,
        available: experiment.available,
        mae: experiment.lumos?.metrics.mae ?? null,
        rmse: experiment.lumos?.metrics.rmse ?? null,
        bias: experiment.lumos?.metrics.bias ?? null,
        coverage95: experiment.lumos?.metrics.coverage95 ?? null,
        intervalWidth95: experiment.lumos?.metrics.meanIntervalWidth95 ?? null
      });
    }
  }
  return rows.sort((left, right) => finite(left.rmse, Infinity) - finite(right.rmse, Infinity));
}

function hostStressScenarios(scenario, domain, baseOptions) {
  const types = [...new Set(scenario.candidates.map(hostType))].sort();
  const fixedPool = new Set(deterministicSample(
    scenario.candidates, 72, baseOptions.seed, "host-stress-pool"
  ).map((candidate) => candidate.id));
  const inFixedPool = (candidate) => fixedPool.has(candidate.id);
  const scenarios = [{ key: "all", label: "All host types", filter: inFixedPool }];
  for (const type of types) {
    scenarios.push({
      key: `without-${type.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      label: `Remove ${type}`,
      filter: (candidate) => inFixedPool(candidate) && hostType(candidate) !== type
    });
  }
  for (const fraction of [0.25, 0.50]) {
    scenarios.push({
      key: `random-${Math.round(fraction * 100)}`,
      label: `Randomly remove ${Math.round(fraction * 100)}%`,
      filter: (candidate) => inFixedPool(candidate) && (
        stableHash(`${baseOptions.seed}:host-loss:${candidate.id}`) / 4294967296 >= fraction
      )
    });
  }

  return scenarios.map((entry, index) => {
    const result = runLeanBalancedNetwork({
      ...baseOptions,
      scenario,
      domain,
      seed: baseOptions.seed,
      candidateFilter: entry.filter
    });
    return {
      key: entry.key,
      label: entry.label,
      available: result.available,
      candidateCount: result.candidateCount,
      monitorCount: result.selected.length,
      information: result.metrics?.information ?? null,
      exposure: result.metrics?.exposure ?? null,
      minimumGroupInformation: result.metrics?.minimumGroupInformation ?? null,
      fairnessGap: result.metrics?.fairnessGap ?? null,
      reliability: result.metrics?.reliability ?? null,
      totalCost: result.metrics?.totalCost ?? null,
      score: result.metrics?.score ?? null,
      feasible: result.constraintStatus?.feasible ?? false,
      runtimeMs: result.runtimeMs ?? null
    };
  });
}

function fairnessSensitivity(scenario, domain, baseOptions, thresholds) {
  return thresholds.map((fairnessLimit, index) => {
    const result = runLeanBalancedNetwork({
      ...baseOptions,
      scenario,
      domain,
      fairnessLimit,
      seed: baseOptions.seed,
      candidateFilter: () => true
    });
    return {
      fairnessLimit,
      available: result.available,
      candidateCount: result.candidateCount,
      monitorCount: result.selected.length,
      information: result.metrics?.information ?? null,
      exposure: result.metrics?.exposure ?? null,
      minimumGroupInformation: result.metrics?.minimumGroupInformation ?? null,
      fairnessGap: result.metrics?.fairnessGap ?? null,
      reliability: result.metrics?.reliability ?? null,
      totalCost: result.metrics?.totalCost ?? null,
      score: result.metrics?.score ?? null,
      feasible: result.constraintStatus?.feasible ?? false,
      runtimeMs: result.runtimeMs ?? null
    };
  });
}

export function runHeatSensitivityAnalysis({
  scenario,
  domain,
  calibrationSettings = {},
  monitorCount = 10,
  budget = 10,
  fairnessLimit = 0.16,
  minimumGroupInformation = 0.12,
  minimumReliability = 0.70,
  enforceSocialConstraints = true,
  minimumSeparation = true,
  splitSeeds = [101, 307, 701, 20260722],
  lengthFactors = [0.75, 1, 1.25],
  noiseFactors = [0.75, 1, 1.25],
  fairnessThresholds = [0.08, 0.12, 0.16, 0.22, 0.30]
}) {
  const seed = scenario.seed ?? 20260722;
  const modelSettings = {
    lengthScaleMultiplier: finite(calibrationSettings.lengthScaleMultiplier, 1),
    measurementNoise: finite(calibrationSettings.measurementNoise, 0.06),
    trendRidge: finite(calibrationSettings.trendRidge, 0.35),
    transportAngle: scenario.model?.transportAngle
  };
  const baseOptions = {
    modelSettings,
    count: monitorCount,
    budget,
    fairnessLimit,
    minimumGroupInformation,
    minimumReliability,
    enforceSocialConstraints,
    minimumSeparation,
    seed
  };
  const started = globalThis.performance?.now?.() ?? Date.now();
  const result = {
    schema: "lumos.heat.sensitivity.v1",
    generatedAt: new Date().toISOString(),
    cityKey: scenario.cityKey ?? "unknown",
    seed,
    settings: {
      ...baseOptions,
      modelSettings,
      splitSeeds,
      lengthFactors,
      noiseFactors,
      fairnessThresholds
    },
    splitSeeds: splitSensitivity(scenario, domain, modelSettings, splitSeeds),
    covariance: covarianceSensitivity(scenario, domain, modelSettings, lengthFactors, noiseFactors, seed),
    hostStress: hostStressScenarios(scenario, domain, baseOptions),
    fairness: fairnessSensitivity(scenario, domain, baseOptions, fairnessThresholds)
  };
  result.runtimeMs = (globalThis.performance?.now?.() ?? Date.now()) - started;
  return result;
}

function metricRow(table, scenario, metric, value, units = "", extra = {}) {
  return { table, scenario, metric, value, units, ...extra };
}

export function buildHeatPaperRows({ sensitivity, lockedExperiment, calibration }) {
  const rows = [];
  for (const entry of sensitivity?.splitSeeds ?? []) {
    for (const [metric, value, units] of [
      ["MAE", entry.mae, "degF"], ["RMSE", entry.rmse, "degF"], ["Bias", entry.bias, "degF"],
      ["Coverage95", entry.coverage95, "proportion"], ["LUMOS rank", entry.lumosRank, "rank"]
    ]) rows.push(metricRow("split_seed_sensitivity", String(entry.seed), metric, value, units, {
      development_n: entry.developmentCount,
      test_n: entry.testCount,
      best_method: entry.bestMethod
    }));
  }
  for (const entry of sensitivity?.covariance ?? []) {
    for (const [metric, value, units] of [
      ["MAE", entry.mae, "degF"], ["RMSE", entry.rmse, "degF"], ["Bias", entry.bias, "degF"],
      ["Coverage95", entry.coverage95, "proportion"], ["Interval width 95", entry.intervalWidth95, "degF"]
    ]) rows.push(metricRow("covariance_sensitivity", `${entry.lengthScaleMultiplier.toFixed(3)}|${entry.measurementNoise.toFixed(4)}`, metric, value, units, {
      length_scale: entry.lengthScaleMultiplier,
      measurement_noise: entry.measurementNoise
    }));
  }
  for (const entry of sensitivity?.hostStress ?? []) {
    for (const [metric, value, units] of [
      ["Information", entry.information, "proportion"], ["Exposure", entry.exposure, "proportion"],
      ["Worst-group information", entry.minimumGroupInformation, "proportion"], ["Equity gap", entry.fairnessGap, "proportion"],
      ["Reliability", entry.reliability, "proportion"], ["Total cost", entry.totalCost, "cost_units"], ["Score", entry.score, "score"]
    ]) rows.push(metricRow("candidate_host_stress", entry.label, metric, value, units, {
      candidates_n: entry.candidateCount,
      monitors_n: entry.monitorCount,
      feasible: entry.feasible
    }));
  }
  for (const entry of sensitivity?.fairness ?? []) {
    for (const [metric, value, units] of [
      ["Information", entry.information, "proportion"], ["Exposure", entry.exposure, "proportion"],
      ["Worst-group information", entry.minimumGroupInformation, "proportion"], ["Equity gap", entry.fairnessGap, "proportion"],
      ["Reliability", entry.reliability, "proportion"], ["Total cost", entry.totalCost, "cost_units"], ["Score", entry.score, "score"]
    ]) rows.push(metricRow("fairness_threshold_sensitivity", entry.fairnessLimit.toFixed(3), metric, value, units, {
      fairness_limit: entry.fairnessLimit,
      candidates_n: entry.candidateCount,
      monitors_n: entry.monitorCount,
      feasible: entry.feasible
    }));
  }
  for (const method of lockedExperiment?.methods ?? []) {
    for (const [metric, value, units] of [
      ["MAE", method.metrics.mae, "degF"], ["RMSE", method.metrics.rmse, "degF"],
      ["Bias", method.metrics.bias, "degF"], ["R2", method.metrics.r2, "coefficient"],
      ["Coverage95", method.metrics.coverage95, "proportion"]
    ]) rows.push(metricRow("locked_test_models", method.name, metric, value, units, {
      test_n: method.metrics.count
    }));
    for (const group of method.groups ?? []) {
      for (const [metric, value, units] of [
        ["MAE", group.mae, "degF"], ["RMSE", group.rmse, "degF"], ["Bias", group.bias, "degF"]
      ]) rows.push(metricRow("locked_test_social_groups", `${method.name} | ${group.group}`, metric, value, units, {
        group: group.group,
        model: method.name,
        group_n: group.count
      }));
    }
  }
  if (calibration?.settings) {
    rows.push(metricRow("calibration", "selected", "Length scale multiplier", calibration.settings.lengthScaleMultiplier, "multiplier"));
    rows.push(metricRow("calibration", "selected", "Measurement noise", calibration.settings.measurementNoise, "variance_scale"));
    rows.push(metricRow("calibration", "selected", "Settings tested", calibration.tested, "count"));
  }
  return rows;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}
