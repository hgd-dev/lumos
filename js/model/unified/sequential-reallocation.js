import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";
import {
  CROSS_DOMAIN_ALLOCATION_PROFILES,
  CROSS_DOMAIN_DIMENSIONS,
  DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG,
  normalizeCrossDomainBudgetConfig
} from "./budget-allocation.js";

export const DOMAIN_EVIDENCE_SCHEMA = "lumos-domain-evidence-v1";
export const SEQUENTIAL_REALLOCATION_SCHEMA = "lumos-sequential-reallocation-v1";

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

function weightedMean(entries, valueKey, weightKey = "weight", fallback = 0) {
  let numerator = 0;
  let denominator = 0;
  for (const entry of entries) {
    const value = finiteNumber(entry?.[valueKey], NaN);
    const weight = Math.max(0, finiteNumber(entry?.[weightKey], 0));
    if (!Number.isFinite(value) || weight <= 0) continue;
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : fallback;
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

function inferDomainKey(snapshot) {
  const direct = snapshot?.controls?.domainKey ?? snapshot?.scenario?.domainKey;
  if (PUBLIC_DOMAIN_KEYS.includes(direct)) return direct;
  const scenarioType = String(snapshot?.scenario?.scenarioType ?? "");
  if (scenarioType.includes("air")) return "air";
  if (scenarioType.includes("soil")) return "soil";
  if (scenarioType.includes("water")) return "water";
  if (scenarioType.includes("heat") || scenarioType === "live-city" || scenarioType === "live-national") return "heat";
  return null;
}

function normalizedCellUncertainty(cell) {
  const value = finiteNumber(
    cell?.uncertainty,
    finiteNumber(
      cell?.predictiveAirUncertainty,
      finiteNumber(cell?.predictiveSoilUncertainty, finiteNumber(cell?.predictiveWaterUncertainty, finiteNumber(cell?.predictiveUncertainty, 0.5)))
    )
  );
  if (value <= 1) return clamp(value);
  return clamp(value / (1 + value));
}

function nestedObjects(value, output = []) {
  if (!value || typeof value !== "object") return output;
  output.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") nestedObjects(child, output);
  }
  return output;
}

function findValidationEvidence(scenario) {
  const roots = [
    scenario?.validation,
    scenario?.model?.airValidation,
    scenario?.model?.soilValidation,
    scenario?.model?.waterValidation,
    scenario?.model?.validation
  ].filter(Boolean);
  const objects = roots.flatMap((root) => nestedObjects(root));
  const candidates = [];
  for (const object of objects) {
    const lumosRmse = finiteNumber(object?.lumos?.rmse, finiteNumber(object?.rmse, NaN));
    if (!Number.isFinite(lumosRmse) || lumosRmse < 0) continue;
    const baselineRmses = Object.entries(object)
      .filter(([key, value]) => key !== "lumos" && value && typeof value === "object" && Number.isFinite(Number(value.rmse)))
      .map(([, value]) => Number(value.rmse))
      .filter((value) => value > 0);
    const baselineRmse = baselineRmses.length ? Math.min(...baselineRmses) : NaN;
    const improvement = Number.isFinite(baselineRmse)
      ? clamp((baselineRmse - lumosRmse) / Math.max(baselineRmse, 1e-9), -1, 1)
      : 0;
    candidates.push({ lumosRmse, baselineRmse, improvement });
  }
  if (!candidates.length) {
    const available = roots.some((root) => root?.available === true || root?.locked?.available === true);
    return { available, quality: available ? 0.55 : 0.2, improvement: 0, lumosRmse: null, baselineRmse: null };
  }
  const best = candidates.sort((left, right) => right.improvement - left.improvement)[0];
  return {
    available: true,
    quality: clamp(0.55 + 0.45 * best.improvement),
    improvement: best.improvement,
    lumosRmse: best.lumosRmse,
    baselineRmse: Number.isFinite(best.baselineRmse) ? best.baselineRmse : null
  };
}

function evidenceMetricsFromScenario(snapshot) {
  const scenario = snapshot?.scenario ?? {};
  const cells = Array.isArray(scenario.cells) ? scenario.cells : [];
  const observations = Array.isArray(scenario.observations) ? scenario.observations : [];
  const uncertainties = cells.map(normalizedCellUncertainty);
  const meanUncertainty = mean(uncertainties, 0.5);
  let riskWeightedNumerator = 0;
  let riskWeightedDenominator = 0;
  let ecologyWeightedNumerator = 0;
  let ecologyWeightedDenominator = 0;
  const highVulnerability = [];
  const lowerVulnerability = [];
  cells.forEach((cell, index) => {
    const uncertainty = uncertainties[index];
    const risk = clamp(finiteNumber(cell?.risk, 0.5));
    const exposure = clamp(finiteNumber(cell?.exposure, 0.5));
    const vulnerability = clamp(finiteNumber(cell?.vulnerability, 0.5));
    const ecology = clamp(finiteNumber(cell?.ecology, 0.5));
    const riskWeight = 0.08 + risk * (0.25 + 0.75 * exposure);
    riskWeightedNumerator += uncertainty * riskWeight;
    riskWeightedDenominator += riskWeight;
    const ecologyWeight = 0.08 + ecology;
    ecologyWeightedNumerator += uncertainty * ecologyWeight;
    ecologyWeightedDenominator += ecologyWeight;
    (vulnerability >= 0.6 ? highVulnerability : lowerVulnerability).push(uncertainty);
  });
  const highVulnerabilityUncertainty = mean(highVulnerability, meanUncertainty);
  const lowerVulnerabilityUncertainty = mean(lowerVulnerability, meanUncertainty);
  const fairnessGap = Math.abs(highVulnerabilityUncertainty - lowerVulnerabilityUncertainty);
  const riskWeightedUncertainty = riskWeightedDenominator > 0 ? riskWeightedNumerator / riskWeightedDenominator : meanUncertainty;
  const ecologyWeightedUncertainty = ecologyWeightedDenominator > 0 ? ecologyWeightedNumerator / ecologyWeightedDenominator : meanUncertainty;
  const meanReliability = mean(observations.map((entry) => finiteNumber(entry?.reliability, NaN)), 0.78);
  const provisionalRatio = observations.length
    ? observations.filter((entry) => (entry?.qualifiers ?? []).includes("P") || entry?.provisional === true).length / observations.length
    : 0;
  const validation = findValidationEvidence(scenario);
  return {
    cellCount: cells.length,
    observationCount: observations.length,
    meanUncertainty: clamp(meanUncertainty),
    riskWeightedUncertainty: clamp(riskWeightedUncertainty),
    ecologyWeightedUncertainty: clamp(ecologyWeightedUncertainty),
    highVulnerabilityUncertainty: clamp(highVulnerabilityUncertainty),
    fairnessGap: clamp(fairnessGap),
    meanReliability: clamp(meanReliability),
    provisionalRatio: clamp(provisionalRatio),
    validation
  };
}

function exactWorkspaceEvidence(snapshot) {
  const evidence = snapshot?.evidence ?? {};
  const metrics = evidence?.networkMetrics ?? evidence?.metrics ?? {};
  return {
    deployedUnits: finiteNumber(evidence.deployedUnits, finiteNumber(snapshot?.controls?.monitorCount, 0)),
    information: finiteNumber(metrics.information, NaN),
    exposure: finiteNumber(metrics.exposure, NaN),
    equity: finiteNumber(metrics.minimumGroupInformation, finiteNumber(metrics.equity, NaN)),
    ecology: finiteNumber(metrics.ecology, NaN),
    intervention: finiteNumber(evidence.interventionReadiness, NaN),
    reliability: finiteNumber(metrics.reliability, finiteNumber(evidence.reliability, NaN)),
    fairnessGap: finiteNumber(metrics.fairnessGap, NaN),
    feasible: evidence.feasible !== false
  };
}

export function createWorkspaceEvidenceRecord(snapshot, { sourceType = "saved-workspace" } = {}) {
  const domainKey = inferDomainKey(snapshot);
  if (!domainKey) throw new Error("The workspace does not identify a public LUMOS domain.");
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const scenarioMetrics = evidenceMetricsFromScenario(snapshot);
  const exact = exactWorkspaceEvidence(snapshot);
  const observationTarget = planning.evidenceCalibration?.observationTarget ?? Math.max(6, planning.minimumUnits * 2);
  const observationSupport = clamp(Math.log1p(scenarioMetrics.observationCount) / Math.log1p(observationTarget));
  const spatialSupport = clamp(Math.log1p(scenarioMetrics.cellCount) / Math.log1p(600));
  const validationSupport = scenarioMetrics.validation.available ? scenarioMetrics.validation.quality : 0.18;
  const qualitySupport = clamp(scenarioMetrics.meanReliability * (1 - 0.45 * scenarioMetrics.provisionalRatio));
  const evidenceStrength = clamp(
    0.34 * observationSupport
    + 0.26 * validationSupport
    + 0.22 * spatialSupport
    + 0.18 * qualitySupport
  );
  const inferredInformation = clamp(1 - scenarioMetrics.meanUncertainty);
  const deployedUnits = Math.max(0, Math.round(exact.deployedUnits));
  const expectedAtUnits = responseCurve(deployedUnits, planning.saturationUnits) * planning.readiness * planning.dimensionPotential.information;
  const realizedInformation = clamp(Number.isFinite(exact.information) ? exact.information : inferredInformation);
  const normalizedYield = deployedUnits > 0
    ? clamp(realizedInformation / Math.max(0.08, expectedAtUnits), 0, 1.75)
    : 1;
  const equityNeed = clamp(
    0.62 * scenarioMetrics.highVulnerabilityUncertainty
    + 0.38 * Math.max(scenarioMetrics.fairnessGap, Number.isFinite(exact.fairnessGap) ? exact.fairnessGap : 0)
  );
  const residualNeed = clamp(
    0.36 * scenarioMetrics.riskWeightedUncertainty
    + 0.24 * scenarioMetrics.meanUncertainty
    + 0.22 * equityNeed
    + 0.18 * scenarioMetrics.ecologyWeightedUncertainty
  );
  const record = {
    schema: DOMAIN_EVIDENCE_SCHEMA,
    sourceType,
    domainKey,
    workspaceId: snapshot?.workspaceId ?? null,
    workspaceName: snapshot?.name ?? snapshot?.scenario?.cityLabel ?? `${DOMAIN_REGISTRY[domainKey].displayName} workspace`,
    savedAt: finiteNumber(snapshot?.savedAt, Date.now()),
    deployedUnits,
    evidenceStrength,
    residualNeed,
    normalizedYield,
    realizedInformation,
    validationQuality: validationSupport,
    validationImprovement: scenarioMetrics.validation.improvement,
    meanReliability: Number.isFinite(exact.reliability) ? clamp(exact.reliability) : scenarioMetrics.meanReliability,
    equityNeed,
    interventionReadiness: Number.isFinite(exact.intervention)
      ? clamp(exact.intervention)
      : clamp(0.55 * planning.readiness + 0.25 * validationSupport + 0.20 * (1 - scenarioMetrics.meanUncertainty)),
    metrics: scenarioMetrics,
    exactNetworkMetrics: exact,
    claimBoundary: "This evidence record summarizes one saved planning workspace. It does not establish causal effects, regulatory compliance, or realized health benefit."
  };
  record.checksum = checksum({ ...record, savedAt: undefined, checksum: undefined });
  return record;
}

function aggregateDomainRecords(domainKey, records) {
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const domainRecords = records.filter((record) => record.domainKey === domainKey);
  if (!domainRecords.length) {
    return {
      domainKey,
      recordCount: 0,
      deployedUnits: 0,
      evidenceStrength: 0,
      residualNeed: planning.evidenceCalibration?.priorResidualNeed ?? 0.62,
      normalizedYield: 1,
      validationQuality: 0.2,
      meanReliability: planning.unitReliability,
      equityNeed: 0.55,
      interventionReadiness: planning.readiness,
      sourceType: "registry-prior"
    };
  }
  const weightedRecords = domainRecords.map((record) => ({
    ...record,
    weight: Math.max(0.05, finiteNumber(record.evidenceStrength, 0.1))
  }));
  const combinedStrength = clamp(1 - weightedRecords.reduce((remaining, record) => remaining * (1 - 0.62 * record.weight), 1));
  const latestUnits = [...domainRecords]
    .sort((left, right) => finiteNumber(right.savedAt, 0) - finiteNumber(left.savedAt, 0))
    .find((record) => Number.isFinite(Number(record.deployedUnits)))?.deployedUnits ?? 0;
  return {
    domainKey,
    recordCount: domainRecords.length,
    deployedUnits: Math.max(0, Math.round(latestUnits)),
    evidenceStrength: combinedStrength,
    residualNeed: clamp(weightedMean(weightedRecords, "residualNeed", "weight", 0.6)),
    normalizedYield: clamp(weightedMean(weightedRecords, "normalizedYield", "weight", 1), 0, 1.75),
    validationQuality: clamp(weightedMean(weightedRecords, "validationQuality", "weight", 0.3)),
    meanReliability: clamp(weightedMean(weightedRecords, "meanReliability", "weight", planning.unitReliability)),
    equityNeed: clamp(weightedMean(weightedRecords, "equityNeed", "weight", 0.55)),
    interventionReadiness: clamp(weightedMean(weightedRecords, "interventionReadiness", "weight", planning.readiness)),
    sourceType: domainRecords.some((record) => record.sourceType === "saved-workspace") ? "saved-workspace" : domainRecords[0].sourceType
  };
}

export function createEvidenceBundle(records = [], { generatedAt = new Date().toISOString(), label = "Workspace evidence" } = {}) {
  const validRecords = records.filter((record) => record?.schema === DOMAIN_EVIDENCE_SCHEMA && PUBLIC_DOMAIN_KEYS.includes(record.domainKey));
  const domains = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, aggregateDomainRecords(domainKey, validRecords)]));
  const bundle = {
    schemaVersion: "1.0",
    architecture: "Evidence-calibrated sequential cross-domain monitoring",
    label,
    generatedAt,
    records: validRecords,
    domains,
    recordCount: validRecords.length,
    evidenceDomainCount: PUBLIC_DOMAIN_KEYS.filter((domainKey) => domains[domainKey].recordCount > 0).length,
    claimBoundary: "Workspace evidence calibrates future planning assumptions; it does not convert modeled information gain into causal, monetary, regulatory, or health outcomes."
  };
  bundle.checksum = checksum({ ...bundle, generatedAt: undefined, checksum: undefined });
  return bundle;
}

export function createIllustrativeEvidenceBundle() {
  const templates = {
    heat: { deployedUnits: 9, evidenceStrength: 0.72, residualNeed: 0.58, normalizedYield: 1.08, validationQuality: 0.78, meanReliability: 0.91, equityNeed: 0.67, interventionReadiness: 0.83 },
    air: { deployedUnits: 5, evidenceStrength: 0.61, residualNeed: 0.74, normalizedYield: 1.16, validationQuality: 0.69, meanReliability: 0.84, equityNeed: 0.72, interventionReadiness: 0.79 },
    soil: { deployedUnits: 22, evidenceStrength: 0.66, residualNeed: 0.46, normalizedYield: 0.88, validationQuality: 0.73, meanReliability: 0.94, equityNeed: 0.52, interventionReadiness: 0.76 },
    water: { deployedUnits: 6, evidenceStrength: 0.57, residualNeed: 0.69, normalizedYield: 1.04, validationQuality: 0.64, meanReliability: 0.87, equityNeed: 0.63, interventionReadiness: 0.82 }
  };
  const records = PUBLIC_DOMAIN_KEYS.map((domainKey) => {
    const template = templates[domainKey];
    const record = {
      schema: DOMAIN_EVIDENCE_SCHEMA,
      sourceType: "illustrative-controlled",
      domainKey,
      workspaceId: `illustrative-${domainKey}`,
      workspaceName: `${DOMAIN_REGISTRY[domainKey].displayName} controlled evidence example`,
      savedAt: 0,
      ...template,
      realizedInformation: clamp(1 - template.residualNeed * 0.58),
      validationImprovement: 0.12,
      metrics: { observationCount: DOMAIN_REGISTRY[domainKey].planning.evidenceCalibration?.observationTarget ?? 10, cellCount: 600 },
      exactNetworkMetrics: {},
      claimBoundary: "Controlled illustrative evidence for interface and reproducibility testing; not an observed public deployment."
    };
    record.checksum = checksum({ ...record, checksum: undefined });
    return record;
  });
  return createEvidenceBundle(records, { generatedAt: "1970-01-01T00:00:00.000Z", label: "Controlled illustrative evidence" });
}

const DEFAULT_PREVIOUS_UNITS = Object.freeze({ heat: 9, air: 5, soil: 22, water: 6 });

export const DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG = Object.freeze({
  nextRoundBudget: 60000,
  reserveFraction: 0.05,
  explorationFraction: 0.15,
  learningRate: 0.65,
  requireAllDomains: true,
  minimumEquity: 0.26,
  minimumReliability: 0.55,
  minimumIntervention: 0.22,
  domains: Object.freeze(Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, Object.freeze({
    enabled: true,
    priority: DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG.domains[domainKey].priority,
    unitCost: DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG.domains[domainKey].unitCost,
    existingUnits: DEFAULT_PREVIOUS_UNITS[domainKey],
    maximumTotalUnits: DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG.domains[domainKey].maximumUnits
  })])))
});

export function normalizeSequentialReallocationConfig(config = {}, evidenceBundle = null) {
  const normalizedBase = normalizeCrossDomainBudgetConfig({
    totalBudget: finiteNumber(config.nextRoundBudget, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.nextRoundBudget),
    reserveFraction: finiteNumber(config.reserveFraction, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.reserveFraction),
    requireAllDomains: config.requireAllDomains !== false,
    domains: Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, {
      enabled: config.domains?.[domainKey]?.enabled !== false,
      priority: config.domains?.[domainKey]?.priority,
      unitCost: config.domains?.[domainKey]?.unitCost,
      minimumUnits: 1,
      maximumUnits: config.domains?.[domainKey]?.maximumTotalUnits ?? DOMAIN_REGISTRY[domainKey].planning.maximumUnits
    }]))
  });
  const domains = {};
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const supplied = config.domains?.[domainKey] ?? {};
    const evidenceUnits = evidenceBundle?.domains?.[domainKey]?.deployedUnits;
    const existingUnits = Math.round(clamp(
      finiteNumber(supplied.existingUnits, finiteNumber(evidenceUnits, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.domains[domainKey].existingUnits)),
      0,
      normalizedBase.domains[domainKey].maximumUnits
    ));
    domains[domainKey] = {
      enabled: normalizedBase.domains[domainKey].enabled,
      priority: normalizedBase.domains[domainKey].priority,
      unitCost: normalizedBase.domains[domainKey].unitCost,
      existingUnits,
      maximumTotalUnits: normalizedBase.domains[domainKey].maximumUnits
    };
  }
  return {
    nextRoundBudget: normalizedBase.totalBudget,
    reserveFraction: normalizedBase.reserveFraction,
    explorationFraction: clamp(finiteNumber(config.explorationFraction, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.explorationFraction), 0, 0.5),
    learningRate: clamp(finiteNumber(config.learningRate, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.learningRate), 0, 1),
    requireAllDomains: normalizedBase.requireAllDomains,
    minimumEquity: clamp(finiteNumber(config.minimumEquity, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.minimumEquity), 0, 1),
    minimumReliability: clamp(finiteNumber(config.minimumReliability, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.minimumReliability), 0, 1),
    minimumIntervention: clamp(finiteNumber(config.minimumIntervention, DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.minimumIntervention), 0, 1),
    domains
  };
}

function calibratedDomainContract(domainKey, evidence, config) {
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const evidenceStrength = clamp(evidence?.evidenceStrength ?? 0);
  const residualNeed = clamp(evidence?.residualNeed ?? planning.evidenceCalibration?.priorResidualNeed ?? 0.6);
  const normalizedYield = clamp(evidence?.normalizedYield ?? 1, 0, 1.75);
  const learningRate = config.learningRate;
  const rawMultiplier = (0.66 + 0.94 * residualNeed) * (0.72 + 0.42 * normalizedYield);
  const marginalMultiplier = clamp(1 + evidenceStrength * learningRate * (rawMultiplier - 1), 0.62, 1.62);
  const calibratedReadiness = clamp(
    planning.readiness * (1 - 0.28 * evidenceStrength)
    + evidenceStrength * (0.46 * (evidence?.validationQuality ?? 0.2) + 0.30 * (evidence?.interventionReadiness ?? planning.readiness) + 0.24 * planning.readiness)
  );
  const calibratedReliability = clamp(
    planning.unitReliability * (1 - evidenceStrength * learningRate)
    + (evidence?.meanReliability ?? planning.unitReliability) * evidenceStrength * learningRate
  );
  return {
    marginalMultiplier,
    calibratedReadiness,
    calibratedReliability,
    evidenceStrength,
    residualNeed,
    normalizedYield,
    equityNeed: clamp(evidence?.equityNeed ?? 0.55),
    explorationNeed: clamp(1 - evidenceStrength)
  };
}

function evaluateSequentialProgram(domainKey, additionalUnits, domainConfig, evidence, config) {
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const contract = calibratedDomainContract(domainKey, evidence, config);
  const existingUnits = domainConfig.existingUnits;
  const totalUnits = existingUnits + additionalUnits;
  const dimensions = {};
  const baselineDimensions = {};
  const incrementalDimensions = {};
  for (const dimension of CROSS_DOMAIN_DIMENSIONS.filter((key) => key !== "reliability")) {
    const scaleMultiplier = planning.dimensionScales[dimension] ?? 1;
    const evidencePotential = dimension === "equity"
      ? 0.82 + 0.36 * contract.equityNeed
      : dimension === "intervention"
        ? 0.78 + 0.30 * (evidence?.interventionReadiness ?? planning.readiness)
        : 0.82 + 0.32 * contract.residualNeed;
    const potential = planning.dimensionPotential[dimension] * contract.calibratedReadiness * evidencePotential;
    const calibratedScale = planning.saturationUnits * scaleMultiplier / contract.marginalMultiplier;
    baselineDimensions[dimension] = clamp(responseCurve(existingUnits, calibratedScale) * potential);
    dimensions[dimension] = clamp(responseCurve(totalUnits, calibratedScale) * potential);
    incrementalDimensions[dimension] = Math.max(0, dimensions[dimension] - baselineDimensions[dimension]);
  }
  const reliabilityAt = (units) => {
    const baseReliability = contract.calibratedReliability * responseCurve(units, planning.saturationUnits * 0.65);
    const redundancyGain = (1 - contract.calibratedReliability)
      * responseCurve(Math.max(0, units - planning.minimumUnits), planning.saturationUnits * 0.75);
    return clamp(baseReliability + redundancyGain);
  };
  baselineDimensions.reliability = reliabilityAt(existingUnits);
  dimensions.reliability = reliabilityAt(totalUnits);
  incrementalDimensions.reliability = Math.max(0, dimensions.reliability - baselineDimensions.reliability);
  const composite = mean(CROSS_DOMAIN_DIMENSIONS.map((dimension) => dimensions[dimension]));
  const incrementalComposite = mean(CROSS_DOMAIN_DIMENSIONS.map((dimension) => incrementalDimensions[dimension]));
  const explorationBonus = config.explorationFraction
    * contract.explorationNeed
    * responseCurve(additionalUnits, Math.max(1, planning.minimumUnits));
  return {
    domainKey,
    existingUnits,
    additionalUnits,
    totalUnits,
    unitLabel: planning.unitLabel,
    unitCost: domainConfig.unitCost,
    addedCost: additionalUnits * domainConfig.unitCost,
    priority: domainConfig.priority,
    dimensions,
    baselineDimensions,
    incrementalDimensions,
    composite,
    incrementalComposite,
    explorationBonus,
    evidence: { ...contract, recordCount: evidence?.recordCount ?? 0, sourceType: evidence?.sourceType ?? "registry-prior" },
    minimumProgramSatisfied: totalUnits >= planning.minimumUnits,
    floorsSatisfied: dimensions.equity >= config.minimumEquity
      && dimensions.reliability >= config.minimumReliability
      && dimensions.intervention >= config.minimumIntervention
  };
}

function aggregateSequentialAllocation(config, evidenceBundle, additionalCounts) {
  const programs = PUBLIC_DOMAIN_KEYS.map((domainKey) => evaluateSequentialProgram(
    domainKey,
    additionalCounts[domainKey] ?? 0,
    config.domains[domainKey],
    evidenceBundle.domains[domainKey],
    config
  ));
  const activePrograms = programs.filter((program) => config.domains[program.domainKey].enabled);
  const priorityTotal = activePrograms.reduce((sum, program) => sum + program.priority, 0) || 1;
  const dimensions = Object.fromEntries(CROSS_DOMAIN_DIMENSIONS.map((dimension) => [
    dimension,
    activePrograms.reduce((sum, program) => sum + program.dimensions[dimension] * program.priority, 0) / priorityTotal
  ]));
  const incrementalDimensions = Object.fromEntries(CROSS_DOMAIN_DIMENSIONS.map((dimension) => [
    dimension,
    activePrograms.reduce((sum, program) => sum + program.incrementalDimensions[dimension] * program.priority, 0) / priorityTotal
  ]));
  const domainBenefits = activePrograms.map((program) => program.composite);
  const addedCost = programs.reduce((sum, program) => sum + program.addedCost, 0);
  const allocatableBudget = Math.floor(config.nextRoundBudget * (1 - config.reserveFraction));
  const uncommitted = Math.max(0, allocatableBudget - addedCost);
  const composite = mean(CROSS_DOMAIN_DIMENSIONS.map((dimension) => dimensions[dimension]));
  const incrementalComposite = mean(CROSS_DOMAIN_DIMENSIONS.map((dimension) => incrementalDimensions[dimension]));
  const explorationBonus = activePrograms.reduce((sum, program) => sum + program.explorationBonus * program.priority, 0) / priorityTotal;
  const hardConstraintsSatisfied = activePrograms.every((program) => program.floorsSatisfied && (!config.requireAllDomains || program.minimumProgramSatisfied));
  return {
    programs,
    dimensions,
    incrementalDimensions,
    composite,
    incrementalComposite,
    explorationBonus,
    worstDomainBenefit: domainBenefits.length ? Math.min(...domainBenefits) : 0,
    balanceGap: domainBenefits.length ? Math.max(...domainBenefits) - Math.min(...domainBenefits) : 0,
    addedCost,
    allocatableBudget,
    statutoryReserve: config.nextRoundBudget - allocatableBudget,
    uncommitted,
    totalUnspent: config.nextRoundBudget - addedCost,
    hardConstraintsSatisfied
  };
}

function scoreSequentialAllocation(metrics, profile) {
  const weightedDimensions = CROSS_DOMAIN_DIMENSIONS.reduce(
    (sum, dimension) => sum + metrics.dimensions[dimension] * (profile.weights[dimension] ?? 0),
    0
  );
  const weightedIncrement = CROSS_DOMAIN_DIMENSIONS.reduce(
    (sum, dimension) => sum + metrics.incrementalDimensions[dimension] * (profile.weights[dimension] ?? 0),
    0
  );
  const reserveRatio = metrics.allocatableBudget > 0 ? metrics.uncommitted / metrics.allocatableBudget : 0;
  const efficiency = metrics.addedCost > 0
    ? clamp(weightedIncrement / Math.max(0.08, metrics.addedCost / Math.max(1, metrics.allocatableBudget)), 0, 1)
    : 0;
  return weightedDimensions
    + 1.25 * weightedIncrement
    + metrics.explorationBonus
    + profile.worstDomainWeight * metrics.worstDomainBenefit
    - profile.balancePenalty * metrics.balanceGap
    + profile.reserveWeight * reserveRatio
    + (profile.efficiencyWeight ?? 0) * efficiency;
}

function choicesForSequentialDomain(config, domainKey) {
  const domain = config.domains[domainKey];
  if (!domain.enabled) return [0];
  const planning = DOMAIN_REGISTRY[domainKey].planning;
  const maximumAdditional = Math.max(0, domain.maximumTotalUnits - domain.existingUnits);
  const requiredAdditional = config.requireAllDomains
    ? Math.max(0, planning.minimumUnits - domain.existingUnits)
    : 0;
  const choices = [];
  for (let units = requiredAdditional; units <= maximumAdditional; units += 1) choices.push(units);
  return choices;
}

function enumerateSequentialAllocations(config, evidenceBundle) {
  const allocatableBudget = Math.floor(config.nextRoundBudget * (1 - config.reserveFraction));
  const choices = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, choicesForSequentialDomain(config, domainKey)]));
  const feasible = [];
  const tested = [];
  const counts = {};
  function visit(index, runningCost) {
    if (index === PUBLIC_DOMAIN_KEYS.length) {
      const metrics = aggregateSequentialAllocation(config, evidenceBundle, counts);
      tested.push(metrics);
      if (metrics.hardConstraintsSatisfied) feasible.push(metrics);
      return;
    }
    const domainKey = PUBLIC_DOMAIN_KEYS[index];
    const unitCost = config.domains[domainKey].unitCost;
    for (const units of choices[domainKey]) {
      const nextCost = runningCost + units * unitCost;
      if (nextCost > allocatableBudget) break;
      counts[domainKey] = units;
      visit(index + 1, nextCost);
    }
  }
  visit(0, 0);
  return { feasible, tested };
}

function minimumRoundCost(config) {
  return PUBLIC_DOMAIN_KEYS.reduce((sum, domainKey) => {
    const domain = config.domains[domainKey];
    if (!domain.enabled || !config.requireAllDomains) return sum;
    const minimumUnits = DOMAIN_REGISTRY[domainKey].planning.minimumUnits;
    return sum + Math.max(0, minimumUnits - domain.existingUnits) * domain.unitCost;
  }, 0);
}

function floorViolation(metrics, config) {
  return metrics.programs.reduce((sum, program) => {
    if (!config.domains[program.domainKey].enabled) return sum;
    const minimumProgramGap = config.requireAllDomains && !program.minimumProgramSatisfied ? 1 : 0;
    return sum
      + minimumProgramGap
      + Math.max(0, config.minimumEquity - program.dimensions.equity)
      + Math.max(0, config.minimumReliability - program.dimensions.reliability)
      + Math.max(0, config.minimumIntervention - program.dimensions.intervention);
  }, 0);
}

function dominates(left, right) {
  const weaklyBetter = left.metrics.incrementalComposite >= right.metrics.incrementalComposite - 1e-12
    && left.metrics.worstDomainBenefit >= right.metrics.worstDomainBenefit - 1e-12
    && left.metrics.dimensions.reliability >= right.metrics.dimensions.reliability - 1e-12
    && left.metrics.addedCost <= right.metrics.addedCost + 1e-9;
  const strictlyBetter = left.metrics.incrementalComposite > right.metrics.incrementalComposite + 1e-12
    || left.metrics.worstDomainBenefit > right.metrics.worstDomainBenefit + 1e-12
    || left.metrics.dimensions.reliability > right.metrics.dimensions.reliability + 1e-12
    || left.metrics.addedCost < right.metrics.addedCost - 1e-9;
  return weaklyBetter && strictlyBetter;
}

function markPareto(portfolio) {
  return portfolio.map((allocation, index) => ({
    ...allocation,
    paretoOptimal: !portfolio.some((other, otherIndex) => otherIndex !== index && dominates(other, allocation))
  }));
}

export function allocateSequentialFundingRound(inputConfig = {}, evidenceInput = null) {
  const evidenceBundle = evidenceInput?.domains ? evidenceInput : createEvidenceBundle(evidenceInput?.records ?? []);
  const config = normalizeSequentialReallocationConfig(inputConfig, evidenceBundle);
  const enabledDomains = PUBLIC_DOMAIN_KEYS.filter((domainKey) => config.domains[domainKey].enabled);
  const allocatableBudget = Math.floor(config.nextRoundBudget * (1 - config.reserveFraction));
  const requiredMinimumCost = minimumRoundCost(config);
  if (!enabledDomains.length) {
    return {
      schema: SEQUENTIAL_REALLOCATION_SCHEMA,
      ready: false,
      reason: "At least one environmental domain must be enabled.",
      config,
      evidenceBundle,
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
      schema: SEQUENTIAL_REALLOCATION_SCHEMA,
      ready: false,
      reason: "The next-round budget cannot complete the required minimum programs from the declared existing network.",
      config,
      evidenceBundle,
      allocatableBudget,
      requiredMinimumCost,
      shortfall: requiredMinimumCost - allocatableBudget,
      portfolio: [],
      evaluatedAllocations: 0,
      checksum: checksum({ config, requiredMinimumCost, allocatableBudget })
    };
  }
  const enumerated = enumerateSequentialAllocations(config, evidenceBundle);
  const candidatePool = enumerated.feasible.length ? enumerated.feasible : enumerated.tested;
  if (!candidatePool.length) {
    return {
      schema: SEQUENTIAL_REALLOCATION_SCHEMA,
      ready: false,
      reason: "No additional-unit combination fits the next-round budget and declared bounds.",
      config,
      evidenceBundle,
      allocatableBudget,
      requiredMinimumCost,
      shortfall: 0,
      portfolio: [],
      evaluatedAllocations: 0,
      checksum: checksum({ config, reason: "no-combinations" })
    };
  }
  const selected = Object.values(CROSS_DOMAIN_ALLOCATION_PROFILES).map((profile) => {
    let best = null;
    let bestScore = -Infinity;
    let bestViolation = Infinity;
    for (const metrics of candidatePool) {
      const violation = floorViolation(metrics, config);
      const score = scoreSequentialAllocation(metrics, profile);
      const better = violation < bestViolation - 1e-12
        || (Math.abs(violation - bestViolation) <= 1e-12 && (score > bestScore + 1e-12
          || (Math.abs(score - bestScore) <= 1e-12 && metrics.addedCost < (best?.addedCost ?? Infinity))));
      if (better) {
        best = metrics;
        bestScore = score;
        bestViolation = violation;
      }
    }
    return {
      profileKey: profile.key,
      profile,
      score: bestScore,
      floorViolation: bestViolation,
      constraintStatus: best?.hardConstraintsSatisfied ? "feasible" : "nearest-infeasible",
      metrics: best
    };
  });
  const result = {
    schema: SEQUENTIAL_REALLOCATION_SCHEMA,
    schemaVersion: "1.0",
    architecture: "Evidence-calibrated sequential cross-domain reallocation",
    generatedAt: new Date().toISOString(),
    ready: true,
    evidenceMode: evidenceBundle.recordCount ? evidenceBundle.label : "Registry-prior only",
    evidenceBundle,
    config,
    allocatableBudget,
    requiredMinimumCost,
    shortfall: 0,
    evaluatedAllocations: enumerated.tested.length,
    feasibleAllocations: enumerated.feasible.length,
    floorsFeasible: enumerated.feasible.length > 0,
    claimBoundary: "The next-round portfolio updates normalized planning curves from saved workspace evidence. It is not online causal learning, a regulatory funding recommendation, or proof that one domain produces greater physical or health benefit than another.",
    portfolio: markPareto(selected)
  };
  result.checksum = checksum({ ...result, generatedAt: undefined, checksum: undefined });
  return result;
}

export function sequentialReallocationRows(result) {
  if (!result?.ready) return [];
  return result.portfolio.flatMap((allocation) => allocation.metrics.programs.map((program) => ({
    checksum: result.checksum,
    evidence_checksum: result.evidenceBundle.checksum,
    profile: allocation.profileKey,
    profile_label: allocation.profile.label,
    pareto_optimal: allocation.paretoOptimal,
    constraint_status: allocation.constraintStatus,
    domain: program.domainKey,
    existing_units: program.existingUnits,
    additional_units: program.additionalUnits,
    total_units: program.totalUnits,
    unit_label: program.unitLabel,
    unit_cost_usd: program.unitCost,
    added_cost_usd: program.addedCost,
    evidence_records: program.evidence.recordCount,
    evidence_source: program.evidence.sourceType,
    evidence_strength: program.evidence.evidenceStrength,
    residual_need: program.evidence.residualNeed,
    normalized_yield: program.evidence.normalizedYield,
    marginal_multiplier: program.evidence.marginalMultiplier,
    normalized_information: program.dimensions.information,
    normalized_equity: program.dimensions.equity,
    normalized_intervention: program.dimensions.intervention,
    normalized_reliability: program.dimensions.reliability,
    incremental_composite: program.incrementalComposite,
    portfolio_score: allocation.score,
    portfolio_added_cost_usd: allocation.metrics.addedCost,
    portfolio_uncommitted_usd: allocation.metrics.uncommitted,
    portfolio_worst_domain_benefit: allocation.metrics.worstDomainBenefit,
    portfolio_balance_gap: allocation.metrics.balanceGap
  })));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToSequentialReallocationCsv(rows) {
  const headers = [
    "checksum", "evidence_checksum", "profile", "profile_label", "pareto_optimal", "constraint_status", "domain",
    "existing_units", "additional_units", "total_units", "unit_label", "unit_cost_usd", "added_cost_usd",
    "evidence_records", "evidence_source", "evidence_strength", "residual_need", "normalized_yield",
    "marginal_multiplier", "normalized_information", "normalized_equity", "normalized_intervention",
    "normalized_reliability", "incremental_composite", "portfolio_score", "portfolio_added_cost_usd",
    "portfolio_uncommitted_usd", "portfolio_worst_domain_benefit", "portfolio_balance_gap"
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}
