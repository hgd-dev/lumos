import { cholesky, solveCholesky } from "../bayesian/linalg.js";
import { predictGaussianProcess } from "../bayesian/prediction.js";

const DEFAULT_LENGTH_GRID = [0.65, 0.85, 1.05, 1.30, 1.60];
const DEFAULT_NOISE_GRID = [0.02, 0.035, 0.05, 0.075, 0.10];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, fraction) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  const position = clamp(fraction) * (finite.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return finite[lower];
  return finite[lower] + (finite[upper] - finite[lower]) * (position - lower);
}

function rmse(errors) {
  return Math.sqrt(mean(errors.map((error) => error * error)));
}

function featureVector(point) {
  const canopy = Number.isFinite(point.treeCanopy) ? point.treeCanopy : 0.24;
  const impervious = Number.isFinite(point.impervious) ? point.impervious : (point.builtForm ?? 0.6);
  const exposure = Number.isFinite(point.exposure) ? point.exposure : 0.5;
  const vulnerability = Number.isFinite(point.vulnerability) ? point.vulnerability : 0.5;
  return new Float64Array([
    1,
    canopy - 0.25,
    impervious - 0.60,
    exposure - 0.50,
    vulnerability - 0.50,
    (impervious - 0.60) * (1 - canopy)
  ]);
}

function baseTemperature(point) {
  if (Number.isFinite(point.baselineTemperatureF)) return point.baselineTemperatureF;
  if (Number.isFinite(point.priorMeanTemperatureF)) return point.priorMeanTemperatureF;
  if (Number.isFinite(point.observedValue)) return point.observedValue;
  return 86;
}

export function fitHeatTrend(observations, ridge = 0.35) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  const dimension = featureVector(usable[0] ?? {}).length;
  const normal = Array.from({ length: dimension }, () => new Float64Array(dimension));
  const target = new Float64Array(dimension);

  for (const observation of usable) {
    const features = featureVector(observation);
    const residual = observation.observedValue - baseTemperature(observation);
    const weight = clamp(observation.reliability ?? 0.9, 0.2, 1);
    for (let row = 0; row < dimension; row += 1) {
      target[row] += weight * features[row] * residual;
      for (let column = 0; column < dimension; column += 1) {
        normal[row][column] += weight * features[row] * features[column];
      }
    }
  }

  for (let index = 0; index < dimension; index += 1) {
    normal[index][index] += index === 0 ? ridge * 0.05 : ridge;
  }

  const coefficients = usable.length
    ? solveCholesky(cholesky(normal), target)
    : new Float64Array(dimension);

  const predict = (point) => {
    const features = featureVector(point);
    let adjustment = 0;
    for (let index = 0; index < coefficients.length; index += 1) {
      adjustment += coefficients[index] * features[index];
    }
    return baseTemperature(point) + adjustment;
  };

  const residuals = usable.map((observation) => observation.observedValue - predict(observation));
  const residualScale = Math.max(0.6, rmse(residuals));

  return {
    coefficients,
    residualScale,
    observationsUsed: usable.length,
    predict
  };
}

function makeResidualObservations(observations, trend) {
  return observations
    .filter((observation) => Number.isFinite(observation.observedValue))
    .map((observation) => ({
      ...observation,
      observedValue: (observation.observedValue - trend.predict(observation)) / trend.residualScale,
      sensorNoise: (observation.sensorNoise ?? 0) / trend.residualScale,
      priorMean: 0
    }));
}

export function predictHeatField(points, observations, domain, modelSettings = {}) {
  const trend = fitHeatTrend(observations, modelSettings.trendRidge ?? 0.35);
  const residualObservations = makeResidualObservations(observations, trend);
  const normalizedPoints = points.map((point) => ({ ...point, priorMean: 0 }));
  const prediction = predictGaussianProcess({
    predictionPoints: normalizedPoints,
    observations: residualObservations,
    domain,
    modelSettings,
    priorMean: () => 0
  });

  const means = new Float64Array(points.length);
  const variances = new Float64Array(points.length);
  for (let index = 0; index < points.length; index += 1) {
    means[index] = trend.predict(points[index]) + prediction.means[index] * trend.residualScale;
    variances[index] = prediction.variances[index] * trend.residualScale * trend.residualScale;
  }

  return {
    means,
    variances,
    trend,
    observationsUsed: prediction.observationsUsed
  };
}

function spatialFold(point, folds) {
  const xBand = Math.min(3, Math.floor(clamp(point.x) * 4));
  const yBand = Math.min(3, Math.floor(clamp(point.y) * 4));
  return (xBand + 2 * yBand + xBand * yBand) % folds;
}

function regressionMetrics(actual, predicted, variances) {
  const errors = actual.map((value, index) => predicted[index] - value);
  const absoluteErrors = errors.map(Math.abs);
  const actualMean = mean(actual);
  const totalSquares = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const residualSquares = errors.reduce((sum, error) => sum + error * error, 0);
  let covered = 0;
  let intervalWidth = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const standardDeviation = Math.sqrt(Math.max(0, variances[index]));
    const width = 1.96 * standardDeviation;
    intervalWidth += width * 2;
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

function groupMetrics(records) {
  const buckets = new Map();
  for (const record of records) {
    const group = Number.isFinite(record.hvi)
      ? `HVI ${Math.round(record.hvi)}`
      : record.vulnerability >= 0.66
        ? "High vulnerability"
        : record.vulnerability >= 0.33
          ? "Moderate vulnerability"
          : "Lower vulnerability";
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push(record);
  }

  return [...buckets.entries()]
    .map(([group, entries]) => ({
      group,
      count: entries.length,
      mae: mean(entries.map((entry) => Math.abs(entry.predicted - entry.actual))),
      rmse: rmse(entries.map((entry) => entry.predicted - entry.actual)),
      bias: mean(entries.map((entry) => entry.predicted - entry.actual))
    }))
    .sort((left, right) => left.group.localeCompare(right.group));
}

export function crossValidateHeat(observations, domain, modelSettings = {}, folds = 5) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  if (usable.length < 6) {
    return {
      available: false,
      reason: "At least six temperature observations are required for spatial cross-validation.",
      count: usable.length
    };
  }

  const records = [];
  for (let fold = 0; fold < folds; fold += 1) {
    const testing = usable.filter((observation) => spatialFold(observation, folds) === fold);
    const training = usable.filter((observation) => spatialFold(observation, folds) !== fold);
    if (!testing.length || training.length < 3) continue;
    const prediction = predictHeatField(testing, training, domain, modelSettings);
    testing.forEach((observation, index) => {
      records.push({
        actual: observation.observedValue,
        predicted: prediction.means[index],
        variance: prediction.variances[index],
        baseline: baseTemperature(observation),
        hvi: observation.hvi,
        vulnerability: observation.vulnerability ?? 0.5
      });
    });
  }

  const actual = records.map((record) => record.actual);
  const predicted = records.map((record) => record.predicted);
  const variances = records.map((record) => record.variance);
  const baseline = records.map((record) => record.baseline);
  const baselineVariances = records.map(() => Math.max(1, modelSettings.baselineVarianceF2 ?? 9));

  return {
    available: records.length > 0,
    folds,
    count: records.length,
    model: regressionMetrics(actual, predicted, variances),
    baseline: regressionMetrics(actual, baseline, baselineVariances),
    groups: groupMetrics(records),
    calibrationGap95: Math.abs(regressionMetrics(actual, predicted, variances).coverage95 - 0.95)
  };
}

export function calibrateHeatModel(scenario, domain, {
  lengthScaleGrid = DEFAULT_LENGTH_GRID,
  noiseGrid = DEFAULT_NOISE_GRID,
  folds = 5
} = {}) {
  const observations = scenario?.observations?.filter((observation) => Number.isFinite(observation.observedValue)) ?? [];
  if (observations.length < 6) {
    return {
      available: false,
      settings: { lengthScaleMultiplier: 1, measurementNoise: 0.06 },
      validation: crossValidateHeat(observations, domain, {}, folds),
      tested: 0
    };
  }

  let best = null;
  let tested = 0;
  for (const lengthScaleMultiplier of lengthScaleGrid) {
    for (const measurementNoise of noiseGrid) {
      const settings = { lengthScaleMultiplier, measurementNoise };
      const validation = crossValidateHeat(observations, domain, settings, folds);
      tested += 1;
      if (!validation.available) continue;
      const score = validation.model.rmse + validation.calibrationGap95 * 0.35;
      if (!best || score < best.score - 1e-12) {
        best = { score, settings, validation };
      }
    }
  }

  return best
    ? { available: true, ...best, tested }
    : {
        available: false,
        settings: { lengthScaleMultiplier: 1, measurementNoise: 0.06 },
        validation: crossValidateHeat(observations, domain, {}, folds),
        tested
      };
}

export function attachHeatInference(scenario, domain, modelSettings = {}) {
  if (!scenario?.cells?.length) return scenario;
  const prediction = predictHeatField(scenario.cells, scenario.observations ?? [], domain, modelSettings);
  const low = percentile([...prediction.means], 0.03);
  const high = percentile([...prediction.means], 0.97);
  const standardDeviationHigh = Math.max(0.1, percentile([...prediction.variances].map(Math.sqrt), 0.97));

  scenario.cells = scenario.cells.map((cell, index) => ({
    ...cell,
    posteriorMeanTemperatureF: prediction.means[index],
    posteriorHeat: clamp((prediction.means[index] - low) / Math.max(1e-9, high - low)),
    predictiveStdF: Math.sqrt(prediction.variances[index]),
    predictiveUncertainty: clamp(Math.sqrt(prediction.variances[index]) / standardDeviationHigh)
  }));

  scenario.model = {
    ...scenario.model,
    heatInference: {
      observationsUsed: prediction.observationsUsed,
      residualScaleF: prediction.trend.residualScale,
      trendCoefficients: [...prediction.trend.coefficients],
      lengthScaleMultiplier: modelSettings.lengthScaleMultiplier ?? 1,
      measurementNoise: modelSettings.measurementNoise ?? 0.06
    }
  };

  return scenario;
}
