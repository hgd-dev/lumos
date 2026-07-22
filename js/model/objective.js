import { influence } from "./kernels.js";

const EPSILON = 1e-9;

function weightedCoverage(cells, coverage, weightFunction) {
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const weight = Math.max(0, weightFunction(cells[i]));
    numerator += weight * coverage[i];
    denominator += weight;
  }
  return denominator > EPSILON ? numerator / denominator : 0;
}

function computeCoverage(cells, selected, domain, influenceScale) {
  const coverage = new Float64Array(cells.length);
  const additive = new Float64Array(cells.length);

  for (let i = 0; i < cells.length; i += 1) {
    let remaining = 1;
    let sum = 0;
    for (const candidate of selected) {
      const effective = influence(candidate, cells[i], domain, influenceScale)
        * candidate.reliability
        * candidate.feasibility;
      remaining *= 1 - Math.min(0.999, effective);
      sum += effective;
    }
    coverage[i] = 1 - remaining;
    additive[i] = sum;
  }
  return { coverage, additive };
}

function computeFairness(cells, coverage) {
  const groups = new Map();
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const group = cell.communityGroup;
    if (!groups.has(group)) groups.set(group, { weightedRemaining: 0, weight: 0 });
    const entry = groups.get(group);
    const socialWeight = 0.2 + cell.exposure * (0.5 + 0.5 * cell.vulnerability);
    entry.weightedRemaining += cell.uncertainty * (1 - coverage[i]) * socialWeight;
    entry.weight += socialWeight;
  }

  const losses = [...groups.values()].map((entry) => entry.weightedRemaining / Math.max(EPSILON, entry.weight));
  const maxLoss = Math.max(...losses);
  const minLoss = Math.min(...losses);
  const meanLoss = losses.reduce((sum, value) => sum + value, 0) / Math.max(1, losses.length);
  return {
    gap: maxLoss - minLoss,
    worstLoss: maxLoss,
    meanLoss,
    groupLosses: losses
  };
}

function computeRedundancy(additive) {
  let redundancy = 0;
  for (const value of additive) {
    redundancy += Math.max(0, value - 1) ** 2;
  }
  return redundancy / Math.max(1, additive.length);
}

export function evaluateNetwork({ cells, selected, domain, weights, influenceScale = 1, fairnessConstraint = true }) {
  if (selected.length === 0) {
    return {
      score: 0,
      information: 0,
      risk: 0,
      exposure: 0,
      equity: 0,
      community: 0,
      ecology: 0,
      reliability: 0,
      redundancy: 0,
      fairnessGap: 1,
      cost: 0,
      coverage: new Float64Array(cells.length)
    };
  }

  const { coverage, additive } = computeCoverage(cells, selected, domain, influenceScale);
  const information = weightedCoverage(cells, coverage, (cell) => cell.uncertainty);
  const risk = weightedCoverage(cells, coverage, (cell) => cell.risk);
  const exposure = weightedCoverage(cells, coverage, (cell) => cell.risk * cell.exposure);
  const equity = weightedCoverage(cells, coverage, (cell) => cell.risk * cell.exposure * (0.2 + cell.vulnerability));
  const community = weightedCoverage(cells, coverage, (cell) => 0.05 + cell.communityPriority);
  const ecology = weightedCoverage(cells, coverage, (cell) => 0.05 + cell.ecology);
  const redundancy = computeRedundancy(additive);
  const fairness = computeFairness(cells, coverage);
  const reliability = selected.reduce((sum, item) => sum + item.reliability * item.feasibility, 0) / selected.length;
  const cost = selected.reduce((sum, item) => sum + item.cost, 0) / Math.max(EPSILON, selected.length * 1.25);

  const fairnessPenalty = fairnessConstraint ? fairness.gap : fairness.gap * 0.15;
  const score =
    weights.information * information
    + weights.risk * risk
    + weights.exposure * exposure
    + weights.equity * equity
    + weights.community * community
    + weights.ecology * ecology
    + weights.reliability * reliability
    - weights.redundancy * redundancy
    - weights.fairness * fairnessPenalty
    - weights.cost * cost;

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
    cost,
    coverage
  };
}

export function explainCandidate(candidate, cells, selectedBefore, domain, weights, influenceScale, fairnessConstraint) {
  const before = evaluateNetwork({ cells, selected: selectedBefore, domain, weights, influenceScale, fairnessConstraint });
  const after = evaluateNetwork({ cells, selected: [...selectedBefore, candidate], domain, weights, influenceScale, fairnessConstraint });
  const changes = [
    ["information gain", after.information - before.information],
    ["risk detection", after.risk - before.risk],
    ["exposure representation", after.exposure - before.exposure],
    ["equity coverage", after.equity - before.equity],
    ["community priority", after.community - before.community],
    ["ecological representation", after.ecology - before.ecology],
    ["fairness improvement", before.fairnessGap - after.fairnessGap]
  ].sort((a, b) => b[1] - a[1]);

  return changes.slice(0, 2).map(([label, value]) => `${label} +${Math.max(0, value * 100).toFixed(1)} pts`).join("; ");
}
