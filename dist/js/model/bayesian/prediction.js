import { latentCovariance, latentVariance, measurementNoiseVariance } from "./kernel.js";
import { cholesky, solveCholesky } from "./linalg.js";

const EPSILON = 1e-12;

function matrix(rows, columns) {
  return Array.from({ length: rows }, () => new Float64Array(columns));
}

function defaultPriorMean(point) {
  if (Number.isFinite(point.priorMean)) return point.priorMean;
  if (Number.isFinite(point.baselineTemperatureF)) return point.baselineTemperatureF;
  if (Number.isFinite(point.risk)) return point.risk;
  return 0;
}

export function predictGaussianProcess({
  predictionPoints,
  observations = [],
  domain,
  modelSettings = {},
  priorMean = defaultPriorMean
}) {
  const usable = observations.filter((observation) => Number.isFinite(observation.observedValue));
  const means = Float64Array.from(predictionPoints, (point) => priorMean(point));
  const variances = Float64Array.from(predictionPoints, (point) => latentVariance(point));

  if (!usable.length) {
    return {
      means,
      variances,
      observationsUsed: 0
    };
  }

  const observationCount = usable.length;
  const observationCovariance = matrix(observationCount, observationCount);
  const residuals = new Float64Array(observationCount);

  for (let left = 0; left < observationCount; left += 1) {
    residuals[left] = usable[left].observedValue - priorMean(usable[left]);
    for (let right = 0; right <= left; right += 1) {
      const covariance = latentCovariance(usable[left], usable[right], domain, modelSettings)
        + (left === right ? measurementNoiseVariance(usable[left], modelSettings) : 0);
      observationCovariance[left][right] = covariance;
      observationCovariance[right][left] = covariance;
    }
  }

  const lower = cholesky(observationCovariance);
  const alpha = solveCholesky(lower, residuals);
  const covarianceVector = new Float64Array(observationCount);

  for (let pointIndex = 0; pointIndex < predictionPoints.length; pointIndex += 1) {
    const point = predictionPoints[pointIndex];
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      covarianceVector[observationIndex] = latentCovariance(
        point,
        usable[observationIndex],
        domain,
        modelSettings
      );
    }

    let correction = 0;
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      correction += covarianceVector[observationIndex] * alpha[observationIndex];
    }

    const solved = solveCholesky(lower, covarianceVector);
    let reduction = 0;
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      reduction += covarianceVector[observationIndex] * solved[observationIndex];
    }

    means[pointIndex] += correction;
    variances[pointIndex] = Math.max(EPSILON, latentVariance(point) - reduction);
  }

  return {
    means,
    variances,
    observationsUsed: observationCount
  };
}
