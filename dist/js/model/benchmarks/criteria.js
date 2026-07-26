import { latentCovariance, measurementNoiseVariance } from "../bayesian/kernel.js";
import { cholesky } from "../bayesian/linalg.js";
import {
  addDiagonal,
  logDeterminantPositiveDefinite,
  matrixSubtract,
  submatrix,
  symmetricProductWithInverse
} from "./matrix.js";

const EPSILON = 1e-12;

function noiseDiagonal(design, indices) {
  return indices.map((index) => measurementNoiseVariance(
    design.candidates[index],
    design.modelSettings
  ));
}

export function aOptimalValue(design, selectedIndices) {
  if (selectedIndices.length === 0) return 0;
  let total = 0;
  for (let pointIndex = 0; pointIndex < design.baselineVariance.length; pointIndex += 1) {
    total += Math.max(0, design.baselineVariance[pointIndex] - design.posteriorVariance[pointIndex]);
  }
  return total;
}

export function dOptimalValue(design, selectedIndices) {
  if (selectedIndices.length === 0) return 0;
  const latent = submatrix(design.baseCandidateCovariance ?? design.candidateCovariance, selectedIndices);
  const noise = noiseDiagonal(design, selectedIndices);
  const normalized = latent.map((row, rowIndex) => Float64Array.from(
    row,
    (value, columnIndex) => {
      const scale = Math.sqrt(Math.max(EPSILON, noise[rowIndex] * noise[columnIndex]));
      return value / scale + (rowIndex === columnIndex ? 1 : 0);
    }
  ));
  return 0.5 * logDeterminantPositiveDefinite(normalized);
}

function farthestPointTargets(points, count) {
  if (points.length <= count) return points.map((_, index) => index);
  const centerIndex = points.reduce((best, point, index) => {
    const distance = (point.x - 0.5) ** 2 + (point.y - 0.5) ** 2;
    const bestPoint = points[best];
    const bestDistance = (bestPoint.x - 0.5) ** 2 + (bestPoint.y - 0.5) ** 2;
    return distance < bestDistance ? index : best;
  }, 0);
  const selected = [centerIndex];
  const selectedSet = new Set(selected);

  while (selected.length < count) {
    let bestIndex = -1;
    let bestDistance = -Infinity;
    for (let index = 0; index < points.length; index += 1) {
      if (selectedSet.has(index)) continue;
      const nearest = Math.min(...selected.map((selectedIndex) => {
        const dx = points[index].x - points[selectedIndex].x;
        const dy = points[index].y - points[selectedIndex].y;
        return dx * dx + dy * dy;
      }));
      const socialWeight = 0.75 + 0.25 * Math.max(
        points[index].risk ?? 0,
        points[index].exposure ?? 0,
        points[index].vulnerability ?? 0
      );
      const score = nearest * socialWeight;
      if (score > bestDistance) {
        bestDistance = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    selected.push(bestIndex);
    selectedSet.add(bestIndex);
  }

  return selected;
}

function conditionedTargetBlocks(design, targetIndices) {
  const targets = targetIndices.map((index) => design.evaluationPoints[index]);
  const targetCount = targets.length;
  const candidateCount = design.candidates.length;
  const targetCovariance = Array.from({ length: targetCount }, () => new Float64Array(targetCount));
  const candidateTargetCovariance = Array.from(
    { length: candidateCount },
    () => new Float64Array(targetCount)
  );

  for (let left = 0; left < targetCount; left += 1) {
    for (let right = 0; right <= left; right += 1) {
      const value = latentCovariance(targets[left], targets[right], design.domain, design.modelSettings);
      targetCovariance[left][right] = value;
      targetCovariance[right][left] = value;
    }
  }

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
      candidateTargetCovariance[candidateIndex][targetIndex] = latentCovariance(
        design.candidates[candidateIndex],
        targets[targetIndex],
        design.domain,
        design.modelSettings
      );
    }
  }

  if (design.observations.length === 0) {
    return { targetCovariance, candidateTargetCovariance };
  }

  const observationCount = design.observations.length;
  const observationCovariance = Array.from(
    { length: observationCount },
    () => new Float64Array(observationCount)
  );
  const targetObservationCovariance = Array.from(
    { length: targetCount },
    () => new Float64Array(observationCount)
  );
  const candidateObservationCovariance = Array.from(
    { length: candidateCount },
    () => new Float64Array(observationCount)
  );

  for (let left = 0; left < observationCount; left += 1) {
    for (let right = 0; right <= left; right += 1) {
      const value = latentCovariance(
        design.observations[left],
        design.observations[right],
        design.domain,
        design.modelSettings
      ) + (left === right
        ? measurementNoiseVariance(design.observations[left], design.modelSettings)
        : 0);
      observationCovariance[left][right] = value;
      observationCovariance[right][left] = value;
    }
  }

  for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      targetObservationCovariance[targetIndex][observationIndex] = latentCovariance(
        targets[targetIndex],
        design.observations[observationIndex],
        design.domain,
        design.modelSettings
      );
    }
  }

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
      candidateObservationCovariance[candidateIndex][observationIndex] = latentCovariance(
        design.candidates[candidateIndex],
        design.observations[observationIndex],
        design.domain,
        design.modelSettings
      );
    }
  }

  const lower = cholesky(observationCovariance);
  const targetReduction = symmetricProductWithInverse(targetObservationCovariance, lower);
  const conditionedTarget = matrixSubtract(targetCovariance, targetReduction);

  const solvedTargetObservation = targetObservationCovariance.map((row) => {
    const forward = new Float64Array(observationCount);
    const result = new Float64Array(observationCount);
    for (let rowIndex = 0; rowIndex < observationCount; rowIndex += 1) {
      let value = row[rowIndex];
      for (let columnIndex = 0; columnIndex < rowIndex; columnIndex += 1) {
        value -= lower[rowIndex][columnIndex] * forward[columnIndex];
      }
      forward[rowIndex] = value / lower[rowIndex][rowIndex];
    }
    for (let rowIndex = observationCount - 1; rowIndex >= 0; rowIndex -= 1) {
      let value = forward[rowIndex];
      for (let columnIndex = rowIndex + 1; columnIndex < observationCount; columnIndex += 1) {
        value -= lower[columnIndex][rowIndex] * result[columnIndex];
      }
      result[rowIndex] = value / lower[rowIndex][rowIndex];
    }
    return result;
  });

  const conditionedCross = candidateTargetCovariance.map((row, candidateIndex) => {
    const conditioned = new Float64Array(targetCount);
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
      let reduction = 0;
      for (let observationIndex = 0; observationIndex < observationCount; observationIndex += 1) {
        reduction += candidateObservationCovariance[candidateIndex][observationIndex]
          * solvedTargetObservation[targetIndex][observationIndex];
      }
      conditioned[targetIndex] = row[targetIndex] - reduction;
    }
    return conditioned;
  });

  return {
    targetCovariance: conditionedTarget,
    candidateTargetCovariance: conditionedCross
  };
}

export function prepareTargetMutualInformation(design, targetCount = 36) {
  const targetIndices = farthestPointTargets(
    design.evaluationPoints,
    Math.max(4, Math.min(targetCount, design.evaluationPoints.length))
  );
  const blocks = conditionedTargetBlocks(design, targetIndices);
  const targetLower = cholesky(blocks.targetCovariance);
  const targetExplainedCovariance = symmetricProductWithInverse(
    blocks.candidateTargetCovariance,
    targetLower
  );
  const conditionalCandidateCovariance = matrixSubtract(
    design.baseCandidateCovariance ?? design.candidateCovariance,
    targetExplainedCovariance
  );

  return {
    targetIndices,
    conditionalCandidateCovariance
  };
}

export function targetMutualInformationValue(design, targetContext, selectedIndices) {
  if (selectedIndices.length === 0) return 0;
  const noise = noiseDiagonal(design, selectedIndices);
  const unconditional = addDiagonal(
    submatrix(design.baseCandidateCovariance ?? design.candidateCovariance, selectedIndices),
    noise
  );
  const conditional = addDiagonal(
    submatrix(targetContext.conditionalCandidateCovariance, selectedIndices),
    noise
  );
  return Math.max(
    0,
    0.5 * (
      logDeterminantPositiveDefinite(unconditional)
      - logDeterminantPositiveDefinite(conditional)
    )
  );
}
