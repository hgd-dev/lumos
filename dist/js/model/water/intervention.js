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
  return cells.reduce((best, cell) => {
    const current = distance(candidate, cell);
    return current < best.distance ? { cell, distance: current } : best;
  }, { cell: cells[0], distance: Infinity }).cell;
}

function select(pool, target, selected, budget, score, minimumDistance, role, totalLimit) {
  const chosen = [];
  const allowed = Math.max(0, Math.min(target, totalLimit - selected.length));
  for (const candidate of [...pool].sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)))) {
    if (chosen.length >= allowed) break;
    if ((candidate.cost ?? 1) > budget.remaining + 1e-9) continue;
    if ([...selected, ...chosen].some((site) => distance(site, candidate) < minimumDistance)) continue;
    chosen.push({ ...candidate, interventionRole: role, role });
    budget.remaining -= candidate.cost ?? 1;
  }
  return chosen;
}

function allocationTargets(count) {
  const total = Math.max(1, Math.floor(count));
  const treatment = Math.min(total, total >= 6 ? Math.max(2, Math.round(total * 0.34)) : 1);
  const remainingAfterTreatment = total - treatment;
  const control = Math.min(remainingAfterTreatment, total >= 6 ? Math.max(2, Math.round(total * 0.28)) : remainingAfterTreatment >= 2 ? 1 : 0);
  const remainingAfterControl = remainingAfterTreatment - control;
  const upstream = Math.min(remainingAfterControl, remainingAfterControl >= 2 ? Math.max(1, Math.round(total * 0.16)) : remainingAfterControl);
  const downstream = Math.max(0, total - treatment - control - upstream);
  return { treatment, control, upstream, downstream };
}

const INDICATOR_EFFECTS = Object.freeze({
  temperature: { fraction: 0.08, minimum: 0.6, maximum: 3.0 },
  dissolved_oxygen: { fraction: 0.09, minimum: 0.35, maximum: 1.5 },
  ph: { fraction: 0.035, minimum: 0.15, maximum: 0.6 },
  specific_conductance: { fraction: 0.12, minimum: 20, maximum: 250 },
  turbidity: { fraction: 0.20, minimum: 0.5, maximum: 15 },
  discharge: { fraction: 0.15, minimum: 10, maximum: 500 }
});

function expectedEffectMagnitude(indicator, treatment, target) {
  const assumption = INDICATOR_EFFECTS[indicator] ?? { fraction: 0.10, minimum: 0.05, maximum: Infinity };
  const targetMultiplier = target === "stormwater" ? 0.86 : target === "agriculture" ? 0.78 : target === "distribution" ? 0.68 : 1;
  const baseline = Math.abs(mean(treatment.map((entry) => entry.baseline)));
  return clamp(Math.max(assumption.minimum, baseline * assumption.fraction * targetMultiplier), assumption.minimum, assumption.maximum);
}

export function designWaterInterventionNetwork(scenario, {
  count = 10,
  budget = 10,
  minimumDistance = 0.04,
  residualStd = 0.18,
  repeatedMeasurements = 6
} = {}) {
  if (!scenario?.cells?.length || !scenario?.candidates?.length) {
    return { available: false, reason: "Water cells and candidate sites are required.", selected: [] };
  }
  const totalLimit = Math.max(1, Math.floor(count));
  const candidates = scenario.candidates.filter((candidate) => candidate.feasible !== false).map((candidate) => {
    const cell = nearestCell(candidate, scenario.cells);
    return {
      ...candidate,
      baseline: cell.waterIndicatorValue ?? cell.risk ?? 0,
      benefit: cell.interventionBenefit ?? 0,
      upstream: cell.upstreamSourcePressure ?? 0,
      downstream: cell.downstreamExposure ?? 0,
      uncertainty: cell.uncertainty ?? 0.5,
      vulnerability: cell.vulnerability ?? 0.5,
      flowPosition: cell.flowPosition ?? 0.5,
      networkBranch: cell.networkBranch ?? candidate.networkBranch ?? 0
    };
  });
  const targets = allocationTargets(totalLimit);
  const budgetState = { remaining: budget };
  const selected = [];
  const treatment = select(candidates, targets.treatment, selected, budgetState,
    (entry) => 0.40 * entry.benefit + 0.25 * entry.upstream + 0.20 * entry.uncertainty + 0.15 * entry.vulnerability,
    minimumDistance, "treatment", totalLimit);
  selected.push(...treatment);

  const treatmentBaseline = mean(treatment.map((entry) => entry.baseline));
  const treatmentPosition = mean(treatment.map((entry) => entry.flowPosition));
  const treatmentBranches = new Set(treatment.map((entry) => entry.networkBranch));
  const branchAffinity = (entry) => treatmentBranches.has(entry.networkBranch) ? 1 : 0.25;
  const control = select(candidates.filter((entry) => entry.benefit < 0.60), targets.control, selected, budgetState,
    (entry) => 0.42 * Math.exp(-Math.abs(entry.baseline - treatmentBaseline) / Math.max(0.1, residualStd * 4)) + 0.18 * (1 - entry.upstream) + 0.16 * entry.uncertainty + 0.14 * (entry.reliability ?? 0.8) + 0.10 * (1 - branchAffinity(entry)),
    minimumDistance, "control", totalLimit);
  selected.push(...control);

  const upstreamPool = candidates.filter((entry) => branchAffinity(entry) > 0.5 && entry.flowPosition <= treatmentPosition + 0.04);
  const upstream = select(upstreamPool.length ? upstreamPool : candidates, targets.upstream, selected, budgetState,
    (entry) => 0.40 * entry.upstream + 0.24 * entry.uncertainty + 0.18 * entry.benefit + 0.12 * branchAffinity(entry) + 0.06 * clamp(treatmentPosition - entry.flowPosition + 0.5),
    minimumDistance, "upstream", totalLimit);
  selected.push(...upstream);

  const downstreamPool = candidates.filter((entry) => branchAffinity(entry) > 0.5 && entry.flowPosition >= treatmentPosition - 0.04);
  const downstream = select(downstreamPool.length ? downstreamPool : candidates, targets.downstream, selected, budgetState,
    (entry) => 0.38 * entry.downstream + 0.22 * entry.vulnerability + 0.17 * entry.uncertainty + 0.10 * entry.benefit + 0.08 * branchAffinity(entry) + 0.05 * clamp(entry.flowPosition - treatmentPosition + 0.5),
    minimumDistance, "downstream", totalLimit);
  selected.push(...downstream);

  if (selected.length < totalLimit) {
    selected.push(...select(candidates, totalLimit - selected.length, selected, budgetState,
      (entry) => 0.30 * entry.benefit + 0.28 * entry.uncertainty + 0.22 * entry.downstream + 0.20 * (entry.reliability ?? 0.8),
      minimumDistance, "supplemental", totalLimit));
  }

  const target = scenario.model?.interventionTarget ?? "wastewater";
  const indicator = scenario.model?.indicator ?? "temperature";
  const effect = expectedEffectMagnitude(indicator, treatment, target);
  const standardError = residualStd * Math.sqrt(
    1 / Math.max(1, treatment.length * repeatedMeasurements)
    + 1 / Math.max(1, control.length * repeatedMeasurements)
  );
  const signal = standardError > 0 ? effect / standardError : 0;
  const approximatePower = clamp(1 - Math.exp(-0.32 * signal * signal));
  const roleCounts = selected.reduce((counts, entry) => {
    counts[entry.interventionRole] = (counts[entry.interventionRole] ?? 0) + 1;
    return counts;
  }, {});
  return {
    available: treatment.length > 0 && control.length > 0,
    selected,
    roleCounts,
    totalCost: budget - budgetState.remaining,
    expectedEffect: effect,
    effectUnits: scenario.model?.indicatorUnit ?? "indicator units",
    approximatePower,
    controlMatch: control.length ? clamp(1 - Math.abs(mean(control.map((entry) => entry.baseline)) - treatmentBaseline) / Math.max(0.1, Math.abs(treatmentBaseline))) : 0,
    repeatedMeasurements,
    residualStd,
    designType: "Water before-after/control design with branch-linked upstream and downstream sentinels",
    assumptions: {
      indicator,
      target,
      effectModel: "Indicator-specific planning magnitude bounded by conservative minimum and maximum assumptions",
      flowLinkage: "Sentinels are linked through the current geometric branch and flow-position proxy"
    },
    limitations: [
      "Power is a planning diagnostic based on assumed residual variability and repeated sampling.",
      "Flow direction and branch structure remain screening proxies unless authoritative hydrologic or utility topology is supplied.",
      "Indicator-specific effect magnitudes are transparent planning assumptions, not estimated intervention effects.",
      "The design does not establish causal effects or regulatory compliance by itself."
    ]
  };
}
