import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";
import {
  DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG,
  allocateSequentialFundingRound,
  createEvidenceBundle,
  normalizeSequentialReallocationConfig
} from "./sequential-reallocation.js";

export const ADAPTIVE_PROGRAM_SIMULATION_SCHEMA = "lumos-adaptive-program-simulation-v1";

export const ADAPTIVE_RESPONSE_SCENARIOS = Object.freeze({
  conservative: Object.freeze({ key: "conservative", label: "Conservative learning", response: 0.72, evidence: 0.78, yield: 0.86 }),
  central: Object.freeze({ key: "central", label: "Central planning response", response: 1.0, evidence: 1.0, yield: 1.0 }),
  optimistic: Object.freeze({ key: "optimistic", label: "Upper planning response", response: 1.18, evidence: 1.12, yield: 1.10 })
});

export const ADAPTIVE_TRAJECTORY_POLICIES = Object.freeze({
  adaptive: Object.freeze({ key: "adaptive", label: "Adaptive policy", description: "Re-selects the strongest next-round profile after every simulated evidence update." }),
  balanced: Object.freeze({ key: "balanced", label: "Balanced trajectory", description: "Applies the Balanced profile in every simulated round." }),
  information: Object.freeze({ key: "information", label: "Maximum Information trajectory", description: "Applies the Maximum Information profile in every simulated round." }),
  exposure: Object.freeze({ key: "exposure", label: "Exposure Protection trajectory", description: "Applies the Exposure Protection profile in every simulated round." }),
  equity: Object.freeze({ key: "equity", label: "Equity First trajectory", description: "Applies the Equity First profile in every simulated round." }),
  resilience: Object.freeze({ key: "resilience", label: "Reliability and Intervention trajectory", description: "Applies the Reliability and Intervention profile in every simulated round." }),
  cost: Object.freeze({ key: "cost", label: "Cost Efficient trajectory", description: "Applies the Cost Efficient profile in every simulated round." })
});

export const DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG = Object.freeze({
  rounds: 4,
  roundBudget: 60000,
  budgetGrowthRate: 0,
  discountFactor: 0.95,
  transitionRate: 0.55,
  responseScenario: "central",
  reserveFraction: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.reserveFraction,
  explorationFraction: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.explorationFraction,
  learningRate: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.learningRate,
  requireAllDomains: true,
  minimumEquity: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.minimumEquity,
  minimumReliability: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.minimumReliability,
  minimumIntervention: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.minimumIntervention,
  domains: DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.domains
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

function responseCurve(units, scale) {
  if (units <= 0) return 0;
  return 1 - Math.exp(-units / Math.max(0.25, scale));
}

function cloneEvidenceBundle(bundle) {
  return JSON.parse(JSON.stringify(bundle));
}

export function normalizeAdaptiveProgramSimulationConfig(config = {}, evidenceBundle = null) {
  const sequential = normalizeSequentialReallocationConfig({
    nextRoundBudget: finiteNumber(config.roundBudget, DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG.roundBudget),
    reserveFraction: config.reserveFraction,
    explorationFraction: config.explorationFraction,
    learningRate: config.learningRate,
    requireAllDomains: config.requireAllDomains !== false,
    minimumEquity: config.minimumEquity,
    minimumReliability: config.minimumReliability,
    minimumIntervention: config.minimumIntervention,
    domains: config.domains
  }, evidenceBundle);
  const responseScenario = ADAPTIVE_RESPONSE_SCENARIOS[config.responseScenario]
    ? config.responseScenario
    : DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG.responseScenario;
  return {
    rounds: Math.round(clamp(finiteNumber(config.rounds, DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG.rounds), 2, 8)),
    roundBudget: Math.max(1000, Math.round(finiteNumber(config.roundBudget, sequential.nextRoundBudget))),
    budgetGrowthRate: clamp(finiteNumber(config.budgetGrowthRate, DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG.budgetGrowthRate), -0.25, 0.5),
    discountFactor: clamp(finiteNumber(config.discountFactor, DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG.discountFactor), 0.5, 1),
    transitionRate: clamp(finiteNumber(config.transitionRate, DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG.transitionRate), 0, 1),
    responseScenario,
    reserveFraction: sequential.reserveFraction,
    explorationFraction: sequential.explorationFraction,
    learningRate: sequential.learningRate,
    requireAllDomains: sequential.requireAllDomains,
    minimumEquity: sequential.minimumEquity,
    minimumReliability: sequential.minimumReliability,
    minimumIntervention: sequential.minimumIntervention,
    domains: sequential.domains
  };
}

function adaptiveAllocationScore(allocation, evidenceBundle, config) {
  const activeEvidence = PUBLIC_DOMAIN_KEYS
    .filter((domainKey) => config.domains[domainKey].enabled)
    .map((domainKey) => evidenceBundle.domains[domainKey]);
  const equityPressure = mean(activeEvidence.map((entry) => entry.equityNeed), 0.5);
  const reliabilityPressure = mean(activeEvidence.map((entry) => 1 - entry.meanReliability), 0.2);
  const interventionPressure = mean(activeEvidence.map((entry) => 1 - entry.interventionReadiness), 0.2);
  const uncertaintyPressure = mean(activeEvidence.map((entry) => entry.residualNeed), 0.6);
  const metrics = allocation.metrics;
  return 1.45 * metrics.incrementalComposite
    + 0.46 * metrics.worstDomainBenefit
    - 0.24 * metrics.balanceGap
    + 0.36 * equityPressure * metrics.incrementalDimensions.equity
    + 0.32 * reliabilityPressure * metrics.incrementalDimensions.reliability
    + 0.30 * interventionPressure * metrics.incrementalDimensions.intervention
    + 0.26 * uncertaintyPressure * metrics.incrementalDimensions.information
    + 0.18 * metrics.explorationBonus
    + 0.06 * (metrics.allocatableBudget > 0 ? metrics.uncommitted / metrics.allocatableBudget : 0);
}

function chooseRoundAllocation(result, trajectoryKey, evidenceBundle, config) {
  if (trajectoryKey !== "adaptive") {
    return result.portfolio.find((allocation) => allocation.profileKey === trajectoryKey) ?? result.portfolio[0];
  }
  return [...result.portfolio].sort((left, right) => {
    const scoreDifference = adaptiveAllocationScore(right, evidenceBundle, config) - adaptiveAllocationScore(left, evidenceBundle, config);
    if (Math.abs(scoreDifference) > 1e-12) return scoreDifference;
    return left.metrics.addedCost - right.metrics.addedCost;
  })[0];
}

function transitionDomainEvidence(domainKey, evidence, program, config, scenario) {
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const calibration = planning.evidenceCalibration;
  const additionalUnits = program.additionalUnits;
  const unitSignal = responseCurve(additionalUnits, Math.max(1, planning.minimumUnits));
  const incrementalSignal = clamp(
    0.34 * program.incrementalDimensions.information
    + 0.18 * program.incrementalDimensions.exposure
    + 0.20 * program.incrementalDimensions.equity
    + 0.12 * program.incrementalDimensions.ecology
    + 0.16 * program.incrementalDimensions.intervention
  );
  const evidenceGain = config.transitionRate
    * calibration.simulationLearningRate
    * scenario.evidence
    * (0.35 * unitSignal + 0.65 * incrementalSignal);
  const evidenceStrength = clamp(evidence.evidenceStrength + (1 - evidence.evidenceStrength) * evidenceGain);
  const residualReduction = clamp(
    config.transitionRate
    * calibration.residualResponse
    * scenario.response
    * (0.28 * unitSignal + 0.72 * incrementalSignal),
    0,
    0.72
  );
  const residualNeed = clamp(evidence.residualNeed * (1 - residualReduction), 0.04, 1);
  const observedYieldTarget = clamp(
    0.68 + scenario.yield * (0.34 + 0.82 * incrementalSignal + 0.20 * unitSignal),
    0.45,
    1.65
  );
  const yieldBlend = clamp(evidenceGain + 0.12 * unitSignal, 0, 0.7);
  const normalizedYield = clamp(evidence.normalizedYield * (1 - yieldBlend) + observedYieldTarget * yieldBlend, 0, 1.75);
  const reliabilityTarget = clamp(program.dimensions.reliability * (0.96 + 0.04 * scenario.response));
  const meanReliability = clamp(evidence.meanReliability + (reliabilityTarget - evidence.meanReliability) * config.transitionRate * 0.55);
  const equityNeed = clamp(evidence.equityNeed * (1 - config.transitionRate * scenario.response * program.incrementalDimensions.equity * 0.9), 0.04, 1);
  const interventionReadiness = clamp(
    evidence.interventionReadiness
    + (program.dimensions.intervention - evidence.interventionReadiness) * config.transitionRate * 0.62
  );
  return {
    ...evidence,
    deployedUnits: program.totalUnits,
    recordCount: evidence.recordCount + (additionalUnits > 0 ? 1 : 0),
    evidenceStrength,
    residualNeed,
    normalizedYield,
    meanReliability,
    equityNeed,
    interventionReadiness,
    sourceType: additionalUnits > 0 ? "simulated-transition" : evidence.sourceType
  };
}

function transitionEvidenceBundle(bundle, allocation, config, roundIndex) {
  const scenario = ADAPTIVE_RESPONSE_SCENARIOS[config.responseScenario];
  const domains = {};
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const program = allocation.metrics.programs.find((entry) => entry.domainKey === domainKey);
    domains[domainKey] = transitionDomainEvidence(domainKey, bundle.domains[domainKey], program, config, scenario);
  }
  const transitioned = {
    ...bundle,
    architecture: "Simulated multi-round evidence transition",
    label: `${bundle.label} · simulated round ${roundIndex}`,
    generatedAt: new Date(0).toISOString(),
    domains,
    recordCount: PUBLIC_DOMAIN_KEYS.reduce((sum, domainKey) => sum + domains[domainKey].recordCount, 0),
    evidenceDomainCount: PUBLIC_DOMAIN_KEYS.filter((domainKey) => domains[domainKey].recordCount > 0).length,
    claimBoundary: "Simulated evidence transitions are deterministic planning assumptions, not forecasts of measurements or intervention outcomes."
  };
  transitioned.checksum = checksum({ ...transitioned, checksum: undefined, generatedAt: undefined });
  return transitioned;
}

function roundSequentialConfig(config, evidenceBundle, roundIndex) {
  const roundBudget = Math.round(config.roundBudget * ((1 + config.budgetGrowthRate) ** (roundIndex - 1)));
  return {
    nextRoundBudget: roundBudget,
    reserveFraction: config.reserveFraction,
    explorationFraction: config.explorationFraction,
    learningRate: config.learningRate,
    requireAllDomains: config.requireAllDomains,
    minimumEquity: config.minimumEquity,
    minimumReliability: config.minimumReliability,
    minimumIntervention: config.minimumIntervention,
    domains: Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, {
      ...config.domains[domainKey],
      existingUnits: evidenceBundle.domains[domainKey].deployedUnits
    }]))
  };
}

function simulateTrajectory(trajectoryKey, config, initialEvidenceBundle) {
  let evidenceBundle = cloneEvidenceBundle(initialEvidenceBundle);
  const rounds = [];
  let cumulativeCost = 0;
  let cumulativeBudget = 0;
  let discountedIncrementalBenefit = 0;
  let terminalAllocation = null;
  let status = "complete";
  let reason = null;
  for (let roundIndex = 1; roundIndex <= config.rounds; roundIndex += 1) {
    const sequentialConfig = roundSequentialConfig(config, evidenceBundle, roundIndex);
    cumulativeBudget += sequentialConfig.nextRoundBudget;
    const result = allocateSequentialFundingRound(sequentialConfig, evidenceBundle);
    if (!result.ready) {
      status = "incomplete";
      reason = result.reason;
      rounds.push({ roundIndex, ready: false, reason: result.reason, shortfall: result.shortfall ?? 0, budget: sequentialConfig.nextRoundBudget });
      break;
    }
    const selected = chooseRoundAllocation(result, trajectoryKey, evidenceBundle, config);
    cumulativeCost += selected.metrics.addedCost;
    discountedIncrementalBenefit += (config.discountFactor ** (roundIndex - 1)) * selected.metrics.incrementalComposite;
    evidenceBundle = transitionEvidenceBundle(evidenceBundle, selected, config, roundIndex);
    terminalAllocation = selected;
    rounds.push({
      roundIndex,
      ready: true,
      budget: sequentialConfig.nextRoundBudget,
      selectedProfileKey: selected.profileKey,
      selectedProfileLabel: selected.profile.label,
      constraintStatus: selected.constraintStatus,
      addedCost: selected.metrics.addedCost,
      uncommitted: selected.metrics.uncommitted,
      addedUnits: selected.metrics.programs.reduce((sum, program) => sum + program.additionalUnits, 0),
      incrementalComposite: selected.metrics.incrementalComposite,
      worstDomainBenefit: selected.metrics.worstDomainBenefit,
      balanceGap: selected.metrics.balanceGap,
      programs: selected.metrics.programs,
      evidenceAfterRound: evidenceBundle.domains,
      allocationChecksum: result.checksum,
      evidenceChecksum: evidenceBundle.checksum
    });
  }
  const enabledDomains = PUBLIC_DOMAIN_KEYS.filter((domainKey) => config.domains[domainKey].enabled);
  const terminalEvidence = enabledDomains.map((domainKey) => evidenceBundle.domains[domainKey]);
  const terminalResidualNeed = mean(terminalEvidence.map((entry) => entry.residualNeed), 1);
  const terminalEvidenceStrength = mean(terminalEvidence.map((entry) => entry.evidenceStrength), 0);
  const terminalReliability = mean(terminalEvidence.map((entry) => entry.meanReliability), 0);
  const terminalInterventionReadiness = mean(terminalEvidence.map((entry) => entry.interventionReadiness), 0);
  const terminalWorstDomainBenefit = terminalAllocation?.metrics.worstDomainBenefit ?? 0;
  const terminalBalanceGap = terminalAllocation?.metrics.balanceGap ?? 1;
  const completedRounds = rounds.filter((round) => round.ready).length;
  const score = discountedIncrementalBenefit
    + 0.70 * (1 - terminalResidualNeed)
    + 0.30 * terminalEvidenceStrength
    + 0.28 * terminalReliability
    + 0.24 * terminalInterventionReadiness
    + 0.38 * terminalWorstDomainBenefit
    - 0.20 * terminalBalanceGap
    - 0.08 * (cumulativeBudget > 0 ? cumulativeCost / cumulativeBudget : 0)
    - 0.35 * (config.rounds - completedRounds);
  return {
    trajectoryKey,
    policy: ADAPTIVE_TRAJECTORY_POLICIES[trajectoryKey],
    status,
    reason,
    complete: completedRounds === config.rounds,
    completedRounds,
    rounds,
    cumulativeBudget,
    cumulativeCost,
    cumulativeUncommitted: Math.max(0, cumulativeBudget - cumulativeCost),
    discountedIncrementalBenefit,
    terminalResidualNeed,
    terminalEvidenceStrength,
    terminalReliability,
    terminalInterventionReadiness,
    terminalWorstDomainBenefit,
    terminalBalanceGap,
    terminalEvidenceBundle: evidenceBundle,
    score
  };
}

function trajectoryDominates(left, right) {
  const weaklyBetter = left.discountedIncrementalBenefit >= right.discountedIncrementalBenefit - 1e-12
    && left.terminalResidualNeed <= right.terminalResidualNeed + 1e-12
    && left.terminalWorstDomainBenefit >= right.terminalWorstDomainBenefit - 1e-12
    && left.cumulativeCost <= right.cumulativeCost + 1e-9;
  const strictlyBetter = left.discountedIncrementalBenefit > right.discountedIncrementalBenefit + 1e-12
    || left.terminalResidualNeed < right.terminalResidualNeed - 1e-12
    || left.terminalWorstDomainBenefit > right.terminalWorstDomainBenefit + 1e-12
    || left.cumulativeCost < right.cumulativeCost - 1e-9;
  return weaklyBetter && strictlyBetter;
}

export function simulateAdaptiveProgram(inputConfig = {}, evidenceInput = null) {
  const evidenceBundle = evidenceInput?.domains ? evidenceInput : createEvidenceBundle(evidenceInput?.records ?? []);
  const config = normalizeAdaptiveProgramSimulationConfig(inputConfig, evidenceBundle);
  const trajectories = Object.keys(ADAPTIVE_TRAJECTORY_POLICIES).map((trajectoryKey) => simulateTrajectory(trajectoryKey, config, evidenceBundle));
  const marked = trajectories.map((trajectory, index) => ({
    ...trajectory,
    paretoOptimal: !trajectories.some((other, otherIndex) => otherIndex !== index && trajectoryDominates(other, trajectory))
  }));
  const completeTrajectories = marked.filter((trajectory) => trajectory.complete);
  const best = [...(completeTrajectories.length ? completeTrajectories : marked)].sort((left, right) => right.score - left.score)[0];
  const result = {
    schema: ADAPTIVE_PROGRAM_SIMULATION_SCHEMA,
    schemaVersion: "1.0",
    architecture: "Multi-round adaptive cross-domain monitoring program simulation",
    generatedAt: new Date().toISOString(),
    ready: completeTrajectories.length > 0,
    config,
    initialEvidenceBundle: evidenceBundle,
    responseScenario: ADAPTIVE_RESPONSE_SCENARIOS[config.responseScenario],
    trajectories: marked,
    completeTrajectories: completeTrajectories.length,
    bestTrajectoryKey: best?.trajectoryKey ?? null,
    claimBoundary: "These trajectories are deterministic scenario comparisons built from normalized planning responses and assumed evidence transitions. They are not forecasts, causal estimates, vendor budgets, or regulatory funding recommendations."
  };
  result.checksum = checksum({ ...result, generatedAt: undefined, checksum: undefined });
  return result;
}

export function adaptiveProgramSimulationRows(result) {
  if (!result?.trajectories) return [];
  return result.trajectories.flatMap((trajectory) => trajectory.rounds.flatMap((round) => {
    if (!round.ready) return [{
      checksum: result.checksum,
      trajectory: trajectory.trajectoryKey,
      trajectory_label: trajectory.policy.label,
      pareto_optimal: trajectory.paretoOptimal,
      round: round.roundIndex,
      ready: false,
      reason: round.reason,
      budget_usd: round.budget,
      shortfall_usd: round.shortfall
    }];
    return round.programs.map((program) => ({
      checksum: result.checksum,
      trajectory: trajectory.trajectoryKey,
      trajectory_label: trajectory.policy.label,
      pareto_optimal: trajectory.paretoOptimal,
      trajectory_score: trajectory.score,
      round: round.roundIndex,
      ready: true,
      selected_profile: round.selectedProfileKey,
      selected_profile_label: round.selectedProfileLabel,
      constraint_status: round.constraintStatus,
      budget_usd: round.budget,
      added_cost_usd: round.addedCost,
      uncommitted_usd: round.uncommitted,
      domain: program.domainKey,
      existing_units: program.existingUnits,
      additional_units: program.additionalUnits,
      total_units: program.totalUnits,
      incremental_composite: program.incrementalComposite,
      normalized_information: program.dimensions.information,
      normalized_equity: program.dimensions.equity,
      normalized_reliability: program.dimensions.reliability,
      normalized_intervention: program.dimensions.intervention,
      evidence_strength_after: round.evidenceAfterRound[program.domainKey].evidenceStrength,
      residual_need_after: round.evidenceAfterRound[program.domainKey].residualNeed,
      terminal_residual_need: trajectory.terminalResidualNeed,
      discounted_incremental_benefit: trajectory.discountedIncrementalBenefit,
      cumulative_cost_usd: trajectory.cumulativeCost
    }));
  }));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToAdaptiveProgramSimulationCsv(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}
