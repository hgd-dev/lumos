import { cholesky, solveCholesky } from "../bayesian/linalg.js";
import { predictGaussianProcess } from "../bayesian/prediction.js";

const DEFAULT_LENGTH_GRID = [0.70, 0.90, 1.10, 1.35];
const DEFAULT_NOISE_GRID = [0.035, 0.055, 0.08, 0.12];
const DEFAULT_TRANSPORT_REGIMES = [
  { key: "isotropic", label: "Isotropic", along: 1, across: 1 },
  { key: "moderate", label: "Moderate downwind", along: 2.35, across: 0.56 },
  { key: "strong", label: "Strong downwind", along: 3.15, across: 0.42 }
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

function baseConcentration(point) {
  if (Number.isFinite(point.priorPollutantValue)) return point.priorPollutantValue;
  if (Number.isFinite(point.pollutantValue)) return point.pollutantValue;
  if (Number.isFinite(point.priorMean)) return point.priorMean;
  if (Number.isFinite(point.observedValue)) return point.observedValue;
  return 0;
}

function featureVector(point) {
  const traffic = Number.isFinite(point.trafficIntensity) ? point.trafficIntensity : 0.5;
  const industry = Number.isFinite(point.industrialProximity) ? point.industrialProximity : 0.5;
  const source = Number.isFinite(point.sourceRisk) ? point.sourceRisk : 0.5;
  const downwind = Number.isFinite(point.downwindSourceRisk) ? point.downwindSourceRisk : source;
  const exposure = Number.isFinite(point.exposure) ? point.exposure : 0.5;
  const vulnerability = Number.isFinite(point.vulnerability) ? point.vulnerability : 0.5;
  const wind = clamp((point.windSpeed ?? 0) / 25);
  return new Float64Array([
    1,
    traffic - 0.5,
    industry - 0.5,
    source - 0.5,
    downwind - 0.5,
    exposure - 0.5,
    vulnerability - 0.5,
    wind - 0.35
  ]);
}

export function fitAirTrend(observations, ridge = 0.45) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  const dimension = featureVector(usable[0] ?? {}).length;
  const normal = Array.from({ length: dimension }, () => new Float64Array(dimension));
  const target = new Float64Array(dimension);

  for (const observation of usable) {
    const features = featureVector(observation);
    const residual = observation.observedValue - baseConcentration(observation);
    const weight = clamp(observation.reliability ?? 0.85, 0.15, 1);
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

  const predict = (point) => {
    const features = featureVector(point);
    let adjustment = 0;
    for (let index = 0; index < coefficients.length; index += 1) adjustment += coefficients[index] * features[index];
    return Math.max(0, baseConcentration(point) + adjustment);
  };

  const residuals = usable.map((observation) => observation.observedValue - predict(observation));
  const residualScale = Math.max(0.35, rmse(residuals), percentile(usable.map((entry) => entry.observedValue), 0.75) * 0.04);

  return { coefficients, residualScale, observationsUsed: usable.length, predict };
}

function residualObservations(observations, trend) {
  return observations
    .filter((observation) => Number.isFinite(observation.observedValue))
    .map((observation) => ({
      ...observation,
      observedValue: (observation.observedValue - trend.predict(observation)) / trend.residualScale,
      sensorNoise: (observation.sensorNoise ?? 0) / trend.residualScale,
      priorMean: 0
    }));
}

export function predictAirField(points, observations, domain, modelSettings = {}) {
  const trend = fitAirTrend(observations, modelSettings.trendRidge ?? 0.45);
  const residual = residualObservations(observations, trend);
  const normalizedPoints = points.map((point) => ({ ...point, priorMean: 0 }));
  const prediction = predictGaussianProcess({
    predictionPoints: normalizedPoints,
    observations: residual,
    domain,
    modelSettings,
    priorMean: () => 0
  });

  const means = new Float64Array(points.length);
  const variances = new Float64Array(points.length);
  for (let index = 0; index < points.length; index += 1) {
    means[index] = Math.max(0, trend.predict(points[index]) + prediction.means[index] * trend.residualScale);
    variances[index] = prediction.variances[index] * trend.residualScale * trend.residualScale;
  }
  return { means, variances, trend, observationsUsed: prediction.observationsUsed };
}

function spatialFold(point, folds) {
  const xBand = Math.min(4, Math.floor(clamp(point.x) * 5));
  const yBand = Math.min(4, Math.floor(clamp(point.y) * 5));
  return (xBand * 3 + yBand * 2 + xBand * yBand) % folds;
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
    r2: totalSquares > 1e-12 ? 1 - residualSquares / totalSquares : 0,
    coverage95: actual.length ? covered / actual.length : 0,
    meanIntervalWidth95: actual.length ? intervalWidth / actual.length : 0
  };
}

function groupName(record) {
  const vulnerability = record.vulnerability ?? 0.5;
  const exposure = record.exposure ?? 0.5;
  return `${vulnerability >= 0.5 ? "Higher vulnerability" : "Lower vulnerability"} · ${exposure >= 0.5 ? "higher exposure" : "lower exposure"}`;
}

function groupMetrics(records) {
  const groups = new Map();
  for (const record of records) {
    const group = groupName(record);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(record);
  }
  return [...groups.entries()].map(([group, entries]) => ({
    group,
    count: entries.length,
    mae: mean(entries.map((entry) => Math.abs(entry.predicted - entry.actual))),
    rmse: rmse(entries.map((entry) => entry.predicted - entry.actual)),
    bias: mean(entries.map((entry) => entry.predicted - entry.actual))
  })).sort((left, right) => left.group.localeCompare(right.group));
}

function nearestPrediction(testing, training) {
  return testing.map((test) => {
    let best = training[0];
    let bestDistance = Infinity;
    for (const candidate of training) {
      const current = (test.x - candidate.x) ** 2 + (test.y - candidate.y) ** 2;
      if (current < bestDistance) { bestDistance = current; best = candidate; }
    }
    return best?.observedValue ?? baseConcentration(test);
  });
}

function idwPrediction(testing, training) {
  return testing.map((test) => {
    let weighted = 0;
    let weights = 0;
    for (const candidate of training) {
      const distance = Math.hypot(test.x - candidate.x, test.y - candidate.y);
      const weight = 1 / Math.max(1e-5, distance * distance);
      weighted += weight * candidate.observedValue;
      weights += weight;
    }
    return weights ? weighted / weights : baseConcentration(test);
  });
}

export function crossValidateAir(observations, domain, modelSettings = {}, folds = 4) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  if (usable.length < 6) return { available: false, reason: "At least six current pollutant observations are required.", count: usable.length };
  const records = [];
  for (let fold = 0; fold < folds; fold += 1) {
    const testing = usable.filter((observation) => spatialFold(observation, folds) === fold);
    const training = usable.filter((observation) => spatialFold(observation, folds) !== fold);
    if (!testing.length || training.length < 3) continue;
    const prediction = predictAirField(testing, training, domain, modelSettings);
    const trend = fitAirTrend(training, modelSettings.trendRidge ?? 0.45);
    const nearest = nearestPrediction(testing, training);
    const idw = idwPrediction(testing, training);
    testing.forEach((observation, index) => records.push({
      actual: observation.observedValue,
      predicted: prediction.means[index],
      variance: prediction.variances[index],
      atmospheric: baseConcentration(observation),
      trend: trend.predict(observation),
      nearest: nearest[index],
      idw: idw[index],
      vulnerability: observation.vulnerability ?? 0.5,
      exposure: observation.exposure ?? 0.5
    }));
  }
  const actual = records.map((entry) => entry.actual);
  const model = regressionMetrics(actual, records.map((entry) => entry.predicted), records.map((entry) => entry.variance));
  return {
    available: records.length > 0,
    folds,
    count: records.length,
    model,
    atmospheric: regressionMetrics(actual, records.map((entry) => entry.atmospheric), records.map(() => 0)),
    trend: regressionMetrics(actual, records.map((entry) => entry.trend), records.map(() => 0)),
    nearest: regressionMetrics(actual, records.map((entry) => entry.nearest), records.map(() => 0)),
    idw: regressionMetrics(actual, records.map((entry) => entry.idw), records.map(() => 0)),
    groups: groupMetrics(records),
    calibrationGap95: Math.abs(model.coverage95 - 0.95)
  };
}

function splitScore(observation, index, seed) {
  const x = Math.floor(clamp(observation.x) * 6);
  const y = Math.floor(clamp(observation.y) * 6);
  let hash = (seed ^ ((x + 1) * 73856093) ^ ((y + 1) * 19349663) ^ ((index + 1) * 83492791)) >>> 0;
  hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
  return hash >>> 0;
}

export function createAirValidationSplit(observations, { testFraction = 0.25, seed = 1207 } = {}) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  if (usable.length < 8) return { development: usable, locked: [], seed, testFraction, available: false };
  const ranked = usable.map((observation, index) => ({ observation, score: splitScore(observation, index, seed) }))
    .sort((left, right) => left.score - right.score || String(left.observation.id).localeCompare(String(right.observation.id)));
  const lockedCount = Math.max(2, Math.min(10, Math.round(usable.length * testFraction)));
  const lockedIds = new Set(ranked.slice(0, lockedCount).map((entry) => entry.observation.id));
  return {
    development: usable.filter((observation) => !lockedIds.has(observation.id)),
    locked: usable.filter((observation) => lockedIds.has(observation.id)),
    seed,
    testFraction,
    available: true
  };
}

export function calibrateAirModel(observations, domain, {
  lengthScaleGrid = DEFAULT_LENGTH_GRID,
  noiseGrid = DEFAULT_NOISE_GRID,
  transportRegimes = DEFAULT_TRANSPORT_REGIMES,
  folds = 4
} = {}) {
  if (observations.filter((entry) => Number.isFinite(entry.observedValue)).length < 6) {
    return { available: false, settings: { lengthScaleMultiplier: 1, measurementNoise: 0.06, transportRegime: "moderate" }, validation: crossValidateAir(observations, domain, {}, folds), tested: 0 };
  }
  let best = null;
  let tested = 0;
  for (const regime of transportRegimes) {
    const regimeDomain = { ...domain, gpAlongScale: regime.along, gpAcrossScale: regime.across };
    for (const lengthScaleMultiplier of lengthScaleGrid) {
      for (const measurementNoise of noiseGrid) {
        const settings = { lengthScaleMultiplier, measurementNoise };
        const validation = crossValidateAir(observations, regimeDomain, settings, folds);
        tested += 1;
        if (!validation.available) continue;
        const score = validation.model.rmse + 0.25 * validation.calibrationGap95 + (regime.key === "isotropic" ? 0.002 : 0);
        if (!best || score < best.score - 1e-12) best = { score, settings: { ...settings, transportRegime: regime.key }, validation, regime };
      }
    }
  }
  return best ? { available: true, ...best, tested } : { available: false, tested, settings: { lengthScaleMultiplier: 1, measurementNoise: 0.06, transportRegime: "moderate" }, validation: crossValidateAir(observations, domain, {}, folds) };
}

export function runAirValidationExperiment(observations, domain, options = {}) {
  const split = createAirValidationSplit(observations, options);
  const calibration = calibrateAirModel(split.development, domain, options);
  if (!split.locked.length || !calibration.available) return { available: false, split, calibration, reason: split.locked.length ? "Air calibration was unavailable." : "At least eight observations are required for a locked test." };
  const calibratedDomain = { ...domain, gpAlongScale: calibration.regime.along, gpAcrossScale: calibration.regime.across };
  const prediction = predictAirField(split.locked, split.development, calibratedDomain, calibration.settings);
  const trend = fitAirTrend(split.development);
  const actual = split.locked.map((entry) => entry.observedValue);
  const nearest = nearestPrediction(split.locked, split.development);
  const idw = idwPrediction(split.locked, split.development);
  const records = split.locked.map((observation, index) => ({
    actual: observation.observedValue,
    predicted: prediction.means[index],
    vulnerability: observation.vulnerability ?? 0.5,
    exposure: observation.exposure ?? 0.5
  }));
  return {
    available: true,
    split,
    calibration,
    locked: {
      lumos: regressionMetrics(actual, [...prediction.means], [...prediction.variances]),
      atmospheric: regressionMetrics(actual, split.locked.map(baseConcentration), actual.map(() => 0)),
      trend: regressionMetrics(actual, split.locked.map((entry) => trend.predict(entry)), actual.map(() => 0)),
      nearest: regressionMetrics(actual, nearest, actual.map(() => 0)),
      idw: regressionMetrics(actual, idw, actual.map(() => 0)),
      groups: groupMetrics(records)
    }
  };
}

export function evaluateAirTransportRegimes(observations, domain, modelSettings = {}) {
  return DEFAULT_TRANSPORT_REGIMES.map((regime) => {
    const activeDomain = { ...domain, gpAlongScale: regime.along, gpAcrossScale: regime.across };
    const validation = crossValidateAir(observations, activeDomain, modelSettings);
    return {
      key: regime.key,
      label: regime.label,
      alongScale: regime.along,
      acrossScale: regime.across,
      available: validation.available,
      rmse: validation.available ? validation.model.rmse : null,
      mae: validation.available ? validation.model.mae : null,
      coverage95: validation.available ? validation.model.coverage95 : null
    };
  });
}

export function attachAirInference(scenario, domain, modelSettings = {}) {
  if (!scenario?.cells?.length) return scenario;
  const observations = scenario.observations?.filter((entry) => Number.isFinite(entry.observedValue)) ?? [];
  if (!observations.length) return scenario;
  const regime = DEFAULT_TRANSPORT_REGIMES.find((entry) => entry.key === modelSettings.transportRegime) ?? DEFAULT_TRANSPORT_REGIMES[1];
  const activeDomain = { ...domain, gpAlongScale: regime.along, gpAcrossScale: regime.across };
  const prediction = predictAirField(scenario.cells, observations, activeDomain, modelSettings);
  const low = percentile([...prediction.means], 0.03);
  const high = percentile([...prediction.means], 0.97);
  const stdHigh = Math.max(0.01, percentile([...prediction.variances].map(Math.sqrt), 0.97));
  scenario.cells = scenario.cells.map((cell, index) => {
    const posteriorNormalized = clamp((prediction.means[index] - low) / Math.max(1e-9, high - low));
    const predictiveUncertainty = clamp(Math.sqrt(prediction.variances[index]) / stdHigh);
    const priorRisk = Number.isFinite(cell.priorAirRisk) ? cell.priorAirRisk : (cell.risk ?? 0.5);
    const priorUncertainty = Number.isFinite(cell.priorAirUncertainty) ? cell.priorAirUncertainty : (cell.uncertainty ?? 0.5);
    return {
      ...cell,
      priorAirRisk: priorRisk,
      priorAirUncertainty: priorUncertainty,
      posteriorPollutant: prediction.means[index],
      posteriorPollutantNormalized: posteriorNormalized,
      predictiveAirStd: Math.sqrt(prediction.variances[index]),
      predictiveAirUncertainty: predictiveUncertainty,
      modelResidual: prediction.means[index] - baseConcentration(cell),
      risk: clamp(0.68 * priorRisk + 0.32 * posteriorNormalized),
      uncertainty: clamp(0.48 * priorUncertainty + 0.52 * predictiveUncertainty)
    };
  });
  scenario.model = {
    ...scenario.model,
    airInference: {
      observationsUsed: prediction.observationsUsed,
      residualScale: prediction.trend.residualScale,
      trendCoefficients: [...prediction.trend.coefficients],
      lengthScaleMultiplier: modelSettings.lengthScaleMultiplier ?? 1,
      measurementNoise: modelSettings.measurementNoise ?? 0.06,
      transportRegime: regime.key,
      alongScale: regime.along,
      acrossScale: regime.across
    }
  };
  return scenario;
}

export { DEFAULT_TRANSPORT_REGIMES };
