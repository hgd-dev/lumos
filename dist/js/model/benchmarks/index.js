import { evaluateSelectedOrder } from "../bayesian/design.js";
import { calculateBayesianMetrics } from "../bayesian/metrics.js";
import { evaluateConstraintStatus } from "../optimization/constraints.js";
import {
  criterionDiagnostics,
  selectAOptimal,
  selectDOptimal,
  selectPivotedCholesky,
  selectTargetMutualInformation
} from "./selectors.js";
import { runExactReducedBenchmark } from "./exact.js";

function evaluateBenchmark(baseDesign, selectedIndices, context, weights, baseCandidateCovariance, criterion) {
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
    selected: selectedIndices.map((index) => context.candidates[index]),
    metrics,
    constraintStatus: evaluateConstraintStatus(metrics, context.constraints),
    criterion,
    diagnostics: criterionDiagnostics(baseDesign, selectedIndices, { miTargetCount: 36 })
  };
}

export function buildScientificBenchmarkNetworks(baseDesign, count, context, options = {}) {
  baseDesign.baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const strategies = [
    ["A-optimal", "Integrated variance reduction", selectAOptimal],
    ["D-optimal", "Log-determinant information", selectDOptimal],
    ["Target MI", "Mutual information with representative field targets", selectTargetMutualInformation],
    ["Pivoted Cholesky", "Maximum residual covariance pivot", selectPivotedCholesky]
  ];

  return strategies.map(([name, criterion, selector]) => {
    const started = globalThis.performance?.now?.() ?? Date.now();
    const selection = selector(baseDesign, count, context, options);
    const runtimeMs = (globalThis.performance?.now?.() ?? Date.now()) - started;
    return {
      name,
      criterion,
      selectedIndices: selection.selectedIndices,
      selectionDiagnostics: selection.diagnostics,
      targetCount: selection.targetCount ?? null,
      runtimeMs
    };
  });
}

export function evaluateScientificBenchmarks(
  baseDesign,
  networks,
  context,
  weights
) {
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  return networks.map((network) => ({
    name: network.name,
    runtimeMs: network.runtimeMs,
    ...evaluateBenchmark(
      baseDesign,
      network.selectedIndices,
      context,
      weights,
      baseCandidateCovariance,
      network.criterion
    )
  }));
}

export function buildExactBenchmark(baseDesign, context, weights, options = {}) {
  baseDesign.baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  return runExactReducedBenchmark(baseDesign, context, weights, options);
}
