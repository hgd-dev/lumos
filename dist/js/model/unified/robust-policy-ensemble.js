import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";
import {
  ADAPTIVE_TRAJECTORY_POLICIES,
  DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG,
  normalizeAdaptiveProgramSimulationConfig,
  simulateAdaptiveProgram
} from "./adaptive-program-simulation.js";
import { createEvidenceBundle } from "./sequential-reallocation.js";

export const ROBUST_POLICY_ENSEMBLE_SCHEMA = "lumos-robust-policy-ensemble-v1";

export const DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG = Object.freeze({
  ensembleSize: 64,
  seed: 240401,
  responseUncertainty: 0.24,
  costUncertainty: 0.15,
  baseFailureRate: 0.08,
  environmentalUncertainty: 0.18,
  crossDomainCorrelation: 0.40,
  riskAversion: 0.60,
  adaptiveConfig: DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mean(values, fallback = 0) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : fallback;
}

function quantile(values, probability, fallback = 0) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return fallback;
  const position = clamp(probability) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
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

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random) {
  let first = 0;
  let second = 0;
  while (first <= Number.EPSILON) first = random();
  while (second <= Number.EPSILON) second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function interpolate(left, right, fraction) {
  return finiteNumber(left) + (finiteNumber(right) - finiteNumber(left)) * clamp(fraction);
}

function interpolateAnchors(anchors, responsePosition, trajectoryKey) {
  const lowerKey = responsePosition < 0 ? "conservative" : "central";
  const upperKey = responsePosition < 0 ? "central" : "optimistic";
  const fraction = responsePosition < 0 ? responsePosition + 1 : responsePosition;
  const lower = anchors[lowerKey].trajectories.find((entry) => entry.trajectoryKey === trajectoryKey);
  const upper = anchors[upperKey].trajectories.find((entry) => entry.trajectoryKey === trajectoryKey);
  const roundCount = Math.max(lower?.rounds?.length ?? 0, upper?.rounds?.length ?? 0);
  const programs = [];
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const lowerRound = lower?.rounds?.[roundIndex];
    const upperRound = upper?.rounds?.[roundIndex];
    for (const domainKey of PUBLIC_DOMAIN_KEYS) {
      const lowerProgram = lowerRound?.programs?.find((entry) => entry.domainKey === domainKey);
      const upperProgram = upperRound?.programs?.find((entry) => entry.domainKey === domainKey);
      programs.push({
        roundIndex: roundIndex + 1,
        domainKey,
        additionalUnits: interpolate(lowerProgram?.additionalUnits ?? 0, upperProgram?.additionalUnits ?? 0, fraction)
      });
    }
  }
  return {
    complete: Boolean(lower?.complete && upper?.complete),
    completedRounds: Math.round(interpolate(lower?.completedRounds ?? 0, upper?.completedRounds ?? 0, fraction)),
    cumulativeBudget: interpolate(lower?.cumulativeBudget, upper?.cumulativeBudget, fraction),
    discountedIncrementalBenefit: interpolate(lower?.discountedIncrementalBenefit, upper?.discountedIncrementalBenefit, fraction),
    terminalResidualNeed: interpolate(lower?.terminalResidualNeed, upper?.terminalResidualNeed, fraction),
    terminalEvidenceStrength: interpolate(lower?.terminalEvidenceStrength, upper?.terminalEvidenceStrength, fraction),
    terminalReliability: interpolate(lower?.terminalReliability, upper?.terminalReliability, fraction),
    terminalInterventionReadiness: interpolate(lower?.terminalInterventionReadiness, upper?.terminalInterventionReadiness, fraction),
    terminalWorstDomainBenefit: interpolate(lower?.terminalWorstDomainBenefit, upper?.terminalWorstDomainBenefit, fraction),
    terminalBalanceGap: interpolate(lower?.terminalBalanceGap, upper?.terminalBalanceGap, fraction),
    programs
  };
}

export function normalizeRobustPolicyEnsembleConfig(config = {}, evidenceBundle = null) {
  const adaptiveConfig = normalizeAdaptiveProgramSimulationConfig(config.adaptiveConfig ?? config, evidenceBundle);
  return {
    ensembleSize: Math.round(clamp(finiteNumber(config.ensembleSize, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.ensembleSize), 16, 256)),
    seed: Math.max(1, Math.round(finiteNumber(config.seed, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.seed))) >>> 0,
    responseUncertainty: clamp(finiteNumber(config.responseUncertainty, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.responseUncertainty), 0, 0.65),
    costUncertainty: clamp(finiteNumber(config.costUncertainty, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.costUncertainty), 0, 0.75),
    baseFailureRate: clamp(finiteNumber(config.baseFailureRate, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.baseFailureRate), 0, 0.45),
    environmentalUncertainty: clamp(finiteNumber(config.environmentalUncertainty, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.environmentalUncertainty), 0, 0.75),
    crossDomainCorrelation: clamp(finiteNumber(config.crossDomainCorrelation, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.crossDomainCorrelation), 0, 0.95),
    riskAversion: clamp(finiteNumber(config.riskAversion, DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG.riskAversion), 0, 1),
    adaptiveConfig
  };
}

function generateMember(config, random, memberIndex) {
  const correlation = config.crossDomainCorrelation;
  const independentWeight = Math.sqrt(Math.max(0, 1 - correlation ** 2));
  const responseShock = normalRandom(random);
  const globalCostShock = normalRandom(random);
  const globalFailureShock = normalRandom(random);
  const globalEnvironmentShock = normalRandom(random);
  const responsePosition = clamp(responseShock * config.responseUncertainty * 2.25, -1, 1);
  const domains = {};
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const costShock = correlation * globalCostShock + independentWeight * normalRandom(random);
    const failureShock = correlation * globalFailureShock + independentWeight * normalRandom(random);
    const environmentShock = correlation * globalEnvironmentShock + independentWeight * normalRandom(random);
    const calibration = DOMAIN_REGISTRY[domainKey].planning.robustnessCalibration;
    const sigma = config.costUncertainty * calibration.costScale;
    const costMultiplier = clamp(Math.exp(-0.5 * sigma * sigma + sigma * costShock), 0.45, 2.4);
    const failureRate = clamp(config.baseFailureRate * calibration.failureSensitivity * Math.exp(0.45 * failureShock), 0, 0.65);
    const environmentMultiplier = clamp(1 + config.environmentalUncertainty * calibration.environmentalSensitivity * environmentShock, 0.45, 1.9);
    domains[domainKey] = { costMultiplier, failureRate, environmentMultiplier };
  }
  return {
    memberIndex: memberIndex + 1,
    responsePosition,
    responseLabel: responsePosition < -0.33 ? "conservative-like" : responsePosition > 0.33 ? "optimistic-like" : "central-like",
    domains
  };
}

function stressedTrajectory(trajectoryKey, interpolated, member, config) {
  const unitCosts = config.adaptiveConfig.domains;
  let stressedCost = 0;
  let totalUnits = 0;
  let failureNumerator = 0;
  let environmentNumerator = 0;
  const domainUnits = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, 0]));
  for (const program of interpolated.programs) {
    const units = Math.max(0, program.additionalUnits);
    domainUnits[program.domainKey] += units;
    totalUnits += units;
    const shock = member.domains[program.domainKey];
    stressedCost += units * unitCosts[program.domainKey].unitCost * shock.costMultiplier;
    failureNumerator += units * shock.failureRate;
    environmentNumerator += units * shock.environmentMultiplier;
  }
  if (totalUnits <= 0) {
    for (const domainKey of PUBLIC_DOMAIN_KEYS) {
      failureNumerator += member.domains[domainKey].failureRate;
      environmentNumerator += member.domains[domainKey].environmentMultiplier;
    }
    totalUnits = PUBLIC_DOMAIN_KEYS.length;
  }
  const meanFailureRate = clamp(failureNumerator / totalUnits, 0, 1);
  const meanEnvironmentMultiplier = clamp(environmentNumerator / totalUnits, 0.45, 1.9);
  const domainEnvironmentValues = PUBLIC_DOMAIN_KEYS.map((domainKey) => member.domains[domainKey].environmentMultiplier);
  const environmentDispersion = Math.max(...domainEnvironmentValues) - Math.min(...domainEnvironmentValues);
  const allocatableBudget = interpolated.cumulativeBudget * (1 - config.adaptiveConfig.reserveFraction);
  const overrun = Math.max(0, stressedCost - allocatableBudget);
  const overrunRatio = allocatableBudget > 0 ? overrun / allocatableBudget : 1;
  const feasible = interpolated.complete && overrun <= 1e-6;
  const benefit = Math.max(0, interpolated.discountedIncrementalBenefit * (1 - 0.82 * meanFailureRate));
  const residualNeed = clamp(interpolated.terminalResidualNeed * meanEnvironmentMultiplier + 0.22 * meanFailureRate, 0.02, 1);
  const evidenceStrength = clamp(interpolated.terminalEvidenceStrength * (1 - 0.28 * meanFailureRate));
  const reliability = clamp(interpolated.terminalReliability * (1 - meanFailureRate));
  const interventionReadiness = clamp(interpolated.terminalInterventionReadiness * (1 - 0.55 * meanFailureRate));
  const worstDomainBenefit = clamp(interpolated.terminalWorstDomainBenefit * (1 - 0.70 * meanFailureRate) / Math.max(1, meanEnvironmentMultiplier * 0.92));
  const balanceGap = clamp(interpolated.terminalBalanceGap + 0.24 * environmentDispersion + 0.12 * meanFailureRate);
  const costRatio = allocatableBudget > 0 ? stressedCost / allocatableBudget : 1;
  const rawUtility = 1.15 * benefit
    + 0.72 * (1 - residualNeed)
    + 0.30 * evidenceStrength
    + 0.27 * reliability
    + 0.23 * interventionReadiness
    + 0.38 * worstDomainBenefit
    - 0.22 * balanceGap
    - 0.10 * Math.min(2, costRatio)
    - 0.75 * overrunRatio
    - (feasible ? 0 : 0.45);
  return {
    trajectoryKey,
    feasible,
    stressedCost,
    allocatableBudget,
    overrun,
    overrunRatio,
    benefit,
    residualNeed,
    evidenceStrength,
    reliability,
    interventionReadiness,
    worstDomainBenefit,
    balanceGap,
    meanFailureRate,
    meanEnvironmentMultiplier,
    domainUnits,
    rawUtility
  };
}

function markMemberUtilities(outcomes) {
  const rawValues = outcomes.map((entry) => entry.rawUtility);
  const minimum = Math.min(...rawValues);
  const maximum = Math.max(...rawValues);
  const range = Math.max(1e-9, maximum - minimum);
  const marked = outcomes.map((entry) => ({ ...entry, normalizedUtility: (entry.rawUtility - minimum) / range }));
  const best = Math.max(...marked.map((entry) => entry.normalizedUtility));
  return marked.map((entry) => ({ ...entry, regret: best - entry.normalizedUtility }));
}

function summarizePolicy(trajectoryKey, outcomes, riskAversion) {
  const utilities = outcomes.map((entry) => entry.normalizedUtility);
  const regrets = outcomes.map((entry) => entry.regret);
  const costs = outcomes.map((entry) => entry.stressedCost);
  const q10 = quantile(utilities, 0.10);
  const lowerTail = utilities.filter((value) => value <= q10 + 1e-12);
  const expectedUtility = mean(utilities);
  const cvar10 = mean(lowerTail, q10);
  const feasibilityProbability = mean(outcomes.map((entry) => entry.feasible ? 1 : 0));
  const expectedRegret = mean(regrets);
  const maximumRegret = Math.max(...regrets);
  const downsideComposite = 0.38 * q10
    + 0.27 * cvar10
    + 0.20 * feasibilityProbability
    + 0.15 * (1 - maximumRegret);
  const robustScore = (1 - riskAversion) * expectedUtility
    + riskAversion * downsideComposite
    - 0.08 * expectedRegret;
  return {
    trajectoryKey,
    policy: ADAPTIVE_TRAJECTORY_POLICIES[trajectoryKey],
    expectedUtility,
    medianUtility: quantile(utilities, 0.50),
    p10Utility: q10,
    cvar10,
    worstUtility: Math.min(...utilities),
    feasibilityProbability,
    expectedRegret,
    maximumRegret,
    expectedCost: mean(costs),
    p90Cost: quantile(costs, 0.90),
    expectedResidualNeed: mean(outcomes.map((entry) => entry.residualNeed)),
    expectedReliability: mean(outcomes.map((entry) => entry.reliability)),
    expectedFailureRate: mean(outcomes.map((entry) => entry.meanFailureRate)),
    robustScore
  };
}

function policyDominates(left, right) {
  const weaklyBetter = left.expectedUtility >= right.expectedUtility - 1e-12
    && left.p10Utility >= right.p10Utility - 1e-12
    && left.feasibilityProbability >= right.feasibilityProbability - 1e-12
    && left.expectedCost <= right.expectedCost + 1e-9;
  const strictlyBetter = left.expectedUtility > right.expectedUtility + 1e-12
    || left.p10Utility > right.p10Utility + 1e-12
    || left.feasibilityProbability > right.feasibilityProbability + 1e-12
    || left.expectedCost < right.expectedCost - 1e-9;
  return weaklyBetter && strictlyBetter;
}

export function evaluateRobustPolicies(inputConfig = {}, evidenceInput = null) {
  const evidenceBundle = evidenceInput?.domains ? evidenceInput : createEvidenceBundle(evidenceInput?.records ?? []);
  const config = normalizeRobustPolicyEnsembleConfig(inputConfig, evidenceBundle);
  const anchors = Object.fromEntries(["conservative", "central", "optimistic"].map((responseScenario) => [
    responseScenario,
    simulateAdaptiveProgram({ ...config.adaptiveConfig, responseScenario }, evidenceBundle)
  ]));
  const random = mulberry32(config.seed);
  const members = [];
  const outcomesByPolicy = Object.fromEntries(Object.keys(ADAPTIVE_TRAJECTORY_POLICIES).map((key) => [key, []]));
  for (let memberIndex = 0; memberIndex < config.ensembleSize; memberIndex += 1) {
    const scenario = generateMember(config, random, memberIndex);
    const rawOutcomes = Object.keys(ADAPTIVE_TRAJECTORY_POLICIES).map((trajectoryKey) => stressedTrajectory(
      trajectoryKey,
      interpolateAnchors(anchors, scenario.responsePosition, trajectoryKey),
      scenario,
      config
    ));
    const outcomes = markMemberUtilities(rawOutcomes);
    outcomes.forEach((outcome) => outcomesByPolicy[outcome.trajectoryKey].push(outcome));
    members.push({ ...scenario, outcomes });
  }
  const policies = Object.keys(ADAPTIVE_TRAJECTORY_POLICIES).map((trajectoryKey) => summarizePolicy(
    trajectoryKey,
    outcomesByPolicy[trajectoryKey],
    config.riskAversion
  ));
  const markedPolicies = policies.map((policy, index) => ({
    ...policy,
    paretoOptimal: !policies.some((other, otherIndex) => otherIndex !== index && policyDominates(other, policy))
  }));
  const byRobust = [...markedPolicies].sort((left, right) => right.robustScore - left.robustScore);
  const byExpected = [...markedPolicies].sort((left, right) => right.expectedUtility - left.expectedUtility);
  const byRegret = [...markedPolicies].sort((left, right) => left.maximumRegret - right.maximumRegret || left.expectedRegret - right.expectedRegret);
  const byFeasibility = [...markedPolicies].sort((left, right) => right.feasibilityProbability - left.feasibilityProbability || right.robustScore - left.robustScore);
  const result = {
    schema: ROBUST_POLICY_ENSEMBLE_SCHEMA,
    schemaVersion: "1.0",
    architecture: "Scenario-ensemble evaluation of multi-round cross-domain monitoring policies",
    generatedAt: new Date().toISOString(),
    ready: markedPolicies.length > 0,
    config,
    initialEvidenceBundle: evidenceBundle,
    anchorChecksums: Object.fromEntries(Object.entries(anchors).map(([key, value]) => [key, value.checksum])),
    members,
    policies: markedPolicies,
    robustPolicyKey: byRobust[0]?.trajectoryKey ?? null,
    expectedValuePolicyKey: byExpected[0]?.trajectoryKey ?? null,
    minimaxRegretPolicyKey: byRegret[0]?.trajectoryKey ?? null,
    mostFeasiblePolicyKey: byFeasibility[0]?.trajectoryKey ?? null,
    claimBoundary: "The ensemble evaluates v2.3 policy trajectories under reproducible planning shocks. It is not a probability forecast, confidence interval, causal estimate, vendor quote, or stochastic-control optimum. The adaptive path is re-anchored across conservative, central, and optimistic response simulations, while within-anchor cost, failure, and environmental shocks evaluate outcome robustness rather than re-solving every decision after every random draw."
  };
  result.checksum = checksum({ ...result, generatedAt: undefined, checksum: undefined });
  return result;
}

export function robustPolicyEnsembleRows(result) {
  if (!result?.policies) return [];
  return result.policies.map((policy) => ({
    checksum: result.checksum,
    ensemble_size: result.config.ensembleSize,
    seed: result.config.seed,
    trajectory: policy.trajectoryKey,
    trajectory_label: policy.policy.label,
    robust_recommendation: policy.trajectoryKey === result.robustPolicyKey,
    expected_value_recommendation: policy.trajectoryKey === result.expectedValuePolicyKey,
    minimax_regret_recommendation: policy.trajectoryKey === result.minimaxRegretPolicyKey,
    most_feasible_recommendation: policy.trajectoryKey === result.mostFeasiblePolicyKey,
    pareto_optimal: policy.paretoOptimal,
    robust_score: policy.robustScore,
    expected_utility: policy.expectedUtility,
    median_utility: policy.medianUtility,
    p10_utility: policy.p10Utility,
    cvar10_utility: policy.cvar10,
    worst_utility: policy.worstUtility,
    feasibility_probability: policy.feasibilityProbability,
    expected_regret: policy.expectedRegret,
    maximum_regret: policy.maximumRegret,
    expected_cost_usd: policy.expectedCost,
    p90_cost_usd: policy.p90Cost,
    expected_residual_need: policy.expectedResidualNeed,
    expected_reliability: policy.expectedReliability,
    expected_failure_rate: policy.expectedFailureRate
  }));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToRobustPolicyEnsembleCsv(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}
