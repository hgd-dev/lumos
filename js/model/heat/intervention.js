function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, fraction) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  const position = clamp(fraction) * (finite.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return finite[lower];
  return finite[lower] + (finite[upper] - finite[lower]) * (position - lower);
}

function distance(left, right) {
  return Math.hypot((left.x ?? 0) - (right.x ?? 0), (left.y ?? 0) - (right.y ?? 0));
}

function nearestCell(candidate, cells) {
  let best = cells[0];
  let bestDistance = Infinity;
  for (const cell of cells) {
    const current = distance(candidate, cell);
    if (current < bestDistance) {
      best = cell;
      bestDistance = current;
    }
  }
  return best;
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

function roleAllocation(count) {
  if (count < 4) return { treatment: Math.max(1, count - 1), control: 1, boundary: 0, spillover: 0 };
  let treatment = Math.max(2, Math.round(count * 0.4));
  let control = Math.max(2, Math.round(count * 0.3));
  let boundary = Math.max(1, Math.round(count * 0.18));
  let spillover = Math.max(0, count - treatment - control - boundary);
  while (treatment + control + boundary + spillover > count) {
    if (treatment > 2) treatment -= 1;
    else if (control > 2) control -= 1;
    else boundary -= 1;
  }
  while (treatment + control + boundary + spillover < count) spillover += 1;
  return { treatment, control, boundary, spillover };
}

function candidateFeatures(scenario) {
  const enriched = scenario.candidates.filter((candidate) => candidate.feasible !== false).map((candidate) => {
    const cell = nearestCell(candidate, scenario.cells);
    const rawEffect = Math.max(0, (cell.controlTemperatureF ?? 0) - (cell.plannedTemperatureF ?? cell.controlTemperatureF ?? 0));
    return {
      ...candidate,
      interventionBenefit: cell.interventionBenefit ?? 0,
      expectedEffectF: rawEffect,
      baselineTemperatureF: cell.baselineTemperatureF ?? 0,
      exposure: cell.exposure ?? 0.5,
      vulnerability: cell.vulnerability ?? 0.5,
      uncertainty: cell.predictiveUncertainty ?? cell.uncertainty ?? 0.5,
      communityGroup: cell.communityGroup ?? 0
    };
  });

  const benefitLow = percentile(enriched.map((entry) => entry.interventionBenefit), 0.35);
  const benefitHigh = percentile(enriched.map((entry) => entry.interventionBenefit), 0.67);
  const hotSites = enriched.filter((entry) => entry.interventionBenefit >= benefitHigh);
  return enriched.map((entry) => {
    const distanceToTreatment = hotSites.length ? Math.min(...hotSites.map((site) => distance(entry, site))) : 1;
    const transition = 1 - Math.min(1, Math.abs(entry.interventionBenefit - (benefitLow + benefitHigh) / 2) / Math.max(0.05, benefitHigh - benefitLow));
    return { ...entry, benefitLow, benefitHigh, distanceToTreatment, transition };
  });
}

function farEnough(candidate, selected, minimumDistance) {
  return selected.every((entry) => distance(candidate, entry) >= minimumDistance);
}

function chooseByScore(pool, count, selected, budgetState, score, minimumDistance) {
  const output = [];
  const ordered = [...pool].sort((left, right) => score(right) - score(left) || String(left.id).localeCompare(String(right.id)));
  for (const candidate of ordered) {
    if (output.length >= count) break;
    if ((candidate.cost ?? 1) > budgetState.remaining + 1e-9) continue;
    if (!farEnough(candidate, [...selected, ...output], minimumDistance)) continue;
    output.push(candidate);
    budgetState.remaining -= candidate.cost ?? 1;
  }
  return output;
}

function treatmentCentroid(treatment) {
  return {
    baselineTemperatureF: mean(treatment.map((entry) => entry.baselineTemperatureF)),
    exposure: mean(treatment.map((entry) => entry.exposure)),
    vulnerability: mean(treatment.map((entry) => entry.vulnerability))
  };
}

function matchingScore(candidate, target) {
  const temperature = Math.exp(-Math.abs(candidate.baselineTemperatureF - target.baselineTemperatureF) / 2.5);
  const exposure = Math.exp(-Math.abs(candidate.exposure - target.exposure) / 0.25);
  const vulnerability = Math.exp(-Math.abs(candidate.vulnerability - target.vulnerability) / 0.25);
  return temperature * exposure * vulnerability;
}

export function designHeatInterventionNetwork(scenario, {
  count = 10,
  budget = 10,
  minimumDistance = 0.045,
  residualStdF = 1.8,
  repeatedMeasurements = 6
} = {}) {
  if (!scenario?.cells?.length || !scenario?.candidates?.length) {
    return { available: false, reason: "Heat cells and candidate sites are required.", selected: [] };
  }

  const features = candidateFeatures(scenario);
  const allocation = roleAllocation(count);
  const budgetState = { remaining: budget };
  const selected = [];

  const treatmentPool = features.filter((entry) => entry.interventionBenefit >= entry.benefitHigh);
  const treatment = chooseByScore(
    treatmentPool,
    allocation.treatment,
    selected,
    budgetState,
    (entry) => 0.38 * entry.interventionBenefit + 0.24 * entry.exposure + 0.22 * entry.vulnerability + 0.16 * entry.uncertainty,
    minimumDistance
  ).map((entry) => ({ ...entry, interventionRole: "treatment" }));
  selected.push(...treatment);

  const target = treatmentCentroid(treatment.length ? treatment : treatmentPool.slice(0, 2));
  const controlPool = features.filter((entry) => entry.interventionBenefit <= entry.benefitLow);
  const controls = chooseByScore(
    controlPool,
    allocation.control,
    selected,
    budgetState,
    (entry) => 0.68 * matchingScore(entry, target) + 0.18 * entry.reliability + 0.14 * entry.uncertainty,
    minimumDistance
  ).map((entry) => ({ ...entry, interventionRole: "control", expectedEffectF: 0 }));
  selected.push(...controls);

  const boundaryPool = features.filter((entry) => entry.interventionBenefit > entry.benefitLow && entry.interventionBenefit < entry.benefitHigh);
  const boundaries = chooseByScore(
    boundaryPool,
    allocation.boundary,
    selected,
    budgetState,
    (entry) => 0.48 * entry.transition + 0.22 * entry.exposure + 0.16 * entry.vulnerability + 0.14 * entry.uncertainty,
    minimumDistance
  ).map((entry) => ({ ...entry, interventionRole: "boundary" }));
  selected.push(...boundaries);

  const spilloverPool = features.filter((entry) => entry.interventionBenefit <= entry.benefitLow && entry.distanceToTreatment < 0.24);
  const spillovers = chooseByScore(
    spilloverPool,
    allocation.spillover,
    selected,
    budgetState,
    (entry) => 0.5 * (1 - Math.min(1, entry.distanceToTreatment / 0.24)) + 0.2 * entry.exposure + 0.15 * entry.vulnerability + 0.15 * entry.uncertainty,
    minimumDistance
  ).map((entry) => ({ ...entry, interventionRole: "spillover", expectedEffectF: 0 }));
  selected.push(...spillovers);

  if (selected.length < count) {
    const fill = chooseByScore(
      features,
      count - selected.length,
      selected,
      budgetState,
      (entry) => 0.3 * entry.interventionBenefit + 0.25 * entry.uncertainty + 0.2 * entry.exposure + 0.15 * entry.vulnerability + 0.1 * entry.reliability,
      minimumDistance
    ).map((entry) => ({ ...entry, interventionRole: "supplemental" }));
    selected.push(...fill);
  }

  const treatmentSelected = selected.filter((entry) => entry.interventionRole === "treatment");
  const controlSelected = selected.filter((entry) => entry.interventionRole === "control");
  const effect = mean(treatmentSelected.map((entry) => entry.expectedEffectF));
  const effectiveTreatment = Math.max(1, treatmentSelected.length * repeatedMeasurements);
  const effectiveControl = Math.max(1, controlSelected.length * repeatedMeasurements);
  const standardError = residualStdF * Math.sqrt(1 / effectiveTreatment + 1 / effectiveControl);
  const z = standardError > 0 ? effect / standardError : 0;
  const power = clamp(normalCdf(z - 1.96) + normalCdf(-z - 1.96));
  const controlMatch = controls.length ? mean(controls.map((entry) => matchingScore(entry, target))) : 0;
  const roleCounts = selected.reduce((counts, entry) => {
    counts[entry.interventionRole] = (counts[entry.interventionRole] ?? 0) + 1;
    return counts;
  }, {});

  return {
    available: treatmentSelected.length > 0 && controlSelected.length > 0,
    selected,
    allocation,
    roleCounts,
    totalCost: budget - budgetState.remaining,
    expectedEffectF: effect,
    standardErrorF: standardError,
    approximatePower: power,
    controlMatch,
    repeatedMeasurements,
    residualStdF,
    posteriorVariance: null,
    designType: "BACI-inspired treatment/control/boundary/spillover heuristic",
    limitations: [
      "Power is an approximate planning diagnostic based on assumed residual variation and repeated measurements.",
      "The design supports BACI-style evaluation but does not itself establish causal effects.",
      "Control sites are matched using available heat, exposure, and vulnerability attributes rather than randomized assignment."
    ]
  };
}
