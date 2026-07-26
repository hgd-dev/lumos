const EPSILON = 1e-12;

export const DEFAULT_CONSTRAINTS = {
  enforceSocialConstraints: true,
  fairnessLimit: 0.16,
  minimumGroupInformation: 0.12,
  minimumReliability: 0.70,
  budget: Infinity
};

export function normalizeConstraints(constraints = {}) {
  return {
    ...DEFAULT_CONSTRAINTS,
    ...constraints,
    budget: Number.isFinite(constraints.budget) ? Math.max(0, constraints.budget) : Infinity
  };
}

function normalizedExcess(value, limit) {
  return Math.max(0, value - limit) / Math.max(EPSILON, limit);
}

function normalizedShortfall(value, minimum) {
  return Math.max(0, minimum - value) / Math.max(EPSILON, minimum);
}

export function evaluateConstraintStatus(metrics, constraints = {}) {
  const normalized = normalizeConstraints(constraints);
  const checks = [
    {
      key: "budget",
      label: "Budget cap",
      satisfied: metrics.totalCost <= normalized.budget + 1e-9,
      actual: metrics.totalCost,
      target: normalized.budget,
      violation: Number.isFinite(normalized.budget)
        ? normalizedExcess(metrics.totalCost, normalized.budget)
        : 0
    },
    {
      key: "fairness",
      label: "Maximum group uncertainty gap",
      satisfied: !normalized.enforceSocialConstraints
        || metrics.fairnessGap <= normalized.fairnessLimit + 1e-9,
      actual: metrics.fairnessGap,
      target: normalized.fairnessLimit,
      violation: normalized.enforceSocialConstraints
        ? normalizedExcess(metrics.fairnessGap, normalized.fairnessLimit)
        : 0
    },
    {
      key: "groupInformation",
      label: "Worst-group information gain",
      satisfied: !normalized.enforceSocialConstraints
        || metrics.minimumGroupInformation >= normalized.minimumGroupInformation - 1e-9,
      actual: metrics.minimumGroupInformation,
      target: normalized.minimumGroupInformation,
      violation: normalized.enforceSocialConstraints
        ? normalizedShortfall(metrics.minimumGroupInformation, normalized.minimumGroupInformation)
        : 0
    },
    {
      key: "reliability",
      label: "Mean network reliability",
      satisfied: metrics.reliability >= normalized.minimumReliability - 1e-9,
      actual: metrics.reliability,
      target: normalized.minimumReliability,
      violation: normalizedShortfall(metrics.reliability, normalized.minimumReliability)
    }
  ];

  const totalViolation = checks.reduce((sum, check) => sum + check.violation ** 2, 0);
  return {
    feasible: checks.every((check) => check.satisfied),
    totalViolation,
    checks,
    constraints: normalized
  };
}

export function progressiveConstraintPenalty(metrics, constraints, progress) {
  const normalized = normalizeConstraints(constraints);
  if (progress <= 0) return 0;

  const relaxedFairnessLimit = normalized.fairnessLimit + (1 - progress) * 0.34;
  const progressiveGroupMinimum = normalized.minimumGroupInformation * progress;
  const reliabilityFloor = normalized.minimumReliability * (0.72 + 0.28 * progress);

  const fairnessViolation = normalized.enforceSocialConstraints
    ? normalizedExcess(metrics.fairnessGap, relaxedFairnessLimit)
    : 0;
  const groupViolation = normalized.enforceSocialConstraints
    ? normalizedShortfall(metrics.minimumGroupInformation, progressiveGroupMinimum)
    : 0;
  const reliabilityViolation = normalizedShortfall(metrics.reliability, reliabilityFloor);

  return 5.5 * fairnessViolation ** 2
    + 7.5 * groupViolation ** 2
    + 2.5 * reliabilityViolation ** 2;
}
