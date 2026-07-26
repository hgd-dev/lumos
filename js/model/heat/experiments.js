import { fitHeatTrend, predictHeatField } from "./inference.js";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rmse(errors) {
  return Math.sqrt(mean(errors.map((error) => error * error)));
}

function baseTemperature(point) {
  if (Number.isFinite(point.baselineTemperatureF)) return point.baselineTemperatureF;
  if (Number.isFinite(point.priorMeanTemperatureF)) return point.priorMeanTemperatureF;
  if (Number.isFinite(point.observedValue)) return point.observedValue;
  return 86;
}

function stableHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function checksumObject(value) {
  return stableHash(canonicalStringify(value)).toString(16).padStart(8, "0");
}

function spatialStratum(observation) {
  const xBand = Math.min(3, Math.max(0, Math.floor(clamp(observation.x ?? 0.5) * 4)));
  const yBand = Math.min(3, Math.max(0, Math.floor(clamp(observation.y ?? 0.5) * 4)));
  const vulnerabilityBand = Math.min(2, Math.max(0, Math.floor(clamp(observation.vulnerability ?? 0.5) * 3)));
  return `${xBand}-${yBand}-${vulnerabilityBand}`;
}

export function createLockedHeatSplit(observations, {
  testFraction = 0.22,
  seed = 20260722,
  minimumTest = 6
} = {}) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  if (usable.length < minimumTest + 4) {
    return {
      available: false,
      reason: `At least ${minimumTest + 4} observations are required for a locked development/test split.`,
      development: usable,
      test: [],
      testFraction,
      seed
    };
  }

  const strata = new Map();
  for (const observation of usable) {
    const key = spatialStratum(observation);
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(observation);
  }

  const selectedIds = new Set();
  for (const [stratum, entries] of strata.entries()) {
    const ordered = [...entries].sort((left, right) => {
      const leftHash = stableHash(`${seed}:${stratum}:${left.id ?? left.sensorId}`);
      const rightHash = stableHash(`${seed}:${stratum}:${right.id ?? right.sensorId}`);
      return leftHash - rightHash || String(left.id).localeCompare(String(right.id));
    });
    const count = entries.length >= 4 ? Math.max(1, Math.round(entries.length * testFraction)) : 0;
    ordered.slice(0, count).forEach((entry) => selectedIds.add(entry.id));
  }

  const targetCount = Math.max(minimumTest, Math.round(usable.length * testFraction));
  if (selectedIds.size < targetCount) {
    const remainder = usable
      .filter((entry) => !selectedIds.has(entry.id))
      .sort((left, right) => stableHash(`${seed}:remainder:${left.id}`) - stableHash(`${seed}:remainder:${right.id}`));
    remainder.slice(0, targetCount - selectedIds.size).forEach((entry) => selectedIds.add(entry.id));
  }

  if (selectedIds.size > Math.max(targetCount, minimumTest)) {
    const orderedIds = [...selectedIds].sort((left, right) => stableHash(`${seed}:trim:${left}`) - stableHash(`${seed}:trim:${right}`));
    selectedIds.clear();
    orderedIds.slice(0, Math.max(targetCount, minimumTest)).forEach((id) => selectedIds.add(id));
  }

  const test = usable.filter((entry) => selectedIds.has(entry.id));
  const development = usable.filter((entry) => !selectedIds.has(entry.id));
  return {
    available: test.length >= minimumTest && development.length >= 4,
    development,
    test,
    testFraction: test.length / usable.length,
    seed,
    strata: new Set(test.map(spatialStratum)).size
  };
}

function regressionMetrics(actual, predicted, variances = null) {
  const errors = actual.map((value, index) => predicted[index] - value);
  const absoluteErrors = errors.map(Math.abs);
  const actualMean = mean(actual);
  const totalSquares = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const residualSquares = errors.reduce((sum, error) => sum + error * error, 0);
  let covered = 0;
  let widthSum = 0;
  if (variances) {
    for (let index = 0; index < actual.length; index += 1) {
      const width = 1.96 * Math.sqrt(Math.max(0, variances[index]));
      widthSum += width * 2;
      if (actual[index] >= predicted[index] - width && actual[index] <= predicted[index] + width) covered += 1;
    }
  }
  return {
    count: actual.length,
    mae: mean(absoluteErrors),
    rmse: rmse(errors),
    bias: mean(errors),
    r2: totalSquares > 1e-12 ? 1 - residualSquares / totalSquares : 0,
    coverage95: variances && actual.length ? covered / actual.length : null,
    meanIntervalWidth95: variances && actual.length ? widthSum / actual.length : null
  };
}

function groupLabel(record) {
  if (Number.isFinite(record.hvi)) return `HVI ${Math.round(record.hvi)}`;
  if ((record.vulnerability ?? 0.5) >= 0.66) return "High vulnerability";
  if ((record.vulnerability ?? 0.5) >= 0.33) return "Moderate vulnerability";
  return "Lower vulnerability";
}

function groupMetrics(records) {
  const buckets = new Map();
  for (const record of records) {
    const label = groupLabel(record);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(record);
  }
  return [...buckets.entries()].map(([group, entries]) => ({
    group,
    count: entries.length,
    mae: mean(entries.map((entry) => Math.abs(entry.predicted - entry.actual))),
    rmse: rmse(entries.map((entry) => entry.predicted - entry.actual)),
    bias: mean(entries.map((entry) => entry.predicted - entry.actual))
  })).sort((left, right) => left.group.localeCompare(right.group));
}

function distance(left, right) {
  return Math.hypot((left.x ?? 0) - (right.x ?? 0), (left.y ?? 0) - (right.y ?? 0));
}

function nearestPrediction(point, training) {
  let best = training[0];
  let bestDistance = Infinity;
  for (const observation of training) {
    const current = distance(point, observation);
    if (current < bestDistance) {
      best = observation;
      bestDistance = current;
    }
  }
  return best?.observedValue ?? baseTemperature(point);
}

function idwPrediction(point, training, power = 2) {
  let numerator = 0;
  let denominator = 0;
  for (const observation of training) {
    const current = distance(point, observation);
    if (current < 1e-9) return observation.observedValue;
    const weight = 1 / Math.pow(current, power);
    numerator += weight * observation.observedValue;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : baseTemperature(point);
}

function evaluateMethod(name, test, predicted, variances = null) {
  const actual = test.map((entry) => entry.observedValue);
  const metrics = regressionMetrics(actual, predicted, variances);
  const records = test.map((entry, index) => ({
    ...entry,
    actual: entry.observedValue,
    predicted: predicted[index]
  }));
  return { name, metrics, groups: groupMetrics(records) };
}

export function runLockedHeatExperiment({
  observations,
  domain,
  settings,
  splitOptions = {}
}) {
  const split = createLockedHeatSplit(observations, splitOptions);
  if (!split.available) return { available: false, split, methods: [] };

  const { development, test } = split;
  const sourcePredictions = test.map(baseTemperature);
  const trend = fitHeatTrend(development, settings?.trendRidge ?? 0.35);
  const trendPredictions = test.map(trend.predict);
  const nearestPredictions = test.map((point) => nearestPrediction(point, development));
  const idwPredictions = test.map((point) => idwPrediction(point, development));
  const lumos = predictHeatField(test, development, domain, settings);

  const methods = [
    evaluateMethod("LUMOS covariate + GP", test, [...lumos.means], [...lumos.variances]),
    evaluateMethod("Source surface only", test, sourcePredictions),
    evaluateMethod("Covariate trend only", test, trendPredictions),
    evaluateMethod("Inverse-distance weighting", test, idwPredictions),
    evaluateMethod("Nearest observed sensor", test, nearestPredictions)
  ].sort((left, right) => left.metrics.rmse - right.metrics.rmse);

  const lumosMethod = methods.find((method) => method.name === "LUMOS covariate + GP");
  return {
    available: true,
    split,
    methods,
    lumos: lumosMethod,
    bestMethod: methods[0].name,
    generalizationGap: lumosMethod.metrics.rmse - methods[0].metrics.rmse
  };
}

function compactPoint(point) {
  const keys = [
    "id", "x", "y", "lat", "lng", "risk", "riskBaseline", "futureRisk", "plannedRisk",
    "interventionBenefit", "baselineTemperatureF", "controlTemperatureF", "plannedTemperatureF",
    "posteriorMeanTemperatureF", "predictiveStdF", "uncertainty", "exposure", "vulnerability",
    "communityPriority", "ecology", "treeCanopy", "impervious", "hvi", "communityGroup",
    "cost", "reliability", "feasibility", "feasible", "hostType", "observedValue", "sensorNoise"
  ];
  return Object.fromEntries(keys.filter((key) => point[key] !== undefined).map((key) => [key, point[key]]));
}

export function createHeatExperimentPackage({
  scenario,
  calibration,
  lockedExperiment,
  configuration = {},
  release = "0.7.0"
}) {
  const payload = {
    schema: "lumos.heat.experiment.v1",
    release,
    createdAt: new Date().toISOString(),
    cityKey: scenario.cityKey,
    cityLabel: scenario.cityLabel,
    domainKey: scenario.domainKey,
    seed: scenario.seed,
    sourceMetadata: scenario.sourceMetadata,
    calibration: calibration ? {
      settings: calibration.settings,
      tested: calibration.tested,
      developmentValidation: calibration.validation
    } : null,
    lockedTest: lockedExperiment?.available ? {
      seed: lockedExperiment.split.seed,
      developmentIds: lockedExperiment.split.development.map((entry) => entry.id),
      testIds: lockedExperiment.split.test.map((entry) => entry.id),
      methods: lockedExperiment.methods
    } : null,
    configuration,
    model: scenario.model,
    geoBounds: scenario.geoBounds,
    boundaries: scenario.boundaries,
    cells: scenario.cells.map(compactPoint),
    candidates: scenario.candidates.map(compactPoint),
    observations: scenario.observations.map(compactPoint)
  };
  const checksum = checksumObject({
    ...payload,
    createdAt: null,
    sourceMetadata: payload.sourceMetadata
      ? { ...payload.sourceMetadata, retrievedAt: null }
      : null
  });
  return {
    ...payload,
    experimentId: `nyc-heat-${scenario.seed}-${checksum}`,
    checksum
  };
}
