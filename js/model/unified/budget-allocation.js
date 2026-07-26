import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";

export const CROSS_DOMAIN_DIMENSIONS = Object.freeze([
  "information",
  "exposure",
  "equity",
  "ecology",
  "intervention",
  "reliability"
]);

export const CROSS_DOMAIN_ALLOCATION_PROFILES = Object.freeze({
  balanced: Object.freeze({
    key: "balanced",
    label: "Balanced",
    description: "Balances normalized scientific value, exposure, equity, ecology, intervention readiness, reliability, and cross-domain parity.",
    weights: Object.freeze({ information: 0.22, exposure: 0.18, equity: 0.18, ecology: 0.12, intervention: 0.12, reliability: 0.18 }),
    worstDomainWeight: 0.24,
    balancePenalty: 0.12,
    reserveWeight: 0.01
  }),
  information: Object.freeze({
    key: "information",
    label: "Maximum Information",
    description: "Prioritizes normalized within-domain information gain while retaining minimum viable programs and reliability.",
    weights: Object.freeze({ information: 0.52, exposure: 0.10, equity: 0.08, ecology: 0.06, intervention: 0.08, reliability: 0.16 }),
    worstDomainWeight: 0.08,
    balancePenalty: 0.04,
    reserveWeight: 0
  }),
  exposure: Object.freeze({
    key: "exposure",
    label: "Exposure Protection",
    description: "Emphasizes monitoring value at populated, mobile, and sensitive receptor locations.",
    weights: Object.freeze({ information: 0.16, exposure: 0.42, equity: 0.16, ecology: 0.05, intervention: 0.08, reliability: 0.13 }),
    worstDomainWeight: 0.14,
    balancePenalty: 0.08,
    reserveWeight: 0
  }),
  equity: Object.freeze({
    key: "equity",
    label: "Equity First",
    description: "Maximizes vulnerable-group information quality and protects the least-served environmental domain.",
    weights: Object.freeze({ information: 0.14, exposure: 0.16, equity: 0.40, ecology: 0.06, intervention: 0.08, reliability: 0.16 }),
    worstDomainWeight: 0.30,
    balancePenalty: 0.16,
    reserveWeight: 0
  }),
  resilience: Object.freeze({
    key: "resilience",
    label: "Reliability and Intervention",
    description: "Favors dependable programs that can support longitudinal monitoring and intervention evaluation.",
    weights: Object.freeze({ information: 0.14, exposure: 0.10, equity: 0.10, ecology: 0.08, intervention: 0.28, reliability: 0.30 }),
    worstDomainWeight: 0.18,
    balancePenalty: 0.08,
    reserveWeight: 0.02
  }),
  cost: Object.freeze({
    key: "cost",
    label: "Cost Efficient",
    description: "Seeks the strongest normalized program value per committed dollar after satisfying active minimum-program rules.",
    weights: Object.freeze({ information: 0.22, exposure: 0.16, equity: 0.15, ecology: 0.10, intervention: 0.12, reliability: 0.25 }),
    worstDomainWeight: 0.12,
    balancePenalty: 0.08,
    reserveWeight: 0.34,
    efficiencyWeight: 0.34
  })
});

function planningDefaults(domainKey) {
  const planning = DOMAIN_REGISTRY[domainKey]?.planning;
  if (!planning) throw new Error(`Missing cross-domain planning contract for ${domainKey}.`);
  return {
    enabled: true,
    priority: 1,
    unitCost: planning.unitCost,
    minimumUnits: planning.minimumUnits,
    maximumUnits: planning.maximumUnits
  };
}

export const DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG = Object.freeze({
  totalBudget: 120000,
  reserveFraction: 0.05,
  requireAllDomains: true,
  domains: Object.freeze(Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [
    domainKey,
    Object.freeze(planningDefaults(domainKey))
  ])))
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeCrossDomainBudgetConfig(config = {}) {
  const normalizedDomains = {};
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const defaults = planningDefaults(domainKey);
    const supplied = config.domains?.[domainKey] ?? {};
    const minimumUnits = Math.round(clamp(finiteNumber(supplied.minimumUnits, defaults.minimumUnits), 1, 50));
    const maximumUnits = Math.round(clamp(finiteNumber(supplied.maximumUnits, defaults.maximumUnits), minimumUnits, 60));
    normalizedDomains[domainKey] = {
      enabled: supplied.enabled !== false,
      priority: clamp(finiteNumber(supplied.priority, defaults.priority), 0.25, 3),
      unitCost: Math.round(clamp(finiteNumber(supplied.unitCost, defaults.unitCost), 50, 1_000_000)),
      minimumUnits,
      maximumUnits
    };
  }
  return {
    totalBudget: Math.round(clamp(finiteNumber(config.totalBudget, DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG.totalBudget), 1000, 1_000_000_000)),
    reserveFraction: clamp(finiteNumber(config.reserveFraction, DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG.reserveFraction), 0, 0.5),
    requireAllDomains: config.requireAllDomains !== false,
    domains: normalizedDomains
  };
}

function responseCurve(units, scale) {
  if (units <= 0) return 0;
  return 1 - Math.exp(-units / Math.max(0.25, scale));
}

export function evaluateDomainProgram(domainKey, units, domainConfig) {
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const safeUnits = Math.max(0, Math.round(units));
  const priority = domainConfig.priority;
  const dimensionScales = planning.dimensionScales;
  const dimensions = {};
  for (const dimension of CROSS_DOMAIN_DIMENSIONS.filter((key) => key !== "reliability")) {
    const scaleMultiplier = dimensionScales[dimension] ?? 1;
    dimensions[dimension] = responseCurve(safeUnits, planning.saturationUnits * scaleMultiplier)
      * planning.readiness
      * (planning.dimensionPotential?.[dimension] ?? 1);
  }
  const baseReliability = planning.unitReliability * responseCurve(safeUnits, planning.saturationUnits * 0.65);
  const redundancyGain = (1 - planning.unitReliability)
    * responseCurve(Math.max(0, safeUnits - domainConfig.minimumUnits), planning.saturationUnits * 0.75);
  dimensions.reliability = clamp(baseReliability + redundancyGain, 0, 1);
  const composite = CROSS_DOMAIN_DIMENSIONS.reduce((sum, dimension) => sum + dimensions[dimension], 0) / CROSS_DOMAIN_DIMENSIONS.length;
  return {
    domainKey,
    units: safeUnits,
    unitLabel: planning.unitLabel,
    unitCost: domainConfig.unitCost,
    cost: safeUnits * domainConfig.unitCost,
    priority,
    dimensions,
    composite,
    minimumSatisfied: safeUnits === 0 || safeUnits >= domainConfig.minimumUnits
  };
}

function aggregateAllocation(config, unitCounts) {
  const programs = PUBLIC_DOMAIN_KEYS.map((domainKey) => evaluateDomainProgram(
    domainKey,
    unitCounts[domainKey] ?? 0,
    config.domains[domainKey]
  ));
  const activePrograms = programs.filter((program) => config.domains[program.domainKey].enabled);
  const priorityTotal = activePrograms.reduce((sum, program) => sum + program.priority, 0) || 1;
  const dimensions = Object.fromEntries(CROSS_DOMAIN_DIMENSIONS.map((dimension) => [
    dimension,
    activePrograms.reduce((sum, program) => sum + program.dimensions[dimension] * program.priority, 0) / priorityTotal
  ]));
  const domainBenefits = activePrograms.map((program) => program.composite);
  const worstDomainBenefit = domainBenefits.length ? Math.min(...domainBenefits) : 0;
  const bestDomainBenefit = domainBenefits.length ? Math.max(...domainBenefits) : 0;
  const committedCost = programs.reduce((sum, program) => sum + program.cost, 0);
  const allocatableBudget = Math.floor(config.totalBudget * (1 - config.reserveFraction));
  const uncommitted = Math.max(0, allocatableBudget - committedCost);
  const costRatio = allocatableBudget > 0 ? committedCost / allocatableBudget : 0;
  const composite = CROSS_DOMAIN_DIMENSIONS.reduce((sum, dimension) => sum + dimensions[dimension], 0) / CROSS_DOMAIN_DIMENSIONS.length;
  const valuePerBudget = committedCost > 0
    ? clamp(composite / Math.max(0.15, costRatio), 0, 1)
    : 0;
  return {
    programs,
    dimensions,
    composite,
    worstDomainBenefit,
    balanceGap: bestDomainBenefit - worstDomainBenefit,
    committedCost,
    allocatableBudget,
    statutoryReserve: config.totalBudget - allocatableBudget,
    uncommitted,
    totalUnspent: config.totalBudget - committedCost,
    costRatio,
    valuePerBudget
  };
}

function scoreAllocation(metrics, profile) {
  const weightedDimensions = CROSS_DOMAIN_DIMENSIONS.reduce(
    (sum, dimension) => sum + metrics.dimensions[dimension] * (profile.weights[dimension] ?? 0),
    0
  );
  const reserveRatio = metrics.allocatableBudget > 0 ? metrics.uncommitted / metrics.allocatableBudget : 0;
  return weightedDimensions
    + profile.worstDomainWeight * metrics.worstDomainBenefit
    - profile.balancePenalty * metrics.balanceGap
    + profile.reserveWeight * reserveRatio
    + (profile.efficiencyWeight ?? 0) * metrics.valuePerBudget;
}

function choicesForDomain(config, domainKey) {
  const domain = config.domains[domainKey];
  if (!domain.enabled) return [0];
  const start = config.requireAllDomains ? domain.minimumUnits : 0;
  const choices = [];
  if (!config.requireAllDomains) choices.push(0);
  for (let units = Math.max(1, start); units <= domain.maximumUnits; units += 1) {
    if (units >= domain.minimumUnits) choices.push(units);
  }
  return choices;
}

function enumerateFeasibleAllocations(config) {
  const allocatableBudget = Math.floor(config.totalBudget * (1 - config.reserveFraction));
  const choices = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, choicesForDomain(config, domainKey)]));
  const allocations = [];
  const unitCounts = {};
  function visit(index, runningCost) {
    if (index === PUBLIC_DOMAIN_KEYS.length) {
      allocations.push(aggregateAllocation(config, unitCounts));
      return;
    }
    const domainKey = PUBLIC_DOMAIN_KEYS[index];
    const unitCost = config.domains[domainKey].unitCost;
    for (const units of choices[domainKey]) {
      const nextCost = runningCost + units * unitCost;
      if (nextCost > allocatableBudget) break;
      unitCounts[domainKey] = units;
      visit(index + 1, nextCost);
    }
  }
  visit(0, 0);
  return allocations;
}

function minimumProgramCost(config) {
  return PUBLIC_DOMAIN_KEYS.reduce((sum, domainKey) => {
    const domain = config.domains[domainKey];
    if (!domain.enabled || !config.requireAllDomains) return sum;
    return sum + domain.minimumUnits * domain.unitCost;
  }, 0);
}

function dominates(a, b) {
  const weaklyBetter = a.metrics.composite >= b.metrics.composite - 1e-12
    && a.metrics.worstDomainBenefit >= b.metrics.worstDomainBenefit - 1e-12
    && a.metrics.dimensions.reliability >= b.metrics.dimensions.reliability - 1e-12
    && a.metrics.committedCost <= b.metrics.committedCost + 1e-9;
  const strictlyBetter = a.metrics.composite > b.metrics.composite + 1e-12
    || a.metrics.worstDomainBenefit > b.metrics.worstDomainBenefit + 1e-12
    || a.metrics.dimensions.reliability > b.metrics.dimensions.reliability + 1e-12
    || a.metrics.committedCost < b.metrics.committedCost - 1e-9;
  return weaklyBetter && strictlyBetter;
}

function markPareto(portfolio) {
  return portfolio.map((allocation, index) => ({
    ...allocation,
    paretoOptimal: !portfolio.some((other, otherIndex) => otherIndex !== index && dominates(other, allocation))
  }));
}

export function allocateCrossDomainBudget(inputConfig = {}) {
  const config = normalizeCrossDomainBudgetConfig(inputConfig);
  const allocatableBudget = Math.floor(config.totalBudget * (1 - config.reserveFraction));
  const requiredMinimumCost = minimumProgramCost(config);
  const enabledDomains = PUBLIC_DOMAIN_KEYS.filter((domainKey) => config.domains[domainKey].enabled);
  if (!enabledDomains.length) {
    return {
      schemaVersion: "1.0",
      ready: false,
      reason: "At least one environmental domain must be enabled.",
      config,
      allocatableBudget,
      requiredMinimumCost: 0,
      shortfall: 0,
      portfolio: [],
      evaluatedAllocations: 0,
      checksum: checksum({ config, reason: "no-enabled-domains" })
    };
  }
  if (requiredMinimumCost > allocatableBudget) {
    return {
      schemaVersion: "1.0",
      ready: false,
      reason: `The allocatable budget is below the ${enabledDomains.length}-domain minimum-program cost.`,
      config,
      allocatableBudget,
      requiredMinimumCost,
      shortfall: requiredMinimumCost - allocatableBudget,
      portfolio: [],
      evaluatedAllocations: 0,
      checksum: checksum({ config, requiredMinimumCost, allocatableBudget })
    };
  }
  const feasible = enumerateFeasibleAllocations(config);
  const selected = Object.values(CROSS_DOMAIN_ALLOCATION_PROFILES).map((profile) => {
    let best = null;
    let bestScore = -Infinity;
    for (const metrics of feasible) {
      const score = scoreAllocation(metrics, profile);
      if (score > bestScore + 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && metrics.committedCost < (best?.committedCost ?? Infinity))) {
        best = metrics;
        bestScore = score;
      }
    }
    return {
      profileKey: profile.key,
      profile,
      score: bestScore,
      metrics: best
    };
  });
  const portfolio = markPareto(selected);
  const result = {
    schemaVersion: "1.0",
    architecture: "Cross-domain normalized program allocation",
    generatedAt: new Date().toISOString(),
    ready: true,
    claimBoundary: "Benefits are normalized within each domain and support program-level budget planning. They are not raw physical units, regulatory benefit-cost estimates, or a substitute for domain-specific placement optimization.",
    config,
    allocatableBudget,
    requiredMinimumCost,
    shortfall: 0,
    evaluatedAllocations: feasible.length,
    portfolio
  };
  result.checksum = checksum({ ...result, generatedAt: undefined, checksum: undefined });
  return result;
}

export function crossDomainAllocationRows(result) {
  if (!result?.ready) return [];
  return result.portfolio.flatMap((allocation) => allocation.metrics.programs.map((program) => ({
    checksum: result.checksum,
    profile: allocation.profileKey,
    profile_label: allocation.profile.label,
    pareto_optimal: allocation.paretoOptimal,
    domain: program.domainKey,
    units: program.units,
    unit_label: program.unitLabel,
    unit_cost_usd: program.unitCost,
    committed_cost_usd: program.cost,
    budget_share: allocation.metrics.committedCost > 0 ? program.cost / allocation.metrics.committedCost : 0,
    normalized_information: program.dimensions.information,
    normalized_exposure: program.dimensions.exposure,
    normalized_equity: program.dimensions.equity,
    normalized_ecology: program.dimensions.ecology,
    normalized_intervention: program.dimensions.intervention,
    normalized_reliability: program.dimensions.reliability,
    normalized_composite: program.composite,
    portfolio_score: allocation.score,
    portfolio_committed_cost_usd: allocation.metrics.committedCost,
    portfolio_worst_domain_benefit: allocation.metrics.worstDomainBenefit,
    portfolio_balance_gap: allocation.metrics.balanceGap
  })));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCrossDomainAllocationCsv(rows) {
  const headers = [
    "checksum", "profile", "profile_label", "pareto_optimal", "domain", "units", "unit_label",
    "unit_cost_usd", "committed_cost_usd", "budget_share", "normalized_information", "normalized_exposure",
    "normalized_equity", "normalized_ecology", "normalized_intervention", "normalized_reliability",
    "normalized_composite", "portfolio_score", "portfolio_committed_cost_usd",
    "portfolio_worst_domain_benefit", "portfolio_balance_gap"
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}
