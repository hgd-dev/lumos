import { DOMAINS, WEIGHT_LABELS } from "./config/domains.js";
import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_ENTRIES, domainDisplayName, isNationalScenarioType, isPublicDomain } from "./config/domain-registry.js";
import { loadScenario as loadScenarioData } from "./data/scenarios.js";
import { applyHeatScenario } from "./data/heat/nyc.js";
import {
  applyForecastFrame,
  applyLiveSnapshot,
  compareLiveToPlanningSnapshot,
  fetchCurrentHeatSnapshot,
  fetchHeatForecast,
  initializeLiveFields,
  summarizeLiveConditions
} from "./data/heat/live.js";
import {
  applyNationalHeatIntervention,
  enrichNationalHeatCandidateHosts,
  estimateNationalHeatWorkload,
  loadNationalHeatScenario
} from "./data/heat/national.js";
import { optimizeNetwork } from "./model/optimizer.js";
import { AIR_POLLUTANTS, applyNationalAirIntervention, enrichAirCandidateRoles, loadNationalAirScenario } from "./data/air/national.js";
import { SOIL_PROPERTIES, SOIL_DEPTHS, applyNationalSoilIntervention, enrichNationalSoilCandidateHosts, loadNationalSoilScenario } from "./data/soil/national.js";
import { WATER_INDICATORS, WATER_SYSTEMS, applyNationalWaterIntervention, enrichNationalWaterCandidateHosts, enrichWaterCandidateRoles, loadNationalWaterScenario } from "./data/water/national.js";
import { designSoilInterventionNetwork } from "./model/soil/intervention.js";
import { designWaterInterventionNetwork } from "./model/water/intervention.js";
import { rowsToWaterSensitivityCsv, runWaterSensitivityAnalysis } from "./model/water/sensitivity.js";
import { buildCurrentWaterPaperBundle, rowsToWaterPaperCsv, waterPaperRows } from "./model/water/paper-runner.js";
import { rowsToWaterEvidenceCsv, runNationalWaterEvidenceSuite, waterEvidenceRows } from "./model/water/evidence-runner.js";
import {
  SOIL_LAB_ANALYTES,
  attachSoilInference,
  parseSoilLabText,
  soilLabTemplateCsv
} from "./model/soil/inference.js";
import { rowsToSoilSensitivityCsv, runSoilSensitivityAnalysis } from "./model/soil/sensitivity.js";
import { buildCurrentSoilPaperBundle, rowsToSoilPaperCsv, soilPaperRows } from "./model/soil/paper-runner.js";
import { rowsToSoilEvidenceCsv, runNationalSoilEvidenceSuite, soilEvidenceRows } from "./model/soil/evidence-runner.js";
import { designAirInterventionNetwork } from "./model/air/intervention.js";
import { attachAirInference, evaluateAirTransportRegimes, runAirValidationExperiment } from "./model/air/inference.js";
import { buildAirPaperRows, rowsToAirCsv, runAirSensitivityAnalysis } from "./model/air/sensitivity.js";
import { airPaperRows, buildCurrentAirPaperBundle, rowsToAirPaperCsv, runNationalAirPaperSuite } from "./model/air/paper-runner.js";
import { attachHeatInference, calibrateHeatModel } from "./model/heat/inference.js";
import {
  createHeatExperimentPackage,
  createLockedHeatSplit,
  runLockedHeatExperiment
} from "./model/heat/experiments.js";
import { designHeatInterventionNetwork } from "./model/heat/intervention.js";
import {
  buildNationalCaseStudyPackage,
  nationalCaseStudyRows,
  rowsToNationalCaseStudyCsv
} from "./model/heat/national-report.js";
import {
  buildHeatPaperRows,
  rowsToCsv,
  runHeatSensitivityAnalysis
} from "./model/heat/sensitivity.js";
import {
  PAPER_CASE_STUDIES,
  buildCurrentWorkspacePaperBundle,
  paperSuiteRows,
  rowsToPaperSuiteCsv,
  runNationalPaperSuite
} from "./model/heat/paper-runner.js";
import { LumosMap } from "./map.js";
import { AIR_PRESETS, HEAT_PRESETS, SOIL_PRESETS, WATER_PRESETS, onboardingStepsForDomain, presetForDomain, clampOnboardingStep } from "./release/onboarding.js";
import { runReleaseHealthCheck } from "./release/health.js";
import { crossDomainAuditRows, rowsToCrossDomainAuditCsv, runCrossDomainConsistencyAudit } from "./release/domain-audit.js";
import { DEFAULT_DOCUMENTATION_PAGE, DOCUMENTATION_ORDER, DOCUMENTATION_PAGES } from "./release/documentation.js";
import {
  DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG,
  allocateCrossDomainBudget,
  crossDomainAllocationRows,
  normalizeCrossDomainBudgetConfig,
  rowsToCrossDomainAllocationCsv
} from "./model/unified/budget-allocation.js";
import {
  DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG,
  allocateSequentialFundingRound,
  createEvidenceBundle,
  createIllustrativeEvidenceBundle,
  createWorkspaceEvidenceRecord,
  normalizeSequentialReallocationConfig,
  rowsToSequentialReallocationCsv,
  sequentialReallocationRows
} from "./model/unified/sequential-reallocation.js";
import {
  DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG,
  adaptiveProgramSimulationRows,
  normalizeAdaptiveProgramSimulationConfig,
  rowsToAdaptiveProgramSimulationCsv,
  simulateAdaptiveProgram
} from "./model/unified/adaptive-program-simulation.js";
import {
  DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG,
  evaluateRobustPolicies,
  normalizeRobustPolicyEnsembleConfig,
  robustPolicyEnsembleRows,
  rowsToRobustPolicyEnsembleCsv
} from "./model/unified/robust-policy-ensemble.js";
import {
  DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
  normalizeSpatialDeploymentConfig,
  planSpatialDeployment,
  rowsToSpatialDeploymentCsv,
  spatialDeploymentRows
} from "./model/unified/spatial-deployment.js";
import {
  createIllustrativeHostInventory,
  hostInventoryRows,
  hostInventoryTemplateCsv,
  parseHostInventoryText,
  rowsToHostInventoryCsv
} from "./model/unified/host-inventory.js";
import {
  DEFAULT_FIELD_CAMPAIGN_CONFIG,
  fieldCampaignRows,
  normalizeFieldCampaignConfig,
  planFieldCampaign,
  rowsToFieldCampaignCsv
} from "./model/unified/field-campaign.js";
import {
  campaignOutcomeTemplateCsv,
  campaignTrackingRows,
  createIllustrativeCampaignOutcomes,
  parseCampaignOutcomeText,
  rowsToCampaignTrackingCsv,
  trackLiveCampaign
} from "./model/unified/campaign-tracking.js";
import {
  DEFAULT_COMMISSIONING_OPERATIONS_CONFIG,
  commissioningEventTemplateCsv,
  commissioningOperationsRows,
  createIllustrativeCommissioningEvents,
  normalizeCommissioningOperationsConfig,
  parseCommissioningEventText,
  rowsToCommissioningOperationsCsv,
  runCommissioningOperations
} from "./model/unified/commissioning-operations.js";
import { APP_NAME, APP_VERSION } from "./release/version.js";
import { searchUnitedStatesLocations } from "./map/location.js";
import { clearApiCache, getCacheDiagnostics, inspectApiCache } from "./storage/cache.js";
import {
  createWorkspaceSnapshot,
  deleteSavedWorkspace,
  deserializeScenario,
  estimateSerializedBytes,
  exportWorkspaceText,
  listSavedWorkspaces,
  loadAutosavedWorkspace,
  loadWorkspaceSnapshot,
  parseWorkspaceText,
  saveWorkspaceSnapshot,
  serializeScenario
} from "./workspace/persistence.js";

const PAGE_DOMAIN = document.body.dataset.lumosDomain && DOMAINS[document.body.dataset.lumosDomain]
  ? document.body.dataset.lumosDomain
  : "core";

const state = {
  domainKey: PAGE_DOMAIN,
  seed: 20260721,
  scenario: null,
  result: null,
  activeProfile: "balanced",
  layer: "risk",
  weights: { ...DOMAINS[PAGE_DOMAIN].weights },
  dataMode: "live",
  heatWorkspace: "national",
  heatScenario: "baseline",
  airPollutant: "pm2_5",
  openAqApiKey: "",
  soilProperty: "composite",
  soilDepth: "0-15",
  waterIndicator: "temperature",
  waterSystemType: "surface",
  soilLabSamples: [],
  soilImportQa: null,
  soilSensitivity: null,
  soilEvidence: null,
  soilEvidenceController: null,
  waterSensitivity: null,
  waterEvidence: null,
  waterEvidenceController: null,
  loadingToken: 0,
  heatCalibration: null,
  airValidation: null,
  airSensitivity: null,
  airEvidence: null,
  airEvidenceController: null,
  heatExperiment: null,
  experimentPackage: null,
  interventionResult: null,
  heatSensitivity: null,
  planningStage: "intervention",
  viewportHeatActive: false,
  viewportHeatScenario: null,
  layerBeforeViewportHeat: "risk",
  viewportHeatRequestToken: 0,
  viewportHeatLoading: false,
  selectedLocationLabel: null,
  candidateStrategy: "hybrid",
  viewportWorkload: null,
  viewportFitController: null,
  hostEnrichmentController: null,
  hostEnrichmentLoading: false,
  activeLoadingOperation: null,
  workspaceRestoreInProgress: false,
  autosaveTimer: null,
  performanceDiagnostics: {
    fitRuntimeMs: null,
    optimizationRuntimeMs: null,
    hostRuntimeMs: null
  },
  heatExperience: "risk",
  liveSnapshot: null,
  liveRefreshTimer: null,
  liveCountdownTimer: null,
  liveNextRefreshAt: null,
  liveRefreshController: null,
  forecast: null,
  forecastFrameIndex: 0,
  forecastPlayTimer: null,
  forecastTransitionFrame: null,
  paperExperiment: null,
  paperExperimentController: null,
  onboardingStep: 0,
  onboardingOpen: false,
  releaseHealth: null,
  crossDomainAudit: null,
  crossDomainBudgetConfig: normalizeCrossDomainBudgetConfig(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG),
  crossDomainAllocation: null,
  activeCrossDomainProfile: "balanced",
  crossDomainEvidenceBundle: createEvidenceBundle([], { label: "Registry-prior only" }),
  sequentialReallocationConfig: normalizeSequentialReallocationConfig(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG),
  sequentialReallocation: null,
  activeSequentialProfile: "balanced",
  adaptiveProgramSimulationConfig: normalizeAdaptiveProgramSimulationConfig(DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG),
  adaptiveProgramSimulation: null,
  activeAdaptiveTrajectory: "adaptive",
  robustPolicyEnsembleConfig: normalizeRobustPolicyEnsembleConfig(DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG),
  robustPolicyEnsemble: null,
  activeRobustPolicy: "adaptive",
  spatialDeploymentConfig: normalizeSpatialDeploymentConfig(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG),
  spatialDeployment: null,
  hostInventoryBundle: null,
  activeSpatialDeploymentProfile: "coordinated",
  fieldCampaignConfig: normalizeFieldCampaignConfig(DEFAULT_FIELD_CAMPAIGN_CONFIG),
  fieldCampaign: null,
  activeFieldCampaignProfile: "balanced",
  campaignOutcomeBundle: null,
  campaignTracking: null,
  campaignTrackingPhase: 1,
  commissioningConfig: normalizeCommissioningOperationsConfig(DEFAULT_COMMISSIONING_OPERATIONS_CONFIG),
  commissioningEventBundle: null,
  commissioningOperations: null,
  activeDocumentationPage: DEFAULT_DOCUMENTATION_PAGE,
  mapFocusRestoreState: null,
  installPrompt: null,
  accessibility: {
    palette: "standard",
    reducedMotion: false
  }
};

const elements = {
  homePage: document.querySelector("#homePage"),
  workspace: document.querySelector("#workspace"),
  openUnifiedWorkspaceButton: document.querySelector("#openUnifiedWorkspaceButton"),
  heroTypeText: document.querySelector("#heroTypeText"),
  homeInstallStatus: document.querySelector("#homeInstallStatus"),
  documentationDialog: document.querySelector("#documentationDialog"),
  documentationKicker: document.querySelector("#documentationKicker"),
  documentationTitle: document.querySelector("#documentationTitle"),
  documentationSummary: document.querySelector("#documentationSummary"),
  documentationNavigation: document.querySelector("#documentationNavigation"),
  documentationContent: document.querySelector("#documentationContent"),
  closeDocumentationButton: document.querySelector("#closeDocumentationButton"),
  domainTitle: document.querySelector("#domainTitle"),
  domainStatus: document.querySelector("#domainStatus"),
  domainDescription: document.querySelector("#domainDescription"),
  unifiedArchitectureSection: document.querySelector("#unifiedArchitectureSection"),
  unifiedDomainMatrix: document.querySelector("#unifiedDomainMatrix"),
  runCrossDomainAuditButton: document.querySelector("#runCrossDomainAuditButton"),
  exportCrossDomainAuditButton: document.querySelector("#exportCrossDomainAuditButton"),
  unifiedBudgetSection: document.querySelector("#unifiedBudgetSection"),
  crossDomainBudget: document.querySelector("#crossDomainBudget"),
  crossDomainReserve: document.querySelector("#crossDomainReserve"),
  crossDomainReserveValue: document.querySelector("#crossDomainReserveValue"),
  crossDomainRequireAll: document.querySelector("#crossDomainRequireAll"),
  crossDomainBudgetControls: document.querySelector("#crossDomainBudgetControls"),
  runCrossDomainBudgetButton: document.querySelector("#runCrossDomainBudgetButton"),
  resetCrossDomainBudgetButton: document.querySelector("#resetCrossDomainBudgetButton"),
  exportCrossDomainBudgetButton: document.querySelector("#exportCrossDomainBudgetButton"),
  crossDomainBudgetStatus: document.querySelector("#crossDomainBudgetStatus"),
  sequentialReallocationSection: document.querySelector("#sequentialReallocationSection"),
  sequentialRoundBudget: document.querySelector("#sequentialRoundBudget"),
  sequentialReserve: document.querySelector("#sequentialReserve"),
  sequentialReserveValue: document.querySelector("#sequentialReserveValue"),
  sequentialLearningRate: document.querySelector("#sequentialLearningRate"),
  sequentialLearningRateValue: document.querySelector("#sequentialLearningRateValue"),
  sequentialExploration: document.querySelector("#sequentialExploration"),
  sequentialExplorationValue: document.querySelector("#sequentialExplorationValue"),
  sequentialMinimumEquity: document.querySelector("#sequentialMinimumEquity"),
  sequentialMinimumReliability: document.querySelector("#sequentialMinimumReliability"),
  sequentialMinimumIntervention: document.querySelector("#sequentialMinimumIntervention"),
  sequentialDomainControls: document.querySelector("#sequentialDomainControls"),
  loadSavedEvidenceButton: document.querySelector("#loadSavedEvidenceButton"),
  useCurrentEvidenceButton: document.querySelector("#useCurrentEvidenceButton"),
  useIllustrativeEvidenceButton: document.querySelector("#useIllustrativeEvidenceButton"),
  clearSequentialEvidenceButton: document.querySelector("#clearSequentialEvidenceButton"),
  runSequentialReallocationButton: document.querySelector("#runSequentialReallocationButton"),
  exportSequentialReallocationButton: document.querySelector("#exportSequentialReallocationButton"),
  sequentialEvidenceSummary: document.querySelector("#sequentialEvidenceSummary"),
  sequentialEvidenceCards: document.querySelector("#sequentialEvidenceCards"),
  sequentialReallocationStatus: document.querySelector("#sequentialReallocationStatus"),
  adaptiveSimulationSection: document.querySelector("#adaptiveSimulationSection"),
  adaptiveSimulationRounds: document.querySelector("#adaptiveSimulationRounds"),
  adaptiveSimulationBudget: document.querySelector("#adaptiveSimulationBudget"),
  adaptiveSimulationGrowth: document.querySelector("#adaptiveSimulationGrowth"),
  adaptiveSimulationScenario: document.querySelector("#adaptiveSimulationScenario"),
  adaptiveSimulationTransition: document.querySelector("#adaptiveSimulationTransition"),
  adaptiveSimulationTransitionValue: document.querySelector("#adaptiveSimulationTransitionValue"),
  adaptiveSimulationDiscount: document.querySelector("#adaptiveSimulationDiscount"),
  adaptiveSimulationDiscountValue: document.querySelector("#adaptiveSimulationDiscountValue"),
  runAdaptiveSimulationButton: document.querySelector("#runAdaptiveSimulationButton"),
  exportAdaptiveSimulationButton: document.querySelector("#exportAdaptiveSimulationButton"),
  adaptiveSimulationStatus: document.querySelector("#adaptiveSimulationStatus"),
  robustPolicySection: document.querySelector("#robustPolicySection"),
  robustEnsembleSize: document.querySelector("#robustEnsembleSize"),
  robustSeed: document.querySelector("#robustSeed"),
  robustResponseUncertainty: document.querySelector("#robustResponseUncertainty"),
  robustResponseUncertaintyValue: document.querySelector("#robustResponseUncertaintyValue"),
  robustCostUncertainty: document.querySelector("#robustCostUncertainty"),
  robustCostUncertaintyValue: document.querySelector("#robustCostUncertaintyValue"),
  robustFailureRate: document.querySelector("#robustFailureRate"),
  robustFailureRateValue: document.querySelector("#robustFailureRateValue"),
  robustEnvironmentalUncertainty: document.querySelector("#robustEnvironmentalUncertainty"),
  robustEnvironmentalUncertaintyValue: document.querySelector("#robustEnvironmentalUncertaintyValue"),
  robustRiskAversion: document.querySelector("#robustRiskAversion"),
  robustRiskAversionValue: document.querySelector("#robustRiskAversionValue"),
  runRobustPolicyButton: document.querySelector("#runRobustPolicyButton"),
  exportRobustPolicyButton: document.querySelector("#exportRobustPolicyButton"),
  robustPolicyStatus: document.querySelector("#robustPolicyStatus"),
  spatialDeploymentSection: document.querySelector("#spatialDeploymentSection"),
  spatialAllocationSource: document.querySelector("#spatialAllocationSource"),
  spatialHeatUnits: document.querySelector("#spatialHeatUnits"),
  spatialAirUnits: document.querySelector("#spatialAirUnits"),
  spatialSoilUnits: document.querySelector("#spatialSoilUnits"),
  spatialWaterUnits: document.querySelector("#spatialWaterUnits"),
  spatialSharedDiscount: document.querySelector("#spatialSharedDiscount"),
  spatialSharedDiscountValue: document.querySelector("#spatialSharedDiscountValue"),
  spatialMaxDomains: document.querySelector("#spatialMaxDomains"),
  spatialHostCount: document.querySelector("#spatialHostCount"),
  spatialSeed: document.querySelector("#spatialSeed"),
  spatialMinimumCompatibility: document.querySelector("#spatialMinimumCompatibility"),
  spatialMinimumCompatibilityValue: document.querySelector("#spatialMinimumCompatibilityValue"),
  spatialHostSource: document.querySelector("#spatialHostSource"),
  spatialFieldReviewPolicy: document.querySelector("#spatialFieldReviewPolicy"),
  hostInventoryFile: document.querySelector("#hostInventoryFile"),
  useIllustrativeHostInventoryButton: document.querySelector("#useIllustrativeHostInventoryButton"),
  downloadHostInventoryTemplateButton: document.querySelector("#downloadHostInventoryTemplateButton"),
  clearHostInventoryButton: document.querySelector("#clearHostInventoryButton"),
  exportHostInventoryReviewButton: document.querySelector("#exportHostInventoryReviewButton"),
  hostInventorySummary: document.querySelector("#hostInventorySummary"),
  hostInventoryMetrics: document.querySelector("#hostInventoryMetrics"),
  runSpatialDeploymentButton: document.querySelector("#runSpatialDeploymentButton"),
  exportSpatialDeploymentButton: document.querySelector("#exportSpatialDeploymentButton"),
  spatialDeploymentStatus: document.querySelector("#spatialDeploymentStatus"),
  fieldCampaignSection: document.querySelector("#fieldCampaignSection"),
  fieldCampaignCapacity: document.querySelector("#fieldCampaignCapacity"),
  fieldCampaignPhases: document.querySelector("#fieldCampaignPhases"),
  fieldCampaignScenario: document.querySelector("#fieldCampaignScenario"),
  fieldCampaignSeed: document.querySelector("#fieldCampaignSeed"),
  fieldCampaignReserveRatio: document.querySelector("#fieldCampaignReserveRatio"),
  fieldCampaignReserveRatioValue: document.querySelector("#fieldCampaignReserveRatioValue"),
  fieldCampaignInspectionCost: document.querySelector("#fieldCampaignInspectionCost"),
  fieldCampaignReserveCost: document.querySelector("#fieldCampaignReserveCost"),
  runFieldCampaignButton: document.querySelector("#runFieldCampaignButton"),
  exportFieldCampaignButton: document.querySelector("#exportFieldCampaignButton"),
  fieldCampaignStatus: document.querySelector("#fieldCampaignStatus"),
  campaignTrackingSection: document.querySelector("#campaignTrackingSection"),
  campaignTrackingProfile: document.querySelector("#campaignTrackingProfile"),
  campaignTrackingPhase: document.querySelector("#campaignTrackingPhase"),
  campaignOutcomeFile: document.querySelector("#campaignOutcomeFile"),
  downloadCampaignOutcomeTemplateButton: document.querySelector("#downloadCampaignOutcomeTemplateButton"),
  useIllustrativeCampaignOutcomesButton: document.querySelector("#useIllustrativeCampaignOutcomesButton"),
  clearCampaignOutcomesButton: document.querySelector("#clearCampaignOutcomesButton"),
  runCampaignTrackingButton: document.querySelector("#runCampaignTrackingButton"),
  exportCampaignTrackingButton: document.querySelector("#exportCampaignTrackingButton"),
  campaignTrackingStatus: document.querySelector("#campaignTrackingStatus"),
  campaignOutcomeSummary: document.querySelector("#campaignOutcomeSummary"),
  campaignOutcomeMetrics: document.querySelector("#campaignOutcomeMetrics"),
  commissioningSection: document.querySelector("#commissioningSection"),
  commissioningAsOf: document.querySelector("#commissioningAsOf"),
  commissioningCapacity: document.querySelector("#commissioningCapacity"),
  commissioningPhases: document.querySelector("#commissioningPhases"),
  commissioningActivateReplacements: document.querySelector("#commissioningActivateReplacements"),
  commissioningEventFile: document.querySelector("#commissioningEventFile"),
  downloadCommissioningTemplateButton: document.querySelector("#downloadCommissioningTemplateButton"),
  useIllustrativeCommissioningButton: document.querySelector("#useIllustrativeCommissioningButton"),
  clearCommissioningEventsButton: document.querySelector("#clearCommissioningEventsButton"),
  runCommissioningButton: document.querySelector("#runCommissioningButton"),
  exportCommissioningButton: document.querySelector("#exportCommissioningButton"),
  commissioningEventSummary: document.querySelector("#commissioningEventSummary"),
  commissioningEventMetrics: document.querySelector("#commissioningEventMetrics"),
  commissioningStatus: document.querySelector("#commissioningStatus"),
  dataSourceSection: document.querySelector("#dataSourceSection"),
  workspaceSectionKicker: document.querySelector("#workspaceSectionKicker"),
  workspaceSectionTitle: document.querySelector("#workspaceSectionTitle"),
  quickStartCard: document.querySelector("#quickStartCard"),
  quickStartDescription: document.querySelector("#quickStartDescription"),
  heatPresetGrid: document.querySelector("#heatPresetGrid"),
  airPresetGrid: document.querySelector("#airPresetGrid"),
  soilPresetGrid: document.querySelector("#soilPresetGrid"),
  waterPresetGrid: document.querySelector("#waterPresetGrid"),
  citySelector: document.querySelector("#citySelector"),
  dataMode: document.querySelector("#dataMode"),
  airWorkspaceControls: document.querySelector("#airWorkspaceControls"),
  airPollutant: document.querySelector("#airPollutant"),
  openAqApiKey: document.querySelector("#openAqApiKey"),
  airMonitorStatus: document.querySelector("#airMonitorStatus"),
  recalibrateAirButton: document.querySelector("#recalibrateAirButton"),
  runAirSensitivityButton: document.querySelector("#runAirSensitivityButton"),
  exportAirPaperButton: document.querySelector("#exportAirPaperButton"),
  runAirEvidenceButton: document.querySelector("#runAirEvidenceButton"),
  exportAirEvidenceButton: document.querySelector("#exportAirEvidenceButton"),
  airInferenceStatus: document.querySelector("#airInferenceStatus"),
  soilWorkspaceControls: document.querySelector("#soilWorkspaceControls"),
  soilProperty: document.querySelector("#soilProperty"),
  soilDepth: document.querySelector("#soilDepth"),
  soilDataStatus: document.querySelector("#soilDataStatus"),
  soilLabSampleInput: document.querySelector("#soilLabSampleInput"),
  downloadSoilTemplateButton: document.querySelector("#downloadSoilTemplateButton"),
  clearSoilSamplesButton: document.querySelector("#clearSoilSamplesButton"),
  soilLabStatus: document.querySelector("#soilLabStatus"),
  soilQaStatus: document.querySelector("#soilQaStatus"),
  recalibrateSoilButton: document.querySelector("#recalibrateSoilButton"),
  runSoilSensitivityButton: document.querySelector("#runSoilSensitivityButton"),
  exportSoilPaperButton: document.querySelector("#exportSoilPaperButton"),
  runSoilEvidenceButton: document.querySelector("#runSoilEvidenceButton"),
  exportSoilEvidenceButton: document.querySelector("#exportSoilEvidenceButton"),
  soilInferenceStatus: document.querySelector("#soilInferenceStatus"),
  waterWorkspaceControls: document.querySelector("#waterWorkspaceControls"),
  waterSystemType: document.querySelector("#waterSystemType"),
  waterIndicator: document.querySelector("#waterIndicator"),
  waterDataStatus: document.querySelector("#waterDataStatus"),
  runWaterSensitivityButton: document.querySelector("#runWaterSensitivityButton"),
  exportWaterPaperButton: document.querySelector("#exportWaterPaperButton"),
  runWaterEvidenceButton: document.querySelector("#runWaterEvidenceButton"),
  exportWaterEvidenceButton: document.querySelector("#exportWaterEvidenceButton"),
  waterInferenceStatus: document.querySelector("#waterInferenceStatus"),
  heatExperienceControls: document.querySelector("#heatExperienceControls"),
  heatExperience: document.querySelector("#heatExperience"),
  heatExperienceHelp: document.querySelector("#heatExperienceHelp"),
  liveConditionControls: document.querySelector("#liveConditionControls"),
  liveTemperatureValue: document.querySelector("#liveTemperatureValue"),
  liveApparentValue: document.querySelector("#liveApparentValue"),
  liveHumidityValue: document.querySelector("#liveHumidityValue"),
  liveWindValue: document.querySelector("#liveWindValue"),
  liveRefreshInterval: document.querySelector("#liveRefreshInterval"),
  refreshLiveWeatherButton: document.querySelector("#refreshLiveWeatherButton"),
  recomputePortfolioNoticeButton: document.querySelector("#recomputePortfolioNoticeButton"),
  liveWeatherStatus: document.querySelector("#liveWeatherStatus"),
  forecastPlaybackControls: document.querySelector("#forecastPlaybackControls"),
  forecastHorizon: document.querySelector("#forecastHorizon"),
  loadForecastButton: document.querySelector("#loadForecastButton"),
  forecastTimeline: document.querySelector("#forecastTimeline"),
  forecastPlayButton: document.querySelector("#forecastPlayButton"),
  forecastSpeed: document.querySelector("#forecastSpeed"),
  forecastTimestamp: document.querySelector("#forecastTimestamp"),
  heatScenario: document.querySelector("#heatScenario"),
  heatScenarioRow: document.querySelector("#heatScenarioRow"),
  nationalCandidateControls: document.querySelector("#nationalCandidateControls"),
  candidateStrategy: document.querySelector("#candidateStrategy"),
  workloadMeter: document.querySelector("#workloadMeter"),
  workloadTier: document.querySelector("#workloadTier"),
  workloadArea: document.querySelector("#workloadArea"),
  workloadEvaluation: document.querySelector("#workloadEvaluation"),
  workloadCandidates: document.querySelector("#workloadCandidates"),
  workloadRuntime: document.querySelector("#workloadRuntime"),
  workloadMessage: document.querySelector("#workloadMessage"),
  cancelHostEnrichmentButton: document.querySelector("#cancelHostEnrichmentButton"),
  nationalModelStatus: document.querySelector("#nationalModelStatus"),
  workspacePersistenceControls: document.querySelector("#workspacePersistenceControls"),
  savedWorkspaceSelect: document.querySelector("#savedWorkspaceSelect"),
  saveWorkspaceButton: document.querySelector("#saveWorkspaceButton"),
  loadWorkspaceButton: document.querySelector("#loadWorkspaceButton"),
  deleteWorkspaceButton: document.querySelector("#deleteWorkspaceButton"),
  exportWorkspaceButton: document.querySelector("#exportWorkspaceButton"),
  importWorkspaceInput: document.querySelector("#importWorkspaceInput"),
  clearApiCacheButton: document.querySelector("#clearApiCacheButton"),
  workspacePersistenceStatus: document.querySelector("#workspacePersistenceStatus"),
  diagnosticFitRuntime: document.querySelector("#diagnosticFitRuntime"),
  diagnosticOptimizationRuntime: document.querySelector("#diagnosticOptimizationRuntime"),
  diagnosticWorkspaceSize: document.querySelector("#diagnosticWorkspaceSize"),
  diagnosticMemory: document.querySelector("#diagnosticMemory"),
  diagnosticCache: document.querySelector("#diagnosticCache"),
  diagnosticCacheEntries: document.querySelector("#diagnosticCacheEntries"),
  diagnosticCandidates: document.querySelector("#diagnosticCandidates"),
  diagnosticHosts: document.querySelector("#diagnosticHosts"),
  dataSourceStatus: document.querySelector("#dataSourceStatus"),
  dataSourceList: document.querySelector("#dataSourceList"),
  layerProvenanceList: document.querySelector("#layerProvenanceList"),
  dataLimitations: document.querySelector("#dataLimitations"),
  recalibrateHeatButton: document.querySelector("#recalibrateHeatButton"),
  exportExperimentButton: document.querySelector("#exportExperimentButton"),
  runSensitivityButton: document.querySelector("#runSensitivityButton"),
  exportPaperTablesButton: document.querySelector("#exportPaperTablesButton"),
  exportNationalCaseStudyButton: document.querySelector("#exportNationalCaseStudyButton"),
  paperExperimentControls: document.querySelector("#paperExperimentControls"),
  paperExperimentScope: document.querySelector("#paperExperimentScope"),
  paperFairnessScreen: document.querySelector("#paperFairnessScreen"),
  runPaperExperimentButton: document.querySelector("#runPaperExperimentButton"),
  exportPaperExperimentButton: document.querySelector("#exportPaperExperimentButton"),
  exportMapPngButton: document.querySelector("#exportMapPngButton"),
  paperExperimentStatus: document.querySelector("#paperExperimentStatus"),
  paperExperimentSection: document.querySelector("#paperExperimentSection"),
  paperExperimentSummary: document.querySelector("#paperExperimentSummary"),
  paperExperimentCases: document.querySelector("#paperExperimentCases"),
  paperExperimentChecksum: document.querySelector("#paperExperimentChecksum"),
  paperExperimentFeasible: document.querySelector("#paperExperimentFeasible"),
  paperExperimentGenerated: document.querySelector("#paperExperimentGenerated"),
  paperExperimentTableBody: document.querySelector("#paperExperimentTableBody"),
  planningStageSection: document.querySelector("#planningStageSection"),
  planningStage: document.querySelector("#planningStage"),
  planningStageHelp: document.querySelector("#planningStageHelp"),
  interventionPlanningControls: document.querySelector("#interventionPlanningControls"),
  heatInterventionControls: document.querySelector("#heatInterventionControls"),
  airInterventionControls: document.querySelector("#airInterventionControls"),
  soilInterventionControls: document.querySelector("#soilInterventionControls"),
  soilEvaluationTarget: document.querySelector("#soilEvaluationTarget"),
  soilRepeatedMeasurements: document.querySelector("#soilRepeatedMeasurements"),
  soilRepeatedMeasurementsValue: document.querySelector("#soilRepeatedMeasurementsValue"),
  soilResidualStd: document.querySelector("#soilResidualStd"),
  soilResidualStdValue: document.querySelector("#soilResidualStdValue"),
  designSoilInterventionButton: document.querySelector("#designSoilInterventionButton"),
  waterInterventionControls: document.querySelector("#waterInterventionControls"),
  waterEvaluationTarget: document.querySelector("#waterEvaluationTarget"),
  waterRepeatedMeasurements: document.querySelector("#waterRepeatedMeasurements"),
  waterRepeatedMeasurementsValue: document.querySelector("#waterRepeatedMeasurementsValue"),
  waterResidualStd: document.querySelector("#waterResidualStd"),
  waterResidualStdValue: document.querySelector("#waterResidualStdValue"),
  designWaterInterventionButton: document.querySelector("#designWaterInterventionButton"),
  airEvaluationTarget: document.querySelector("#airEvaluationTarget"),
  airRepeatedMeasurements: document.querySelector("#airRepeatedMeasurements"),
  airRepeatedMeasurementsValue: document.querySelector("#airRepeatedMeasurementsValue"),
  airResidualStd: document.querySelector("#airResidualStd"),
  airResidualStdValue: document.querySelector("#airResidualStdValue"),
  designAirInterventionButton: document.querySelector("#designAirInterventionButton"),
  evaluationTarget: document.querySelector("#evaluationTarget"),
  repeatedMeasurements: document.querySelector("#repeatedMeasurements"),
  repeatedMeasurementsValue: document.querySelector("#repeatedMeasurementsValue"),
  residualStd: document.querySelector("#residualStd"),
  residualStdValue: document.querySelector("#residualStdValue"),
  designInterventionButton: document.querySelector("#designInterventionButton"),
  heatValidationSection: document.querySelector("#heatValidationSection"),
  airValidationSection: document.querySelector("#airValidationSection"),
  airValidationStatus: document.querySelector("#airValidationStatus"),
  airValidationCount: document.querySelector("#airValidationCount"),
  airValidationCvRmse: document.querySelector("#airValidationCvRmse"),
  airValidationLockedRmse: document.querySelector("#airValidationLockedRmse"),
  airValidationBaselineRmse: document.querySelector("#airValidationBaselineRmse"),
  airValidationCoverage: document.querySelector("#airValidationCoverage"),
  airValidationTransport: document.querySelector("#airValidationTransport"),
  airValidationLength: document.querySelector("#airValidationLength"),
  airValidationNoise: document.querySelector("#airValidationNoise"),
  airValidationModelTableBody: document.querySelector("#airValidationModelTableBody"),
  airValidationGroupTableBody: document.querySelector("#airValidationGroupTableBody"),
  airTransportTableBody: document.querySelector("#airTransportTableBody"),
  soilValidationSection: document.querySelector("#soilValidationSection"),
  soilValidationStatus: document.querySelector("#soilValidationStatus"),
  soilValidationCount: document.querySelector("#soilValidationCount"),
  soilValidationLockedRmse: document.querySelector("#soilValidationLockedRmse"),
  soilValidationBaselineRmse: document.querySelector("#soilValidationBaselineRmse"),
  soilValidationCoverage: document.querySelector("#soilValidationCoverage"),
  soilValidationLength: document.querySelector("#soilValidationLength"),
  soilValidationNoise: document.querySelector("#soilValidationNoise"),
  soilValidationModelTableBody: document.querySelector("#soilValidationModelTableBody"),
  soilSensitivitySection: document.querySelector("#soilSensitivitySection"),
  soilSensitivityStatus: document.querySelector("#soilSensitivityStatus"),
  soilSensitivitySamples: document.querySelector("#soilSensitivitySamples"),
  soilSensitivityRmse: document.querySelector("#soilSensitivityRmse"),
  soilSensitivityCoverage: document.querySelector("#soilSensitivityCoverage"),
  soilSensitivityCovarianceRuns: document.querySelector("#soilSensitivityCovarianceRuns"),
  soilSensitivityTableBody: document.querySelector("#soilSensitivityTableBody"),
  soilEvidenceSection: document.querySelector("#soilEvidenceSection"),
  soilEvidenceStatus: document.querySelector("#soilEvidenceStatus"),
  soilEvidenceCases: document.querySelector("#soilEvidenceCases"),
  soilEvidenceFeasible: document.querySelector("#soilEvidenceFeasible"),
  soilEvidenceInformation: document.querySelector("#soilEvidenceInformation"),
  soilEvidenceEquity: document.querySelector("#soilEvidenceEquity"),
  soilEvidenceRmse: document.querySelector("#soilEvidenceRmse"),
  soilEvidenceChecksum: document.querySelector("#soilEvidenceChecksum"),
  soilEvidenceTableBody: document.querySelector("#soilEvidenceTableBody"),
  waterValidationSection: document.querySelector("#waterValidationSection"),
  waterValidationStatus: document.querySelector("#waterValidationStatus"),
  waterValidationCount: document.querySelector("#waterValidationCount"),
  waterValidationCvRmse: document.querySelector("#waterValidationCvRmse"),
  waterValidationLockedRmse: document.querySelector("#waterValidationLockedRmse"),
  waterValidationBaselineRmse: document.querySelector("#waterValidationBaselineRmse"),
  waterValidationCoverage: document.querySelector("#waterValidationCoverage"),
  waterValidationFlow: document.querySelector("#waterValidationFlow"),
  waterValidationLength: document.querySelector("#waterValidationLength"),
  waterValidationNoise: document.querySelector("#waterValidationNoise"),
  waterValidationModelTableBody: document.querySelector("#waterValidationModelTableBody"),
  waterValidationGroupTableBody: document.querySelector("#waterValidationGroupTableBody"),
  waterSensitivitySection: document.querySelector("#waterSensitivitySection"),
  waterSensitivityStatus: document.querySelector("#waterSensitivityStatus"),
  waterSensitivityObservations: document.querySelector("#waterSensitivityObservations"),
  waterSensitivityRmse: document.querySelector("#waterSensitivityRmse"),
  waterSensitivityCoverage: document.querySelector("#waterSensitivityCoverage"),
  waterSensitivityBestFlow: document.querySelector("#waterSensitivityBestFlow"),
  waterSensitivityRuns: document.querySelector("#waterSensitivityRuns"),
  waterSensitivityTableBody: document.querySelector("#waterSensitivityTableBody"),
  waterEvidenceSection: document.querySelector("#waterEvidenceSection"),
  waterEvidenceStatus: document.querySelector("#waterEvidenceStatus"),
  waterEvidenceCases: document.querySelector("#waterEvidenceCases"),
  waterEvidenceFeasible: document.querySelector("#waterEvidenceFeasible"),
  waterEvidenceInformation: document.querySelector("#waterEvidenceInformation"),
  waterEvidenceEquity: document.querySelector("#waterEvidenceEquity"),
  waterEvidenceRmse: document.querySelector("#waterEvidenceRmse"),
  waterEvidenceChecksum: document.querySelector("#waterEvidenceChecksum"),
  waterEvidenceTableBody: document.querySelector("#waterEvidenceTableBody"),
  airSensitivitySection: document.querySelector("#airSensitivitySection"),
  airSensitivityStatus: document.querySelector("#airSensitivityStatus"),
  airSensitivityRuntime: document.querySelector("#airSensitivityRuntime"),
  airSensitivitySplitRange: document.querySelector("#airSensitivitySplitRange"),
  airSensitivityBestTransport: document.querySelector("#airSensitivityBestTransport"),
  airSensitivityRoleLoss: document.querySelector("#airSensitivityRoleLoss"),
  airSensitivityReadingRobustness: document.querySelector("#airSensitivityReadingRobustness"),
  airSensitivitySplitTableBody: document.querySelector("#airSensitivitySplitTableBody"),
  airSensitivityCovarianceTableBody: document.querySelector("#airSensitivityCovarianceTableBody"),
  airSensitivityObservationTableBody: document.querySelector("#airSensitivityObservationTableBody"),
  airSensitivityRoleTableBody: document.querySelector("#airSensitivityRoleTableBody"),
  airSensitivityFairnessTableBody: document.querySelector("#airSensitivityFairnessTableBody"),
  airEvidenceSection: document.querySelector("#airEvidenceSection"),
  airEvidenceStatus: document.querySelector("#airEvidenceStatus"),
  airEvidenceCases: document.querySelector("#airEvidenceCases"),
  airEvidenceFeasible: document.querySelector("#airEvidenceFeasible"),
  airEvidenceInformation: document.querySelector("#airEvidenceInformation"),
  airEvidenceEquity: document.querySelector("#airEvidenceEquity"),
  airEvidenceChecksum: document.querySelector("#airEvidenceChecksum"),
  airEvidenceTableBody: document.querySelector("#airEvidenceTableBody"),
  validationStatus: document.querySelector("#validationStatus"),
  validationMae: document.querySelector("#validationMae"),
  validationRmse: document.querySelector("#validationRmse"),
  lockedTestMae: document.querySelector("#lockedTestMae"),
  lockedTestRmse: document.querySelector("#lockedTestRmse"),
  lockedTestCount: document.querySelector("#lockedTestCount"),
  validationCoverage: document.querySelector("#validationCoverage"),
  validationLengthScale: document.querySelector("#validationLengthScale"),
  validationNoise: document.querySelector("#validationNoise"),
  validationGroupTableBody: document.querySelector("#validationGroupTableBody"),
  validationModelTableBody: document.querySelector("#validationModelTableBody"),
  heatSensitivitySection: document.querySelector("#heatSensitivitySection"),
  sensitivityStatus: document.querySelector("#sensitivityStatus"),
  sensitivityRuntime: document.querySelector("#sensitivityRuntime"),
  sensitivitySplitRange: document.querySelector("#sensitivitySplitRange"),
  sensitivityBestCovariance: document.querySelector("#sensitivityBestCovariance"),
  sensitivityHostWorst: document.querySelector("#sensitivityHostWorst"),
  sensitivityFairnessCost: document.querySelector("#sensitivityFairnessCost"),
  sensitivitySplitTableBody: document.querySelector("#sensitivitySplitTableBody"),
  sensitivityCovarianceTableBody: document.querySelector("#sensitivityCovarianceTableBody"),
  sensitivityHostTableBody: document.querySelector("#sensitivityHostTableBody"),
  sensitivityFairnessTableBody: document.querySelector("#sensitivityFairnessTableBody"),
  experimentManifestSection: document.querySelector("#experimentManifestSection"),
  experimentId: document.querySelector("#experimentId"),
  experimentChecksum: document.querySelector("#experimentChecksum"),
  experimentDevelopmentCount: document.querySelector("#experimentDevelopmentCount"),
  experimentTestCount: document.querySelector("#experimentTestCount"),
  heatInterventionSection: document.querySelector("#heatInterventionSection"),
  interventionStatus: document.querySelector("#interventionStatus"),
  interventionPower: document.querySelector("#interventionPower"),
  interventionEffect: document.querySelector("#interventionEffect"),
  interventionMatch: document.querySelector("#interventionMatch"),
  interventionCost: document.querySelector("#interventionCost"),
  interventionRoleTableBody: document.querySelector("#interventionRoleTableBody"),
  preferredProfile: document.querySelector("#preferredProfile"),
  monitorCount: document.querySelector("#monitorCount"),
  monitorCountValue: document.querySelector("#monitorCountValue"),
  budgetLimit: document.querySelector("#budgetLimit"),
  budgetLimitValue: document.querySelector("#budgetLimitValue"),
  influenceScale: document.querySelector("#influenceScale"),
  influenceScaleValue: document.querySelector("#influenceScaleValue"),
  measurementNoise: document.querySelector("#measurementNoise"),
  measurementNoiseValue: document.querySelector("#measurementNoiseValue"),
  fairnessLimit: document.querySelector("#fairnessLimit"),
  fairnessLimitValue: document.querySelector("#fairnessLimitValue"),
  minimumGroupInformation: document.querySelector("#minimumGroupInformation"),
  minimumGroupInformationValue: document.querySelector("#minimumGroupInformationValue"),
  minimumReliability: document.querySelector("#minimumReliability"),
  minimumReliabilityValue: document.querySelector("#minimumReliabilityValue"),
  weightControls: document.querySelector("#weightControls"),
  fairnessConstraint: document.querySelector("#fairnessConstraint"),
  minimumSeparation: document.querySelector("#minimumSeparation"),
  showCandidates: document.querySelector("#showCandidates"),
  optimizeButton: document.querySelector("#optimizeButton"),
  newScenarioButton: document.querySelector("#newScenarioButton"),
  tourButton: document.querySelector("#tourButton"),
  systemCheckButton: document.querySelector("#systemCheckButton"),
  installAppButton: document.querySelector("#installAppButton"),
  offlineBanner: document.querySelector("#offlineBanner"),
  startTourInlineButton: document.querySelector("#startTourInlineButton"),
  resetWeightsButton: document.querySelector("#resetWeightsButton"),
  runStatus: document.querySelector("#runStatus"),
  resultHeading: document.querySelector("#resultHeading"),
  resultSummary: document.querySelector("#resultSummary"),
  crossDomainAuditSection: document.querySelector("#crossDomainAuditSection"),
  crossDomainAuditStatus: document.querySelector("#crossDomainAuditStatus"),
  crossDomainAuditSummary: document.querySelector("#crossDomainAuditSummary"),
  crossDomainAuditMetrics: document.querySelector("#crossDomainAuditMetrics"),
  crossDomainAuditTableBody: document.querySelector("#crossDomainAuditTableBody"),
  crossDomainAuditCheckList: document.querySelector("#crossDomainAuditCheckList"),
  crossDomainBudgetResultSection: document.querySelector("#crossDomainBudgetResultSection"),
  crossDomainBudgetResultStatus: document.querySelector("#crossDomainBudgetResultStatus"),
  crossDomainBudgetPortfolio: document.querySelector("#crossDomainBudgetPortfolio"),
  crossDomainBudgetResultSummary: document.querySelector("#crossDomainBudgetResultSummary"),
  crossDomainBudgetMetrics: document.querySelector("#crossDomainBudgetMetrics"),
  crossDomainBudgetTableBody: document.querySelector("#crossDomainBudgetTableBody"),
  sequentialResultSection: document.querySelector("#sequentialResultSection"),
  sequentialResultStatus: document.querySelector("#sequentialResultStatus"),
  sequentialPortfolio: document.querySelector("#sequentialPortfolio"),
  sequentialResultSummary: document.querySelector("#sequentialResultSummary"),
  sequentialMetrics: document.querySelector("#sequentialMetrics"),
  sequentialTableBody: document.querySelector("#sequentialTableBody"),
  adaptiveSimulationResultSection: document.querySelector("#adaptiveSimulationResultSection"),
  adaptiveSimulationResultStatus: document.querySelector("#adaptiveSimulationResultStatus"),
  adaptiveSimulationTrajectory: document.querySelector("#adaptiveSimulationTrajectory"),
  adaptiveSimulationResultSummary: document.querySelector("#adaptiveSimulationResultSummary"),
  adaptiveSimulationMetrics: document.querySelector("#adaptiveSimulationMetrics"),
  adaptiveSimulationTableBody: document.querySelector("#adaptiveSimulationTableBody"),
  robustPolicyResultSection: document.querySelector("#robustPolicyResultSection"),
  robustPolicyResultStatus: document.querySelector("#robustPolicyResultStatus"),
  robustPolicyPortfolio: document.querySelector("#robustPolicyPortfolio"),
  robustPolicyResultSummary: document.querySelector("#robustPolicyResultSummary"),
  robustPolicyMetrics: document.querySelector("#robustPolicyMetrics"),
  robustPolicyTableBody: document.querySelector("#robustPolicyTableBody"),
  spatialDeploymentResultSection: document.querySelector("#spatialDeploymentResultSection"),
  spatialDeploymentResultStatus: document.querySelector("#spatialDeploymentResultStatus"),
  spatialDeploymentPortfolio: document.querySelector("#spatialDeploymentPortfolio"),
  spatialDeploymentResultSummary: document.querySelector("#spatialDeploymentResultSummary"),
  spatialDeploymentMetrics: document.querySelector("#spatialDeploymentMetrics"),
  spatialDeploymentTableBody: document.querySelector("#spatialDeploymentTableBody"),
  fieldCampaignResultSection: document.querySelector("#fieldCampaignResultSection"),
  fieldCampaignResultStatus: document.querySelector("#fieldCampaignResultStatus"),
  fieldCampaignPortfolio: document.querySelector("#fieldCampaignPortfolio"),
  fieldCampaignResultSummary: document.querySelector("#fieldCampaignResultSummary"),
  fieldCampaignMetrics: document.querySelector("#fieldCampaignMetrics"),
  fieldCampaignTableBody: document.querySelector("#fieldCampaignTableBody"),
  campaignTrackingResultSection: document.querySelector("#campaignTrackingResultSection"),
  campaignTrackingResultStatus: document.querySelector("#campaignTrackingResultStatus"),
  campaignTrackingResultSummary: document.querySelector("#campaignTrackingResultSummary"),
  campaignTrackingMetrics: document.querySelector("#campaignTrackingMetrics"),
  campaignTrackingTableBody: document.querySelector("#campaignTrackingTableBody"),
  campaignTrackingHistoryBody: document.querySelector("#campaignTrackingHistoryBody"),
  commissioningResultSection: document.querySelector("#commissioningResultSection"),
  commissioningResultStatus: document.querySelector("#commissioningResultStatus"),
  commissioningResultSummary: document.querySelector("#commissioningResultSummary"),
  commissioningMetrics: document.querySelector("#commissioningMetrics"),
  commissioningTableBody: document.querySelector("#commissioningTableBody"),
  commissioningTicketTableBody: document.querySelector("#commissioningTicketTableBody"),
  commissioningHistoryBody: document.querySelector("#commissioningHistoryBody"),
  standardResultsSummary: document.querySelector("#standardResultsSummary"),
  standardPortfolioSection: document.querySelector("#standardPortfolioSection"),
  standardMetricGrid: document.querySelector("#standardMetricGrid"),
  solutionPortfolio: document.querySelector("#solutionPortfolio"),
  portfolioSelectionMeta: document.querySelector("#portfolioSelectionMeta"),
  baselineTableBody: document.querySelector("#baselineTableBody"),
  exactBenchmarkHeading: document.querySelector("#exactBenchmarkHeading"),
  exactBenchmarkSummary: document.querySelector("#exactBenchmarkSummary"),
  exactTableBody: document.querySelector("#exactTableBody"),
  explanationList: document.querySelector("#explanationList"),
  constraintHeading: document.querySelector("#constraintHeading"),
  constraintList: document.querySelector("#constraintList"),
  metricObjective: document.querySelector("#metricObjective"),
  metricInformation: document.querySelector("#metricInformation"),
  metricExposure: document.querySelector("#metricExposure"),
  metricFairness: document.querySelector("#metricFairness"),
  metricGroupInformation: document.querySelector("#metricGroupInformation"),
  metricRedundancy: document.querySelector("#metricRedundancy"),
  metricReliability: document.querySelector("#metricReliability"),
  metricCost: document.querySelector("#metricCost"),
  appHeader: document.querySelector("#appHeader"),
  toggleHeader: document.querySelector("#toggleHeader"),
  workspace: document.querySelector("#workspace"),
  toggleLeftPanel: document.querySelector("#toggleLeftPanel"),
  toggleRightPanel: document.querySelector("#toggleRightPanel"),
  mapLayerSelect: document.querySelector("#mapLayerSelect"),
  basemapStyleSelect: document.querySelector("#basemapStyleSelect"),
  overlayOpacity: document.querySelector("#overlayOpacity"),
  colorPalette: document.querySelector("#colorPalette"),
  reducedMotion: document.querySelector("#reducedMotion"),
  locationPanel: document.querySelector("#locationPanel"),
  locationPanelDragHandle: document.querySelector("#locationPanelDragHandle"),
  toggleLocationPanelButton: document.querySelector("#toggleLocationPanelButton"),
  closeLocationPanelButton: document.querySelector("#closeLocationPanelButton"),
  locationSearchForm: document.querySelector("#locationSearchForm"),
  locationSearchInput: document.querySelector("#locationSearchInput"),
  locationSearchStatus: document.querySelector("#locationSearchStatus"),
  locationSearchResults: document.querySelector("#locationSearchResults"),
  usOverviewButton: document.querySelector("#usOverviewButton"),
  fitScenarioButton: document.querySelector("#fitScenarioButton"),
  modelExtentButton: document.querySelector("#modelExtentButton"),
  myLocationButton: document.querySelector("#myLocationButton"),
  focusMapButton: document.querySelector("#focusMapButton"),
  mapCoordinateReadout: document.querySelector("#mapCoordinateReadout"),
  globalLoadingOverlay: document.querySelector("#globalLoadingOverlay"),
  loadingEyebrow: document.querySelector("#loadingEyebrow"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingMessage: document.querySelector("#loadingMessage"),
  loadingProgressBar: document.querySelector("#loadingProgressBar"),
  loadingStage: document.querySelector("#loadingStage"),
  loadingPercent: document.querySelector("#loadingPercent"),
  loadingCancelButton: document.querySelector("#loadingCancelButton"),
  backgroundLoadingToast: document.querySelector("#backgroundLoadingToast"),
  backgroundLoadingMessage: document.querySelector("#backgroundLoadingMessage"),
  onboardingOverlay: document.querySelector("#onboardingOverlay"),
  onboardingCounter: document.querySelector("#onboardingCounter"),
  onboardingProgressBar: document.querySelector("#onboardingProgressBar"),
  onboardingTitle: document.querySelector("#onboardingTitle"),
  onboardingBody: document.querySelector("#onboardingBody"),
  onboardingBackButton: document.querySelector("#onboardingBackButton"),
  onboardingNextButton: document.querySelector("#onboardingNextButton"),
  closeOnboardingButton: document.querySelector("#closeOnboardingButton"),
  systemCheckDialog: document.querySelector("#systemCheckDialog"),
  systemCheckSummary: document.querySelector("#systemCheckSummary"),
  systemCheckList: document.querySelector("#systemCheckList"),
  runSystemCheckButton: document.querySelector("#runSystemCheckButton")
};

const map = new LumosMap("map");

const ACCESSIBILITY_STORAGE_KEY = "lumos-accessibility-v1";
const MAP_SEARCH_STORAGE_KEY = "lumos-map-search-panel-v1";
const ONBOARDING_STORAGE_KEY = "lumos-onboarding-v2.5";
const HERO_TYPE_WORDS = Object.freeze([
  "monitoring",
  "intervention",
  "planning",
  "optimization",
  "deployment",
  "evaluation"
]);
const HERO_TYPE_TIMING = Object.freeze({ type: 78, erase: 42, hold: 1250, empty: 240 });
let heroTypewriterTimer = null;
let heroTypewriterState = { wordIndex: 0, characterIndex: HERO_TYPE_WORDS[0].length, deleting: true };

function scheduleHeroTypewriter(delay) {
  window.clearTimeout(heroTypewriterTimer);
  heroTypewriterTimer = window.setTimeout(stepHeroTypewriter, delay);
}

function stepHeroTypewriter() {
  if (!elements.heroTypeText) return;
  if (state.accessibility.reducedMotion) {
    elements.heroTypeText.textContent = HERO_TYPE_WORDS[0];
    return;
  }
  if (document.hidden || elements.homePage.hidden) {
    scheduleHeroTypewriter(500);
    return;
  }

  const word = HERO_TYPE_WORDS[heroTypewriterState.wordIndex];
  if (heroTypewriterState.deleting) {
    heroTypewriterState.characterIndex = Math.max(0, heroTypewriterState.characterIndex - 1);
    elements.heroTypeText.textContent = word.slice(0, heroTypewriterState.characterIndex);
    if (heroTypewriterState.characterIndex === 0) {
      heroTypewriterState.wordIndex = (heroTypewriterState.wordIndex + 1) % HERO_TYPE_WORDS.length;
      heroTypewriterState.deleting = false;
      scheduleHeroTypewriter(HERO_TYPE_TIMING.empty);
      return;
    }
    scheduleHeroTypewriter(HERO_TYPE_TIMING.erase);
    return;
  }

  const nextWord = HERO_TYPE_WORDS[heroTypewriterState.wordIndex];
  heroTypewriterState.characterIndex = Math.min(nextWord.length, heroTypewriterState.characterIndex + 1);
  elements.heroTypeText.textContent = nextWord.slice(0, heroTypewriterState.characterIndex);
  if (heroTypewriterState.characterIndex === nextWord.length) {
    heroTypewriterState.deleting = true;
    scheduleHeroTypewriter(HERO_TYPE_TIMING.hold);
    return;
  }
  scheduleHeroTypewriter(HERO_TYPE_TIMING.type);
}

function syncHeroTypewriter() {
  window.clearTimeout(heroTypewriterTimer);
  if (!elements.heroTypeText) return;
  if (state.accessibility.reducedMotion) {
    heroTypewriterState = { wordIndex: 0, characterIndex: HERO_TYPE_WORDS[0].length, deleting: true };
    elements.heroTypeText.textContent = HERO_TYPE_WORDS[0];
    return;
  }
  const currentIndex = Math.max(0, HERO_TYPE_WORDS.indexOf(elements.heroTypeText.textContent));
  heroTypewriterState = {
    wordIndex: currentIndex,
    characterIndex: elements.heroTypeText.textContent.length || HERO_TYPE_WORDS[currentIndex].length,
    deleting: true
  };
  scheduleHeroTypewriter(HERO_TYPE_TIMING.hold);
}

function loadAccessibilityPreferences() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) ?? "{}");
  } catch {
    stored = {};
  }
  const systemReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  state.accessibility = {
    palette: stored.palette === "colorblind" ? "colorblind" : "standard",
    reducedMotion: typeof stored.reducedMotion === "boolean" ? stored.reducedMotion : systemReducedMotion
  };
  elements.colorPalette.value = state.accessibility.palette;
  elements.reducedMotion.checked = state.accessibility.reducedMotion;
  document.body.classList.toggle("colorblind-palette", state.accessibility.palette === "colorblind");
  document.body.classList.toggle("reduced-motion", state.accessibility.reducedMotion);
  map.setPalette(state.accessibility.palette);
  map.setReducedMotion(state.accessibility.reducedMotion);
}

function saveAccessibilityPreferences() {
  try {
    localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(state.accessibility));
  } catch {
    // Accessibility settings still apply for the current page if storage is unavailable.
  }
}

function clearOnboardingHighlight() {
  document.querySelectorAll(".onboarding-highlight").forEach((node) => node.classList.remove("onboarding-highlight"));
}

function renderDocumentationNavigation() {
  elements.documentationNavigation.replaceChildren();
  for (const pageKey of DOCUMENTATION_ORDER) {
    const page = DOCUMENTATION_PAGES[pageKey];
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.documentationPage = pageKey;
    button.textContent = page.title;
    button.classList.toggle("active", pageKey === state.activeDocumentationPage);
    button.setAttribute("aria-current", pageKey === state.activeDocumentationPage ? "page" : "false");
    button.addEventListener("click", () => renderDocumentationPage(pageKey));
    elements.documentationNavigation.append(button);
  }
}

function renderDocumentationPage(pageKey = DEFAULT_DOCUMENTATION_PAGE) {
  const page = DOCUMENTATION_PAGES[pageKey] ?? DOCUMENTATION_PAGES[DEFAULT_DOCUMENTATION_PAGE];
  state.activeDocumentationPage = DOCUMENTATION_PAGES[pageKey] ? pageKey : DEFAULT_DOCUMENTATION_PAGE;
  elements.documentationKicker.textContent = page.kicker;
  elements.documentationTitle.textContent = page.title;
  elements.documentationSummary.textContent = page.summary;
  elements.documentationContent.innerHTML = page.html;
  renderDocumentationNavigation();
  elements.documentationContent.scrollTop = 0;
  if (elements.documentationDialog.open) elements.documentationContent.focus({ preventScroll: true });
}

function openDocumentation(pageKey = DEFAULT_DOCUMENTATION_PAGE) {
  renderDocumentationPage(pageKey);
  if (typeof elements.documentationDialog.showModal === "function") elements.documentationDialog.showModal();
  else elements.documentationDialog.setAttribute("open", "");
  elements.documentationContent.focus({ preventScroll: true });
}

function closeDocumentation() {
  if (typeof elements.documentationDialog.close === "function") elements.documentationDialog.close();
  else elements.documentationDialog.removeAttribute("open");
}

function showHomePage() {
  document.body.classList.add("home-active");
  document.body.dataset.view = "home";
  elements.homePage.hidden = false;
  elements.workspace.hidden = true;
  document.querySelectorAll(".domain-tab").forEach((button) => button.classList.toggle("active", button.dataset.domain === "home"));
  window.scrollTo({ top: 0, behavior: state.accessibility.reducedMotion ? "auto" : "smooth" });
}

function showWorkspaceView() {
  document.body.classList.remove("home-active");
  document.body.dataset.view = "workspace";
  elements.homePage.hidden = true;
  elements.workspace.hidden = false;
  window.setTimeout(() => map.resize(), 0);
}

function activeOnboardingSteps() {
  return onboardingStepsForDomain(state.domainKey);
}

function renderOnboardingStep() {
  const steps = activeOnboardingSteps();
  const index = clampOnboardingStep(state.onboardingStep, steps);
  state.onboardingStep = index;
  const step = steps[index];
  elements.onboardingCounter.textContent = `${index + 1} of ${steps.length}`;
  elements.onboardingProgressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
  elements.onboardingTitle.textContent = step.title;
  elements.onboardingBody.textContent = step.body;
  elements.onboardingBackButton.disabled = index === 0;
  elements.onboardingNextButton.textContent = index === steps.length - 1 ? "Finish" : "Next";
  clearOnboardingHighlight();
  window.setTimeout(() => {
    if (!state.onboardingOpen) return;
    const target = document.querySelector(step.target);
    if (!target || target.hidden) return;
    target.classList.add("onboarding-highlight");
    target.scrollIntoView({ behavior: state.accessibility.reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
  }, 50);
}

function openOnboarding(startIndex = 0) {
  if (document.body.classList.contains("header-collapsed")) setHeaderCollapsed(false);
  if (document.body.classList.contains("home-active")) applyDomain("core");
  const steps = activeOnboardingSteps();
  state.onboardingStep = clampOnboardingStep(startIndex, steps);
  state.onboardingOpen = true;
  elements.onboardingOverlay.hidden = false;
  elements.onboardingOverlay.setAttribute("aria-hidden", "false");
  renderOnboardingStep();
  elements.onboardingNextButton.focus({ preventScroll: true });
}

function closeOnboarding({ completed = false } = {}) {
  state.onboardingOpen = false;
  elements.onboardingOverlay.hidden = true;
  elements.onboardingOverlay.setAttribute("aria-hidden", "true");
  clearOnboardingHighlight();
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, completed ? "completed" : "dismissed");
  } catch {
    // The tour can still close when storage is unavailable.
  }
  document.querySelector(".domain-tab.active")?.focus({ preventScroll: true });
}

function updateConnectivityStatus() {
  const online = navigator.onLine !== false;
  elements.offlineBanner.hidden = online;
  document.body.classList.toggle("is-offline", !online);
}

async function registerApplicationServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const registration = await navigator.serviceWorker.register(new URL("../service-worker.js", import.meta.url), {
      scope: "./",
      updateViaCache: "none"
    });
    await registration.update();
  } catch (error) {
    console.warn(`${APP_NAME} ${APP_VERSION} service worker registration failed:`, error);
  }
}

async function installApplication() {
  const prompt = state.installPrompt;
  if (!prompt) return;
  prompt.prompt();
  try {
    await prompt.userChoice;
  } finally {
    state.installPrompt = null;
    elements.installAppButton.hidden = true;
  }
}

function renderSystemCheckList(checks = []) {
  elements.systemCheckList.replaceChildren();
  for (const check of checks) {
    const item = document.createElement("li");
    item.className = `system-check-item ${check.status}`;
    const dot = document.createElement("span");
    dot.className = "system-check-dot";
    dot.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "system-check-copy";
    const label = document.createElement("strong");
    label.textContent = check.label;
    const detail = document.createElement("small");
    detail.textContent = check.detail;
    copy.append(label, detail);
    const status = document.createElement("span");
    status.className = "system-check-state";
    status.textContent = check.status;
    item.append(dot, copy, status);
    elements.systemCheckList.append(item);
  }
}

async function runSystemCheck() {
  elements.runSystemCheckButton.disabled = true;
  elements.systemCheckSummary.textContent = "Checking local browser capabilities and public-data services...";
  renderSystemCheckList([]);
  const checkedDomain = state.domainKey;
  const summary = await runReleaseHealthCheck({
    domainKey: checkedDomain,
    onUpdate: (_check, checks) => renderSystemCheckList(checks)
  });
  state.releaseHealth = summary;
  const domainLabel = domainDisplayName(checkedDomain);
  elements.systemCheckSummary.textContent = summary.ready
    ? `Ready for the ${domainLabel} workflow · ${summary.counts.pass} passed${summary.counts.warn ? ` · ${summary.counts.warn} optional warning${summary.counts.warn === 1 ? "" : "s"}` : ""}.`
    : `Required service check failed · ${summary.counts.fail} failure${summary.counts.fail === 1 ? "" : "s"}. Synthetic and saved workspaces remain available.`;
  elements.runSystemCheckButton.disabled = false;
}

function renderUnifiedDomainMatrix() {
  elements.unifiedDomainMatrix.innerHTML = PUBLIC_DOMAIN_ENTRIES.map((entry) => `
    <article class="unified-domain-card">
      <strong>${entry.displayName}</strong>
      <span>Public since v${entry.releaseVersion}</span>
      <small>${entry.inferenceModel}</small>
      <small>${entry.transportModel}</small>
      <small>${formatUsd(entry.planning.unitCost)} per ${entry.planning.unitLabel} · minimum ${entry.planning.minimumUnits}</small>
    </article>
  `).join("");
}

function renderCrossDomainAudit(audit = state.crossDomainAudit) {
  const visible = state.domainKey === "core";
  elements.crossDomainAuditSection.hidden = !visible;
  elements.unifiedArchitectureSection.hidden = !visible;
  if (!visible) return;
  if (!audit) {
    elements.crossDomainAuditStatus.textContent = "Not run";
    elements.crossDomainAuditStatus.className = "status-pill";
    elements.crossDomainAuditSummary.textContent = "Run the architecture audit to verify shared objectives, public workflow capabilities, source health contracts, fallbacks, interventions, onboarding, and release parity across Heat, Air, Soil, and Water.";
    elements.crossDomainAuditMetrics.innerHTML = "";
    elements.crossDomainAuditTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Architecture audit has not run.</td></tr>';
    elements.crossDomainAuditCheckList.innerHTML = "";
    elements.exportCrossDomainAuditButton.disabled = true;
    return;
  }
  const statusClass = audit.ready ? (audit.counts.warn ? "warn" : "pass") : "fail";
  elements.crossDomainAuditStatus.textContent = audit.ready ? (audit.counts.warn ? "Ready with warnings" : "Ready") : "Action required";
  elements.crossDomainAuditStatus.className = `status-pill ${statusClass}`;
  elements.crossDomainAuditSummary.textContent = `${audit.publicDomains.length} public adapters · ${audit.counts.pass} checks passed · ${audit.counts.warn} warnings · ${audit.counts.fail} failures · checksum ${audit.checksum}.`;
  elements.crossDomainAuditMetrics.innerHTML = `
    <article><span>Public adapters</span><strong>${audit.publicDomains.length}</strong></article>
    <article><span>Checks passed</span><strong>${audit.counts.pass}</strong></article>
    <article><span>Failures</span><strong>${audit.counts.fail}</strong></article>
  `;
  elements.crossDomainAuditTableBody.innerHTML = audit.domains.map((domain) => `
    <tr class="${domain.ready ? "best-row" : ""}">
      <td>${domain.label}</td><td>v${domain.releaseVersion}</td><td>${domain.counts.pass}</td><td>${domain.counts.warn}</td><td>${domain.counts.fail}</td>
    </tr>
  `).join("");
  elements.crossDomainAuditCheckList.innerHTML = audit.checks.map((check) => `
    <li class="system-check-item ${check.status}">
      <span class="system-check-dot" aria-hidden="true"></span>
      <span class="system-check-copy"><strong>${check.domainKey === "shared" ? "Shared" : domainDisplayName(check.domainKey)} · ${check.label}</strong><small>${check.detail}</small></span>
      <span class="system-check-state">${check.status}</span>
    </li>
  `).join("");
  elements.exportCrossDomainAuditButton.disabled = false;
}

async function runCrossDomainAudit() {
  elements.runCrossDomainAuditButton.disabled = true;
  elements.crossDomainAuditSummary.textContent = "Auditing domain adapters, release contracts, fallbacks, and scientific workflow parity...";
  let releaseMetadata = null;
  try {
    const response = await fetch("./release.json", { cache: "no-store" });
    if (response.ok) releaseMetadata = await response.json();
  } catch {
    releaseMetadata = null;
  }
  state.crossDomainAudit = runCrossDomainConsistencyAudit({ releaseMetadata });
  renderCrossDomainAudit();
  elements.runCrossDomainAuditButton.disabled = false;
}

function exportCrossDomainAudit() {
  if (!state.crossDomainAudit) return;
  const stem = `lumos-cross-domain-audit-${state.crossDomainAudit.checksum}`;
  downloadJson(`${stem}.json`, state.crossDomainAudit);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToCrossDomainAuditCsv(crossDomainAuditRows(state.crossDomainAudit)), "text/csv;charset=utf-8"), 120);
}

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function formatUsd(value) {
  return USD_FORMATTER.format(Number(value) || 0);
}

function markCrossDomainBudgetDirty() {
  state.crossDomainAllocation = null;
  elements.exportCrossDomainBudgetButton.disabled = true;
  elements.crossDomainBudgetStatus.textContent = "Budget assumptions changed. Allocate the shared budget again to refresh the portfolio.";
  renderCrossDomainBudgetResult();
}

function renderCrossDomainBudgetControls() {
  const config = state.crossDomainBudgetConfig;
  elements.crossDomainBudget.value = String(config.totalBudget);
  elements.crossDomainReserve.value = String(Math.round(config.reserveFraction * 100));
  elements.crossDomainReserveValue.value = `${Math.round(config.reserveFraction * 100)}%`;
  elements.crossDomainRequireAll.checked = config.requireAllDomains;
  elements.crossDomainBudgetControls.innerHTML = PUBLIC_DOMAIN_ENTRIES.map((entry) => {
    const domain = config.domains[entry.key];
    return `
      <article class="cross-domain-budget-card" data-budget-domain="${entry.key}">
        <div class="budget-card-heading">
          <label><input type="checkbox" data-budget-field="enabled" ${domain.enabled ? "checked" : ""}> <strong>${entry.displayName}</strong></label>
          <small>${entry.planning.unitLabel}</small>
        </div>
        <label><span>Unit cost</span><input type="number" data-budget-field="unitCost" min="50" step="50" value="${domain.unitCost}"></label>
        <label><span>Minimum units</span><input type="number" data-budget-field="minimumUnits" min="1" max="50" step="1" value="${domain.minimumUnits}"></label>
        <label><span>Maximum units</span><input type="number" data-budget-field="maximumUnits" min="1" max="60" step="1" value="${domain.maximumUnits}"></label>
        <label class="budget-priority-row"><span>Priority <output>${domain.priority.toFixed(2)}</output></span><input type="range" data-budget-field="priority" min="0.25" max="3" step="0.05" value="${domain.priority}"></label>
      </article>`;
  }).join("");
  elements.crossDomainBudgetControls.querySelectorAll("[data-budget-field]").forEach((input) => {
    input.addEventListener("input", () => {
      if (input.dataset.budgetField === "priority") input.closest("label").querySelector("output").value = Number(input.value).toFixed(2);
      markCrossDomainBudgetDirty();
    });
    input.addEventListener("change", markCrossDomainBudgetDirty);
  });
}

function readCrossDomainBudgetConfig() {
  const domains = {};
  elements.crossDomainBudgetControls.querySelectorAll("[data-budget-domain]").forEach((card) => {
    const domainKey = card.dataset.budgetDomain;
    const field = (name) => card.querySelector(`[data-budget-field="${name}"]`);
    domains[domainKey] = {
      enabled: field("enabled").checked,
      unitCost: Number(field("unitCost").value),
      minimumUnits: Number(field("minimumUnits").value),
      maximumUnits: Number(field("maximumUnits").value),
      priority: Number(field("priority").value)
    };
  });
  state.crossDomainBudgetConfig = normalizeCrossDomainBudgetConfig({
    totalBudget: Number(elements.crossDomainBudget.value),
    reserveFraction: Number(elements.crossDomainReserve.value) / 100,
    requireAllDomains: elements.crossDomainRequireAll.checked,
    domains
  });
  return state.crossDomainBudgetConfig;
}

function activeCrossDomainAllocation() {
  return state.crossDomainAllocation?.portfolio.find((allocation) => allocation.profileKey === state.activeCrossDomainProfile)
    ?? state.crossDomainAllocation?.portfolio[0]
    ?? null;
}

function renderCrossDomainBudgetResult() {
  const visible = state.domainKey === "core";
  elements.unifiedBudgetSection.hidden = !visible;
  elements.crossDomainBudgetResultSection.hidden = !visible;
  if (!visible) return;
  const result = state.crossDomainAllocation;
  if (!result) {
    elements.crossDomainBudgetResultStatus.textContent = "Not run";
    elements.crossDomainBudgetResultStatus.className = "status-pill";
    elements.crossDomainBudgetPortfolio.innerHTML = '<option value="">No allocation yet</option>';
    elements.crossDomainBudgetPortfolio.disabled = true;
    elements.crossDomainBudgetResultSummary.textContent = "Allocate the shared budget to compare alternative program-level tradeoffs.";
    elements.crossDomainBudgetMetrics.innerHTML = "";
    elements.crossDomainBudgetTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">Shared budget has not been allocated.</td></tr>';
    return;
  }
  if (!result.ready) {
    elements.crossDomainBudgetResultStatus.textContent = "Budget infeasible";
    elements.crossDomainBudgetResultStatus.className = "status-pill fail";
    elements.crossDomainBudgetPortfolio.innerHTML = '<option value="">No feasible portfolio</option>';
    elements.crossDomainBudgetPortfolio.disabled = true;
    elements.crossDomainBudgetResultSummary.textContent = `${result.reason} Increase the allocatable budget by ${formatUsd(result.shortfall)} or adjust enabled domains, minimum units, costs, or reserve.`;
    elements.crossDomainBudgetMetrics.innerHTML = `
      <article><span>Total budget</span><strong>${formatUsd(result.config.totalBudget)}</strong></article>
      <article><span>Allocatable</span><strong>${formatUsd(result.allocatableBudget)}</strong></article>
      <article><span>Minimum required</span><strong>${formatUsd(result.requiredMinimumCost)}</strong></article>`;
    elements.crossDomainBudgetTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No feasible allocation under the active minimum-program rule.</td></tr>';
    return;
  }
  const active = activeCrossDomainAllocation();
  state.activeCrossDomainProfile = active.profileKey;
  elements.crossDomainBudgetResultStatus.textContent = active.paretoOptimal ? "Nondominated" : "Portfolio alternative";
  elements.crossDomainBudgetResultStatus.className = `status-pill ${active.paretoOptimal ? "pass" : "warn"}`;
  elements.crossDomainBudgetPortfolio.disabled = false;
  elements.crossDomainBudgetPortfolio.innerHTML = result.portfolio.map((allocation) => `
    <option value="${allocation.profileKey}">${allocation.profile.label}${allocation.paretoOptimal ? " · Pareto" : ""}</option>`).join("");
  elements.crossDomainBudgetPortfolio.value = active.profileKey;
  elements.crossDomainBudgetResultSummary.textContent = `${active.profile.description} ${formatUsd(active.metrics.committedCost)} is committed from ${formatUsd(result.config.totalBudget)}; ${result.evaluatedAllocations.toLocaleString()} feasible integer allocations were evaluated.`;
  elements.crossDomainBudgetMetrics.innerHTML = `
    <article><span>Committed</span><strong>${formatUsd(active.metrics.committedCost)}</strong></article>
    <article><span>Protected reserve</span><strong>${formatUsd(active.metrics.statutoryReserve)}</strong></article>
    <article><span>Uncommitted</span><strong>${formatUsd(active.metrics.uncommitted)}</strong></article>
    <article><span>Normalized benefit</span><strong>${(100 * active.metrics.composite).toFixed(1)}%</strong></article>
    <article><span>Worst domain</span><strong>${(100 * active.metrics.worstDomainBenefit).toFixed(1)}%</strong></article>
    <article><span>Balance gap</span><strong>${(100 * active.metrics.balanceGap).toFixed(1)} pp</strong></article>`;
  elements.crossDomainBudgetTableBody.innerHTML = active.metrics.programs.map((program) => {
    const share = active.metrics.committedCost > 0 ? program.cost / active.metrics.committedCost : 0;
    return `<tr class="${program.units ? "" : "muted-row"}">
      <td>${domainDisplayName(program.domainKey)}</td>
      <td>${program.units}</td>
      <td>${formatUsd(program.cost)}</td>
      <td>${(100 * share).toFixed(1)}%</td>
      <td>${(100 * program.composite).toFixed(1)}%</td>
      <td>${(100 * program.dimensions.reliability).toFixed(1)}%</td>
    </tr>`;
  }).join("");
}

function runCrossDomainBudgetAllocation() {
  elements.runCrossDomainBudgetButton.disabled = true;
  const config = readCrossDomainBudgetConfig();
  state.crossDomainAllocation = allocateCrossDomainBudget(config);
  state.activeCrossDomainProfile = "balanced";
  renderCrossDomainBudgetResult();
  elements.exportCrossDomainBudgetButton.disabled = !state.crossDomainAllocation.ready;
  elements.crossDomainBudgetStatus.textContent = state.crossDomainAllocation.ready
    ? `${state.crossDomainAllocation.portfolio.length} allocation profiles · ${state.crossDomainAllocation.evaluatedAllocations.toLocaleString()} feasible combinations · checksum ${state.crossDomainAllocation.checksum}.`
    : `${state.crossDomainAllocation.reason} Shortfall: ${formatUsd(state.crossDomainAllocation.shortfall)}.`;
  elements.runStatus.textContent = state.crossDomainAllocation.ready
    ? `Shared budget allocated · ${state.crossDomainAllocation.evaluatedAllocations.toLocaleString()} feasible combinations evaluated`
    : "Shared budget is infeasible under the active minimum-program assumptions.";
  if (elements.spatialAllocationSource.value === "initial") {
    writeSpatialUnitInputs(spatialUnitsFromAllocationSource("initial"));
    markSpatialDeploymentDirty("Initial allocation changed. Rerun coordinated deployment.");
  }
  elements.runCrossDomainBudgetButton.disabled = false;
}

function resetCrossDomainBudgetAllocation() {
  state.crossDomainBudgetConfig = normalizeCrossDomainBudgetConfig(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG);
  state.crossDomainAllocation = null;
  state.activeCrossDomainProfile = "balanced";
  renderCrossDomainBudgetControls();
  elements.exportCrossDomainBudgetButton.disabled = true;
  elements.crossDomainBudgetStatus.textContent = "Default illustrative costs and minimum-program assumptions restored.";
  renderCrossDomainBudgetResult();
}

function exportCrossDomainBudgetAllocation() {
  const result = state.crossDomainAllocation;
  if (!result?.ready) return;
  const stem = `lumos-cross-domain-budget-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToCrossDomainAllocationCsv(crossDomainAllocationRows(result)), "text/csv;charset=utf-8"), 120);
}

function markSequentialReallocationDirty(message = "Sequential assumptions changed. Allocate the next round again to refresh the portfolio.") {
  state.sequentialReallocation = null;
  elements.exportSequentialReallocationButton.disabled = true;
  elements.sequentialReallocationStatus.textContent = message;
  renderSequentialReallocationResult();
  markAdaptiveSimulationDirty("Evidence or sequential assumptions changed. Rerun the multi-round simulation.");
}

function renderSequentialDomainControls() {
  const config = state.sequentialReallocationConfig;
  elements.sequentialRoundBudget.value = String(config.nextRoundBudget);
  elements.sequentialReserve.value = String(Math.round(config.reserveFraction * 100));
  elements.sequentialReserveValue.value = `${Math.round(config.reserveFraction * 100)}%`;
  elements.sequentialLearningRate.value = String(config.learningRate);
  elements.sequentialLearningRateValue.value = config.learningRate.toFixed(2);
  elements.sequentialExploration.value = String(Math.round(config.explorationFraction * 100));
  elements.sequentialExplorationValue.value = `${Math.round(config.explorationFraction * 100)}%`;
  elements.sequentialMinimumEquity.value = String(config.minimumEquity);
  elements.sequentialMinimumReliability.value = String(config.minimumReliability);
  elements.sequentialMinimumIntervention.value = String(config.minimumIntervention);
  elements.sequentialDomainControls.innerHTML = PUBLIC_DOMAIN_ENTRIES.map((entry) => {
    const domain = config.domains[entry.key];
    const evidence = state.crossDomainEvidenceBundle.domains[entry.key];
    return `
      <article class="sequential-domain-card" data-sequential-domain="${entry.key}">
        <div class="sequential-domain-heading">
          <label><input type="checkbox" data-sequential-field="enabled" ${domain.enabled ? "checked" : ""}> <strong>${entry.displayName}</strong></label>
          <small>${evidence.recordCount ? `${evidence.recordCount} evidence record${evidence.recordCount === 1 ? "" : "s"}` : "registry prior"}</small>
        </div>
        <label><span>Existing units</span><input type="number" data-sequential-field="existingUnits" min="0" max="60" step="1" value="${domain.existingUnits}"></label>
        <label><span>Unit cost</span><input type="number" data-sequential-field="unitCost" min="50" step="50" value="${domain.unitCost}"></label>
        <label><span>Maximum total</span><input type="number" data-sequential-field="maximumTotalUnits" min="1" max="60" step="1" value="${domain.maximumTotalUnits}"></label>
        <label class="budget-priority-row"><span>Priority <output>${domain.priority.toFixed(2)}</output></span><input type="range" data-sequential-field="priority" min="0.25" max="3" step="0.05" value="${domain.priority}"></label>
      </article>`;
  }).join("");
  elements.sequentialDomainControls.querySelectorAll("[data-sequential-field]").forEach((input) => {
    input.addEventListener("input", () => {
      if (input.dataset.sequentialField === "priority") input.closest("label").querySelector("output").value = Number(input.value).toFixed(2);
      markSequentialReallocationDirty();
    });
    input.addEventListener("change", () => markSequentialReallocationDirty());
  });
}

function readSequentialReallocationConfig() {
  const domains = {};
  elements.sequentialDomainControls.querySelectorAll("[data-sequential-domain]").forEach((card) => {
    const domainKey = card.dataset.sequentialDomain;
    const field = (name) => card.querySelector(`[data-sequential-field="${name}"]`);
    domains[domainKey] = {
      enabled: field("enabled").checked,
      existingUnits: Number(field("existingUnits").value),
      unitCost: Number(field("unitCost").value),
      maximumTotalUnits: Number(field("maximumTotalUnits").value),
      priority: Number(field("priority").value)
    };
  });
  state.sequentialReallocationConfig = normalizeSequentialReallocationConfig({
    nextRoundBudget: Number(elements.sequentialRoundBudget.value),
    reserveFraction: Number(elements.sequentialReserve.value) / 100,
    explorationFraction: Number(elements.sequentialExploration.value) / 100,
    learningRate: Number(elements.sequentialLearningRate.value),
    requireAllDomains: true,
    minimumEquity: Number(elements.sequentialMinimumEquity.value),
    minimumReliability: Number(elements.sequentialMinimumReliability.value),
    minimumIntervention: Number(elements.sequentialMinimumIntervention.value),
    domains
  }, state.crossDomainEvidenceBundle);
  return state.sequentialReallocationConfig;
}

function renderSequentialEvidence() {
  const bundle = state.crossDomainEvidenceBundle;
  elements.sequentialEvidenceCards.innerHTML = PUBLIC_DOMAIN_ENTRIES.map((entry) => {
    const evidence = bundle.domains[entry.key];
    return `<article class="sequential-evidence-card">
      <strong>${entry.displayName}</strong>
      <span>${evidence.recordCount ? `${evidence.recordCount} workspace record${evidence.recordCount === 1 ? "" : "s"}` : "Registry prior only"}</span>
      <small>Strength ${(100 * evidence.evidenceStrength).toFixed(0)}% · residual need ${(100 * evidence.residualNeed).toFixed(0)}%</small>
      <small>Yield ${evidence.normalizedYield.toFixed(2)}x · reliability ${(100 * evidence.meanReliability).toFixed(0)}%</small>
    </article>`;
  }).join("");
  elements.sequentialEvidenceSummary.textContent = bundle.recordCount
    ? `${bundle.label} · ${bundle.recordCount} record${bundle.recordCount === 1 ? "" : "s"} across ${bundle.evidenceDomainCount} domain${bundle.evidenceDomainCount === 1 ? "" : "s"} · checksum ${bundle.checksum}.`
    : "No saved evidence loaded. The allocator will use registry priors and the declared existing network.";
}

function applySequentialEvidenceBundle(bundle, message) {
  state.crossDomainEvidenceBundle = bundle;
  const current = state.sequentialReallocationConfig;
  const domains = Object.fromEntries(PUBLIC_DOMAIN_ENTRIES.map((entry) => {
    const evidence = bundle.domains[entry.key];
    const existing = current.domains[entry.key];
    return [entry.key, {
      ...existing,
      existingUnits: evidence.recordCount ? evidence.deployedUnits : existing.existingUnits
    }];
  }));
  state.sequentialReallocationConfig = normalizeSequentialReallocationConfig({ ...current, domains }, bundle);
  renderSequentialDomainControls();
  renderSequentialEvidence();
  markSequentialReallocationDirty(message);
}

async function loadSavedWorkspaceEvidence() {
  elements.loadSavedEvidenceButton.disabled = true;
  try {
    const saved = await listSavedWorkspaces();
    const records = [];
    for (const entry of saved) {
      try {
        const snapshot = await loadWorkspaceSnapshot(entry.key);
        if (snapshot) records.push(createWorkspaceEvidenceRecord(snapshot));
      } catch (error) {
        console.warn(`Unable to summarize saved workspace ${entry.key}.`, error);
      }
    }
    const bundle = createEvidenceBundle(records, { label: "Saved browser-workspace evidence" });
    applySequentialEvidenceBundle(bundle, records.length
      ? `${records.length} saved workspace evidence record${records.length === 1 ? "" : "s"} loaded. Review existing units before allocating.`
      : "No compatible named workspaces were found. Save domain workspaces first or use the controlled example.");
  } catch (error) {
    console.error("Unable to list saved workspace evidence.", error);
    elements.sequentialReallocationStatus.textContent = `Saved workspace evidence could not be loaded: ${error.message}`;
  } finally {
    elements.loadSavedEvidenceButton.disabled = false;
  }
}

async function useCurrentWorkspaceEvidence() {
  let snapshot = isPublicDomain(state.domainKey) ? currentWorkspaceSnapshot() : null;
  if (!snapshot) snapshot = await loadAutosavedWorkspace();
  if (!snapshot) {
    elements.sequentialReallocationStatus.textContent = "No compatible current or autosaved domain workspace is available.";
    return;
  }
  try {
    const record = createWorkspaceEvidenceRecord(snapshot);
    const records = [...state.crossDomainEvidenceBundle.records.filter((entry) => entry.workspaceId !== record.workspaceId), record];
    applySequentialEvidenceBundle(createEvidenceBundle(records, { label: "Current and loaded workspace evidence" }), `${domainDisplayName(record.domainKey)} workspace evidence added.`);
  } catch (error) {
    elements.sequentialReallocationStatus.textContent = `Workspace evidence could not be added: ${error.message}`;
  }
}

function useIllustrativeSequentialEvidence() {
  applySequentialEvidenceBundle(createIllustrativeEvidenceBundle(), "Controlled illustrative evidence loaded. It is synthetic and must not be described as observed deployment evidence.");
}

function clearSequentialEvidence() {
  applySequentialEvidenceBundle(createEvidenceBundle([], { label: "Registry-prior only" }), "Workspace evidence cleared. The next run will use registry priors and declared existing units.");
}

function activeSequentialAllocation() {
  return state.sequentialReallocation?.portfolio.find((allocation) => allocation.profileKey === state.activeSequentialProfile)
    ?? state.sequentialReallocation?.portfolio[0]
    ?? null;
}

function renderSequentialReallocationResult() {
  const visible = state.domainKey === "core";
  elements.sequentialReallocationSection.hidden = !visible;
  elements.sequentialResultSection.hidden = !visible;
  if (!visible) return;
  const result = state.sequentialReallocation;
  if (!result) {
    elements.sequentialResultStatus.textContent = "Not run";
    elements.sequentialResultStatus.className = "status-pill";
    elements.sequentialPortfolio.innerHTML = '<option value="">No sequential plan yet</option>';
    elements.sequentialPortfolio.disabled = true;
    elements.sequentialResultSummary.textContent = "Load evidence or use declared priors, then allocate the next funding round.";
    elements.sequentialMetrics.innerHTML = "";
    elements.sequentialTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Sequential reallocation has not run.</td></tr>';
    return;
  }
  if (!result.ready) {
    elements.sequentialResultStatus.textContent = "Round infeasible";
    elements.sequentialResultStatus.className = "status-pill fail";
    elements.sequentialPortfolio.innerHTML = '<option value="">No sequential plan</option>';
    elements.sequentialPortfolio.disabled = true;
    elements.sequentialResultSummary.textContent = `${result.reason}${result.shortfall ? ` Increase the allocatable round budget by ${formatUsd(result.shortfall)}.` : ""}`;
    elements.sequentialMetrics.innerHTML = `
      <article><span>Round budget</span><strong>${formatUsd(result.config.nextRoundBudget)}</strong></article>
      <article><span>Allocatable</span><strong>${formatUsd(result.allocatableBudget)}</strong></article>
      <article><span>Required minimum</span><strong>${formatUsd(result.requiredMinimumCost)}</strong></article>`;
    elements.sequentialTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No next-round allocation satisfies the displayed bounds.</td></tr>';
    return;
  }
  const active = activeSequentialAllocation();
  state.activeSequentialProfile = active.profileKey;
  const fullyFeasible = active.constraintStatus === "feasible";
  elements.sequentialResultStatus.textContent = fullyFeasible ? (active.paretoOptimal ? "Feasible · Pareto" : "Feasible") : "Nearest tested plan";
  elements.sequentialResultStatus.className = `status-pill ${fullyFeasible ? "pass" : "warn"}`;
  elements.sequentialPortfolio.disabled = false;
  elements.sequentialPortfolio.innerHTML = result.portfolio.map((allocation) => `
    <option value="${allocation.profileKey}">${allocation.profile.label}${allocation.paretoOptimal ? " · Pareto" : ""}${allocation.constraintStatus === "feasible" ? "" : " · nearest"}</option>`).join("");
  elements.sequentialPortfolio.value = active.profileKey;
  elements.sequentialResultSummary.textContent = `${active.profile.description} ${formatUsd(active.metrics.addedCost)} is committed from the ${formatUsd(result.config.nextRoundBudget)} next round. ${result.evaluatedAllocations.toLocaleString()} combinations were tested; ${result.feasibleAllocations.toLocaleString()} satisfied every displayed floor.`;
  elements.sequentialMetrics.innerHTML = `
    <article><span>Added funding</span><strong>${formatUsd(active.metrics.addedCost)}</strong></article>
    <article><span>Protected reserve</span><strong>${formatUsd(active.metrics.statutoryReserve)}</strong></article>
    <article><span>Uncommitted</span><strong>${formatUsd(active.metrics.uncommitted)}</strong></article>
    <article><span>Incremental benefit</span><strong>${(100 * active.metrics.incrementalComposite).toFixed(1)}%</strong></article>
    <article><span>Worst domain</span><strong>${(100 * active.metrics.worstDomainBenefit).toFixed(1)}%</strong></article>
    <article><span>Evidence records</span><strong>${result.evidenceBundle.recordCount}</strong></article>`;
  elements.sequentialTableBody.innerHTML = active.metrics.programs.map((program) => `<tr class="${program.additionalUnits ? "" : "muted-row"}">
    <td>${domainDisplayName(program.domainKey)}</td>
    <td>${program.existingUnits}</td>
    <td>+${program.additionalUnits}</td>
    <td>${program.totalUnits}</td>
    <td>${(100 * program.evidence.evidenceStrength).toFixed(0)}%</td>
    <td>${(100 * program.evidence.residualNeed).toFixed(0)}%</td>
    <td>${formatUsd(program.addedCost)}</td>
  </tr>`).join("");
}

function runSequentialReallocation() {
  elements.runSequentialReallocationButton.disabled = true;
  const config = readSequentialReallocationConfig();
  state.sequentialReallocation = allocateSequentialFundingRound(config, state.crossDomainEvidenceBundle);
  state.activeSequentialProfile = "balanced";
  renderSequentialReallocationResult();
  elements.exportSequentialReallocationButton.disabled = !state.sequentialReallocation.ready;
  elements.sequentialReallocationStatus.textContent = state.sequentialReallocation.ready
    ? `${state.sequentialReallocation.portfolio.length} profiles · ${state.sequentialReallocation.evaluatedAllocations.toLocaleString()} tested combinations · ${state.sequentialReallocation.feasibleAllocations.toLocaleString()} floor-feasible · checksum ${state.sequentialReallocation.checksum}.`
    : `${state.sequentialReallocation.reason}${state.sequentialReallocation.shortfall ? ` Shortfall: ${formatUsd(state.sequentialReallocation.shortfall)}.` : ""}`;
  elements.runStatus.textContent = state.sequentialReallocation.ready
    ? `Next funding round allocated · ${state.sequentialReallocation.evidenceMode}`
    : "Sequential funding round is infeasible under the displayed assumptions.";
  if (elements.spatialAllocationSource.value === "sequential") {
    writeSpatialUnitInputs(spatialUnitsFromAllocationSource("sequential"));
    markSpatialDeploymentDirty("Sequential allocation changed. Rerun coordinated deployment.");
  }
  elements.runSequentialReallocationButton.disabled = false;
}

function exportSequentialReallocation() {
  const result = state.sequentialReallocation;
  if (!result?.ready) return;
  const stem = `lumos-sequential-reallocation-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToSequentialReallocationCsv(sequentialReallocationRows(result)), "text/csv;charset=utf-8"), 120);
}

function markAdaptiveSimulationDirty(message = "Simulation assumptions changed. Rerun the multi-round comparison.") {
  state.adaptiveProgramSimulation = null;
  markRobustPolicyDirty("Trajectory or evidence assumptions changed. Rerun the robust ensemble.");
  elements.exportAdaptiveSimulationButton.disabled = true;
  elements.adaptiveSimulationStatus.textContent = message;
  renderAdaptiveProgramSimulationResult();
}

function readAdaptiveProgramSimulationConfig() {
  const sequential = readSequentialReallocationConfig();
  state.adaptiveProgramSimulationConfig = normalizeAdaptiveProgramSimulationConfig({
    ...sequential,
    rounds: Number(elements.adaptiveSimulationRounds.value),
    roundBudget: Number(elements.adaptiveSimulationBudget.value),
    budgetGrowthRate: Number(elements.adaptiveSimulationGrowth.value) / 100,
    responseScenario: elements.adaptiveSimulationScenario.value,
    transitionRate: Number(elements.adaptiveSimulationTransition.value),
    discountFactor: Number(elements.adaptiveSimulationDiscount.value)
  }, state.crossDomainEvidenceBundle);
  return state.adaptiveProgramSimulationConfig;
}

function activeAdaptiveTrajectory() {
  return state.adaptiveProgramSimulation?.trajectories.find((trajectory) => trajectory.trajectoryKey === state.activeAdaptiveTrajectory)
    ?? state.adaptiveProgramSimulation?.trajectories[0]
    ?? null;
}

function renderAdaptiveProgramSimulationResult() {
  const visible = state.domainKey === "core";
  elements.adaptiveSimulationSection.hidden = !visible;
  elements.adaptiveSimulationResultSection.hidden = !visible;
  if (!visible) return;
  const result = state.adaptiveProgramSimulation;
  if (!result) {
    elements.adaptiveSimulationResultStatus.textContent = "Not run";
    elements.adaptiveSimulationResultStatus.className = "status-pill";
    elements.adaptiveSimulationTrajectory.innerHTML = '<option value="">No simulation yet</option>';
    elements.adaptiveSimulationTrajectory.disabled = true;
    elements.adaptiveSimulationResultSummary.textContent = "Run the multi-round simulation to compare complete funding paths.";
    elements.adaptiveSimulationMetrics.innerHTML = "";
    elements.adaptiveSimulationTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Multi-round simulation has not run.</td></tr>';
    return;
  }
  const active = activeAdaptiveTrajectory();
  const complete = active?.complete;
  elements.adaptiveSimulationResultStatus.textContent = complete
    ? (active.trajectoryKey === result.bestTrajectoryKey ? "Best simulated path" : (active.paretoOptimal ? "Complete · Pareto" : "Complete"))
    : "Incomplete path";
  elements.adaptiveSimulationResultStatus.className = `status-pill ${complete ? "pass" : "warn"}`;
  elements.adaptiveSimulationTrajectory.disabled = false;
  elements.adaptiveSimulationTrajectory.innerHTML = result.trajectories.map((trajectory) => `
    <option value="${trajectory.trajectoryKey}">${trajectory.policy.label}${trajectory.trajectoryKey === result.bestTrajectoryKey ? " · highest score" : ""}${trajectory.paretoOptimal ? " · Pareto" : ""}${trajectory.complete ? "" : " · incomplete"}</option>`).join("");
  elements.adaptiveSimulationTrajectory.value = active.trajectoryKey;
  elements.adaptiveSimulationResultSummary.textContent = `${active.policy.description} ${active.completedRounds} of ${result.config.rounds} rounds completed under the ${result.responseScenario.label.toLowerCase()} assumption. Cumulative funding committed: ${formatUsd(active.cumulativeCost)}.`;
  elements.adaptiveSimulationMetrics.innerHTML = `
    <article><span>Rounds completed</span><strong>${active.completedRounds}/${result.config.rounds}</strong></article>
    <article><span>Cumulative funding</span><strong>${formatUsd(active.cumulativeCost)}</strong></article>
    <article><span>Discounted increment</span><strong>${(100 * active.discountedIncrementalBenefit).toFixed(1)}</strong></article>
    <article><span>Terminal residual need</span><strong>${(100 * active.terminalResidualNeed).toFixed(1)}%</strong></article>
    <article><span>Terminal evidence</span><strong>${(100 * active.terminalEvidenceStrength).toFixed(1)}%</strong></article>
    <article><span>Trajectory score</span><strong>${active.score.toFixed(3)}</strong></article>`;
  elements.adaptiveSimulationTableBody.innerHTML = active.rounds.map((round) => {
    if (!round.ready) return `<tr><td>${round.roundIndex}</td><td colspan="5">${round.reason}</td><td>${formatUsd(round.shortfall)}</td></tr>`;
    const residualNeed = PUBLIC_DOMAIN_ENTRIES.reduce((sum, entry) => sum + round.evidenceAfterRound[entry.key].residualNeed, 0) / PUBLIC_DOMAIN_ENTRIES.length;
    return `<tr>
      <td>${round.roundIndex}</td>
      <td>${round.selectedProfileLabel}</td>
      <td>${formatUsd(round.budget)}</td>
      <td>${formatUsd(round.addedCost)}</td>
      <td>+${round.addedUnits}</td>
      <td>${(100 * round.incrementalComposite).toFixed(1)}%</td>
      <td>${(100 * residualNeed).toFixed(1)}%</td>
    </tr>`;
  }).join("");
}

function runAdaptiveProgramSimulation() {
  elements.runAdaptiveSimulationButton.disabled = true;
  try {
    const config = readAdaptiveProgramSimulationConfig();
    state.adaptiveProgramSimulation = simulateAdaptiveProgram(config, state.crossDomainEvidenceBundle);
    state.activeAdaptiveTrajectory = state.adaptiveProgramSimulation.bestTrajectoryKey ?? "adaptive";
    renderAdaptiveProgramSimulationResult();
    elements.exportAdaptiveSimulationButton.disabled = !state.adaptiveProgramSimulation.ready;
    elements.adaptiveSimulationStatus.textContent = `${state.adaptiveProgramSimulation.trajectories.length} trajectories · ${state.adaptiveProgramSimulation.completeTrajectories} complete · checksum ${state.adaptiveProgramSimulation.checksum}.`;
    elements.runStatus.textContent = state.adaptiveProgramSimulation.ready
      ? `Multi-round trajectories simulated · ${state.adaptiveProgramSimulation.responseScenario.label}`
      : "No complete multi-round trajectory is feasible under the displayed assumptions.";
  } finally {
    elements.runAdaptiveSimulationButton.disabled = false;
  }
}

function exportAdaptiveProgramSimulation() {
  const result = state.adaptiveProgramSimulation;
  if (!result?.ready) return;
  const stem = `lumos-adaptive-program-simulation-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToAdaptiveProgramSimulationCsv(adaptiveProgramSimulationRows(result)), "text/csv;charset=utf-8"), 120);
}

function markRobustPolicyDirty(message = "Uncertainty assumptions changed. Rerun the robust policy ensemble.") {
  state.robustPolicyEnsemble = null;
  if (elements.exportRobustPolicyButton) elements.exportRobustPolicyButton.disabled = true;
  if (elements.robustPolicyStatus) elements.robustPolicyStatus.textContent = message;
  if (elements.robustPolicyResultSection) renderRobustPolicyResult();
}

function readRobustPolicyConfig() {
  const adaptiveConfig = readAdaptiveProgramSimulationConfig();
  state.robustPolicyEnsembleConfig = normalizeRobustPolicyEnsembleConfig({
    ensembleSize: Number(elements.robustEnsembleSize.value),
    seed: Number(elements.robustSeed.value),
    responseUncertainty: Number(elements.robustResponseUncertainty.value),
    costUncertainty: Number(elements.robustCostUncertainty.value),
    baseFailureRate: Number(elements.robustFailureRate.value),
    environmentalUncertainty: Number(elements.robustEnvironmentalUncertainty.value),
    riskAversion: Number(elements.robustRiskAversion.value),
    adaptiveConfig
  }, state.crossDomainEvidenceBundle);
  return state.robustPolicyEnsembleConfig;
}

function activeRobustPolicy() {
  return state.robustPolicyEnsemble?.policies.find((policy) => policy.trajectoryKey === state.activeRobustPolicy)
    ?? state.robustPolicyEnsemble?.policies[0]
    ?? null;
}

function renderRobustPolicyResult() {
  const visible = state.domainKey === "core";
  elements.robustPolicySection.hidden = !visible;
  elements.robustPolicyResultSection.hidden = !visible;
  if (!visible) return;
  const result = state.robustPolicyEnsemble;
  if (!result) {
    elements.robustPolicyResultStatus.textContent = "Not run";
    elements.robustPolicyResultStatus.className = "status-pill";
    elements.robustPolicyPortfolio.innerHTML = '<option value="">No ensemble yet</option>';
    elements.robustPolicyPortfolio.disabled = true;
    elements.robustPolicyResultSummary.textContent = "Run the uncertainty ensemble to compare expected performance, downside risk, feasibility, and regret.";
    elements.robustPolicyMetrics.innerHTML = "";
    elements.robustPolicyTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Robust policy ensemble has not run.</td></tr>';
    return;
  }
  const active = activeRobustPolicy();
  const isRobust = active?.trajectoryKey === result.robustPolicyKey;
  elements.robustPolicyResultStatus.textContent = isRobust ? "Robust recommendation" : (active?.paretoOptimal ? "Pareto policy" : "Compared policy");
  elements.robustPolicyResultStatus.className = `status-pill ${isRobust ? "pass" : "warn"}`;
  elements.robustPolicyPortfolio.disabled = false;
  elements.robustPolicyPortfolio.innerHTML = result.policies
    .slice()
    .sort((left, right) => right.robustScore - left.robustScore)
    .map((policy) => `<option value="${policy.trajectoryKey}">${policy.policy.label}${policy.trajectoryKey === result.robustPolicyKey ? " · robust" : ""}${policy.trajectoryKey === result.expectedValuePolicyKey ? " · expected" : ""}${policy.trajectoryKey === result.minimaxRegretPolicyKey ? " · minimax" : ""}</option>`)
    .join("");
  elements.robustPolicyPortfolio.value = active.trajectoryKey;
  elements.robustPolicyResultSummary.textContent = `${active.policy.description} Evaluated across ${result.config.ensembleSize} deterministic scenario draws. Expected utility ${(100 * active.expectedUtility).toFixed(1)}%; downside utility ${(100 * active.p10Utility).toFixed(1)}%; feasibility ${(100 * active.feasibilityProbability).toFixed(1)}%.`;
  elements.robustPolicyMetrics.innerHTML = `
    <article><span>Robust score</span><strong>${active.robustScore.toFixed(3)}</strong></article>
    <article><span>Expected utility</span><strong>${(100 * active.expectedUtility).toFixed(1)}%</strong></article>
    <article><span>10th percentile</span><strong>${(100 * active.p10Utility).toFixed(1)}%</strong></article>
    <article><span>Feasibility</span><strong>${(100 * active.feasibilityProbability).toFixed(1)}%</strong></article>
    <article><span>Maximum regret</span><strong>${(100 * active.maximumRegret).toFixed(1)}%</strong></article>
    <article><span>P90 cost</span><strong>${formatUsd(active.p90Cost)}</strong></article>`;
  elements.robustPolicyTableBody.innerHTML = result.policies
    .slice()
    .sort((left, right) => right.robustScore - left.robustScore)
    .map((policy) => `<tr>
      <td>${policy.policy.label}</td>
      <td>${policy.trajectoryKey === result.robustPolicyKey ? "Robust" : policy.paretoOptimal ? "Pareto" : "Compared"}</td>
      <td>${(100 * policy.expectedUtility).toFixed(1)}%</td>
      <td>${(100 * policy.p10Utility).toFixed(1)}%</td>
      <td>${(100 * policy.feasibilityProbability).toFixed(1)}%</td>
      <td>${(100 * policy.maximumRegret).toFixed(1)}%</td>
      <td>${formatUsd(policy.p90Cost)}</td>
    </tr>`).join("");
}

function runRobustPolicyEnsemble() {
  elements.runRobustPolicyButton.disabled = true;
  elements.robustPolicyStatus.textContent = "Running conservative, central, and optimistic anchors, then evaluating the uncertainty ensemble...";
  window.setTimeout(() => {
    try {
      const config = readRobustPolicyConfig();
      state.robustPolicyEnsemble = evaluateRobustPolicies(config, state.crossDomainEvidenceBundle);
      state.activeRobustPolicy = state.robustPolicyEnsemble.robustPolicyKey ?? "adaptive";
      renderRobustPolicyResult();
      elements.exportRobustPolicyButton.disabled = !state.robustPolicyEnsemble.ready;
      elements.robustPolicyStatus.textContent = `${state.robustPolicyEnsemble.config.ensembleSize} members · robust ${state.robustPolicyEnsemble.robustPolicyKey} · expected ${state.robustPolicyEnsemble.expectedValuePolicyKey} · checksum ${state.robustPolicyEnsemble.checksum}.`;
      elements.runStatus.textContent = `Robust policy ensemble complete · ${state.robustPolicyEnsemble.config.ensembleSize} members`;
    } catch (error) {
      elements.robustPolicyStatus.textContent = `Robust ensemble failed: ${error.message}`;
      elements.runStatus.textContent = `Robust policy ensemble failed: ${error.message}`;
    } finally {
      elements.runRobustPolicyButton.disabled = false;
    }
  }, 20);
}

function exportRobustPolicyEnsemble() {
  const result = state.robustPolicyEnsemble;
  if (!result?.ready) return;
  const stem = `lumos-robust-policy-ensemble-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToRobustPolicyEnsembleCsv(robustPolicyEnsembleRows(result)), "text/csv;charset=utf-8"), 120);
}

function spatialUnitsFromAllocationSource(source = elements.spatialAllocationSource.value) {
  if (source === "sequential") {
    const active = activeSequentialAllocation();
    if (active?.metrics?.programs?.length) {
      return Object.fromEntries(active.metrics.programs.map((program) => [program.domainKey, program.totalUnits]));
    }
  }
  if (source === "initial") {
    const active = activeCrossDomainAllocation();
    if (active?.metrics?.programs?.length) {
      return Object.fromEntries(active.metrics.programs.map((program) => [program.domainKey, program.units]));
    }
  }
  return {
    heat: Number(elements.spatialHeatUnits.value),
    air: Number(elements.spatialAirUnits.value),
    soil: Number(elements.spatialSoilUnits.value),
    water: Number(elements.spatialWaterUnits.value)
  };
}

function writeSpatialUnitInputs(units) {
  elements.spatialHeatUnits.value = units.heat ?? 0;
  elements.spatialAirUnits.value = units.air ?? 0;
  elements.spatialSoilUnits.value = units.soil ?? 0;
  elements.spatialWaterUnits.value = units.water ?? 0;
  const manual = elements.spatialAllocationSource.value === "manual";
  for (const input of [elements.spatialHeatUnits, elements.spatialAirUnits, elements.spatialSoilUnits, elements.spatialWaterUnits]) {
    input.disabled = !manual;
  }
}

function syncSpatialUnitsFromAllocationSource() {
  writeSpatialUnitInputs(spatialUnitsFromAllocationSource());
  markSpatialDeploymentDirty("Allocation basis changed. Rerun coordinated deployment.");
}

function markSpatialDeploymentDirty(message = "Spatial assumptions changed. Rerun coordinated deployment.") {
  state.spatialDeployment = null;
  state.fieldCampaign = null;
  state.campaignOutcomeBundle = null;
  state.campaignTracking = null;
  state.commissioningEventBundle = null;
  state.commissioningOperations = null;
  elements.exportSpatialDeploymentButton.disabled = true;
  elements.exportFieldCampaignButton.disabled = true;
  elements.exportCampaignTrackingButton.disabled = true;
  elements.exportCommissioningButton.disabled = true;
  elements.spatialDeploymentStatus.textContent = message;
  elements.fieldCampaignStatus.textContent = "Coordinated deployment changed. Rerun site planning before field-campaign operations.";
  if (state.domainKey === "core") map.setResult(null);
  renderSpatialDeploymentResult();
  renderFieldCampaignResult();
  renderCampaignOutcomeSummary();
  renderCampaignTrackingResult();
  renderCommissioningEventSummary();
  renderCommissioningResult();
}

function renderHostInventorySummary() {
  const bundle = state.hostInventoryBundle;
  const source = elements.spatialHostSource.value;
  elements.spatialHostCount.disabled = source === "inventory";
  elements.exportHostInventoryReviewButton.disabled = !bundle;
  elements.clearHostInventoryButton.disabled = !bundle;
  if (!bundle) {
    elements.hostInventorySummary.textContent = source === "controlled"
      ? "Using the deterministic controlled proxy pool. No local host inventory is loaded."
      : "No host inventory loaded. Import CSV/JSON or load the controlled reviewed example before planning.";
    elements.hostInventoryMetrics.innerHTML = "";
    return;
  }
  const summary = bundle.summary;
  elements.hostInventorySummary.textContent = `${bundle.sourceName} · ${summary.total} accepted records · ${bundle.rejected.length} rejected rows · checksum ${bundle.checksum}.`;
  elements.hostInventoryMetrics.innerHTML = `
    <article><span>Verified</span><strong>${summary.byStatus.verified}</strong></article>
    <article><span>Conditional</span><strong>${summary.byStatus.conditional}</strong></article>
    <article><span>Unresolved</span><strong>${summary.byStatus.unresolved}</strong></article>
    <article><span>Infeasible</span><strong>${summary.byStatus.infeasible}</strong></article>`;
}

async function importHostInventoryFile() {
  const file = elements.hostInventoryFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    state.hostInventoryBundle = parseHostInventoryText(text, { sourceName: file.name, sourceType: "user-import" });
    elements.spatialHostSource.value = "inventory";
    elements.spatialFieldReviewPolicy.value = "verified-or-conditional";
    renderHostInventorySummary();
    markSpatialDeploymentDirty("Host inventory loaded. Review the summary and rerun coordinated deployment.");
  } catch (error) {
    elements.hostInventorySummary.textContent = `Host inventory import failed: ${error.message}`;
  } finally {
    elements.hostInventoryFile.value = "";
  }
}

function useIllustrativeHostInventory() {
  const bounds = map.getViewportBounds() ?? DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds;
  state.hostInventoryBundle = createIllustrativeHostInventory(bounds);
  elements.spatialHostSource.value = "inventory";
  elements.spatialFieldReviewPolicy.value = "verified-or-conditional";
  renderHostInventorySummary();
  markSpatialDeploymentDirty("Controlled reviewed-host example loaded. It is synthetic and not a real property inventory.");
}

function clearHostInventory() {
  state.hostInventoryBundle = null;
  elements.spatialHostSource.value = "controlled";
  elements.spatialFieldReviewPolicy.value = "all-not-denied";
  renderHostInventorySummary();
  markSpatialDeploymentDirty("Host inventory cleared. Controlled proxy planning restored.");
}

function downloadHostInventoryTemplate() {
  downloadText("lumos-host-inventory-template.csv", hostInventoryTemplateCsv(), "text/csv;charset=utf-8");
}

function exportHostInventoryReview() {
  const bundle = state.hostInventoryBundle;
  if (!bundle) return;
  const stem = `lumos-host-inventory-review-${bundle.checksum}`;
  downloadJson(`${stem}.json`, bundle);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToHostInventoryCsv(hostInventoryRows(bundle)), "text/csv;charset=utf-8"), 120);
}

function readSpatialDeploymentConfig() {
  const bounds = map.getViewportBounds() ?? DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds;
  state.spatialDeploymentConfig = normalizeSpatialDeploymentConfig({
    seed: Number(elements.spatialSeed.value),
    bounds,
    hostCount: Number(elements.spatialHostCount.value),
    sharedHostDiscount: Number(elements.spatialSharedDiscount.value),
    maximumDomainsPerHost: Number(elements.spatialMaxDomains.value),
    minimumCompatibility: Number(elements.spatialMinimumCompatibility.value),
    allocationSource: elements.spatialAllocationSource.value,
    hostSource: elements.spatialHostSource.value,
    fieldReviewPolicy: elements.spatialFieldReviewPolicy.value,
    hostInventory: state.hostInventoryBundle?.records ?? [],
    units: spatialUnitsFromAllocationSource()
  });
  return state.spatialDeploymentConfig;
}

function activeSpatialDeploymentPlan() {
  return state.spatialDeployment?.portfolio.find((plan) => plan.profileKey === state.activeSpatialDeploymentProfile)
    ?? state.spatialDeployment?.portfolio[0]
    ?? null;
}

function spatialMapSelection(plan) {
  return plan.sites.map((site) => ({
    ...site,
    interventionRole: site.assignments.length > 1 ? "boundary" : "supplemental",
    domainKeys: site.assignments.map((assignment) => assignment.domainKey),
    requiresFieldVerification: site.requiresFieldVerification
  }));
}

function renderSpatialDeploymentResult() {
  const visible = state.domainKey === "core";
  elements.spatialDeploymentSection.hidden = !visible;
  elements.spatialDeploymentResultSection.hidden = !visible;
  if (!visible) return;
  const result = state.spatialDeployment;
  if (!result) {
    elements.spatialDeploymentResultStatus.textContent = "Not run";
    elements.spatialDeploymentResultStatus.className = "status-pill";
    elements.spatialDeploymentPortfolio.innerHTML = '<option value="">No deployment plan yet</option>';
    elements.spatialDeploymentPortfolio.disabled = true;
    elements.spatialDeploymentResultSummary.textContent = "Run coordinated deployment to compare coverage, equity, reliability, savings, and correlated-failure tradeoffs.";
    elements.spatialDeploymentMetrics.innerHTML = "";
    elements.spatialDeploymentTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Coordinated deployment has not run.</td></tr>';
    return;
  }
  const active = activeSpatialDeploymentPlan();
  elements.spatialDeploymentResultStatus.textContent = active.complete ? (active.paretoOptimal ? "Complete · Pareto" : "Complete") : "Incomplete plan";
  elements.spatialDeploymentResultStatus.className = `status-pill ${active.complete ? "pass" : "fail"}`;
  elements.spatialDeploymentPortfolio.disabled = false;
  elements.spatialDeploymentPortfolio.innerHTML = result.portfolio.map((plan) => `<option value="${plan.profileKey}">${plan.profile.label}${plan.paretoOptimal ? " · Pareto" : ""}${plan.complete ? "" : " · incomplete"}</option>`).join("");
  elements.spatialDeploymentPortfolio.value = active.profileKey;
  const sourceLabel = result.hostSource === "controlled" ? "controlled proxy pool" : result.hostSource === "inventory" ? "imported host inventory" : "hybrid host pool";
  elements.spatialDeploymentResultSummary.textContent = `${active.profile.description} ${active.metrics.assignedUnits} domain units are assigned to ${active.metrics.physicalHostCount} physical hosts from the ${sourceLabel}, including ${active.metrics.sharedHostCount} shared hosts. The plan saves ${formatUsd(active.metrics.savings)} relative to independent installations.`;
  elements.spatialDeploymentMetrics.innerHTML = `
    <article><span>Physical hosts</span><strong>${active.metrics.physicalHostCount}</strong></article>
    <article><span>Shared hosts</span><strong>${active.metrics.sharedHostCount}</strong></article>
    <article><span>Modeled savings</span><strong>${formatUsd(active.metrics.savings)}</strong></article>
    <article><span>Mean coverage</span><strong>${formatPercent(active.metrics.meanCoverage)}</strong></article>
    <article><span>Worst domain</span><strong>${formatPercent(active.metrics.worstDomainCoverage)}</strong></article>
    <article><span>Failure coupling</span><strong>${formatPercent(active.metrics.correlatedFailureRisk)}</strong></article>
    <article><span>Verified assignments</span><strong>${formatPercent(active.metrics.verifiedAssignmentRate)}</strong></article>
    <article><span>Review policy</span><strong>${escapeHtml(result.fieldReviewPolicy)}</strong></article>`;
  elements.spatialDeploymentTableBody.innerHTML = active.sites.map((site) => {
    const domainLabels = site.assignments.map((assignment) => domainDisplayName(assignment.domainKey)).join(" + ");
    const roles = site.assignments.map((assignment) => assignment.role).join(" · ");
    const savings = site.assignments.reduce((sum, assignment) => sum + assignment.savings, 0);
    return `<tr>
      <td>${escapeHtml(site.label)}<br><small>${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}</small></td>
      <td>${domainLabels}</td>
      <td>${roles}</td>
      <td>${formatPercent(site.reliability)}</td>
      <td>${formatPercent(site.equity)}</td>
      <td>${formatUsd(savings)}</td>
      <td>${escapeHtml(site.reviewStatus ?? "unresolved")}<br><small>permission ${escapeHtml(site.permissionStatus ?? "unverified")} · safety ${escapeHtml(site.safetyStatus ?? "unverified")}</small></td>
    </tr>`;
  }).join("");
  map.setResult({ selected: spatialMapSelection(active) });
}

function runSpatialDeployment() {
  elements.runSpatialDeploymentButton.disabled = true;
  try {
    const config = readSpatialDeploymentConfig();
    if (config.hostSource !== "controlled" && !config.hostInventory.length) throw new Error("Load a host inventory or switch host source to controlled proxies.");
    state.spatialDeployment = planSpatialDeployment(config);
    state.fieldCampaign = null;
    state.campaignOutcomeBundle = null;
    state.campaignTracking = null;
    state.commissioningEventBundle = null;
    state.commissioningOperations = null;
    elements.exportFieldCampaignButton.disabled = true;
    elements.exportCampaignTrackingButton.disabled = true;
    elements.exportCommissioningButton.disabled = true;
    elements.fieldCampaignStatus.textContent = "Coordinated deployment updated. Plan a new inspection and reserve campaign.";
    state.activeSpatialDeploymentProfile = state.spatialDeployment.portfolio.find((plan) => plan.profileKey === "coordinated")?.profileKey
      ?? state.spatialDeployment.portfolio[0]?.profileKey
      ?? "coordinated";
    renderSpatialDeploymentResult();
    renderFieldCampaignResult();
    renderCampaignOutcomeSummary();
    renderCampaignTrackingResult();
    renderCommissioningEventSummary();
    renderCommissioningResult();
    elements.exportSpatialDeploymentButton.disabled = !state.spatialDeployment.ready;
    const complete = state.spatialDeployment.portfolio.filter((plan) => plan.complete).length;
    const review = state.spatialDeployment.hostReviewSummary;
    elements.spatialDeploymentStatus.textContent = `${state.spatialDeployment.hostPoolCount} hosts · ${review.byStatus.verified} verified · ${review.byStatus.conditional} conditional · ${complete}/${state.spatialDeployment.portfolio.length} complete profiles · checksum ${state.spatialDeployment.checksum}.`;
    elements.runStatus.textContent = `Coordinated cross-domain deployment complete · ${state.spatialDeployment.hostPoolCount} host proxies`;
  } catch (error) {
    elements.spatialDeploymentStatus.textContent = `Coordinated deployment failed: ${error.message}`;
    elements.runStatus.textContent = `Coordinated deployment failed: ${error.message}`;
  } finally {
    elements.runSpatialDeploymentButton.disabled = false;
  }
}

function exportSpatialDeployment() {
  const result = state.spatialDeployment;
  if (!result?.ready) return;
  const stem = `lumos-spatial-deployment-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToSpatialDeploymentCsv(spatialDeploymentRows(result)), "text/csv;charset=utf-8"), 120);
}

function markFieldCampaignDirty(message = "Field-campaign assumptions changed. Rerun the campaign plan.") {
  state.fieldCampaign = null;
  state.campaignOutcomeBundle = null;
  state.campaignTracking = null;
  state.commissioningEventBundle = null;
  state.commissioningOperations = null;
  elements.exportFieldCampaignButton.disabled = true;
  elements.exportCampaignTrackingButton.disabled = true;
  elements.exportCommissioningButton.disabled = true;
  elements.fieldCampaignStatus.textContent = message;
  elements.campaignTrackingStatus.textContent = "Field-campaign plan changed. Reload outcomes after replanning.";
  renderFieldCampaignResult();
  renderCampaignOutcomeSummary();
  renderCampaignTrackingResult();
  renderCommissioningEventSummary();
  renderCommissioningResult();
}

function readFieldCampaignConfig() {
  state.fieldCampaignConfig = normalizeFieldCampaignConfig({
    deploymentResult: state.spatialDeployment,
    deploymentProfileKey: state.activeSpatialDeploymentProfile,
    inspectionCapacityPerPhase: Number(elements.fieldCampaignCapacity.value),
    maximumPhases: Number(elements.fieldCampaignPhases.value),
    reserveRatio: Number(elements.fieldCampaignReserveRatio.value),
    responseScenario: elements.fieldCampaignScenario.value,
    deterministicSeed: Number(elements.fieldCampaignSeed.value),
    inspectionCostPerHost: Number(elements.fieldCampaignInspectionCost.value),
    reserveMobilizationCost: Number(elements.fieldCampaignReserveCost.value)
  });
  return state.fieldCampaignConfig;
}

function activeFieldCampaignPlan() {
  return state.fieldCampaign?.portfolio.find((campaign) => campaign.profileKey === state.activeFieldCampaignProfile)
    ?? state.fieldCampaign?.portfolio[0]
    ?? null;
}

function renderFieldCampaignResult() {
  const visible = state.domainKey === "core";
  elements.fieldCampaignSection.hidden = !visible;
  elements.fieldCampaignResultSection.hidden = !visible;
  if (!visible) return;
  const result = state.fieldCampaign;
  if (!result) {
    elements.fieldCampaignResultStatus.textContent = "Not run";
    elements.fieldCampaignResultStatus.className = "status-pill";
    elements.fieldCampaignPortfolio.innerHTML = '<option value="">No field campaign yet</option>';
    elements.fieldCampaignPortfolio.disabled = true;
    elements.fieldCampaignResultSummary.textContent = "Plan a field campaign to compare inspection urgency, reserve coverage, replacement recovery, and operational resilience.";
    elements.fieldCampaignMetrics.innerHTML = "";
    elements.fieldCampaignTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Field campaign has not run.</td></tr>';
    return;
  }
  const active = activeFieldCampaignPlan();
  elements.fieldCampaignResultStatus.textContent = active.complete ? (active.paretoOptimal ? "Protected · Pareto" : "Protected") : "Residual gaps";
  elements.fieldCampaignResultStatus.className = `status-pill ${active.complete ? "pass" : "fail"}`;
  elements.fieldCampaignPortfolio.disabled = false;
  elements.fieldCampaignPortfolio.innerHTML = result.portfolio.map((campaign) => `<option value="${campaign.profileKey}">${campaign.profile.label}${campaign.paretoOptimal ? " · Pareto" : ""}${campaign.complete ? "" : " · gaps"}</option>`).join("");
  elements.fieldCampaignPortfolio.value = active.profileKey;
  elements.fieldCampaignResultSummary.textContent = `${active.profile.description} ${active.metrics.scheduledInspections} inspections are scheduled across ${active.metrics.inspectionPhasesUsed} phase${active.metrics.inspectionPhasesUsed === 1 ? "" : "s"}, with ${active.metrics.reserveCount} reserve assignments and ${active.metrics.recoveredAssignments}/${active.metrics.replacementDemand} simulated failed assignments recovered.`;
  elements.fieldCampaignMetrics.innerHTML = `
    <article><span>Queued hosts</span><strong>${active.metrics.queuedHosts}</strong></article>
    <article><span>Scheduled</span><strong>${active.metrics.scheduledInspections}</strong></article>
    <article><span>Rejected primaries</span><strong>${active.metrics.rejectedHosts}</strong></article>
    <article><span>Reserve assignments</span><strong>${active.metrics.reserveCount}</strong></article>
    <article><span>Recovery rate</span><strong>${formatPercent(active.metrics.replacementRecoveryRate)}</strong></article>
    <article><span>Operational resilience</span><strong>${formatPercent(active.metrics.operationalResilience)}</strong></article>
    <article><span>Residual gaps</span><strong>${active.metrics.unresolvedAssignments}</strong></article>
    <article><span>Campaign cost</span><strong>${formatUsd(active.metrics.campaignCost)}</strong></article>`;
  const reserveByPrimaryDomain = new Map(active.reserves.map((reserve) => [`${reserve.primaryHostId}:${reserve.domainKey}`, reserve]));
  elements.fieldCampaignTableBody.innerHTML = active.inspections.map((inspection) => {
    const domains = inspection.assignments.map((assignment) => domainDisplayName(assignment.domainKey)).join(" + ");
    const reserveLabels = inspection.assignments.map((assignment) => reserveByPrimaryDomain.get(`${inspection.hostId}:${assignment.domainKey}`)?.label).filter(Boolean);
    return `<tr>
      <td>${inspection.phase ?? "—"}</td>
      <td>${escapeHtml(inspection.label)}</td>
      <td>${escapeHtml(domains)}</td>
      <td>${escapeHtml(inspection.reviewStatus)}</td>
      <td>${escapeHtml(inspection.outcome)}</td>
      <td>${formatPercent(inspection.failureProbability)}</td>
      <td>${reserveLabels.length ? escapeHtml(reserveLabels.join(" · ")) : "—"}</td>
    </tr>`;
  }).join("");
}

function runFieldCampaign() {
  elements.runFieldCampaignButton.disabled = true;
  try {
    if (!state.spatialDeployment?.ready) throw new Error("Run coordinated spatial deployment first.");
    state.fieldCampaign = planFieldCampaign(readFieldCampaignConfig());
    state.campaignOutcomeBundle = null;
    state.campaignTracking = null;
    state.commissioningEventBundle = null;
    state.commissioningOperations = null;
    state.activeFieldCampaignProfile = state.fieldCampaign.portfolio.find((campaign) => campaign.profileKey === "balanced")?.profileKey
      ?? state.fieldCampaign.portfolio[0]?.profileKey
      ?? "balanced";
    renderFieldCampaignResult();
    renderCampaignOutcomeSummary();
    renderCampaignTrackingResult();
    renderCommissioningEventSummary();
    renderCommissioningResult();
    elements.exportFieldCampaignButton.disabled = !state.fieldCampaign.ready;
    elements.exportCampaignTrackingButton.disabled = true;
    elements.exportCommissioningButton.disabled = true;
    const active = activeFieldCampaignPlan();
    elements.fieldCampaignStatus.textContent = `${state.fieldCampaign.responseScenarioLabel} · ${active.metrics.scheduledInspections} scheduled inspections · ${active.metrics.reserveCount} reserves · ${active.metrics.unresolvedAssignments} residual gaps · checksum ${state.fieldCampaign.checksum}.`;
    elements.runStatus.textContent = `Field campaign planned · ${active.metrics.scheduledInspections} inspections across ${active.metrics.inspectionPhasesUsed} phases`;
  } catch (error) {
    elements.fieldCampaignStatus.textContent = `Field-campaign planning failed: ${error.message}`;
    elements.runStatus.textContent = `Field-campaign planning failed: ${error.message}`;
  } finally {
    elements.runFieldCampaignButton.disabled = false;
  }
}

function exportFieldCampaign() {
  const result = state.fieldCampaign;
  if (!result?.ready) return;
  const stem = `lumos-field-campaign-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToFieldCampaignCsv(fieldCampaignRows(result)), "text/csv;charset=utf-8"), 120);
}

function activeCampaignTrackingProfileKey() {
  return elements.campaignTrackingProfile.value || state.activeFieldCampaignProfile || "balanced";
}

function syncCampaignTrackingControls() {
  const campaign = state.fieldCampaign;
  if (!campaign?.ready) {
    elements.campaignTrackingProfile.disabled = true;
    elements.campaignTrackingProfile.innerHTML = '<option value="">Plan a field campaign first</option>';
    elements.campaignTrackingPhase.innerHTML = '<option value="1">Phase 1</option>';
    return;
  }
  elements.campaignTrackingProfile.disabled = false;
  elements.campaignTrackingProfile.innerHTML = campaign.portfolio.map((plan) => `<option value="${plan.profileKey}">${escapeHtml(plan.profile.label)}</option>`).join("");
  const key = campaign.portfolio.some((plan) => plan.profileKey === state.activeFieldCampaignProfile)
    ? state.activeFieldCampaignProfile
    : campaign.portfolio[0].profileKey;
  elements.campaignTrackingProfile.value = key;
  const plan = campaign.portfolio.find((entry) => entry.profileKey === key) ?? campaign.portfolio[0];
  const maximumPhase = Math.max(1, ...plan.inspections.filter((inspection) => inspection.scheduled).map((inspection) => inspection.phase ?? 1));
  state.campaignTrackingPhase = Math.min(Math.max(1, state.campaignTrackingPhase), maximumPhase);
  elements.campaignTrackingPhase.innerHTML = Array.from({ length: maximumPhase }, (_, index) => `<option value="${index + 1}">Phase ${index + 1}</option>`).join("");
  elements.campaignTrackingPhase.value = String(state.campaignTrackingPhase);
}

function renderCampaignOutcomeSummary() {
  const bundle = state.campaignOutcomeBundle;
  elements.clearCampaignOutcomesButton.disabled = !bundle;
  if (!bundle) {
    elements.campaignOutcomeSummary.textContent = "No live inspection outcome ledger is loaded.";
    elements.campaignOutcomeMetrics.innerHTML = "";
    return;
  }
  const summary = bundle.summary;
  elements.campaignOutcomeSummary.textContent = `${bundle.sourceName} · ${summary.acceptedRows} accepted events · ${summary.rejectedRows} rejected rows · ${summary.hostsWithEvents} hosts · checksum ${bundle.checksum}.`;
  elements.campaignOutcomeMetrics.innerHTML = `
    <article><span>Accepted</span><strong>${summary.accepted}</strong></article>
    <article><span>Conditional</span><strong>${summary.conditional}</strong></article>
    <article><span>Rejected</span><strong>${summary.rejected}</strong></article>
    <article><span>Pending</span><strong>${summary.pending}</strong></article>`;
}

function resetCampaignTracking(message = "Field-campaign plan changed. Reload outcomes and recompute the operational network.", { clearOutcomes = true } = {}) {
  state.campaignTracking = null;
  state.commissioningEventBundle = null;
  state.commissioningOperations = null;
  if (clearOutcomes) state.campaignOutcomeBundle = null;
  elements.exportCampaignTrackingButton.disabled = true;
  elements.campaignTrackingStatus.textContent = message;
  syncCampaignTrackingControls();
  renderCampaignOutcomeSummary();
  renderCampaignTrackingResult();
  renderCommissioningEventSummary();
  renderCommissioningResult();
}

async function importCampaignOutcomeFile() {
  const file = elements.campaignOutcomeFile.files?.[0];
  if (!file) return;
  try {
    if (!state.fieldCampaign?.ready) throw new Error("Plan a field campaign before importing outcomes.");
    const text = await file.text();
    state.campaignOutcomeBundle = parseCampaignOutcomeText(text, {
      campaignResult: state.fieldCampaign,
      campaignProfileKey: activeCampaignTrackingProfileKey(),
      sourceName: file.name
    });
    state.campaignTracking = null;
    renderCampaignOutcomeSummary();
    renderCampaignTrackingResult();
    elements.campaignTrackingStatus.textContent = `Outcome ledger loaded. Select the completed phase and recompute the operational network.`;
  } catch (error) {
    elements.campaignTrackingStatus.textContent = `Outcome import failed: ${error.message}`;
  } finally {
    elements.campaignOutcomeFile.value = "";
  }
}

function useIllustrativeCampaignOutcomes() {
  try {
    if (!state.fieldCampaign?.ready) throw new Error("Plan a field campaign before loading controlled outcomes.");
    state.campaignOutcomeBundle = createIllustrativeCampaignOutcomes(state.fieldCampaign, activeCampaignTrackingProfileKey());
    state.campaignTracking = null;
    const maximumPhase = state.campaignOutcomeBundle.summary.maximumPhase || 1;
    state.campaignTrackingPhase = maximumPhase;
    syncCampaignTrackingControls();
    renderCampaignOutcomeSummary();
    renderCampaignTrackingResult();
    elements.campaignTrackingStatus.textContent = "Controlled campaign outcomes loaded. They are synthetic and not observed field results.";
  } catch (error) {
    elements.campaignTrackingStatus.textContent = `Controlled outcomes unavailable: ${error.message}`;
  }
}

function clearCampaignOutcomes() {
  state.campaignOutcomeBundle = null;
  state.campaignTracking = null;
  renderCampaignOutcomeSummary();
  renderCampaignTrackingResult();
  elements.exportCampaignTrackingButton.disabled = true;
  elements.campaignTrackingStatus.textContent = "Live outcome ledger cleared.";
}

function downloadCampaignOutcomeTemplate() {
  downloadText("lumos-campaign-outcome-template.csv", campaignOutcomeTemplateCsv(), "text/csv;charset=utf-8");
}

function operationalMapSelection(snapshot) {
  return snapshot.operationalSites.map((site) => ({
    ...site,
    interventionRole: site.assignments.length > 1 ? "boundary" : "supplemental",
    domainKeys: site.assignments.map((assignment) => assignment.domainKey),
    requiresFieldVerification: site.requiresFieldVerification
  }));
}

function renderCampaignTrackingResult() {
  const visible = state.domainKey === "core";
  elements.campaignTrackingSection.hidden = !visible;
  elements.campaignTrackingResultSection.hidden = !visible;
  if (!visible) return;
  syncCampaignTrackingControls();
  const result = state.campaignTracking;
  if (!result) {
    elements.campaignTrackingResultStatus.textContent = "Not run";
    elements.campaignTrackingResultStatus.className = "status-pill";
    elements.campaignTrackingResultSummary.textContent = "Load field outcomes and recompute the operational network after a completed campaign phase.";
    elements.campaignTrackingMetrics.innerHTML = "";
    elements.campaignTrackingTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Live campaign tracking has not run.</td></tr>';
    elements.campaignTrackingHistoryBody.innerHTML = state.campaignOutcomeBundle?.events?.length
      ? state.campaignOutcomeBundle.events.map((event) => `<tr><td>${event.phase}</td><td>${escapeHtml(event.hostId)}</td><td>${escapeHtml(event.outcome)}</td><td>${escapeHtml(event.reviewer || "--")}</td><td>${escapeHtml(event.occurredAt)}</td><td><code>${event.eventHash}</code></td></tr>`).join("")
      : '<tr><td colspan="6" class="empty-cell">No imported events.</td></tr>';
    return;
  }
  const snapshot = result.currentSnapshot;
  const metrics = snapshot.metrics;
  const protectedNetwork = metrics.unresolvedAssignments === 0 && metrics.overdueAssignments === 0;
  elements.campaignTrackingResultStatus.textContent = protectedNetwork ? "Operationally protected" : metrics.unresolvedAssignments ? "Residual gaps" : "Review overdue";
  elements.campaignTrackingResultStatus.className = `status-pill ${protectedNetwork ? "pass" : "fail"}`;
  elements.campaignTrackingResultSummary.textContent = `Through phase ${result.completedPhase}, ${metrics.operationalAssignments}/${metrics.totalAssignments} assignments remain operational. ${metrics.replacementAssignments} assignments use reserve hosts, ${metrics.pendingAssignments} await review, and ${metrics.unresolvedAssignments} remain unresolved.`;
  elements.campaignTrackingMetrics.innerHTML = `
    <article><span>Operational</span><strong>${metrics.operationalAssignments}/${metrics.totalAssignments}</strong></article>
    <article><span>Effective coverage</span><strong>${formatPercent(metrics.effectiveOperationalRate)}</strong></article>
    <article><span>Verified active</span><strong>${formatPercent(metrics.verifiedOperationalRate)}</strong></article>
    <article><span>Provisional</span><strong>${metrics.provisionalAssignments}</strong></article>
    <article><span>Replacements</span><strong>${metrics.replacementAssignments}</strong></article>
    <article><span>Reserve hosts</span><strong>${metrics.reserveHostsActivated}</strong></article>
    <article><span>Pending review</span><strong>${metrics.pendingAssignments}</strong></article>
    <article><span>Residual gaps</span><strong>${metrics.unresolvedAssignments}</strong></article>
    <article><span>Ledger events</span><strong>${result.eventHistory.length}</strong></article>`;
  elements.campaignTrackingTableBody.innerHTML = snapshot.assignments.map((assignment) => `<tr>
    <td>${domainDisplayName(assignment.domainKey)}</td>
    <td>${escapeHtml(assignment.role)}</td>
    <td>${escapeHtml(assignment.primaryHostLabel)}</td>
    <td>${escapeHtml(assignment.currentHostLabel ?? "No replacement")}</td>
    <td>${escapeHtml(assignment.operationalState.replaceAll("-", " "))}</td>
    <td>${assignment.phase ?? "--"}</td>
    <td>${escapeHtml(assignment.latestEventId ?? assignment.reserveEventId ?? "--")}</td>
  </tr>`).join("");
  elements.campaignTrackingHistoryBody.innerHTML = result.eventHistory.length
    ? result.eventHistory.map((event) => `<tr><td>${event.phase}</td><td>${escapeHtml(event.hostId)}</td><td>${escapeHtml(event.outcome)}</td><td>${escapeHtml(event.reviewer || "--")}</td><td>${escapeHtml(event.occurredAt)}</td><td><code>${event.eventHash}</code></td></tr>`).join("")
    : '<tr><td colspan="6" class="empty-cell">No imported events.</td></tr>';
  map.setResult({ selected: operationalMapSelection(snapshot) });
}

function runCampaignTracking() {
  elements.runCampaignTrackingButton.disabled = true;
  try {
    if (!state.spatialDeployment?.ready || !state.fieldCampaign?.ready) throw new Error("Run coordinated deployment and field-campaign planning first.");
    if (!state.campaignOutcomeBundle) throw new Error("Import a campaign outcome file or load the controlled outcome example.");
    state.campaignTrackingPhase = Number(elements.campaignTrackingPhase.value);
    state.campaignTracking = trackLiveCampaign({
      deploymentResult: state.spatialDeployment,
      campaignResult: state.fieldCampaign,
      campaignProfileKey: activeCampaignTrackingProfileKey(),
      outcomeBundle: state.campaignOutcomeBundle,
      completedPhase: state.campaignTrackingPhase
    });
    state.commissioningEventBundle = null;
    state.commissioningOperations = null;
    renderCampaignTrackingResult();
    renderCommissioningEventSummary();
    renderCommissioningResult();
    elements.exportCampaignTrackingButton.disabled = !state.campaignTracking.ready;
    const metrics = state.campaignTracking.currentSnapshot.metrics;
    elements.campaignTrackingStatus.textContent = `Phase ${state.campaignTracking.completedPhase} · ${metrics.operationalAssignments}/${metrics.totalAssignments} operational · ${metrics.replacementAssignments} replacements · ${metrics.unresolvedAssignments} gaps · checksum ${state.campaignTracking.checksum}.`;
    elements.runStatus.textContent = `Live campaign updated through phase ${state.campaignTracking.completedPhase}`;
  } catch (error) {
    elements.campaignTrackingStatus.textContent = `Live campaign tracking failed: ${error.message}`;
    elements.runStatus.textContent = `Live campaign tracking failed: ${error.message}`;
  } finally {
    elements.runCampaignTrackingButton.disabled = false;
  }
}

function exportCampaignTracking() {
  const result = state.campaignTracking;
  if (!result?.ready) return;
  const stem = `lumos-live-campaign-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToCampaignTrackingCsv(campaignTrackingRows(result)), "text/csv;charset=utf-8"), 120);
}

function syncCommissioningControls() {
  const config = state.commissioningConfig;
  elements.commissioningAsOf.value = String(config.asOfAt).slice(0, 10);
  elements.commissioningCapacity.value = String(config.installationsPerPhase);
  elements.commissioningPhases.value = String(config.maximumPhases);
  elements.commissioningActivateReplacements.checked = config.activateEligibleReplacements;
}

function readCommissioningConfig() {
  const dateValue = elements.commissioningAsOf.value || "2026-09-01";
  state.commissioningConfig = normalizeCommissioningOperationsConfig({
    asOfAt: `${dateValue}T00:00:00.000Z`,
    installationsPerPhase: elements.commissioningCapacity.value,
    maximumPhases: elements.commissioningPhases.value,
    activateEligibleReplacements: elements.commissioningActivateReplacements.checked,
    campaignProfileKey: activeCampaignTrackingProfileKey()
  });
  return state.commissioningConfig;
}

function renderCommissioningEventSummary() {
  const bundle = state.commissioningEventBundle;
  elements.clearCommissioningEventsButton.disabled = !bundle;
  if (!bundle) {
    elements.commissioningEventSummary.textContent = "No commissioning or maintenance ledger is loaded.";
    elements.commissioningEventMetrics.innerHTML = "";
    return;
  }
  const summary = bundle.summary;
  elements.commissioningEventSummary.textContent = `${bundle.sourceName} · ${summary.acceptedRows} accepted records · ${summary.rejectedRows} rejected rows · ${summary.assignmentsWithEvents} assignments · checksum ${bundle.checksum}.`;
  elements.commissioningEventMetrics.innerHTML = `
    <article><span>Assignments</span><strong>${summary.assignmentsWithEvents}</strong></article>
    <article><span>Online events</span><strong>${summary.onlineEvents}</strong></article>
    <article><span>Degraded</span><strong>${summary.degradedEvents}</strong></article>
    <article><span>Offline</span><strong>${summary.offlineEvents}</strong></article>
    <article><span>Open tickets</span><strong>${summary.openTickets}</strong></article>`;
}

function resetCommissioning(message = "Operational network changed. Reload commissioning records and evaluate operations.", { clearEvents = true } = {}) {
  state.commissioningOperations = null;
  if (clearEvents) state.commissioningEventBundle = null;
  elements.exportCommissioningButton.disabled = true;
  elements.commissioningStatus.textContent = message;
  renderCommissioningEventSummary();
  renderCommissioningResult();
}

async function importCommissioningFile() {
  const file = elements.commissioningEventFile.files?.[0];
  if (!file) return;
  try {
    if (!state.campaignTracking?.ready) throw new Error("Recompute the live operational network before importing commissioning records.");
    const text = await file.text();
    state.commissioningEventBundle = parseCommissioningEventText(text, {
      trackingResult: state.campaignTracking,
      sourceName: file.name
    });
    state.commissioningOperations = null;
    renderCommissioningEventSummary();
    renderCommissioningResult();
    elements.commissioningStatus.textContent = "Commissioning ledger loaded. Review the as-of date and evaluate operations.";
  } catch (error) {
    elements.commissioningStatus.textContent = `Commissioning import failed: ${error.message}`;
  } finally {
    elements.commissioningEventFile.value = "";
  }
}

function useIllustrativeCommissioningEvents() {
  try {
    if (!state.campaignTracking?.ready) throw new Error("Recompute the live operational network before loading controlled commissioning records.");
    state.commissioningEventBundle = createIllustrativeCommissioningEvents(state.campaignTracking);
    state.commissioningOperations = null;
    renderCommissioningEventSummary();
    renderCommissioningResult();
    elements.commissioningStatus.textContent = "Controlled commissioning records loaded. They are synthetic and not observed installation or maintenance evidence.";
  } catch (error) {
    elements.commissioningStatus.textContent = `Controlled commissioning records unavailable: ${error.message}`;
  }
}

function clearCommissioningEvents() {
  state.commissioningEventBundle = null;
  state.commissioningOperations = null;
  elements.exportCommissioningButton.disabled = true;
  renderCommissioningEventSummary();
  renderCommissioningResult();
  elements.commissioningStatus.textContent = "Commissioning and maintenance ledger cleared.";
}

function downloadCommissioningTemplate() {
  downloadText("lumos-commissioning-maintenance-template.csv", commissioningEventTemplateCsv(), "text/csv;charset=utf-8");
}

function renderCommissioningResult() {
  const visible = state.domainKey === "core";
  elements.commissioningSection.hidden = !visible;
  elements.commissioningResultSection.hidden = !visible;
  if (!visible) return;
  syncCommissioningControls();
  const result = state.commissioningOperations;
  if (!result) {
    elements.commissioningResultStatus.textContent = "Not run";
    elements.commissioningResultStatus.className = "status-pill";
    elements.commissioningResultSummary.textContent = "Load commissioning records and evaluate operational readiness.";
    elements.commissioningMetrics.innerHTML = "";
    elements.commissioningTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">Commissioning operations have not run.</td></tr>';
    elements.commissioningTicketTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No maintenance tickets.</td></tr>';
    elements.commissioningHistoryBody.innerHTML = state.commissioningEventBundle?.events?.length
      ? state.commissioningEventBundle.events.map((event) => `<tr><td>${escapeHtml(event.occurredAt)}</td><td>${domainDisplayName(event.domainKey)}</td><td>${escapeHtml(event.hostId)}</td><td>${escapeHtml(event.assetId)}</td><td>${escapeHtml(event.operationalStatus)}</td><td><code>${event.eventHash}</code></td></tr>`).join("")
      : '<tr><td colspan="6" class="empty-cell">No commissioning events.</td></tr>';
    return;
  }
  const metrics = result.metrics;
  elements.commissioningResultStatus.textContent = result.protected ? "Operations protected" : "Unresolved failures";
  elements.commissioningResultStatus.className = `status-pill ${result.protected ? "pass" : "fail"}`;
  elements.commissioningResultSummary.textContent = `${metrics.commissionedAssignments}/${metrics.totalAssignments} assignments are commissioned, ${metrics.provisionalAssignments} are provisional, and ${metrics.offlineAssignments} are offline or blocked. ${metrics.protectedFailures} failures have replacement-ready reserves and ${metrics.unresolvedFailures} remain unresolved.`;
  elements.commissioningMetrics.innerHTML = `
    <article><span>Commissioned</span><strong>${metrics.commissionedAssignments}/${metrics.totalAssignments}</strong></article>
    <article><span>Readiness</span><strong>${formatPercent(metrics.readinessRate)}</strong></article>
    <article><span>Mean uptime</span><strong>${formatPercent(metrics.meanUptime)}</strong></article>
    <article><span>Data completeness</span><strong>${formatPercent(metrics.meanDataCompleteness)}</strong></article>
    <article><span>Calibration compliance</span><strong>${formatPercent(metrics.calibrationCompliance)}</strong></article>
    <article><span>Maintenance current</span><strong>${formatPercent(metrics.maintenanceCurrentRate)}</strong></article>
    <article><span>Open tickets</span><strong>${metrics.openTickets}</strong></article>
    <article><span>Critical tickets</span><strong>${metrics.criticalTickets}</strong></article>
    <article><span>Protected failures</span><strong>${metrics.protectedFailures}</strong></article>
    <article><span>First-year modeled cost</span><strong>${formatUsd(metrics.firstYearOperationsCost)}</strong></article>`;
  elements.commissioningTableBody.innerHTML = result.assignments.map((assignment) => {
    const ticket = assignment.tickets.find((entry) => entry.status === "open");
    return `<tr><td>${domainDisplayName(assignment.domainKey)}</td><td>${escapeHtml(assignment.role)}</td><td>${escapeHtml(assignment.currentHostLabel ?? assignment.currentHostId ?? "--")}</td><td>${escapeHtml(assignment.commissioningState.replaceAll("-", " "))}</td><td>${formatPercent(assignment.uptime)}</td><td>${formatPercent(assignment.dataCompleteness)}</td><td>${escapeHtml(ticket?.severity ?? "none")}</td><td>${escapeHtml(assignment.replacement?.replacementHostLabel ?? "--")}</td></tr>`;
  }).join("");
  elements.commissioningTicketTableBody.innerHTML = result.tickets.length
    ? result.tickets.map((ticket) => `<tr><td>${escapeHtml(ticket.severity)}</td><td>${domainDisplayName(ticket.domainKey)}</td><td>${escapeHtml(ticket.hostId ?? "--")}</td><td>${escapeHtml(ticket.type)}</td><td>${escapeHtml(ticket.detail)}</td></tr>`).join("")
    : '<tr><td colspan="5" class="empty-cell">No open maintenance tickets.</td></tr>';
  elements.commissioningHistoryBody.innerHTML = result.eventBundle.events.length
    ? result.eventBundle.events.map((event) => `<tr><td>${escapeHtml(event.occurredAt)}</td><td>${domainDisplayName(event.domainKey)}</td><td>${escapeHtml(event.hostId)}</td><td>${escapeHtml(event.assetId)}</td><td>${escapeHtml(event.operationalStatus)}</td><td><code>${event.eventHash}</code></td></tr>`).join("")
    : '<tr><td colspan="6" class="empty-cell">No commissioning events.</td></tr>';
  map.setResult({ selected: result.mapSites });
}

function runCommissioningEvaluation() {
  elements.runCommissioningButton.disabled = true;
  try {
    if (!state.campaignTracking?.ready || !state.fieldCampaign?.ready) throw new Error("Complete live campaign tracking and field-campaign planning first.");
    if (!state.commissioningEventBundle) throw new Error("Import commissioning records or load the controlled operations example.");
    const config = readCommissioningConfig();
    state.commissioningOperations = runCommissioningOperations({
      ...config,
      trackingResult: state.campaignTracking,
      campaignResult: state.fieldCampaign,
      eventBundle: state.commissioningEventBundle
    });
    renderCommissioningResult();
    elements.exportCommissioningButton.disabled = false;
    const metrics = state.commissioningOperations.metrics;
    elements.commissioningStatus.textContent = `${metrics.commissionedAssignments}/${metrics.totalAssignments} commissioned · ${metrics.protectedFailures} protected failures · ${metrics.unresolvedFailures} unresolved · checksum ${state.commissioningOperations.checksum}.`;
    elements.runStatus.textContent = "Commissioning and maintenance operations evaluated";
  } catch (error) {
    elements.commissioningStatus.textContent = `Commissioning evaluation failed: ${error.message}`;
    elements.runStatus.textContent = `Commissioning evaluation failed: ${error.message}`;
  } finally {
    elements.runCommissioningButton.disabled = false;
  }
}

function exportCommissioningOperations() {
  const result = state.commissioningOperations;
  if (!result?.ready) return;
  const stem = `lumos-commissioning-operations-${result.checksum}`;
  downloadJson(`${stem}.json`, result);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToCommissioningOperationsCsv(commissioningOperationsRows(result)), "text/csv;charset=utf-8"), 120);
}

async function applyPresetCaseStudy(presetId, requestedDomain = state.domainKey) {
  const domainKey = ["air", "soil", "water"].includes(requestedDomain) ? requestedDomain : "heat";
  const preset = presetForDomain(domainKey, presetId);
  if (!preset) return;
  state.heatWorkspace = "national";
  state.dataMode = "live";
  elements.citySelector.value = "national";
  elements.dataMode.value = "live";
  if (preset.pollutant) {
    state.airPollutant = preset.pollutant;
    elements.airPollutant.value = preset.pollutant;
  }
  if (preset.property) {
    state.soilProperty = preset.property;
    elements.soilProperty.value = preset.property;
  }
  if (preset.depth) {
    state.soilDepth = preset.depth;
    elements.soilDepth.value = preset.depth;
  }
  if (preset.indicator) {
    state.waterIndicator = preset.indicator;
    elements.waterIndicator.value = preset.indicator;
  }
  if (preset.systemType) {
    state.waterSystemType = preset.systemType;
    elements.waterSystemType.value = preset.systemType;
  }
  if (state.domainKey !== domainKey) applyDomain(domainKey);
  else if (!nationalWorkspaceEnabled()) await loadScenario();
  clearViewportHeat({ message: null });
  state.selectedLocationLabel = preset.location.display_name;
  map.flyToLocation({
    ...preset.location,
    label: preset.location.display_name,
    type: "preset"
  });
  const qualifier = preset.pollutant
    ? ` ${AIR_POLLUTANTS[preset.pollutant]?.label ?? preset.pollutant}`
    : preset.property
      ? ` ${SOIL_PROPERTIES[preset.property]?.label ?? preset.property}`
      : preset.indicator
        ? ` ${WATER_INDICATORS[preset.indicator]?.label ?? preset.indicator}`
        : "";
  elements.locationSearchStatus.textContent = `Opening ${preset.label}${qualifier}. LUMOS will fit the visible local area after the map settles...`;
  window.setTimeout(() => {
    if (!state.viewportHeatActive && !state.viewportHeatLoading && nationalWorkspaceEnabled()) void toggleViewportHeat();
  }, state.accessibility.reducedMotion ? 80 : 1050);
}

function loadingProgressFromMessage(message, fallback = 38) {
  const text = String(message ?? "").toLowerCase();
  const rules = [
    ["validat", 8],
    ["connect", 10],
    ["boundary", 18],
    ["weather", 22],
    ["heat", 26],
    ["land cover", 32],
    ["census geography", 40],
    ["social", 48],
    ["evaluation field", 58],
    ["adaptive evaluation", 58],
    ["systematic candidate", 68],
    ["candidate", 70],
    ["calibrat", 78],
    ["validation", 84],
    ["benchmark", 86],
    ["final", 94],
    ["complete", 100]
  ];
  return rules.find(([needle]) => text.includes(needle))?.[1] ?? fallback;
}

function showLoading({
  title = "Loading environmental workspace",
  message = "Preparing data and model inputs...",
  stage = "Starting",
  progress = 4,
  eyebrow = "LUMOS is working",
  cancel = null
} = {}) {
  state.activeLoadingOperation = Symbol("loading");
  elements.globalLoadingOverlay.hidden = false;
  elements.globalLoadingOverlay.setAttribute("aria-hidden", "false");
  elements.loadingEyebrow.textContent = eyebrow;
  elements.loadingTitle.textContent = title;
  elements.loadingMessage.textContent = message;
  elements.loadingStage.textContent = stage;
  elements.loadingProgressBar.style.width = `${Math.max(2, Math.min(100, progress))}%`;
  elements.loadingPercent.textContent = `${Math.round(Math.max(0, Math.min(100, progress)))}%`;
  elements.loadingCancelButton.hidden = typeof cancel !== "function";
  elements.loadingCancelButton.onclick = typeof cancel === "function" ? cancel : null;
  return state.activeLoadingOperation;
}

function updateLoading({ title, message, stage, progress } = {}) {
  if (elements.globalLoadingOverlay.hidden) return;
  if (title) elements.loadingTitle.textContent = title;
  if (message) elements.loadingMessage.textContent = message;
  if (stage) elements.loadingStage.textContent = stage;
  if (Number.isFinite(progress)) {
    const bounded = Math.max(0, Math.min(100, progress));
    elements.loadingProgressBar.style.width = `${Math.max(2, bounded)}%`;
    elements.loadingPercent.textContent = `${Math.round(bounded)}%`;
  }
}

function hideLoading() {
  state.activeLoadingOperation = null;
  elements.globalLoadingOverlay.hidden = true;
  elements.globalLoadingOverlay.setAttribute("aria-hidden", "true");
  elements.loadingCancelButton.hidden = true;
  elements.loadingCancelButton.onclick = null;
  elements.loadingProgressBar.style.width = "0%";
}

function showBackgroundLoading(message) {
  elements.backgroundLoadingMessage.textContent = message;
  elements.backgroundLoadingToast.hidden = false;
}

function hideBackgroundLoading() {
  elements.backgroundLoadingToast.hidden = true;
}


const SHARED_MAP_LAYERS = [
  { value: "risk", label: "Active environmental risk" },
  { value: "uncertainty", label: "Prior uncertainty" },
  { value: "exposure", label: "Civilian exposure" },
  { value: "vulnerability", label: "Social vulnerability" },
  { value: "remaining", label: "Remaining uncertainty" }
];

const LIVE_HEAT_LAYERS = [
  { value: "liveApparentTemperature", label: "Live apparent heat (°F)" },
  { value: "liveTemperature", label: "Live air temperature (°F)" },
  { value: "liveHumidity", label: "Live relative humidity (%)" },
  { value: "liveWindSpeed", label: "Live wind speed (mph)" },
  { value: "liveCloudCover", label: "Live cloud cover (%)" },
  { value: "livePrecipitation", label: "Live precipitation (in)" }
];

const FORECAST_HEAT_LAYERS = [
  { value: "liveApparentTemperature", label: "Forecast apparent heat (°F)" },
  { value: "liveTemperature", label: "Forecast air temperature (°F)" },
  { value: "liveHumidity", label: "Forecast relative humidity (%)" },
  { value: "liveWindSpeed", label: "Forecast wind speed (mph)" },
  { value: "liveCloudCover", label: "Forecast cloud cover (%)" },
  { value: "livePrecipitation", label: "Forecast precipitation (in)" }
];

const NATIONAL_HEAT_LAYERS = [
  { value: "risk", label: "Current heat risk" },
  { value: "apparentTemperature", label: "Current apparent heat (°F)" },
  { value: "temperature", label: "Current air temperature (°F)" },
  { value: "humidity", label: "Relative humidity (%)" },
  { value: "windSpeed", label: "Wind speed (mph)" },
  { value: "surfaceHeatAmplification", label: "Surface heat amplification" },
  { value: "impervious", label: "Impervious surface proxy" },
  { value: "treeCanopy", label: "Tree-canopy proxy" },
  { value: "vegetation", label: "Vegetation intensity" },
  { value: "waterProximity", label: "Water proximity" },
  { value: "interventionBenefit", label: "Intervention priority" },
  { value: "uncertainty", label: "Placement uncertainty proxy" },
  { value: "exposure", label: "Civilian exposure" },
  { value: "vulnerability", label: "Social vulnerability" },
  { value: "remaining", label: "Remaining posterior uncertainty" }
];

const AIR_MAP_LAYERS = [
  { value: "risk", label: "Active air-quality risk" },
  { value: "pollutantValue", label: "Atmospheric-model concentration" },
  { value: "posteriorPollutant", label: "Reference-conditioned concentration" },
  { value: "modelResidual", label: "Monitor-informed model adjustment" },
  { value: "predictiveAirUncertainty", label: "Predictive concentration uncertainty" },
  { value: "pollutantAqi", label: "Pollutant-specific U.S. AQI" },
  { value: "usAqi", label: "Overall U.S. AQI" },
  { value: "trafficIntensity", label: "Traffic-source proximity" },
  { value: "industrialProximity", label: "Industrial-source proximity" },
  { value: "sourceRisk", label: "Combined source pressure" },
  { value: "downwindSourceRisk", label: "Downwind source influence" },
  { value: "windSpeed", label: "Wind speed (mph)" },
  { value: "windDirection", label: "Wind direction (°)" },
  { value: "interventionBenefit", label: "Intervention priority" },
  { value: "uncertainty", label: "Prior uncertainty" },
  { value: "exposure", label: "Civilian exposure" },
  { value: "vulnerability", label: "Social vulnerability" },
  { value: "remaining", label: "Remaining posterior uncertainty" }
];

const SOIL_MAP_LAYERS = [
  { value: "risk", label: "Active soil sampling priority" },
  { value: "soilComposite", label: "Soil-health composite" },
  { value: "soilPh", label: "Soil pH" },
  { value: "organicMatter", label: "Organic matter (%)" },
  { value: "clayPercent", label: "Clay content (%)" },
  { value: "availableWater", label: "Available water capacity (cm/cm)" },
  { value: "electricalConductivity", label: "Electrical conductivity (dS/m)" },
  { value: "posteriorSoilValue", label: "Laboratory-conditioned Soil field" },
  { value: "soilModelResidual", label: "Laboratory-informed model adjustment" },
  { value: "predictiveSoilUncertainty", label: "Predictive Soil uncertainty" },
  { value: "disturbancePressure", label: "Mapped disturbance pressure" },
  { value: "interventionBenefit", label: "Soil intervention priority" },
  { value: "uncertainty", label: "Soil survey and sampling uncertainty" },
  { value: "exposure", label: "Civilian exposure" },
  { value: "vulnerability", label: "Social vulnerability" },
  { value: "ecology", label: "Ecological representation" },
  { value: "remaining", label: "Remaining posterior uncertainty" }
];

const WATER_MAP_LAYERS = [
  { value: "risk", label: "Active water monitoring priority" },
  { value: "waterIndicatorValue", label: "Active Water indicator field" },
  { value: "priorWaterIndicatorValue", label: "Water screening prior" },
  { value: "posteriorWaterValue", label: "Flow-aware Water posterior" },
  { value: "waterModelResidual", label: "Observation-informed model adjustment" },
  { value: "predictiveWaterUncertainty", label: "Predictive Water uncertainty" },
  { value: "flowConnectivity", label: "Flow-network connectivity" },
  { value: "waterwayProximity", label: "Waterway proximity" },
  { value: "upstreamSourcePressure", label: "Upstream source pressure" },
  { value: "downstreamExposure", label: "Downstream receptor exposure" },
  { value: "monitoringDensity", label: "Existing monitoring density" },
  { value: "interventionBenefit", label: "Water intervention priority" },
  { value: "uncertainty", label: "Prior monitoring uncertainty" },
  { value: "exposure", label: "Civilian exposure" },
  { value: "vulnerability", label: "Social vulnerability" },
  { value: "ecology", label: "Ecological representation" },
  { value: "remaining", label: "Remaining posterior uncertainty" }
];

const HEAT_MAP_LAYERS = [
  { value: "futureRisk", label: "2050 control heat" },
  { value: "plannedRisk", label: "Planned tree action" },
  { value: "interventionBenefit", label: "Modeled cooling benefit" },
  { value: "posteriorHeat", label: "Posterior heat prediction" },
  { value: "treeCanopy", label: "Tree canopy" },
  { value: "impervious", label: "Impervious surface" },
  { value: "predictiveUncertainty", label: "Predictive uncertainty" }
];

function mapLayerOptions() {
  if (state.domainKey === "heat" && state.heatExperience === "live" && state.scenario) return LIVE_HEAT_LAYERS;
  if (state.domainKey === "heat" && state.heatExperience === "forecast" && state.scenario) return FORECAST_HEAT_LAYERS;
  if (state.domainKey === "heat" && state.scenario?.scenarioType === "live-national") return NATIONAL_HEAT_LAYERS;
  if (state.domainKey === "air" && state.scenario?.scenarioType === "live-national-air") {
    const hasReferenceInference = (state.scenario.model?.referenceMeasurementCount ?? 0) > 0;
    return AIR_MAP_LAYERS
      .filter((option) => hasReferenceInference || !["posteriorPollutant", "modelResidual", "predictiveAirUncertainty"].includes(option.value))
      .map((option) => {
        if (option.value === "pollutantValue") return { ...option, label: `${state.scenario.model?.pollutantLabel ?? "Pollutant"} atmospheric-model concentration (${state.scenario.model?.pollutantUnit ?? "µg/m³"})` };
        if (option.value === "posteriorPollutant") return { ...option, label: `${state.scenario.model?.pollutantLabel ?? "Pollutant"} reference-conditioned concentration (${state.scenario.model?.pollutantUnit ?? "µg/m³"})` };
        return option;
      });
  }
  if (state.domainKey === "soil" && state.scenario?.scenarioType === "live-national-soil") {
    const hasLabInference = (state.scenario.model?.labSampleCount ?? 0) >= 3 && Boolean(state.scenario.model?.soilInference);
    const label = state.scenario.model?.labAnalyteLabel ?? state.scenario.model?.propertyLabel ?? "Soil";
    const unit = state.scenario.model?.labAnalyteUnit ?? state.scenario.model?.propertyUnit ?? "";
    return SOIL_MAP_LAYERS
      .filter((option) => hasLabInference || !["posteriorSoilValue", "soilModelResidual", "predictiveSoilUncertainty"].includes(option.value))
      .map((option) => {
        if (option.value === "risk") return { ...option, label: `${state.scenario.model?.propertyLabel ?? "Soil"} sampling priority` };
        if (option.value === "posteriorSoilValue") return { ...option, label: `${label} laboratory-conditioned field${unit ? ` (${unit})` : ""}` };
        if (option.value === "soilModelResidual") return { ...option, label: `${label} model adjustment${unit ? ` (${unit})` : ""}` };
        return option;
      });
  }
  if (state.domainKey === "water" && state.scenario?.scenarioType === "live-national-water") {
    const indicator = state.scenario.model?.indicatorLabel ?? "Water indicator";
    const unit = state.scenario.model?.indicatorUnit ?? "";
    const hasInference = Boolean(state.scenario.model?.waterInference);
    return WATER_MAP_LAYERS
      .filter((option) => hasInference || !["posteriorWaterValue", "waterModelResidual", "predictiveWaterUncertainty"].includes(option.value))
      .map((option) => {
        if (option.value === "risk") return { ...option, label: `${indicator} monitoring priority` };
        if (option.value === "waterIndicatorValue") return { ...option, label: `${indicator} active field${unit ? ` (${unit})` : ""}` };
        if (option.value === "priorWaterIndicatorValue") return { ...option, label: `${indicator} screening prior${unit ? ` (${unit})` : ""}` };
        if (option.value === "posteriorWaterValue") return { ...option, label: `${indicator} flow-aware posterior${unit ? ` (${unit})` : ""}` };
        if (option.value === "waterModelResidual") return { ...option, label: `${indicator} model adjustment${unit ? ` (${unit})` : ""}` };
        return option;
      });
  }
  const riskLabels = {
    core: "Generalized environmental risk",
    heat: "Active heat risk",
    air: "Air-quality risk",
    soil: "Soil-health risk",
    water: "Water-quality risk"
  };
  const shared = SHARED_MAP_LAYERS.map((option) => option.value === "risk"
    ? { ...option, label: riskLabels[state.domainKey] ?? option.label }
    : option);
  return state.domainKey === "heat" && state.scenario?.scenarioType === "live-city"
    ? [shared[0], ...HEAT_MAP_LAYERS, ...shared.slice(1)]
    : shared;
}

function renderMapLayerOptions() {
  const options = mapLayerOptions();
  if (!options.some((option) => option.value === state.layer)) {
    state.layer = state.heatExperience === "live" || state.heatExperience === "forecast"
      ? "liveApparentTemperature"
      : "risk";
  }
  elements.mapLayerSelect.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");
  elements.mapLayerSelect.value = state.layer;
  map.setLayer(state.layer);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRuntime(value) {
  if (!Number.isFinite(value)) return "--";
  if (value < 0.1) return "<0.1";
  if (value < 100) return value.toFixed(1);
  return Math.round(value).toLocaleString();
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(2)} MB`;
}

function currentMemoryLabel() {
  const bytes = performance?.memory?.usedJSHeapSize;
  return Number.isFinite(bytes) ? formatBytes(bytes) : "Not exposed by browser";
}

function formatWeatherTimestamp(value) {
  if (!value) return "Unknown time";
  const text = String(value);
  const parsed = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function liveWorkspaceReady() {
  return state.domainKey === "heat" && Boolean(state.scenario?.cells?.length);
}

function stopForecastPlayback() {
  if (state.forecastPlayTimer) clearTimeout(state.forecastPlayTimer);
  state.forecastPlayTimer = null;
  if (state.forecastTransitionFrame) cancelAnimationFrame(state.forecastTransitionFrame);
  state.forecastTransitionFrame = null;
  if (elements.forecastPlayButton) elements.forecastPlayButton.textContent = "Play";
}

function stopLiveRefreshTimers() {
  if (state.liveRefreshTimer) clearTimeout(state.liveRefreshTimer);
  if (state.liveCountdownTimer) clearInterval(state.liveCountdownTimer);
  state.liveRefreshTimer = null;
  state.liveCountdownTimer = null;
  state.liveNextRefreshAt = null;
}

function renderLiveWeatherSummary() {
  const summary = summarizeLiveConditions(state.scenario);
  const label = (value, unit, digits = 0) => Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : "--";
  elements.liveTemperatureValue.textContent = label(summary.temperature, " °F", 1);
  elements.liveApparentValue.textContent = label(summary.apparentTemperature, " °F", 1);
  elements.liveHumidityValue.textContent = label(summary.humidity, "%", 0);
  elements.liveWindValue.textContent = label(summary.windSpeed, " mph", 1);
  const comparison = compareLiveToPlanningSnapshot(state.scenario);
  const stale = Boolean(state.result) && comparison.classification !== "minor";
  elements.recomputePortfolioNoticeButton.hidden = !stale;
  elements.liveWeatherStatus.classList.toggle("live-weather-stale", stale);
  elements.liveWeatherStatus.classList.toggle("live-weather-current", !stale && liveWorkspaceReady());
  const countdown = state.liveNextRefreshAt
    ? Math.max(0, Math.ceil((state.liveNextRefreshAt - Date.now()) / 1000))
    : null;
  const countdownText = countdown === null
    ? ""
    : ` · next refresh ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`;
  const changeText = state.result
    ? ` · portfolio field change ${comparison.classification} (${comparison.meanAbsoluteChangeF.toFixed(1)} °F mean)`
    : "";
  elements.liveWeatherStatus.textContent = liveWorkspaceReady()
    ? `Updated ${formatWeatherTimestamp(summary.updatedAt)}${countdownText}${changeText}`
    : "Fit a Heat workspace to activate live conditions.";
}

function scheduleLiveRefresh() {
  stopLiveRefreshTimers();
  if (state.heatExperience !== "live" || !liveWorkspaceReady()) return;
  const minutes = Number(elements.liveRefreshInterval.value);
  if (!(minutes > 0)) {
    renderLiveWeatherSummary();
    return;
  }
  state.liveNextRefreshAt = Date.now() + minutes * 60 * 1000;
  state.liveRefreshTimer = window.setTimeout(() => void refreshLiveConditions({ automatic: true }), minutes * 60 * 1000);
  state.liveCountdownTimer = window.setInterval(renderLiveWeatherSummary, 1000);
  renderLiveWeatherSummary();
}

async function refreshLiveConditions({ automatic = false } = {}) {
  if (!liveWorkspaceReady()) return;
  if (state.liveRefreshController) state.liveRefreshController.abort();
  const controller = new AbortController();
  state.liveRefreshController = controller;
  if (!automatic) showLoading({
    title: "Refreshing live Heat conditions",
    message: "Retrieving a new weather snapshot without changing the planning portfolio...",
    stage: "Contacting Open-Meteo",
    progress: 10,
    cancel: () => controller.abort()
  });
  elements.refreshLiveWeatherButton.disabled = true;
  try {
    const snapshot = await fetchCurrentHeatSnapshot(state.scenario, {
      signal: controller.signal,
      cache: false,
      onProgress: (message, fraction) => {
        elements.liveWeatherStatus.textContent = message;
        if (!automatic) updateLoading({ stage: message, message, progress: 12 + fraction * 76 });
      }
    });
    if (controller !== state.liveRefreshController) return;
    state.liveSnapshot = snapshot;
    applyLiveSnapshot(state.scenario, snapshot);
    map.invalidateField();
    renderLiveWeatherSummary();
    scheduleWorkspaceAutosave();
    if (!automatic) {
      updateLoading({ stage: "Complete", message: "Live conditions refreshed; the planning portfolio remains frozen.", progress: 100 });
      window.setTimeout(hideLoading, 180);
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      elements.liveWeatherStatus.textContent = `Live refresh failed: ${error.message}`;
      if (!automatic) hideLoading();
    }
  } finally {
    if (controller === state.liveRefreshController) state.liveRefreshController = null;
    elements.refreshLiveWeatherButton.disabled = false;
    scheduleLiveRefresh();
  }
}

function setForecastFrame(index, { animate = false } = {}) {
  if (!state.forecast?.frames?.length || !state.scenario) return;
  const target = Math.max(0, Math.min(state.forecast.frames.length - 1, Math.round(index)));
  const from = state.forecastFrameIndex;
  const finalize = () => {
    state.forecastFrameIndex = target;
    applyForecastFrame(state.scenario, state.forecast, target);
    elements.forecastTimeline.value = String(target);
    elements.forecastTimestamp.textContent = `${formatWeatherTimestamp(state.forecast.frames[target].time)} UTC · frame ${target + 1} of ${state.forecast.frames.length}`;
    map.invalidateField();
    renderLiveWeatherSummary();
  };
  if (!animate || from === target) {
    finalize();
    return;
  }
  if (state.forecastTransitionFrame) cancelAnimationFrame(state.forecastTransitionFrame);
  const started = performance.now();
  const duration = Math.min(850, Number(elements.forecastSpeed.value) * 0.72);
  const transition = (timestamp) => {
    const progress = Math.min(1, (timestamp - started) / Math.max(160, duration));
    applyForecastFrame(state.scenario, state.forecast, target, { fromFrameIndex: from, blend: progress });
    map.invalidateField();
    if (progress < 1) state.forecastTransitionFrame = requestAnimationFrame(transition);
    else {
      state.forecastTransitionFrame = null;
      finalize();
    }
  };
  state.forecastTransitionFrame = requestAnimationFrame(transition);
}

function scheduleForecastPlayback() {
  stopForecastPlayback();
  if (state.heatExperience !== "forecast" || !state.forecast?.frames?.length) return;
  elements.forecastPlayButton.textContent = "Pause";
  const advance = () => {
    if (!state.forecastPlayTimer || state.heatExperience !== "forecast") return;
    const next = (state.forecastFrameIndex + 1) % state.forecast.frames.length;
    setForecastFrame(next, { animate: true });
    state.forecastPlayTimer = window.setTimeout(advance, Number(elements.forecastSpeed.value));
  };
  state.forecastPlayTimer = window.setTimeout(advance, Number(elements.forecastSpeed.value));
}

async function loadForecastPlayback() {
  if (!liveWorkspaceReady()) return;
  stopForecastPlayback();
  const controller = new AbortController();
  showLoading({
    title: "Loading Heat forecast playback",
    message: "Downloading hourly frames once for smooth local playback...",
    stage: "Preparing forecast grid",
    progress: 8,
    cancel: () => controller.abort()
  });
  elements.loadForecastButton.disabled = true;
  try {
    state.forecast = await fetchHeatForecast(state.scenario, {
      hours: Number(elements.forecastHorizon.value),
      signal: controller.signal,
      onProgress: (message, fraction) => updateLoading({ stage: message, message, progress: 10 + fraction * 80 })
    });
    state.forecastFrameIndex = 0;
    elements.forecastTimeline.max = String(state.forecast.frames.length - 1);
    elements.forecastTimeline.disabled = false;
    elements.forecastPlayButton.disabled = false;
    setForecastFrame(0);
    updateLoading({ stage: "Complete", message: `${state.forecast.frames.length} hourly frames ready.`, progress: 100 });
    window.setTimeout(hideLoading, 180);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      elements.forecastTimestamp.textContent = `Forecast loading failed: ${error.message}`;
      hideLoading();
    }
  } finally {
    elements.loadForecastButton.disabled = false;
  }
}

function renderHeatExperience() {
  const isHeat = state.domainKey === "heat";
  elements.heatExperienceControls.hidden = !isHeat;
  elements.heatExperience.value = state.heatExperience;
  elements.liveConditionControls.hidden = !isHeat || state.heatExperience !== "live";
  elements.forecastPlaybackControls.hidden = !isHeat || state.heatExperience !== "forecast";
  const help = {
    risk: "Combine Heat, surface conditions, exposure, vulnerability, and uncertainty for monitor placement.",
    live: "Explore a current weather snapshot. Refreshes never silently move the scientific monitoring portfolio.",
    forecast: "Animate downloaded hourly weather fields. Playback changes the display only, not the planning objective."
  };
  elements.heatExperienceHelp.textContent = help[state.heatExperience] ?? help.risk;
  map.setLiveAnimation(isHeat && ["live", "forecast"].includes(state.heatExperience) && !state.accessibility.reducedMotion);
  if (state.heatExperience === "live") {
    initializeLiveFields(state.scenario);
    if (state.liveSnapshot) applyLiveSnapshot(state.scenario, state.liveSnapshot);
    renderLiveWeatherSummary();
    scheduleLiveRefresh();
  } else {
    stopLiveRefreshTimers();
  }
  if (state.heatExperience !== "forecast") stopForecastPlayback();
  elements.optimizeButton.disabled = !state.scenario || state.heatExperience !== "risk";
  renderMapLayerOptions();
}

function setHeatExperience(value) {
  state.heatExperience = ["risk", "live", "forecast"].includes(value) ? value : "risk";
  state.layer = state.heatExperience === "risk" ? "risk" : "liveApparentTemperature";
  initializeLiveFields(state.scenario);
  if (state.heatExperience === "live" && state.liveSnapshot) applyLiveSnapshot(state.scenario, state.liveSnapshot);
  if (state.heatExperience === "forecast" && state.forecast?.frames?.length) applyForecastFrame(state.scenario, state.forecast, state.forecastFrameIndex);
  renderHeatExperience();
  map.invalidateField();
  scheduleWorkspaceAutosave();
}

function renderPaperExperiment() {
  const bundle = state.paperExperiment;
  elements.paperExperimentSection.hidden = !bundle;
  elements.exportPaperExperimentButton.disabled = !bundle;
  elements.exportMapPngButton.disabled = !state.scenario;
  if (!bundle) {
    elements.paperExperimentSummary.textContent = "No paper experiment has run.";
    elements.paperExperimentTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No experiment yet</td></tr>';
    return;
  }
  const feasible = bundle.cases.filter((entry) => entry.selectedNetwork?.feasible).length;
  elements.paperExperimentSummary.textContent = `${bundle.cases.length} case${bundle.cases.length === 1 ? "" : "s"} frozen with the exact public inputs and model settings used in this run.`;
  elements.paperExperimentCases.textContent = String(bundle.cases.length);
  elements.paperExperimentChecksum.textContent = bundle.checksum.slice(0, 12);
  elements.paperExperimentFeasible.textContent = `${feasible}/${bundle.cases.length}`;
  elements.paperExperimentGenerated.textContent = formatWeatherTimestamp(bundle.generatedAt);
  elements.paperExperimentTableBody.innerHTML = bundle.cases.map((entry) => {
    const metrics = entry.selectedNetwork?.metrics ?? {};
    const selected = entry.selectedNetwork?.selected?.length ?? 0;
    return `<tr><td>${entry.definition?.label ?? entry.key}</td><td>${selected}</td><td>${formatPercent(metrics.information ?? 0)}</td><td>${formatPercent(metrics.minimumGroupInformation ?? metrics.groupInformation ?? 0)}</td><td>${formatPercent(metrics.fairnessGap ?? metrics.fairness ?? 0)}</td><td>${Number(metrics.totalCost ?? 0).toFixed(2)}</td><td>${entry.selectedNetwork?.feasible ? "Yes" : "No"}</td></tr>`;
  }).join("");
}

function paperRunnerSettings() {
  return {
    monitorCount: Number(elements.monitorCount.value),
    budget: Number(elements.budgetLimit.value),
    fairnessLimit: Number(elements.fairnessLimit.value),
    minimumGroupInformation: Number(elements.minimumGroupInformation.value),
    minimumReliability: Number(elements.minimumReliability.value),
    measurementNoise: Number(elements.measurementNoise.value),
    lengthScaleMultiplier: Number(elements.influenceScale.value),
    activeProfile: state.activeProfile
  };
}

async function runPaperExperiment() {
  if (state.domainKey !== "heat") return;
  const scope = elements.paperExperimentScope.value;
  if (scope === "current" && (!state.scenario || !state.result)) {
    elements.paperExperimentStatus.textContent = "Fit a Heat workspace and generate its portfolio before running the current-workspace experiment.";
    return;
  }
  if (state.paperExperimentController) state.paperExperimentController.abort();
  const controller = new AbortController();
  state.paperExperimentController = controller;
  elements.runPaperExperimentButton.disabled = true;
  showLoading({
    title: scope === "suite" ? "Running four-city paper suite" : "Freezing current Heat experiment",
    message: scope === "suite" ? "Loading and optimizing Phoenix, Denver, Atlanta, and New York..." : "Freezing current inputs, portfolio, and benchmarks...",
    stage: "Preparing experiment",
    progress: 5,
    cancel: scope === "suite" ? () => controller.abort() : null
  });
  try {
    if (scope === "suite") {
      state.paperExperiment = await runNationalPaperSuite({
        caseStudies: PAPER_CASE_STUDIES,
        signal: controller.signal,
        includeFairnessScreen: elements.paperFairnessScreen.checked,
        settings: paperRunnerSettings(),
        onProgress: ({ caseIndex, caseCount, caseLabel, stage }) => {
          const caseFraction = (caseIndex + 0.5) / Math.max(1, caseCount);
          updateLoading({
            stage: `${caseLabel}: ${stage}`,
            message: `Case ${caseIndex + 1} of ${caseCount} · ${caseLabel}`,
            progress: 5 + caseFraction * 90
          });
          elements.paperExperimentStatus.textContent = `Running case ${caseIndex + 1}/${caseCount}: ${caseLabel} · ${stage}`;
        }
      });
    } else {
      state.paperExperiment = buildCurrentWorkspacePaperBundle({
        scenario: state.scenario,
        result: state.result,
        activeProfile: state.activeProfile,
        settings: paperRunnerSettings()
      });
    }
    renderPaperExperiment();
    elements.paperExperimentStatus.textContent = `Experiment ready · checksum ${state.paperExperiment.checksum.slice(0, 12)} · ${state.paperExperiment.cases.length} case(s)`;
    updateLoading({ stage: "Complete", message: "Paper experiment bundle ready.", progress: 100 });
    window.setTimeout(hideLoading, 180);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      elements.paperExperimentStatus.textContent = `Paper experiment failed: ${error.message}`;
      hideLoading();
    }
  } finally {
    if (state.paperExperimentController === controller) state.paperExperimentController = null;
    elements.runPaperExperimentButton.disabled = false;
  }
}

function collectWorkspaceControls() {
  return {
    domainKey: state.domainKey,
    dataMode: state.dataMode,
    heatWorkspace: state.heatWorkspace,
    heatScenario: state.heatScenario,
    heatExperience: state.heatExperience,
    airPollutant: state.airPollutant,
    soilProperty: state.soilProperty,
    soilDepth: state.soilDepth,
    waterIndicator: state.waterIndicator,
    waterSystemType: state.waterSystemType,
    liveRefreshInterval: Number(elements.liveRefreshInterval.value),
    candidateStrategy: state.candidateStrategy,
    planningStage: state.planningStage,
    evaluationTarget: elements.evaluationTarget.value,
    airEvaluationTarget: elements.airEvaluationTarget.value,
    soilEvaluationTarget: elements.soilEvaluationTarget.value,
    waterEvaluationTarget: elements.waterEvaluationTarget.value,
    activeProfile: state.activeProfile,
    layer: state.layer,
    weights: { ...state.weights },
    monitorCount: Number(elements.monitorCount.value),
    budgetLimit: Number(elements.budgetLimit.value),
    influenceScale: Number(elements.influenceScale.value),
    measurementNoise: Number(elements.measurementNoise.value),
    fairnessLimit: Number(elements.fairnessLimit.value),
    minimumGroupInformation: Number(elements.minimumGroupInformation.value),
    minimumReliability: Number(elements.minimumReliability.value),
    fairnessConstraint: elements.fairnessConstraint.checked,
    minimumSeparation: elements.minimumSeparation.checked,
    showCandidates: elements.showCandidates.checked,
    overlayOpacity: Number(elements.overlayOpacity.value),
    basemapStyle: elements.basemapStyleSelect.value,
    repeatedMeasurements: Number(elements.repeatedMeasurements.value),
    residualStd: Number(elements.residualStd.value),
    airRepeatedMeasurements: Number(elements.airRepeatedMeasurements.value),
    airResidualStd: Number(elements.airResidualStd.value),
    soilRepeatedMeasurements: Number(elements.soilRepeatedMeasurements.value),
    soilResidualStd: Number(elements.soilResidualStd.value),
    waterRepeatedMeasurements: Number(elements.waterRepeatedMeasurements.value),
    waterResidualStd: Number(elements.waterResidualStd.value)
  };
}

function applyWorkspaceControls(controls = {}) {
  state.domainKey = controls.domainKey ?? "heat";
  state.dataMode = controls.dataMode ?? "live";
  state.heatWorkspace = controls.heatWorkspace ?? (state.scenario?.scenarioType === "live-city" ? "nyc" : "national");
  state.heatScenario = controls.heatScenario ?? "baseline";
  state.heatExperience = controls.heatExperience ?? "risk";
  state.airPollutant = controls.airPollutant ?? state.scenario?.model?.pollutant ?? "pm2_5";
  state.soilProperty = controls.soilProperty ?? state.scenario?.model?.property ?? "composite";
  state.soilDepth = controls.soilDepth ?? state.scenario?.model?.depth ?? "0-15";
  state.waterIndicator = controls.waterIndicator ?? state.scenario?.model?.indicator ?? "temperature";
  state.waterSystemType = controls.waterSystemType ?? state.scenario?.model?.systemType ?? "surface";
  state.candidateStrategy = controls.candidateStrategy ?? state.scenario?.model?.candidateStrategy ?? "hybrid";
  state.planningStage = controls.planningStage ?? "intervention";
  state.activeProfile = controls.activeProfile ?? "balanced";
  state.layer = controls.layer ?? "risk";
  state.weights = { ...DOMAINS[state.domainKey].weights, ...(controls.weights ?? {}) };

  const numericControls = [
    [elements.monitorCount, controls.monitorCount],
    [elements.budgetLimit, controls.budgetLimit],
    [elements.influenceScale, controls.influenceScale],
    [elements.measurementNoise, controls.measurementNoise],
    [elements.fairnessLimit, controls.fairnessLimit],
    [elements.minimumGroupInformation, controls.minimumGroupInformation],
    [elements.minimumReliability, controls.minimumReliability],
    [elements.repeatedMeasurements, controls.repeatedMeasurements],
    [elements.residualStd, controls.residualStd],
    [elements.airRepeatedMeasurements, controls.airRepeatedMeasurements],
    [elements.airResidualStd, controls.airResidualStd],
    [elements.soilRepeatedMeasurements, controls.soilRepeatedMeasurements],
    [elements.soilResidualStd, controls.soilResidualStd],
    [elements.waterRepeatedMeasurements, controls.waterRepeatedMeasurements],
    [elements.waterResidualStd, controls.waterResidualStd],
    [elements.overlayOpacity, controls.overlayOpacity]
  ];
  numericControls.forEach(([element, value]) => {
    if (element && Number.isFinite(value)) element.value = value;
  });
  if (typeof controls.fairnessConstraint === "boolean") elements.fairnessConstraint.checked = controls.fairnessConstraint;
  if (typeof controls.minimumSeparation === "boolean") elements.minimumSeparation.checked = controls.minimumSeparation;
  if (typeof controls.showCandidates === "boolean") elements.showCandidates.checked = controls.showCandidates;
  elements.citySelector.value = state.heatWorkspace;
  elements.dataMode.value = state.dataMode;
  elements.heatScenario.value = state.heatScenario;
  elements.heatExperience.value = state.heatExperience;
  elements.airPollutant.value = state.airPollutant;
  elements.waterIndicator.value = state.waterIndicator;
  elements.waterSystemType.value = state.waterSystemType;
  if (Number.isFinite(controls.liveRefreshInterval)) elements.liveRefreshInterval.value = String(controls.liveRefreshInterval);
  elements.candidateStrategy.value = state.candidateStrategy;
  elements.planningStage.value = state.planningStage;
  elements.evaluationTarget.value = controls.evaluationTarget ?? state.scenario?.model?.interventionTarget ?? "general";
  elements.airEvaluationTarget.value = controls.airEvaluationTarget ?? state.scenario?.model?.interventionTarget ?? "traffic";
  elements.soilEvaluationTarget.value = controls.soilEvaluationTarget ?? state.scenario?.model?.interventionTarget ?? "remediation";
  elements.waterEvaluationTarget.value = controls.waterEvaluationTarget ?? state.scenario?.model?.interventionTarget ?? "wastewater";
  elements.airEvaluationTarget.value = controls.airEvaluationTarget ?? state.scenario?.model?.interventionTarget ?? "traffic";
  elements.preferredProfile.value = state.activeProfile;
  if (controls.basemapStyle) {
    elements.basemapStyleSelect.value = controls.basemapStyle;
    map.setBasemapStyle(controls.basemapStyle);
  }
  map.setOverlayOpacity(elements.overlayOpacity.value);
  map.setCandidatesVisible(elements.showCandidates.checked);

  elements.monitorCountValue.value = elements.monitorCount.value;
  elements.budgetLimitValue.value = Number(elements.budgetLimit.value).toFixed(1);
  elements.influenceScaleValue.value = `${Number(elements.influenceScale.value).toFixed(2)}x`;
  elements.measurementNoiseValue.value = Number(elements.measurementNoise.value).toFixed(3);
  elements.fairnessLimitValue.value = formatPercent(Number(elements.fairnessLimit.value));
  elements.minimumGroupInformationValue.value = formatPercent(Number(elements.minimumGroupInformation.value));
  elements.minimumReliabilityValue.value = formatPercent(Number(elements.minimumReliability.value));
  elements.repeatedMeasurementsValue.value = elements.repeatedMeasurements.value;
  elements.residualStdValue.value = `${Number(elements.residualStd.value).toFixed(1)} °F`;
  elements.airRepeatedMeasurementsValue.value = elements.airRepeatedMeasurements.value;
  elements.airResidualStdValue.value = Number(elements.airResidualStd.value).toFixed(1);
  elements.soilRepeatedMeasurementsValue.value = elements.soilRepeatedMeasurements.value;
  elements.soilResidualStdValue.value = Number(elements.soilResidualStd.value).toFixed(2);
  elements.waterRepeatedMeasurementsValue.value = elements.waterRepeatedMeasurements.value;
  elements.waterResidualStdValue.value = Number(elements.waterResidualStd.value).toFixed(2);
}

function currentWorkspaceEvidenceSummary() {
  if (!state.scenario || !isPublicDomain(state.domainKey)) return null;
  const activeSolution = state.result?.solutions?.find((solution) => solution.profileKey === state.activeProfile)
    ?? state.result?.solutions?.[0]
    ?? null;
  const selectedCount = activeSolution?.selected?.length;
  const interventionReadiness = Number.isFinite(state.interventionResult?.approximatePower)
    ? state.interventionResult.approximatePower
    : Number.isFinite(state.interventionResult?.power)
      ? state.interventionResult.power
      : null;
  return {
    schemaVersion: "1.0",
    domainKey: state.domainKey,
    deployedUnits: Number.isFinite(selectedCount) ? selectedCount : Number(elements.monitorCount.value),
    activeProfile: activeSolution?.profileKey ?? state.activeProfile,
    feasible: activeSolution?.constraintStatus?.feasible !== false,
    networkMetrics: activeSolution?.metrics ? { ...activeSolution.metrics } : null,
    interventionReadiness,
    reliability: activeSolution?.metrics?.reliability ?? null,
    generatedAt: new Date().toISOString(),
    claimBoundary: "Stored planning evidence summarizes modeled network performance and does not establish realized environmental or health outcomes."
  };
}

function currentWorkspaceSnapshot(name = null) {
  if (!state.scenario) return null;
  return createWorkspaceSnapshot({
    scenario: state.scenario,
    controls: collectWorkspaceControls(),
    mapView: map.getViewState(),
    diagnostics: state.performanceDiagnostics,
    evidence: currentWorkspaceEvidenceSummary(),
    name
  });
}

async function renderSavedWorkspaces() {
  const saved = await listSavedWorkspaces();
  elements.savedWorkspaceSelect.innerHTML = saved.length
    ? `<option value="">Choose a saved workspace</option>${saved.map((entry) => `<option value="${entry.key}">${entry.name} · ${new Date(entry.savedAt).toLocaleString()}</option>`).join("")}`
    : '<option value="">No saved workspaces</option>';
  const enabled = Boolean(elements.savedWorkspaceSelect.value);
  elements.loadWorkspaceButton.disabled = !enabled;
  elements.deleteWorkspaceButton.disabled = !enabled;
  elements.exportWorkspaceButton.disabled = !state.scenario;
}

async function renderWorkspaceDiagnostics() {
  const cache = getCacheDiagnostics();
  const inventory = await inspectApiCache();
  const model = state.scenario?.model ?? {};
  let workspaceBytes = null;
  if (state.scenario) {
    try { workspaceBytes = estimateSerializedBytes(serializeScenario(state.scenario)); } catch { workspaceBytes = null; }
  }
  elements.diagnosticFitRuntime.textContent = Number.isFinite(state.performanceDiagnostics.fitRuntimeMs)
    ? `${formatRuntime(state.performanceDiagnostics.fitRuntimeMs)} ms`
    : "—";
  elements.diagnosticOptimizationRuntime.textContent = Number.isFinite(state.performanceDiagnostics.optimizationRuntimeMs)
    ? `${formatRuntime(state.performanceDiagnostics.optimizationRuntimeMs)} ms`
    : "—";
  elements.diagnosticWorkspaceSize.textContent = formatBytes(workspaceBytes);
  elements.diagnosticMemory.textContent = currentMemoryLabel();
  elements.diagnosticCache.textContent = `${cache.hits} hit / ${cache.misses} miss`;
  elements.diagnosticCacheEntries.textContent = `${inventory.entries.toLocaleString()} · ${formatBytes(inventory.bytes)}`;
  elements.diagnosticCandidates.textContent = state.scenario
    ? `${state.scenario.candidates.length} active · ${model.systematicCandidateCount ?? 0} systematic · ${model.mappedCandidateCount ?? 0} mapped`
    : "—";
  elements.diagnosticHosts.textContent = model.hostEnrichmentStatus
    ? `${model.hostEnrichmentStatus}${Number.isFinite(state.performanceDiagnostics.hostRuntimeMs) ? ` · ${formatRuntime(state.performanceDiagnostics.hostRuntimeMs)} ms` : ""}`
    : "—";
}

async function saveCurrentWorkspace({ autosave = false, name = null } = {}) {
  const snapshot = currentWorkspaceSnapshot(name);
  if (!snapshot) return null;
  await saveWorkspaceSnapshot(snapshot, { autosave });
  if (!autosave) {
    elements.workspacePersistenceStatus.textContent = `Saved ${snapshot.name} (${formatBytes(snapshot.bytes)}).`;
    await renderSavedWorkspaces();
  }
  return snapshot;
}

function scheduleWorkspaceAutosave() {
  if (!state.scenario || !["heat", "air", "soil", "water"].includes(state.domainKey) || state.workspaceRestoreInProgress) return;
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = window.setTimeout(async () => {
    if (!state.scenario || !["heat", "air", "soil", "water"].includes(state.domainKey)) return;
    const label = state.scenario.cityLabel;
    try {
      const snapshot = await saveCurrentWorkspace({ autosave: true });
      if (snapshot) elements.workspacePersistenceStatus.textContent = `Autosaved ${label} at ${new Date().toLocaleTimeString()}.`;
    } catch (error) {
      elements.workspacePersistenceStatus.textContent = `Autosave unavailable: ${error.message}`;
    }
  }, 500);
}

function activateRestoredDomainUi(domainKey) {
  showWorkspaceView();
  const domain = DOMAINS[domainKey];
  const registry = DOMAIN_REGISTRY[domainKey];
  elements.domainTitle.textContent = registry?.title ?? domain.label;
  elements.domainStatus.textContent = registry?.status ?? domain.status;
  elements.domainDescription.textContent = registry?.description ?? domain.description;
  const isUnified = domainKey === "core";
  elements.unifiedArchitectureSection.hidden = !isUnified;
  elements.crossDomainAuditSection.hidden = !isUnified;
  elements.unifiedBudgetSection.hidden = !isUnified;
  elements.crossDomainBudgetResultSection.hidden = !isUnified;
  elements.sequentialReallocationSection.hidden = !isUnified;
  elements.sequentialResultSection.hidden = !isUnified;
  elements.adaptiveSimulationSection.hidden = !isUnified;
  elements.adaptiveSimulationResultSection.hidden = !isUnified;
  elements.robustPolicySection.hidden = !isUnified;
  elements.robustPolicyResultSection.hidden = !isUnified;
  elements.spatialDeploymentSection.hidden = !isUnified;
  elements.spatialDeploymentResultSection.hidden = !isUnified;
  elements.fieldCampaignSection.hidden = !isUnified;
  elements.fieldCampaignResultSection.hidden = !isUnified;
  elements.campaignTrackingSection.hidden = !isUnified;
  elements.campaignTrackingResultSection.hidden = !isUnified;
  document.querySelectorAll(".domain-tab").forEach((button) => button.classList.toggle("active", button.dataset.domain === domainKey));
}

async function restoreWorkspaceSnapshot(snapshot, { autosave = false } = {}) {
  state.workspaceRestoreInProgress = true;
  showLoading({
    title: "Restoring saved workspace",
    message: `Rehydrating ${snapshot.name} without reloading public APIs...`,
    stage: "Reading browser storage",
    progress: 24
  });
  try {
    const scenario = deserializeScenario(snapshot.scenario);
    state.scenario = scenario;
    state.airValidation = scenario.model?.airValidation ?? null;
    state.soilSensitivity = null;
    state.waterSensitivity = null;
    if (state.domainKey === "heat") initializeLiveFields(state.scenario);
    state.result = null;
    state.interventionResult = null;
    state.viewportHeatActive = ["live-national", "live-national-air", "live-national-soil", "live-national-water"].includes(scenario.scenarioType);
    state.viewportHeatScenario = state.viewportHeatActive ? scenario : null;
    state.performanceDiagnostics = { ...state.performanceDiagnostics, ...(snapshot.diagnostics ?? {}) };
    applyWorkspaceControls(snapshot.controls ?? {});
    state.soilLabSamples = state.domainKey === "soil" ? (scenario.observations ?? []).filter((entry) => entry.sourceType === "laboratory_sample" || entry.analyte) : [];
    state.soilImportQa = state.domainKey === "soil" ? (scenario.model?.soilImportQa ?? null) : null;
    activateRestoredDomainUi(state.domainKey);
    renderWeights();
    map.setScenario(scenario, { fit: false });
    if (!map.restoreViewState(snapshot.mapView, { animate: false })) map.fitScenario({ animate: false });
    map.setLayer(state.layer);
    resetResults();
    renderDataProvenance();
    renderPlanningStage();
    renderMapLayerOptions();
    updateViewportHeatButton();
    elements.optimizeButton.disabled = !scenario.candidates.length || (state.domainKey === "heat" && state.heatExperience !== "risk");
    elements.modelExtentButton.disabled = false;
    elements.runStatus.textContent = `${scenario.cityLabel} · restored workspace · ${scenario.cells.length} evaluation points · ${scenario.candidates.length} candidates`;
    elements.workspacePersistenceStatus.textContent = `${autosave ? "Restored last session" : "Loaded workspace"}: ${snapshot.name}.`;
    updateLoading({ stage: "Complete", message: "Workspace restored.", progress: 100 });
    await renderWorkspaceDiagnostics();
    window.setTimeout(hideLoading, 180);
    return true;
  } finally {
    state.workspaceRestoreInProgress = false;
  }
}

async function tryRestoreLastWorkspace() {
  try {
    const snapshot = await loadAutosavedWorkspace();
    if (!snapshot) return false;
    return await restoreWorkspaceSnapshot(snapshot, { autosave: true });
  } catch (error) {
    console.warn("LUMOS could not restore the previous workspace.", error);
    elements.workspacePersistenceStatus.textContent = `Previous workspace could not be restored: ${error.message}`;
    return false;
  }
}

function formatConstraintValue(check) {
  if (check.key === "budget") {
    const target = Number.isFinite(check.target) ? check.target.toFixed(1) : "unlimited";
    return `${check.actual.toFixed(1)} / ${target}`;
  }
  return `${formatPercent(check.actual)} / ${formatPercent(check.target)}`;
}

function renderWeights() {
  elements.weightControls.innerHTML = "";
  for (const [key, label] of Object.entries(WEIGHT_LABELS)) {
    const wrapper = document.createElement("div");
    wrapper.className = "weight-control";
    wrapper.innerHTML = `
      <label for="weight-${key}">
        <span>${label}</span>
        <output id="weight-${key}-value">${state.weights[key].toFixed(2)}</output>
      </label>
      <input id="weight-${key}" data-weight="${key}" type="range" min="0" max="1.5" value="${state.weights[key]}" step="0.05">
    `;
    elements.weightControls.appendChild(wrapper);
  }

  elements.weightControls.querySelectorAll("input[data-weight]").forEach((input) => {
    input.addEventListener("input", () => {
      state.weights[input.dataset.weight] = Number(input.value);
      document.querySelector(`#weight-${input.dataset.weight}-value`).value = Number(input.value).toFixed(2);
      scheduleWorkspaceAutosave();
    });
  });
}

function resetResults() {
  state.result = null;
  state.activeProfile = elements.preferredProfile.value;
  if (elements.exportNationalCaseStudyButton) elements.exportNationalCaseStudyButton.disabled = true;
  if (elements.exportSoilPaperButton) elements.exportSoilPaperButton.disabled = true;
  if (elements.exportWaterPaperButton) elements.exportWaterPaperButton.disabled = true;
  map.setResult(null);
  elements.resultHeading.textContent = "Generate the portfolio";
  elements.resultSummary.textContent = "LUMOS will generate multiple constrained networks and expose the scientific, social, and cost tradeoffs.";
  elements.solutionPortfolio.innerHTML = '<option value="">No portfolio yet</option>';
  elements.solutionPortfolio.disabled = true;
  elements.portfolioSelectionMeta.textContent = "Generate the portfolio to compare balanced, information, exposure, equity, and cost-efficient networks.";
  elements.baselineTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No run yet</td></tr>';
  elements.exactBenchmarkHeading.textContent = "Exact oracle not run";
  elements.exactBenchmarkSummary.textContent = "The reduced-pool oracle will enumerate every feasible network in a controlled micro-instance.";
  elements.exactTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No run yet</td></tr>';
  elements.explanationList.innerHTML = "<li>Selections will appear after optimization.</li>";
  elements.constraintHeading.textContent = "No network evaluated";
  elements.constraintList.innerHTML = "<li>Run LUMOS to audit each requirement.</li>";
  for (const metric of [
    elements.metricObjective,
    elements.metricInformation,
    elements.metricExposure,
    elements.metricFairness,
    elements.metricGroupInformation,
    elements.metricRedundancy,
    elements.metricReliability,
    elements.metricCost
  ]) metric.textContent = "--";
}

function renderHeatValidation() {
  const calibration = state.heatCalibration;
  const locked = state.heatExperiment;
  const isLiveHeat = state.domainKey === "heat" && state.scenario?.scenarioType === "live-city";
  elements.heatValidationSection.hidden = !isLiveHeat;
  elements.experimentManifestSection.hidden = !isLiveHeat;
  if (!isLiveHeat) return;

  const validation = calibration?.validation;
  if (!validation?.available) {
    elements.validationStatus.textContent = validation?.reason ?? "Validation is unavailable for the current data.";
    elements.validationMae.textContent = "--";
    elements.validationRmse.textContent = "--";
    elements.lockedTestMae.textContent = "--";
    elements.lockedTestRmse.textContent = "--";
    elements.lockedTestCount.textContent = "--";
    elements.validationCoverage.textContent = "--";
    elements.validationLengthScale.textContent = "--";
    elements.validationNoise.textContent = "--";
    elements.validationGroupTableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No held-out validation results</td></tr>';
    elements.validationModelTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No locked-test comparison</td></tr>';
    return;
  }

  const lockedLumos = locked?.lumos;
  elements.validationStatus.textContent = `${validation.folds}-fold development CV · ${validation.count} development predictions · locked spatial test evaluated once · ${calibration.tested} covariance settings tested`;
  elements.validationMae.textContent = `${validation.model.mae.toFixed(2)} °F`;
  elements.validationRmse.textContent = `${validation.model.rmse.toFixed(2)} °F`;
  elements.lockedTestMae.textContent = lockedLumos ? `${lockedLumos.metrics.mae.toFixed(2)} °F` : "--";
  elements.lockedTestRmse.textContent = lockedLumos ? `${lockedLumos.metrics.rmse.toFixed(2)} °F` : "--";
  elements.lockedTestCount.textContent = locked?.available ? String(locked.split.test.length) : "--";
  elements.validationCoverage.textContent = Number.isFinite(lockedLumos?.metrics.coverage95)
    ? formatPercent(lockedLumos.metrics.coverage95)
    : formatPercent(validation.model.coverage95);
  elements.validationLengthScale.textContent = `${calibration.settings.lengthScaleMultiplier.toFixed(2)}x`;
  elements.validationNoise.textContent = calibration.settings.measurementNoise.toFixed(3);
  const groups = lockedLumos?.groups ?? validation.groups;
  elements.validationGroupTableBody.innerHTML = groups.map((group) => `
    <tr>
      <td>${group.group}</td>
      <td>${group.count}</td>
      <td>${group.mae.toFixed(2)} °F</td>
      <td>${group.bias >= 0 ? "+" : ""}${group.bias.toFixed(2)} °F</td>
    </tr>
  `).join("") || '<tr><td colspan="4" class="empty-cell">No group metrics available</td></tr>';
  elements.validationModelTableBody.innerHTML = locked?.methods?.map((method) => `
    <tr class="${method.name.startsWith("LUMOS") ? "best-row" : ""}">
      <td>${method.name}</td>
      <td>${method.metrics.mae.toFixed(2)} °F</td>
      <td>${method.metrics.rmse.toFixed(2)} °F</td>
      <td>${method.metrics.bias >= 0 ? "+" : ""}${method.metrics.bias.toFixed(2)} °F</td>
      <td>${method.metrics.r2.toFixed(3)}</td>
    </tr>
  `).join("") || '<tr><td colspan="5" class="empty-cell">No locked-test comparison</td></tr>';
}

function renderAirValidation() {
  const isAir = state.domainKey === "air" && state.scenario?.scenarioType === "live-national-air";
  elements.airValidationSection.hidden = !isAir;
  elements.recalibrateAirButton.hidden = !isAir;
  elements.airInferenceStatus.hidden = !isAir;
  if (!isAir) return;

  const validation = state.scenario?.model?.airValidation;
  const observations = state.scenario?.observations?.filter((entry) => Number.isFinite(entry.observedValue)) ?? [];
  const unit = state.scenario?.model?.pollutantUnit ?? "µg/m³";
  elements.recalibrateAirButton.disabled = observations.length < 6;
  elements.airInferenceStatus.textContent = observations.length
    ? `${observations.length} compatible current reference readings are conditioning the pollutant field.`
    : "No compatible current reference readings were loaded. Add an OpenAQ key and refit to enable inference validation.";
  elements.airValidationCount.textContent = String(observations.length);

  if (!validation?.available) {
    elements.airValidationStatus.textContent = validation?.reason ?? validation?.calibration?.validation?.reason ?? "At least eight compatible readings are required for a locked test.";
    for (const element of [elements.airValidationCvRmse, elements.airValidationLockedRmse, elements.airValidationBaselineRmse, elements.airValidationCoverage, elements.airValidationTransport, elements.airValidationLength, elements.airValidationNoise]) element.textContent = "--";
    elements.airValidationModelTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No locked-test comparison available</td></tr>';
    elements.airValidationGroupTableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No group validation available</td></tr>';
  } else {
    const calibration = validation.calibration;
    const locked = validation.locked;
    elements.airValidationStatus.textContent = `${validation.split.development.length} development readings · ${validation.split.locked.length} locked readings · ${calibration.tested} covariance and transport settings tested.`;
    elements.airValidationCvRmse.textContent = `${calibration.validation.model.rmse.toFixed(2)} ${unit}`;
    elements.airValidationLockedRmse.textContent = `${locked.lumos.rmse.toFixed(2)} ${unit}`;
    elements.airValidationBaselineRmse.textContent = `${locked.atmospheric.rmse.toFixed(2)} ${unit}`;
    elements.airValidationCoverage.textContent = formatPercent(locked.lumos.coverage95);
    elements.airValidationTransport.textContent = calibration.regime?.label ?? calibration.settings.transportRegime ?? "--";
    elements.airValidationLength.textContent = `${calibration.settings.lengthScaleMultiplier.toFixed(2)}x`;
    elements.airValidationNoise.textContent = calibration.settings.measurementNoise.toFixed(3);
    const models = [
      ["LUMOS trend + residual GP", locked.lumos],
      ["Atmospheric model", locked.atmospheric],
      ["Source-aware trend", locked.trend],
      ["Inverse-distance", locked.idw],
      ["Nearest monitor", locked.nearest]
    ];
    elements.airValidationModelTableBody.innerHTML = models.map(([name, metrics]) => `
      <tr class="${name.startsWith("LUMOS") ? "best-row" : ""}">
        <td>${name}</td><td>${metrics.mae.toFixed(2)} ${unit}</td><td>${metrics.rmse.toFixed(2)} ${unit}</td>
        <td>${metrics.bias >= 0 ? "+" : ""}${metrics.bias.toFixed(2)} ${unit}</td><td>${metrics.r2.toFixed(3)}</td>
      </tr>`).join("");
    elements.airValidationGroupTableBody.innerHTML = locked.groups.map((group) => `
      <tr><td>${group.group}</td><td>${group.count}</td><td>${group.mae.toFixed(2)} ${unit}</td><td>${group.bias >= 0 ? "+" : ""}${group.bias.toFixed(2)} ${unit}</td></tr>
    `).join("") || '<tr><td colspan="4" class="empty-cell">No group validation available</td></tr>';
  }

  const sensitivity = state.scenario?.model?.airTransportSensitivity ?? [];
  elements.airTransportTableBody.innerHTML = sensitivity.map((entry) => `
    <tr class="${validation?.calibration?.settings?.transportRegime === entry.key ? "best-row" : ""}">
      <td>${entry.label}</td><td>${entry.alongScale.toFixed(2)}</td><td>${entry.acrossScale.toFixed(2)}</td>
      <td>${Number.isFinite(entry.rmse) ? `${entry.rmse.toFixed(2)} ${unit}` : "--"}</td>
      <td>${Number.isFinite(entry.coverage95) ? formatPercent(entry.coverage95) : "--"}</td>
    </tr>`).join("") || '<tr><td colspan="5" class="empty-cell">At least six readings are required</td></tr>';
}


function renderSoilValidation() {
  const isSoil = state.domainKey === "soil" && state.scenario?.scenarioType === "live-national-soil";
  elements.soilValidationSection.hidden = !isSoil;
  elements.recalibrateSoilButton.hidden = !isSoil;
  elements.runSoilSensitivityButton.hidden = !isSoil;
  elements.exportSoilPaperButton.hidden = !isSoil;
  elements.runSoilEvidenceButton.hidden = !isSoil;
  elements.exportSoilEvidenceButton.hidden = !isSoil;
  elements.soilInferenceStatus.hidden = !isSoil;
  elements.soilQaStatus.hidden = !isSoil || !state.soilImportQa;
  if (!isSoil) return;

  const target = SOIL_LAB_ANALYTES[state.soilProperty] ?? SOIL_LAB_ANALYTES.ph;
  const observations = state.scenario?.observations?.filter((entry) => Number.isFinite(entry.observedValue)) ?? [];
  const validation = state.scenario?.model?.soilValidation;
  const inference = state.scenario?.model?.soilInference;
  elements.clearSoilSamplesButton.disabled = state.soilLabSamples.length === 0;
  elements.recalibrateSoilButton.disabled = observations.length < 6;
  elements.runSoilSensitivityButton.disabled = observations.length < 6;
  elements.exportSoilPaperButton.disabled = !state.result || !state.soilSensitivity;
  elements.soilLabStatus.textContent = state.soilLabSamples.length
    ? `${state.soilLabSamples.length} imported sample${state.soilLabSamples.length === 1 ? "" : "s"}; ${observations.length} compatible with ${target.label}.`
    : `No laboratory samples imported for ${target.label}.`;
  if (state.soilImportQa) {
    const qa = state.soilImportQa;
    const details = [
      `${qa.accepted}/${qa.imported} accepted`,
      `${qa.rejected} rejected`,
      `${qa.warningCount} warning${qa.warningCount === 1 ? "" : "s"}`,
      qa.censored ? `${qa.censored} censored` : null,
      qa.stale ? `${qa.stale} stale` : null,
      qa.partiallyOverlappingDepth ? `${qa.partiallyOverlappingDepth} partial-depth` : null
    ].filter(Boolean);
    elements.soilQaStatus.hidden = false;
    elements.soilQaStatus.textContent = `Import QA v${qa.version}: ${details.join(" · ")}. Rejections are excluded before inference.`;
  } else {
    elements.soilQaStatus.hidden = true;
  }
  elements.soilInferenceStatus.textContent = inference
    ? `${observations.length} compatible samples condition the ${target.label} posterior. Calibration length ${inference.lengthScaleMultiplier.toFixed(2)}x; noise ${inference.measurementNoise.toFixed(3)}.`
    : observations.length
      ? `${observations.length} compatible samples loaded. At least three are required for posterior conditioning and eight for locked validation.`
      : `${target.kind === "contaminant" ? "This contaminant target requires" : "Posterior conditioning is available with"} compatible laboratory samples.`;
  elements.soilValidationCount.textContent = String(observations.length);

  if (!validation?.available) {
    elements.soilValidationStatus.textContent = validation?.reason ?? "At least eight compatible samples are required for a locked test.";
    for (const element of [elements.soilValidationLockedRmse, elements.soilValidationBaselineRmse, elements.soilValidationCoverage, elements.soilValidationLength, elements.soilValidationNoise]) element.textContent = "--";
    elements.soilValidationModelTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No locked-test comparison available</td></tr>';
    return;
  }

  const unit = target.unit;
  const locked = validation.locked;
  elements.soilValidationStatus.textContent = `${validation.developmentCount} development samples · ${validation.lockedCount} locked samples · target ${target.label}.`;
  elements.soilValidationLockedRmse.textContent = `${locked.lumos.rmse.toFixed(2)} ${unit}`;
  elements.soilValidationBaselineRmse.textContent = `${locked.surveyTrend.rmse.toFixed(2)} ${unit}`;
  elements.soilValidationCoverage.textContent = formatPercent(locked.lumos.coverage95);
  elements.soilValidationLength.textContent = `${inference?.lengthScaleMultiplier?.toFixed(2) ?? "--"}x`;
  elements.soilValidationNoise.textContent = inference?.measurementNoise?.toFixed(3) ?? "--";
  const models = [
    ["LUMOS trend + residual GP", locked.lumos],
    ["Survey/source trend", locked.surveyTrend],
    ["Inverse-distance", locked.idw],
    ["Nearest sample", locked.nearest]
  ];
  elements.soilValidationModelTableBody.innerHTML = models.map(([name, metrics]) => `
    <tr class="${name.startsWith("LUMOS") ? "best-row" : ""}"><td>${name}</td>
    <td>${metrics.mae.toFixed(2)} ${unit}</td><td>${metrics.rmse.toFixed(2)} ${unit}</td>
    <td>${metrics.bias >= 0 ? "+" : ""}${metrics.bias.toFixed(2)} ${unit}</td><td>${metrics.r2.toFixed(3)}</td></tr>
  `).join("");
}

function renderSoilSensitivity() {
  const isSoil = state.domainKey === "soil" && state.scenario?.scenarioType === "live-national-soil";
  elements.soilSensitivitySection.hidden = !isSoil;
  if (!isSoil) return;
  const sensitivity = state.soilSensitivity;
  if (!sensitivity?.available) {
    elements.soilSensitivityStatus.textContent = sensitivity?.reason ?? "Run the Soil robustness lab after importing compatible samples.";
    for (const element of [elements.soilSensitivitySamples, elements.soilSensitivityRmse, elements.soilSensitivityCoverage, elements.soilSensitivityCovarianceRuns]) element.textContent = "--";
    elements.soilSensitivityTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No Soil robustness analysis yet</td></tr>';
    return;
  }
  const unit = SOIL_LAB_ANALYTES[sensitivity.analyte]?.unit ?? "";
  elements.soilSensitivityStatus.textContent = `${sensitivity.summary.splitCount} locked splits, ${sensitivity.summary.covarianceRuns} covariance settings, and ${sensitivity.summary.robustnessRuns} sample-quality scenarios completed.`;
  elements.soilSensitivitySamples.textContent = String(sensitivity.sampleCount);
  elements.soilSensitivityRmse.textContent = Number.isFinite(sensitivity.summary.meanLockedRmse) ? `${sensitivity.summary.meanLockedRmse.toFixed(2)} ${unit}` : "--";
  elements.soilSensitivityCoverage.textContent = Number.isFinite(sensitivity.summary.meanCoverage95) ? formatPercent(sensitivity.summary.meanCoverage95) : "--";
  elements.soilSensitivityCovarianceRuns.textContent = String(sensitivity.summary.covarianceRuns);
  elements.soilSensitivityTableBody.innerHTML = sensitivity.rows.map((row) => `
    <tr><td>${row.analysis.replaceAll("_", " ")}</td><td>${row.condition}</td><td>${row.sampleCount ?? row.lockedCount ?? "--"}</td>
    <td>${Number.isFinite(row.rmse) ? `${row.rmse.toFixed(2)} ${unit}` : "--"}</td>
    <td>${Number.isFinite(row.coverage95) ? formatPercent(row.coverage95) : "--"}</td>
    <td>${Number.isFinite(row.meanPredictiveSd) ? `${row.meanPredictiveSd.toFixed(2)} ${unit}` : "--"}</td></tr>
  `).join("");
}

function applySoilLaboratorySamples({ recalibrate = true } = {}) {
  if (state.domainKey !== "soil" || state.scenario?.scenarioType !== "live-national-soil") return false;
  const calibration = recalibrate ? null : state.scenario.model?.soilCalibration;
  attachSoilInference(state.scenario, DOMAINS.soil, {
    samples: state.soilLabSamples,
    analyte: state.soilProperty,
    calibration
  });
  state.scenario.model.soilImportQa = state.soilImportQa;
  state.soilSensitivity = null;
  state.result = null;
  state.interventionResult = null;
  state.layer = state.scenario.model?.soilInference ? "posteriorSoilValue" : "risk";
  map.setScenario(state.scenario, { fit: false });
  resetResults();
  renderMapLayerOptions();
  renderDataProvenance();
  renderSoilValidation();
  renderSoilSensitivity();
  scheduleWorkspaceAutosave();
  return true;
}

async function importSoilLaboratoryFile(file) {
  if (!file) return;
  if (state.domainKey !== "soil" || state.scenario?.scenarioType !== "live-national-soil") {
    elements.soilLabStatus.textContent = "Fit a Soil area before importing laboratory samples so coordinates can be checked against the active extent.";
    elements.soilLabSampleInput.value = "";
    return;
  }
  try {
    const parsed = parseSoilLabText(await file.text(), {
      defaultAnalyte: state.soilProperty,
      scenarioBounds: state.scenario.geoBounds,
      selectedDepth: SOIL_DEPTHS[state.soilDepth],
      sourceName: file.name
    });
    state.soilLabSamples = parsed.samples;
    state.soilImportQa = parsed.summary;
    applySoilLaboratorySamples({ recalibrate: true });
    elements.soilLabStatus.textContent = `Imported ${parsed.samples.length} accepted sample${parsed.samples.length === 1 ? "" : "s"}; ${parsed.rejected.length} row${parsed.rejected.length === 1 ? "" : "s"} rejected; ${parsed.warnings.length} warning${parsed.warnings.length === 1 ? "" : "s"}.`;
    elements.runStatus.textContent = `Soil laboratory import complete · ${parsed.samples.length} accepted · ${parsed.rejected.length} rejected · QA v${parsed.summary.version}.`;
  } catch (error) {
    elements.soilLabStatus.textContent = `Laboratory import failed: ${error.message}`;
  } finally {
    elements.soilLabSampleInput.value = "";
  }
}

function runSoilRobustnessLab() {
  if (state.domainKey !== "soil" || state.scenario?.scenarioType !== "live-national-soil") return;
  showLoading({ title: "Running Soil robustness lab", message: "Testing locked splits, covariance assumptions, and sample availability...", stage: "Preparing controlled experiments", progress: 10 });
  elements.runSoilSensitivityButton.disabled = true;
  requestAnimationFrame(() => {
    try {
      state.soilSensitivity = runSoilSensitivityAnalysis({
        scenario: state.scenario,
        domain: DOMAINS.soil,
        calibrationSettings: state.scenario.model?.soilInference ?? {}
      });
      renderSoilSensitivity();
      elements.runStatus.textContent = state.soilSensitivity.available
        ? `Soil robustness lab complete · ${state.soilSensitivity.rows.length} controlled results.`
        : state.soilSensitivity.reason;
      updateLoading({ stage: "Complete", message: "Soil robustness analysis ready.", progress: 100 });
    } catch (error) {
      elements.runStatus.textContent = `Soil robustness lab failed: ${error.message}`;
    } finally {
      elements.runSoilSensitivityButton.disabled = false;
      window.setTimeout(hideLoading, 180);
    }
  });
}

function exportSoilPaperBundle() {
  if (state.domainKey !== "soil" || !state.scenario || !state.result || !state.soilSensitivity) return;
  const bundle = buildCurrentSoilPaperBundle({
    scenario: state.scenario,
    result: state.result,
    activeProfile: state.activeProfile,
    sensitivity: state.soilSensitivity,
    settings: {
      monitorCount: Number(elements.monitorCount.value),
      budget: Number(elements.budgetLimit.value),
      fairnessLimit: Number(elements.fairnessLimit.value),
      minimumGroupInformation: Number(elements.minimumGroupInformation.value),
      minimumReliability: Number(elements.minimumReliability.value),
      activeProfile: state.activeProfile
    }
  });
  const stem = `${state.scenario.cityLabel}-${state.soilProperty}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(`${stem}-soil-paper-bundle.json`, JSON.stringify(bundle, null, 2), "application/json");
  window.setTimeout(() => downloadText(`${stem}-soil-results.csv`, rowsToSoilPaperCsv(soilPaperRows(bundle)), "text/csv;charset=utf-8"), 100);
  window.setTimeout(() => downloadText(`${stem}-soil-sensitivity.csv`, rowsToSoilSensitivityCsv(state.soilSensitivity.rows), "text/csv;charset=utf-8"), 200);
  elements.runStatus.textContent = `Exported Soil paper bundle · checksum ${bundle.checksum}.`;
}


function renderSoilEvidence() {
  const isSoil = state.domainKey === "soil";
  elements.soilEvidenceSection.hidden = !isSoil;
  elements.runSoilEvidenceButton.hidden = !isSoil;
  elements.exportSoilEvidenceButton.hidden = !isSoil;
  elements.exportSoilEvidenceButton.disabled = !isSoil || !state.soilEvidence;
  if (!isSoil) return;

  const bundle = state.soilEvidence;
  if (!bundle) {
    elements.soilEvidenceStatus.textContent = "Run the controlled suite across Fresno, Phoenix, Des Moines, and Atlanta under one frozen sampling-design protocol.";
    for (const element of [elements.soilEvidenceCases, elements.soilEvidenceFeasible, elements.soilEvidenceInformation, elements.soilEvidenceEquity, elements.soilEvidenceRmse, elements.soilEvidenceChecksum]) element.textContent = "--";
    elements.soilEvidenceTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No multi-case Soil evidence run yet</td></tr>';
    return;
  }

  const cases = bundle.cases ?? [];
  const feasible = cases.filter((entry) => entry.selectedNetwork?.feasible).length;
  const information = median(cases.map((entry) => entry.selectedNetwork?.metrics?.information));
  const equity = median(cases.map((entry) => entry.selectedNetwork?.metrics?.fairnessGap));
  const lockedRmse = median(cases.map((entry) => entry.validation?.locked?.lumos?.rmse));
  elements.soilEvidenceStatus.textContent = `${cases.length} cases completed under one frozen protocol. ${bundle.methodology?.evidenceBoundary ?? "Controlled benchmark boundary unavailable."}`;
  elements.soilEvidenceCases.textContent = String(cases.length);
  elements.soilEvidenceFeasible.textContent = `${feasible}/${cases.length}`;
  elements.soilEvidenceInformation.textContent = Number.isFinite(information) ? formatPercent(information) : "--";
  elements.soilEvidenceEquity.textContent = Number.isFinite(equity) ? formatPercent(equity) : "--";
  elements.soilEvidenceRmse.textContent = Number.isFinite(lockedRmse) ? lockedRmse.toFixed(3) : "--";
  elements.soilEvidenceChecksum.textContent = bundle.checksum?.slice(0, 12) ?? "--";
  elements.soilEvidenceTableBody.innerHTML = cases.map((entry) => {
    const metrics = entry.selectedNetwork?.metrics ?? {};
    const unit = entry.scenario?.propertyUnit ?? "";
    const rmse = entry.validation?.locked?.lumos?.rmse;
    return `<tr><td>${entry.definition?.label ?? entry.key}</td><td>${entry.scenario?.propertyLabel ?? entry.definition?.property ?? "--"}</td>
      <td>${entry.scenario?.observations ?? 0}</td><td>${entry.selectedNetwork?.selected?.length ?? 0}</td>
      <td>${Number.isFinite(metrics.information) ? formatPercent(metrics.information) : "--"}</td>
      <td>${Number.isFinite(rmse) ? `${rmse.toFixed(3)} ${unit}` : "--"}</td>
      <td>${entry.selectedNetwork?.feasible ? "Yes" : "No"}</td></tr>`;
  }).join("");
}

async function runSoilEvidenceSuite() {
  if (state.domainKey !== "soil") return;
  if (state.soilEvidenceController) state.soilEvidenceController.abort();
  const controller = new AbortController();
  state.soilEvidenceController = controller;
  elements.runSoilEvidenceButton.disabled = true;
  showLoading({
    title: "Running four-case Soil evidence suite",
    message: "Loading public survey and social context, generating controlled benchmark samples, and applying one fixed Bayesian protocol...",
    stage: "Starting Fresno organic matter",
    progress: 5,
    cancel: () => controller.abort()
  });
  try {
    state.soilEvidence = await runNationalSoilEvidenceSuite({
      signal: controller.signal,
      includeSensitivity: false,
      settings: paperRunnerSettings(),
      onProgress: ({ caseIndex = 0, caseCount = 4, caseLabel = "Soil case", stage = "Working" }) => {
        const base = caseIndex / Math.max(1, caseCount);
        const progress = 8 + Math.min(88, (base + 0.45 / Math.max(1, caseCount)) * 88);
        updateLoading({ stage: `${caseIndex + 1}/${caseCount} · ${caseLabel}`, message: stage, progress });
      }
    });
    renderSoilEvidence();
    updateLoading({ stage: "Complete", message: "Four-case Soil evidence suite is ready.", progress: 100 });
    elements.runStatus.textContent = `Soil evidence suite completed · checksum ${state.soilEvidence.checksum.slice(0, 12)}.`;
    window.setTimeout(hideLoading, 180);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      elements.runStatus.textContent = `Soil evidence suite failed: ${error.message}`;
    } else elements.runStatus.textContent = "Soil evidence suite canceled.";
    hideLoading();
  } finally {
    if (state.soilEvidenceController === controller) state.soilEvidenceController = null;
    elements.runSoilEvidenceButton.disabled = false;
  }
}

function exportSoilEvidenceSuite() {
  const bundle = state.soilEvidence;
  if (!bundle) return;
  const stem = `lumos-soil-public-evidence-${bundle.checksum.slice(0, 12)}`;
  downloadText(`${stem}.json`, JSON.stringify(bundle, null, 2), "application/json");
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToSoilEvidenceCsv(soilEvidenceRows(bundle)), "text/csv;charset=utf-8"), 100);
  elements.runStatus.textContent = `Exported Soil public evidence suite ${bundle.checksum}.`;
}

function renderWaterValidation() {
  const isWater = state.domainKey === "water" && state.scenario?.scenarioType === "live-national-water";
  elements.waterValidationSection.hidden = !isWater;
  elements.runWaterSensitivityButton.hidden = !isWater;
  elements.exportWaterPaperButton.hidden = !isWater;
  elements.runWaterEvidenceButton.hidden = state.domainKey !== "water";
  elements.exportWaterEvidenceButton.hidden = state.domainKey !== "water";
  elements.waterInferenceStatus.hidden = !isWater;
  if (!isWater) return;

  const observations = state.scenario?.observations?.filter((entry) => Number.isFinite(entry.observedValue)) ?? [];
  const validation = state.scenario?.model?.waterValidation;
  const inference = state.scenario?.model?.waterInference;
  const unit = state.scenario?.model?.indicatorUnit ?? "";
  elements.runWaterSensitivityButton.disabled = observations.length < 6;
  elements.exportWaterPaperButton.disabled = !state.result || !state.waterSensitivity;
  elements.waterInferenceStatus.textContent = inference
    ? `${inference.observationsUsed} observations condition the ${inference.flowRegimeLabel ?? inference.flowRegime} residual GP; flow and branch structure remain screening proxies.`
    : `${observations.length} compatible observations. At least three are required for posterior conditioning.`;
  elements.waterValidationCount.textContent = String(observations.length);
  elements.waterValidationFlow.textContent = inference?.flowRegimeLabel ?? inference?.flowRegime ?? "--";
  elements.waterValidationLength.textContent = Number.isFinite(inference?.lengthScaleMultiplier) ? `${inference.lengthScaleMultiplier.toFixed(2)}×` : "--";
  elements.waterValidationNoise.textContent = Number.isFinite(inference?.measurementNoise) ? inference.measurementNoise.toFixed(3) : "--";

  if (!validation?.available) {
    elements.waterValidationStatus.textContent = validation?.reason ?? "At least eight compatible observations are required for locked validation.";
    for (const element of [elements.waterValidationCvRmse, elements.waterValidationLockedRmse, elements.waterValidationBaselineRmse, elements.waterValidationCoverage]) element.textContent = "--";
    elements.waterValidationModelTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No locked-test comparison yet</td></tr>';
    elements.waterValidationGroupTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No group-level comparison yet</td></tr>';
    return;
  }

  const cv = validation.calibration?.selected?.validation?.model;
  const locked = validation.locked?.lumos;
  elements.waterValidationStatus.textContent = `${validation.split.development.length} development and ${validation.split.locked.length} locked observations. The locked set remained outside calibration and model selection.`;
  elements.waterValidationCvRmse.textContent = Number.isFinite(cv?.rmse) ? `${cv.rmse.toFixed(2)} ${unit}` : "--";
  elements.waterValidationLockedRmse.textContent = Number.isFinite(locked?.rmse) ? `${locked.rmse.toFixed(2)} ${unit}` : "--";
  elements.waterValidationBaselineRmse.textContent = Number.isFinite(validation.locked?.screening?.rmse) ? `${validation.locked.screening.rmse.toFixed(2)} ${unit}` : "--";
  elements.waterValidationCoverage.textContent = Number.isFinite(locked?.coverage95) ? formatPercent(locked.coverage95) : "--";
  const models = [
    ["LUMOS flow-aware GP", validation.locked?.lumos],
    ["Isotropic GP", validation.locked?.isotropic],
    ["Screening prior", validation.locked?.screening],
    ["Source-aware trend", validation.locked?.trend],
    ["Inverse-distance", validation.locked?.idw],
    ["Nearest station", validation.locked?.nearest]
  ].filter(([, metrics]) => metrics && Number.isFinite(metrics.rmse));
  elements.waterValidationModelTableBody.innerHTML = models.map(([name, metrics]) => `
    <tr class="${name.startsWith("LUMOS") ? "best-row" : ""}"><td>${name}</td>
    <td>${metrics.mae.toFixed(2)} ${unit}</td><td>${metrics.rmse.toFixed(2)} ${unit}</td>
    <td>${metrics.bias >= 0 ? "+" : ""}${metrics.bias.toFixed(2)} ${unit}</td><td>${Number.isFinite(metrics.r2) ? metrics.r2.toFixed(3) : "--"}</td>
    <td>${Number.isFinite(metrics.coverage95) ? formatPercent(metrics.coverage95) : "--"}</td></tr>
  `).join("");
  elements.waterValidationGroupTableBody.innerHTML = (validation.locked?.groups ?? []).map((entry) => `
    <tr><td>${entry.group}</td><td>${entry.count}</td><td>${entry.mae.toFixed(2)} ${unit}</td>
    <td>${entry.rmse.toFixed(2)} ${unit}</td><td>${entry.bias >= 0 ? "+" : ""}${entry.bias.toFixed(2)} ${unit}</td></tr>
  `).join("") || '<tr><td colspan="5" class="empty-cell">No group-level comparison yet</td></tr>';
}

function renderWaterSensitivity() {
  const isWater = state.domainKey === "water" && state.scenario?.scenarioType === "live-national-water";
  elements.waterSensitivitySection.hidden = !isWater;
  if (!isWater) return;
  const sensitivity = state.waterSensitivity;
  const unit = state.scenario?.model?.indicatorUnit ?? "";
  if (!sensitivity?.available) {
    elements.waterSensitivityStatus.textContent = sensitivity?.reason ?? "Run the Water robustness lab after fitting at least six compatible observations.";
    for (const element of [elements.waterSensitivityObservations, elements.waterSensitivityRmse, elements.waterSensitivityCoverage, elements.waterSensitivityBestFlow, elements.waterSensitivityRuns]) element.textContent = "--";
    elements.waterSensitivityTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No Water robustness analysis yet</td></tr>';
    return;
  }
  const summary = sensitivity.summary;
  elements.waterSensitivityStatus.textContent = `${summary.splitCount} locked splits, ${summary.covarianceRuns} flow/covariance settings, and ${summary.robustnessRuns} observation scenarios completed.`;
  elements.waterSensitivityObservations.textContent = String(sensitivity.observationCount);
  elements.waterSensitivityRmse.textContent = Number.isFinite(summary.meanLockedRmse) ? `${summary.meanLockedRmse.toFixed(2)} ${unit}` : "--";
  elements.waterSensitivityCoverage.textContent = Number.isFinite(summary.meanCoverage95) ? formatPercent(summary.meanCoverage95) : "--";
  elements.waterSensitivityBestFlow.textContent = summary.bestFlowCondition ?? "--";
  elements.waterSensitivityRuns.textContent = String(sensitivity.rows.length);
  elements.waterSensitivityTableBody.innerHTML = sensitivity.rows.map((row) => `
    <tr><td>${row.analysis.replaceAll("_", " ")}</td><td>${row.condition}</td><td>${row.observationCount ?? row.lockedCount ?? "--"}</td>
    <td>${Number.isFinite(row.rmse) ? `${row.rmse.toFixed(2)} ${unit}` : "--"}</td>
    <td>${Number.isFinite(row.coverage95) ? formatPercent(row.coverage95) : "--"}</td>
    <td>${Number.isFinite(row.meanPosteriorShift) ? `${row.meanPosteriorShift >= 0 ? "+" : ""}${row.meanPosteriorShift.toFixed(2)} ${unit}` : "--"}</td>
    <td>${Number.isFinite(row.meanPredictiveSd) ? `${row.meanPredictiveSd.toFixed(2)} ${unit}` : "--"}</td></tr>
  `).join("");
}

function runWaterRobustnessLab() {
  if (state.domainKey !== "water" || state.scenario?.scenarioType !== "live-national-water") return;
  showLoading({ title: "Running Water robustness lab", message: "Testing locked splits, flow assumptions, station loss, and observation quality...", stage: "Preparing controlled experiments", progress: 10 });
  elements.runWaterSensitivityButton.disabled = true;
  requestAnimationFrame(() => {
    try {
      const domain = { ...DOMAINS.water, transportAngle: state.scenario.model?.transportAngle ?? DOMAINS.water.transportAngle };
      state.waterSensitivity = runWaterSensitivityAnalysis({ scenario: state.scenario, domain, calibrationSettings: state.scenario.model?.waterInference ?? {} });
      renderWaterSensitivity();
      renderWaterValidation();
      elements.runStatus.textContent = state.waterSensitivity.available
        ? `Water robustness lab complete · ${state.waterSensitivity.rows.length} controlled results.`
        : state.waterSensitivity.reason;
      updateLoading({ stage: "Complete", message: "Water robustness analysis ready.", progress: 100 });
    } catch (error) {
      elements.runStatus.textContent = `Water robustness lab failed: ${error.message}`;
    } finally {
      elements.runWaterSensitivityButton.disabled = false;
      window.setTimeout(hideLoading, 180);
    }
  });
}

function exportWaterPaperBundle() {
  if (state.domainKey !== "water" || !state.scenario || !state.result || !state.waterSensitivity) return;
  const bundle = buildCurrentWaterPaperBundle({
    scenario: state.scenario,
    result: state.result,
    activeProfile: state.activeProfile,
    sensitivity: state.waterSensitivity,
    intervention: state.interventionResult,
    settings: {
      monitorCount: Number(elements.monitorCount.value),
      budget: Number(elements.budgetLimit.value),
      fairnessLimit: Number(elements.fairnessLimit.value),
      minimumGroupInformation: Number(elements.minimumGroupInformation.value),
      minimumReliability: Number(elements.minimumReliability.value),
      activeProfile: state.activeProfile
    }
  });
  const stem = `${state.scenario.cityLabel}-${state.waterIndicator}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(`${stem}-water-paper-bundle.json`, JSON.stringify(bundle, null, 2), "application/json");
  window.setTimeout(() => downloadText(`${stem}-water-results.csv`, rowsToWaterPaperCsv(waterPaperRows(bundle)), "text/csv;charset=utf-8"), 100);
  window.setTimeout(() => downloadText(`${stem}-water-sensitivity.csv`, rowsToWaterSensitivityCsv(state.waterSensitivity.rows), "text/csv;charset=utf-8"), 200);
  elements.runStatus.textContent = `Exported Water paper bundle · checksum ${bundle.checksum}.`;
}

function renderWaterEvidence() {
  const isWater = state.domainKey === "water";
  elements.waterEvidenceSection.hidden = !isWater;
  elements.runWaterEvidenceButton.hidden = !isWater;
  elements.exportWaterEvidenceButton.hidden = !isWater;
  elements.exportWaterEvidenceButton.disabled = !isWater || !state.waterEvidence;
  if (!isWater) return;
  const bundle = state.waterEvidence;
  if (!bundle) {
    elements.waterEvidenceStatus.textContent = "Run Denver temperature, Houston turbidity, Pittsburgh conductance, and Portland discharge under one frozen monitoring-design protocol.";
    for (const element of [elements.waterEvidenceCases, elements.waterEvidenceFeasible, elements.waterEvidenceInformation, elements.waterEvidenceEquity, elements.waterEvidenceRmse, elements.waterEvidenceChecksum]) element.textContent = "--";
    elements.waterEvidenceTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No multi-case Water evidence run yet</td></tr>';
    return;
  }
  const cases = bundle.cases ?? [];
  const feasible = cases.filter((entry) => entry.selectedNetwork?.feasible).length;
  const information = median(cases.map((entry) => entry.selectedNetwork?.metrics?.information));
  const equity = median(cases.map((entry) => entry.selectedNetwork?.metrics?.fairnessGap));
  const lockedRmse = median(cases.map((entry) => entry.validation?.locked?.lumos?.rmse));
  elements.waterEvidenceStatus.textContent = `${cases.length} cases completed under one frozen protocol. ${bundle.methodology?.evidenceBoundary ?? "Controlled benchmark boundary unavailable."}`;
  elements.waterEvidenceCases.textContent = String(cases.length);
  elements.waterEvidenceFeasible.textContent = `${feasible}/${cases.length}`;
  elements.waterEvidenceInformation.textContent = Number.isFinite(information) ? formatPercent(information) : "--";
  elements.waterEvidenceEquity.textContent = Number.isFinite(equity) ? formatPercent(equity) : "--";
  elements.waterEvidenceRmse.textContent = Number.isFinite(lockedRmse) ? lockedRmse.toFixed(3) : "--";
  elements.waterEvidenceChecksum.textContent = bundle.checksum?.slice(0, 12) ?? "--";
  elements.waterEvidenceTableBody.innerHTML = cases.map((entry) => {
    const metrics = entry.selectedNetwork?.metrics ?? {};
    const unit = entry.scenario?.indicatorUnit ?? "";
    const rmse = entry.validation?.locked?.lumos?.rmse;
    return `<tr><td>${entry.definition?.label ?? entry.key}</td><td>${entry.scenario?.indicatorLabel ?? entry.definition?.indicator ?? "--"}</td>
      <td>${entry.scenario?.observations ?? 0}</td><td>${entry.selectedNetwork?.selected?.length ?? 0}</td>
      <td>${Number.isFinite(metrics.information) ? formatPercent(metrics.information) : "--"}</td>
      <td>${Number.isFinite(rmse) ? `${rmse.toFixed(3)} ${unit}` : "--"}</td>
      <td>${entry.selectedNetwork?.feasible ? "Yes" : "No"}</td></tr>`;
  }).join("");
}

async function runWaterEvidenceSuite() {
  if (state.domainKey !== "water") return;
  if (state.waterEvidenceController) state.waterEvidenceController.abort();
  const controller = new AbortController();
  state.waterEvidenceController = controller;
  elements.runWaterEvidenceButton.disabled = true;
  showLoading({ title: "Running four-case Water evidence suite", message: "Loading public Water and social context and applying one frozen protocol...", stage: "Preparing evidence cases", progress: 5, cancel: () => controller.abort() });
  try {
    state.waterEvidence = await runNationalWaterEvidenceSuite({
      signal: controller.signal,
      includeSensitivity: false,
      settings: {
        monitorCount: Math.min(12, Math.max(6, Number(elements.monitorCount.value))),
        budget: Math.max(10, Number(elements.budgetLimit.value)),
        fairnessLimit: Number(elements.fairnessLimit.value),
        minimumGroupInformation: Number(elements.minimumGroupInformation.value),
        minimumReliability: Number(elements.minimumReliability.value),
        activeProfile: state.activeProfile
      },
      onProgress: ({ caseIndex, caseCount, caseLabel, stage }) => {
        const progress = Math.min(94, 8 + ((caseIndex + 0.5) / Math.max(1, caseCount)) * 84);
        updateLoading({ stage: `${caseLabel} · ${stage}`, message: `Case ${caseIndex + 1} of ${caseCount}: ${caseLabel}`, progress });
      }
    });
    renderWaterEvidence();
    elements.runStatus.textContent = `Water public evidence suite complete · checksum ${state.waterEvidence.checksum}.`;
    updateLoading({ stage: "Complete", message: "Water evidence suite ready.", progress: 100 });
  } catch (error) {
    if (error?.name !== "AbortError") elements.runStatus.textContent = `Water evidence suite failed: ${error.message}`;
  } finally {
    if (state.waterEvidenceController === controller) state.waterEvidenceController = null;
    elements.runWaterEvidenceButton.disabled = false;
    window.setTimeout(hideLoading, 180);
  }
}

function exportWaterEvidenceSuite() {
  const bundle = state.waterEvidence;
  if (!bundle) return;
  const stem = `lumos-water-public-evidence-${bundle.checksum.slice(0, 12)}`;
  downloadText(`${stem}.json`, JSON.stringify(bundle, null, 2), "application/json");
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToWaterEvidenceCsv(waterEvidenceRows(bundle)), "text/csv;charset=utf-8"), 100);
  elements.runStatus.textContent = `Exported Water public evidence suite ${bundle.checksum}.`;
}

function renderAirSensitivity() {
  const isAir = state.domainKey === "air" && state.scenario?.scenarioType === "live-national-air";
  elements.airSensitivitySection.hidden = !isAir;
  elements.runAirSensitivityButton.hidden = !isAir;
  elements.exportAirPaperButton.hidden = !isAir;
  elements.exportAirPaperButton.disabled = !isAir || !state.airSensitivity || !state.result;
  if (!isAir) return;

  const sensitivity = state.airSensitivity;
  const unit = state.scenario?.model?.pollutantUnit ?? "µg/m³";
  if (!sensitivity) {
    elements.airSensitivityStatus.textContent = "Run the Air robustness lab after fitting an Air workspace.";
    for (const element of [
      elements.airSensitivityRuntime,
      elements.airSensitivitySplitRange,
      elements.airSensitivityBestTransport,
      elements.airSensitivityRoleLoss,
      elements.airSensitivityReadingRobustness
    ]) element.textContent = "--";
    elements.airSensitivitySplitTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No split analysis yet</td></tr>';
    elements.airSensitivityCovarianceTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No covariance analysis yet</td></tr>';
    elements.airSensitivityObservationTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No observation analysis yet</td></tr>';
    elements.airSensitivityRoleTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No role stress test yet</td></tr>';
    elements.airSensitivityFairnessTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No fairness analysis yet</td></tr>';
    return;
  }

  const splitRmse = sensitivity.splitSeeds.map((entry) => entry.rmse).filter(Number.isFinite);
  const bestTransport = sensitivity.covarianceTransport.find((entry) => Number.isFinite(entry.rmse));
  const roleBase = sensitivity.candidateRoles.find((entry) => entry.key === "all");
  const roleLoss = sensitivity.candidateRoles
    .filter((entry) => entry.key !== "all" && Number.isFinite(entry.information) && Number.isFinite(roleBase?.information))
    .map((entry) => ({ ...entry, loss: roleBase.information - entry.information }))
    .sort((left, right) => right.loss - left.loss)[0];
  const observationBase = sensitivity.observationRobustness.find((entry) => entry.key === "all");
  const observationWorst = sensitivity.observationRobustness
    .filter((entry) => entry.key !== "all" && Number.isFinite(entry.rmse) && Number.isFinite(observationBase?.rmse))
    .map((entry) => ({ ...entry, increase: entry.rmse - observationBase.rmse }))
    .sort((left, right) => right.increase - left.increase)[0];

  elements.airSensitivityStatus.textContent = `Five controlled analyses completed using ${sensitivity.observationCount} compatible readings, ${sensitivity.splitSeeds.length} split seeds, ${sensitivity.covarianceTransport.length} covariance/transport settings, ${sensitivity.candidateRoles.length} candidate-role scenarios, and ${sensitivity.fairness.length} fairness thresholds.`;
  elements.airSensitivityRuntime.textContent = `${(sensitivity.runtimeMs / 1000).toFixed(2)} s`;
  elements.airSensitivitySplitRange.textContent = splitRmse.length
    ? `${Math.min(...splitRmse).toFixed(2)}–${Math.max(...splitRmse).toFixed(2)} ${unit}`
    : "Unavailable";
  elements.airSensitivityBestTransport.textContent = bestTransport
    ? `${bestTransport.transportLabel} · ${bestTransport.lengthScaleMultiplier.toFixed(2)}x / ${bestTransport.measurementNoise.toFixed(3)}`
    : "Unavailable";
  elements.airSensitivityRoleLoss.textContent = roleLoss
    ? `${roleLoss.label} · ${Math.max(0, roleLoss.loss * 100).toFixed(1)} pts`
    : "No measurable loss";
  elements.airSensitivityReadingRobustness.textContent = observationWorst && Number.isFinite(observationWorst.increase)
    ? `${observationWorst.label} · ${observationWorst.increase >= 0 ? "+" : ""}${observationWorst.increase.toFixed(2)} ${unit} RMSE`
    : "Unavailable";

  elements.airSensitivitySplitTableBody.innerHTML = sensitivity.splitSeeds.map((entry) => `
    <tr><td>${entry.seed}</td><td>${entry.lockedCount}</td><td>${formatMaybe(entry.mae, 2, ` ${unit}`)}</td>
    <td>${formatMaybe(entry.rmse, 2, ` ${unit}`)}</td><td>${formatMaybe(entry.bias, 2, ` ${unit}`)}</td>
    <td>${Number.isFinite(entry.coverage95) ? formatPercent(entry.coverage95) : "--"}</td><td>${entry.lumosRank ?? "--"}</td></tr>
  `).join("");
  elements.airSensitivityCovarianceTableBody.innerHTML = sensitivity.covarianceTransport.map((entry, index) => `
    <tr class="${index === 0 && Number.isFinite(entry.rmse) ? "best-row" : ""}"><td>${entry.transportLabel}</td>
    <td>${entry.lengthScaleMultiplier.toFixed(2)}x</td><td>${entry.measurementNoise.toFixed(3)}</td>
    <td>${formatMaybe(entry.rmse, 2, ` ${unit}`)}</td><td>${Number.isFinite(entry.coverage95) ? formatPercent(entry.coverage95) : "--"}</td></tr>
  `).join("");
  elements.airSensitivityObservationTableBody.innerHTML = sensitivity.observationRobustness.map((entry) => `
    <tr><td>${entry.label}</td><td>${entry.count}</td><td>${formatMaybe(entry.mae, 2, ` ${unit}`)}</td>
    <td>${formatMaybe(entry.rmse, 2, ` ${unit}`)}</td><td>${formatMaybe(entry.bias, 2, ` ${unit}`)}</td>
    <td>${Number.isFinite(entry.coverage95) ? formatPercent(entry.coverage95) : "--"}</td></tr>
  `).join("");
  elements.airSensitivityRoleTableBody.innerHTML = sensitivity.candidateRoles.map((entry) => `
    <tr><td>${entry.label}</td><td>${entry.candidateCount}</td><td>${entry.monitorCount}</td>
    <td>${Number.isFinite(entry.information) ? formatPercent(entry.information) : "--"}</td>
    <td>${Number.isFinite(entry.minimumGroupInformation) ? formatPercent(entry.minimumGroupInformation) : "--"}</td>
    <td>${Number.isFinite(entry.fairnessGap) ? formatPercent(entry.fairnessGap) : "--"}</td><td>${entry.feasible ? "Yes" : "No"}</td></tr>
  `).join("");
  elements.airSensitivityFairnessTableBody.innerHTML = sensitivity.fairness.map((entry) => `
    <tr><td>${formatPercent(entry.fairnessLimit)}</td><td>${entry.monitorCount}</td>
    <td>${Number.isFinite(entry.information) ? formatPercent(entry.information) : "--"}</td>
    <td>${Number.isFinite(entry.minimumGroupInformation) ? formatPercent(entry.minimumGroupInformation) : "--"}</td>
    <td>${Number.isFinite(entry.fairnessGap) ? formatPercent(entry.fairnessGap) : "--"}</td>
    <td>${formatMaybe(entry.totalCost, 2)}</td><td>${entry.feasible ? "Yes" : "No"}</td></tr>
  `).join("");
}

async function runAirSensitivityLab() {
  if (state.domainKey !== "air" || state.scenario?.scenarioType !== "live-national-air") return;
  showLoading({
    title: "Running Air robustness lab",
    message: "Testing split stability, transport assumptions, reference-reading quality, candidate roles, and fairness thresholds...",
    stage: "Preparing controlled experiments",
    progress: 8
  });
  elements.runAirSensitivityButton.disabled = true;
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const validation = state.scenario.model?.airValidation;
    const calibrationSettings = validation?.calibration?.settings ?? state.scenario.model?.airInference ?? {
      lengthScaleMultiplier: Number(elements.influenceScale.value),
      measurementNoise: Number(elements.measurementNoise.value),
      transportRegime: "moderate"
    };
    const domain = { ...DOMAINS.air, transportAngle: state.scenario.model?.transportAngle ?? 0 };
    updateLoading({ stage: "Running experiments", message: "The core Bayesian and social objectives remain active in every stress test.", progress: 35 });
    state.airSensitivity = runAirSensitivityAnalysis({
      scenario: state.scenario,
      domain,
      calibrationSettings,
      monitorCount: Number(elements.monitorCount.value),
      budget: Number(elements.budgetLimit.value),
      fairnessLimit: Number(elements.fairnessLimit.value),
      minimumGroupInformation: Number(elements.minimumGroupInformation.value),
      minimumReliability: Number(elements.minimumReliability.value),
      enforceSocialConstraints: elements.fairnessConstraint.checked
    });
    updateLoading({ stage: "Complete", message: "Air robustness analysis is ready.", progress: 100 });
    renderAirSensitivity();
    elements.runStatus.textContent = `Air robustness lab completed in ${(state.airSensitivity.runtimeMs / 1000).toFixed(2)} seconds.`;
  } catch (error) {
    elements.runStatus.textContent = `Air robustness lab failed: ${error.message}`;
  } finally {
    hideLoading();
    elements.runAirSensitivityButton.disabled = false;
  }
}

function exportAirPaperBundle() {
  if (state.domainKey !== "air" || !state.scenario || !state.result || !state.airSensitivity) return;
  const settings = {
    monitorCount: Number(elements.monitorCount.value),
    budget: Number(elements.budgetLimit.value),
    fairnessLimit: Number(elements.fairnessLimit.value),
    minimumGroupInformation: Number(elements.minimumGroupInformation.value),
    minimumReliability: Number(elements.minimumReliability.value),
    measurementNoise: Number(elements.measurementNoise.value),
    lengthScaleMultiplier: Number(elements.influenceScale.value),
    activeProfile: state.activeProfile
  };
  const bundle = buildCurrentAirPaperBundle({
    scenario: state.scenario,
    result: state.result,
    activeProfile: state.activeProfile,
    sensitivity: state.airSensitivity,
    settings
  });
  const base = `${state.scenario.scenarioId ?? "lumos-air"}-${state.scenario.model?.pollutant ?? "pollutant"}`
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(`${base}-paper-bundle.json`, JSON.stringify(bundle, null, 2), "application/json");
  downloadText(`${base}-paper-results.csv`, rowsToAirPaperCsv(airPaperRows(bundle)), "text/csv");
  downloadText(`${base}-sensitivity.csv`, rowsToAirCsv(buildAirPaperRows(state.airSensitivity, state.scenario)), "text/csv");
  elements.runStatus.textContent = `Exported Air paper bundle ${bundle.checksum}.`;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

function renderAirEvidence() {
  const isAir = state.domainKey === "air";
  elements.airEvidenceSection.hidden = !isAir;
  elements.runAirEvidenceButton.hidden = !isAir;
  elements.exportAirEvidenceButton.hidden = !isAir;
  elements.exportAirEvidenceButton.disabled = !isAir || !state.airEvidence;
  if (!isAir) return;

  const bundle = state.airEvidence;
  if (!bundle) {
    elements.airEvidenceStatus.textContent = "Run the suite to evaluate Los Angeles PM2.5, Houston ozone, Chicago NO₂, and New York PM2.5 under one fixed protocol.";
    for (const element of [elements.airEvidenceCases, elements.airEvidenceFeasible, elements.airEvidenceInformation, elements.airEvidenceEquity, elements.airEvidenceChecksum]) element.textContent = "--";
    elements.airEvidenceTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No multi-city Air evidence run yet</td></tr>';
    return;
  }

  const cases = bundle.cases ?? [];
  const feasible = cases.filter((entry) => entry.selectedNetwork?.feasible).length;
  const information = median(cases.map((entry) => entry.selectedNetwork?.metrics?.information));
  const equity = median(cases.map((entry) => entry.selectedNetwork?.metrics?.fairnessGap));
  elements.airEvidenceStatus.textContent = `${cases.length} cases completed under one frozen browser-scale protocol. ${bundle.methodology?.referenceBoundary ?? "Reference-data status unavailable."}`;
  elements.airEvidenceCases.textContent = String(cases.length);
  elements.airEvidenceFeasible.textContent = `${feasible}/${cases.length}`;
  elements.airEvidenceInformation.textContent = Number.isFinite(information) ? formatPercent(information) : "--";
  elements.airEvidenceEquity.textContent = Number.isFinite(equity) ? formatPercent(equity) : "--";
  elements.airEvidenceChecksum.textContent = bundle.checksum?.slice(0, 12) ?? "--";
  elements.airEvidenceTableBody.innerHTML = cases.map((entry) => {
    const metrics = entry.selectedNetwork?.metrics ?? {};
    const pollutant = AIR_POLLUTANTS[entry.scenario?.pollutant ?? entry.definition?.pollutant]?.label
      ?? entry.scenario?.pollutantLabel
      ?? entry.definition?.pollutant
      ?? "--";
    return `<tr><td>${entry.definition?.label ?? entry.key}</td><td>${pollutant}</td><td>${entry.selectedNetwork?.selected?.length ?? 0}</td>
      <td>${Number.isFinite(metrics.information) ? formatPercent(metrics.information) : "--"}</td>
      <td>${Number.isFinite(metrics.minimumGroupInformation) ? formatPercent(metrics.minimumGroupInformation) : "--"}</td>
      <td>${Number.isFinite(metrics.fairnessGap) ? formatPercent(metrics.fairnessGap) : "--"}</td>
      <td>${entry.selectedNetwork?.feasible ? "Yes" : "No"}</td></tr>`;
  }).join("");
}

async function runAirEvidenceSuite() {
  if (state.domainKey !== "air") return;
  if (state.airEvidenceController) state.airEvidenceController.abort();
  const controller = new AbortController();
  state.airEvidenceController = controller;
  elements.runAirEvidenceButton.disabled = true;
  showLoading({
    title: "Running four-city Air evidence suite",
    message: "Loading public inputs and applying one fixed Bayesian, social, benchmark, and feasibility protocol...",
    stage: "Starting Los Angeles PM2.5",
    progress: 5,
    cancel: () => controller.abort()
  });
  try {
    state.airEvidence = await runNationalAirPaperSuite({
      signal: controller.signal,
      openAqApiKey: state.openAqApiKey,
      includeSensitivity: false,
      settings: paperRunnerSettings(),
      onProgress: ({ caseIndex = 0, caseCount = 4, caseLabel = "Air case", stage = "Working" }) => {
        const base = caseIndex / Math.max(1, caseCount);
        const progress = 8 + Math.min(88, (base + 0.45 / Math.max(1, caseCount)) * 88);
        updateLoading({
          stage: `${caseIndex + 1}/${caseCount} · ${caseLabel}`,
          message: stage,
          progress
        });
      }
    });
    renderAirEvidence();
    updateLoading({ stage: "Complete", message: "Four-city Air evidence suite is ready.", progress: 100 });
    elements.runStatus.textContent = `Air evidence suite completed · checksum ${state.airEvidence.checksum.slice(0, 12)}.`;
    window.setTimeout(hideLoading, 180);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      elements.runStatus.textContent = `Air evidence suite failed: ${error.message}`;
    } else {
      elements.runStatus.textContent = "Air evidence suite canceled.";
    }
    hideLoading();
  } finally {
    if (state.airEvidenceController === controller) state.airEvidenceController = null;
    elements.runAirEvidenceButton.disabled = false;
  }
}

function exportAirEvidenceSuite() {
  const bundle = state.airEvidence;
  if (!bundle) return;
  const stem = `lumos-air-public-evidence-${bundle.checksum.slice(0, 12)}`;
  downloadText(`${stem}.json`, JSON.stringify(bundle, null, 2), "application/json");
  downloadText(`${stem}.csv`, rowsToAirPaperCsv(airPaperRows(bundle)), "text/csv");
  elements.runStatus.textContent = `Exported Air public evidence suite ${bundle.checksum}.`;
}

function formatMaybe(value, digits = 3, suffix = "") {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "--";
}

function renderHeatSensitivity() {
  const isLiveHeat = state.domainKey === "heat" && state.scenario?.scenarioType === "live-city";
  elements.heatSensitivitySection.hidden = !isLiveHeat;
  elements.runSensitivityButton.hidden = !isLiveHeat;
  elements.exportPaperTablesButton.hidden = !isLiveHeat;
  elements.exportPaperTablesButton.disabled = !state.heatSensitivity;
  if (!isLiveHeat) return;

  const sensitivity = state.heatSensitivity;
  if (!sensitivity) {
    elements.sensitivityStatus.textContent = "Run the Sensitivity Lab after live Heat inference is ready.";
    elements.sensitivityRuntime.textContent = "--";
    elements.sensitivitySplitRange.textContent = "--";
    elements.sensitivityBestCovariance.textContent = "--";
    elements.sensitivityHostWorst.textContent = "--";
    elements.sensitivityFairnessCost.textContent = "--";
    elements.sensitivitySplitTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No split-seed analysis yet</td></tr>';
    elements.sensitivityCovarianceTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No covariance analysis yet</td></tr>';
    elements.sensitivityHostTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No host-stress analysis yet</td></tr>';
    elements.sensitivityFairnessTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">No fairness analysis yet</td></tr>';
    return;
  }

  const splitRmse = sensitivity.splitSeeds.map((entry) => entry.rmse).filter(Number.isFinite);
  const bestCovariance = sensitivity.covariance.find((entry) => Number.isFinite(entry.rmse));
  const baselineHost = sensitivity.hostStress.find((entry) => entry.key === "all");
  const hostLosses = sensitivity.hostStress
    .filter((entry) => entry.key !== "all" && Number.isFinite(entry.information) && Number.isFinite(baselineHost?.information))
    .map((entry) => ({ ...entry, informationLoss: baselineHost.information - entry.information }))
    .sort((left, right) => right.informationLoss - left.informationLoss);
  const strictFairness = [...sensitivity.fairness].sort((left, right) => left.fairnessLimit - right.fairnessLimit)[0];
  const relaxedFairness = [...sensitivity.fairness].sort((left, right) => right.fairnessLimit - left.fairnessLimit)[0];
  const informationCost = Number.isFinite(strictFairness?.information) && Number.isFinite(relaxedFairness?.information)
    ? relaxedFairness.information - strictFairness.information
    : null;

  elements.sensitivityStatus.textContent = `Four controlled analyses completed using ${sensitivity.settings.splitSeeds.length} spatial split seeds, ${sensitivity.covariance.length} covariance settings, ${sensitivity.hostStress.length} host scenarios, and ${sensitivity.fairness.length} fairness thresholds.`;
  elements.sensitivityRuntime.textContent = `${(sensitivity.runtimeMs / 1000).toFixed(2)} s`;
  elements.sensitivitySplitRange.textContent = splitRmse.length
    ? `${Math.min(...splitRmse).toFixed(2)}–${Math.max(...splitRmse).toFixed(2)} °F`
    : "--";
  elements.sensitivityBestCovariance.textContent = bestCovariance
    ? `${bestCovariance.lengthScaleMultiplier.toFixed(2)}x / ${bestCovariance.measurementNoise.toFixed(3)}`
    : "--";
  elements.sensitivityHostWorst.textContent = hostLosses[0]
    ? `${hostLosses[0].label} (${formatPercent(Math.max(0, hostLosses[0].informationLoss))})`
    : "--";
  elements.sensitivityFairnessCost.textContent = Number.isFinite(informationCost)
    ? `${informationCost >= 0 ? "+" : ""}${(informationCost * 100).toFixed(1)} pts`
    : "--";

  elements.sensitivitySplitTableBody.innerHTML = sensitivity.splitSeeds.map((entry) => `
    <tr>
      <td>${entry.seed}</td><td>${entry.testCount}</td><td>${formatMaybe(entry.mae, 2, " °F")}</td>
      <td>${formatMaybe(entry.rmse, 2, " °F")}</td><td>${formatMaybe(entry.bias, 2, " °F")}</td>
      <td>${Number.isFinite(entry.coverage95) ? formatPercent(entry.coverage95) : "--"}</td><td>${entry.lumosRank ?? "--"}</td>
    </tr>
  `).join("");
  elements.sensitivityCovarianceTableBody.innerHTML = sensitivity.covariance.map((entry, index) => `
    <tr class="${index === 0 ? "best-row" : ""}">
      <td>${entry.lengthScaleMultiplier.toFixed(2)}x</td><td>${entry.measurementNoise.toFixed(3)}</td>
      <td>${formatMaybe(entry.rmse, 2, " °F")}</td><td>${Number.isFinite(entry.coverage95) ? formatPercent(entry.coverage95) : "--"}</td>
      <td>${formatMaybe(entry.intervalWidth95, 2, " °F")}</td>
    </tr>
  `).join("");
  elements.sensitivityHostTableBody.innerHTML = sensitivity.hostStress.map((entry) => `
    <tr>
      <td>${entry.label}</td><td>${entry.candidateCount}</td><td>${entry.monitorCount}</td>
      <td>${Number.isFinite(entry.information) ? formatPercent(entry.information) : "--"}</td>
      <td>${Number.isFinite(entry.minimumGroupInformation) ? formatPercent(entry.minimumGroupInformation) : "--"}</td>
      <td>${Number.isFinite(entry.fairnessGap) ? formatPercent(entry.fairnessGap) : "--"}</td>
      <td>${entry.feasible ? "Yes" : "No"}</td>
    </tr>
  `).join("");
  elements.sensitivityFairnessTableBody.innerHTML = sensitivity.fairness.map((entry) => `
    <tr>
      <td>${formatPercent(entry.fairnessLimit)}</td><td>${entry.monitorCount}</td>
      <td>${Number.isFinite(entry.information) ? formatPercent(entry.information) : "--"}</td>
      <td>${Number.isFinite(entry.minimumGroupInformation) ? formatPercent(entry.minimumGroupInformation) : "--"}</td>
      <td>${Number.isFinite(entry.fairnessGap) ? formatPercent(entry.fairnessGap) : "--"}</td>
      <td>${formatMaybe(entry.totalCost, 2)}</td><td>${entry.feasible ? "Yes" : "No"}</td>
    </tr>
  `).join("");
}

function buildExperimentPackage() {
  if (!state.scenario || state.domainKey !== "heat" || state.scenario.scenarioType !== "live-city") return null;
  state.experimentPackage = createHeatExperimentPackage({
    scenario: state.scenario,
    calibration: state.heatCalibration,
    lockedExperiment: state.heatExperiment,
    configuration: {
      heatScenario: state.heatScenario,
      monitorCount: Number(elements.monitorCount.value),
      budget: Number(elements.budgetLimit.value),
      fairnessLimit: Number(elements.fairnessLimit.value),
      minimumGroupInformation: Number(elements.minimumGroupInformation.value),
      minimumReliability: Number(elements.minimumReliability.value)
    }
  });
  return state.experimentPackage;
}

function renderExperimentManifest() {
  const isLiveHeat = state.domainKey === "heat" && state.scenario?.scenarioType === "live-city";
  elements.experimentManifestSection.hidden = !isLiveHeat;
  elements.exportExperimentButton.hidden = !isLiveHeat;
  if (!isLiveHeat) return;
  const experiment = buildExperimentPackage();
  elements.experimentId.textContent = experiment?.experimentId ?? "Experiment unavailable.";
  elements.experimentChecksum.textContent = experiment?.checksum ?? "--";
  elements.experimentDevelopmentCount.textContent = String(state.heatExperiment?.split?.development?.length ?? 0);
  elements.experimentTestCount.textContent = String(state.heatExperiment?.split?.test?.length ?? 0);
}

function renderInterventionResult() {
  const result = state.interventionResult;
  const isAir = state.domainKey === "air";
  const isWater = state.domainKey === "water";
  elements.heatInterventionSection.hidden = !result;
  if (!result) {
    elements.interventionStatus.textContent = "No intervention design yet.";
    elements.interventionPower.textContent = "--";
    elements.interventionEffect.textContent = "--";
    elements.interventionMatch.textContent = "--";
    elements.interventionCost.textContent = "--";
    elements.interventionRoleTableBody.innerHTML = '<tr><td colspan="3" class="empty-cell">No intervention design yet</td></tr>';
    return;
  }
  const purposes = isAir ? {
    treatment: "Measure locations expected to respond to the source-control intervention",
    control: "Track matched locations with low modeled intervention exposure",
    boundary: "Detect effect decay and transport across the intervention boundary",
    spillover: "Check displacement or downwind effects outside the treatment area",
    supplemental: "Fill remaining information and social-coverage gaps"
  } : isWater ? {
    treatment: "Measure locations expected to respond to the water-quality intervention",
    control: "Track matched locations with low modeled intervention exposure",
    upstream: "Provide upstream sentinels for background and source separation",
    downstream: "Measure downstream receptors and possible transported effects",
    supplemental: "Fill remaining information, branch, and social-coverage gaps"
  } : {
    treatment: "Measure expected cooling or remediation inside the planned action area",
    control: "Track comparable areas with little modeled intervention benefit",
    boundary: "Detect effect decay and treatment-boundary changes",
    spillover: "Check displacement or benefits just outside treatment areas",
    supplemental: "Fill remaining information and social-coverage gaps"
  };
  const effect = Number.isFinite(result.expectedEffect) ? result.expectedEffect : result.expectedEffectF;
  const effectUnits = result.effectUnits ?? "°F";
  elements.interventionStatus.textContent = `${result.designType} · ${result.selected.length} sites · ${result.repeatedMeasurements} repeated measurements assumed per site`;
  elements.interventionPower.textContent = formatPercent(result.approximatePower);
  elements.interventionEffect.textContent = Number.isFinite(effect) ? `${effect.toFixed(2)} ${effectUnits}` : "--";
  elements.interventionMatch.textContent = formatPercent(result.controlMatch);
  elements.interventionCost.textContent = result.totalCost.toFixed(2);
  elements.interventionRoleTableBody.innerHTML = Object.entries(result.roleCounts).map(([role, count]) => `
    <tr><td>${role[0].toUpperCase()}${role.slice(1)}</td><td>${count}</td><td>${purposes[role] ?? purposes.supplemental}</td></tr>
  `).join("");
}

function inferAndValidateHeatScenario(scenario) {
  const lockedSplit = createLockedHeatSplit(scenario.observations ?? [], { seed: scenario.seed });
  const developmentObservations = lockedSplit.available ? lockedSplit.development : scenario.observations;
  const calibration = calibrateHeatModel({ ...scenario, observations: developmentObservations }, DOMAINS.heat);
  state.heatCalibration = calibration;
  state.heatExperiment = runLockedHeatExperiment({
    observations: scenario.observations ?? [],
    domain: DOMAINS.heat,
    settings: calibration.settings,
    splitOptions: { seed: scenario.seed }
  });
  attachHeatInference(scenario, DOMAINS.heat, calibration.settings);
  scenario.validation = {
    development: calibration.validation,
    locked: state.heatExperiment
  };
  elements.influenceScale.value = calibration.settings.lengthScaleMultiplier;
  elements.influenceScaleValue.value = `${calibration.settings.lengthScaleMultiplier.toFixed(2)}x`;
  elements.measurementNoise.value = calibration.settings.measurementNoise;
  elements.measurementNoiseValue.value = calibration.settings.measurementNoise.toFixed(3);
  buildExperimentPackage();
  return scenario;
}

function renderQuickStart() {
  const isHeat = state.domainKey === "heat";
  const isAir = state.domainKey === "air";
  const isSoil = state.domainKey === "soil";
  const isWater = state.domainKey === "water";
  const visible = isHeat || isAir || isSoil || isWater;
  elements.quickStartCard.hidden = !visible;
  elements.heatPresetGrid.hidden = !isHeat;
  elements.airPresetGrid.hidden = !isAir;
  elements.soilPresetGrid.hidden = !isSoil;
  elements.waterPresetGrid.hidden = !isWater;
  elements.quickStartDescription.textContent = isAir
    ? "Each preset selects a pollutant, opens a controlled local extent, and runs the same nationwide Air workflow used for a manual fit."
    : isSoil
      ? "Each preset selects a survey-supported property and depth, opens a local extent, and runs the same nationwide Soil workflow used for a manual fit."
      : isWater
        ? "Each preset selects a Water indicator and local hydrologic extent, then runs the same public screening workflow used for a manual fit."
        : "Each preset opens a controlled local extent and runs the same nationwide Heat workflow used for a manual fit.";
}

function renderDataProvenance() {
  const metadata = state.scenario?.sourceMetadata;
  const isHeat = state.domainKey === "heat";
  const isAir = state.domainKey === "air";
  const isSoil = state.domainKey === "soil";
  const isWater = state.domainKey === "water";
  const isEnvironmental = isHeat || isAir || isSoil || isWater;
  const isNyc = isHeat && state.scenario?.scenarioType === "live-city";
  const isNationalHeat = isHeat && state.scenario?.scenarioType === "live-national";
  const isNationalAir = isAir && state.scenario?.scenarioType === "live-national-air";
  const isNationalSoil = isSoil && state.scenario?.scenarioType === "live-national-soil";
  const isNationalWater = isWater && state.scenario?.scenarioType === "live-national-water";
  const isNational = isNationalHeat || isNationalAir || isNationalSoil || isNationalWater;

  elements.dataSourceSection.hidden = !isEnvironmental;
  elements.workspaceSectionKicker.textContent = isAir ? "Air workspace" : isSoil ? "Soil workspace" : isWater ? "Water workspace" : "Heat workspace";
  elements.workspaceSectionTitle.textContent = isAir ? "Pollutant, coverage, and data source" : isSoil ? "Property, depth, and data source" : isWater ? "System, indicator, and data source" : "Coverage and data source";
  renderQuickStart();
  if (elements.citySelector.previousElementSibling) elements.citySelector.previousElementSibling.hidden = isAir || isSoil || isWater;
  elements.citySelector.hidden = isAir || isSoil || isWater;
  elements.heatExperienceControls.hidden = !isHeat;
  elements.liveConditionControls.hidden = !isHeat || state.heatExperience !== "live";
  elements.forecastPlaybackControls.hidden = !isHeat || state.heatExperience !== "forecast";
  elements.airWorkspaceControls.hidden = !isAir;
  elements.soilWorkspaceControls.hidden = !isSoil;
  elements.waterWorkspaceControls.hidden = !isWater;
  elements.waterIndicator.value = state.waterIndicator;
  elements.waterSystemType.value = state.waterSystemType;
  elements.waterDataStatus.textContent = isWater
    ? (state.scenario?.model?.waterObservationStatus ?? "Fit a U.S. area to load water observations and hydrologic features.")
    : "";
  elements.soilProperty.value = state.soilProperty;
  elements.soilDepth.value = state.soilDepth;
  elements.soilDataStatus.textContent = isSoil
    ? (state.scenario?.model?.soilDataStatus ?? "Fit a U.S. area to load soil survey properties.")
    : "";
  elements.airPollutant.value = state.airPollutant;
  elements.openAqApiKey.value = state.openAqApiKey;
  elements.airMonitorStatus.textContent = isAir
    ? (state.scenario?.model?.referenceMonitorStatus ?? (state.openAqApiKey ? "Reference monitors will load when the area is fitted." : "No external reference-monitor key supplied."))
    : "";
  const standardPaletteOption = elements.colorPalette?.querySelector('option[value="standard"]');
  if (standardPaletteOption) standardPaletteOption.textContent = isAir ? "Standard air-quality spectrum" : isSoil ? "Standard soil spectrum" : isWater ? "Standard water-quality spectrum" : "Standard heat spectrum";

  elements.paperExperimentControls.hidden = !isHeat;
  if (isHeat && state.scenario) initializeLiveFields(state.scenario);
  if (isHeat) renderHeatExperience();
  else {
    stopLiveRefreshTimers();
    stopForecastPlayback();
    map.setLiveAnimation(false);
  }
  renderPaperExperiment();
  elements.workspacePersistenceControls.hidden = !isEnvironmental;
  elements.saveWorkspaceButton.disabled = !state.scenario;
  elements.exportWorkspaceButton.disabled = !state.scenario;
  elements.citySelector.value = state.heatWorkspace;
  elements.dataMode.value = state.dataMode;
  elements.heatScenarioRow.hidden = !isHeat || state.heatWorkspace !== "nyc" || state.dataMode !== "live";
  elements.nationalCandidateControls.hidden = !(isEnvironmental && (isAir || isSoil || isWater || state.heatWorkspace === "national") && state.dataMode === "live");
  elements.candidateStrategy.value = state.candidateStrategy;
  renderViewportWorkloadEstimate();
  elements.recalibrateHeatButton.hidden = !isNyc;
  elements.exportExperimentButton.hidden = !isNyc;
  elements.runSensitivityButton.hidden = !isNyc;
  elements.exportPaperTablesButton.hidden = !isNyc;
  elements.exportNationalCaseStudyButton.hidden = !isNationalHeat;
  elements.exportNationalCaseStudyButton.disabled = !isNationalHeat || !state.result;
  elements.fitScenarioButton.disabled = !(isEnvironmental && state.dataMode === "live" && (isAir || isSoil || isWater || state.heatWorkspace === "national"));
  elements.modelExtentButton.disabled = !state.scenario;
  renderPlanningStage();
  renderMapLayerOptions();

  if (!isEnvironmental) {
    renderHeatValidation();
    renderAirValidation();
    renderSoilValidation();
    renderSoilSensitivity();
    renderSoilEvidence();
    renderWaterValidation();
    renderWaterSensitivity();
    renderWaterEvidence();
    renderAirSensitivity();
    renderAirEvidence();
    renderHeatSensitivity();
    renderExperimentManifest();
    renderInterventionResult();
    void renderWorkspaceDiagnostics();
    return;
  }

  if (!state.scenario) {
    const domainLabel = isAir ? "Air" : isSoil ? "Soil" : isWater ? "Water" : "Heat";
    elements.dataSourceStatus.textContent = `No national ${domainLabel} area fitted yet`;
    elements.dataSourceStatus.className = "data-source-status";
    elements.dataSourceList.innerHTML = `<li><strong>Nationwide ${domainLabel} workspace</strong><small>Search or zoom to a U.S. area, then click Fit current area.</small></li>`;
    elements.layerProvenanceList.innerHTML = "<li><strong>No active layers</strong><small>Layer-level source, resolution, confidence, and interpretation appear after fitting.</small></li>";
    elements.dataLimitations.innerHTML = "<li>A full model is built only after a local viewport is fitted.</li>";
    if (elements.nationalModelStatus) elements.nationalModelStatus.innerHTML = `<strong>Environmental model</strong><span>Fit an area to load ${isAir ? "pollutant, wind, source, and social" : isSoil ? "soil survey, depth, social, and sampling" : isWater ? "USGS observations, flow, source, ecological, and social" : "weather, land cover, and social"} layers.</span>`;
    renderHeatValidation();
    renderAirValidation();
    renderSoilValidation();
    renderSoilSensitivity();
    renderSoilEvidence();
    renderWaterValidation();
    renderWaterSensitivity();
    renderWaterEvidence();
    renderAirSensitivity();
    renderAirEvidence();
    renderHeatSensitivity();
    renderExperimentManifest();
    renderInterventionResult();
    void renderWorkspaceDiagnostics();
    return;
  }

  const live = metadata?.live === true;
  elements.dataSourceStatus.textContent = live
    ? `${isNational ? `Live national ${isAir ? "Air" : isSoil ? "Soil" : isWater ? "Water" : "Heat"} model` : "Live official data"} · ${state.scenario.cityLabel}`
    : `Fallback mode · ${state.scenario.cityLabel}`;
  elements.dataSourceStatus.className = `data-source-status ${live ? "live" : "fallback"}`;
  elements.dataSourceList.innerHTML = metadata?.sources?.length
    ? metadata.sources.map((source) => `<li><strong>${source.label}</strong><span>${source.agency}</span><small>${source.role}</small></li>`).join("")
    : "<li><strong>Controlled synthetic scenario</strong><small>No external dataset was loaded for this run.</small></li>";
  elements.layerProvenanceList.innerHTML = metadata?.layers?.length
    ? metadata.layers.map((layer) => `<li><strong>${layer.label}</strong><span>${layer.source}</span><small>${layer.status} · ${layer.resolution}</small><small class="layer-confidence">${layer.confidence} confidence</small><small>${layer.interpretation}</small></li>`).join("")
    : "<li><strong>Layer provenance unavailable</strong><small>No layer-level provenance was reported for this scenario.</small></li>";
  elements.dataLimitations.innerHTML = metadata?.limitations?.length
    ? metadata.limitations.map((limitation) => `<li>${limitation}</li>`).join("")
    : "<li>No data limitations were reported.</li>";
  if (elements.nationalModelStatus && isNational) {
    if (isAir) {
      const validation = state.scenario.model?.airValidation;
      const validationLabel = validation?.available
        ? `locked RMSE ${validation.locked.lumos.rmse.toFixed(2)} ${state.scenario.model?.pollutantUnit ?? "µg/m³"}`
        : `${state.scenario.model?.referenceMeasurementCount ?? 0} compatible readings`;
      elements.nationalModelStatus.innerHTML = `<strong>Air model</strong><span>${state.scenario.model?.pollutantLabel ?? "Pollutant"} · source features: ${state.scenario.model?.airSourceStatus ?? "unknown"} · reference data: ${state.scenario.model?.referenceMonitorStatus ?? "not requested"} · ${validationLabel} · ${state.scenario.groups?.length ?? 0} social-information groups.</span>`;
    } else if (isSoil) {
      const soilValidation = state.scenario.model?.soilValidation;
      const labCount = state.scenario.model?.soilInference?.observationsUsed ?? state.scenario.model?.labSampleCount ?? 0;
      const labLabel = labCount
        ? `${labCount} compatible laboratory samples${soilValidation?.available ? ` · locked RMSE ${soilValidation.locked.lumos.rmse.toFixed(2)} ${state.scenario.model?.soilInference?.unit ?? ""}` : ""}`
        : "survey/proxy screening prior only";
      elements.nationalModelStatus.innerHTML = `<strong>Soil model</strong><span>${state.scenario.model?.propertyLabel ?? "Soil property"} · ${state.scenario.model?.depthLabel ?? "selected depth"} · USDA coverage ${(100 * (state.scenario.model?.soilCoverageRate ?? 0)).toFixed(0)}% · ${labLabel} · social data ${state.scenario.model?.censusStatus ?? "unknown"} · ${state.scenario.groups?.length ?? 0} information groups.</span>`;
    } else if (isWater) {
      const waterValidation = state.scenario.model?.waterValidation;
      const waterInference = state.scenario.model?.waterInference;
      const inferenceLabel = waterInference
        ? `${waterInference.observationsUsed} conditioned observations${waterValidation?.available ? ` · locked RMSE ${waterValidation.locked.lumos.rmse.toFixed(2)} ${state.scenario.model?.indicatorUnit ?? ""}` : ""}`
        : "screening prior only";
      elements.nationalModelStatus.innerHTML = `<strong>Water model</strong><span>${state.scenario.model?.systemLabel ?? "Water system"} · ${state.scenario.model?.indicatorLabel ?? "Indicator"} · ${inferenceLabel} · hydrologic features: ${state.scenario.model?.waterFeatureStatus ?? "unknown"} · flow structure: ${state.scenario.model?.flowDirectionConfidence ?? "proxy"} · ${state.scenario.groups?.length ?? 0} social-information groups.</span>`;
    } else {
      const landCover = state.scenario.model?.landCoverStatus ?? "unknown";
      const census = state.scenario.model?.censusStatus ?? "unknown";
      elements.nationalModelStatus.innerHTML = `<strong>Environmental model</strong><span>Weather: loaded · Land cover: ${landCover} · Social data: ${census} · ${state.scenario.groups?.length ?? 0} intersectional information groups.</span>`;
    }
  }
  renderHeatValidation();
  renderAirValidation();
  renderSoilValidation();
  renderSoilSensitivity();
  renderSoilEvidence();
  renderWaterValidation();
  renderWaterSensitivity();
  renderWaterEvidence();
  renderAirSensitivity();
  renderAirEvidence();
  renderHeatSensitivity();
  renderExperimentManifest();
  renderInterventionResult();
  void renderWorkspaceDiagnostics();
}

async function loadScenario() {
  const scenarioStartedAt = performance.now();
  clearViewportHeat({ message: null, preserveScenario: true });
  showLoading({
    title: ["heat", "air", "soil", "water"].includes(state.domainKey) && state.dataMode === "live" ? `Loading ${state.domainKey === "air" ? "Air" : state.domainKey === "soil" ? "Soil" : state.domainKey === "water" ? "Water" : "Heat"} workspace` : "Generating validation scenario",
    message: "Preparing the active domain and spatial inputs...",
    stage: "Initializing",
    progress: 5
  });
  const token = ++state.loadingToken;
  elements.optimizeButton.disabled = true;
  elements.newScenarioButton.disabled = true;
  resetResults();
  state.interventionResult = null;
  state.performanceDiagnostics.optimizationRuntimeMs = null;
  state.performanceDiagnostics.hostRuntimeMs = null;
  state.experimentPackage = null;
  state.heatSensitivity = null;
  state.forecast = null;
  state.forecastFrameIndex = 0;
  state.paperExperiment = null;
  stopForecastPlayback();
  stopLiveRefreshTimers();
  renderPaperExperiment();

  if (state.domainKey === "core") {
    state.scenario = null;
    state.heatCalibration = null;
    state.heatExperiment = null;
    map.setScenario(null, { fit: false });
    map.showUnitedStates();
    renderDataProvenance();
    renderPlanningStage();
    elements.runStatus.textContent = "Unified planning workspace ready · full United States view";
    elements.optimizeButton.disabled = false;
    elements.newScenarioButton.disabled = false;
    elements.modelExtentButton.disabled = true;
    hideLoading();
    return;
  }

  const waitingForNationalFit = state.dataMode === "live" && (
    state.domainKey === "air" || state.domainKey === "soil" || state.domainKey === "water" || (state.domainKey === "heat" && state.heatWorkspace === "national")
  );

  if (waitingForNationalFit) {
    state.scenario = null;
    state.heatCalibration = null;
    state.heatExperiment = null;
    map.setScenario(null, { fit: false });
    renderDataProvenance();
    renderPlanningStage();
    updateViewportHeatButton();
    const domainLabel = state.domainKey === "air" ? "Air" : state.domainKey === "soil" ? "Soil" : state.domainKey === "water" ? "Water" : "Heat";
    elements.runStatus.textContent = `Nationwide ${domainLabel} workspace ready · search or zoom to any U.S. area, then click Fit current area`;
    elements.dataSourceStatus.textContent = `No national ${domainLabel} area fitted yet`;
    elements.dataSourceStatus.className = "data-source-status";
    elements.optimizeButton.disabled = true;
    elements.newScenarioButton.disabled = false;
    elements.modelExtentButton.disabled = true;
    if (map.baseMap && map.baseMap.getZoom() < 5) map.showUnitedStates();
    hideLoading();
    return;
  }

  elements.runStatus.textContent = state.domainKey === "heat" && state.dataMode === "live"
    ? "Connecting to NYC Open Data..."
    : "Generating controlled validation scenario...";

  let scenario = await loadScenarioData({
    domainKey: state.domainKey,
    seed: state.seed,
    dataMode: state.dataMode,
    heatScenario: state.heatScenario,
    onProgress: (message) => {
      if (token === state.loadingToken) {
        elements.runStatus.textContent = message;
        updateLoading({ message, stage: message, progress: loadingProgressFromMessage(message) });
      }
    }
  });
  if (token !== state.loadingToken) return;

  if (state.domainKey === "heat" && scenario.scenarioType === "live-city") {
    elements.runStatus.textContent = "Calibrating covariance and running spatial holdout validation...";
    updateLoading({
      message: "Calibrating covariance and evaluating held-out sensors...",
      stage: "Inference and validation",
      progress: 82
    });
    scenario = inferAndValidateHeatScenario(scenario);
  } else {
    state.heatCalibration = null;
    state.heatExperiment = null;
    state.experimentPackage = null;
    state.heatSensitivity = null;
  }

  state.scenario = scenario;
  if (state.domainKey === "heat") initializeLiveFields(state.scenario);
  if (state.domainKey === "heat") state.performanceDiagnostics.fitRuntimeMs = performance.now() - scenarioStartedAt;
  map.setScenario(state.scenario);
  if (state.domainKey === "core" && state.spatialDeployment) renderSpatialDeploymentResult();
  if (state.domainKey === "core" && state.fieldCampaign) renderFieldCampaignResult();
  if (state.domainKey === "core") renderCampaignTrackingResult();
  if (state.domainKey === "core") renderCommissioningResult();
  renderDataProvenance();
  const sourceLabel = scenario.scenarioType === "live-city"
    ? "official NYC data"
    : scenario.scenarioType.replaceAll("-", " ");
  const validationLabel = state.heatExperiment?.lumos
    ? ` · locked MAE ${state.heatExperiment.lumos.metrics.mae.toFixed(2)} °F`
    : state.heatCalibration?.validation?.available
      ? ` · development CV MAE ${state.heatCalibration.validation.model.mae.toFixed(2)} °F`
      : "";
  elements.runStatus.textContent = `${scenario.cityLabel} · ${sourceLabel} · ${scenario.cells.length.toLocaleString()} evaluation points · ${scenario.candidates.length} candidates · ${scenario.observations.length} conditioned observations${validationLabel}`;
  elements.optimizeButton.disabled = state.domainKey === "heat" && state.heatExperience !== "risk";
  elements.newScenarioButton.disabled = false;
  elements.modelExtentButton.disabled = false;
  renderPlanningStage();
  scheduleWorkspaceAutosave();
  void renderWorkspaceDiagnostics();
  updateLoading({ message: "Workspace ready.", stage: "Complete", progress: 100 });
  window.setTimeout(hideLoading, 180);
}

function applyDomain(domainKey) {
  showWorkspaceView();
  clearViewportHeat({ message: null, preserveScenario: true });
  if (domainKey !== "heat") {
    stopLiveRefreshTimers();
    stopForecastPlayback();
    map.setLiveAnimation(false);
  }
  if (state.airEvidenceController) {
    state.airEvidenceController.abort();
    state.airEvidenceController = null;
  }
  if (state.soilEvidenceController) {
    state.soilEvidenceController.abort();
    state.soilEvidenceController = null;
  }
  if (state.waterEvidenceController) {
    state.waterEvidenceController.abort();
    state.waterEvidenceController = null;
  }
  state.domainKey = domainKey;
  state.airValidation = null;
  state.airSensitivity = null;
  state.soilSensitivity = null;
  state.waterSensitivity = null;
  state.soilImportQa = domainKey === "soil" ? state.soilImportQa : null;
  state.releaseHealth = null;
  document.body.dataset.domain = domainKey;
  state.layer = "risk";
  map.setDomainKey(domainKey);
  map.setLayer("risk");
  const domain = DOMAINS[domainKey];
  const registry = DOMAIN_REGISTRY[domainKey];
  state.weights = { ...domain.weights };
  elements.domainTitle.textContent = registry?.title ?? domain.label;
  elements.domainStatus.textContent = registry?.status ?? domain.status;
  elements.domainDescription.textContent = registry?.description ?? domain.description;
  const isEnvironmental = isPublicDomain(domainKey);
  elements.dataSourceSection.hidden = !isEnvironmental;
  renderQuickStart();
  elements.heatScenarioRow.hidden = domainKey !== "heat" || state.heatWorkspace !== "nyc" || state.dataMode !== "live";
  elements.planningStageSection.hidden = !isEnvironmental;
  elements.heatInterventionControls.hidden = true;
  elements.airInterventionControls.hidden = true;
  elements.soilInterventionControls.hidden = true;
  elements.waterInterventionControls.hidden = true;
  elements.heatSensitivitySection.hidden = true;
  elements.experimentManifestSection.hidden = true;
  elements.fitScenarioButton.disabled = !isEnvironmental || state.dataMode !== "live" || (domainKey === "heat" && state.heatWorkspace !== "national");
  document.querySelectorAll(".domain-tab").forEach((button) => button.classList.toggle("active", button.dataset.domain === domainKey));
  renderWeights();
  renderPlanningStage();
  renderMapLayerOptions();
  renderSoilEvidence();
  renderWaterEvidence();
  renderAirEvidence();
  renderUnifiedDomainMatrix();
  renderCrossDomainAudit();
  renderCrossDomainBudgetResult();
  renderSequentialEvidence();
  renderSequentialReallocationResult();
  renderAdaptiveProgramSimulationResult();
  renderRobustPolicyResult();
  renderSpatialDeploymentResult();
  renderFieldCampaignResult();
  renderCampaignTrackingResult();
  renderCommissioningResult();
  const isUnified = domainKey === "core";
  elements.standardResultsSummary.hidden = isUnified;
  elements.standardPortfolioSection.hidden = isUnified;
  elements.standardMetricGrid.hidden = isUnified;
  elements.optimizeButton.textContent = isUnified ? "Allocate budget" : "Generate portfolio";
  elements.newScenarioButton.hidden = false;
  loadScenario();
}

function renderPortfolio(result) {
  elements.solutionPortfolio.disabled = false;
  elements.solutionPortfolio.innerHTML = result.solutions.map((solution) => {
    const labels = [solution.profile.shortLabel];
    if (solution.paretoOptimal) labels.push("Pareto");
    labels.push(solution.constraintStatus.feasible ? "feasible" : "nearest infeasible");
    return `<option value="${solution.profileKey}">${labels.join(" · ")}</option>`;
  }).join("");
  elements.solutionPortfolio.value = state.activeProfile;
}

function renderActiveSolution() {
  if (!state.result) return;
  const solution = state.result.solutions.find((item) => item.profileKey === state.activeProfile)
    ?? state.result.solutions[0];
  state.activeProfile = solution.profileKey;
  map.setResult(solution);
  renderPortfolio(state.result);

  const metrics = solution.metrics;
  const status = solution.constraintStatus;
  elements.resultHeading.textContent = `${solution.profile.label}: ${solution.selected.length} monitors`;
  elements.resultSummary.textContent = `${solution.profile.description} ${solution.paretoOptimal ? "This network is nondominated within the generated portfolio." : "Another generated network weakly improves its measured tradeoff vector."}`;
  elements.solutionPortfolio.value = solution.profileKey;
  elements.preferredProfile.value = solution.profileKey;
  elements.portfolioSelectionMeta.textContent = `${solution.constraintStatus.feasible ? "Feasible" : "Nearest tested infeasible network"} · ${solution.paretoOptimal ? "nondominated" : "dominated"} · ${formatPercent(solution.metrics.information)} information · ${solution.metrics.totalCost.toFixed(1)} cost.`;
  if (elements.exportNationalCaseStudyButton) elements.exportNationalCaseStudyButton.disabled = !isNationalScenarioType(state.domainKey, state.scenario?.scenarioType);
  elements.metricObjective.textContent = metrics.score.toFixed(3);
  elements.metricInformation.textContent = formatPercent(metrics.information);
  elements.metricExposure.textContent = formatPercent(metrics.exposure);
  elements.metricFairness.textContent = formatPercent(metrics.fairnessGap);
  elements.metricGroupInformation.textContent = formatPercent(metrics.minimumGroupInformation);
  elements.metricRedundancy.textContent = formatPercent(metrics.redundancy);
  elements.metricReliability.textContent = formatPercent(metrics.reliability);
  elements.metricCost.textContent = metrics.totalCost.toFixed(2);

  elements.constraintHeading.textContent = status.feasible
    ? "All hard requirements satisfied"
    : "No fully feasible network found in this search";
  elements.constraintHeading.className = status.feasible ? "constraint-pass" : "constraint-fail";
  elements.constraintList.innerHTML = status.checks.map((check) => `
    <li class="${check.satisfied ? "pass" : "fail"}">
      <span>${check.satisfied ? "✓" : "!"} ${check.label}</span>
      <strong>${formatConstraintValue(check)}</strong>
    </li>
  `).join("");

  elements.baselineTableBody.innerHTML = solution.baselines.map((baseline) => `
    <tr class="${baseline.name === "LUMOS" ? "best-row" : ""}" title="${baseline.criterion ?? "Benchmark strategy"}">
      <td>${baseline.name}</td>
      <td>${baseline.metrics.score.toFixed(3)}</td>
      <td>${formatPercent(baseline.metrics.information)}</td>
      <td>${formatPercent(baseline.metrics.fairnessGap)}</td>
      <td>${baseline.metrics.totalCost.toFixed(1)}</td>
      <td>${formatRuntime(baseline.runtimeMs)}</td>
      <td>${baseline.constraintStatus.feasible ? "Yes" : "No"}</td>
    </tr>
  `).join("");

  const exact = state.result.exactBenchmark;
  if (exact?.oracle) {
    elements.exactBenchmarkHeading.textContent = `${exact.selectionCount}-monitor exact reduced-pool oracle`;
    elements.exactBenchmarkSummary.textContent = `Enumerated ${exact.enumerated.toLocaleString()} feasible combinations from a deterministic ${exact.poolSize}-site pool. Gaps use the balanced LUMOS objective and are exact only within this reduced test instance.`;
    const rows = [exact.oracle, ...exact.methods];
    elements.exactTableBody.innerHTML = rows.map((method) => `
      <tr class="${method.name.startsWith("Exact") ? "best-row" : ""}">
        <td>${method.name}</td>
        <td>${method.metrics.score.toFixed(3)}</td>
        <td>${method.optimalityGap.toFixed(3)}</td>
        <td>${formatPercent(method.metrics.information)}</td>
        <td>${formatRuntime(method.runtimeMs)}</td>
        <td>${method.constraintStatus.feasible ? "Yes" : "No"}</td>
      </tr>
    `).join("");
  } else {
    elements.exactBenchmarkHeading.textContent = "Exact oracle unavailable";
    elements.exactBenchmarkSummary.textContent = "No feasible reduced-pool combination was available under the active siting rules and budget.";
    elements.exactTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No feasible exact instance</td></tr>';
  }

  elements.explanationList.innerHTML = solution.explanations.slice(0, 8).map((entry, index) => (
    `<li><strong>Monitor ${index + 1}:</strong> ${entry.text || "balanced marginal improvement across objectives"}.</li>`
  )).join("") || "<li>No feasible monitor could be added within the active budget and siting rules.</li>";
  renderAirSensitivity();
}

function runOptimization() {
  if (!state.scenario) return;
  showLoading({
    title: "Generating decision portfolio",
    message: "Running the full Bayesian, social, Pareto, and benchmark model...",
    stage: "Preparing candidate networks",
    progress: 8
  });
  state.interventionResult = null;
  renderInterventionResult();
  elements.optimizeButton.disabled = true;
  elements.runStatus.textContent = "Generating portfolio and scientific benchmarks...";
  requestAnimationFrame(() => {
    const optimizationStartedAt = performance.now();
    updateLoading({ stage: "Optimizing five portfolio alternatives", progress: 30 });
    const domain = ["air", "water"].includes(state.domainKey) && Number.isFinite(state.scenario?.model?.transportAngle)
      ? { ...DOMAINS[state.domainKey], transportAngle: state.scenario.model.transportAngle }
      : DOMAINS[state.domainKey];
    const context = {
      cells: state.scenario.cells,
      candidates: state.scenario.candidates,
      domain,
      weights: state.weights,
      observations: state.scenario.observations,
      fairnessConstraint: elements.fairnessConstraint.checked,
      fairnessLimit: Number(elements.fairnessLimit.value),
      constraints: {
        enforceSocialConstraints: elements.fairnessConstraint.checked,
        fairnessLimit: Number(elements.fairnessLimit.value),
        minimumGroupInformation: Number(elements.minimumGroupInformation.value),
        minimumReliability: Number(elements.minimumReliability.value),
        budget: Number(elements.budgetLimit.value)
      },
      modelSettings: {
        measurementNoise: Number(elements.measurementNoise.value),
        lengthScaleMultiplier: Number(elements.influenceScale.value),
        transportAngle: state.scenario.model?.transportAngle
      },
      seed: state.seed
    };
    state.activeProfile = elements.preferredProfile.value;
    state.result = optimizeNetwork(context, Number(elements.monitorCount.value), {
      minimumSeparation: elements.minimumSeparation.checked,
      preferredProfile: state.activeProfile,
      beamWidth: 4
    });
    updateLoading({ stage: "Rendering metrics and scientific comparisons", progress: 88 });
    renderActiveSolution();
    const feasibleCount = state.result.solutions.filter((solution) => solution.constraintStatus.feasible).length;
    const exactCount = state.result.exactBenchmark?.enumerated ?? 0;
    elements.runStatus.textContent = `Portfolio complete · ${state.result.paretoSolutions.length} nondominated · ${feasibleCount}/${state.result.solutions.length} feasible · ${exactCount.toLocaleString()} exact subsets`;
    state.performanceDiagnostics.optimizationRuntimeMs = performance.now() - optimizationStartedAt;
    scheduleWorkspaceAutosave();
    void renderWorkspaceDiagnostics();
    elements.optimizeButton.disabled = false;
    updateLoading({ stage: "Complete", message: "Decision portfolio ready.", progress: 100 });
    window.setTimeout(hideLoading, 180);
  });
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename, url) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function exportPaperExperiment() {
  if (!state.paperExperiment) return;
  const stem = `lumos-heat-paper-${state.paperExperiment.checksum.slice(0, 12)}`;
  const rows = paperSuiteRows(state.paperExperiment);
  downloadJson(`${stem}.json`, state.paperExperiment);
  window.setTimeout(() => downloadText(`${stem}.csv`, rowsToPaperSuiteCsv(rows), "text/csv;charset=utf-8"), 120);
}

function exportCurrentMapPng() {
  if (!state.scenario) return;
  const stem = String(state.scenario.cityLabel || "lumos-heat-map")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "lumos-heat-map";
  downloadDataUrl(`${stem}-${state.layer}.png`, map.exportPng({ includeBasemap: true }));
}

function runHeatSensitivity() {
  if (state.domainKey !== "heat" || state.scenario?.scenarioType !== "live-city") return;
  showLoading({
    title: "Running Heat Sensitivity Lab",
    message: "Testing split stability, covariance assumptions, host loss, and fairness thresholds...",
    stage: "Preparing robustness experiments",
    progress: 8
  });
  elements.runSensitivityButton.disabled = true;
  elements.exportPaperTablesButton.disabled = true;
  elements.runStatus.textContent = "Running split, covariance, host-loss, and fairness sensitivity analyses...";
  requestAnimationFrame(() => {
    try {
      updateLoading({ stage: "Running controlled sensitivity analyses", progress: 30 });
      state.heatSensitivity = runHeatSensitivityAnalysis({
        scenario: state.scenario,
        domain: DOMAINS.heat,
        calibrationSettings: state.heatCalibration?.settings ?? {
          lengthScaleMultiplier: Number(elements.influenceScale.value),
          measurementNoise: Number(elements.measurementNoise.value)
        },
        monitorCount: Number(elements.monitorCount.value),
        budget: Number(elements.budgetLimit.value),
        fairnessLimit: Number(elements.fairnessLimit.value),
        minimumGroupInformation: Number(elements.minimumGroupInformation.value),
        minimumReliability: Number(elements.minimumReliability.value),
        enforceSocialConstraints: elements.fairnessConstraint.checked,
        minimumSeparation: elements.minimumSeparation.checked
      });
      updateLoading({ stage: "Building paper-ready tables", progress: 90 });
      renderHeatSensitivity();
      elements.runStatus.textContent = `Sensitivity Lab complete · ${(state.heatSensitivity.runtimeMs / 1000).toFixed(2)} s · paper tables ready`;
    } catch (error) {
      console.error(error);
      state.heatSensitivity = null;
      renderHeatSensitivity();
      elements.sensitivityStatus.textContent = `Sensitivity analysis failed: ${error.message}`;
      elements.runStatus.textContent = "Sensitivity analysis failed. See the browser console for details.";
    } finally {
      elements.runSensitivityButton.disabled = false;
      elements.exportPaperTablesButton.disabled = !state.heatSensitivity;
      updateLoading({ stage: "Complete", message: state.heatSensitivity ? "Sensitivity results ready." : "Sensitivity run ended.", progress: 100 });
      window.setTimeout(hideLoading, 180);
    }
  });
}

function exportHeatPaperTables() {
  if (!state.heatSensitivity) return;
  const rows = buildHeatPaperRows({
    sensitivity: state.heatSensitivity,
    lockedExperiment: state.heatExperiment,
    calibration: state.heatCalibration
  });
  const experiment = buildExperimentPackage();
  const stem = experiment?.experimentId ?? `nyc-heat-${state.scenario?.seed ?? "run"}`;
  downloadText(`${stem}-paper-tables.csv`, rowsToCsv(rows), "text/csv;charset=utf-8");
  window.setTimeout(() => downloadJson(`${stem}-sensitivity.json`, {
    experimentId: experiment?.experimentId ?? null,
    experimentChecksum: experiment?.checksum ?? null,
    sensitivity: state.heatSensitivity,
    rows
  }), 120);
}

function exportNationalCaseStudy() {
  if (state.scenario?.scenarioType !== "live-national" || !state.result) return;
  const controls = {
    activeProfile: state.activeProfile,
    monitorCount: Number(elements.monitorCount.value),
    budget: Number(elements.budgetLimit.value),
    fairnessLimit: Number(elements.fairnessLimit.value),
    minimumGroupInformation: Number(elements.minimumGroupInformation.value),
    minimumReliability: Number(elements.minimumReliability.value),
    candidateStrategy: state.candidateStrategy,
    interventionTarget: elements.evaluationTarget.value
  };
  const packageData = buildNationalCaseStudyPackage({
    scenario: state.scenario,
    result: state.result,
    activeProfile: state.activeProfile,
    controls
  });
  const rows = nationalCaseStudyRows({ scenario: state.scenario, result: state.result, activeProfile: state.activeProfile });
  const stem = String(state.scenario.cityLabel || "national-heat-case-study")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "national-heat-case-study";
  downloadJson(`${stem}-lumos-case-study.json`, packageData);
  window.setTimeout(() => downloadText(`${stem}-lumos-case-study.csv`, rowsToNationalCaseStudyCsv(rows), "text/csv;charset=utf-8"), 120);
  elements.runStatus.textContent = `Exported national Heat case study · ${rows.length} tidy rows`;
}

function designIntervention() {
  const isAir = state.domainKey === "air";
  const isSoil = state.domainKey === "soil";
  const isWater = state.domainKey === "water";
  const usable = isAir
    ? state.scenario?.scenarioType === "live-national-air" && state.scenario?.candidates?.length
    : isSoil
      ? state.scenario?.scenarioType === "live-national-soil" && state.scenario?.candidates?.length
      : isWater
        ? state.scenario?.scenarioType === "live-national-water" && state.scenario?.candidates?.length
        : state.domainKey === "heat" && ["live-city", "live-national"].includes(state.scenario?.scenarioType) && state.scenario?.candidates?.length;
  if (!usable) {
    elements.runStatus.textContent = isAir
      ? "Fit a national Air area before designing the post-intervention network."
      : isSoil
        ? "Fit a national Soil area before designing the post-intervention network."
        : isWater
          ? "Fit a national Water area before designing the post-intervention network."
      : state.heatWorkspace === "national"
        ? "Fit a national Heat area before designing the post-intervention network."
        : "Post-intervention evaluation requires a live Heat scenario.";
    return;
  }
  if (isAir) {
    applyNationalAirIntervention(state.scenario, elements.airEvaluationTarget.value);
  } else if (isSoil) {
    applyNationalSoilIntervention(state.scenario, elements.soilEvaluationTarget.value);
  } else if (isWater) {
    applyNationalWaterIntervention(state.scenario, elements.waterEvaluationTarget.value);
  } else if (state.scenario.scenarioType === "live-national") {
    applyNationalHeatIntervention(state.scenario, elements.evaluationTarget.value);
  }
  map.setScenario(state.scenario, { fit: false });
  renderMapLayerOptions();
  showLoading({
    title: `Designing ${isAir ? "Air" : isSoil ? "Soil" : isWater ? "Water" : "Heat"} post-intervention network`,
    message: isWater ? "Selecting treatment, matched control, upstream sentinel, and downstream receptor sites..." : "Selecting treatment, matched control, boundary, and spillover sites...",
    stage: "Preparing BACI-inspired design",
    progress: 10
  });
  const button = isAir ? elements.designAirInterventionButton : isSoil ? elements.designSoilInterventionButton : isWater ? elements.designWaterInterventionButton : elements.designInterventionButton;
  button.disabled = true;
  elements.runStatus.textContent = "Designing treatment, control, boundary, and spillover monitoring sites...";
  requestAnimationFrame(() => {
    updateLoading({ stage: "Optimizing intervention roles", progress: 42 });
    state.interventionResult = isAir
      ? designAirInterventionNetwork(state.scenario, {
          count: Number(elements.monitorCount.value),
          budget: Number(elements.budgetLimit.value),
          repeatedMeasurements: Number(elements.airRepeatedMeasurements.value),
          residualStd: Number(elements.airResidualStd.value),
          minimumDistance: elements.minimumSeparation.checked ? 0.04 : 0
        })
      : isSoil
        ? designSoilInterventionNetwork(state.scenario, {
            count: Number(elements.monitorCount.value),
            budget: Number(elements.budgetLimit.value),
            repeatedMeasurements: Number(elements.soilRepeatedMeasurements.value),
            residualStd: Number(elements.soilResidualStd.value),
            minimumDistance: elements.minimumSeparation.checked ? 0.035 : 0
          })
        : isWater
          ? designWaterInterventionNetwork(state.scenario, {
              count: Number(elements.monitorCount.value),
              budget: Number(elements.budgetLimit.value),
              repeatedMeasurements: Number(elements.waterRepeatedMeasurements.value),
              residualStd: Number(elements.waterResidualStd.value),
              minimumDistance: elements.minimumSeparation.checked ? 0.04 : 0
            })
      : designHeatInterventionNetwork(state.scenario, {
          count: Number(elements.monitorCount.value),
          budget: Number(elements.budgetLimit.value),
          repeatedMeasurements: Number(elements.repeatedMeasurements.value),
          residualStdF: Number(elements.residualStd.value),
          minimumDistance: elements.minimumSeparation.checked ? 0.045 : 0
        });
    map.setResult(state.interventionResult);
    renderInterventionResult();
    const effect = Number.isFinite(state.interventionResult.expectedEffect)
      ? state.interventionResult.expectedEffect
      : state.interventionResult.expectedEffectF;
    const effectUnits = state.interventionResult.effectUnits ?? "°F";
    elements.resultHeading.textContent = `Post-intervention evaluation: ${state.interventionResult.selected.length} sites`;
    elements.resultSummary.textContent = `This BACI-inspired ${isAir ? "air-quality" : isSoil ? "soil" : isWater ? "water" : "Heat"} design balances treatment measurement, matched controls, ${isWater ? "upstream sentinels, and downstream receptors" : "intervention boundaries, and possible spillover"}. Its power estimate is a planning diagnostic, not causal proof.`;
    elements.solutionPortfolio.innerHTML = '<option value="post">Post-intervention evaluation network</option>';
    elements.solutionPortfolio.disabled = true;
    elements.portfolioSelectionMeta.textContent = `${state.interventionResult.selected.length} sites · ${formatPercent(state.interventionResult.approximatePower)} approximate power · ${Number(effect).toFixed(2)} ${effectUnits} modeled effect.`;
    elements.runStatus.textContent = `Intervention design complete · approximate power ${formatPercent(state.interventionResult.approximatePower)} · modeled effect ${Number(effect).toFixed(2)} ${effectUnits}`;
    button.disabled = false;
    updateLoading({ stage: "Complete", message: "Post-intervention network ready.", progress: 100 });
    window.setTimeout(hideLoading, 180);
  });
}

function renderPlanningStage() {
  const isHeat = state.domainKey === "heat";
  const isAir = state.domainKey === "air";
  const isSoil = state.domainKey === "soil";
  const isWater = state.domainKey === "water";
  const planningVisible = (isAir || isSoil || isWater || (isHeat && state.heatExperience === "risk"));
  const post = planningVisible && state.planningStage === "post";
  const usable = isAir
    ? state.scenario?.scenarioType === "live-national-air" && Boolean(state.scenario?.candidates?.length)
    : isSoil
      ? state.scenario?.scenarioType === "live-national-soil" && Boolean(state.scenario?.candidates?.length)
      : isWater
        ? state.scenario?.scenarioType === "live-national-water" && Boolean(state.scenario?.candidates?.length)
        : ["live-city", "live-national"].includes(state.scenario?.scenarioType) && Boolean(state.scenario?.candidates?.length);
  elements.planningStageSection.hidden = !planningVisible;
  elements.interventionPlanningControls.hidden = !planningVisible || post;
  elements.heatInterventionControls.hidden = !post || !isHeat;
  elements.airInterventionControls.hidden = !post || !isAir;
  elements.soilInterventionControls.hidden = !post || !isSoil;
  elements.waterInterventionControls.hidden = !post || !isWater;
  elements.planningStage.value = state.planningStage;
  elements.planningStageHelp.textContent = post
    ? `Design treatment, matched-control, ${isWater ? "upstream, and downstream" : "boundary, and spillover"} monitoring after an ${isAir ? "air-quality" : isSoil ? "soil" : isWater ? "water-quality" : "Heat"} intervention.`
    : "Design the monitoring network that informs and prioritizes an intervention.";
  elements.optimizeButton.textContent = isHeat && state.heatExperience !== "risk"
    ? (state.heatExperience === "live" ? "Live display only" : "Forecast display only")
    : post ? "Design post-intervention network" : "Generate portfolio";
  elements.optimizeButton.disabled = !state.scenario || !planningVisible;
  elements.designInterventionButton.disabled = post && isHeat && !usable;
  elements.designAirInterventionButton.disabled = post && isAir && !usable;
  elements.designSoilInterventionButton.disabled = post && isSoil && !usable;
  elements.designWaterInterventionButton.disabled = post && isWater && !usable;

  if (isHeat) {
    const national = state.scenario?.scenarioType === "live-national" || state.heatWorkspace === "national";
    const options = national
      ? [["general", "General heat mitigation"], ["tree-shade", "Tree canopy and shade"], ["cool-surfaces", "Cool roofs and pavements"], ["cooling-access", "Cooling-access intervention"]]
      : [["tree-action", "NYC planned tree-action scenario"]];
    const currentTarget = elements.evaluationTarget.value;
    elements.evaluationTarget.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    elements.evaluationTarget.value = options.some(([value]) => value === currentTarget) ? currentTarget : options[0][0];
  }

  if (post) {
    elements.solutionPortfolio.innerHTML = '<option value="post">Post-intervention evaluation network</option>';
    elements.solutionPortfolio.disabled = true;
    if (state.interventionResult) {
      map.setResult(state.interventionResult);
      renderInterventionResult();
      const effect = Number.isFinite(state.interventionResult.expectedEffect)
        ? state.interventionResult.expectedEffect
        : state.interventionResult.expectedEffectF;
      const effectUnits = state.interventionResult.effectUnits ?? "°F";
      elements.resultHeading.textContent = `Post-intervention evaluation: ${state.interventionResult.selected.length} sites`;
      elements.resultSummary.textContent = `This BACI-inspired design balances treatment measurement, matched controls, ${isWater ? "upstream sentinels, and downstream receptors" : `intervention boundaries, and possible ${isAir ? "downwind displacement" : "spillover"}`}.`;
      elements.portfolioSelectionMeta.textContent = `${state.interventionResult.selected.length} sites · ${formatPercent(state.interventionResult.approximatePower)} approximate power · ${Number(effect).toFixed(2)} ${effectUnits} modeled effect.`;
    } else {
      map.setResult(null);
      elements.resultHeading.textContent = "Design post-intervention evaluation";
      elements.resultSummary.textContent = "Use the left-side evaluation parameters to generate treatment, control, boundary, and spillover monitoring sites.";
      elements.portfolioSelectionMeta.textContent = usable
        ? "No post-intervention evaluation network has been generated."
        : `Fit a live ${isAir ? "Air" : isSoil ? "Soil" : isWater ? "Water" : "Heat"} area before generating an evaluation network.`;
    }
  } else if (state.result) {
    renderActiveSolution();
  } else {
    map.setResult(null);
  }
}

function nationalWorkspaceEnabled() {
  return state.dataMode === "live" && (
    state.domainKey === "air" || state.domainKey === "soil" || state.domainKey === "water" || (state.domainKey === "heat" && state.heatWorkspace === "national")
  );
}

function renderViewportWorkloadEstimate() {
  const enabled = nationalWorkspaceEnabled();
  elements.nationalCandidateControls.hidden = !enabled;
  if (!enabled) {
    state.viewportWorkload = null;
    return;
  }
  elements.candidateStrategy.value = state.candidateStrategy;
  const bounds = map.getViewportBounds();
  if (!bounds) {
    state.viewportWorkload = null;
    elements.workloadTier.textContent = "Map unavailable";
    elements.workloadArea.textContent = "—";
    elements.workloadEvaluation.textContent = "—";
    elements.workloadCandidates.textContent = "—";
    elements.workloadRuntime.textContent = "—";
    elements.workloadMessage.textContent = "Wait for the basemap to finish loading.";
    elements.workloadMeter.className = "workload-meter blocked";
    return;
  }
  try {
    const workload = estimateNationalHeatWorkload(bounds, {
      monitorCount: Number(elements.monitorCount.value),
      candidateStrategy: state.candidateStrategy
    });
    state.viewportWorkload = workload;
    elements.workloadTier.textContent = workload.label;
    elements.workloadArea.textContent = `${Math.round(workload.areaKm2).toLocaleString()} km²`;
    elements.workloadEvaluation.textContent = workload.blocked ? "—" : workload.evaluationPoints.toLocaleString();
    elements.workloadCandidates.textContent = workload.blocked
      ? "—"
      : state.candidateStrategy === "mapped"
        ? `up to ${workload.candidateCap}`
        : workload.candidateTarget.toLocaleString();
    elements.workloadRuntime.textContent = workload.expectedRuntime;
    elements.workloadMessage.textContent = workload.message;
    elements.workloadMeter.className = `workload-meter ${workload.key}`;
  } catch (error) {
    state.viewportWorkload = null;
    elements.workloadTier.textContent = "Invalid extent";
    elements.workloadArea.textContent = "—";
    elements.workloadEvaluation.textContent = "—";
    elements.workloadCandidates.textContent = "—";
    elements.workloadRuntime.textContent = "—";
    elements.workloadMessage.textContent = error.message;
    elements.workloadMeter.className = "workload-meter blocked";
  }
}

function cancelHostEnrichment(message = "Mapped-host enrichment canceled. The systematic candidate network remains usable.") {
  const wasActive = Boolean(state.hostEnrichmentController || state.hostEnrichmentLoading);
  if (state.hostEnrichmentController) state.hostEnrichmentController.abort();
  state.hostEnrichmentController = null;
  state.hostEnrichmentLoading = false;
  elements.cancelHostEnrichmentButton.hidden = true;
  hideBackgroundLoading();
  if (wasActive && state.scenario?.model) state.scenario.model.hostEnrichmentStatus = "canceled";
  if (wasActive && message) elements.locationSearchStatus.textContent = message;
}

async function startHostEnrichment(scenario, requestToken) {
  const startedAt = performance.now();
  if (state.candidateStrategy === "systematic") return;
  if (state.viewportWorkload?.key === "regional" && state.candidateStrategy === "hybrid") {
    scenario.model.hostEnrichmentStatus = "skipped for regional screening";
    scenario.model.candidateStatus = "systematic candidate network active; mapped-host enrichment skipped for this regional extent";
    renderDataProvenance();
    return;
  }
  cancelHostEnrichment(null);
  const controller = new AbortController();
  state.hostEnrichmentController = controller;
  state.hostEnrichmentLoading = true;
  elements.cancelHostEnrichmentButton.hidden = false;
  elements.locationSearchStatus.textContent = state.candidateStrategy === "mapped"
    ? "Base field ready. Loading mapped public hosts before optimization..."
    : "Scenario ready. Enriching the systematic candidate network with mapped public hosts...";
  showBackgroundLoading(state.candidateStrategy === "mapped"
    ? "Loading mapped public candidate hosts..."
    : "Optionally enriching candidates with mapped public hosts...");
  try {
    const enrichment = scenario.domainKey === "soil"
      ? enrichNationalSoilCandidateHosts
      : scenario.domainKey === "water"
        ? enrichNationalWaterCandidateHosts
        : enrichNationalHeatCandidateHosts;
    const result = await enrichment(scenario, {
      candidateStrategy: state.candidateStrategy,
      timeoutMs: state.viewportWorkload?.overpassTimeoutMs ?? 10000,
      signal: controller.signal,
      onProgress: (message) => {
        if (requestToken === state.viewportHeatRequestToken) {
          elements.locationSearchStatus.textContent = message;
          showBackgroundLoading(message);
        }
      }
    });
    if (requestToken !== state.viewportHeatRequestToken || state.scenario !== scenario) return;
    if (scenario.domainKey === "air") enrichAirCandidateRoles(scenario);
    if (scenario.domainKey === "water") enrichWaterCandidateRoles(scenario);
    if (state.result || state.interventionResult) {
      state.result = null;
      state.interventionResult = null;
      resetResults();
    }
    map.setScenario(scenario, { fit: false });
    renderDataProvenance();
    elements.optimizeButton.disabled = !scenario.candidates.length || (state.domainKey === "heat" && state.heatExperience !== "risk");
    elements.locationSearchStatus.textContent = `${result.mappedCount} mapped hosts loaded; ${result.candidateCount} total candidates are now active. Moving the map will clear this model.`;
    elements.runStatus.textContent = `${scenario.cityLabel} · full national ${state.domainKey === "air" ? "Air" : state.domainKey === "soil" ? "Soil" : state.domainKey === "water" ? "Water" : "Heat"} model · ${scenario.cells.length} evaluation points · ${scenario.candidates.length} candidates`;
    state.performanceDiagnostics.hostRuntimeMs = performance.now() - startedAt;
    scheduleWorkspaceAutosave();
    void renderWorkspaceDiagnostics();
  } catch (error) {
    if (requestToken !== state.viewportHeatRequestToken || state.scenario !== scenario) return;
    const canceled = controller.signal.aborted || error?.name === "AbortError";
    scenario.model.hostEnrichmentStatus = canceled ? "canceled" : `unavailable: ${error.message}`;
    scenario.model.candidateStatus = state.candidateStrategy === "mapped"
      ? "mapped-host strategy has no active candidates"
      : "systematic candidate network active; mapped-host enrichment unavailable";
    renderDataProvenance();
    elements.optimizeButton.disabled = !scenario.candidates.length || (state.domainKey === "heat" && state.heatExperience !== "risk");
    elements.locationSearchStatus.textContent = canceled
      ? "Mapped-host enrichment canceled. The fitted systematic model remains usable."
      : state.candidateStrategy === "mapped"
        ? `Mapped-host loading failed: ${error.message}. Choose Hybrid or Systematic coverage mesh and refit.`
        : `Mapped-host enrichment unavailable: ${error.message}. The systematic candidate network remains fully usable.`;
  } finally {
    if (state.hostEnrichmentController === controller) state.hostEnrichmentController = null;
    state.hostEnrichmentLoading = false;
    if (!Number.isFinite(state.performanceDiagnostics.hostRuntimeMs)) state.performanceDiagnostics.hostRuntimeMs = performance.now() - startedAt;
    elements.cancelHostEnrichmentButton.hidden = true;
    hideBackgroundLoading();
    void renderWorkspaceDiagnostics();
  }
}

function updateViewportHeatButton() {
  const enabled = nationalWorkspaceEnabled();
  const blocked = state.viewportWorkload?.blocked === true;
  elements.fitScenarioButton.hidden = !["heat", "air", "soil", "water"].includes(state.domainKey);
  elements.fitScenarioButton.disabled = !enabled || blocked || state.viewportHeatLoading;
  elements.fitScenarioButton.classList.toggle("active", state.viewportHeatActive);
  elements.fitScenarioButton.setAttribute("aria-pressed", String(state.viewportHeatActive));
  elements.fitScenarioButton.textContent = state.viewportHeatActive ? "Clear fitted model" : blocked ? "Zoom in to fit" : "Fit current area";
}

function clearViewportHeat({
  message = "The fitted national model was cleared because the map moved. Click Fit current area to rebuild it for the new extent.",
  preserveScenario = false
} = {}) {
  const hadViewportHeat = state.viewportHeatActive || state.viewportHeatScenario || state.viewportHeatLoading;
  state.viewportHeatRequestToken += 1;
  if (state.viewportFitController) state.viewportFitController.abort();
  state.viewportFitController = null;
  cancelHostEnrichment(null);
  state.viewportHeatLoading = false;
  hideLoading();
  stopForecastPlayback();
  stopLiveRefreshTimers();
  state.forecast = null;
  state.liveSnapshot = null;
  state.viewportHeatActive = false;
  state.viewportHeatScenario = null;
  map.clearViewportOverlay();
  elements.fitScenarioButton.classList.remove("loading");

  if (!preserveScenario && nationalWorkspaceEnabled()) {
    state.scenario = null;
    state.result = null;
    state.interventionResult = null;
    state.airValidation = null;
    state.airSensitivity = null;
    state.soilSensitivity = null;
    state.soilEvidence = null;
    state.waterSensitivity = null;
    state.waterEvidence = null;
    state.performanceDiagnostics.optimizationRuntimeMs = null;
    state.layer = "risk";
    map.setScenario(null, { fit: false });
    resetResults();
    elements.optimizeButton.disabled = true;
    elements.modelExtentButton.disabled = true;
    renderDataProvenance();
  }

  renderMapLayerOptions();
  updateViewportHeatButton();
  if (hadViewportHeat && message !== null) elements.locationSearchStatus.textContent = message;
}

async function toggleViewportHeat() {
  const domainLabel = state.domainKey === "air" ? "Air" : state.domainKey === "soil" ? "Soil" : state.domainKey === "water" ? "Water" : "Heat";
  if (state.viewportHeatActive) {
    clearViewportHeat({ message: `Fitted national ${domainLabel} model removed. Pan or search, then fit another area.` });
    renderViewportWorkloadEstimate();
    return;
  }
  if (!nationalWorkspaceEnabled()) {
    elements.locationSearchStatus.textContent = state.domainKey === "air"
      ? "Choose Air → Live public APIs before fitting a national model."
      : state.domainKey === "soil"
        ? "Choose Soil → Live public APIs before fitting a national model."
        : state.domainKey === "water"
          ? "Choose Water → Live public APIs before fitting a national model."
          : "Choose Heat → Any U.S. map area → Live public APIs before fitting a national model.";
    return;
  }
  const bounds = map.getViewportBounds();
  if (!bounds) {
    elements.locationSearchStatus.textContent = "The interactive basemap is not ready yet.";
    return;
  }
  renderViewportWorkloadEstimate();
  const workload = state.viewportWorkload;
  if (!workload || workload.blocked) {
    elements.locationSearchStatus.textContent = workload?.message ?? "Zoom in before fitting this area.";
    updateViewportHeatButton();
    return;
  }

  const requestToken = ++state.viewportHeatRequestToken;
  const controller = new AbortController();
  state.viewportFitController = controller;
  showLoading({
    title: `Fitting national ${domainLabel} workspace`,
    message: `Building a ${workload.label.toLowerCase()} model for the visible map area...`,
    stage: "Validating viewport",
    progress: 6,
    cancel: () => controller.abort()
  });
  state.viewportHeatLoading = true;
  elements.fitScenarioButton.disabled = true;
  elements.fitScenarioButton.classList.add("loading");
  elements.optimizeButton.disabled = true;
  elements.locationSearchStatus.textContent = `Building a ${workload.label.toLowerCase()} national ${domainLabel} model without simplifying the core solver...`;
  const fitStartedAt = performance.now();
  try {
    const common = {
      candidateStrategy: state.candidateStrategy,
      monitorCount: Number(elements.monitorCount.value),
      label: state.selectedLocationLabel,
      signal: controller.signal,
      onProgress: (message) => {
        if (requestToken === state.viewportHeatRequestToken) {
          elements.locationSearchStatus.textContent = message;
          elements.runStatus.textContent = message;
          updateLoading({ message, stage: message, progress: loadingProgressFromMessage(message, 45) });
        }
      }
    };
    const scenario = state.domainKey === "air"
      ? await loadNationalAirScenario(bounds, {
          ...common,
          pollutant: state.airPollutant,
          openAqApiKey: state.openAqApiKey,
          interventionTarget: elements.airEvaluationTarget.value
        })
      : state.domainKey === "soil"
        ? await loadNationalSoilScenario(bounds, {
            ...common,
            property: state.soilProperty,
            depth: state.soilDepth,
            candidateTarget: workload.candidateTarget,
            candidateCap: workload.candidateCap,
            interventionTarget: elements.soilEvaluationTarget.value
          })
      : state.domainKey === "water"
        ? await loadNationalWaterScenario(bounds, {
            ...common,
            indicator: state.waterIndicator,
            systemType: state.waterSystemType,
            candidateTarget: workload.candidateTarget,
            candidateCap: workload.candidateCap,
            interventionTarget: elements.waterEvaluationTarget.value
          })
        : await loadNationalHeatScenario(bounds, {
            ...common,
            maxPoints: workload.weatherPoints,
            candidateTarget: workload.candidateTarget,
            candidateCap: workload.candidateCap,
            interventionTarget: elements.evaluationTarget.value === "tree-action" ? "general" : elements.evaluationTarget.value
          });
    if (state.domainKey === "soil" && state.soilLabSamples.length) {
      const geo = scenario.geoBounds;
      state.soilLabSamples = state.soilLabSamples.map((sample) => ({
        ...sample,
        x: (sample.lng - geo.minLng) / Math.max(1e-9, geo.maxLng - geo.minLng),
        y: (sample.lat - geo.minLat) / Math.max(1e-9, geo.maxLat - geo.minLat)
      })).filter((sample) => sample.x >= 0 && sample.x <= 1 && sample.y >= 0 && sample.y <= 1);
      attachSoilInference(scenario, DOMAINS.soil, {
        samples: state.soilLabSamples,
        analyte: state.soilProperty
      });
    }
    if (requestToken !== state.viewportHeatRequestToken) return;
    state.viewportFitController = null;
    state.viewportHeatLoading = false;
    state.viewportHeatScenario = scenario;
    state.viewportHeatActive = true;
    state.scenario = scenario;
    state.airValidation = scenario.model?.airValidation ?? null;
    state.soilSensitivity = null;
    state.waterSensitivity = null;
    if (state.domainKey === "heat") initializeLiveFields(state.scenario);
    state.heatCalibration = null;
    state.heatExperiment = null;
    state.experimentPackage = null;
    state.heatSensitivity = null;
    state.result = null;
    state.interventionResult = null;
    state.layer = "risk";
    map.setScenario(scenario, { fit: false });
    resetResults();
    renderDataProvenance();
    renderMapLayerOptions();
    updateViewportHeatButton();
    elements.optimizeButton.disabled = !scenario.candidates.length;
    elements.modelExtentButton.disabled = false;
    elements.newScenarioButton.disabled = false;
    const baseCandidateLabel = state.candidateStrategy === "mapped"
      ? "waiting for mapped hosts"
      : `${scenario.candidates.length} systematic candidates ready`;
    elements.locationSearchStatus.textContent = `${scenario.cells.length} evaluation points and ${baseCandidateLabel}. The full Bayesian, social, Pareto, and benchmark model remains active.`;
    elements.runStatus.textContent = `${scenario.cityLabel} · ${workload.label} national ${domainLabel} model · ${scenario.cells.length} evaluation points · ${scenario.candidates.length} candidates`;
    state.performanceDiagnostics.fitRuntimeMs = performance.now() - fitStartedAt;
    state.performanceDiagnostics.hostRuntimeMs = null;
    scheduleWorkspaceAutosave();
    void renderWorkspaceDiagnostics();
    updateLoading({ stage: "Complete", message: `National ${domainLabel} workspace ready.`, progress: 100 });
    window.setTimeout(hideLoading, 180);
    startHostEnrichment(scenario, requestToken);
  } catch (error) {
    if (requestToken !== state.viewportHeatRequestToken) return;
    const canceled = controller.signal.aborted || error?.name === "AbortError";
    console.error(error);
    state.viewportFitController = null;
    state.viewportHeatLoading = false;
    elements.locationSearchStatus.textContent = canceled
      ? `National ${domainLabel} fitting canceled because the map or workspace changed.`
      : `National ${domainLabel} fit failed: ${error.message}`;
    elements.runStatus.textContent = canceled
      ? `National ${domainLabel} fit canceled.`
      : `National ${domainLabel} fit failed. Adjust the map extent and try again.`;
  } finally {
    elements.fitScenarioButton.classList.remove("loading");
    updateViewportHeatButton();
    if (!state.viewportHeatActive) hideLoading();
  }
}

function runPrimaryAction() {
  if (state.domainKey === "core") {
    runCrossDomainBudgetAllocation();
    return;
  }
  if (state.domainKey === "heat" && state.heatExperience !== "risk") {
    elements.runStatus.textContent = "Switch to Heat risk and monitoring before generating or changing the scientific portfolio.";
    return;
  }
  if (["heat", "air", "soil", "water"].includes(state.domainKey) && state.planningStage === "post") designIntervention();
  else runOptimization();
}

for (const button of document.querySelectorAll(".domain-tab")) {
  button.addEventListener("click", () => {
    if (button.dataset.domain === "home") showHomePage();
    else applyDomain(button.dataset.domain);
  });
}

function mapFocusActive() {
  return document.body.classList.contains("header-collapsed") && panelCollapsed("left") && panelCollapsed("right");
}

function syncMapFocusButton() {
  if (!elements.focusMapButton) return;
  const focused = mapFocusActive();
  elements.focusMapButton.setAttribute("aria-pressed", String(focused));
  elements.focusMapButton.textContent = focused ? "Restore layout" : "Focus map";
  elements.focusMapButton.title = focused ? "Restore the previous application layout" : "Collapse the header and both side panels";
}

function toggleMapFocus() {
  if (mapFocusActive()) {
    const restore = state.mapFocusRestoreState ?? { header: false, left: false, right: false };
    setHeaderCollapsed(Boolean(restore.header));
    setPanelCollapsed("left", Boolean(restore.left));
    setPanelCollapsed("right", Boolean(restore.right));
    state.mapFocusRestoreState = null;
  } else {
    state.mapFocusRestoreState = {
      header: document.body.classList.contains("header-collapsed"),
      left: panelCollapsed("left"),
      right: panelCollapsed("right")
    };
    setHeaderCollapsed(true);
    setPanelCollapsed("left", true);
    setPanelCollapsed("right", true);
  }
  syncMapFocusButton();
}

function setHeaderCollapsed(collapsed) {
  document.body.classList.toggle("header-collapsed", collapsed);
  elements.toggleHeader.setAttribute("aria-expanded", String(!collapsed));
  elements.toggleHeader.title = collapsed ? "Expand application header" : "Collapse application header";
  const icon = elements.toggleHeader.querySelector("[aria-hidden]");
  const label = elements.toggleHeader.querySelector(".sr-only");
  if (icon) icon.textContent = collapsed ? "⌄" : "⌃";
  if (label) label.textContent = collapsed ? "Expand application header" : "Collapse application header";
  try { localStorage.setItem("lumos-header-collapsed", String(collapsed)); } catch {}
  syncMapFocusButton();
  window.setTimeout(() => map.resize(), 240);
}

function initializeHeaderState() {
  let collapsed = false;
  try { collapsed = localStorage.getItem("lumos-header-collapsed") === "true"; } catch {}
  setHeaderCollapsed(collapsed);
}

function setPanelCollapsed(side, collapsed) {
  const className = `${side}-collapsed`;
  elements.workspace.classList.toggle(className, collapsed);
  const button = side === "left" ? elements.toggleLeftPanel : elements.toggleRightPanel;
  button.setAttribute("aria-expanded", String(!collapsed));
  if (side === "left") {
    button.textContent = collapsed ? "›" : "‹";
    button.title = collapsed ? "Expand model controls" : "Collapse model controls";
  } else {
    button.textContent = collapsed ? "‹" : "›";
    button.title = collapsed ? "Expand recommendation panel" : "Collapse recommendation panel";
  }
  try { localStorage.setItem(`lumos-${side}-panel-collapsed`, String(collapsed)); } catch {}
  syncMapFocusButton();
  window.setTimeout(() => map.resize(), 240);
}

function panelCollapsed(side) {
  return elements.workspace.classList.contains(`${side}-collapsed`);
}

function initializePanelState() {
  for (const side of ["left", "right"]) {
    let collapsed = false;
    try { collapsed = localStorage.getItem(`lumos-${side}-panel-collapsed`) === "true"; } catch {}
    setPanelCollapsed(side, collapsed);
  }
}

function mapSearchState() {
  const panel = elements.locationPanel;
  return {
    visible: panel ? !panel.hidden : true,
    left: panel ? Number.parseFloat(panel.style.left) : 44,
    top: panel ? Number.parseFloat(panel.style.top) : 14
  };
}

function saveMapSearchState() {
  try { localStorage.setItem(MAP_SEARCH_STORAGE_KEY, JSON.stringify(mapSearchState())); } catch {}
}

function syncMapSearchButton() {
  if (!elements.toggleLocationPanelButton || !elements.locationPanel) return;
  const visible = !elements.locationPanel.hidden;
  elements.toggleLocationPanelButton.setAttribute("aria-expanded", String(visible));
  elements.toggleLocationPanelButton.textContent = visible ? "Hide map search" : "Show map search";
}

function clampMapSearchPanel() {
  const panel = elements.locationPanel;
  const mapElement = document.querySelector("#map");
  if (!panel || !mapElement || panel.hidden) return;
  const mapRect = mapElement.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const maxLeft = Math.max(8, mapRect.width - panelRect.width - 8);
  const maxTop = Math.max(8, mapRect.height - panelRect.height - 8);
  const left = Math.min(maxLeft, Math.max(8, Number.parseFloat(panel.style.left) || 44));
  const top = Math.min(maxTop, Math.max(8, Number.parseFloat(panel.style.top) || 14));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = "auto";
}

function setMapSearchVisible(visible, { save = true } = {}) {
  if (!elements.locationPanel) return;
  elements.locationPanel.hidden = !visible;
  if (visible) window.requestAnimationFrame(clampMapSearchPanel);
  syncMapSearchButton();
  if (save) saveMapSearchState();
}

function initializeMapSearchPanel() {
  const panel = elements.locationPanel;
  const handle = elements.locationPanelDragHandle;
  const mapElement = document.querySelector("#map");
  if (!panel || !handle || !mapElement) return;

  let saved = { visible: true, left: 44, top: 14 };
  try {
    const parsed = JSON.parse(localStorage.getItem(MAP_SEARCH_STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") saved = { ...saved, ...parsed };
  } catch {}
  panel.style.left = `${Number.isFinite(Number(saved.left)) ? Number(saved.left) : 44}px`;
  panel.style.top = `${Number.isFinite(Number(saved.top)) ? Number(saved.top) : 14}px`;
  setMapSearchVisible(saved.visible !== false, { save: false });

  let drag = null;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, input, a")) return;
    const mapRect = mapElement.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
      mapLeft: mapRect.left,
      mapTop: mapRect.top
    };
    handle.setPointerCapture?.(event.pointerId);
    panel.classList.add("is-dragging");
    event.preventDefault();
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const mapRect = mapElement.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const maxLeft = Math.max(8, mapRect.width - panelRect.width - 8);
    const maxTop = Math.max(8, mapRect.height - panelRect.height - 8);
    panel.style.left = `${Math.min(maxLeft, Math.max(8, event.clientX - mapRect.left - drag.offsetX))}px`;
    panel.style.top = `${Math.min(maxTop, Math.max(8, event.clientY - mapRect.top - drag.offsetY))}px`;
    panel.style.right = "auto";
  });
  const finishDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    panel.classList.remove("is-dragging");
    saveMapSearchState();
  };
  handle.addEventListener("pointerup", finishDrag);
  handle.addEventListener("pointercancel", finishDrag);
  window.addEventListener("resize", () => window.requestAnimationFrame(clampMapSearchPanel));
  syncMapSearchButton();
}

function clearLocationResults() {
  elements.locationSearchResults.hidden = true;
  elements.locationSearchResults.innerHTML = "";
}

function renderLocationResults(results) {
  elements.locationSearchResults.innerHTML = "";
  if (!results.length) {
    elements.locationSearchStatus.textContent = "No United States locations matched that search.";
    elements.locationSearchResults.hidden = true;
    return;
  }
  for (const result of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "location-result";
    const strong = document.createElement("strong");
    strong.textContent = result.label;
    const small = document.createElement("small");
    small.textContent = result.detail;
    button.append(strong, small);
    button.addEventListener("click", () => {
      if (state.viewportHeatActive || state.viewportHeatLoading) clearViewportHeat({ message: null });
      state.selectedLocationLabel = result.label;
      map.flyToLocation(result);
      elements.locationSearchStatus.textContent = `${result.label} selected. Adjust the map if needed, then click Fit current area.`;
      clearLocationResults();
    });
    elements.locationSearchResults.appendChild(button);
  }
  const attribution = document.createElement("div");
  attribution.className = "location-search-attribution";
  attribution.textContent = "Search results © OpenStreetMap contributors";
  elements.locationSearchResults.appendChild(attribution);
  elements.locationSearchResults.hidden = false;
  elements.locationSearchStatus.textContent = `${results.length} location${results.length === 1 ? "" : "s"} found.`;
}

map.onCoordinateChange(({ lng, lat }) => {
  elements.mapCoordinateReadout.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} · zoom ${map.baseMap?.getZoom().toFixed(1) ?? "--"}`;
});

map.onViewportChange(({ userInitiated }) => {
  if (userInitiated && (state.viewportHeatActive || state.viewportHeatLoading || state.hostEnrichmentLoading)) clearViewportHeat();
  renderViewportWorkloadEstimate();
  updateViewportHeatButton();
});

elements.tourButton.addEventListener("click", () => {
  applyDomain("core");
  window.setTimeout(() => openOnboarding(0), 80);
});
elements.openUnifiedWorkspaceButton.addEventListener("click", () => applyDomain("core"));
for (const button of document.querySelectorAll("[data-open-domain]")) {
  button.addEventListener("click", () => applyDomain(button.dataset.openDomain));
}
for (const button of document.querySelectorAll("[data-documentation-page]")) {
  button.addEventListener("click", () => openDocumentation(button.dataset.documentationPage));
}
elements.closeDocumentationButton.addEventListener("click", closeDocumentation);
elements.startTourInlineButton.addEventListener("click", () => openOnboarding(0));
elements.onboardingBackButton.addEventListener("click", () => {
  state.onboardingStep = clampOnboardingStep(state.onboardingStep - 1, activeOnboardingSteps());
  renderOnboardingStep();
});
elements.onboardingNextButton.addEventListener("click", () => {
  if (state.onboardingStep >= activeOnboardingSteps().length - 1) {
    closeOnboarding({ completed: true });
    return;
  }
  state.onboardingStep = clampOnboardingStep(state.onboardingStep + 1, activeOnboardingSteps());
  renderOnboardingStep();
});
elements.closeOnboardingButton.addEventListener("click", () => closeOnboarding());
elements.onboardingOverlay.addEventListener("click", (event) => {
  if (event.target === elements.onboardingOverlay) closeOnboarding();
});

elements.installAppButton.addEventListener("click", () => void installApplication());
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  elements.installAppButton.hidden = false;
  elements.homeInstallStatus.textContent = "Install LUMOS for standalone access and an offline application shell.";
});
window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  elements.installAppButton.hidden = true;
  elements.homeInstallStatus.textContent = `${APP_NAME} is installed and available as a standalone application.`;
  elements.runStatus.textContent = `${APP_NAME} installed.`;
});
window.addEventListener("online", updateConnectivityStatus);
window.addEventListener("offline", updateConnectivityStatus);

elements.systemCheckButton.addEventListener("click", () => {
  if (typeof elements.systemCheckDialog.showModal === "function") elements.systemCheckDialog.showModal();
  else elements.systemCheckDialog.setAttribute("open", "");
  if (!state.releaseHealth) void runSystemCheck();
});
elements.runSystemCheckButton.addEventListener("click", () => void runSystemCheck());
elements.runCrossDomainAuditButton.addEventListener("click", () => void runCrossDomainAudit());
elements.exportCrossDomainAuditButton.addEventListener("click", exportCrossDomainAudit);
elements.runCrossDomainBudgetButton.addEventListener("click", runCrossDomainBudgetAllocation);
elements.resetCrossDomainBudgetButton.addEventListener("click", resetCrossDomainBudgetAllocation);
elements.exportCrossDomainBudgetButton.addEventListener("click", exportCrossDomainBudgetAllocation);
elements.crossDomainBudgetPortfolio.addEventListener("change", () => {
  state.activeCrossDomainProfile = elements.crossDomainBudgetPortfolio.value;
  renderCrossDomainBudgetResult();
});
elements.crossDomainBudget.addEventListener("input", markCrossDomainBudgetDirty);
elements.crossDomainReserve.addEventListener("input", () => {
  elements.crossDomainReserveValue.value = `${elements.crossDomainReserve.value}%`;
  markCrossDomainBudgetDirty();
});
elements.crossDomainRequireAll.addEventListener("change", markCrossDomainBudgetDirty);
elements.loadSavedEvidenceButton.addEventListener("click", () => void loadSavedWorkspaceEvidence());
elements.useCurrentEvidenceButton.addEventListener("click", () => void useCurrentWorkspaceEvidence());
elements.useIllustrativeEvidenceButton.addEventListener("click", useIllustrativeSequentialEvidence);
elements.clearSequentialEvidenceButton.addEventListener("click", clearSequentialEvidence);
elements.runSequentialReallocationButton.addEventListener("click", runSequentialReallocation);
elements.exportSequentialReallocationButton.addEventListener("click", exportSequentialReallocation);
elements.sequentialPortfolio.addEventListener("change", () => {
  state.activeSequentialProfile = elements.sequentialPortfolio.value;
  renderSequentialReallocationResult();
});
for (const input of [
  elements.sequentialRoundBudget,
  elements.sequentialMinimumEquity,
  elements.sequentialMinimumReliability,
  elements.sequentialMinimumIntervention
]) input.addEventListener("input", () => markSequentialReallocationDirty());
elements.sequentialReserve.addEventListener("input", () => {
  elements.sequentialReserveValue.value = `${elements.sequentialReserve.value}%`;
  markSequentialReallocationDirty();
});
elements.sequentialLearningRate.addEventListener("input", () => {
  elements.sequentialLearningRateValue.value = Number(elements.sequentialLearningRate.value).toFixed(2);
  markSequentialReallocationDirty();
});
elements.sequentialExploration.addEventListener("input", () => {
  elements.sequentialExplorationValue.value = `${elements.sequentialExploration.value}%`;
  markSequentialReallocationDirty();
});

elements.runAdaptiveSimulationButton.addEventListener("click", runAdaptiveProgramSimulation);
elements.exportAdaptiveSimulationButton.addEventListener("click", exportAdaptiveProgramSimulation);
elements.adaptiveSimulationTrajectory.addEventListener("change", () => {
  state.activeAdaptiveTrajectory = elements.adaptiveSimulationTrajectory.value;
  renderAdaptiveProgramSimulationResult();
});
for (const input of [
  elements.adaptiveSimulationRounds,
  elements.adaptiveSimulationBudget,
  elements.adaptiveSimulationGrowth,
  elements.adaptiveSimulationScenario
]) input.addEventListener("change", () => markAdaptiveSimulationDirty());
elements.adaptiveSimulationTransition.addEventListener("input", () => {
  elements.adaptiveSimulationTransitionValue.value = Number(elements.adaptiveSimulationTransition.value).toFixed(2);
  markAdaptiveSimulationDirty();
});
elements.adaptiveSimulationDiscount.addEventListener("input", () => {
  elements.adaptiveSimulationDiscountValue.value = Number(elements.adaptiveSimulationDiscount.value).toFixed(2);
  markAdaptiveSimulationDirty();
});

elements.runRobustPolicyButton.addEventListener("click", runRobustPolicyEnsemble);
elements.exportRobustPolicyButton.addEventListener("click", exportRobustPolicyEnsemble);
elements.robustPolicyPortfolio.addEventListener("change", () => {
  state.activeRobustPolicy = elements.robustPolicyPortfolio.value;
  renderRobustPolicyResult();
});
for (const input of [elements.robustEnsembleSize, elements.robustSeed]) {
  input.addEventListener("change", () => markRobustPolicyDirty());
}
for (const [input, output, suffix] of [
  [elements.robustResponseUncertainty, elements.robustResponseUncertaintyValue, "%"],
  [elements.robustCostUncertainty, elements.robustCostUncertaintyValue, "%"],
  [elements.robustFailureRate, elements.robustFailureRateValue, "%"],
  [elements.robustEnvironmentalUncertainty, elements.robustEnvironmentalUncertaintyValue, "%"]
]) {
  input.addEventListener("input", () => {
    output.value = `${Math.round(100 * Number(input.value))}${suffix}`;
    markRobustPolicyDirty();
  });
}
elements.robustRiskAversion.addEventListener("input", () => {
  elements.robustRiskAversionValue.value = Number(elements.robustRiskAversion.value).toFixed(2);
  markRobustPolicyDirty();
});

elements.hostInventoryFile.addEventListener("change", () => void importHostInventoryFile());
elements.useIllustrativeHostInventoryButton.addEventListener("click", useIllustrativeHostInventory);
elements.downloadHostInventoryTemplateButton.addEventListener("click", downloadHostInventoryTemplate);
elements.clearHostInventoryButton.addEventListener("click", clearHostInventory);
elements.exportHostInventoryReviewButton.addEventListener("click", exportHostInventoryReview);
elements.spatialHostSource.addEventListener("change", () => {
  if (elements.spatialHostSource.value === "controlled") elements.spatialFieldReviewPolicy.value = "all-not-denied";
  else if (elements.spatialFieldReviewPolicy.value === "all-not-denied") elements.spatialFieldReviewPolicy.value = "verified-or-conditional";
  renderHostInventorySummary();
  markSpatialDeploymentDirty("Host source changed. Rerun coordinated deployment.");
});
elements.spatialFieldReviewPolicy.addEventListener("change", () => markSpatialDeploymentDirty("Field-review policy changed. Rerun coordinated deployment."));

elements.runSpatialDeploymentButton.addEventListener("click", runSpatialDeployment);
elements.exportSpatialDeploymentButton.addEventListener("click", exportSpatialDeployment);
elements.spatialDeploymentPortfolio.addEventListener("change", () => {
  state.activeSpatialDeploymentProfile = elements.spatialDeploymentPortfolio.value;
  renderSpatialDeploymentResult();
  markFieldCampaignDirty("Active deployment profile changed. Rerun field-campaign operations.");
});
elements.spatialAllocationSource.addEventListener("change", syncSpatialUnitsFromAllocationSource);
for (const input of [
  elements.spatialHeatUnits,
  elements.spatialAirUnits,
  elements.spatialSoilUnits,
  elements.spatialWaterUnits,
  elements.spatialMaxDomains,
  elements.spatialHostCount,
  elements.spatialSeed
]) input.addEventListener("change", () => markSpatialDeploymentDirty());
elements.spatialSharedDiscount.addEventListener("input", () => {
  elements.spatialSharedDiscountValue.value = `${Math.round(100 * Number(elements.spatialSharedDiscount.value))}%`;
  markSpatialDeploymentDirty();
});
elements.spatialMinimumCompatibility.addEventListener("input", () => {
  elements.spatialMinimumCompatibilityValue.value = Number(elements.spatialMinimumCompatibility.value).toFixed(2);
  markSpatialDeploymentDirty();
});

elements.runFieldCampaignButton.addEventListener("click", runFieldCampaign);
elements.exportFieldCampaignButton.addEventListener("click", exportFieldCampaign);
elements.fieldCampaignPortfolio.addEventListener("change", () => {
  state.activeFieldCampaignProfile = elements.fieldCampaignPortfolio.value;
  state.campaignOutcomeBundle = null;
  state.campaignTracking = null;
  renderFieldCampaignResult();
  renderCampaignOutcomeSummary();
  renderCampaignTrackingResult();
  elements.campaignTrackingStatus.textContent = "Campaign profile changed. Load outcomes for the selected profile.";
});
for (const input of [
  elements.fieldCampaignCapacity,
  elements.fieldCampaignPhases,
  elements.fieldCampaignScenario,
  elements.fieldCampaignSeed,
  elements.fieldCampaignInspectionCost,
  elements.fieldCampaignReserveCost
]) input.addEventListener("change", () => markFieldCampaignDirty());
elements.fieldCampaignReserveRatio.addEventListener("input", () => {
  elements.fieldCampaignReserveRatioValue.value = `${Math.round(100 * Number(elements.fieldCampaignReserveRatio.value))}%`;
  markFieldCampaignDirty();
});

elements.campaignOutcomeFile.addEventListener("change", () => void importCampaignOutcomeFile());
elements.downloadCampaignOutcomeTemplateButton.addEventListener("click", downloadCampaignOutcomeTemplate);
elements.useIllustrativeCampaignOutcomesButton.addEventListener("click", useIllustrativeCampaignOutcomes);
elements.clearCampaignOutcomesButton.addEventListener("click", clearCampaignOutcomes);
elements.runCampaignTrackingButton.addEventListener("click", runCampaignTracking);
elements.exportCampaignTrackingButton.addEventListener("click", exportCampaignTracking);
elements.campaignTrackingProfile.addEventListener("change", () => {
  state.activeFieldCampaignProfile = elements.campaignTrackingProfile.value;
  state.campaignOutcomeBundle = null;
  state.campaignTracking = null;
  renderFieldCampaignResult();
  renderCampaignOutcomeSummary();
  renderCampaignTrackingResult();
  elements.campaignTrackingStatus.textContent = "Campaign profile changed. Load a matching outcome ledger.";
});
elements.campaignTrackingPhase.addEventListener("change", () => {
  state.campaignTrackingPhase = Number(elements.campaignTrackingPhase.value);
  if (state.campaignOutcomeBundle) runCampaignTracking();
});

elements.commissioningEventFile.addEventListener("change", () => void importCommissioningFile());
elements.downloadCommissioningTemplateButton.addEventListener("click", downloadCommissioningTemplate);
elements.useIllustrativeCommissioningButton.addEventListener("click", useIllustrativeCommissioningEvents);
elements.clearCommissioningEventsButton.addEventListener("click", clearCommissioningEvents);
elements.runCommissioningButton.addEventListener("click", runCommissioningEvaluation);
elements.exportCommissioningButton.addEventListener("click", exportCommissioningOperations);
for (const input of [
  elements.commissioningAsOf,
  elements.commissioningCapacity,
  elements.commissioningPhases,
  elements.commissioningActivateReplacements
]) input.addEventListener("change", () => {
  state.commissioningOperations = null;
  elements.exportCommissioningButton.disabled = true;
  elements.commissioningStatus.textContent = "Commissioning assumptions changed. Evaluate operations again.";
  renderCommissioningResult();
});

renderHostInventorySummary();
renderFieldCampaignResult();
renderCampaignOutcomeSummary();
renderCampaignTrackingResult();
renderCommissioningEventSummary();
renderCommissioningResult();

for (const button of document.querySelectorAll("[data-preset]")) {
  button.addEventListener("click", () => void applyPresetCaseStudy(button.dataset.preset, button.dataset.domainPreset));
}

elements.colorPalette.addEventListener("change", () => {
  state.accessibility.palette = elements.colorPalette.value === "colorblind" ? "colorblind" : "standard";
  document.body.classList.toggle("colorblind-palette", state.accessibility.palette === "colorblind");
  map.setPalette(state.accessibility.palette);
  saveAccessibilityPreferences();
});
elements.reducedMotion.addEventListener("change", () => {
  state.accessibility.reducedMotion = elements.reducedMotion.checked;
  document.body.classList.toggle("reduced-motion", state.accessibility.reducedMotion);
  map.setReducedMotion(state.accessibility.reducedMotion);
  map.setLiveAnimation(state.domainKey === "heat" && ["live", "forecast"].includes(state.heatExperience) && !state.accessibility.reducedMotion);
  syncHeroTypewriter();
  saveAccessibilityPreferences();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !state.onboardingOpen && mapFocusActive()) {
    toggleMapFocus();
    return;
  }
  if (event.key === "Escape" && state.onboardingOpen) closeOnboarding();
  if (!state.onboardingOpen) return;
  if (event.key === "ArrowRight") elements.onboardingNextButton.click();
  if (event.key === "ArrowLeft") elements.onboardingBackButton.click();
});

elements.mapLayerSelect.addEventListener("change", () => {
  state.layer = elements.mapLayerSelect.value;
  map.setLayer(state.layer);
  scheduleWorkspaceAutosave();
});
elements.basemapStyleSelect.addEventListener("change", () => {
  map.setBasemapStyle(elements.basemapStyleSelect.value);
  scheduleWorkspaceAutosave();
});
elements.overlayOpacity.addEventListener("input", () => {
  map.setOverlayOpacity(elements.overlayOpacity.value);
  scheduleWorkspaceAutosave();
});
document.querySelectorAll("input[data-map-feature]").forEach((input) => {
  input.addEventListener("change", () => map.setFeatureVisible(input.dataset.mapFeature, input.checked));
});
elements.toggleHeader.addEventListener("click", () => setHeaderCollapsed(!document.body.classList.contains("header-collapsed")));
elements.toggleLocationPanelButton?.addEventListener("click", () => setMapSearchVisible(elements.locationPanel?.hidden === true));
elements.closeLocationPanelButton?.addEventListener("click", () => setMapSearchVisible(false));
elements.toggleLeftPanel.addEventListener("click", () => setPanelCollapsed("left", !panelCollapsed("left")));
elements.toggleRightPanel.addEventListener("click", () => setPanelCollapsed("right", !panelCollapsed("right")));
elements.focusMapButton.addEventListener("click", toggleMapFocus);
elements.usOverviewButton.addEventListener("click", () => {
  clearViewportHeat({ message: null });
  clearLocationResults();
  elements.locationSearchStatus.textContent = "Showing the continental United States.";
  map.showUnitedStates();
});
elements.fitScenarioButton.addEventListener("click", () => {
  clearLocationResults();
  toggleViewportHeat();
});
elements.cancelHostEnrichmentButton.addEventListener("click", () => cancelHostEnrichment());
elements.savedWorkspaceSelect.addEventListener("change", () => {
  const enabled = Boolean(elements.savedWorkspaceSelect.value);
  elements.loadWorkspaceButton.disabled = !enabled;
  elements.deleteWorkspaceButton.disabled = !enabled;
});
elements.saveWorkspaceButton.addEventListener("click", async () => {
  if (!state.scenario) return;
  const proposed = window.prompt("Workspace name", state.scenario.cityLabel || "Saved LUMOS workspace");
  if (proposed === null) return;
  try {
    await saveCurrentWorkspace({ name: proposed });
  } catch (error) {
    elements.workspacePersistenceStatus.textContent = `Workspace save failed: ${error.message}`;
  }
});
elements.loadWorkspaceButton.addEventListener("click", async () => {
  const key = elements.savedWorkspaceSelect.value;
  if (!key) return;
  try {
    const snapshot = await loadWorkspaceSnapshot(key);
    if (snapshot) await restoreWorkspaceSnapshot(snapshot);
  } catch (error) {
    hideLoading();
    elements.workspacePersistenceStatus.textContent = `Workspace load failed: ${error.message}`;
  }
});
elements.deleteWorkspaceButton.addEventListener("click", async () => {
  const key = elements.savedWorkspaceSelect.value;
  if (!key) return;
  await deleteSavedWorkspace(key);
  elements.workspacePersistenceStatus.textContent = "Saved workspace deleted.";
  await renderSavedWorkspaces();
});
elements.exportWorkspaceButton.addEventListener("click", () => {
  const snapshot = currentWorkspaceSnapshot();
  if (!snapshot) return;
  const safeName = snapshot.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lumos-workspace";
  downloadText(`${safeName}.lumos.json`, exportWorkspaceText(snapshot), "application/json");
  elements.workspacePersistenceStatus.textContent = `Exported ${snapshot.name}.`;
});
elements.importWorkspaceInput.addEventListener("change", async () => {
  const file = elements.importWorkspaceInput.files?.[0];
  if (!file) return;
  try {
    const snapshot = parseWorkspaceText(await file.text());
    await saveWorkspaceSnapshot(snapshot);
    await renderSavedWorkspaces();
    await restoreWorkspaceSnapshot(snapshot);
  } catch (error) {
    hideLoading();
    elements.workspacePersistenceStatus.textContent = `Workspace import failed: ${error.message}`;
  } finally {
    elements.importWorkspaceInput.value = "";
  }
});
elements.clearApiCacheButton.addEventListener("click", async () => {
  elements.clearApiCacheButton.disabled = true;
  const removed = await clearApiCache();
  elements.workspacePersistenceStatus.textContent = `Cleared ${removed} cached public-data response${removed === 1 ? "" : "s"}. Saved workspaces were preserved.`;
  elements.clearApiCacheButton.disabled = false;
  await renderWorkspaceDiagnostics();
});
elements.modelExtentButton.addEventListener("click", () => {
  clearLocationResults();
  if (!state.scenario) {
    elements.locationSearchStatus.textContent = "Fit a national area before returning to its model extent.";
    return;
  }
  elements.locationSearchStatus.textContent = `Returned to ${state.scenario.cityLabel} fitted extent.`;
  map.fitScenario();
});
elements.myLocationButton.addEventListener("click", async () => {
  if (state.viewportHeatActive || state.viewportHeatLoading) clearViewportHeat({ message: null });
  clearLocationResults();
  elements.locationSearchStatus.textContent = "Requesting your browser location...";
  try {
    const location = await map.requestUserLocation();
    state.selectedLocationLabel = "Your location";
    elements.locationSearchStatus.textContent = `Centered on ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}. Click Fit current area to build the model.`;
  } catch (error) {
    elements.locationSearchStatus.textContent = error.message;
  }
});
elements.locationSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = elements.locationSearchInput.value.trim();
  if (!query) return;
  clearLocationResults();
  elements.locationSearchStatus.textContent = "Searching United States locations...";
  try {
    renderLocationResults(await searchUnitedStatesLocations(query));
  } catch (error) {
    elements.locationSearchStatus.textContent = `Location search failed: ${error.message}`;
  }
});

elements.monitorCount.addEventListener("input", () => {
  elements.monitorCountValue.value = elements.monitorCount.value;
  renderViewportWorkloadEstimate();
  updateViewportHeatButton();
});
elements.budgetLimit.addEventListener("input", () => {
  elements.budgetLimitValue.value = Number(elements.budgetLimit.value).toFixed(1);
});
elements.influenceScale.addEventListener("input", () => {
  elements.influenceScaleValue.value = `${Number(elements.influenceScale.value).toFixed(2)}x`;
});
elements.measurementNoise.addEventListener("input", () => {
  elements.measurementNoiseValue.value = Number(elements.measurementNoise.value).toFixed(3);
});
elements.fairnessLimit.addEventListener("input", () => {
  elements.fairnessLimitValue.value = formatPercent(Number(elements.fairnessLimit.value));
});
elements.minimumGroupInformation.addEventListener("input", () => {
  elements.minimumGroupInformationValue.value = formatPercent(Number(elements.minimumGroupInformation.value));
});
elements.minimumReliability.addEventListener("input", () => {
  elements.minimumReliabilityValue.value = formatPercent(Number(elements.minimumReliability.value));
});

elements.soilProperty.addEventListener("change", () => {
  state.soilProperty = elements.soilProperty.value;
  if (state.domainKey === "soil" && state.viewportHeatActive) toggleViewportHeat().then(() => toggleViewportHeat());
});

elements.soilDepth.addEventListener("change", () => {
  state.soilDepth = elements.soilDepth.value;
  if (state.domainKey === "soil" && state.viewportHeatActive) toggleViewportHeat().then(() => toggleViewportHeat());
});

elements.waterIndicator.addEventListener("change", () => {
  state.waterIndicator = elements.waterIndicator.value;
  const shouldRefit = state.domainKey === "water" && state.viewportHeatActive && !state.viewportHeatLoading;
  if (state.viewportHeatActive || state.viewportHeatLoading) {
    clearViewportHeat({ message: shouldRefit
      ? `Indicator changed to ${WATER_INDICATORS[state.waterIndicator]?.label ?? "the selected indicator"}. Rebuilding the fitted Water model...`
      : "Water indicator changed. Fit the current area again to rebuild the Water model." });
  }
  renderMapLayerOptions();
  if (shouldRefit) window.setTimeout(() => void toggleViewportHeat(), 0);
});

elements.waterSystemType.addEventListener("change", () => {
  state.waterSystemType = elements.waterSystemType.value;
  const shouldRefit = state.domainKey === "water" && state.viewportHeatActive && !state.viewportHeatLoading;
  if (state.viewportHeatActive || state.viewportHeatLoading) {
    clearViewportHeat({ message: shouldRefit
      ? `Water system changed to ${WATER_SYSTEMS[state.waterSystemType]?.label ?? "the selected system"}. Rebuilding the fitted Water model...`
      : "Water system changed. Fit the current area again to rebuild the Water model." });
  }
  if (shouldRefit) window.setTimeout(() => void toggleViewportHeat(), 0);
});

elements.soilLabSampleInput.addEventListener("change", () => void importSoilLaboratoryFile(elements.soilLabSampleInput.files?.[0]));
elements.downloadSoilTemplateButton.addEventListener("click", () => {
  downloadText("lumos-soil-laboratory-template.csv", soilLabTemplateCsv(), "text/csv;charset=utf-8");
});
elements.clearSoilSamplesButton.addEventListener("click", () => {
  state.soilLabSamples = [];
  state.soilImportQa = null;
  state.soilSensitivity = null;
  if (state.domainKey === "soil" && state.viewportHeatActive) toggleViewportHeat().then(() => toggleViewportHeat());
  else {
    elements.soilLabStatus.textContent = "No laboratory samples imported.";
    elements.soilQaStatus.hidden = true;
    renderSoilValidation();
    renderSoilSensitivity();
  }
});
elements.recalibrateSoilButton.addEventListener("click", () => {
  if (applySoilLaboratorySamples({ recalibrate: true })) elements.runStatus.textContent = "Soil inference recalibrated from compatible laboratory samples.";
});
elements.runSoilSensitivityButton.addEventListener("click", runSoilRobustnessLab);
elements.exportSoilPaperButton.addEventListener("click", exportSoilPaperBundle);
elements.runSoilEvidenceButton.addEventListener("click", () => void runSoilEvidenceSuite());
elements.exportSoilEvidenceButton.addEventListener("click", exportSoilEvidenceSuite);
elements.runWaterSensitivityButton.addEventListener("click", runWaterRobustnessLab);
elements.exportWaterPaperButton.addEventListener("click", exportWaterPaperBundle);
elements.runWaterEvidenceButton.addEventListener("click", () => void runWaterEvidenceSuite());
elements.exportWaterEvidenceButton.addEventListener("click", exportWaterEvidenceSuite);

elements.soilEvaluationTarget.addEventListener("change", () => {
  if (state.domainKey !== "soil" || !state.scenario) return;
  applyNationalSoilIntervention(state.scenario, elements.soilEvaluationTarget.value);
  map.setScenario(state.scenario, { fit: false });
  renderMapLayerOptions();
});

elements.soilRepeatedMeasurements.addEventListener("input", () => {
  elements.soilRepeatedMeasurementsValue.value = elements.soilRepeatedMeasurements.value;
});
elements.soilResidualStd.addEventListener("input", () => {
  elements.soilResidualStdValue.value = Number(elements.soilResidualStd.value).toFixed(2);
});
elements.designSoilInterventionButton.addEventListener("click", designIntervention);

elements.waterEvaluationTarget.addEventListener("change", () => {
  if (state.scenario?.scenarioType !== "live-national-water") return;
  applyNationalWaterIntervention(state.scenario, elements.waterEvaluationTarget.value);
  state.interventionResult = null;
  state.layer = state.planningStage === "post" ? "interventionBenefit" : state.layer;
  map.setScenario(state.scenario, { fit: false });
  map.setLayer(state.layer);
  renderMapLayerOptions();
  renderInterventionResult();
  scheduleWorkspaceAutosave();
});
elements.waterRepeatedMeasurements.addEventListener("input", () => {
  elements.waterRepeatedMeasurementsValue.value = elements.waterRepeatedMeasurements.value;
});
elements.waterResidualStd.addEventListener("input", () => {
  elements.waterResidualStdValue.value = Number(elements.waterResidualStd.value).toFixed(2);
});
elements.designWaterInterventionButton.addEventListener("click", designIntervention);

elements.repeatedMeasurements.addEventListener("input", () => {
  elements.repeatedMeasurementsValue.value = elements.repeatedMeasurements.value;
});
elements.residualStd.addEventListener("input", () => {
  elements.residualStdValue.value = `${Number(elements.residualStd.value).toFixed(1)} °F`;
});
elements.airRepeatedMeasurements.addEventListener("input", () => {
  elements.airRepeatedMeasurementsValue.value = elements.airRepeatedMeasurements.value;
});
elements.airResidualStd.addEventListener("input", () => {
  elements.airResidualStdValue.value = Number(elements.airResidualStd.value).toFixed(1);
});
elements.preferredProfile.addEventListener("change", () => {
  state.activeProfile = elements.preferredProfile.value;
  if (state.result) renderActiveSolution();
  scheduleWorkspaceAutosave();
});
elements.solutionPortfolio.addEventListener("change", () => {
  if (!elements.solutionPortfolio.value) return;
  state.activeProfile = elements.solutionPortfolio.value;
  if (state.result) renderActiveSolution();
  scheduleWorkspaceAutosave();
});
elements.planningStage.addEventListener("change", () => {
  state.planningStage = elements.planningStage.value;
  renderPlanningStage();
  scheduleWorkspaceAutosave();
});
elements.showCandidates.addEventListener("change", () => {
  map.setCandidatesVisible(elements.showCandidates.checked);
  scheduleWorkspaceAutosave();
});
elements.heatExperience.addEventListener("change", () => setHeatExperience(elements.heatExperience.value));
elements.liveRefreshInterval.addEventListener("change", () => {
  scheduleLiveRefresh();
  scheduleWorkspaceAutosave();
});
elements.refreshLiveWeatherButton.addEventListener("click", () => void refreshLiveConditions());
elements.recomputePortfolioNoticeButton.addEventListener("click", () => {
  setHeatExperience("risk");
  elements.runStatus.textContent = "Live conditions changed meaningfully. Generate a new portfolio when you want to adopt the latest field as a new planning experiment.";
});
elements.loadForecastButton.addEventListener("click", () => void loadForecastPlayback());
elements.forecastTimeline.addEventListener("input", () => {
  stopForecastPlayback();
  setForecastFrame(Number(elements.forecastTimeline.value));
});
elements.forecastPlayButton.addEventListener("click", () => {
  if (state.forecastPlayTimer) stopForecastPlayback();
  else scheduleForecastPlayback();
});
elements.forecastSpeed.addEventListener("change", () => {
  if (state.forecastPlayTimer) scheduleForecastPlayback();
});
elements.runPaperExperimentButton.addEventListener("click", () => void runPaperExperiment());
elements.exportPaperExperimentButton.addEventListener("click", exportPaperExperiment);
elements.exportMapPngButton.addEventListener("click", exportCurrentMapPng);
elements.optimizeButton.addEventListener("click", runPrimaryAction);
elements.designInterventionButton.addEventListener("click", designIntervention);
elements.designAirInterventionButton.addEventListener("click", designIntervention);
elements.runSensitivityButton.addEventListener("click", runHeatSensitivity);
elements.exportPaperTablesButton.addEventListener("click", exportHeatPaperTables);
elements.exportNationalCaseStudyButton.addEventListener("click", exportNationalCaseStudy);
elements.exportExperimentButton.addEventListener("click", () => {
  const experiment = buildExperimentPackage();
  if (!experiment) return;
  downloadJson(`${experiment.experimentId}.json`, experiment);
});
function resetWorkspaceDefaults() {
  state.seed = 20260721;
  state.dataMode = "live";
  state.heatWorkspace = "national";
  state.heatScenario = "baseline";
  state.airPollutant = "pm2_5";
  state.soilProperty = "composite";
  state.soilDepth = "0-15";
  state.waterIndicator = "temperature";
  state.waterSystemType = "surface";
  state.planningStage = "intervention";
  state.candidateStrategy = "hybrid";
  state.activeProfile = "balanced";
  state.selectedLocationLabel = null;
  state.scenario = null;
  state.result = null;
  state.interventionResult = null;
  state.viewportHeatActive = false;
  state.viewportHeatScenario = null;
  state.crossDomainAllocation = null;
  state.sequentialReallocation = null;
  state.adaptiveProgramSimulation = null;
  state.robustPolicyEnsemble = null;
  state.spatialDeployment = null;
  state.fieldCampaign = null;
  state.campaignTracking = null;
  state.commissioningOperations = null;
  elements.dataMode.value = state.dataMode;
  elements.citySelector.value = state.heatWorkspace;
  elements.heatScenario.value = state.heatScenario;
  elements.airPollutant.value = state.airPollutant;
  elements.soilProperty.value = state.soilProperty;
  elements.soilDepth.value = state.soilDepth;
  elements.waterIndicator.value = state.waterIndicator;
  elements.waterSystemType.value = state.waterSystemType;
  elements.planningStage.value = state.planningStage;
  elements.candidateStrategy.value = state.candidateStrategy;
  clearLocationResults();
  map.setScenario(null, { fit: false });
  map.showUnitedStates();
  applyDomain(PAGE_DOMAIN);
}

elements.newScenarioButton.addEventListener("click", resetWorkspaceDefaults);
elements.citySelector.addEventListener("change", () => {
  state.heatWorkspace = elements.citySelector.value;
  state.selectedLocationLabel = null;
  loadScenario();
});
elements.candidateStrategy.addEventListener("change", () => {
  state.candidateStrategy = elements.candidateStrategy.value;
  if (state.viewportHeatActive || state.viewportHeatLoading || state.hostEnrichmentLoading) {
    clearViewportHeat({ message: "Candidate strategy changed. Fit the current area again to rebuild the candidate network." });
  }
  renderViewportWorkloadEstimate();
  updateViewportHeatButton();
});
elements.dataMode.addEventListener("change", () => {
  state.dataMode = elements.dataMode.value;
  loadScenario();
});
elements.airPollutant.addEventListener("change", () => {
  state.airPollutant = elements.airPollutant.value;
  const shouldRefit = state.domainKey === "air" && state.viewportHeatActive && !state.viewportHeatLoading;
  if (state.viewportHeatActive || state.viewportHeatLoading) {
    clearViewportHeat({ message: shouldRefit
      ? `Pollutant changed to ${AIR_POLLUTANTS[state.airPollutant]?.label ?? "the selected pollutant"}. Rebuilding the fitted Air model...`
      : "Pollutant changed. Fit the current area again to rebuild the Air model." });
  }
  renderMapLayerOptions();
  if (shouldRefit) window.setTimeout(() => void toggleViewportHeat(), 0);
});
elements.openAqApiKey.addEventListener("change", () => {
  state.openAqApiKey = elements.openAqApiKey.value.trim();
  try {
    if (state.openAqApiKey) sessionStorage.setItem("lumos-openaq-key", state.openAqApiKey);
    else sessionStorage.removeItem("lumos-openaq-key");
  } catch {}
  elements.airMonitorStatus.textContent = state.openAqApiKey
    ? "Reference-monitor conditioning will be attempted on the next Air fit."
    : "No external reference-monitor key supplied.";
  if (state.domainKey === "air" && state.viewportHeatActive) {
    clearViewportHeat({ message: "Reference-monitor settings changed. Rebuilding the fitted Air model..." });
    window.setTimeout(() => void toggleViewportHeat(), 0);
  }
});
elements.airEvaluationTarget.addEventListener("change", () => {
  if (state.scenario?.scenarioType !== "live-national-air") return;
  applyNationalAirIntervention(state.scenario, elements.airEvaluationTarget.value);
  state.interventionResult = null;
  state.layer = state.planningStage === "post" ? "interventionBenefit" : state.layer;
  map.setScenario(state.scenario, { fit: false });
  map.setLayer(state.layer);
  renderMapLayerOptions();
  renderInterventionResult();
  scheduleWorkspaceAutosave();
});
elements.evaluationTarget.addEventListener("change", () => {
  if (state.scenario?.scenarioType !== "live-national") return;
  applyNationalHeatIntervention(state.scenario, elements.evaluationTarget.value);
  state.interventionResult = null;
  state.layer = state.planningStage === "post" ? "interventionBenefit" : state.layer;
  map.setScenario(state.scenario, { fit: false });
  map.setLayer(state.layer);
  renderMapLayerOptions();
  renderInterventionResult();
  scheduleWorkspaceAutosave();
});
elements.heatScenario.addEventListener("change", () => {
  clearViewportHeat({ message: null });
  state.heatScenario = elements.heatScenario.value;
  if (state.scenario?.scenarioType === "live-city") {
    state.scenario = applyHeatScenario(state.scenario, state.heatScenario);
    map.setScenario(state.scenario);
    resetResults();
    state.interventionResult = null;
    state.heatSensitivity = null;
    buildExperimentPackage();
    renderDataProvenance();
    elements.runStatus.textContent = `${state.scenario.cityLabel} · ${state.heatScenario.replaceAll("_", " ")} heat surface ready`;
    scheduleWorkspaceAutosave();
  } else {
    loadScenario();
  }
});
elements.recalibrateHeatButton.addEventListener("click", () => {
  if (state.domainKey !== "heat" || state.scenario?.scenarioType !== "live-city") return;
  showLoading({
    title: "Recalibrating Heat inference",
    message: "Refitting the covariance model and rerunning held-out validation...",
    stage: "Calibrating inference",
    progress: 12
  });
  elements.recalibrateHeatButton.disabled = true;
  state.heatSensitivity = null;
  renderHeatSensitivity();
  elements.runStatus.textContent = "Recalibrating heat inference and validation...";
  requestAnimationFrame(() => {
    updateLoading({ stage: "Running spatial holdout validation", progress: 48 });
    inferAndValidateHeatScenario(state.scenario);
    map.setScenario(state.scenario);
    resetResults();
    renderDataProvenance();
    buildExperimentPackage();
    const lockedMae = state.heatExperiment?.lumos?.metrics?.mae;
    elements.runStatus.textContent = lockedMae !== undefined
      ? `Heat inference recalibrated · locked MAE ${lockedMae.toFixed(2)} °F`
      : `Heat inference recalibrated · development CV MAE ${state.heatCalibration.validation.model.mae.toFixed(2)} °F`;
    elements.recalibrateHeatButton.disabled = false;
    updateLoading({ stage: "Complete", message: "Heat inference recalibrated.", progress: 100 });
    window.setTimeout(hideLoading, 180);
  });
});


elements.runAirSensitivityButton.addEventListener("click", () => void runAirSensitivityLab());
elements.exportAirPaperButton.addEventListener("click", exportAirPaperBundle);
elements.runAirEvidenceButton.addEventListener("click", () => void runAirEvidenceSuite());
elements.exportAirEvidenceButton.addEventListener("click", exportAirEvidenceSuite);

elements.recalibrateAirButton.addEventListener("click", () => {
  if (state.domainKey !== "air" || state.scenario?.scenarioType !== "live-national-air") return;
  const observations = state.scenario.observations?.filter((entry) => Number.isFinite(entry.observedValue)) ?? [];
  if (observations.length < 6) return;
  showLoading({
    title: "Recalibrating Air inference",
    message: "Testing covariance length, sensor noise, and wind-transport regimes...",
    stage: "Calibrating reference-conditioned field",
    progress: 12
  });
  elements.recalibrateAirButton.disabled = true;
  elements.runStatus.textContent = "Recalibrating pollutant inference and held-out validation...";
  requestAnimationFrame(() => {
    const domain = { ...DOMAINS.air, transportAngle: state.scenario.model?.transportAngle };
    updateLoading({ stage: "Running spatial and locked-monitor validation", progress: 48 });
    const validation = runAirValidationExperiment(observations, domain, { seed: 1207 });
    const settings = validation.calibration?.available
      ? validation.calibration.settings
      : { lengthScaleMultiplier: 1, measurementNoise: 0.06, transportRegime: "moderate" };
    attachAirInference(state.scenario, domain, settings);
    state.scenario.model.airValidation = validation;
    state.scenario.model.airTransportSensitivity = evaluateAirTransportRegimes(
      validation.split?.development?.length ? validation.split.development : observations,
      domain,
      settings
    );
    state.airValidation = validation;
    state.result = null;
    state.interventionResult = null;
    map.setScenario(state.scenario, { fit: false });
    resetResults();
    renderDataProvenance();
    renderMapLayerOptions();
    elements.runStatus.textContent = validation.available
      ? `Air inference recalibrated · locked RMSE ${validation.locked.lumos.rmse.toFixed(2)} ${state.scenario.model.pollutantUnit}`
      : `Air inference updated with ${observations.length} reference readings; locked validation requires at least eight.`;
    elements.recalibrateAirButton.disabled = observations.length < 6;
    scheduleWorkspaceAutosave();
    updateLoading({ stage: "Complete", message: "Air inference recalibrated.", progress: 100 });
    window.setTimeout(hideLoading, 180);
  });
});

elements.resetWeightsButton.addEventListener("click", () => {
  state.weights = { ...DOMAINS[state.domainKey].weights };
  renderWeights();
  scheduleWorkspaceAutosave();
});

for (const control of [
  elements.monitorCount,
  elements.budgetLimit,
  elements.influenceScale,
  elements.measurementNoise,
  elements.fairnessLimit,
  elements.minimumGroupInformation,
  elements.minimumReliability,
  elements.repeatedMeasurements,
  elements.residualStd,
  elements.airRepeatedMeasurements,
  elements.airResidualStd,
  elements.airEvaluationTarget,
  elements.fairnessConstraint,
  elements.minimumSeparation
]) {
  control?.addEventListener("change", scheduleWorkspaceAutosave);
}

window.addEventListener("unhandledrejection", () => hideLoading());
window.addEventListener("error", () => hideLoading());

async function initializeApplication() {
  document.documentElement.dataset.lumosVersion = APP_VERSION;
  try {
    state.openAqApiKey = sessionStorage.getItem("lumos-openaq-key") ?? "";
  } catch {
    state.openAqApiKey = "";
  }
  updateConnectivityStatus();
  void registerApplicationServiceWorker();
  loadAccessibilityPreferences();
  initializeHeaderState();
  initializePanelState();
  initializeMapSearchPanel();
  updateViewportHeatButton();
  renderUnifiedDomainMatrix();
  renderCrossDomainBudgetControls();
  renderSequentialDomainControls();
  renderSequentialEvidence();
  await renderSavedWorkspaces();
  renderDocumentationPage(DEFAULT_DOCUMENTATION_PAGE);
  applyDomain(PAGE_DOMAIN);
  map.showUnitedStates();
  if (PAGE_DOMAIN === "core") {
    void runCrossDomainAudit();
    runCrossDomainBudgetAllocation();
    runSequentialReallocation();
  }
  if (new URLSearchParams(window.location.search).get("tour") === "1") {
    window.setTimeout(() => openOnboarding(0), 350);
  }
}

initializeApplication();
