import { candidateDistance } from "./kernels.js";
import {
  prepareBayesianDesign,
  cloneDesign,
  marginalVarianceReduction,
  assimilateCandidate,
  evaluateSelectedOrder
} from "./bayesian/design.js";
import {
  calculateBayesianMetrics,
  summarizeMarginalContributions
} from "./bayesian/metrics.js";
import { validateScenario } from "./schema/scenario.js";

function isSeparated(candidate, selectedIndices, candidates, minimumDistance, fixedSites = []) {
  return selectedIndices.every((index) => (
    candidateDistance(candidate, candidates[index]) >= minimumDistance
  )) && fixedSites.every((site) => candidateDistance(candidate, site) >= minimumDistance);
}

function posteriorAfterReduction(posteriorVariance, reduction) {
  const trial = new Float64Array(posteriorVariance.length);
  for (let index = 0; index < trial.length; index += 1) {
    trial[index] = Math.max(1e-12, posteriorVariance[index] - reduction[index]);
  }
  return trial;
}

function metricsFor(design, selectedIndices, posteriorVariance, context, baseCandidateCovariance) {
  return calculateBayesianMetrics({
    points: design.evaluationPoints,
    candidates: design.candidates,
    selectedIndices,
    baselineVariance: design.baselineVariance,
    posteriorVariance,
    baseCandidateCovariance,
    weights: context.weights,
    fairnessConstraint: context.fairnessConstraint,
    fairnessLimit: context.fairnessLimit
  });
}

function greedyBayesianSelect(baseDesign, count, context, options = {}) {
  const design = cloneDesign(baseDesign);
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const selectedIndices = [];
  const selectedSet = new Set();
  const explanations = [];
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;

  let currentMetrics = metricsFor(
    design,
    selectedIndices,
    design.posteriorVariance,
    context,
    baseCandidateCovariance
  );

  while (selectedIndices.length < count) {
    let best = null;

    for (let candidateIndex = 0; candidateIndex < design.candidates.length; candidateIndex += 1) {
      const candidate = design.candidates[candidateIndex];
      if (selectedSet.has(candidateIndex) || !candidate.feasible) continue;
      if (minimumDistance > 0 && !isSeparated(
        candidate,
        selectedIndices,
        design.candidates,
        minimumDistance,
        context.observations ?? []
      )) continue;

      const reduction = marginalVarianceReduction(design, candidateIndex);
      const trialPosterior = posteriorAfterReduction(design.posteriorVariance, reduction);
      const trialIndices = [...selectedIndices, candidateIndex];
      const trialMetrics = metricsFor(
        design,
        trialIndices,
        trialPosterior,
        context,
        baseCandidateCovariance
      );

      if (!best || trialMetrics.score > best.metrics.score) {
        best = { candidateIndex, reduction, posteriorVariance: trialPosterior, metrics: trialMetrics };
      }
    }

    if (!best) break;

    explanations.push({
      id: design.candidates[best.candidateIndex].id,
      text: summarizeMarginalContributions(currentMetrics, best.metrics)
    });
    assimilateCandidate(design, best.candidateIndex);
    selectedIndices.push(best.candidateIndex);
    selectedSet.add(best.candidateIndex);
    currentMetrics = metricsFor(
      design,
      selectedIndices,
      design.posteriorVariance,
      context,
      baseCandidateCovariance
    );
  }

  return {
    selectedIndices,
    selected: selectedIndices.map((index) => design.candidates[index]),
    metrics: currentMetrics,
    posteriorVariance: Float64Array.from(design.posteriorVariance),
    explanations
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function feasibleIndices(candidates, observations = [], minimumDistance = 0) {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => (
      candidate.feasible
      && (minimumDistance <= 0 || observations.every((site) => (
        candidateDistance(candidate, site) >= minimumDistance
      )))
    ))
    .map(({ index }) => index);
}

function selectFromOrder(order, candidates, count, minimumDistance) {
  const selected = [];
  for (const index of order) {
    if (minimumDistance > 0 && !isSeparated(
      candidates[index], selected, candidates, minimumDistance
    )) continue;
    selected.push(index);
    if (selected.length >= count) break;
  }
  return selected;
}

function randomStrategy(candidates, count, seed, observations, minimumDistance) {
  const random = seededRandom(seed);
  const order = feasibleIndices(candidates, observations, minimumDistance)
    .map((index) => ({ index, key: random() }))
    .sort((left, right) => left.key - right.key)
    .map(({ index }) => index);
  return selectFromOrder(order, candidates, count, minimumDistance);
}

function rankedStrategy(candidates, count, field, observations, minimumDistance) {
  const order = feasibleIndices(candidates, observations, minimumDistance)
    .sort((left, right) => (candidates[right][field] ?? 0) - (candidates[left][field] ?? 0));
  return selectFromOrder(order, candidates, count, minimumDistance);
}

function uniformStrategy(candidates, count, observations, minimumDistance) {
  const feasible = feasibleIndices(candidates, observations, minimumDistance);
  if (count >= feasible.length) return feasible;
  const selected = [feasible.reduce((best, index) => (
    candidates[index].x + candidates[index].y < candidates[best].x + candidates[best].y ? index : best
  ), feasible[0])];

  while (selected.length < count) {
    let bestIndex = null;
    let bestDistance = -Infinity;
    for (const index of feasible) {
      if (selected.includes(index)) continue;
      const nearest = Math.min(...selected.map((selectedIndex) => (
        candidateDistance(candidates[index], candidates[selectedIndex])
      )));
      if (nearest >= minimumDistance && nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    if (bestIndex === null) break;
    selected.push(bestIndex);
  }

  return selected;
}

function evaluateBaseline(baseDesign, selectedIndices, context, baseCandidateCovariance) {
  const evaluated = evaluateSelectedOrder(baseDesign, selectedIndices);
  return calculateBayesianMetrics({
    points: evaluated.evaluationPoints,
    candidates: evaluated.candidates,
    selectedIndices,
    baselineVariance: evaluated.baselineVariance,
    posteriorVariance: evaluated.posteriorVariance,
    baseCandidateCovariance,
    weights: context.weights,
    fairnessConstraint: context.fairnessConstraint,
    fairnessLimit: context.fairnessLimit
  });
}

export function optimizeNetwork(context, count, options = {}) {
  validateScenario({
    cells: context.cells,
    candidates: context.candidates,
    observations: context.observations ?? []
  });

  const baseDesign = prepareBayesianDesign({
    evaluationPoints: context.cells,
    candidates: context.candidates,
    observations: context.observations ?? [],
    domain: context.domain,
    modelSettings: context.modelSettings ?? {}
  });
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const optimized = greedyBayesianSelect(baseDesign, count, context, options);

  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const observations = context.observations ?? [];
  const networks = {
    LUMOS: optimized.selectedIndices,
    Random: randomStrategy(context.candidates, count, (context.seed ?? 1) + 91, observations, minimumDistance),
    Uniform: uniformStrategy(context.candidates, count, observations, minimumDistance),
    Hotspot: rankedStrategy(context.candidates, count, "localRisk", observations, minimumDistance),
    Uncertainty: rankedStrategy(context.candidates, count, "localUncertainty", observations, minimumDistance)
  };

  const baselines = Object.entries(networks)
    .map(([name, selectedIndices]) => ({
      name,
      selected: selectedIndices.map((index) => context.candidates[index]),
      selectedIndices,
      metrics: name === "LUMOS"
        ? optimized.metrics
        : evaluateBaseline(baseDesign, selectedIndices, context, baseCandidateCovariance)
    }))
    .sort((left, right) => right.metrics.score - left.metrics.score);

  return {
    selected: optimized.selected,
    selectedIndices: optimized.selectedIndices,
    metrics: optimized.metrics,
    posteriorVariance: optimized.posteriorVariance,
    baselineVariance: Float64Array.from(baseDesign.baselineVariance),
    explanations: optimized.explanations,
    baselines,
    model: {
      family: "Sequential Gaussian-process experimental design",
      covariance: "Domain-aware Matérn 3/2",
      acquisition: "Socially weighted integrated posterior variance reduction",
      observationsConditioned: (context.observations ?? []).length
    }
  };
}
