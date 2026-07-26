import { DOMAINS } from "../config/domains.js";
import {
  DOMAIN_REGISTRY,
  PUBLIC_DOMAIN_KEYS,
  REQUIRED_PUBLIC_CAPABILITIES
} from "../config/domain-registry.js";
import {
  AIR_PRESETS,
  HEAT_PRESETS,
  SOIL_PRESETS,
  WATER_PRESETS,
  onboardingStepsForDomain
} from "./onboarding.js";
import { RELEASE_REMOTE_CHECKS } from "./health.js";

const REQUIRED_WEIGHTS = Object.freeze([
  "information", "risk", "exposure", "equity", "community",
  "ecology", "reliability", "redundancy", "fairness", "cost"
]);

const PRESETS_BY_DOMAIN = Object.freeze({
  heat: HEAT_PRESETS,
  air: AIR_PRESETS,
  soil: SOIL_PRESETS,
  water: WATER_PRESETS
});

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

function auditCheck({ id, domainKey = "shared", category, label, satisfied, detail, severity = "fail" }) {
  return {
    id,
    domainKey,
    category,
    label,
    status: satisfied ? "pass" : severity,
    detail
  };
}

function countStatuses(checks) {
  return checks.reduce((counts, check) => {
    counts[check.status] = (counts[check.status] ?? 0) + 1;
    return counts;
  }, { pass: 0, warn: 0, fail: 0 });
}

function auditDomain(domainKey) {
  const registry = DOMAIN_REGISTRY[domainKey];
  const model = DOMAINS[domainKey];
  const presets = Object.values(PRESETS_BY_DOMAIN[domainKey] ?? {});
  const onboarding = onboardingStepsForDomain(domainKey);
  const checks = [];

  checks.push(auditCheck({
    id: `${domainKey}-model`, domainKey, category: "model",
    label: "Shared model configuration",
    satisfied: Boolean(model?.kernel && Number.isFinite(model?.gpLengthScale)),
    detail: model ? `${model.kernel} kernel with declared GP scale.` : "No shared domain model configuration was found."
  }));

  const missingWeights = REQUIRED_WEIGHTS.filter((key) => !Number.isFinite(model?.weights?.[key]));
  checks.push(auditCheck({
    id: `${domainKey}-objectives`, domainKey, category: "model",
    label: "Complete objective vector",
    satisfied: missingWeights.length === 0,
    detail: missingWeights.length ? `Missing finite weights: ${missingWeights.join(", ")}.` : `${REQUIRED_WEIGHTS.length} shared objective terms are configured.`
  }));

  const missingCapabilities = REQUIRED_PUBLIC_CAPABILITIES.filter((key) => !registry?.capabilities?.[key]);
  checks.push(auditCheck({
    id: `${domainKey}-capabilities`, domainKey, category: "capabilities",
    label: "Public scientific workflow",
    satisfied: missingCapabilities.length === 0,
    detail: missingCapabilities.length ? `Missing declared capabilities: ${missingCapabilities.join(", ")}.` : `${REQUIRED_PUBLIC_CAPABILITIES.length} required workflow capabilities are declared.`
  }));

  const planning = registry?.planning;
  const planningDimensions = ["information", "exposure", "equity", "ecology", "intervention"];
  const planningValid = Boolean(
    planning
    && planning.unitLabel
    && Number.isFinite(planning.unitCost)
    && Number.isFinite(planning.minimumUnits)
    && Number.isFinite(planning.maximumUnits)
    && planning.maximumUnits >= planning.minimumUnits
    && Number.isFinite(planning.saturationUnits)
    && Number.isFinite(planning.unitReliability)
    && Number.isFinite(planning.readiness)
    && planningDimensions.every((dimension) => Number.isFinite(planning.dimensionScales?.[dimension]))
    && planningDimensions.every((dimension) => Number.isFinite(planning.dimensionPotential?.[dimension]))
  );
  checks.push(auditCheck({
    id: `${domainKey}-budget-contract`, domainKey, category: "allocation",
    label: "Cross-domain budget contract",
    satisfied: planningValid,
    detail: planningValid
      ? `${planning.unitLabel}: $${planning.unitCost.toLocaleString()} per planning unit; ${planning.minimumUnits}-${planning.maximumUnits} units; normalized diminishing-return curve declared.`
      : "A complete cost, minimum-program, reliability, readiness, and normalized-benefit contract is required."
  }));

  const evidenceCalibrationValid = Boolean(
    planning?.evidenceCalibration
    && Number.isFinite(planning.evidenceCalibration.observationTarget)
    && planning.evidenceCalibration.observationTarget > 0
    && Number.isFinite(planning.evidenceCalibration.priorResidualNeed)
    && planning.evidenceCalibration.priorResidualNeed >= 0
    && planning.evidenceCalibration.priorResidualNeed <= 1
  );
  checks.push(auditCheck({
    id: `${domainKey}-evidence-calibration`, domainKey, category: "sequential",
    label: "Sequential evidence-calibration contract",
    satisfied: evidenceCalibrationValid,
    detail: evidenceCalibrationValid
      ? `${planning.evidenceCalibration.observationTarget} observations target full support; prior residual need ${(100 * planning.evidenceCalibration.priorResidualNeed).toFixed(0)}%.`
      : "Observation support and prior residual-need assumptions are required for sequential reallocation."
  }));

  const simulationTransitionValid = Boolean(
    planning?.evidenceCalibration
    && Number.isFinite(planning.evidenceCalibration.simulationLearningRate)
    && planning.evidenceCalibration.simulationLearningRate >= 0
    && planning.evidenceCalibration.simulationLearningRate <= 1
    && Number.isFinite(planning.evidenceCalibration.residualResponse)
    && planning.evidenceCalibration.residualResponse >= 0
    && planning.evidenceCalibration.residualResponse <= 1
  );
  checks.push(auditCheck({
    id: `${domainKey}-simulation-transition`, domainKey, category: "adaptive",
    label: "Multi-round evidence-transition contract",
    satisfied: simulationTransitionValid,
    detail: simulationTransitionValid
      ? `Learning rate ${planning.evidenceCalibration.simulationLearningRate.toFixed(2)}; residual response ${planning.evidenceCalibration.residualResponse.toFixed(2)}.`
      : "A bounded domain-specific learning rate and residual-response assumption are required for multi-round simulation."
  }));

  const robustnessCalibrationValid = Boolean(
    planning?.robustnessCalibration
    && Number.isFinite(planning.robustnessCalibration.costScale)
    && planning.robustnessCalibration.costScale > 0
    && Number.isFinite(planning.robustnessCalibration.failureSensitivity)
    && planning.robustnessCalibration.failureSensitivity > 0
    && Number.isFinite(planning.robustnessCalibration.environmentalSensitivity)
    && planning.robustnessCalibration.environmentalSensitivity > 0
  );
  checks.push(auditCheck({
    id: `${domainKey}-trajectory-uncertainty`, domainKey, category: "robust-policy",
    label: "Trajectory-uncertainty calibration contract",
    satisfied: robustnessCalibrationValid,
    detail: robustnessCalibrationValid
      ? `Cost scale ${planning.robustnessCalibration.costScale.toFixed(2)}; failure sensitivity ${planning.robustnessCalibration.failureSensitivity.toFixed(2)}; environmental sensitivity ${planning.robustnessCalibration.environmentalSensitivity.toFixed(2)}.`
      : "Positive domain-specific cost, failure, and environmental uncertainty scales are required for robust policy evaluation."
  }));

  const spatialDeployment = planning?.spatialDeployment;
  const spatialDeploymentValid = Boolean(
    spatialDeployment
    && Number.isFinite(spatialDeployment.minimumSpacingKm)
    && spatialDeployment.minimumSpacingKm > 0
    && Number.isFinite(spatialDeployment.sharedInfrastructureShare)
    && spatialDeployment.sharedInfrastructureShare >= 0
    && spatialDeployment.sharedInfrastructureShare <= 1
    && Number.isFinite(spatialDeployment.failureCorrelation)
    && spatialDeployment.failureCorrelation >= 0
    && spatialDeployment.failureCorrelation <= 1
    && Number.isFinite(spatialDeployment.minimumSuitability)
    && Number.isFinite(spatialDeployment.minimumAccess)
    && Number.isFinite(spatialDeployment.minimumPower)
    && Array.isArray(spatialDeployment.requiredReviews)
    && spatialDeployment.requiredReviews.includes("permission")
    && spatialDeployment.requiredReviews.includes("access")
    && spatialDeployment.requiredReviews.includes("safety")
    && Array.isArray(spatialDeployment.preferredHosts)
    && Array.isArray(spatialDeployment.excludedHosts)
  );
  checks.push(auditCheck({
    id: `${domainKey}-spatial-deployment`, domainKey, category: "spatial-deployment",
    label: "Domain-specific spatial deployment contract",
    satisfied: spatialDeploymentValid,
    detail: spatialDeploymentValid
      ? `${spatialDeployment.minimumSpacingKm.toFixed(2)} km spacing; ${(100 * spatialDeployment.sharedInfrastructureShare).toFixed(0)}% shareable infrastructure; ${(100 * spatialDeployment.failureCorrelation).toFixed(0)}% co-location failure sensitivity.`
      : "Spacing, shared-infrastructure, correlated-failure, feasibility, and host-preference assumptions are required."
  }));

  const fieldCampaign = planning?.fieldCampaign;
  const fieldCampaignValid = Boolean(
    fieldCampaign
    && Number.isFinite(fieldCampaign.inspectionPriority)
    && fieldCampaign.inspectionPriority >= 0
    && fieldCampaign.inspectionPriority <= 1
    && Number.isFinite(fieldCampaign.reserveReliabilityFloor)
    && fieldCampaign.reserveReliabilityFloor >= 0
    && fieldCampaign.reserveReliabilityFloor <= 1
    && Number.isFinite(fieldCampaign.replacementCriticality)
    && fieldCampaign.replacementCriticality >= 0
    && fieldCampaign.replacementCriticality <= 1
  );
  checks.push(auditCheck({
    id: `${domainKey}-field-campaign`, domainKey, category: "field-campaign",
    label: "Inspection and reserve-site contract",
    satisfied: fieldCampaignValid,
    detail: fieldCampaignValid
      ? `Inspection priority ${fieldCampaign.inspectionPriority.toFixed(2)}; reserve reliability floor ${fieldCampaign.reserveReliabilityFloor.toFixed(2)}; replacement criticality ${fieldCampaign.replacementCriticality.toFixed(2)}.`
      : "Each domain must declare bounded inspection priority, reserve reliability, and replacement criticality assumptions."
  }));

  const liveCampaignValid = Boolean(
    fieldCampaign
    && Number.isFinite(fieldCampaign.conditionalOperationalCredit)
    && fieldCampaign.conditionalOperationalCredit >= 0
    && fieldCampaign.conditionalOperationalCredit <= 1
    && Number.isFinite(fieldCampaign.outcomeReliabilityFloor)
    && fieldCampaign.outcomeReliabilityFloor >= 0
    && fieldCampaign.outcomeReliabilityFloor <= 1
  );
  checks.push(auditCheck({
    id: `${domainKey}-live-campaign`, domainKey, category: "live-campaign",
    label: "Live outcome and adaptive replacement contract",
    satisfied: liveCampaignValid,
    detail: liveCampaignValid
      ? `Conditional operational credit ${fieldCampaign.conditionalOperationalCredit.toFixed(2)}; live-outcome reliability floor ${fieldCampaign.outcomeReliabilityFloor.toFixed(2)}.`
      : "Each domain must declare bounded conditional-operation and live-outcome reliability assumptions."
  }));

  const commissioning = planning?.commissioning;
  const commissioningValid = Boolean(
    commissioning
    && commissioning.assetClass
    && typeof commissioning.permitRequired === "boolean"
    && typeof commissioning.calibrationRequired === "boolean"
    && typeof commissioning.chainOfCustodyRequired === "boolean"
    && Number.isFinite(commissioning.minimumUptime)
    && commissioning.minimumUptime >= 0
    && commissioning.minimumUptime <= 1
    && Number.isFinite(commissioning.minimumDataCompleteness)
    && commissioning.minimumDataCompleteness >= 0
    && commissioning.minimumDataCompleteness <= 1
    && Number.isFinite(commissioning.commissioningPriority)
    && commissioning.commissioningPriority >= 0
    && commissioning.commissioningPriority <= 1
    && Number.isFinite(commissioning.commissioningCost)
    && commissioning.commissioningCost >= 0
    && Number.isFinite(commissioning.annualMaintenanceCost)
    && commissioning.annualMaintenanceCost >= 0
    && Number.isFinite(commissioning.replacementReliabilityFloor)
    && commissioning.replacementReliabilityFloor >= 0
    && commissioning.replacementReliabilityFloor <= 1
    && Number.isFinite(commissioning.conditionalCommissioningCredit)
    && commissioning.conditionalCommissioningCredit >= 0
    && commissioning.conditionalCommissioningCredit <= 1
  );
  checks.push(auditCheck({
    id: `${domainKey}-commissioning-operations`, domainKey, category: "commissioning",
    label: "Commissioning, calibration, maintenance, and asset-replacement contract",
    satisfied: commissioningValid,
    detail: commissioningValid
      ? `${commissioning.assetClass}; ${(100 * commissioning.minimumDataCompleteness).toFixed(0)}% data-completeness floor; ${(100 * commissioning.replacementReliabilityFloor).toFixed(0)}% replacement reliability floor.`
      : "Each domain must declare bounded commissioning, data-quality, maintenance-cost, and replacement assumptions."
  }));

  checks.push(auditCheck({
    id: `${domainKey}-scenarios`, domainKey, category: "adapter",
    label: "Domain scenario contract",
    satisfied: registry?.scenarioTypes?.length >= 2 && registry?.nationalScenarioTypes?.length >= 1,
    detail: registry?.scenarioTypes?.length ? registry.scenarioTypes.join(", ") : "No scenario types declared."
  }));

  const presetDomainsValid = presets.length >= 4 && presets.every((preset) => preset.domain === domainKey);
  checks.push(auditCheck({
    id: `${domainKey}-presets`, domainKey, category: "interface",
    label: "Public case-study presets",
    satisfied: presetDomainsValid,
    detail: `${presets.length} domain-matched preset${presets.length === 1 ? "" : "s"} registered.`
  }));

  const onboardingIds = onboarding.map((step) => step.id);
  const onboardingValid = onboarding.length >= 6 && new Set(onboardingIds).size === onboardingIds.length;
  checks.push(auditCheck({
    id: `${domainKey}-onboarding`, domainKey, category: "interface",
    label: "Domain-aware onboarding",
    satisfied: onboardingValid,
    detail: `${onboarding.length} ordered walkthrough steps with ${new Set(onboardingIds).size} unique identifiers.`
  }));

  const missingServices = (registry?.requiredServices ?? []).filter((serviceId) => {
    const service = RELEASE_REMOTE_CHECKS.find((entry) => entry.id === serviceId);
    return !service || !service.requiredFor.includes(domainKey);
  });
  checks.push(auditCheck({
    id: `${domainKey}-health`, domainKey, category: "release",
    label: "Required-source health coverage",
    satisfied: missingServices.length === 0 && registry?.requiredServices?.length > 0,
    detail: missingServices.length ? `Health checks do not require: ${missingServices.join(", ")}.` : `${registry.requiredServices.length} required services are domain-scoped.`
  }));

  checks.push(auditCheck({
    id: `${domainKey}-fallback`, domainKey, category: "reliability",
    label: "Explicit scientific fallback",
    satisfied: Boolean(registry?.fallback && registry?.capabilities?.systematicFallback),
    detail: registry?.fallback ?? "No fallback declared."
  }));

  checks.push(auditCheck({
    id: `${domainKey}-intervention`, domainKey, category: "intervention",
    label: "Pre/post-intervention roles",
    satisfied: registry?.interventionRoles?.includes("treatment") && registry?.interventionRoles?.includes("control") && registry.interventionRoles.length >= 4,
    detail: registry?.interventionRoles?.join(", ") ?? "No intervention roles declared."
  }));

  checks.push(auditCheck({
    id: `${domainKey}-claims`, domainKey, category: "claims",
    label: "Field and transport claim boundary",
    satisfied: Boolean(registry?.primaryField && registry?.inferenceModel && registry?.transportModel),
    detail: `${registry?.inferenceModel ?? "Missing inference model"}; ${registry?.transportModel ?? "missing transport model"}.`
  }));

  const counts = countStatuses(checks);
  return {
    domainKey,
    label: registry.displayName,
    releaseVersion: registry.releaseVersion,
    ready: counts.fail === 0,
    counts,
    checks
  };
}

export function runCrossDomainConsistencyAudit({ releaseMetadata = null } = {}) {
  const domains = PUBLIC_DOMAIN_KEYS.map(auditDomain);
  const checks = domains.flatMap((domain) => domain.checks);
  const sharedChecks = [];

  const configuredPublicKeys = Object.keys(DOMAINS).filter((key) => key !== "core");
  sharedChecks.push(auditCheck({
    id: "shared-domain-parity", category: "architecture", label: "Registry/model domain parity",
    satisfied: JSON.stringify([...PUBLIC_DOMAIN_KEYS].sort()) === JSON.stringify(configuredPublicKeys.sort()),
    detail: `Registry: ${PUBLIC_DOMAIN_KEYS.join(", ")}; model configs: ${configuredPublicKeys.join(", ")}.`
  }));

  sharedChecks.push(auditCheck({
    id: "shared-release-parity", category: "release", label: "Release metadata domain parity",
    satisfied: !releaseMetadata || PUBLIC_DOMAIN_KEYS.every((key) => releaseMetadata.supportedDomains?.includes(key)),
    detail: releaseMetadata ? `Release supports ${(releaseMetadata.supportedDomains ?? []).join(", ")}.` : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-budget-allocator", category: "allocation", label: "Unified budget-allocation release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.budgetAllocator === "js/model/unified/budget-allocation.js",
    detail: releaseMetadata
      ? `Allocator: ${releaseMetadata.architecture?.budgetAllocator ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-sequential-reallocator", category: "sequential", label: "Sequential evidence-reallocation release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.sequentialReallocator === "js/model/unified/sequential-reallocation.js",
    detail: releaseMetadata
      ? `Sequential reallocator: ${releaseMetadata.architecture?.sequentialReallocator ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-adaptive-simulator", category: "adaptive", label: "Multi-round adaptive-simulation release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.adaptiveProgramSimulator === "js/model/unified/adaptive-program-simulation.js",
    detail: releaseMetadata
      ? `Adaptive simulator: ${releaseMetadata.architecture?.adaptiveProgramSimulator ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-robust-policy-ensemble", category: "robust-policy", label: "Trajectory-uncertainty ensemble release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.robustPolicyEvaluator === "js/model/unified/robust-policy-ensemble.js",
    detail: releaseMetadata
      ? `Robust evaluator: ${releaseMetadata.architecture?.robustPolicyEvaluator ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-spatial-deployment", category: "spatial-deployment", label: "Spatially coupled deployment release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.spatialDeploymentPlanner === "js/model/unified/spatial-deployment.js",
    detail: releaseMetadata
      ? `Spatial planner: ${releaseMetadata.architecture?.spatialDeploymentPlanner ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-host-inventory-review", category: "field-feasibility", label: "Verified-host ingestion release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.hostInventoryReviewer === "js/model/unified/host-inventory.js",
    detail: releaseMetadata
      ? `Host inventory reviewer: ${releaseMetadata.architecture?.hostInventoryReviewer ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-field-campaign-operations", category: "field-campaign", label: "Field-campaign and reserve-site release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.fieldCampaignPlanner === "js/model/unified/field-campaign.js",
    detail: releaseMetadata
      ? `Field-campaign planner: ${releaseMetadata.architecture?.fieldCampaignPlanner ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-live-campaign-tracking", category: "live-campaign", label: "Live campaign tracking release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.liveCampaignTracker === "js/model/unified/campaign-tracking.js",
    detail: releaseMetadata
      ? `Live campaign tracker: ${releaseMetadata.architecture?.liveCampaignTracker ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-commissioning-operations", category: "commissioning", label: "Commissioning and maintenance release contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.commissioningOperations === "js/model/unified/commissioning-operations.js",
    detail: releaseMetadata
      ? `Commissioning operations: ${releaseMetadata.architecture?.commissioningOperations ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-release-quality", category: "release", label: "Internal release-quality contract",
    satisfied: !releaseMetadata || releaseMetadata.architecture?.publicReadinessAuditor === "js/release/public-readiness.js",
    detail: releaseMetadata
      ? `Internal release-quality auditor: ${releaseMetadata.architecture?.publicReadinessAuditor ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-stable-v3-status", category: "release", label: "Stable public v3 release status",
    satisfied: !releaseMetadata || releaseMetadata.status === "stable-public-v3",
    detail: releaseMetadata
      ? `Release status: ${releaseMetadata.status ?? "not declared"}.`
      : "Release metadata was not supplied to this browser audit.",
    severity: releaseMetadata ? "fail" : "warn"
  }));

  sharedChecks.push(auditCheck({
    id: "shared-research-positioning", category: "research", label: "Research positioning",
    satisfied: true,
    detail: "The audit treats Bayesian placement, validation, robustness, and intervention methods as established components; LUMOS contributes their socially constrained cross-domain integration."
  }));

  checks.unshift(...sharedChecks);
  const counts = countStatuses(checks);
  const result = {
    schemaVersion: "1.0",
    architecture: "Socially Constrained Sequential Bayesian Environmental Monitoring Design",
    generatedAt: new Date().toISOString(),
    publicDomains: [...PUBLIC_DOMAIN_KEYS],
    domains,
    checks,
    counts,
    ready: counts.fail === 0
  };
  result.checksum = checksum({ ...result, generatedAt: undefined, checksum: undefined });
  return result;
}

export function crossDomainAuditRows(audit) {
  return audit.checks.map((check) => ({
    architecture: audit.architecture,
    checksum: audit.checksum,
    domain: check.domainKey,
    category: check.category,
    check_id: check.id,
    label: check.label,
    status: check.status,
    detail: check.detail
  }));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCrossDomainAuditCsv(rows) {
  const headers = ["architecture", "checksum", "domain", "category", "check_id", "label", "status", "detail"];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}
