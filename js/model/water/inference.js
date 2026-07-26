import { cholesky, solveCholesky } from "../bayesian/linalg.js";
import { predictGaussianProcess } from "../bayesian/prediction.js";

const EPSILON = 1e-12;
const DEFAULT_LENGTH_GRID = [0.70, 0.90, 1.10, 1.35];
const DEFAULT_NOISE_GRID = [0.035, 0.055, 0.08, 0.12];
const DEFAULT_FLOW_REGIMES = [
  { key: "isotropic", label: "Isotropic", along: 1, across: 1, branchPenalty: 0 },
  { key: "moderate", label: "Moderate flow-aware", along: 2.0, across: 0.48, branchPenalty: 0.72 },
  { key: "strong", label: "Strong flow-aware", along: 2.8, across: 0.36, branchPenalty: 0.92 }
];

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function percentile(values, fraction) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return 0;
  const position = clamp(fraction) * (usable.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return usable[lower] + (usable[upper] - usable[lower]) * (position - lower);
}

function rmse(errors) {
  return Math.sqrt(mean(errors.map((error) => error * error)));
}

function simpleHash(text) {
  let hash = 2166136261;
  const input = String(text);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isLogIndicator(indicator) {
  return ["specific_conductance", "turbidity", "discharge"].includes(indicator);
}

function toModelScale(value, indicator) {
  if (!Number.isFinite(value)) return 0;
  return isLogIndicator(indicator) ? Math.log1p(Math.max(0, value)) : value;
}

function fromModelScale(value, indicator) {
  if (!Number.isFinite(value)) return 0;
  return isLogIndicator(indicator) ? Math.max(0, Math.expm1(value)) : value;
}

function baseIndicator(point) {
  if (Number.isFinite(point.priorWaterIndicatorValue)) return point.priorWaterIndicatorValue;
  if (Number.isFinite(point.waterIndicatorPrior)) return point.waterIndicatorPrior;
  if (Number.isFinite(point.waterIndicatorValue)) return point.waterIndicatorValue;
  if (Number.isFinite(point.priorMean)) return point.priorMean;
  if (Number.isFinite(point.observedValue)) return point.observedValue;
  return 0;
}

function featureVector(point) {
  return new Float64Array([
    1,
    (point.upstreamSourcePressure ?? 0.5) - 0.5,
    (point.downstreamExposure ?? 0.5) - 0.5,
    (point.flowConnectivity ?? 0.5) - 0.5,
    (point.monitoringDensity ?? 0.5) - 0.5,
    (point.vulnerability ?? 0.5) - 0.5,
    (point.exposure ?? 0.5) - 0.5,
    (point.ecology ?? 0.5) - 0.5,
    (point.flowPosition ?? 0.5) - 0.5
  ]);
}

export function fitWaterTrend(observations, { indicator = "temperature", ridge = 0.55 } = {}) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  const dimension = featureVector(usable[0] ?? {}).length;
  const normal = Array.from({ length: dimension }, () => new Float64Array(dimension));
  const target = new Float64Array(dimension);

  for (const observation of usable) {
    const features = featureVector(observation);
    const residual = toModelScale(observation.observedValue, indicator) - toModelScale(baseIndicator(observation), indicator);
    const weight = clamp(observation.reliability ?? 0.88, 0.15, 1);
    for (let row = 0; row < dimension; row += 1) {
      target[row] += weight * features[row] * residual;
      for (let column = 0; column < dimension; column += 1) {
        normal[row][column] += weight * features[row] * features[column];
      }
    }
  }

  for (let index = 0; index < dimension; index += 1) {
    normal[index][index] += index === 0 ? ridge * 0.08 : ridge;
  }

  const coefficients = usable.length
    ? solveCholesky(cholesky(normal), target)
    : new Float64Array(dimension);

  const predictModel = (point) => {
    const features = featureVector(point);
    let adjustment = 0;
    for (let index = 0; index < coefficients.length; index += 1) adjustment += coefficients[index] * features[index];
    return toModelScale(baseIndicator(point), indicator) + adjustment;
  };
  const predict = (point) => fromModelScale(predictModel(point), indicator);
  const residuals = usable.map((observation) => toModelScale(observation.observedValue, indicator) - predictModel(observation));
  const realResiduals = usable.map((observation) => observation.observedValue - predict(observation));
  const modelValues = usable.map((entry) => toModelScale(entry.observedValue, indicator));
  const residualScale = Math.max(0.04, rmse(residuals), Math.abs(percentile(modelValues, 0.75) - percentile(modelValues, 0.25)) * 0.08);
  const realResidualScale = Math.max(EPSILON, rmse(realResiduals), Math.abs(percentile(usable.map((entry) => entry.observedValue), 0.75) - percentile(usable.map((entry) => entry.observedValue), 0.25)) * 0.08);

  return { coefficients, residualScale, realResidualScale, observationsUsed: usable.length, indicator, predict, predictModel };
}

function residualObservations(observations, trend) {
  return observations
    .filter((observation) => Number.isFinite(observation.observedValue))
    .map((observation) => ({
      ...observation,
      observedValue: (toModelScale(observation.observedValue, trend.indicator) - trend.predictModel(observation)) / trend.residualScale,
      sensorNoise: Math.max(0.01, observation.sensorNoise ?? 0.05),
      priorMean: 0
    }));
}

function resolveFlowRegime(modelSettings = {}) {
  if (modelSettings.flowRegime && typeof modelSettings.flowRegime === "object") return modelSettings.flowRegime;
  const key = modelSettings.flowRegime ?? modelSettings.transportRegime ?? "moderate";
  return DEFAULT_FLOW_REGIMES.find((entry) => entry.key === key) ?? DEFAULT_FLOW_REGIMES[1];
}

export function predictWaterField(points, observations, domain, modelSettings = {}) {
  const indicator = modelSettings.indicator ?? "temperature";
  const trend = fitWaterTrend(observations, { indicator, ridge: modelSettings.trendRidge ?? 0.55 });
  const residual = residualObservations(observations, trend);
  const normalizedPoints = points.map((point) => ({ ...point, priorMean: 0 }));
  const regime = resolveFlowRegime(modelSettings);
  const prediction = predictGaussianProcess({
    predictionPoints: normalizedPoints,
    observations: residual,
    domain,
    modelSettings: {
      ...modelSettings,
      gpAlongScale: regime.along,
      gpAcrossScale: regime.across,
      branchPenalty: regime.branchPenalty
    },
    priorMean: () => 0
  });

  const means = new Float64Array(points.length);
  const variances = new Float64Array(points.length);
  for (let index = 0; index < points.length; index += 1) {
    const modelMean = trend.predictModel(points[index]) + prediction.means[index] * trend.residualScale;
    means[index] = fromModelScale(modelMean, indicator);
    const modelVariance = prediction.variances[index] * trend.residualScale * trend.residualScale;
    const derivative = isLogIndicator(indicator) ? Math.exp(modelMean) : 1;
    variances[index] = Math.max(EPSILON, derivative * derivative * modelVariance);
  }
  return { means, variances, trend, observationsUsed: prediction.observationsUsed, regime };
}

function regressionMetrics(actual, predicted, variances = []) {
  const errors = actual.map((value, index) => predicted[index] - value);
  const absoluteErrors = errors.map(Math.abs);
  const actualMean = mean(actual);
  const totalSquares = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const residualSquares = errors.reduce((sum, error) => sum + error * error, 0);
  let covered = 0;
  let intervalWidth = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const standardDeviation = Math.sqrt(Math.max(0, variances[index] ?? 0));
    const width = 1.96 * standardDeviation;
    intervalWidth += 2 * width;
    if (actual[index] >= predicted[index] - width && actual[index] <= predicted[index] + width) covered += 1;
  }
  return {
    count: actual.length,
    mae: mean(absoluteErrors),
    rmse: rmse(errors),
    bias: mean(errors),
    r2: totalSquares > EPSILON ? 1 - residualSquares / totalSquares : 0,
    coverage95: actual.length ? covered / actual.length : 0,
    meanIntervalWidth95: actual.length ? intervalWidth / actual.length : 0
  };
}

function nearestPrediction(testing, training) {
  return testing.map((test) => {
    let best = training[0];
    let bestDistance = Infinity;
    for (const candidate of training) {
      const branchPenalty = Math.abs((test.networkBranch ?? 0) - (candidate.networkBranch ?? 0)) * 0.18;
      const current = Math.hypot(test.x - candidate.x, test.y - candidate.y) + branchPenalty;
      if (current < bestDistance) { bestDistance = current; best = candidate; }
    }
    return best?.observedValue ?? baseIndicator(test);
  });
}

function idwPrediction(testing, training) {
  return testing.map((test) => {
    let weighted = 0;
    let weights = 0;
    for (const candidate of training) {
      const distance = Math.hypot(test.x - candidate.x, test.y - candidate.y);
      const branchSimilarity = Math.exp(-0.8 * Math.abs((test.networkBranch ?? 0) - (candidate.networkBranch ?? 0)));
      const weight = branchSimilarity * (candidate.reliability ?? 0.9) / Math.max(1e-5, distance * distance);
      weighted += weight * candidate.observedValue;
      weights += weight;
    }
    return weights ? weighted / weights : baseIndicator(test);
  });
}

function groupMetrics(records) {
  const groups = new Map();
  for (const record of records) {
    const label = `${record.vulnerability >= 0.5 ? "Higher" : "Lower"} vulnerability · ${record.exposure >= 0.5 ? "higher" : "lower"} exposure`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(record);
  }
  return [...groups.entries()].map(([group, entries]) => ({
    group,
    count: entries.length,
    mae: mean(entries.map((entry) => Math.abs(entry.predicted - entry.actual))),
    rmse: rmse(entries.map((entry) => entry.predicted - entry.actual)),
    bias: mean(entries.map((entry) => entry.predicted - entry.actual))
  })).sort((left, right) => left.group.localeCompare(right.group));
}

function spatialFold(point, folds) {
  const xBand = Math.min(4, Math.floor(clamp(point.x) * 5));
  const yBand = Math.min(4, Math.floor(clamp(point.y) * 5));
  const branch = Math.abs(Math.round(point.networkBranch ?? 0));
  return (xBand * 3 + yBand * 2 + branch * 5 + xBand * yBand) % folds;
}

export function crossValidateWater(observations, domain, modelSettings = {}, folds = 4) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  if (usable.length < 6) return { available: false, reason: "At least six compatible Water observations are required.", count: usable.length };
  const records = [];
  for (let fold = 0; fold < folds; fold += 1) {
    const testing = usable.filter((observation) => spatialFold(observation, folds) === fold);
    const training = usable.filter((observation) => spatialFold(observation, folds) !== fold);
    if (!testing.length || training.length < 3) continue;
    const prediction = predictWaterField(testing, training, domain, modelSettings);
    const isotropic = predictWaterField(testing, training, domain, { ...modelSettings, flowRegime: "isotropic" });
    const trend = fitWaterTrend(training, { indicator: modelSettings.indicator, ridge: modelSettings.trendRidge ?? 0.55 });
    const nearest = nearestPrediction(testing, training);
    const idw = idwPrediction(testing, training);
    testing.forEach((observation, index) => records.push({
      actual: observation.observedValue,
      predicted: prediction.means[index],
      variance: prediction.variances[index],
      isotropic: isotropic.means[index],
      screening: baseIndicator(observation),
      trend: trend.predict(observation),
      nearest: nearest[index],
      idw: idw[index],
      vulnerability: observation.vulnerability ?? 0.5,
      exposure: observation.exposure ?? 0.5
    }));
  }
  if (!records.length) return { available: false, reason: "Spatial folds did not leave enough development observations.", count: usable.length };
  const actual = records.map((entry) => entry.actual);
  return {
    available: true,
    count: records.length,
    folds,
    model: regressionMetrics(actual, records.map((entry) => entry.predicted), records.map((entry) => entry.variance)),
    isotropic: regressionMetrics(actual, records.map((entry) => entry.isotropic)),
    screening: regressionMetrics(actual, records.map((entry) => entry.screening)),
    trend: regressionMetrics(actual, records.map((entry) => entry.trend)),
    nearest: regressionMetrics(actual, records.map((entry) => entry.nearest)),
    idw: regressionMetrics(actual, records.map((entry) => entry.idw)),
    groups: groupMetrics(records)
  };
}

export function calibrateWaterModel(observations, domain, {
  indicator = "temperature",
  lengthGrid = DEFAULT_LENGTH_GRID,
  noiseGrid = DEFAULT_NOISE_GRID,
  flowRegimes = DEFAULT_FLOW_REGIMES,
  folds = 4
} = {}) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  if (usable.length < 6) return { available: false, reason: "At least six compatible Water observations are required.", count: usable.length };
  const candidates = [];
  for (const regime of flowRegimes) {
    for (const lengthScaleMultiplier of lengthGrid) {
      for (const measurementNoise of noiseGrid) {
        const settings = { indicator, lengthScaleMultiplier, measurementNoise, flowRegime: regime };
        const validation = crossValidateWater(usable, domain, settings, folds);
        if (!validation.available) continue;
        const calibrationPenalty = 1 + 0.55 * Math.abs(validation.model.coverage95 - 0.95);
        candidates.push({ regime, settings, validation, score: validation.model.rmse * calibrationPenalty });
      }
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  return { available: Boolean(candidates.length), count: usable.length, tested: candidates.length, selected: candidates[0] ?? null, candidates };
}

export function createLockedWaterSplit(observations, fraction = 0.25, seed = 1901) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  const target = Math.max(1, Math.min(usable.length - 3, Math.round(usable.length * fraction)));
  const strata = new Map();
  for (const observation of usable) {
    const xBand = observation.x >= 0.5 ? 1 : 0;
    const yBand = observation.y >= 0.5 ? 1 : 0;
    const key = `${Math.round(observation.networkBranch ?? 0)}:${xBand}:${yBand}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(observation);
  }
  for (const entries of strata.values()) {
    entries.sort((left, right) => simpleHash(`${seed}:${left.siteCode ?? left.id}:${left.x}:${left.y}`) - simpleHash(`${seed}:${right.siteCode ?? right.id}:${right.x}:${right.y}`));
  }
  const locked = [];
  const orderedStrata = [...strata.entries()].sort(([left], [right]) => left.localeCompare(right));
  let cursor = 0;
  while (locked.length < target && orderedStrata.some(([, entries]) => entries.length)) {
    const [, entries] = orderedStrata[cursor % orderedStrata.length];
    if (entries.length) locked.push(entries.shift());
    cursor += 1;
  }
  const lockedIds = new Set(locked.map((entry) => entry.id));
  const development = usable.filter((entry) => !lockedIds.has(entry.id));
  return { development, locked, seed, fraction };
}

export function runWaterValidationExperiment(observations, domain, settings = {}, { lockedFraction = 0.25, seed = 1901 } = {}) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  if (usable.length < 8) return { available: false, reason: "At least eight compatible Water observations are required for a locked validation experiment.", count: usable.length };
  const split = createLockedWaterSplit(usable, lockedFraction, seed);
  const calibration = calibrateWaterModel(split.development, domain, { indicator: settings.indicator ?? "temperature" });
  const resolved = calibration.available ? calibration.selected.settings : {
    indicator: settings.indicator ?? "temperature",
    lengthScaleMultiplier: settings.lengthScaleMultiplier ?? 1,
    measurementNoise: settings.measurementNoise ?? 0.06,
    flowRegime: settings.flowRegime ?? "moderate"
  };
  const prediction = predictWaterField(split.locked, split.development, domain, resolved);
  const isotropic = predictWaterField(split.locked, split.development, domain, { ...resolved, flowRegime: "isotropic" });
  const trend = fitWaterTrend(split.development, { indicator: resolved.indicator, ridge: resolved.trendRidge ?? 0.55 });
  const nearest = nearestPrediction(split.locked, split.development);
  const idw = idwPrediction(split.locked, split.development);
  const actual = split.locked.map((entry) => entry.observedValue);
  const records = split.locked.map((entry, index) => ({
    actual: entry.observedValue,
    predicted: prediction.means[index],
    vulnerability: entry.vulnerability ?? 0.5,
    exposure: entry.exposure ?? 0.5
  }));
  return {
    available: true,
    seed,
    split,
    calibration,
    settings: resolved,
    locked: {
      lumos: regressionMetrics(actual, [...prediction.means], [...prediction.variances]),
      isotropic: regressionMetrics(actual, [...isotropic.means], [...isotropic.variances]),
      screening: regressionMetrics(actual, split.locked.map(baseIndicator)),
      trend: regressionMetrics(actual, split.locked.map((entry) => trend.predict(entry))),
      nearest: regressionMetrics(actual, nearest),
      idw: regressionMetrics(actual, idw),
      groups: groupMetrics(records)
    }
  };
}

function nearestCell(point, cells) {
  let best = cells[0];
  let bestDistance = Infinity;
  for (const cell of cells) {
    const distance = (cell.x - point.x) ** 2 + (cell.y - point.y) ** 2;
    if (distance < bestDistance) { best = cell; bestDistance = distance; }
  }
  return best;
}

export function attachWaterObservationContext(scenario) {
  if (!scenario?.cells?.length) return [];
  scenario.observations = (scenario.observations ?? []).map((observation) => {
    const cell = nearestCell(observation, scenario.cells);
    return {
      ...observation,
      priorWaterIndicatorValue: cell?.priorWaterIndicatorValue ?? cell?.waterIndicatorValue ?? observation.observedValue,
      priorMean: cell?.priorWaterIndicatorValue ?? cell?.waterIndicatorValue ?? observation.observedValue,
      flowConnectivity: cell?.flowConnectivity ?? 0.5,
      upstreamSourcePressure: cell?.upstreamSourcePressure ?? 0.5,
      downstreamExposure: cell?.downstreamExposure ?? 0.5,
      monitoringDensity: cell?.monitoringDensity ?? 0.5,
      networkBranch: cell?.networkBranch ?? 0,
      flowPosition: cell?.flowPosition ?? 0.5,
      vulnerability: cell?.vulnerability ?? 0.5,
      exposure: cell?.exposure ?? 0.5,
      ecology: cell?.ecology ?? 0.5,
      uncertainty: cell?.uncertainty ?? 0.5
    };
  });
  return scenario.observations;
}

function indicatorRisk(value, values, definition = {}) {
  if (!Number.isFinite(value)) return 0.5;
  if (definition.direction === "deviation") return clamp(Math.abs(value - (definition.center ?? 7.5)) / Math.max(0.1, definition.spread ?? 2.2));
  const transformed = values.map((entry) => toModelScale(entry, definition.key)).filter(Number.isFinite);
  const scaled = toModelScale(value, definition.key);
  const low = percentile(transformed, 0.08);
  const high = percentile(transformed, 0.92);
  const normalized = clamp((scaled - low) / Math.max(EPSILON, high - low));
  if (definition.direction === "low") return 1 - normalized;
  if (definition.direction === "extreme") {
    const center = percentile(transformed, 0.5);
    return clamp(Math.abs(scaled - center) / Math.max(EPSILON, high - low));
  }
  return normalized;
}

export function attachWaterInference(scenario, domain, {
  indicator = scenario?.model?.indicator ?? "temperature",
  indicatorDefinition = {},
  calibration = null,
  lockedSeed = 1901
} = {}) {
  if (!scenario?.cells?.length) throw new Error("A fitted Water scenario is required.");
  const compatible = attachWaterObservationContext(scenario).filter((entry) => Number.isFinite(entry.observedValue));
  scenario.model.waterObservationCount = compatible.length;
  scenario.cells.forEach((cell) => {
    if (!Number.isFinite(cell.priorWaterIndicatorValue)) cell.priorWaterIndicatorValue = cell.waterIndicatorValue;
  });
  if (compatible.length < 3) {
    scenario.model.waterInference = null;
    scenario.model.waterValidation = { available: false, count: compatible.length, reason: "At least three compatible Water observations are required for posterior conditioning." };
    scenario.cells.forEach((cell) => {
      cell.posteriorWaterValue = null;
      cell.predictiveWaterUncertainty = null;
      cell.waterModelResidual = null;
    });
    return scenario;
  }

  const resolvedCalibration = calibration?.available ? calibration : calibrateWaterModel(compatible, domain, { indicator });
  const settings = resolvedCalibration?.selected?.settings ?? {
    indicator,
    lengthScaleMultiplier: 1,
    measurementNoise: 0.06,
    flowRegime: "moderate"
  };
  const prediction = predictWaterField(scenario.cells, compatible, domain, settings);
  const posteriorValues = [...prediction.means];
  const observedValues = compatible.map((entry) => entry.observedValue);
  const definition = { ...indicatorDefinition, key: indicator };
  const referenceScale = Math.max(prediction.trend.realResidualScale * 2, Math.abs(percentile(observedValues, 0.9) - percentile(observedValues, 0.1)) * 0.35, EPSILON);

  scenario.cells.forEach((cell, index) => {
    const prior = cell.priorWaterIndicatorValue ?? cell.waterIndicatorValue ?? posteriorValues[index];
    const predictiveSd = Math.sqrt(Math.max(0, prediction.variances[index]));
    const risk = indicatorRisk(posteriorValues[index], observedValues, definition);
    cell.posteriorWaterValue = posteriorValues[index];
    cell.predictiveWaterUncertainty = predictiveSd;
    cell.waterModelResidual = posteriorValues[index] - prior;
    cell.waterIndicatorValue = posteriorValues[index];
    cell.risk = clamp(0.50 * risk + 0.19 * (cell.upstreamSourcePressure ?? 0.5) + 0.16 * (cell.downstreamExposure ?? 0.5) + 0.15 * clamp(predictiveSd / referenceScale));
    cell.uncertainty = clamp(0.10 + 0.72 * clamp(predictiveSd / referenceScale) + 0.10 * (1 - (cell.flowConnectivity ?? 0.5)) + 0.08 * (1 - (cell.monitoringDensity ?? 0.5)));
    cell.communityPriority = clamp(0.38 * cell.risk + 0.28 * (cell.vulnerability ?? 0.5) + 0.20 * (cell.exposure ?? 0.5) + 0.14 * cell.uncertainty);
  });

  scenario.model.waterInference = {
    indicator,
    observationsUsed: compatible.length,
    residualScale: prediction.trend.realResidualScale,
    transformedResidualScale: prediction.trend.residualScale,
    lengthScaleMultiplier: settings.lengthScaleMultiplier,
    measurementNoise: settings.measurementNoise,
    flowRegime: prediction.regime.key,
    flowRegimeLabel: prediction.regime.label,
    gpAlongScale: prediction.regime.along,
    gpAcrossScale: prediction.regime.across,
    branchPenalty: prediction.regime.branchPenalty,
    calibrationCandidates: resolvedCalibration?.tested ?? 0
  };
  scenario.model.waterCalibration = resolvedCalibration;
  scenario.model.waterValidation = runWaterValidationExperiment(compatible, domain, settings, { seed: lockedSeed });
  scenario.sourceMetadata ??= { sources: [], layers: [], limitations: [] };
  scenario.sourceMetadata.layers = (scenario.sourceMetadata.layers ?? []).filter((layer) => layer.label !== "Flow-aware Water posterior");
  scenario.sourceMetadata.layers.push({
    key: "waterIndicatorValue",
    label: "Flow-aware Water posterior",
    source: `${compatible.length} compatible USGS observations + screening trend + directional residual Gaussian process`,
    status: scenario.model.waterValidation.available ? "conditioned and locked-validated" : "conditioned; locked validation unavailable",
    resolution: "Continuous posterior on the active LUMOS evaluation mesh",
    confidence: scenario.model.waterValidation.available ? "medium" : "low-to-medium",
    interpretation: `Posterior ${scenario.model.indicatorLabel ?? indicator} estimate in ${scenario.model.indicatorUnit ?? "source units"}; not a regulatory or safety determination.`
  });
  return scenario;
}

export { DEFAULT_FLOW_REGIMES };
