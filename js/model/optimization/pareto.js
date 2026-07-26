const EPSILON = 1e-9;

function atLeast(left, right) {
  return left + EPSILON >= right;
}

function atMost(left, right) {
  return left <= right + EPSILON;
}

export function dominates(left, right) {
  const noWorse = atLeast(left.metrics.information, right.metrics.information)
    && atLeast(left.metrics.exposure, right.metrics.exposure)
    && atLeast(left.metrics.minimumGroupInformation, right.metrics.minimumGroupInformation)
    && atMost(left.metrics.fairnessGap, right.metrics.fairnessGap)
    && atMost(left.metrics.totalCost, right.metrics.totalCost)
    && atLeast(left.metrics.reliability, right.metrics.reliability);

  const strictlyBetter = left.metrics.information > right.metrics.information + EPSILON
    || left.metrics.exposure > right.metrics.exposure + EPSILON
    || left.metrics.minimumGroupInformation > right.metrics.minimumGroupInformation + EPSILON
    || left.metrics.fairnessGap + EPSILON < right.metrics.fairnessGap
    || left.metrics.totalCost + EPSILON < right.metrics.totalCost
    || left.metrics.reliability > right.metrics.reliability + EPSILON;

  return noWorse && strictlyBetter;
}

export function nondominatedSolutions(solutions) {
  const pool = solutions.some((solution) => solution.constraintStatus.feasible)
    ? solutions.filter((solution) => solution.constraintStatus.feasible)
    : solutions;

  return pool.filter((candidate, index) => (
    !pool.some((other, otherIndex) => otherIndex !== index && dominates(other, candidate))
  ));
}
