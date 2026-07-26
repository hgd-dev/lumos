import { candidateDistance } from "../kernels.js";
import {
  assimilateCandidate,
  candidateVariance,
  cloneDesign,
  forkDesign,
  marginalVarianceReduction
} from "../bayesian/design.js";
import { measurementNoiseVariance } from "../bayesian/kernel.js";
import {
  dOptimalValue,
  prepareTargetMutualInformation,
  targetMutualInformationValue
} from "./criteria.js";

const EPSILON = 1e-12;

function isSeparated(candidate, selectedIndices, candidates, minimumDistance, fixedSites = []) {
  return selectedIndices.every((index) => (
    candidateDistance(candidate, candidates[index]) >= minimumDistance
  )) && fixedSites.every((site) => candidateDistance(candidate, site) >= minimumDistance);
}

function candidateAllowed({
  candidateIndex,
  selectedIndices,
  candidates,
  observations,
  minimumDistance,
  totalCost,
  budget
}) {
  const candidate = candidates[candidateIndex];
  return candidate.feasible
    && !selectedIndices.includes(candidateIndex)
    && totalCost + candidate.cost <= budget + 1e-9
    && (minimumDistance <= 0 || isSeparated(
      candidate,
      selectedIndices,
      candidates,
      minimumDistance,
      observations
    ));
}

function selectGreedy({
  baseDesign,
  count,
  context,
  minimumDistance,
  scoreTrial,
  onSelect
}) {
  const selectedIndices = [];
  let totalCost = 0;
  let design = cloneDesign(baseDesign);
  const diagnostics = [];

  for (let step = 0; step < count; step += 1) {
    let best = null;
    for (let candidateIndex = 0; candidateIndex < design.candidates.length; candidateIndex += 1) {
      if (!candidateAllowed({
        candidateIndex,
        selectedIndices,
        candidates: design.candidates,
        observations: context.observations,
        minimumDistance,
        totalCost,
        budget: context.constraints.budget
      })) continue;

      const score = scoreTrial({ design, selectedIndices, candidateIndex, step });
      if (!Number.isFinite(score)) continue;
      const tieBreak = ((candidateIndex * 2654435761 + step * 1013904223) >>> 0) / 4294967296;
      const rank = score + tieBreak * 1e-12;
      if (!best || rank > best.rank) best = { candidateIndex, score, rank };
    }

    if (!best) break;
    selectedIndices.push(best.candidateIndex);
    totalCost += design.candidates[best.candidateIndex].cost;
    design = onSelect
      ? onSelect({ design, candidateIndex: best.candidateIndex, selectedIndices })
      : assimilateCandidate(design, best.candidateIndex);
    diagnostics.push({
      candidateIndex: best.candidateIndex,
      marginalCriterion: best.score
    });
  }

  return { selectedIndices, diagnostics };
}

export function selectAOptimal(baseDesign, count, context, options = {}) {
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  return selectGreedy({
    baseDesign,
    count,
    context,
    minimumDistance,
    scoreTrial: ({ design, candidateIndex }) => {
      const reduction = marginalVarianceReduction(design, candidateIndex);
      let sum = 0;
      for (const value of reduction) sum += value;
      return sum;
    }
  });
}

export function selectDOptimal(baseDesign, count, context, options = {}) {
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  return selectGreedy({
    baseDesign,
    count,
    context,
    minimumDistance,
    scoreTrial: ({ design, candidateIndex }) => {
      const latentVariance = Math.max(EPSILON, design.candidateCovariance[candidateIndex][candidateIndex]);
      const noise = measurementNoiseVariance(design.candidates[candidateIndex], design.modelSettings);
      return 0.5 * Math.log1p(latentVariance / Math.max(EPSILON, noise));
    }
  });
}

export function selectPivotedCholesky(baseDesign, count, context, options = {}) {
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const residual = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const selectedIndices = [];
  const diagnostics = [];
  let totalCost = 0;

  for (let step = 0; step < count; step += 1) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    for (let candidateIndex = 0; candidateIndex < baseDesign.candidates.length; candidateIndex += 1) {
      if (!candidateAllowed({
        candidateIndex,
        selectedIndices,
        candidates: baseDesign.candidates,
        observations: context.observations,
        minimumDistance,
        totalCost,
        budget: context.constraints.budget
      })) continue;
      const value = residual[candidateIndex][candidateIndex];
      if (value > bestValue) {
        bestValue = value;
        bestIndex = candidateIndex;
      }
    }

    if (bestIndex < 0) break;
    const pivot = Math.max(EPSILON, residual[bestIndex][bestIndex]);
    const pivotColumn = Float64Array.from(residual, (row) => row[bestIndex]);
    for (let left = 0; left < residual.length; left += 1) {
      for (let right = 0; right < residual.length; right += 1) {
        residual[left][right] -= pivotColumn[left] * pivotColumn[right] / pivot;
      }
      residual[left][left] = Math.max(0, residual[left][left]);
    }
    selectedIndices.push(bestIndex);
    totalCost += baseDesign.candidates[bestIndex].cost;
    diagnostics.push({ candidateIndex: bestIndex, marginalCriterion: bestValue });
  }

  return { selectedIndices, diagnostics };
}

export function selectTargetMutualInformation(baseDesign, count, context, options = {}) {
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const targetContext = prepareTargetMutualInformation(baseDesign, options.miTargetCount ?? 36);
  const selectedIndices = [];
  const diagnostics = [];
  let totalCost = 0;
  let currentValue = 0;

  for (let step = 0; step < count; step += 1) {
    let best = null;
    for (let candidateIndex = 0; candidateIndex < baseDesign.candidates.length; candidateIndex += 1) {
      if (!candidateAllowed({
        candidateIndex,
        selectedIndices,
        candidates: baseDesign.candidates,
        observations: context.observations,
        minimumDistance,
        totalCost,
        budget: context.constraints.budget
      })) continue;
      const trial = [...selectedIndices, candidateIndex];
      const value = targetMutualInformationValue(baseDesign, targetContext, trial);
      const marginal = value - currentValue;
      if (!best || marginal > best.marginal) best = { candidateIndex, value, marginal };
    }
    if (!best) break;
    selectedIndices.push(best.candidateIndex);
    totalCost += baseDesign.candidates[best.candidateIndex].cost;
    currentValue = best.value;
    diagnostics.push({
      candidateIndex: best.candidateIndex,
      marginalCriterion: best.marginal
    });
  }

  return {
    selectedIndices,
    diagnostics,
    criterionValue: currentValue,
    targetCount: targetContext.targetIndices.length
  };
}

export function criterionDiagnostics(baseDesign, selectedIndices, options = {}) {
  const targetContext = prepareTargetMutualInformation(baseDesign, options.miTargetCount ?? 36);
  const evaluated = cloneDesign(baseDesign);
  for (const candidateIndex of selectedIndices) assimilateCandidate(evaluated, candidateIndex);
  let aValue = 0;
  for (let index = 0; index < evaluated.posteriorVariance.length; index += 1) {
    aValue += Math.max(0, evaluated.baselineVariance[index] - evaluated.posteriorVariance[index]);
  }
  return {
    aOptimal: aValue,
    dOptimal: dOptimalValue(baseDesign, selectedIndices),
    targetMutualInformation: targetMutualInformationValue(baseDesign, targetContext, selectedIndices)
  };
}

export function selectSocialGreedy(baseDesign, count, context, weights, metricEvaluator, options = {}) {
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  return selectGreedy({
    baseDesign,
    count,
    context,
    minimumDistance,
    scoreTrial: ({ design, selectedIndices, candidateIndex }) => {
      const trial = forkDesign(design);
      assimilateCandidate(trial, candidateIndex);
      return metricEvaluator(
        trial,
        [...selectedIndices, candidateIndex],
        weights,
        baseCandidateCovariance
      ).score;
    }
  });
}
