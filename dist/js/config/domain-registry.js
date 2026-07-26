import { DOMAINS } from "./domains.js";

const COMPLETE_CAPABILITIES = Object.freeze({
  sharedBayesianDesign: true,
  socialConstraints: true,
  posteriorInference: true,
  lockedValidation: true,
  robustnessAnalysis: true,
  interventionDesign: true,
  evidenceExport: true,
  systematicFallback: true,
  persistence: true,
  publicDataProvenance: true,
  commissioningOperations: true
});

export const DOMAIN_REGISTRY = Object.freeze({
  core: Object.freeze({
    key: "core",
    navLabel: "Unified",
    displayName: "Unified",
    title: "Unified LUMOS sequential program",
    status: "Shared engine + field-campaign operations",
    description: "Audits one socially constrained Bayesian monitoring engine across Heat, Air, Soil, and Water, evaluates robust multi-round funding policies, translates allocations into field-reviewed shared-host plans, and stages inspections, reserve sites, and replacement workflows.",
    public: false,
    releaseVersion: "2.7",
    scenarioTypes: Object.freeze(["synthetic"]),
    nationalScenarioTypes: Object.freeze([]),
    requiredServices: Object.freeze([]),
    primaryField: "Generalized environmental risk",
    inferenceModel: "Shared synthetic continuous-field benchmark",
    transportModel: "Domain-neutral radial covariance",
    fallback: "Deterministic synthetic validation",
    interventionRoles: Object.freeze(["treatment", "control", "boundary", "spillover", "supplemental"]),
    capabilities: Object.freeze({
      sharedBayesianDesign: true,
      socialConstraints: true,
      posteriorInference: true,
      lockedValidation: false,
      robustnessAnalysis: false,
      interventionDesign: false,
      evidenceExport: true,
      systematicFallback: true,
      persistence: true,
      publicDataProvenance: false
    })
  }),
  heat: Object.freeze({
    key: "heat",
    navLabel: "Heat",
    displayName: "Heat",
    title: "Heat monitoring mode",
    status: "Public · nationwide + NYC validation",
    description: DOMAINS.heat.description,
    public: true,
    releaseVersion: "1.0",
    scenarioTypes: Object.freeze(["live-city", "live-national", "synthetic"]),
    nationalScenarioTypes: Object.freeze(["live-national"]),
    requiredServices: Object.freeze(["weather", "census"]),
    primaryField: "Heat risk and apparent temperature",
    inferenceModel: "Weather and land-surface trend + spatial GP residual",
    transportModel: "Continuous surface covariance",
    fallback: "Systematic candidate mesh with explicit modeled/proxy labels",
    interventionRoles: Object.freeze(["treatment", "control", "boundary", "spillover", "supplemental"]),
    planning: Object.freeze({
      unitLabel: "monitor package", unitCost: 3000, minimumUnits: 4, maximumUnits: 24,
      saturationUnits: 10, unitReliability: 0.92, readiness: 0.96,
      dimensionScales: Object.freeze({ information: 1.0, exposure: 0.86, equity: 1.18, ecology: 1.28, intervention: 1.0 }),
      dimensionPotential: Object.freeze({ information: 0.92, exposure: 1.0, equity: 0.96, ecology: 0.72, intervention: 0.82 }),
      evidenceCalibration: Object.freeze({ observationTarget: 20, priorResidualNeed: 0.60, simulationLearningRate: 0.60, residualResponse: 0.88 }),
      robustnessCalibration: Object.freeze({ costScale: 0.90, failureSensitivity: 0.85, environmentalSensitivity: 1.05 }),
      spatialDeployment: Object.freeze({
        minimumSpacingKm: 0.75, sharedInfrastructureShare: 0.24, failureCorrelation: 0.72,
        minimumSuitability: 0.46, minimumAccess: 0.58, minimumPower: 0,
        requiredReviews: Object.freeze(["permission", "access", "safety", "maintenance"]),
        preferredHosts: Object.freeze(["school", "park", "community", "municipal", "transit"]),
        excludedHosts: Object.freeze([])
      }),
      fieldCampaign: Object.freeze({ inspectionPriority: 0.82, reserveReliabilityFloor: 0.70, replacementCriticality: 0.78, conditionalOperationalCredit: 0.78, outcomeReliabilityFloor: 0.68 }),
      commissioning: Object.freeze({ assetClass: "continuous-monitor", permitRequired: true, calibrationRequired: true, chainOfCustodyRequired: false, minimumUptime: 0.85, minimumDataCompleteness: 0.80, calibrationIntervalDays: 180, preventiveMaintenanceDays: 90, commissioningPriority: 0.82, commissioningCost: 650, annualMaintenanceCost: 480, replacementReliabilityFloor: 0.72, replacementMobilizationCost: 350, conditionalCommissioningCredit: 0.78, replacementProtectionCredit: 0.65 })
    }),
    capabilities: COMPLETE_CAPABILITIES
  }),
  air: Object.freeze({
    key: "air",
    navLabel: "Air",
    displayName: "Air",
    title: "Air quality mode",
    status: "Public · wind-aware inference",
    description: DOMAINS.air.description,
    public: true,
    releaseVersion: "1.4",
    scenarioTypes: Object.freeze(["live-national-air", "synthetic"]),
    nationalScenarioTypes: Object.freeze(["live-national-air"]),
    requiredServices: Object.freeze(["weather", "air-quality", "census"]),
    primaryField: "Pollutant-specific air-quality risk",
    inferenceModel: "Atmospheric/source trend + anisotropic GP residual",
    transportModel: "Meteorological downwind anisotropy",
    fallback: "Regional atmospheric prior + systematic candidates when optional monitors or hosts fail",
    interventionRoles: Object.freeze(["treatment", "control", "boundary", "spillover", "background", "collocation"]),
    planning: Object.freeze({
      unitLabel: "calibrated station package", unitCost: 8000, minimumUnits: 3, maximumUnits: 16,
      saturationUnits: 7, unitReliability: 0.88, readiness: 0.93,
      dimensionScales: Object.freeze({ information: 0.82, exposure: 0.9, equity: 1.12, ecology: 1.42, intervention: 0.92 }),
      dimensionPotential: Object.freeze({ information: 1.0, exposure: 0.97, equity: 0.92, ecology: 0.52, intervention: 0.86 }),
      evidenceCalibration: Object.freeze({ observationTarget: 8, priorResidualNeed: 0.68, simulationLearningRate: 0.54, residualResponse: 0.82 }),
      robustnessCalibration: Object.freeze({ costScale: 1.15, failureSensitivity: 1.10, environmentalSensitivity: 1.18 }),
      spatialDeployment: Object.freeze({
        minimumSpacingKm: 1.10, sharedInfrastructureShare: 0.20, failureCorrelation: 0.82,
        minimumSuitability: 0.48, minimumAccess: 0.60, minimumPower: 0.62,
        requiredReviews: Object.freeze(["permission", "access", "power", "safety", "maintenance"]),
        preferredHosts: Object.freeze(["transit", "industrial-edge", "background", "utility", "municipal"]),
        excludedHosts: Object.freeze([])
      }),
      fieldCampaign: Object.freeze({ inspectionPriority: 0.96, reserveReliabilityFloor: 0.78, replacementCriticality: 0.95, conditionalOperationalCredit: 0.66, outcomeReliabilityFloor: 0.78 }),
      commissioning: Object.freeze({ assetClass: "calibrated-station", permitRequired: true, calibrationRequired: true, chainOfCustodyRequired: false, minimumUptime: 0.90, minimumDataCompleteness: 0.85, calibrationIntervalDays: 90, preventiveMaintenanceDays: 60, commissioningPriority: 0.96, commissioningCost: 1800, annualMaintenanceCost: 1500, replacementReliabilityFloor: 0.80, replacementMobilizationCost: 900, conditionalCommissioningCredit: 0.62, replacementProtectionCredit: 0.55 })
    }),
    capabilities: COMPLETE_CAPABILITIES
  }),
  soil: Object.freeze({
    key: "soil",
    navLabel: "Soil",
    displayName: "Soil",
    title: "Soil health mode",
    status: "Public · survey + laboratory inference",
    description: DOMAINS.soil.description,
    public: true,
    releaseVersion: "1.7",
    scenarioTypes: Object.freeze(["live-national-soil", "synthetic"]),
    nationalScenarioTypes: Object.freeze(["live-national-soil"]),
    requiredServices: Object.freeze(["census", "soil-data"]),
    primaryField: "Soil property or laboratory analyte",
    inferenceModel: "SSURGO/source trend + localized GP residual",
    transportModel: "Short-range persistent spatial covariance",
    fallback: "Systematic sample mesh; contaminants remain observation-dependent",
    interventionRoles: Object.freeze(["treatment", "control", "boundary", "supplemental"]),
    planning: Object.freeze({
      unitLabel: "sample + laboratory package", unitCost: 750, minimumUnits: 8, maximumUnits: 40,
      saturationUnits: 18, unitReliability: 0.96, readiness: 0.91,
      dimensionScales: Object.freeze({ information: 1.08, exposure: 1.25, equity: 1.16, ecology: 0.84, intervention: 1.0 }),
      dimensionPotential: Object.freeze({ information: 0.86, exposure: 0.66, equity: 0.82, ecology: 1.0, intervention: 0.9 }),
      evidenceCalibration: Object.freeze({ observationTarget: 12, priorResidualNeed: 0.56, simulationLearningRate: 0.50, residualResponse: 0.76 }),
      robustnessCalibration: Object.freeze({ costScale: 0.78, failureSensitivity: 0.70, environmentalSensitivity: 0.92 }),
      spatialDeployment: Object.freeze({
        minimumSpacingKm: 0.42, sharedInfrastructureShare: 0.14, failureCorrelation: 0.48,
        minimumSuitability: 0.45, minimumAccess: 0.54, minimumPower: 0,
        requiredReviews: Object.freeze(["permission", "access", "safety", "maintenance"]),
        preferredHosts: Object.freeze(["park", "school", "community", "industrial-edge", "watershed-access"]),
        excludedHosts: Object.freeze(["transit"])
      }),
      fieldCampaign: Object.freeze({ inspectionPriority: 0.70, reserveReliabilityFloor: 0.68, replacementCriticality: 0.72, conditionalOperationalCredit: 0.74, outcomeReliabilityFloor: 0.66 }),
      commissioning: Object.freeze({ assetClass: "sample-program", permitRequired: true, calibrationRequired: false, chainOfCustodyRequired: true, minimumUptime: 0, minimumDataCompleteness: 0.90, calibrationIntervalDays: 0, preventiveMaintenanceDays: 180, commissioningPriority: 0.70, commissioningCost: 180, annualMaintenanceCost: 120, replacementReliabilityFloor: 0.68, replacementMobilizationCost: 90, conditionalCommissioningCredit: 0.80, replacementProtectionCredit: 0.75 })
    }),
    capabilities: COMPLETE_CAPABILITIES
  }),
  water: Object.freeze({
    key: "water",
    navLabel: "Water",
    displayName: "Water",
    title: "Water monitoring mode",
    status: "Public · observation-informed flow inference",
    description: DOMAINS.water.description,
    public: true,
    releaseVersion: "1.9",
    scenarioTypes: Object.freeze(["live-national-water", "synthetic"]),
    nationalScenarioTypes: Object.freeze(["live-national-water"]),
    requiredServices: Object.freeze(["weather", "census", "water-observations"]),
    primaryField: "Indicator-specific water-quality risk",
    inferenceModel: "Source/flow trend + directional GP residual",
    transportModel: "Flow-axis and branch-aware covariance approximation",
    fallback: "Systematic sampling mesh + explicitly labeled geometric flow proxy",
    interventionRoles: Object.freeze(["treatment", "control", "upstream", "downstream", "supplemental"]),
    planning: Object.freeze({
      unitLabel: "station or sampling package", unitCost: 5000, minimumUnits: 4, maximumUnits: 20,
      saturationUnits: 9, unitReliability: 0.90, readiness: 0.92,
      dimensionScales: Object.freeze({ information: 0.92, exposure: 1.05, equity: 1.14, ecology: 0.9, intervention: 0.96 }),
      dimensionPotential: Object.freeze({ information: 0.96, exposure: 0.86, equity: 0.88, ecology: 0.96, intervention: 1.0 }),
      evidenceCalibration: Object.freeze({ observationTarget: 10, priorResidualNeed: 0.66, simulationLearningRate: 0.56, residualResponse: 0.84 }),
      robustnessCalibration: Object.freeze({ costScale: 1.05, failureSensitivity: 1.00, environmentalSensitivity: 1.12 }),
      spatialDeployment: Object.freeze({
        minimumSpacingKm: 0.90, sharedInfrastructureShare: 0.22, failureCorrelation: 0.68,
        minimumSuitability: 0.46, minimumAccess: 0.56, minimumPower: 0,
        requiredReviews: Object.freeze(["permission", "access", "safety", "maintenance"]),
        preferredHosts: Object.freeze(["treatment", "watershed-access", "utility", "background", "municipal"]),
        excludedHosts: Object.freeze(["transit"])
      }),
      fieldCampaign: Object.freeze({ inspectionPriority: 0.90, reserveReliabilityFloor: 0.74, replacementCriticality: 0.90, conditionalOperationalCredit: 0.69, outcomeReliabilityFloor: 0.74 }),
      commissioning: Object.freeze({ assetClass: "water-station-or-sampling-program", permitRequired: true, calibrationRequired: true, chainOfCustodyRequired: false, minimumUptime: 0.88, minimumDataCompleteness: 0.82, calibrationIntervalDays: 120, preventiveMaintenanceDays: 75, commissioningPriority: 0.90, commissioningCost: 1200, annualMaintenanceCost: 900, replacementReliabilityFloor: 0.76, replacementMobilizationCost: 650, conditionalCommissioningCredit: 0.68, replacementProtectionCredit: 0.60 })
    }),
    capabilities: COMPLETE_CAPABILITIES
  })
});

export const DOMAIN_KEYS = Object.freeze(Object.keys(DOMAIN_REGISTRY));
export const PUBLIC_DOMAIN_KEYS = Object.freeze(DOMAIN_KEYS.filter((key) => DOMAIN_REGISTRY[key].public));
export const PUBLIC_DOMAIN_ENTRIES = Object.freeze(PUBLIC_DOMAIN_KEYS.map((key) => DOMAIN_REGISTRY[key]));
export const REQUIRED_PUBLIC_CAPABILITIES = Object.freeze(Object.keys(COMPLETE_CAPABILITIES));

export function normalizeDomainKey(domainKey, fallback = "core") {
  return DOMAIN_REGISTRY[domainKey] ? domainKey : fallback;
}

export function isPublicDomain(domainKey) {
  return Boolean(DOMAIN_REGISTRY[domainKey]?.public);
}

export function publicDomainOrHeat(domainKey) {
  return isPublicDomain(domainKey) ? domainKey : "heat";
}

export function domainDisplayName(domainKey) {
  return DOMAIN_REGISTRY[normalizeDomainKey(domainKey)]?.displayName ?? "Unified";
}

export function domainNavigationLabel(domainKey) {
  return DOMAIN_REGISTRY[normalizeDomainKey(domainKey)]?.navLabel ?? "Unified";
}

export function domainScenarioTypes(domainKey) {
  return DOMAIN_REGISTRY[normalizeDomainKey(domainKey)]?.scenarioTypes ?? [];
}

export function isNationalScenarioType(domainKey, scenarioType) {
  return DOMAIN_REGISTRY[normalizeDomainKey(domainKey)]?.nationalScenarioTypes.includes(scenarioType) ?? false;
}

export function domainHasCapability(domainKey, capability) {
  return Boolean(DOMAIN_REGISTRY[normalizeDomainKey(domainKey)]?.capabilities?.[capability]);
}
