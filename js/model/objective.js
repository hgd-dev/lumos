import { prepareBayesianDesign, evaluateSelectedOrder } from "./bayesian/design.js";
import { calculateBayesianMetrics } from "./bayesian/metrics.js";

export function evaluateNetwork({
  cells,
  candidates = [],
  observations = [],
  selected = [],
  domain,
  weights,
  fairnessConstraint = true,
  fairnessLimit = 0.16,
  modelSettings = {}
}) {
  const allCandidates = candidates.length ? candidates : selected;
  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  const selectedIndices = allCandidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => selectedIds.has(candidate.id))
    .map(({ index }) => index);
  const design = prepareBayesianDesign({
    evaluationPoints: cells,
    candidates: allCandidates,
    observations,
    domain,
    modelSettings
  });
  const baseCandidateCovariance = design.candidateCovariance.map((row) => Float64Array.from(row));
  const evaluated = evaluateSelectedOrder(design, selectedIndices);

  return calculateBayesianMetrics({
    points: cells,
    candidates: allCandidates,
    selectedIndices,
    baselineVariance: evaluated.baselineVariance,
    posteriorVariance: evaluated.posteriorVariance,
    baseCandidateCovariance,
    weights,
    fairnessConstraint,
    fairnessLimit
  });
}
