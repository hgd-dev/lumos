import { latentCovariance, latentVariance, measurementNoiseVariance } from "./kernel.js";
import { cholesky, solveCholesky } from "./linalg.js";

const EPSILON = 1e-12;

function matrix(rows, columns) {
  return Array.from({ length: rows }, () => new Float64Array(columns));
}

function conditionOnObservations(evaluationPoints, candidates, observations, domain, modelSettings) {
  const evaluationCount = evaluationPoints.length;
  const candidateCount = candidates.length;
  const observationCount = observations.length;

  const posteriorVariance = Float64Array.from(evaluationPoints, (point) => latentVariance(point));
  const candidateCovariance = matrix(candidateCount, candidateCount);
  const evaluationCandidateCovariance = matrix(evaluationCount, candidateCount);

  for (let left = 0; left < candidateCount; left += 1) {
    for (let right = 0; right <= left; right += 1) {
      const value = latentCovariance(candidates[left], candidates[right], domain, modelSettings);
      candidateCovariance[left][right] = value;
      candidateCovariance[right][left] = value;
    }
  }

  for (let pointIndex = 0; pointIndex < evaluationCount; pointIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
      evaluationCandidateCovariance[pointIndex][candidateIndex] = latentCovariance(
        evaluationPoints[pointIndex], candidates[candidateIndex], domain, modelSettings
      );
    }
  }

  if (observationCount === 0) {
    return { posteriorVariance, candidateCovariance, evaluationCandidateCovariance };
  }

  const observationCovariance = matrix(observationCount, observationCount);
  const candidateObservationCovariance = matrix(candidateCount, observationCount);
  const evaluationObservationCovariance = matrix(evaluationCount, observationCount);

  for (let left = 0; left < observationCount; left += 1) {
    for (let right = 0; right <= left; right += 1) {
      const value = latentCovariance(observations[left], observations[right], domain, modelSettings)
        + (left === right ? measurementNoiseVariance(observations[left], modelSettings) : 0);
      observationCovariance[left][right] = value;
      observationCovariance[right][left] = value;
    }
  }

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      candidateObservationCovariance[candidateIndex][observationIndex] = latentCovariance(
        candidates[candidateIndex], observations[observationIndex], domain, modelSettings
      );
    }
  }

  for (let pointIndex = 0; pointIndex < evaluationCount; pointIndex += 1) {
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      evaluationObservationCovariance[pointIndex][observationIndex] = latentCovariance(
        evaluationPoints[pointIndex], observations[observationIndex], domain, modelSettings
      );
    }
  }

  const lower = cholesky(observationCovariance);
  const solvedCandidateRows = candidateObservationCovariance.map((row) => solveCholesky(lower, row));
  const solvedEvaluationRows = evaluationObservationCovariance.map((row) => solveCholesky(lower, row));

  for (let pointIndex = 0; pointIndex < evaluationCount; pointIndex += 1) {
    let reduction = 0;
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      reduction += evaluationObservationCovariance[pointIndex][observationIndex]
        * solvedEvaluationRows[pointIndex][observationIndex];
    }
    posteriorVariance[pointIndex] = Math.max(EPSILON, posteriorVariance[pointIndex] - reduction);
  }

  for (let left = 0; left < candidateCount; left += 1) {
    for (let right = 0; right < candidateCount; right += 1) {
      let reduction = 0;
      for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
        reduction += candidateObservationCovariance[left][observationIndex]
          * solvedCandidateRows[right][observationIndex];
      }
      candidateCovariance[left][right] -= reduction;
    }
  }

  for (let pointIndex = 0; pointIndex < evaluationCount; pointIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
      let reduction = 0;
      for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
        reduction += evaluationObservationCovariance[pointIndex][observationIndex]
          * solvedCandidateRows[candidateIndex][observationIndex];
      }
      evaluationCandidateCovariance[pointIndex][candidateIndex] -= reduction;
    }
  }

  return { posteriorVariance, candidateCovariance, evaluationCandidateCovariance };
}

export function prepareBayesianDesign({
  evaluationPoints,
  candidates,
  observations = [],
  domain,
  modelSettings = {}
}) {
  const conditioned = conditionOnObservations(
    evaluationPoints,
    candidates,
    observations,
    domain,
    modelSettings
  );

  return {
    evaluationPoints,
    candidates,
    observations,
    domain,
    modelSettings,
    baselineVariance: Float64Array.from(conditioned.posteriorVariance),
    posteriorVariance: conditioned.posteriorVariance,
    candidateCovariance: conditioned.candidateCovariance,
    evaluationCandidateCovariance: conditioned.evaluationCandidateCovariance,
    selectedIndices: []
  };
}

export function cloneDesign(design) {
  return {
    ...design,
    baselineVariance: Float64Array.from(design.baselineVariance),
    posteriorVariance: Float64Array.from(design.baselineVariance),
    candidateCovariance: design.candidateCovariance.map((row) => Float64Array.from(row)),
    evaluationCandidateCovariance: design.evaluationCandidateCovariance.map((row) => Float64Array.from(row)),
    selectedIndices: []
  };
}

export function candidateVariance(design, candidateIndex) {
  return Math.max(
    EPSILON,
    design.candidateCovariance[candidateIndex][candidateIndex]
      + measurementNoiseVariance(design.candidates[candidateIndex], design.modelSettings)
  );
}

export function marginalVarianceReduction(design, candidateIndex) {
  const denominator = candidateVariance(design, candidateIndex);
  const reduction = new Float64Array(design.evaluationPoints.length);

  for (let pointIndex = 0; pointIndex < reduction.length; pointIndex += 1) {
    const covariance = design.evaluationCandidateCovariance[pointIndex][candidateIndex];
    reduction[pointIndex] = Math.min(
      design.posteriorVariance[pointIndex],
      Math.max(0, covariance * covariance / denominator)
    );
  }

  return reduction;
}

export function assimilateCandidate(design, candidateIndex) {
  const denominator = candidateVariance(design, candidateIndex);
  const candidateCount = design.candidates.length;
  const evaluationCount = design.evaluationPoints.length;
  const pivotColumn = new Float64Array(candidateCount);

  for (let index = 0; index < candidateCount; index += 1) {
    pivotColumn[index] = design.candidateCovariance[index][candidateIndex];
  }

  for (let pointIndex = 0; pointIndex < evaluationCount; pointIndex += 1) {
    const pivotCovariance = design.evaluationCandidateCovariance[pointIndex][candidateIndex];
    design.posteriorVariance[pointIndex] = Math.max(
      EPSILON,
      design.posteriorVariance[pointIndex] - pivotCovariance * pivotCovariance / denominator
    );

    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      design.evaluationCandidateCovariance[pointIndex][candidate] -= (
        pivotCovariance * pivotColumn[candidate] / denominator
      );
    }
  }

  for (let left = 0; left < candidateCount; left += 1) {
    for (let right = 0; right < candidateCount; right += 1) {
      design.candidateCovariance[left][right] -= (
        pivotColumn[left] * pivotColumn[right] / denominator
      );
    }
  }

  design.selectedIndices.push(candidateIndex);
  return design;
}

export function evaluateSelectedOrder(baseDesign, selectedIndices) {
  const design = cloneDesign(baseDesign);
  for (const candidateIndex of selectedIndices) assimilateCandidate(design, candidateIndex);
  return design;
}
