function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function distance(left, right) {
  return Math.hypot((left.x ?? 0) - (right.x ?? 0), (left.y ?? 0) - (right.y ?? 0));
}

function nearestCell(candidate, cells) {
  let best = cells[0];
  let bestDistance = Infinity;
  for (const cell of cells) {
    const current = distance(candidate, cell);
    if (current < bestDistance) { best = cell; bestDistance = current; }
  }
  return best;
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const coefficients = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const erf = sign * (1 - (((((coefficients[4] * t + coefficients[3]) * t) + coefficients[2]) * t + coefficients[1]) * t + coefficients[0]) * t * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

function quantile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = clamp(fraction) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function choose(pool, count, selected, budgetState, score, minimumDistance) {
  const output = [];
  const ordered = [...pool].sort((left, right) => score(right) - score(left) || String(left.id).localeCompare(String(right.id)));
  for (const candidate of ordered) {
    if (output.length >= count) break;
    if ((candidate.cost ?? 1) > budgetState.remaining + 1e-9) continue;
    if (![...selected, ...output].every((site) => distance(site, candidate) >= minimumDistance)) continue;
    output.push(candidate);
    budgetState.remaining -= candidate.cost ?? 1;
  }
  return output;
}

function allocation(count) {
  return {
    treatment: Math.max(2, Math.round(count * 0.4)),
    control: Math.max(2, Math.round(count * 0.3)),
    boundary: Math.max(1, Math.round(count * 0.18)),
    spillover: Math.max(0, count - Math.max(2, Math.round(count * 0.4)) - Math.max(2, Math.round(count * 0.3)) - Math.max(1, Math.round(count * 0.18)))
  };
}

export function designAirInterventionNetwork(scenario, {
  count = 10,
  budget = 10,
  minimumDistance = 0.04,
  residualStd = 5,
  repeatedMeasurements = 8
} = {}) {
  if (!scenario?.cells?.length || !scenario?.candidates?.length) {
    return { available: false, reason: "Air cells and candidate sites are required.", selected: [] };
  }
  const features = scenario.candidates.filter((candidate) => candidate.feasible !== false).map((candidate) => {
    const cell = nearestCell(candidate, scenario.cells);
    return {
      ...candidate,
      interventionBenefit: cell.interventionBenefit ?? 0,
      baselinePollutant: cell.posteriorPollutant ?? cell.pollutantValue ?? 0,
      exposure: cell.exposure ?? 0.5,
      vulnerability: cell.vulnerability ?? 0.5,
      uncertainty: cell.uncertainty ?? 0.5,
      sourceRisk: cell.sourceRisk ?? 0.5,
      downwindSourceRisk: cell.downwindSourceRisk ?? cell.sourceRisk ?? 0.5
    };
  });
  const low = quantile(features.map((entry) => entry.interventionBenefit), 0.35);
  const high = quantile(features.map((entry) => entry.interventionBenefit), 0.68);
  const treatmentSites = features.filter((entry) => entry.interventionBenefit >= high);
  const alloc = allocation(count);
  const budgetState = { remaining: budget };
  const selected = [];

  const treatment = choose(treatmentSites, alloc.treatment, selected, budgetState,
    (entry) => 0.38 * entry.interventionBenefit + 0.22 * entry.exposure + 0.20 * entry.vulnerability + 0.20 * entry.uncertainty,
    minimumDistance).map((entry) => ({ ...entry, interventionRole: "treatment" }));
  selected.push(...treatment);
  const targetPollutant = mean(treatment.map((entry) => entry.baselinePollutant));
  const targetExposure = mean(treatment.map((entry) => entry.exposure));
  const targetVulnerability = mean(treatment.map((entry) => entry.vulnerability));
  const control = choose(features.filter((entry) => entry.interventionBenefit <= low), alloc.control, selected, budgetState,
    (entry) => 0.45 * Math.exp(-Math.abs(entry.baselinePollutant - targetPollutant) / Math.max(1, residualStd))
      + 0.22 * Math.exp(-Math.abs(entry.exposure - targetExposure) / 0.25)
      + 0.18 * Math.exp(-Math.abs(entry.vulnerability - targetVulnerability) / 0.25)
      + 0.15 * entry.reliability,
    minimumDistance).map((entry) => ({ ...entry, interventionRole: "control" }));
  selected.push(...control);
  const boundary = choose(features.filter((entry) => entry.interventionBenefit > low && entry.interventionBenefit < high), alloc.boundary, selected, budgetState,
    (entry) => 0.34 * entry.uncertainty + 0.28 * entry.exposure + 0.22 * entry.vulnerability + 0.16 * entry.sourceRisk,
    minimumDistance).map((entry) => ({ ...entry, interventionRole: "boundary" }));
  selected.push(...boundary);
  const spillover = choose(features.filter((entry) => entry.interventionBenefit <= high), alloc.spillover, selected, budgetState,
    (entry) => 0.30 * entry.sourceRisk + 0.28 * entry.downwindSourceRisk + 0.20 * entry.uncertainty + 0.12 * entry.exposure + 0.10 * entry.vulnerability,
    minimumDistance).map((entry) => ({ ...entry, interventionRole: "spillover" }));
  selected.push(...spillover);
  if (selected.length < count) {
    selected.push(...choose(features, count - selected.length, selected, budgetState,
      (entry) => 0.28 * entry.interventionBenefit + 0.26 * entry.uncertainty + 0.20 * entry.exposure + 0.16 * entry.vulnerability + 0.10 * entry.reliability,
      minimumDistance).map((entry) => ({ ...entry, interventionRole: "supplemental" })));
  }

  const treatmentSelected = selected.filter((entry) => entry.interventionRole === "treatment");
  const controlSelected = selected.filter((entry) => entry.interventionRole === "control");
  const target = scenario.model?.interventionTarget ?? "traffic";
  const reductionFraction = target === "industrial" ? 0.16 : target === "clean-freight" ? 0.14 : target === "background-separation" ? 0.08 : 0.12;
  const effect = Math.max(0.25, mean(treatmentSelected.map((entry) => entry.baselinePollutant)) * reductionFraction);
  const standardError = residualStd * Math.sqrt(
    1 / Math.max(1, treatmentSelected.length * repeatedMeasurements)
    + 1 / Math.max(1, controlSelected.length * repeatedMeasurements)
  );
  const z = standardError > 0 ? effect / standardError : 0;
  const power = clamp(normalCdf(z - 1.96) + normalCdf(-z - 1.96));
  const roleCounts = selected.reduce((counts, entry) => {
    counts[entry.interventionRole] = (counts[entry.interventionRole] ?? 0) + 1;
    return counts;
  }, {});

  return {
    available: treatmentSelected.length > 0 && controlSelected.length > 0,
    selected,
    roleCounts,
    totalCost: budget - budgetState.remaining,
    expectedEffect: effect,
    effectUnits: scenario.model?.pollutantUnit ?? "µg/m³",
    approximatePower: power,
    controlMatch: controlSelected.length ? clamp(1 - standardError / Math.max(1, effect + standardError)) : 0,
    repeatedMeasurements,
    residualStd,
    posteriorVariance: null,
    designType: "Air BACI-inspired source-control evaluation with downwind spillover screening",
    limitations: [
      "Power is a planning diagnostic based on assumed residual variability and repeated observations.",
      "The design supports before-after/control comparisons but does not establish causality by itself.",
      "Source layers are screening proxies unless a validated local emissions inventory is supplied.",
      "Expected effect size is scenario-based and must be replaced by intervention-specific evidence for operational studies."
    ]
  };
}
