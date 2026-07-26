const EPSILON = 1e-12;

function weightedReduction(points, baselineVariance, posteriorVariance, weightFunction) {
  let gained = 0;
  let available = 0;

  for (let index = 0; index < points.length; index += 1) {
    const weight = Math.max(0, weightFunction(points[index]));
    available += weight * baselineVariance[index];
    gained += weight * Math.max(0, baselineVariance[index] - posteriorVariance[index]);
  }

  return available > EPSILON ? gained / available : 0;
}

function fairnessMetrics(points, baselineVariance, posteriorVariance) {
  const groups = new Map();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const group = point.communityGroup;
    if (!groups.has(group)) groups.set(group, { baseline: 0, remaining: 0 });
    const weight = 0.1 + point.exposure * (0.35 + 0.65 * point.vulnerability);
    const entry = groups.get(group);
    entry.baseline += weight * baselineVariance[index];
    entry.remaining += weight * posteriorVariance[index];
  }

  const groupLosses = [...groups.entries()].map(([group, values]) => {
    const loss = values.remaining / Math.max(EPSILON, values.baseline);
    return {
      group,
      loss,
      informationGain: Math.max(0, 1 - loss)
    };
  });
  const losses = groupLosses.map((entry) => entry.loss);
  const gains = groupLosses.map((entry) => entry.informationGain);
  const worstLoss = losses.length ? Math.max(...losses) : 0;
  const bestLoss = losses.length ? Math.min(...losses) : 0;
  const meanLoss = losses.length
    ? losses.reduce((sum, value) => sum + value, 0) / losses.length
    : 0;
  const minimumInformation = gains.length ? Math.min(...gains) : 0;

  return {
    gap: worstLoss - bestLoss,
    worstLoss,
    meanLoss,
    minimumInformation,
    groupLosses
  };
}

function pairwiseRedundancy(selectedIndices, baseCandidateCovariance) {
  if (selectedIndices.length < 2) return 0;
  let sum = 0;
  let pairs = 0;

  for (let left = 0; left < selectedIndices.length; left += 1) {
    for (let right = left + 1; right < selectedIndices.length; right += 1) {
      const leftIndex = selectedIndices[left];
      const rightIndex = selectedIndices[right];
      const covariance = baseCandidateCovariance[leftIndex][rightIndex];
      const denominator = Math.sqrt(
        Math.max(EPSILON, baseCandidateCovariance[leftIndex][leftIndex])
        * Math.max(EPSILON, baseCandidateCovariance[rightIndex][rightIndex])
      );
      const correlation = covariance / denominator;
      sum += correlation * correlation;
      pairs += 1;
    }
  }

  return pairs ? sum / pairs : 0;
}

export function calculateBayesianMetrics({
  points,
  candidates,
  selectedIndices,
  baselineVariance,
  posteriorVariance,
  baseCandidateCovariance,
  weights,
  fairnessConstraint = true,
  fairnessLimit = 0.16
}) {
  const information = weightedReduction(points, baselineVariance, posteriorVariance, () => 1);
  const risk = weightedReduction(points, baselineVariance, posteriorVariance, (point) => 0.05 + point.risk);
  const exposure = weightedReduction(points, baselineVariance, posteriorVariance, (point) => 0.02 + point.risk * point.exposure);
  const equity = weightedReduction(
    points,
    baselineVariance,
    posteriorVariance,
    (point) => 0.02 + point.risk * point.exposure * (0.2 + point.vulnerability)
  );
  const community = weightedReduction(points, baselineVariance, posteriorVariance, (point) => 0.05 + point.communityPriority);
  const ecology = weightedReduction(points, baselineVariance, posteriorVariance, (point) => 0.05 + point.ecology);
  const fairness = fairnessMetrics(points, baselineVariance, posteriorVariance);
  const redundancy = pairwiseRedundancy(selectedIndices, baseCandidateCovariance);
  const selected = selectedIndices.map((index) => candidates[index]);
  const reliability = selected.length
    ? selected.reduce((sum, site) => sum + site.reliability * site.feasibility, 0) / selected.length
    : 0;
  const totalCost = selected.reduce((sum, site) => sum + site.cost, 0);
  const normalizedCost = selected.length ? totalCost / (selected.length * 1.25) : 0;
  const fairnessExcess = Math.max(0, fairness.gap - fairnessLimit);
  const fairnessPenalty = fairnessConstraint
    ? fairness.gap + 7.5 * fairnessExcess * fairnessExcess
    : fairness.gap * 0.12;

  const score = selected.length === 0
    ? 0
    : weights.information * information
      + weights.risk * risk
      + weights.exposure * exposure
      + weights.equity * equity
      + weights.community * community
      + weights.ecology * ecology
      + weights.reliability * reliability
      - weights.redundancy * redundancy
      - weights.fairness * fairnessPenalty
      - weights.cost * normalizedCost;

  return {
    score,
    information,
    risk,
    exposure,
    equity,
    community,
    ecology,
    reliability,
    redundancy,
    fairnessGap: fairness.gap,
    fairnessWorstLoss: fairness.worstLoss,
    fairnessMeanLoss: fairness.meanLoss,
    minimumGroupInformation: fairness.minimumInformation,
    groupLosses: fairness.groupLosses,
    fairnessSatisfied: !fairnessConstraint || fairness.gap <= fairnessLimit + 1e-9,
    fairnessLimit,
    cost: normalizedCost,
    totalCost,
    posteriorVariance
  };
}

export function summarizeMarginalContributions(before, after) {
  return [
    ["Bayesian information", after.information - before.information],
    ["risk-weighted information", after.risk - before.risk],
    ["exposure-weighted information", after.exposure - before.exposure],
    ["vulnerability-weighted information", after.equity - before.equity],
    ["community-priority information", after.community - before.community],
    ["ecological information", after.ecology - before.ecology],
    ["worst-group information", after.minimumGroupInformation - before.minimumGroupInformation],
    ["group information parity", before.fairnessGap - after.fairnessGap]
  ]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, value]) => `${label} ${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`)
    .join("; ");
}
