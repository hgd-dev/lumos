function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function distance(left, right) {
  return Math.hypot((left.x ?? 0) - (right.x ?? 0), (left.y ?? 0) - (right.y ?? 0));
}

function nearestCell(candidate, cells) {
  return cells.reduce((best, cell) => {
    const d = distance(candidate, cell);
    return d < best.distance ? { cell, distance: d } : best;
  }, { cell: cells[0], distance: Infinity }).cell;
}

export function designSoilInterventionNetwork(scenario, {
  count = 10,
  budget = 12,
  repeatedMeasurements = 4,
  residualStd = 0.18,
  minimumDistance = 0.035
} = {}) {
  const enriched = (scenario.candidates ?? []).map((candidate) => {
    const cell = nearestCell(candidate, scenario.cells ?? []);
    return { ...candidate, cell, benefit: cell?.interventionBenefit ?? 0, baseline: cell?.risk ?? 0 };
  });
  const treatmentPool = [...enriched].sort((a, b) => b.benefit - a.benefit);
  const controlPool = [...enriched].sort((a, b) => a.benefit - b.benefit || Math.abs(b.baseline - 0.5) - Math.abs(a.baseline - 0.5));
  const selected = [];
  let spent = 0;
  const add = (candidate, role) => {
    if (!candidate || selected.some((entry) => entry.id === candidate.id)) return false;
    if (spent + (candidate.cost ?? 1) > budget) return false;
    if (selected.some((entry) => distance(entry, candidate) < minimumDistance)) return false;
    selected.push({ ...candidate, interventionRole: role, role });
    spent += candidate.cost ?? 1;
    return true;
  };
  const treatmentTarget = Math.max(2, Math.round(count * 0.35));
  const controlTarget = Math.max(2, Math.round(count * 0.30));
  for (const candidate of treatmentPool) {
    if (selected.filter((entry) => entry.role === "treatment").length >= treatmentTarget) break;
    add(candidate, "treatment");
  }
  for (const candidate of controlPool) {
    if (selected.filter((entry) => entry.role === "control").length >= controlTarget) break;
    add(candidate, "control");
  }
  const treatment = selected.filter((entry) => entry.role === "treatment");
  const boundaryPool = enriched
    .filter((candidate) => !selected.some((entry) => entry.id === candidate.id))
    .sort((a, b) => Math.abs(a.benefit - 0.5) - Math.abs(b.benefit - 0.5));
  for (const candidate of boundaryPool) {
    if (selected.length >= count) break;
    add(candidate, selected.length % 2 ? "boundary" : "spillover");
  }
  for (const candidate of treatmentPool) {
    if (selected.length >= count) break;
    add(candidate, "supplemental");
  }
  const nTreatment = Math.max(1, treatment.length);
  const nControl = Math.max(1, selected.filter((entry) => entry.role === "control").length);
  const effect = treatment.length ? treatment.reduce((sum, entry) => sum + entry.benefit, 0) / treatment.length * 0.35 : 0;
  const standardError = residualStd * Math.sqrt(1 / (nTreatment * repeatedMeasurements) + 1 / (nControl * repeatedMeasurements));
  const signal = standardError > 0 ? effect / standardError : 0;
  const approximatePower = clamp(1 - Math.exp(-0.38 * signal * signal));
  const roleCounts = selected.reduce((counts, entry) => ({ ...counts, [entry.role]: (counts[entry.role] ?? 0) + 1 }), {});
  return {
    selected,
    designType: "Soil intervention evaluation",
    repeatedMeasurements,
    residualStd,
    approximatePower,
    expectedEffect: effect,
    effectUnits: "priority-index units",
    controlMatch: clamp(1 - Math.abs(
      (treatment.reduce((sum, entry) => sum + entry.baseline, 0) / nTreatment)
      - (selected.filter((entry) => entry.role === "control").reduce((sum, entry) => sum + entry.baseline, 0) / nControl)
    )),
    totalCost: spent,
    roleCounts
  };
}
