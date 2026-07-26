import { candidateDistance } from "../kernels.js";
import { evaluateSelectedOrder } from "../bayesian/design.js";
import { calculateBayesianMetrics } from "../bayesian/metrics.js";
import { evaluateConstraintStatus } from "../optimization/constraints.js";
import {
  selectAOptimal,
  selectDOptimal,
  selectPivotedCholesky,
  selectSocialGreedy,
  selectTargetMutualInformation
} from "./selectors.js";

function isSeparated(candidate, selectedIndices, candidates, minimumDistance, observations = []) {
  return selectedIndices.every((index) => (
    candidateDistance(candidate, candidates[index]) >= minimumDistance
  )) && observations.every((site) => candidateDistance(candidate, site) >= minimumDistance);
}

function compareEvaluations(left, right) {
  if (left.constraintStatus.feasible !== right.constraintStatus.feasible) {
    return left.constraintStatus.feasible ? -1 : 1;
  }
  if (!left.constraintStatus.feasible
    && left.constraintStatus.totalViolation !== right.constraintStatus.totalViolation) {
    return left.constraintStatus.totalViolation - right.constraintStatus.totalViolation;
  }
  return right.metrics.score - left.metrics.score;
}

function evaluateIndices(baseDesign, selectedIndices, context, weights, baseCandidateCovariance) {
  const evaluated = evaluateSelectedOrder(baseDesign, selectedIndices);
  const metrics = calculateBayesianMetrics({
    points: evaluated.evaluationPoints,
    candidates: evaluated.candidates,
    selectedIndices,
    baselineVariance: evaluated.baselineVariance,
    posteriorVariance: evaluated.posteriorVariance,
    baseCandidateCovariance,
    weights,
    fairnessConstraint: context.constraints.enforceSocialConstraints,
    fairnessLimit: context.constraints.fairnessLimit
  });
  return {
    selectedIndices,
    metrics,
    constraintStatus: evaluateConstraintStatus(metrics, context.constraints)
  };
}

function candidatePriority(candidate) {
  return 1.15 * (candidate.localUncertainty ?? candidate.uncertainty ?? 0)
    + 0.95 * (candidate.localRisk ?? candidate.risk ?? 0)
    + 0.85 * (candidate.exposure ?? 0)
    + 0.75 * (candidate.vulnerability ?? 0)
    + 0.45 * (candidate.communityPriority ?? 0)
    + 0.25 * (candidate.ecology ?? 0)
    + 0.35 * (candidate.reliability ?? 0)
    - 0.18 * (candidate.cost ?? 1);
}

function reducedPool(baseDesign, context, poolSize, minimumDistance) {
  const eligible = baseDesign.candidates
    .map((candidate, index) => ({ candidate, index, priority: candidatePriority(candidate) }))
    .filter(({ candidate }) => candidate.feasible
      && context.observations.every((site) => candidateDistance(candidate, site) >= minimumDistance));

  const priority = [...eligible]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, Math.ceil(poolSize * 0.55));
  const selected = [...priority];
  const selectedSet = new Set(selected.map(({ index }) => index));

  while (selected.length < Math.min(poolSize, eligible.length)) {
    let best = null;
    for (const entry of eligible) {
      if (selectedSet.has(entry.index)) continue;
      const nearest = selected.length
        ? Math.min(...selected.map(({ candidate }) => candidateDistance(entry.candidate, candidate)))
        : 1;
      const score = nearest * (1 + 0.25 * Math.max(0, entry.priority));
      if (!best || score > best.score) best = { ...entry, score };
    }
    if (!best) break;
    selected.push(best);
    selectedSet.add(best.index);
  }

  return selected.map(({ index }) => index).sort((left, right) => left - right);
}

function enumerateCombinations({
  poolIndices,
  choose,
  baseDesign,
  context,
  weights,
  minimumDistance,
  baseCandidateCovariance
}) {
  const evaluations = [];
  let enumerated = 0;

  function recurse(start, selectedIndices, totalCost) {
    if (selectedIndices.length === choose) {
      enumerated += 1;
      evaluations.push(evaluateIndices(
        baseDesign,
        selectedIndices,
        context,
        weights,
        baseCandidateCovariance
      ));
      return;
    }

    const needed = choose - selectedIndices.length;
    for (let position = start; position <= poolIndices.length - needed; position += 1) {
      const candidateIndex = poolIndices[position];
      const candidate = baseDesign.candidates[candidateIndex];
      if (totalCost + candidate.cost > context.constraints.budget + 1e-9) continue;
      if (!isSeparated(
        candidate,
        selectedIndices,
        baseDesign.candidates,
        minimumDistance,
        context.observations
      )) continue;
      recurse(position + 1, [...selectedIndices, candidateIndex], totalCost + candidate.cost);
    }
  }

  recurse(0, [], 0);
  evaluations.sort(compareEvaluations);
  return { best: evaluations[0] ?? null, enumerated };
}

function restrictContext(baseDesign, context, poolIndices) {
  return {
    ...context,
    candidates: poolIndices.map((index) => baseDesign.candidates[index])
  };
}

function reducedDesign(baseDesign, poolIndices) {
  const mapping = new Map(poolIndices.map((index, reducedIndex) => [reducedIndex, index]));
  return {
    ...baseDesign,
    candidates: poolIndices.map((index) => baseDesign.candidates[index]),
    candidateCovariance: poolIndices.map((rowIndex) => Float64Array.from(
      poolIndices.map((columnIndex) => baseDesign.candidateCovariance[rowIndex][columnIndex])
    )),
    baseCandidateCovariance: poolIndices.map((rowIndex) => Float64Array.from(
      poolIndices.map((columnIndex) => baseDesign.candidateCovariance[rowIndex][columnIndex])
    )),
    evaluationCandidateCovariance: baseDesign.evaluationCandidateCovariance.map((row) => Float64Array.from(
      poolIndices.map((columnIndex) => row[columnIndex])
    )),
    mapToOriginal: (indices) => indices.map((index) => mapping.get(index))
  };
}

export function runExactReducedBenchmark(baseDesign, context, weights, options = {}) {
  const poolSize = Math.max(8, Math.min(options.exactPoolSize ?? 12, baseDesign.candidates.length));
  const choose = Math.max(2, Math.min(options.exactSelectionCount ?? 4, poolSize));
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const poolIndices = reducedPool(baseDesign, context, poolSize, minimumDistance);
  const actualChoose = Math.min(choose, poolIndices.length);
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const oracleStarted = globalThis.performance?.now?.() ?? Date.now();
  const exact = enumerateCombinations({
    poolIndices,
    choose: actualChoose,
    baseDesign,
    context,
    weights,
    minimumDistance,
    baseCandidateCovariance
  });
  const oracleRuntimeMs = (globalThis.performance?.now?.() ?? Date.now()) - oracleStarted;

  if (!exact.best) {
    return {
      poolSize: poolIndices.length,
      selectionCount: actualChoose,
      enumerated: 0,
      oracle: null,
      oracleRuntimeMs,
      methods: []
    };
  }

  const reduced = reducedDesign(baseDesign, poolIndices);
  const reducedContext = restrictContext(baseDesign, context, poolIndices);
  const evaluator = (design, selectedIndices, metricWeights, candidateCovariance) => {
    const metrics = calculateBayesianMetrics({
      points: design.evaluationPoints,
      candidates: design.candidates,
      selectedIndices,
      baselineVariance: design.baselineVariance,
      posteriorVariance: design.posteriorVariance,
      baseCandidateCovariance: candidateCovariance,
      weights: metricWeights,
      fairnessConstraint: reducedContext.constraints.enforceSocialConstraints,
      fairnessLimit: reducedContext.constraints.fairnessLimit
    });
    return metrics;
  };

  const selectors = [
    ["LUMOS social greedy", () => selectSocialGreedy(
      reduced,
      actualChoose,
      reducedContext,
      weights,
      evaluator,
      options
    )],
    ["A-optimal greedy", () => selectAOptimal(reduced, actualChoose, reducedContext, options)],
    ["D-optimal greedy", () => selectDOptimal(reduced, actualChoose, reducedContext, options)],
    ["Target MI greedy", () => selectTargetMutualInformation(
      reduced,
      actualChoose,
      reducedContext,
      { ...options, miTargetCount: Math.min(options.miTargetCount ?? 24, 24) }
    )],
    ["Pivoted Cholesky", () => selectPivotedCholesky(reduced, actualChoose, reducedContext, options)]
  ];

  const methods = selectors.map(([name, selector]) => {
    const started = globalThis.performance?.now?.() ?? Date.now();
    const selected = selector().selectedIndices;
    const runtimeMs = (globalThis.performance?.now?.() ?? Date.now()) - started;
    const originalIndices = reduced.mapToOriginal(selected);
    const evaluation = evaluateIndices(
      baseDesign,
      originalIndices,
      context,
      weights,
      baseCandidateCovariance
    );
    return {
      name,
      ...evaluation,
      runtimeMs,
      optimalityGap: Math.max(0, exact.best.metrics.score - evaluation.metrics.score)
    };
  }).sort(compareEvaluations);

  return {
    poolSize: poolIndices.length,
    selectionCount: actualChoose,
    enumerated: exact.enumerated,
    oracleRuntimeMs,
    oracle: {
      name: "Exact reduced-pool oracle",
      ...exact.best,
      runtimeMs: oracleRuntimeMs,
      optimalityGap: 0
    },
    methods
  };
}
