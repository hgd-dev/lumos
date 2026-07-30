import test from "node:test";
import assert from "node:assert/strict";
import { DOMAINS } from "../js/config/domains.js";
import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS, REQUIRED_PUBLIC_CAPABILITIES, domainDisplayName, isNationalScenarioType, isPublicDomain } from "../js/config/domain-registry.js";
import { generateScenario } from "../js/data/synthetic.js";
import { applyHeatScenario, buildNycHeatScenario, normalizeNtaBoundaryPayload, normalizeSocrataRowsPayload } from "../js/data/heat/nyc.js";
import {
  applyNationalHeatIntervention,
  buildSystematicCandidates,
  buildViewportGrid,
  enrichNationalHeatCandidateHosts,
  estimateNationalHeatWorkload,
  loadNationalHeatScenario,
  normalizeAcsRows,
  normalizeOverpassCandidates,
  normalizeTractFeatures,
  normalizeViewportHeatResponses,
  validateNationalHeatBounds
} from "../js/data/heat/national.js";
import {
  buildNlcdSampleRequest,
  deriveNlcdCovariates,
  normalizeNlcdSamples
} from "../js/data/heat/nlcd.js";
import {
  applyForecastFrame,
  applyLiveSnapshot,
  compareLiveToPlanningSnapshot,
  fetchHeatForecast,
  initializeLiveFields,
  summarizeLiveConditions
} from "../js/data/heat/live.js";
import { prepareBayesianDesign, assimilateCandidate } from "../js/model/bayesian/design.js";
import { predictGaussianProcess } from "../js/model/bayesian/prediction.js";
import { attachHeatInference, calibrateHeatModel, crossValidateHeat } from "../js/model/heat/inference.js";
import {
  checksumObject,
  createHeatExperimentPackage,
  createLockedHeatSplit,
  runLockedHeatExperiment
} from "../js/model/heat/experiments.js";
import { designHeatInterventionNetwork } from "../js/model/heat/intervention.js";
import { AIR_POLLUTANTS, applyNationalAirIntervention, circularMeanTransportRadians, convertOpenAqValue, enrichAirCandidateRoles, loadNationalAirScenario, meteorologicalWindToTransportRadians, normalizeOpenAqLatest, normalizeOpenAqLocations } from "../js/data/air/national.js";
import { designAirInterventionNetwork } from "../js/model/air/intervention.js";
import { SOIL_PROPERTIES, aggregateSoilRows, applyNationalSoilIntervention, buildSdaPointQuery, buildSdaPropertyQuery, loadNationalSoilScenario, normalizeSdaTable, normalizeSoilHosts } from "../js/data/soil/national.js";
import { designSoilInterventionNetwork } from "../js/model/soil/intervention.js";
import { WATER_INDICATORS, WATER_SYSTEMS, applyNationalWaterIntervention, enrichWaterCandidateRoles, loadNationalWaterScenario, normalizeUsgsInstantaneous } from "../js/data/water/national.js";
import { designWaterInterventionNetwork } from "../js/model/water/intervention.js";
import { attachWaterInference, createLockedWaterSplit, runWaterValidationExperiment } from "../js/model/water/inference.js";
import { rowsToWaterSensitivityCsv, runWaterSensitivityAnalysis } from "../js/model/water/sensitivity.js";
import { buildCurrentWaterPaperBundle, rowsToWaterPaperCsv, waterPaperRows } from "../js/model/water/paper-runner.js";
import { WATER_PUBLIC_CASE_STUDIES, createControlledWaterBenchmarkObservations, rowsToWaterEvidenceCsv, runNationalWaterEvidenceSuite, waterEvidenceRows } from "../js/model/water/evidence-runner.js";
import { attachSoilInference, buildSoilImportQaReport, calibrateSoilModel, parseSoilLabText, runSoilValidationExperiment, soilLabTemplateCsv } from "../js/model/soil/inference.js";
import { rowsToSoilSensitivityCsv, runSoilSensitivityAnalysis } from "../js/model/soil/sensitivity.js";
import { buildCurrentSoilPaperBundle, rowsToSoilPaperCsv, soilPaperRows } from "../js/model/soil/paper-runner.js";
import { SOIL_PUBLIC_CASE_STUDIES, createControlledSoilBenchmarkSamples, rowsToSoilEvidenceCsv, runNationalSoilEvidenceSuite, soilEvidenceRows } from "../js/model/soil/evidence-runner.js";
import { attachAirInference, calibrateAirModel, crossValidateAir, runAirValidationExperiment } from "../js/model/air/inference.js";
import { buildAirPaperRows, rowsToAirCsv, runAirSensitivityAnalysis } from "../js/model/air/sensitivity.js";
import { AIR_PAPER_CASE_STUDIES, airPaperRows, buildCurrentAirPaperBundle, rowsToAirPaperCsv } from "../js/model/air/paper-runner.js";
import {
  buildNationalCaseStudyPackage,
  nationalCaseStudyRows,
  rowsToNationalCaseStudyCsv
} from "../js/model/heat/national-report.js";
import {
  PAPER_CASE_STUDIES,
  buildCurrentWorkspacePaperBundle,
  paperSuiteRows,
  rowsToPaperSuiteCsv
} from "../js/model/heat/paper-runner.js";
import {
  buildHeatPaperRows,
  rowsToCsv,
  runHeatSensitivityAnalysis
} from "../js/model/heat/sensitivity.js";
import { optimizeNetwork } from "../js/model/optimizer.js";
import { validateScenario } from "../js/model/schema/scenario.js";
import { parseCoordinateQuery } from "../js/map/location.js";
import { describeMapLegend, displayRange, normalizeDisplayValue, quantile } from "../js/map.js";
import { AIR_ONBOARDING_STEPS, AIR_PRESETS, HEAT_ONBOARDING_STEPS, HEAT_PRESETS, SOIL_ONBOARDING_STEPS, SOIL_PRESETS, UNIFIED_ONBOARDING_STEPS, WATER_ONBOARDING_STEPS, WATER_PRESETS, ONBOARDING_STEPS, onboardingStepsForDomain, clampOnboardingStep } from "../js/release/onboarding.js";
import { checkLocalCapabilities, runReleaseHealthCheck } from "../js/release/health.js";
import { crossDomainAuditRows, rowsToCrossDomainAuditCsv, runCrossDomainConsistencyAudit } from "../js/release/domain-audit.js";
import {
  DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG,
  allocateCrossDomainBudget,
  crossDomainAllocationRows,
  evaluateDomainProgram,
  normalizeCrossDomainBudgetConfig,
  rowsToCrossDomainAllocationCsv
} from "../js/model/unified/budget-allocation.js";
import {
  DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG,
  allocateSequentialFundingRound,
  createEvidenceBundle,
  createIllustrativeEvidenceBundle,
  createWorkspaceEvidenceRecord,
  rowsToSequentialReallocationCsv,
  sequentialReallocationRows
} from "../js/model/unified/sequential-reallocation.js";
import {
  DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG,
  adaptiveProgramSimulationRows,
  rowsToAdaptiveProgramSimulationCsv,
  simulateAdaptiveProgram
} from "../js/model/unified/adaptive-program-simulation.js";
import {
  DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG,
  evaluateRobustPolicies,
  robustPolicyEnsembleRows,
  rowsToRobustPolicyEnsembleCsv
} from "../js/model/unified/robust-policy-ensemble.js";
import {
  DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
  buildSharedHostPool,
  normalizeSpatialDeploymentConfig,
  planSpatialDeployment,
  rowsToSpatialDeploymentCsv,
  spatialDeploymentRows
} from "../js/model/unified/spatial-deployment.js";
import {
  createIllustrativeHostInventory,
  hostInventoryRows,
  hostInventoryTemplateCsv,
  parseHostInventoryText,
  rowsToHostInventoryCsv
} from "../js/model/unified/host-inventory.js";
import {
  DEFAULT_FIELD_CAMPAIGN_CONFIG,
  fieldCampaignRows,
  normalizeFieldCampaignConfig,
  planFieldCampaign,
  rowsToFieldCampaignCsv
} from "../js/model/unified/field-campaign.js";
import {
  campaignOutcomeTemplateCsv,
  campaignTrackingRows,
  createIllustrativeCampaignOutcomes,
  parseCampaignOutcomeText,
  rowsToCampaignTrackingCsv,
  trackLiveCampaign
} from "../js/model/unified/campaign-tracking.js";
import {
  DEFAULT_COMMISSIONING_OPERATIONS_CONFIG,
  commissioningEventTemplateCsv,
  commissioningOperationsRows,
  createCommissioningEventBundle,
  createIllustrativeCommissioningEvents,
  parseCommissioningEventText,
  rowsToCommissioningOperationsCsv,
  runCommissioningOperations
} from "../js/model/unified/commissioning-operations.js";
import { publicReadinessRows, rowsToPublicReadinessCsv, runPublicLaunchReadiness } from "../js/release/public-readiness.js";
import { DEFAULT_DOCUMENTATION_PAGE, DOCUMENTATION_ORDER, DOCUMENTATION_PAGES } from "../js/release/documentation.js";
import { APP_NAME, APP_VERSION, RELEASE_CHANNEL } from "../js/release/version.js";
import {
  createWorkspaceSnapshot,
  deserializeScenario,
  estimateSerializedBytes,
  exportWorkspaceText,
  parseWorkspaceText,
  serializeScenario,
  validateWorkspaceSnapshot
} from "../js/workspace/persistence.js";
import {
  clearStoredNamespace,
  deleteStoredValue,
  getStoredValue,
  listStoredRecords,
  setStoredValue
} from "../js/storage/browser-store.js";

function varianceSum(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

test("synthetic scenario conforms to the shared LUMOS schema", () => {
  const scenario = generateScenario("core", 1234);
  assert.doesNotThrow(() => validateScenario(scenario));
  assert.equal(scenario.cells.length, 29 * 29);
  assert.equal(scenario.candidates.length, 13 * 13);
  assert.equal(scenario.observations.length, 6);
});

test("conditioning on existing observations lowers prior field uncertainty", () => {
  const scenario = generateScenario("heat", 1234);
  const withoutObservations = prepareBayesianDesign({
    evaluationPoints: scenario.cells,
    candidates: scenario.candidates,
    observations: [],
    domain: DOMAINS.heat,
    modelSettings: { measurementNoise: 0.06 }
  });
  const withObservations = prepareBayesianDesign({
    evaluationPoints: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    modelSettings: { measurementNoise: 0.06 }
  });
  assert.ok(varianceSum(withObservations.posteriorVariance) < varianceSum(withoutObservations.posteriorVariance));
});

test("assimilating a feasible candidate monotonically reduces posterior variance", () => {
  const scenario = generateScenario("air", 2222);
  const design = prepareBayesianDesign({
    evaluationPoints: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.air,
    modelSettings: { measurementNoise: 0.06 }
  });
  const before = Float64Array.from(design.posteriorVariance);
  const candidateIndex = scenario.candidates.findIndex((candidate) => candidate.feasible);
  assimilateCandidate(design, candidateIndex);
  assert.ok(design.posteriorVariance.every((value, index) => value <= before[index] + 1e-10));
  assert.ok(varianceSum(design.posteriorVariance) < varianceSum(before));
});

test("optimizer returns the requested network and Bayesian diagnostics", () => {
  const scenario = generateScenario("air", 4321);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.air,
    weights: DOMAINS.air.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.18,
    modelSettings: {
      measurementNoise: 0.06,
      lengthScaleMultiplier: 1,
      transportAngle: scenario.model.transportAngle
    },
    seed: scenario.seed
  }, 8, { minimumSeparation: true });

  assert.equal(result.selected.length, 8);
  assert.equal(result.baselines.length, 9);
  assert.ok(result.exactBenchmark.enumerated > 0);
  assert.equal(result.posteriorVariance.length, scenario.cells.length);
  assert.ok(result.metrics.information > 0);
  assert.ok(Number.isFinite(result.metrics.score));
  assert.equal(result.model.observationsConditioned, 6);
});

test("all domain adapters produce finite optimization results", () => {
  for (const domainKey of Object.keys(DOMAINS)) {
    const scenario = generateScenario(domainKey, 7788);
    const result = optimizeNetwork({
      cells: scenario.cells,
      candidates: scenario.candidates,
      observations: scenario.observations,
      domain: DOMAINS[domainKey],
      weights: DOMAINS[domainKey].weights,
      fairnessConstraint: true,
      fairnessLimit: 0.2,
      modelSettings: {
        measurementNoise: 0.06,
        lengthScaleMultiplier: 1,
        transportAngle: scenario.model.transportAngle
      },
      seed: scenario.seed
    }, 6, {
      minimumSeparation: true,
      beamWidth: 2,
      profileKeys: ["balanced"],
      exactPoolSize: 8,
      exactSelectionCount: 3
    });
    assert.equal(result.selected.length, 6, domainKey);
    assert.ok(Number.isFinite(result.metrics.score), domainKey);
    assert.ok(result.metrics.information > 0, domainKey);
  }
});

test("optimizer generates a five-profile constrained portfolio", () => {
  const scenario = generateScenario("core", 9001);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.core,
    weights: DOMAINS.core.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.16,
    constraints: {
      enforceSocialConstraints: true,
      fairnessLimit: 0.16,
      minimumGroupInformation: 0.12,
      minimumReliability: 0.70,
      budget: 10
    },
    modelSettings: {
      measurementNoise: 0.06,
      lengthScaleMultiplier: 1
    },
    seed: scenario.seed
  }, 10, { minimumSeparation: true, beamWidth: 3 });

  assert.equal(result.solutions.length, 5);
  assert.ok(result.paretoSolutions.length >= 1);
  assert.ok(result.solutions.every((solution) => solution.metrics.totalCost <= 10 + 1e-9));
  assert.ok(result.solutions.every((solution) => solution.constraintStatus.checks.length === 4));
  assert.deepEqual(
    new Set(result.baselines.map((baseline) => baseline.name)),
    new Set([
      "LUMOS",
      "Random",
      "Uniform",
      "Hotspot",
      "Uncertainty",
      "A-optimal",
      "D-optimal",
      "Target MI",
      "Pivoted Cholesky"
    ])
  );
});

test("budget is enforced during candidate construction and baseline selection", () => {
  const scenario = generateScenario("heat", 8080);
  const budget = 4.2;
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    weights: DOMAINS.heat.weights,
    fairnessConstraint: false,
    constraints: {
      enforceSocialConstraints: false,
      minimumReliability: 0.55,
      budget
    },
    modelSettings: { measurementNoise: 0.06 },
    seed: scenario.seed
  }, 12, {
    minimumSeparation: true,
    beamWidth: 2,
    profileKeys: ["balanced"],
    exactPoolSize: 8,
    exactSelectionCount: 3
  });

  assert.ok(result.metrics.totalCost <= budget + 1e-9);
  assert.ok(result.baselines.every((baseline) => baseline.metrics.totalCost <= budget + 1e-9));
  assert.ok(result.selected.length < 12);
});

test("infeasible social thresholds are reported rather than relabeled as feasible", () => {
  const scenario = generateScenario("soil", 7070);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.soil,
    weights: DOMAINS.soil.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.001,
    constraints: {
      enforceSocialConstraints: true,
      fairnessLimit: 0.001,
      minimumGroupInformation: 0.95,
      minimumReliability: 0.95,
      budget: 5
    },
    modelSettings: { measurementNoise: 0.06 },
    seed: scenario.seed
  }, 5, {
    minimumSeparation: true,
    beamWidth: 2,
    profileKeys: ["equity"],
    exactPoolSize: 8,
    exactSelectionCount: 3
  });

  assert.equal(result.constraintStatus.feasible, false);
  assert.ok(result.constraintStatus.totalViolation > 0);
  assert.ok(result.constraintStatus.checks.some((check) => !check.satisfied));
});

test("scientific GP benchmarks return finite criterion diagnostics", () => {
  const scenario = generateScenario("air", 6060);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.air,
    weights: DOMAINS.air.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.18,
    constraints: {
      enforceSocialConstraints: true,
      fairnessLimit: 0.18,
      minimumGroupInformation: 0.10,
      minimumReliability: 0.65,
      budget: 8
    },
    modelSettings: {
      measurementNoise: 0.06,
      transportAngle: scenario.model.transportAngle
    },
    seed: scenario.seed
  }, 6, {
    minimumSeparation: true,
    beamWidth: 2,
    profileKeys: ["balanced"],
    exactPoolSize: 8,
    exactSelectionCount: 3
  });

  for (const name of ["A-optimal", "D-optimal", "Target MI", "Pivoted Cholesky"]) {
    const benchmark = result.baselines.find((entry) => entry.name === name);
    assert.ok(benchmark, name);
    assert.ok(Number.isFinite(benchmark.metrics.score), name);
    assert.ok(Number.isFinite(benchmark.diagnostics.aOptimal), name);
    assert.ok(Number.isFinite(benchmark.diagnostics.dOptimal), name);
    assert.ok(Number.isFinite(benchmark.diagnostics.targetMutualInformation), name);
    assert.ok(benchmark.diagnostics.aOptimal >= 0, name);
    assert.ok(benchmark.diagnostics.dOptimal >= 0, name);
    assert.ok(benchmark.diagnostics.targetMutualInformation >= 0, name);
  }
});

test("exact reduced-pool oracle upper-bounds every tested heuristic", () => {
  const scenario = generateScenario("core", 5050);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.core,
    weights: DOMAINS.core.weights,
    fairnessConstraint: false,
    constraints: {
      enforceSocialConstraints: false,
      minimumReliability: 0.55,
      budget: 8
    },
    modelSettings: { measurementNoise: 0.06 },
    seed: scenario.seed
  }, 6, {
    minimumSeparation: true,
    beamWidth: 2,
    profileKeys: ["balanced"],
    exactPoolSize: 9,
    exactSelectionCount: 3
  });

  const exact = result.exactBenchmark;
  assert.ok(exact.oracle);
  assert.ok(exact.enumerated > 0);
  assert.equal(exact.oracle.optimalityGap, 0);
  for (const method of exact.methods) {
    assert.ok(method.metrics.score <= exact.oracle.metrics.score + 1e-9, method.name);
    assert.ok(method.optimalityGap >= -1e-9, method.name);
  }
});

test("Gaussian-process prediction updates posterior mean and variance from observed values", () => {
  const domain = DOMAINS.heat;
  const points = [
    { id: "p0", x: 0.2, y: 0.5, uncertainty: 0.8, priorMean: 0 },
    { id: "p1", x: 0.8, y: 0.5, uncertainty: 0.8, priorMean: 0 }
  ];
  const observations = [
    { id: "o0", x: 0.2, y: 0.5, uncertainty: 0.8, observedValue: 1, reliability: 1, feasibility: 1, sensorNoise: 0.001 }
  ];
  const prediction = predictGaussianProcess({
    predictionPoints: points,
    observations,
    domain,
    modelSettings: { measurementNoise: 0.01, lengthScaleMultiplier: 1 },
    priorMean: () => 0
  });
  assert.ok(prediction.means[0] > prediction.means[1]);
  assert.ok(prediction.means[0] > 0.8);
  assert.ok(prediction.variances[0] < prediction.variances[1]);
});

test("heat inference calibration and spatial validation return finite diagnostics", () => {
  const observations = Array.from({ length: 20 }, (_, index) => {
    const x = (index % 5) / 4;
    const y = Math.floor(index / 5) / 3;
    const treeCanopy = 0.1 + 0.45 * y;
    const impervious = 0.85 - 0.5 * y;
    const baselineTemperatureF = 86 + 2 * x;
    return {
      id: `heat-${index}`, x, y, uncertainty: 0.7, reliability: 0.92, feasibility: 1, sensorNoise: 0.015,
      baselineTemperatureF, treeCanopy, impervious, builtForm: impervious, exposure: x, vulnerability: y,
      hvi: 1 + Math.min(4, Math.floor(y * 5)),
      observedValue: baselineTemperatureF - 3 * treeCanopy + 2 * impervious + 0.35 * Math.sin(index)
    };
  });
  const scenario = { observations, cells: observations.map((point) => ({ ...point })) };
  const calibration = calibrateHeatModel(scenario, DOMAINS.heat, {
    lengthScaleGrid: [0.8, 1.1],
    noiseGrid: [0.03, 0.06],
    folds: 4
  });
  assert.equal(calibration.available, true);
  assert.ok(Number.isFinite(calibration.validation.model.mae));
  assert.ok(calibration.validation.model.mae < calibration.validation.baseline.mae);
  assert.ok(calibration.validation.groups.length >= 2);
  attachHeatInference(scenario, DOMAINS.heat, calibration.settings);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.posteriorMeanTemperatureF)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.predictiveStdF)));
});



test("continuous-field display uses robust percentile scaling and full endpoint contrast", () => {
  const values = Array.from({ length: 100 }, (_, index) => index / 10);
  values.push(500);
  const range = displayRange(values, 0.05, 0.95);
  assert.ok(range.low > 0);
  assert.ok(range.high < 20, "one extreme outlier should not flatten the visible spectrum");
  assert.equal(normalizeDisplayValue(range.low, range), 0);
  assert.equal(normalizeDisplayValue(range.high, range), 1);
  assert.ok(normalizeDisplayValue((range.low + range.high) / 2, range) > 0.45);
  assert.ok(Math.abs(quantile([0, 10, 20, 30], 0.5) - 15) < 1e-9);
});

test("Air legends never retain Heat labels across domain changes", () => {
  const fitted = describeMapLegend("risk", { low: 0.1, high: 0.9 }, {
    domainKey: "air",
    model: { pollutantLabel: "PM2.5" }
  }, "heat");
  assert.equal(fitted.label, "PM2.5 risk");
  assert.doesNotMatch(fitted.label, /heat/i);

  const empty = describeMapLegend("risk", { low: 0, high: 1 }, null, "air");
  assert.equal(empty.label, "Air-quality risk");
  assert.doesNotMatch(empty.label, /heat/i);
});


test("shared workspace shell matches every app query selector", async () => {
  const { readFile } = await import("node:fs/promises");
  const shell = await readFile(new URL("../workspace-shell.html", import.meta.url), "utf8");
  const entry = await readFile(new URL("../unified.html", import.meta.url), "utf8");
  const html = `${entry}\n${shell}`;
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const queriedIds = [...app.matchAll(/querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
  const duplicateIds = [...html.matchAll(/\bid="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((id, index, values) => values.indexOf(id) !== index);

  assert.deepEqual(duplicateIds, []);
  for (const id of queriedIds) assert.ok(htmlIds.has(id), `Missing #${id} in the workspace entry or shared shell`);
});


test("NYC heat adapter constructs a fine-grid live-city scenario from official-style payloads", () => {
  const rectangle = (minLng, minLat, maxLng, maxLat) => ({
    type: "Polygon",
    coordinates: [[
      [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]
    ]]
  });
  const scenario = buildNycHeatScenario({
    ntaBoundaries: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { nta2020: "A", ntaname: "West", borocode: 1 }, geometry: rectangle(-74.10, 40.60, -73.95, 40.76) },
        { type: "Feature", properties: { nta2020: "B", ntaname: "East", borocode: 2 }, geometry: rectangle(-73.95, 40.60, -73.80, 40.76) }
      ]
    },
    heatForecast: [
      { nta_code: "A", nta_name: "West", baseline: "84", control_scenario_temperature: "91", planned_action_temperature: "89", percent_managed_by_action: "28" },
      { nta_code: "B", nta_name: "East", baseline: "88", control_scenario_temperature: "95", planned_action_temperature: "94", percent_managed_by_action: "14" }
    ],
    hvi: [
      { zcta20: "10001", hvi: "1" },
      { zcta20: "10002", hvi: "5" }
    ],
    zctaBoundaries: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { zcta5: "10001", pop100: 10000, arealand: 1000000 }, geometry: rectangle(-74.10, 40.60, -73.95, 40.76) },
        { type: "Feature", properties: { zcta5: "10002", pop100: 40000, arealand: 1000000 }, geometry: rectangle(-73.95, 40.60, -73.80, 40.76) }
      ]
    },
    landCoverBlockGroups: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { GEOID: "360610001001", NAME: "West BG", UTC_Pct_y2: 35, To_IA_Pct: 42, To_Veg_Pct: 46, NAIP_y2: "2022" }, geometry: rectangle(-74.10, 40.60, -73.95, 40.76) },
        { type: "Feature", properties: { GEOID: "360610002001", NAME: "East BG", UTC_Pct_y2: 12, To_IA_Pct: 78, To_Veg_Pct: 18, NAIP_y2: "2022" }, geometry: rectangle(-73.95, 40.60, -73.80, 40.76) }
      ]
    },
    hyperlocalSensors: [
      { sensor_id: "S1", latitude: "40.67", longitude: "-74.03", readings: "800", mean_temp: "85.4", max_temp: "91.2" },
      { sensor_id: "S2", latitude: "40.69", longitude: "-73.87", readings: "900", mean_temp: "88.1", max_temp: "94.0" }
    ],
    coolingSites: [
      { objectid: "1", name: "Cooling A", latitude: "40.66", longitude: "-74.01" },
      { objectid: "2", name: "Cooling B", latitude: "40.70", longitude: "-73.88" }
    ],
    libraries: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "Library A" }, geometry: { type: "Point", coordinates: [-74.02, 40.72] } }
      ]
    },
    schools: [
      { loccode: "K001", locname: "School A", latitude: "40.64", longitude: "-73.90" }
    ]
  }, 1234);

  assert.equal(scenario.scenarioType, "live-city");
  assert.equal(scenario.cityKey, "nyc");
  assert.ok(scenario.cells.length > 500);
  assert.ok(scenario.candidates.length >= 4);
  assert.equal(scenario.observations.length, 2);
  assert.equal(scenario.boundaries.length, 2);
  assert.ok(scenario.cells.some((cell) => cell.hvi === 5));
  assert.ok(scenario.cells.some((cell) => cell.treeCanopy > 0.3));
  assert.ok(scenario.cells.some((cell) => cell.impervious > 0.7));
  assert.ok(scenario.observations.every((observation) => Number.isFinite(observation.observedValue)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.uncertainty)));
  assert.doesNotThrow(() => validateScenario(scenario));

  const baselineRisk = scenario.cells.map((cell) => cell.risk);
  applyHeatScenario(scenario, "control");
  assert.ok(scenario.cells.some((cell, index) => Math.abs(cell.risk - baselineRisk[index]) > 1e-9));
  applyHeatScenario(scenario, "planned");
  assert.equal(scenario.model.heatScenario, "planned");
});


test("locked heat split is deterministic, spatially stratified, and disjoint", () => {
  const observations = Array.from({ length: 36 }, (_, index) => ({
    id: `locked-${index}`,
    x: (index % 6) / 5,
    y: Math.floor(index / 6) / 5,
    vulnerability: (index % 3) / 2,
    observedValue: 82 + index * 0.1
  }));
  const first = createLockedHeatSplit(observations, { seed: 777, testFraction: 0.22 });
  const second = createLockedHeatSplit(observations, { seed: 777, testFraction: 0.22 });
  assert.equal(first.available, true);
  assert.deepEqual(first.test.map((entry) => entry.id), second.test.map((entry) => entry.id));
  assert.equal(new Set(first.test.map((entry) => entry.id)).size, first.test.length);
  assert.ok(first.test.every((entry) => !first.development.some((development) => development.id === entry.id)));
  assert.ok(first.strata >= 4);
});

test("locked heat experiment compares LUMOS against transparent reconstruction baselines", () => {
  const observations = Array.from({ length: 30 }, (_, index) => {
    const x = (index % 6) / 5;
    const y = Math.floor(index / 6) / 4;
    const treeCanopy = 0.08 + 0.42 * y;
    const impervious = 0.88 - 0.5 * y;
    const baselineTemperatureF = 84 + 2.2 * x;
    return {
      id: `experiment-${index}`,
      x,
      y,
      uncertainty: 0.7,
      reliability: 0.92,
      feasibility: 1,
      sensorNoise: 0.02,
      baselineTemperatureF,
      treeCanopy,
      impervious,
      builtForm: impervious,
      exposure: x,
      vulnerability: y,
      hvi: 1 + Math.min(4, Math.floor(y * 5)),
      observedValue: baselineTemperatureF - 3.5 * treeCanopy + 2.4 * impervious + 0.18 * Math.sin(index)
    };
  });
  const result = runLockedHeatExperiment({
    observations,
    domain: DOMAINS.heat,
    settings: { lengthScaleMultiplier: 1, measurementNoise: 0.04 },
    splitOptions: { seed: 123 }
  });
  assert.equal(result.available, true);
  assert.equal(result.methods.length, 5);
  assert.ok(result.methods.every((method) => Number.isFinite(method.metrics.rmse)));
  assert.ok(result.lumos.metrics.coverage95 >= 0 && result.lumos.metrics.coverage95 <= 1);
});

test("frozen experiment checksum ignores retrieval timestamps but changes with model data", () => {
  const baseScenario = {
    cityKey: "nyc",
    cityLabel: "New York City",
    domainKey: "heat",
    seed: 12,
    sourceMetadata: { live: true, retrievedAt: "2026-01-01T00:00:00Z" },
    model: {},
    geoBounds: {},
    boundaries: [],
    cells: [{ id: "c", x: 0.2, y: 0.3, risk: 0.4 }],
    candidates: [{ id: "k", x: 0.2, y: 0.3, cost: 1 }],
    observations: [{ id: "o", x: 0.2, y: 0.3, observedValue: 85 }]
  };
  const first = createHeatExperimentPackage({ scenario: baseScenario, configuration: {} });
  const second = createHeatExperimentPackage({
    scenario: { ...baseScenario, sourceMetadata: { ...baseScenario.sourceMetadata, retrievedAt: "2026-02-01T00:00:00Z" } },
    configuration: {}
  });
  const changed = createHeatExperimentPackage({
    scenario: { ...baseScenario, cells: [{ ...baseScenario.cells[0], risk: 0.8 }] },
    configuration: {}
  });
  assert.equal(first.checksum, second.checksum);
  assert.notEqual(first.checksum, changed.checksum);
  assert.equal(checksumObject({ a: 1, b: 2 }), checksumObject({ b: 2, a: 1 }));
});

test("heat intervention design allocates treatment and control sites and reports power", () => {
  const cells = [];
  const candidates = [];
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const x = column / 5;
      const y = row / 5;
      const benefit = x > 0.55 ? 0.8 : x > 0.35 ? 0.45 : 0.08;
      cells.push({
        id: `cell-${row}-${column}`,
        x,
        y,
        interventionBenefit: benefit,
        controlTemperatureF: 94,
        plannedTemperatureF: 94 - benefit * 3,
        baselineTemperatureF: 86 + y,
        exposure: x,
        vulnerability: y,
        uncertainty: 0.5
      });
      candidates.push({
        id: `candidate-${row}-${column}`,
        x,
        y,
        feasible: true,
        cost: 0.7,
        reliability: 0.9
      });
    }
  }
  const design = designHeatInterventionNetwork({ cells, candidates }, {
    count: 10,
    budget: 10,
    repeatedMeasurements: 8,
    residualStdF: 1.5,
    minimumDistance: 0.12
  });
  assert.equal(design.available, true);
  assert.ok(design.roleCounts.treatment >= 1);
  assert.ok(design.roleCounts.control >= 1);
  assert.ok(design.selected.length <= 10);
  assert.ok(design.totalCost <= 10 + 1e-9);
  assert.ok(design.approximatePower >= 0 && design.approximatePower <= 1);
  assert.ok(Number.isFinite(design.expectedEffectF));
});


test("Socrata export payload is normalized to ordinary field-name records", () => {
  const payload = {
    meta: {
      view: {
        columns: [
          { fieldName: ":sid" },
          { fieldName: "nta_code" },
          { fieldName: "baseline" },
          { fieldName: "planned_action_temperature" }
        ]
      }
    },
    data: [["row-1", "BK0101", "86.5", "92.3"]]
  };
  assert.deepEqual(normalizeSocrataRowsPayload(payload), [{
    nta_code: "BK0101",
    baseline: "86.5",
    planned_action_temperature: "92.3"
  }]);
});

test("NYC heat adapter normalizes official area-code variants and reversed coordinates", () => {
  const reversedRectangle = (minLng, minLat, maxLng, maxLat) => ({
    type: "multipolygon",
    coordinates: [[[
      [minLat, minLng], [minLat, maxLng], [maxLat, maxLng], [maxLat, minLng], [minLat, minLng]
    ]]]
  });

  const scenario = buildNycHeatScenario({
    ntaBoundaries: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { NTACode: " mn-01 ", NTAName: "Normalized Area", BoroCode: 1 },
        geometry: reversedRectangle(-74.03, 40.69, -73.97, 40.75)
      }]
    },
    heatForecast: [{
      nta_code: "MN01",
      nta_name: "Normalized Area",
      baseline: "86",
      control_scenario_temperature: "93",
      planned_action_temperature: "92"
    }],
    hvi: [],
    zctaBoundaries: { type: "FeatureCollection", features: [] },
    landCoverBlockGroups: { type: "FeatureCollection", features: [] },
    hyperlocalSensors: [],
    coolingSites: [],
    libraries: { type: "FeatureCollection", features: [] },
    schools: []
  }, 321);

  assert.ok(scenario.cells.length > 0);
  assert.ok(scenario.cells.every((cell) => cell.ntaCode === "MN01"));
  assert.equal(scenario.boundaries[0].id, "MN01");
  assert.doesNotThrow(() => validateScenario(scenario));
});


test("NYC NTA row and attribute payloads normalize into coded GeoJSON features", () => {
  const rowPayload = [{
    nta2020: "BK0101",
    ntaname: "Greenpoint",
    the_geom: {
      type: "MultiPolygon",
      coordinates: [[[[-73.96, 40.72], [-73.94, 40.72], [-73.94, 40.74], [-73.96, 40.74], [-73.96, 40.72]]]]
    }
  }];
  const normalizedRows = normalizeNtaBoundaryPayload(rowPayload);
  assert.equal(normalizedRows.features.length, 1);
  assert.equal(normalizedRows.features[0].properties.nta2020, "BK0101");

  const attributePayload = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      attributes: { NTA2020: "QN0101", NTAName: "Astoria" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-73.93, 40.76], [-73.91, 40.76], [-73.91, 40.78], [-73.93, 40.78], [-73.93, 40.76]]]
      }
    }]
  };
  const normalizedAttributes = normalizeNtaBoundaryPayload(attributePayload);
  assert.equal(normalizedAttributes.features.length, 1);
  assert.equal(normalizedAttributes.features[0].properties.NTA2020, "QN0101");
});


test("Heat Sensitivity Lab is deterministic and returns all four analyses", () => {
  const scenario = generateScenario("heat", 2468);
  scenario.cityKey = "test-city";
  scenario.candidates.forEach((candidate, index) => {
    candidate.hostType = ["School", "Library", "Cooling amenity"][index % 3];
  });
  scenario.observations = scenario.cells.slice(0, 30).map((cell, index) => ({
    ...cell,
    id: `sensitivity-observation-${index}`,
    observedValue: 84 + 2.5 * cell.risk - 1.4 * (cell.treeCanopy ?? 0) + 0.1 * Math.sin(index),
    reliability: 0.92,
    feasibility: 1,
    sensorNoise: 0.02,
    baselineTemperatureF: 84 + 2 * cell.risk,
    hvi: 1 + (index % 5)
  }));
  const options = {
    scenario,
    domain: DOMAINS.heat,
    calibrationSettings: { lengthScaleMultiplier: 1, measurementNoise: 0.05 },
    monitorCount: 5,
    budget: 6,
    splitSeeds: [11, 22],
    lengthFactors: [0.9, 1.1],
    noiseFactors: [0.9, 1.1],
    fairnessThresholds: [0.12, 0.2]
  };
  const first = runHeatSensitivityAnalysis(options);
  const second = runHeatSensitivityAnalysis(options);
  assert.equal(first.splitSeeds.length, 2);
  assert.equal(first.covariance.length, 4);
  assert.ok(first.hostStress.length >= 4);
  assert.equal(first.fairness.length, 2);
  assert.deepEqual(
    first.splitSeeds.map((entry) => [entry.seed, entry.rmse]),
    second.splitSeeds.map((entry) => [entry.seed, entry.rmse])
  );
  assert.deepEqual(
    first.hostStress.map((entry) => [entry.key, entry.information, entry.fairnessGap]),
    second.hostStress.map((entry) => [entry.key, entry.information, entry.fairnessGap])
  );
});

test("candidate-host stress preserves the all-host baseline and reports removal scenarios", () => {
  const scenario = generateScenario("heat", 1357);
  scenario.cityKey = "test-city";
  scenario.candidates.forEach((candidate, index) => {
    candidate.hostType = index % 2 ? "School" : "Library";
  });
  scenario.observations = scenario.cells.slice(0, 24).map((cell, index) => ({
    ...cell,
    id: `host-observation-${index}`,
    observedValue: 83 + 3 * cell.risk,
    baselineTemperatureF: 83 + 2.5 * cell.risk,
    reliability: 0.9,
    feasibility: 1,
    sensorNoise: 0.02,
    hvi: 1 + (index % 5)
  }));
  const result = runHeatSensitivityAnalysis({
    scenario,
    domain: DOMAINS.heat,
    calibrationSettings: { lengthScaleMultiplier: 1, measurementNoise: 0.05 },
    monitorCount: 4,
    budget: 5,
    splitSeeds: [1],
    lengthFactors: [1],
    noiseFactors: [1],
    fairnessThresholds: [0.16]
  });
  assert.equal(result.hostStress[0].key, "all");
  assert.ok(result.hostStress.some((entry) => entry.label === "Remove School"));
  assert.ok(result.hostStress.some((entry) => entry.label === "Remove Library"));
  assert.ok(result.hostStress.every((entry) => entry.candidateCount >= 0));
  assert.ok(result.hostStress.filter((entry) => entry.available).every((entry) => Number.isFinite(entry.score)));
});

test("paper table export produces tidy CSV rows with analysis labels", () => {
  const sensitivity = {
    splitSeeds: [{ seed: 1, developmentCount: 20, testCount: 6, mae: 1, rmse: 1.2, bias: 0.1, coverage95: 0.9, lumosRank: 1, bestMethod: "LUMOS" }],
    covariance: [{ lengthScaleMultiplier: 1, measurementNoise: 0.05, mae: 1, rmse: 1.2, bias: 0.1, coverage95: 0.9, intervalWidth95: 3 }],
    hostStress: [{ label: "All host types", candidateCount: 10, monitorCount: 4, information: 0.5, exposure: 0.4, minimumGroupInformation: 0.3, fairnessGap: 0.1, reliability: 0.9, totalCost: 3, score: 1.2, feasible: true }],
    fairness: [{ fairnessLimit: 0.16, candidateCount: 10, monitorCount: 4, information: 0.5, exposure: 0.4, minimumGroupInformation: 0.3, fairnessGap: 0.1, reliability: 0.9, totalCost: 3, score: 1.2, feasible: true }]
  };
  const rows = buildHeatPaperRows({ sensitivity, lockedExperiment: null, calibration: null });
  const csv = rowsToCsv(rows);
  assert.ok(rows.length > 10);
  assert.match(csv, /split_seed_sensitivity/);
  assert.match(csv, /candidate_host_stress/);
  assert.match(csv, /fairness_threshold_sensitivity/);
  assert.ok(csv.split("\n").length === rows.length + 1);
});


test("location search accepts explicit latitude-longitude coordinates without an API request", () => {
  const parsed = parseCoordinateQuery("40.7128, -74.0060");
  assert.equal(parsed.lat, 40.7128);
  assert.equal(parsed.lng, -74.006);
  assert.equal(parsed.type, "coordinate");
  assert.equal(parseCoordinateQuery("not a coordinate"), null);
});

test("NYC live boundaries retain geographic geometry for interactive map projection", () => {
  const geometry = { type: "Polygon", coordinates: [[[-74.0, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.0, 40.8], [-74.0, 40.7]]] };
  const payloads = {
    ntaBoundaries: { type: "FeatureCollection", features: [{ type: "Feature", properties: { nta2020: "MN0101", ntaname: "Test" }, geometry }] },
    heatForecast: [{ nta_code: "MN0101", baseline: "85", control_scenario_temperature: "88", planned_action_temperature: "86" }],
    hvi: [],
    zctaBoundaries: { type: "FeatureCollection", features: [] },
    hyperlocalSensors: [],
    landCoverBlockGroups: { type: "FeatureCollection", features: [] },
    coolingSites: [],
    libraries: { type: "FeatureCollection", features: [] },
    schools: []
  };
  const scenario = buildNycHeatScenario(payloads, 4);
  assert.equal(scenario.boundaries[0].geoGeometry.type, "Polygon");
  assert.deepEqual(scenario.boundaries[0].geoGeometry.coordinates[0][0], [-74.0, 40.7]);
});


test("national viewport heat grid is bounded, deterministic, and browser-sized", () => {
  const first = buildViewportGrid({ west: -105, south: 39, east: -104, north: 40 }, { maxPoints: 72 });
  const second = buildViewportGrid({ west: -105, south: 39, east: -104, north: 40 }, { maxPoints: 72 });
  assert.ok(first.points.length >= 16);
  assert.ok(first.points.length <= 72);
  assert.deepEqual(first, second);
  assert.ok(first.points.every((point) => point.lng >= -105 && point.lng <= -104));
  assert.ok(first.points.every((point) => point.lat >= 39 && point.lat <= 40));
});

test("Open-Meteo multi-location payloads normalize into viewport heat cells", () => {
  const points = [
    { id: "a", x: 0, y: 0, lat: 40, lng: -105 },
    { id: "b", x: 1, y: 1, lat: 41, lng: -104 }
  ];
  const cells = normalizeViewportHeatResponses(points, [
    { latitude: 40, longitude: -105, elevation: 1600, current: { time: "2026-07-22T20:00", temperature_2m: 91, apparent_temperature: 94, relative_humidity_2m: 30, wind_speed_10m: 8 } },
    { latitude: 41, longitude: -104, elevation: 1500, current: { time: "2026-07-22T20:00", temperature_2m: 88, apparent_temperature: 89, relative_humidity_2m: 35, wind_speed_10m: 11 } }
  ]);
  assert.equal(cells.length, 2);
  assert.equal(cells[0].risk, 94);
  assert.equal(cells[1].temperature, 88);
  assert.equal(cells[1].windSpeed, 11);
});


test("national Heat workspace rejects continental-scale fits before API loading", () => {
  assert.throws(
    () => validateNationalHeatBounds({ west: -125, south: 24, east: -66, north: 50 }),
    /Zoom in before fitting/
  );
  assert.doesNotThrow(() => validateNationalHeatBounds({ west: -105.2, south: 39.5, east: -104.7, north: 40.0 }));
});

test("national tract, ACS, and OpenStreetMap payloads normalize into shared fields", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [[[-105.1, 39.6], [-104.9, 39.6], [-104.9, 39.8], [-105.1, 39.8], [-105.1, 39.6]]]
  };
  const tracts = normalizeTractFeatures({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { GEOID: "08031000100", STATE: "08", COUNTY: "031", TRACT: "000100", AREALAND: 2000000 }, geometry }]
  });
  assert.equal(tracts[0].properties.GEOID, "08031000100");

  const acs = normalizeAcsRows([
    ["NAME", "B01003_001E", "B17001_001E", "B17001_002E", "B01001_003E", "B01001_027E", "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E", "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E", "B08201_001E", "B08201_002E", "state", "county", "tract"],
    ["Test tract", "1000", "900", "180", "30", "28", "20", "15", "20", "15", "10", "5", "22", "16", "20", "16", "11", "7", "400", "80", "08", "031", "000100"]
  ]);
  assert.equal(acs.get("08031000100").population, 1000);
  assert.equal(acs.get("08031000100").povertyRate, 0.2);

  const candidates = normalizeOverpassCandidates({ elements: [
    { type: "node", id: 1, lat: 39.7, lon: -105.0, tags: { amenity: "library", name: "Test Library" } }
  ] }, { west: -105.1, south: 39.6, east: -104.9, north: 39.8 });
  assert.equal(candidates[0].hostType, "Library");
  assert.equal(candidates[0].feasible, true);
});

test("national Heat loader builds an optimizable live scenario from mocked public APIs", async () => {
  const rectangle = {
    type: "Polygon",
    coordinates: [[[-105.1, 39.6], [-104.9, 39.6], [-104.9, 39.8], [-105.1, 39.8], [-105.1, 39.6]]]
  };
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("open-meteo.com")) {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude").split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude").split(",").map(Number);
      const payload = latitudes.map((lat, index) => ({
        latitude: lat,
        longitude: longitudes[index],
        elevation: 1600,
        current: {
          time: "2026-07-23T18:00",
          temperature_2m: 88 + index * 0.05,
          apparent_temperature: 91 + index * 0.08,
          relative_humidity_2m: 28 + index % 5,
          wind_speed_10m: 7,
          wind_direction_10m: 220
        }
      }));
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    if (url.includes("enviroatlas.epa.gov")) {
      const geometry = JSON.parse(new URLSearchParams(options.body).get("geometry"));
      return new Response(JSON.stringify({
        samples: geometry.points.map((point, index) => ({
          location: { x: point[0], y: point[1] },
          value: String(index % 3 === 0 ? 24 : index % 3 === 1 ? 41 : 22)
        }))
      }), { status: 200 });
    }
    if (url.includes("tigerWMS_ACS2024")) {
      return new Response(JSON.stringify({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {
            GEOID: "08031000100", STATE: "08", COUNTY: "031", TRACT: "000100",
            NAME: "Census Tract 1", AREALAND: 2000000, CENTLAT: "39.7", CENTLON: "-105.0"
          },
          geometry: rectangle
        }]
      }), { status: 200 });
    }
    if (url.includes("api.census.gov")) {
      return new Response(JSON.stringify([
        ["NAME", "B01003_001E", "B17001_001E", "B17001_002E", "B01001_003E", "B01001_027E", "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E", "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E", "B08201_001E", "B08201_002E", "state", "county", "tract"],
        ["Test tract", "1000", "900", "180", "30", "28", "20", "15", "20", "15", "10", "5", "22", "16", "20", "16", "11", "7", "400", "80", "08", "031", "000100"]
      ]), { status: 200 });
    }
    if (url.includes("overpass")) {
      return new Response(JSON.stringify({ elements: [
        { type: "node", id: 1, lat: 39.68, lon: -105.02, tags: { amenity: "library", name: "Library" } },
        { type: "node", id: 2, lat: 39.74, lon: -104.96, tags: { amenity: "school", name: "School" } }
      ] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const scenario = await loadNationalHeatScenario(
    { west: -105.1, south: 39.6, east: -104.9, north: 39.8 },
    { maxPoints: 25, fetchImpl, label: "Test national viewport", interventionTarget: "cooling-access" }
  );
  assert.equal(scenario.scenarioType, "live-national");
  assert.equal(scenario.cityLabel, "Test national viewport");
  assert.ok(scenario.cells.length >= 25);
  assert.ok(scenario.candidates.length >= 2);
  assert.equal(scenario.boundaries.length, 1);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.risk) && cell.risk >= 0 && cell.risk <= 1));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.exposure) && Number.isFinite(cell.vulnerability)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.interventionBenefit)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.impervious) && Number.isFinite(cell.treeCanopy)));
  assert.ok(scenario.cells.some((cell) => cell.landCoverObserved));
  assert.ok(scenario.groups.length >= 4);
  assert.match(scenario.model.landCoverStatus, /loaded/);
  assert.doesNotThrow(() => validateScenario(scenario));
  const optimized = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    weights: DOMAINS.heat.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.25,
    constraints: {
      enforceSocialConstraints: true,
      fairnessLimit: 0.25,
      minimumGroupInformation: 0.02,
      minimumReliability: 0.55,
      budget: 5
    },
    modelSettings: { measurementNoise: 0.06, lengthScaleMultiplier: 1 },
    seed: 9
  }, 4, {
    minimumSeparation: true,
    beamWidth: 2,
    profileKeys: ["balanced"],
    exactPoolSize: 7,
    exactSelectionCount: 3
  });
  assert.ok(optimized.selected.length > 0);
  assert.ok(Number.isFinite(optimized.metrics.score));

  applyNationalHeatIntervention(scenario, "tree-shade");
  assert.equal(scenario.model.interventionTarget, "tree-shade");
  assert.ok(scenario.cells.every((cell) => cell.plannedTemperatureF < cell.controlTemperatureF));
});

test("national workload guardrails preserve the full model while scaling spatial inputs", () => {
  const standard = estimateNationalHeatWorkload(
    { west: -105.1, south: 39.6, east: -104.9, north: 39.8 },
    { monitorCount: 12, candidateStrategy: "hybrid" }
  );
  assert.equal(standard.blocked, false);
  assert.equal(standard.fullModelEnabled, true);
  assert.ok(standard.candidateTarget >= 12 * 12);
  assert.ok(standard.weatherPoints > 0);

  const regional = estimateNationalHeatWorkload(
    { west: -105, south: 39, east: -103.5, north: 40.5 },
    { monitorCount: 10, candidateStrategy: "systematic" }
  );
  assert.equal(regional.blocked, false);
  assert.equal(regional.key, "regional");
  assert.equal(regional.fullModelEnabled, true);
  assert.ok(regional.weatherPoints < standard.weatherPoints);

  const blocked = estimateNationalHeatWorkload(
    { west: -125, south: 24, east: -66, north: 50 },
    { monitorCount: 10 }
  );
  assert.equal(blocked.blocked, true);
  assert.match(blocked.message, /Zoom in|subregions/);
});

test("systematic candidate mesh is deterministic, distributed, and field-verification explicit", () => {
  const cells = buildViewportGrid(
    { west: -105.1, south: 39.6, east: -104.9, north: 39.8 },
    { maxPoints: 36 }
  ).points.map((point) => ({ ...point, risk: 0.5, uncertainty: 0.5, exposure: 0.5, vulnerability: 0.5 }));
  const bounds = { west: -105.1, south: 39.6, east: -104.9, north: 39.8 };
  const first = buildSystematicCandidates(cells, bounds, { target: 80, maximum: 100 });
  const second = buildSystematicCandidates(cells, bounds, { target: 80, maximum: 100 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 80);
  assert.ok(Math.min(...first.map((candidate) => candidate.x)) < 0.1);
  assert.ok(Math.max(...first.map((candidate) => candidate.x)) > 0.85);
  assert.ok(first.every((candidate) => candidate.sourceType === "systematic_proxy"));
  assert.ok(first.every((candidate) => candidate.requiresFieldVerification === true));
});

test("mapped-host enrichment is optional and merges into the usable systematic network", async () => {
  const bounds = { west: -105.1, south: 39.6, east: -104.9, north: 39.8 };
  const cells = buildViewportGrid(bounds, { maxPoints: 25 }).points.map((point, index) => ({
    ...point,
    risk: 0.3 + index / 100,
    uncertainty: 0.5,
    exposure: 0.4,
    vulnerability: 0.4,
    communityGroup: index % 4,
    landClass: 0.5,
    builtForm: 0.5,
    networkBranch: index % 4
  }));
  const systematic = buildSystematicCandidates(cells, bounds, { target: 40, maximum: 50 });
  const scenario = {
    cells,
    candidates: systematic,
    geoBounds: { minLng: bounds.west, minLat: bounds.south, maxLng: bounds.east, maxLat: bounds.north },
    model: {
      candidateStrategy: "hybrid",
      workload: { candidateCap: 50 },
      hostEnrichmentStatus: "pending"
    },
    sourceMetadata: {
      sources: [{ label: "OpenStreetMap Overpass API", role: "pending" }]
    }
  };
  Object.defineProperty(scenario, "_systematicCandidates", { value: systematic, enumerable: false });
  const fetchImpl = async () => new Response(JSON.stringify({ elements: [
    { type: "node", id: 99, lat: 39.7, lon: -105.0, tags: { amenity: "library", name: "Mapped Library" } }
  ] }), { status: 200 });
  const result = await enrichNationalHeatCandidateHosts(scenario, {
    fetchImpl,
    timeoutMs: 1000,
    candidateStrategy: "hybrid"
  });
  assert.equal(result.mappedCount, 1);
  assert.ok(scenario.candidates.some((candidate) => candidate.sourceType === "mapped_host"));
  assert.ok(scenario.candidates.some((candidate) => candidate.sourceType === "systematic_proxy"));
  assert.equal(scenario.model.hostEnrichmentStatus, "loaded");
});


test("Annual NLCD samples produce transparent land-surface covariates", () => {
  const developed = deriveNlcdCovariates(24);
  const forest = deriveNlcdCovariates(41);
  assert.equal(developed.landCoverLabel, "Developed high intensity");
  assert.ok(developed.impervious > 0.8);
  assert.ok(developed.treeCanopy < 0.1);
  assert.ok(forest.treeCanopy > 0.8);
  assert.ok(forest.vegetation > developed.vegetation);

  const points = [
    { id: "a", lat: 40.7, lng: -74.0 },
    { id: "b", lat: 33.4, lng: -112.1 }
  ];
  const normalized = normalizeNlcdSamples({ samples: [
    { value: "24", location: { x: -74, y: 40.7 } },
    { value: "41", location: { x: -112.1, y: 33.4 } }
  ] }, points, { rasterFunction: "NLCD-all-classes-2025" });
  assert.equal(normalized[0].id, "a");
  assert.equal(normalized[1].landCoverCode, 41);
  const request = buildNlcdSampleRequest(points);
  assert.equal(request.options.method, "POST");
  assert.match(request.options.body, /geometry/);
});

test("national case-study export contains tidy scenario, social, network, and benchmark tables", () => {
  const scenario = generateScenario("heat", 9753);
  scenario.scenarioType = "live-national";
  scenario.cityLabel = "Test national case";
  scenario.model.viewportAreaKm2 = 123;
  scenario.cells.forEach((cell, index) => {
    cell.apparentTemperature = 85 + index / 100;
    cell.impervious = index % 2 ? 0.7 : 0.2;
    cell.treeCanopy = index % 2 ? 0.1 : 0.8;
  });
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    weights: DOMAINS.heat.weights,
    fairnessConstraint: false,
    constraints: { enforceSocialConstraints: false, minimumReliability: 0.55, budget: 5 },
    modelSettings: { measurementNoise: 0.06 },
    seed: scenario.seed
  }, 4, { minimumSeparation: true, beamWidth: 2, profileKeys: ["balanced"], exactPoolSize: 7, exactSelectionCount: 3 });
  const rows = nationalCaseStudyRows({ scenario, result, activeProfile: "balanced" });
  assert.ok(rows.some((row) => row.table === "scenario" && row.metric === "mean_impervious_proxy"));
  assert.ok(rows.some((row) => row.table === "selected_site"));
  assert.ok(rows.some((row) => row.table === "benchmark"));
  assert.match(rowsToNationalCaseStudyCsv(rows), /selected_site/);
  const packageData = buildNationalCaseStudyPackage({ scenario, result, activeProfile: "balanced" });
  assert.equal(packageData.format, "lumos-national-heat-case-study-v1");
  assert.ok(packageData.selectedNetwork.selected.length > 0);
});

test("workspace snapshots preserve the fitted scenario and systematic candidate network", () => {
  const scenario = generateScenario("heat", 2468);
  const systematic = scenario.candidates.slice(0, 8).map((candidate) => ({
    ...candidate,
    sourceType: "systematic_proxy"
  }));
  Object.defineProperty(scenario, "_systematicCandidates", {
    value: systematic,
    writable: true,
    enumerable: false,
    configurable: true
  });
  const snapshot = createWorkspaceSnapshot({
    scenario,
    controls: { domainKey: "heat", monitorCount: 9, candidateStrategy: "hybrid" },
    mapView: { center: [-104.99, 39.74], zoom: 10, bearing: 0, pitch: 0 },
    name: "Test Heat workspace",
    savedAt: 123456789
  });
  assert.doesNotThrow(() => validateWorkspaceSnapshot(snapshot));
  assert.ok(snapshot.bytes > 0);
  const restored = deserializeScenario(snapshot.scenario);
  assert.equal(restored.cells.length, scenario.cells.length);
  assert.equal(restored.candidates.length, scenario.candidates.length);
  assert.equal(restored._systematicCandidates.length, systematic.length);
  assert.equal(Object.prototype.propertyIsEnumerable.call(restored, "_systematicCandidates"), false);
});

test("workspace JSON export and import round-trip without changing scientific inputs", () => {
  const scenario = generateScenario("core", 1357);
  const snapshot = createWorkspaceSnapshot({
    scenario,
    controls: { domainKey: "core", fairnessLimit: 0.17 },
    name: "Round trip"
  });
  const text = exportWorkspaceText(snapshot);
  const parsed = parseWorkspaceText(text);
  assert.equal(parsed.format, snapshot.format);
  assert.equal(parsed.workspaceId, snapshot.workspaceId);
  assert.deepEqual(serializeScenario(deserializeScenario(parsed.scenario)), parsed.scenario);
  assert.equal(estimateSerializedBytes(parsed) > 0, true);
});

test("browser storage fallback can save, list, load, and delete records", async () => {
  const namespace = `test-${Date.now()}-${Math.random()}`;
  await setStoredValue(namespace, "alpha", { value: 7 }, { label: "Alpha" });
  await setStoredValue(namespace, "beta", { value: 9 }, { label: "Beta" });
  assert.deepEqual(await getStoredValue(namespace, "alpha"), { value: 7 });
  const listed = await listStoredRecords(namespace);
  assert.equal(listed.length, 2);
  await deleteStoredValue(namespace, "alpha");
  assert.equal(await getStoredValue(namespace, "alpha"), null);
  const removed = await clearStoredNamespace(namespace);
  assert.equal(removed, 1);
  assert.equal((await listStoredRecords(namespace)).length, 0);
});

test("live Heat snapshots update display-only fields without overwriting the planning risk field", () => {
  const scenario = generateScenario("heat", 31415);
  scenario.cells = scenario.cells.slice(0, 2).map((cell, index) => ({
    ...cell,
    id: `cell-${index}`,
    temperature: 80 + index,
    apparentTemperature: 84 + index,
    humidity: 45,
    windSpeed: 6,
    windDirection: 180,
    risk: 0.4 + index * 0.1
  }));
  initializeLiveFields(scenario);
  const originalRisk = scenario.cells.map((cell) => cell.risk);
  applyLiveSnapshot(scenario, {
    fetchedAt: "2026-07-24T18:00:00Z",
    sourceTime: "2026-07-24T18:00",
    records: scenario.cells.map((cell, index) => ({
      id: cell.id,
      temperature: 90 + index,
      apparentTemperature: 96 + index,
      humidity: 58,
      windSpeed: 8,
      windDirection: 210,
      cloudCover: 30,
      precipitation: 0,
      weatherCode: 1,
      isDay: 1
    }))
  });
  assert.deepEqual(scenario.cells.map((cell) => cell.risk), originalRisk);
  assert.equal(scenario.cells[0].liveApparentTemperature, 96);
  assert.equal(summarizeLiveConditions(scenario).temperature, 90.5);
  assert.equal(compareLiveToPlanningSnapshot(scenario).classification, "meaningful");
});

test("forecast frames interpolate and preserve downloaded frame identity", () => {
  const scenario = generateScenario("heat", 2718);
  scenario.cells = scenario.cells.slice(0, 2).map((cell, index) => ({ ...cell, id: `forecast-${index}` }));
  const forecast = {
    fetchedAt: "2026-07-24T12:00:00Z",
    frames: [
      {
        index: 0,
        time: "2026-07-24T12:00",
        records: scenario.cells.map((cell) => ({ id: cell.id, temperature: 80, apparentTemperature: 82, humidity: 40, windSpeed: 4, windDirection: 180, cloudCover: 10, precipitation: 0 }))
      },
      {
        index: 1,
        time: "2026-07-24T13:00",
        records: scenario.cells.map((cell) => ({ id: cell.id, temperature: 90, apparentTemperature: 94, humidity: 50, windSpeed: 8, windDirection: 200, cloudCover: 30, precipitation: 0.1 }))
      }
    ]
  };
  applyForecastFrame(scenario, forecast, 1, { fromFrameIndex: 0, blend: 0.5 });
  assert.equal(scenario.cells[0].liveTemperature, 85);
  assert.equal(scenario.cells[0].liveApparentTemperature, 88);
  assert.equal(scenario.liveWeather.frameIndex, 1);
});

test("Open-Meteo hourly multi-location data normalize into forecast playback frames", async () => {
  const scenario = {
    cells: [
      { id: "a", lat: 40, lng: -105 },
      { id: "b", lat: 40.1, lng: -104.9 }
    ]
  };
  const hourly = (offset) => ({
    hourly: {
      time: ["2026-07-24T12:00", "2026-07-24T13:00"],
      temperature_2m: [80 + offset, 82 + offset],
      apparent_temperature: [83 + offset, 86 + offset],
      relative_humidity_2m: [40, 42],
      wind_speed_10m: [5, 6],
      wind_direction_10m: [180, 190],
      cloud_cover: [10, 20],
      precipitation: [0, 0.02],
      weather_code: [1, 2],
      is_day: [1, 1]
    }
  });
  const fetchImpl = async () => new Response(JSON.stringify([hourly(0), hourly(1)]), { status: 200 });
  const forecast = await fetchHeatForecast(scenario, { hours: 2, fetchImpl, cache: false });
  assert.equal(forecast.frames.length, 2);
  assert.equal(forecast.frames[1].records[1].apparentTemperature, 87);
});

test("paper experiment bundle freezes the active portfolio and exports tidy comparison rows", () => {
  const scenario = generateScenario("heat", 8642);
  scenario.scenarioType = "live-national";
  scenario.cityLabel = "Paper test case";
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    weights: DOMAINS.heat.weights,
    fairnessConstraint: false,
    constraints: { enforceSocialConstraints: false, minimumReliability: 0.55, budget: 5 },
    modelSettings: { measurementNoise: 0.06 },
    seed: scenario.seed
  }, 4, { minimumSeparation: true, beamWidth: 2, profileKeys: ["balanced"], exactPoolSize: 7, exactSelectionCount: 3 });
  const bundle = buildCurrentWorkspacePaperBundle({ scenario, result, activeProfile: "balanced" });
  assert.equal(bundle.format, "lumos-heat-paper-suite-v1");
  assert.equal(bundle.cases.length, 1);
  assert.ok(bundle.checksum.length >= 8);
  const rows = paperSuiteRows(bundle);
  assert.ok(rows.some((row) => row.table === "benchmark"));
  assert.match(rowsToPaperSuiteCsv(rows), /selected_network/);
  assert.equal(PAPER_CASE_STUDIES.length, 4);
});


test("Heat and Air release presets define valid U.S. extents and domain tours remain ordered", () => {
  assert.deepEqual(Object.keys(HEAT_PRESETS), ["phoenix", "denver", "atlanta", "newyork"]);
  assert.deepEqual(Object.keys(AIR_PRESETS), ["los-angeles-pm25", "houston-ozone", "chicago-no2", "new-york-pm25"]);
  for (const preset of [...Object.values(HEAT_PRESETS), ...Object.values(AIR_PRESETS)]) {
    const box = preset.location.boundingBox;
    assert.ok(box.south < box.north);
    assert.ok(box.west < box.east);
    assert.ok(preset.location.lat >= box.south && preset.location.lat <= box.north);
    assert.ok(preset.location.lng >= box.west && preset.location.lng <= box.east);
  }
  assert.equal(ONBOARDING_STEPS, HEAT_ONBOARDING_STEPS);
  assert.equal(onboardingStepsForDomain("heat"), HEAT_ONBOARDING_STEPS);
  assert.equal(onboardingStepsForDomain("air"), AIR_ONBOARDING_STEPS);
  for (const steps of [HEAT_ONBOARDING_STEPS, AIR_ONBOARDING_STEPS]) {
    assert.equal(new Set(steps.map((step) => step.id)).size, steps.length);
    assert.equal(clampOnboardingStep(-5, steps), 0);
    assert.equal(clampOnboardingStep(999, steps), steps.length - 1);
  }
  assert.deepEqual(AIR_PAPER_CASE_STUDIES.map((entry) => entry.key), Object.keys(AIR_PRESETS));
});

test("v2.0 domain registry exposes complete public adapter contracts", () => {
  assert.deepEqual(PUBLIC_DOMAIN_KEYS, ["heat", "air", "soil", "water"]);
  assert.equal(isPublicDomain("core"), false);
  assert.equal(isPublicDomain("water"), true);
  assert.equal(domainDisplayName("air"), "Air");
  assert.equal(isNationalScenarioType("soil", "live-national-soil"), true);
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const entry = DOMAIN_REGISTRY[domainKey];
    assert.equal(entry.public, true);
    assert.ok(entry.requiredServices.length >= 2);
    assert.ok(entry.scenarioTypes.length >= 2);
    assert.ok(entry.interventionRoles.includes("treatment"));
    assert.ok(entry.interventionRoles.includes("control"));
    for (const capability of REQUIRED_PUBLIC_CAPABILITIES) assert.equal(entry.capabilities[capability], true, `${domainKey}:${capability}`);
  }
});


test("v3 public adapters declare complete planning, operations, and commissioning contracts", () => {
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const planning = DOMAIN_REGISTRY[domainKey].planning;
    assert.ok(planning.unitLabel);
    assert.ok(planning.unitCost > 0);
    assert.ok(planning.minimumUnits >= 1);
    assert.ok(planning.maximumUnits >= planning.minimumUnits);
    assert.ok(planning.saturationUnits > 0);
    assert.ok(planning.unitReliability > 0 && planning.unitReliability <= 1);
    assert.ok(planning.readiness > 0 && planning.readiness <= 1);
    assert.ok(planning.evidenceCalibration.observationTarget > 0);
    assert.ok(planning.evidenceCalibration.priorResidualNeed >= 0 && planning.evidenceCalibration.priorResidualNeed <= 1);
    assert.ok(planning.evidenceCalibration.simulationLearningRate >= 0 && planning.evidenceCalibration.simulationLearningRate <= 1);
    assert.ok(planning.evidenceCalibration.residualResponse >= 0 && planning.evidenceCalibration.residualResponse <= 1);
    assert.ok(planning.robustnessCalibration.costScale > 0);
    assert.ok(planning.robustnessCalibration.failureSensitivity > 0);
    assert.ok(planning.robustnessCalibration.environmentalSensitivity > 0);
    assert.ok(planning.spatialDeployment.minimumSpacingKm > 0);
    assert.ok(planning.spatialDeployment.sharedInfrastructureShare >= 0 && planning.spatialDeployment.sharedInfrastructureShare <= 1);
    assert.ok(planning.spatialDeployment.failureCorrelation >= 0 && planning.spatialDeployment.failureCorrelation <= 1);
    assert.ok(planning.spatialDeployment.minimumSuitability >= 0 && planning.spatialDeployment.minimumSuitability <= 1);
    assert.ok(Array.isArray(planning.spatialDeployment.requiredReviews));
    assert.ok(planning.spatialDeployment.requiredReviews.includes("permission"));
    assert.ok(planning.spatialDeployment.requiredReviews.includes("access"));
    assert.ok(planning.spatialDeployment.requiredReviews.includes("safety"));
    assert.ok(Array.isArray(planning.spatialDeployment.preferredHosts));
    assert.ok(Array.isArray(planning.spatialDeployment.excludedHosts));
    assert.ok(planning.fieldCampaign.inspectionPriority >= 0 && planning.fieldCampaign.inspectionPriority <= 1);
    assert.ok(planning.fieldCampaign.reserveReliabilityFloor >= 0 && planning.fieldCampaign.reserveReliabilityFloor <= 1);
    assert.ok(planning.fieldCampaign.replacementCriticality >= 0 && planning.fieldCampaign.replacementCriticality <= 1);
    assert.ok(planning.fieldCampaign.conditionalOperationalCredit >= 0 && planning.fieldCampaign.conditionalOperationalCredit <= 1);
    assert.ok(planning.fieldCampaign.outcomeReliabilityFloor >= 0 && planning.fieldCampaign.outcomeReliabilityFloor <= 1);
    assert.ok(planning.commissioning.assetClass);
    assert.equal(typeof planning.commissioning.calibrationRequired, "boolean");
    assert.equal(typeof planning.commissioning.permitRequired, "boolean");
    assert.equal(typeof planning.commissioning.chainOfCustodyRequired, "boolean");
    assert.ok(planning.commissioning.minimumUptime >= 0 && planning.commissioning.minimumUptime <= 1);
    assert.ok(planning.commissioning.minimumDataCompleteness >= 0 && planning.commissioning.minimumDataCompleteness <= 1);
    assert.ok(planning.commissioning.preventiveMaintenanceDays > 0);
    assert.ok(planning.commissioning.commissioningCost >= 0);
    assert.ok(planning.commissioning.annualMaintenanceCost >= 0);
    assert.ok(planning.commissioning.replacementReliabilityFloor >= 0 && planning.commissioning.replacementReliabilityFloor <= 1);
    for (const dimension of ["information", "exposure", "equity", "ecology", "intervention"]) {
      assert.ok(planning.dimensionScales[dimension] > 0);
      assert.ok(planning.dimensionPotential[dimension] > 0 && planning.dimensionPotential[dimension] <= 1);
    }
  }
});

test("shared-host pool is deterministic, geographically bounded, and field-verification explicit", () => {
  const config = normalizeSpatialDeploymentConfig(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG);
  const first = buildSharedHostPool(config);
  const second = buildSharedHostPool(config);
  assert.deepEqual(first, second);
  assert.equal(first.length, config.hostCount);
  assert.ok(first.every((host) => host.lng >= config.bounds.west && host.lng <= config.bounds.east));
  assert.ok(first.every((host) => host.lat >= config.bounds.south && host.lat <= config.bounds.north));
  assert.ok(first.every((host) => host.requiresFieldVerification && host.permissionStatus === "unverified"));
  assert.ok(first.every((host) => PUBLIC_DOMAIN_KEYS.every((domainKey) => Number.isFinite(host.domainSuitability[domainKey]))));
});

test("spatial deployment produces deterministic complete cross-domain portfolios", () => {
  const first = planSpatialDeployment(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG);
  const second = planSpatialDeployment(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG);
  assert.equal(first.ready, true);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.portfolio.length, 5);
  assert.ok(first.portfolio.every((plan) => plan.complete));
  assert.ok(first.portfolio.every((plan) => plan.metrics.assignedUnits === 42));
  assert.ok(first.portfolio.every((plan) => plan.metrics.physicalHostCount <= plan.metrics.assignedUnits));
  assert.ok(first.portfolio.some((plan) => plan.metrics.sharedHostCount > 0));
  assert.ok(first.portfolio.some((plan) => plan.paretoOptimal));
});

test("shared-host deployment reports savings without hiding correlated-failure risk", () => {
  const result = planSpatialDeployment(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG);
  const savings = result.portfolio.find((plan) => plan.profileKey === "savings");
  const coverage = result.portfolio.find((plan) => plan.profileKey === "coverage");
  assert.ok(savings.metrics.savings > 0);
  assert.ok(savings.metrics.finalCost < savings.metrics.baseCost);
  assert.ok(savings.metrics.sharedHostCount > 0);
  assert.ok(savings.metrics.correlatedFailureRisk >= 0 && savings.metrics.correlatedFailureRisk <= 1);
  assert.ok(coverage.metrics.meanCoverage >= savings.metrics.meanCoverage - 0.05);
  assert.ok(savings.sites.every((site) => site.requiresFieldVerification && site.permissionStatus === "unverified"));
});

test("spatial deployment exports tidy site-by-domain records", () => {
  const result = planSpatialDeployment(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG);
  const rows = spatialDeploymentRows(result);
  assert.equal(rows.length, result.portfolio.reduce((sum, plan) => sum + plan.metrics.assignedUnits, 0));
  const csv = rowsToSpatialDeploymentCsv(rows);
  assert.match(csv, /field_verification_required/);
  assert.match(csv, /colocated_domains/);
  assert.match(csv, /total_savings_usd/);
  assert.match(csv, /coordinated/);
});

test("host inventory CSV and JSON imports preserve field-review evidence", () => {
  const csv = hostInventoryTemplateCsv();
  const fromCsv = parseHostInventoryText(csv, { sourceName: "template.csv" });
  const fromJson = parseHostInventoryText(JSON.stringify(fromCsv.records), { sourceName: "template.json", format: "json" });
  assert.equal(fromCsv.records.length, 2);
  assert.equal(fromJson.records.length, 2);
  assert.equal(fromCsv.records[0].reviewStatus, "verified");
  assert.equal(fromCsv.records[1].reviewStatus, "conditional");
  assert.equal(fromCsv.records[0].permissionStatus, "verified");
  assert.ok(fromCsv.records.every((record) => Array.isArray(record.eligibleDomains)));
  assert.match(rowsToHostInventoryCsv(hostInventoryRows(fromCsv)), /permission_status/);
  assert.match(rowsToHostInventoryCsv(hostInventoryRows(fromCsv)), /inventory_checksum/);
});

test("field-review policies filter imported inventories without inventing verification", () => {
  const inventory = createIllustrativeHostInventory(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds);
  assert.equal(inventory.summary.total, 48);
  assert.equal(inventory.summary.byStatus.infeasible, 3);
  const reviewed = planSpatialDeployment({
    ...DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
    hostSource: "inventory",
    fieldReviewPolicy: "verified-or-conditional",
    hostInventory: inventory.records
  });
  const verifiedOnly = planSpatialDeployment({
    ...DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
    hostSource: "inventory",
    fieldReviewPolicy: "verified-only",
    hostInventory: inventory.records
  });
  assert.ok(reviewed.portfolio.every((plan) => plan.complete));
  assert.ok(verifiedOnly.portfolio.every((plan) => !plan.complete));
  assert.ok(reviewed.portfolio.every((plan) => plan.sites.every((site) => site.reviewStatus !== "infeasible")));
  assert.ok(reviewed.portfolio.every((plan) => plan.metrics.verifiedAssignmentRate < 1));
  assert.equal(reviewed.hostSource, "inventory");
  assert.equal(reviewed.fieldReviewPolicy, "verified-or-conditional");
});

test("hybrid host planning retains imported provenance and controlled fallback labels", () => {
  const inventory = createIllustrativeHostInventory(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds);
  const result = planSpatialDeployment({
    ...DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
    hostSource: "hybrid",
    fieldReviewPolicy: "all-not-denied",
    hostInventory: inventory.records
  });
  assert.equal(result.ready, true);
  assert.ok(result.hostPoolCount > inventory.records.length);
  assert.ok(result.hostReviewSummary.byStatus.verified > 0);
  assert.ok(result.hostReviewSummary.byStatus.unresolved > 0);
  const rows = spatialDeploymentRows(result);
  assert.match(rowsToSpatialDeploymentCsv(rows), /review_status/);
  assert.match(rowsToSpatialDeploymentCsv(rows), /verification_date/);
});

function fieldCampaignFixture(overrides = {}) {
  const inventory = createIllustrativeHostInventory(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds);
  const deployment = planSpatialDeployment({
    ...DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
    hostSource: "inventory",
    fieldReviewPolicy: "verified-or-conditional",
    hostInventory: inventory.records
  });
  return planFieldCampaign({
    ...DEFAULT_FIELD_CAMPAIGN_CONFIG,
    deploymentResult: deployment,
    deploymentProfileKey: "coordinated",
    ...overrides
  });
}

test("field campaign creates deterministic phased inspection and reserve portfolios", () => {
  const first = fieldCampaignFixture();
  const second = fieldCampaignFixture();
  assert.equal(first.ready, true);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.portfolio.length, 4);
  assert.ok(first.portfolio.every((campaign) => campaign.metrics.scheduledInspections <= 24));
  assert.ok(first.portfolio.every((campaign) => campaign.metrics.inspectionPhasesUsed <= 3));
  assert.ok(first.portfolio.every((campaign) => campaign.metrics.reserveCount > 0));
  assert.ok(first.portfolio.some((campaign) => campaign.paretoOptimal));
});

test("field campaign reports rejection replacement and residual gaps honestly", () => {
  const result = fieldCampaignFixture({ responseScenario: "conservative", reserveRatio: 0.25, inspectionCapacityPerPhase: 5, maximumPhases: 2 });
  for (const campaign of result.portfolio) {
    assert.ok(campaign.metrics.rejectedHosts >= 0);
    assert.ok(campaign.metrics.recoveredAssignments <= campaign.metrics.replacementDemand);
    assert.equal(campaign.complete, campaign.metrics.unresolvedAssignments === 0);
    assert.ok(campaign.metrics.operationalResilience >= 0 && campaign.metrics.operationalResilience <= 1);
  }
  assert.ok(result.portfolio.some((campaign) => campaign.metrics.unresolvedAssignments > 0));
});

test("field campaign reserve candidates honor domain reliability floors", () => {
  const result = fieldCampaignFixture({ reserveRatio: 0.75 });
  for (const campaign of result.portfolio) {
    for (const reserve of campaign.reserves) {
      assert.ok(reserve.reliability >= DOMAIN_REGISTRY[reserve.domainKey].planning.fieldCampaign.reserveReliabilityFloor - 1e-12);
      assert.ok(reserve.suitability >= DOMAIN_REGISTRY[reserve.domainKey].planning.spatialDeployment.minimumSuitability - 1e-12);
    }
  }
});

test("field campaign exports tidy inspection reserve and replacement records", () => {
  const result = fieldCampaignFixture();
  const rows = fieldCampaignRows(result);
  assert.ok(rows.some((row) => row.record_type === "inspection"));
  assert.ok(rows.some((row) => row.record_type === "reserve"));
  const csv = rowsToFieldCampaignCsv(rows);
  assert.match(csv, /failure_probability/);
  assert.match(csv, /replacement_host_id/);
  assert.match(csv, /campaign_cost/);
});

function liveCampaignFixture() {
  const inventory = createIllustrativeHostInventory(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds);
  const deployment = planSpatialDeployment({
    ...DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
    hostSource: "inventory",
    fieldReviewPolicy: "verified-or-conditional",
    hostInventory: inventory.records
  });
  const campaign = planFieldCampaign({
    ...DEFAULT_FIELD_CAMPAIGN_CONFIG,
    deploymentResult: deployment,
    deploymentProfileKey: "coordinated"
  });
  const outcomes = createIllustrativeCampaignOutcomes(campaign, "balanced");
  const tracking = trackLiveCampaign({
    deploymentResult: deployment,
    campaignResult: campaign,
    campaignProfileKey: "balanced",
    outcomeBundle: outcomes,
    completedPhase: outcomes.summary.maximumPhase
  });
  return { deployment, campaign, outcomes, tracking };
}

test("live campaign outcome imports preserve append-only deterministic event history", () => {
  const { campaign } = liveCampaignFixture();
  const csv = campaignOutcomeTemplateCsv().replace("reviewed-host-01", campaign.portfolio[0].inspections[0].hostId);
  const first = parseCampaignOutcomeText(csv, { campaignResult: campaign, campaignProfileKey: "balanced", sourceName: "test.csv" });
  const second = parseCampaignOutcomeText(csv, { campaignResult: campaign, campaignProfileKey: "balanced", sourceName: "test.csv" });
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].previousHash, "00000000");
  assert.match(first.events[0].eventHash, /^[0-9a-f]{8}$/);
});

test("live campaign recomputes phase snapshots and activates reviewed reserves", () => {
  const { tracking } = liveCampaignFixture();
  assert.equal(tracking.ready, true);
  assert.ok(tracking.phaseSnapshots.length >= 2);
  assert.equal(tracking.currentSnapshot.metrics.operationalAssignments, tracking.currentSnapshot.metrics.totalAssignments);
  assert.ok(tracking.currentSnapshot.metrics.replacementAssignments > 0);
  assert.equal(tracking.currentSnapshot.metrics.unresolvedAssignments, 0);
  assert.ok(tracking.currentSnapshot.operationalSites.length > 0);
});

test("live campaign preserves rejected events while later events supersede operational status", () => {
  const { deployment, campaign } = liveCampaignFixture();
  const hostId = campaign.portfolio.find((entry) => entry.profileKey === "balanced").inspections.find((entry) => entry.scheduled).hostId;
  const records = [
    { event_id: "evt-1", host_id: hostId, phase: 1, outcome: "rejected", occurred_at: "2026-07-25T10:00:00Z" },
    { event_id: "evt-2", host_id: hostId, phase: 2, outcome: "accepted", occurred_at: "2026-07-26T10:00:00Z", supersedes_event_id: "evt-1" }
  ];
  const bundle = parseCampaignOutcomeText(JSON.stringify(records), { campaignResult: campaign, campaignProfileKey: "balanced", sourceName: "correction.json" });
  const result = trackLiveCampaign({ deploymentResult: deployment, campaignResult: campaign, campaignProfileKey: "balanced", outcomeBundle: bundle, completedPhase: 2 });
  assert.equal(result.eventHistory.length, 2);
  assert.ok(result.currentSnapshot.assignments.filter((entry) => entry.primaryHostId === hostId).every((entry) => entry.operationalState === "active-primary"));
});

test("live campaign exports event, assignment, and phase-snapshot evidence", () => {
  const { tracking } = liveCampaignFixture();
  const rows = campaignTrackingRows(tracking);
  assert.ok(rows.some((row) => row.record_type === "event"));
  assert.ok(rows.some((row) => row.record_type === "assignment"));
  assert.ok(rows.some((row) => row.record_type === "phase_snapshot"));
  const csv = rowsToCampaignTrackingCsv(rows);
  assert.match(csv, /event_hash/);
  assert.match(csv, /operational_state/);
  assert.match(csv, /current_host_id/);
});

function commissioningFixture(overrides = {}) {
  const { campaign, tracking } = liveCampaignFixture();
  const eventBundle = createIllustrativeCommissioningEvents(tracking);
  const result = runCommissioningOperations({
    ...DEFAULT_COMMISSIONING_OPERATIONS_CONFIG,
    trackingResult: tracking,
    campaignResult: campaign,
    eventBundle,
    ...overrides
  });
  return { campaign, tracking, eventBundle, result };
}

test("commissioning event imports preserve a deterministic append-only hash chain", () => {
  const { tracking } = liveCampaignFixture();
  const assignment = tracking.currentSnapshot.assignments.find((entry) => entry.currentHostId);
  const csv = commissioningEventTemplateCsv()
    .replace("reviewed-host-01:heat:reference", assignment.assignmentId)
    .replace(/reviewed-host-01/g, assignment.currentHostId)
    .replace(",heat,", `,${assignment.domainKey},`);
  const first = parseCommissioningEventText(csv, { trackingResult: tracking, sourceName: "commissioning.csv" });
  const second = parseCommissioningEventText(csv, { trackingResult: tracking, sourceName: "commissioning.csv" });
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].previousHash, "00000000");
  assert.match(first.events[0].eventHash, /^[0-9a-f]{8}$/);
  const rebuilt = createCommissioningEventBundle(first.events, { trackingResult: tracking, sourceName: "rebuilt" });
  assert.equal(rebuilt.events.length, 1);
});

test("commissioning operations reconstruct readiness, tickets, and protected replacements", () => {
  const { result } = commissioningFixture();
  assert.equal(result.ready, true);
  assert.equal(result.metrics.totalAssignments, 42);
  assert.equal(result.metrics.offlineAssignments, 3);
  assert.equal(result.metrics.protectedFailures, 3);
  assert.equal(result.metrics.unresolvedFailures, 0);
  assert.equal(result.protected, true);
  assert.ok(result.metrics.commissionedAssignments > 0);
  assert.ok(result.metrics.openTickets > 0);
  assert.ok(result.replacements.every((entry) => entry.status === "replacement-ready"));
});

test("commissioning operations export event, assignment, and replacement evidence", () => {
  const { result } = commissioningFixture();
  const rows = commissioningOperationsRows(result);
  assert.ok(rows.some((row) => row.record_type === "event"));
  assert.ok(rows.some((row) => row.record_type === "assignment"));
  assert.ok(rows.some((row) => row.record_type === "replacement"));
  const csv = rowsToCommissioningOperationsCsv(rows);
  assert.match(csv, /previous_hash/);
  assert.match(csv, /replacement_host_id/);
  assert.match(csv, /commissioned/);
});

test("v3 public launch readiness audit is deterministic and exportable", async () => {
  const { readFile } = await import("node:fs/promises");
  const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url), "utf8"));
  const domainAudit = runCrossDomainConsistencyAudit({ releaseMetadata: release });
  const { result: commissioningResult } = commissioningFixture();
  const first = runPublicLaunchReadiness({
    releaseMetadata: release,
    domainAudit,
    commissioningResult,
    runtimeContract: {}
  });
  const second = runPublicLaunchReadiness({
    releaseMetadata: release,
    domainAudit,
    commissioningResult,
    runtimeContract: {}
  });
  assert.equal(first.ready, true);
  assert.equal(first.counts.fail, 0);
  assert.equal(first.checksum, second.checksum);
  assert.ok(first.checks.length >= 19);
  const csv = rowsToPublicReadinessCsv(publicReadinessRows(first));
  assert.match(csv, /release metadata identity/i);
  assert.match(csv, /commissioning and maintenance evidence/i);
});

test("cross-domain allocator produces a deterministic feasible six-profile portfolio", () => {
  const first = allocateCrossDomainBudget(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG);
  const second = allocateCrossDomainBudget(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG);
  assert.equal(first.ready, true);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.portfolio.length, 6);
  assert.ok(first.evaluatedAllocations > 1000);
  for (const allocation of first.portfolio) {
    assert.ok(allocation.metrics.committedCost <= first.allocatableBudget);
    assert.ok(Number.isFinite(allocation.score));
    for (const program of allocation.metrics.programs) {
      const config = first.config.domains[program.domainKey];
      assert.ok(program.units >= config.minimumUnits);
      assert.ok(program.units <= config.maximumUnits);
    }
  }
});

test("cross-domain minimum-program rule reports an exact budget shortfall", () => {
  const result = allocateCrossDomainBudget({ totalBudget: 10000, reserveFraction: 0, requireAllDomains: true });
  assert.equal(result.ready, false);
  assert.ok(result.requiredMinimumCost > result.allocatableBudget);
  assert.equal(result.shortfall, result.requiredMinimumCost - result.allocatableBudget);
  assert.equal(result.portfolio.length, 0);
});

test("cost-efficient allocation retains more budget than the balanced profile", () => {
  const result = allocateCrossDomainBudget(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG);
  const balanced = result.portfolio.find((allocation) => allocation.profileKey === "balanced");
  const cost = result.portfolio.find((allocation) => allocation.profileKey === "cost");
  assert.ok(cost.metrics.committedCost < balanced.metrics.committedCost);
  assert.ok(cost.metrics.uncommitted > balanced.metrics.uncommitted);
  assert.ok(cost.metrics.composite > 0);
});

test("cross-domain program response is monotone and allocation exports tidy rows", () => {
  const config = normalizeCrossDomainBudgetConfig(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG);
  const low = evaluateDomainProgram("air", config.domains.air.minimumUnits, config.domains.air);
  const high = evaluateDomainProgram("air", config.domains.air.minimumUnits + 3, config.domains.air);
  assert.ok(high.composite > low.composite);
  assert.ok(high.cost > low.cost);
  const result = allocateCrossDomainBudget(config);
  const rows = crossDomainAllocationRows(result);
  assert.equal(rows.length, result.portfolio.length * PUBLIC_DOMAIN_KEYS.length);
  const csv = rowsToCrossDomainAllocationCsv(rows);
  assert.match(csv, /portfolio_worst_domain_benefit/);
  assert.match(csv, /balanced/);
});

test("saved workspaces produce deterministic domain evidence records", () => {
  const scenario = generateScenario("air", 2424);
  scenario.domainKey = "air";
  scenario.scenarioType = "live-national-air";
  scenario.cityLabel = "Evidence test area";
  scenario.cells.forEach((cell, index) => {
    cell.uncertainty = 0.25 + 0.5 * ((index % 11) / 10);
    cell.risk = 0.2 + 0.7 * cell.x;
    cell.exposure = 0.2 + 0.7 * cell.y;
    cell.vulnerability = index % 3 === 0 ? 0.8 : 0.35;
  });
  scenario.observations.forEach((observation, index) => {
    observation.reliability = index % 3 === 0 ? 0.82 : 0.95;
  });
  const snapshot = createWorkspaceSnapshot({
    scenario,
    controls: { domainKey: "air", monitorCount: 5 },
    evidence: {
      deployedUnits: 5,
      feasible: true,
      networkMetrics: { information: 0.48, minimumGroupInformation: 0.35, fairnessGap: 0.12, reliability: 0.88 }
    },
    savedAt: 1000,
    name: "Air evidence"
  });
  const first = createWorkspaceEvidenceRecord(snapshot);
  const second = createWorkspaceEvidenceRecord(snapshot);
  assert.equal(first.domainKey, "air");
  assert.equal(first.deployedUnits, 5);
  assert.equal(first.checksum, second.checksum);
  assert.ok(first.evidenceStrength > 0 && first.evidenceStrength <= 1);
  assert.ok(first.residualNeed >= 0 && first.residualNeed <= 1);
  assert.ok(first.normalizedYield > 0);
});

test("evidence bundle aggregates all four public domains without inventing missing observations", () => {
  const records = PUBLIC_DOMAIN_KEYS.map((domainKey, index) => {
    const scenario = generateScenario(domainKey, 2500 + index);
    scenario.domainKey = domainKey;
    scenario.scenarioType = domainKey === "heat" ? "live-national" : `live-national-${domainKey}`;
    return createWorkspaceEvidenceRecord(createWorkspaceSnapshot({
      scenario,
      controls: { domainKey, monitorCount: DOMAIN_REGISTRY[domainKey].planning.minimumUnits },
      savedAt: 2000 + index,
      name: `${domainKey} evidence`
    }));
  });
  const bundle = createEvidenceBundle(records, { generatedAt: "2026-07-25T00:00:00.000Z" });
  assert.equal(bundle.recordCount, 4);
  assert.equal(bundle.evidenceDomainCount, 4);
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    assert.equal(bundle.domains[domainKey].recordCount, 1);
    assert.ok(bundle.domains[domainKey].evidenceStrength > 0);
  }
});

test("sequential allocator produces a deterministic six-profile next-round portfolio", () => {
  const evidence = createIllustrativeEvidenceBundle();
  const first = allocateSequentialFundingRound(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG, evidence);
  const second = allocateSequentialFundingRound(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG, evidence);
  assert.equal(first.ready, true);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.portfolio.length, 6);
  assert.ok(first.evaluatedAllocations > 1000);
  assert.ok(first.feasibleAllocations > 0);
  for (const allocation of first.portfolio) {
    assert.ok(allocation.metrics.addedCost <= first.allocatableBudget);
    assert.ok(["feasible", "nearest-infeasible"].includes(allocation.constraintStatus));
    assert.ok(allocation.metrics.programs.every((program) => program.totalUnits >= program.existingUnits));
  }
});

test("sequential evidence calibration increases the marginal signal for unresolved domains", () => {
  const base = createIllustrativeEvidenceBundle();
  const lowRecords = structuredClone(base.records);
  const highRecords = structuredClone(base.records);
  lowRecords.find((record) => record.domainKey === "air").residualNeed = 0.15;
  highRecords.find((record) => record.domainKey === "air").residualNeed = 0.95;
  const low = allocateSequentialFundingRound(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG, createEvidenceBundle(lowRecords));
  const high = allocateSequentialFundingRound(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG, createEvidenceBundle(highRecords));
  const lowAir = low.portfolio.find((allocation) => allocation.profileKey === "balanced").metrics.programs.find((program) => program.domainKey === "air");
  const highAir = high.portfolio.find((allocation) => allocation.profileKey === "balanced").metrics.programs.find((program) => program.domainKey === "air");
  assert.ok(highAir.evidence.marginalMultiplier > lowAir.evidence.marginalMultiplier);
  assert.ok(highAir.evidence.residualNeed > lowAir.evidence.residualNeed);
});

test("sequential minimum-program completion reports an exact round shortfall", () => {
  const domains = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, {
    ...DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG.domains[domainKey],
    existingUnits: 0
  }]));
  const result = allocateSequentialFundingRound({
    ...DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG,
    nextRoundBudget: 1000,
    reserveFraction: 0,
    domains
  }, createEvidenceBundle([]));
  assert.equal(result.ready, false);
  assert.equal(result.shortfall, result.requiredMinimumCost - result.allocatableBudget);
  assert.ok(result.shortfall > 0);
});

test("sequential allocation exports tidy evidence-calibrated rows", () => {
  const result = allocateSequentialFundingRound(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG, createIllustrativeEvidenceBundle());
  const rows = sequentialReallocationRows(result);
  assert.equal(rows.length, result.portfolio.length * PUBLIC_DOMAIN_KEYS.length);
  const csv = rowsToSequentialReallocationCsv(rows);
  assert.match(csv, /evidence_strength/);
  assert.match(csv, /marginal_multiplier/);
  assert.match(csv, /balanced/);
});

test("adaptive program simulation is deterministic across seven complete trajectories", () => {
  const evidence = createIllustrativeEvidenceBundle();
  const first = simulateAdaptiveProgram(DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG, evidence);
  const second = simulateAdaptiveProgram(DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG, evidence);
  assert.equal(first.ready, true);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.trajectories.length, 7);
  assert.equal(first.completeTrajectories, 7);
  assert.ok(first.trajectories.every((trajectory) => trajectory.rounds.length === first.config.rounds));
  assert.ok(first.trajectories.every((trajectory) => trajectory.cumulativeCost <= trajectory.cumulativeBudget));
});

test("multi-round evidence transitions reduce residual need when programs receive funding", () => {
  const evidence = createIllustrativeEvidenceBundle();
  const result = simulateAdaptiveProgram(DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG, evidence);
  const adaptive = result.trajectories.find((trajectory) => trajectory.trajectoryKey === "adaptive");
  const initialNeed = PUBLIC_DOMAIN_KEYS.reduce((sum, domainKey) => sum + evidence.domains[domainKey].residualNeed, 0) / PUBLIC_DOMAIN_KEYS.length;
  assert.ok(adaptive.terminalResidualNeed < initialNeed);
  assert.ok(adaptive.terminalEvidenceStrength > PUBLIC_DOMAIN_KEYS.reduce((sum, domainKey) => sum + evidence.domains[domainKey].evidenceStrength, 0) / PUBLIC_DOMAIN_KEYS.length);
  assert.ok(adaptive.rounds.every((round) => round.ready && round.selectedProfileKey));
});

test("adaptive program simulation exports round-by-domain evidence transitions", () => {
  const result = simulateAdaptiveProgram(DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG, createIllustrativeEvidenceBundle());
  const rows = adaptiveProgramSimulationRows(result);
  assert.equal(rows.length, result.trajectories.length * result.config.rounds * PUBLIC_DOMAIN_KEYS.length);
  const csv = rowsToAdaptiveProgramSimulationCsv(rows);
  assert.match(csv, /terminal_residual_need/);
  assert.match(csv, /evidence_strength_after/);
  assert.match(csv, /adaptive/);
});

let cachedRobustPolicyResult = null;

function robustPolicyFixture() {
  if (!cachedRobustPolicyResult) {
    cachedRobustPolicyResult = evaluateRobustPolicies({
      ...DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG,
      ensembleSize: 16
    }, createIllustrativeEvidenceBundle());
  }
  return cachedRobustPolicyResult;
}

test("robust policy ensemble is deterministic across seeded scenario members", () => {
  const first = robustPolicyFixture();
  const second = evaluateRobustPolicies({
    ...DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG,
    ensembleSize: 16
  }, createIllustrativeEvidenceBundle());
  assert.equal(first.ready, true);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.members.length, 16);
  assert.equal(first.policies.length, 7);
  assert.ok(first.robustPolicyKey);
  assert.ok(first.expectedValuePolicyKey);
  assert.ok(first.minimaxRegretPolicyKey);
  assert.ok(first.mostFeasiblePolicyKey);
});

test("robust ensemble preserves three response anchors and seven policy outcomes per member", () => {
  const result = robustPolicyFixture();
  assert.deepEqual(Object.keys(result.anchorChecksums).sort(), ["central", "conservative", "optimistic"]);
  assert.ok(result.members.every((member) => member.outcomes.length === 7));
  assert.ok(result.members.every((member) => member.responsePosition >= -1 && member.responsePosition <= 1));
});

test("robust policy summaries report downside, feasibility, regret, and stressed cost", () => {
  const result = robustPolicyFixture();
  for (const policy of result.policies) {
    assert.ok(policy.expectedUtility >= 0 && policy.expectedUtility <= 1);
    assert.ok(policy.p10Utility >= 0 && policy.p10Utility <= 1);
    assert.ok(policy.cvar10 >= 0 && policy.cvar10 <= 1);
    assert.ok(policy.feasibilityProbability >= 0 && policy.feasibilityProbability <= 1);
    assert.ok(policy.maximumRegret >= 0 && policy.maximumRegret <= 1);
    assert.ok(policy.p90Cost >= 0);
    assert.ok(Number.isFinite(policy.robustScore));
  }
  assert.ok(result.policies.some((policy) => policy.paretoOptimal));
});

test("robust policy ensemble exports reproducible policy-level evidence", () => {
  const result = robustPolicyFixture();
  const rows = robustPolicyEnsembleRows(result);
  assert.equal(rows.length, result.policies.length);
  const csv = rowsToRobustPolicyEnsembleCsv(rows);
  assert.match(csv, /robust_recommendation/);
  assert.match(csv, /feasibility_probability/);
  assert.match(csv, /maximum_regret/);
  assert.match(csv, /p90_cost_usd/);
});

test("multi-page Unified interface exposes commissioning and full-map controls", async () => {
  const { readFile } = await import("node:fs/promises");
  const shell = await readFile(new URL("../workspace-shell.html", import.meta.url), "utf8");
  const entry = await readFile(new URL("../unified.html", import.meta.url), "utf8");
  const html = `${entry}\n${shell}`;
  assert.match(html, /id="unifiedBudgetSection"/);
  assert.match(html, /id="crossDomainBudgetControls"/);
  assert.match(html, /id="crossDomainBudgetResultSection"/);
  assert.match(html, /id="crossDomainBudgetPortfolio"/);
  assert.match(html, /Costs and minimum programs are editable assumptions, not vendor quotes/);
  assert.match(html, /id="sequentialReallocationSection"/);
  assert.match(html, /id="loadSavedEvidenceButton"/);
  assert.match(html, /id="sequentialResultSection"/);
  assert.match(html, /id="sequentialPortfolio"/);
  assert.match(html, /id="adaptiveSimulationSection"/);
  assert.match(html, /id="runAdaptiveSimulationButton"/);
  assert.match(html, /id="adaptiveSimulationResultSection"/);
  assert.match(html, /id="adaptiveSimulationTrajectory"/);
  assert.match(html, /id="robustPolicySection"/);
  assert.match(html, /id="runRobustPolicyButton"/);
  assert.match(html, /id="robustPolicyResultSection"/);
  assert.match(html, /id="robustPolicyPortfolio"/);
  assert.match(html, /id="spatialDeploymentSection"/);
  assert.match(html, /id="runSpatialDeploymentButton"/);
  assert.match(html, /id="spatialDeploymentResultSection"/);
  assert.match(html, /id="spatialDeploymentPortfolio"/);
  assert.match(html, /id="spatialHostSource"/);
  assert.match(html, /id="spatialFieldReviewPolicy"/);
  assert.match(html, /id="hostInventoryFile"/);
  assert.match(html, /id="useIllustrativeHostInventoryButton"/);
  assert.match(html, /Imported review fields remain user-supplied evidence/);
  assert.match(html, /id="fieldCampaignSection"/);
  assert.match(html, /id="runFieldCampaignButton"/);
  assert.match(html, /id="fieldCampaignResultSection"/);
  assert.match(html, /id="fieldCampaignPortfolio"/);
  assert.match(html, /id="campaignTrackingSection"/);
  assert.match(html, /id="campaignOutcomeFile"/);
  assert.match(html, /id="runCampaignTrackingButton"/);
  assert.match(html, /id="campaignTrackingResultSection"/);
  assert.match(html, /id="campaignTrackingHistoryBody"/);
  assert.match(html, /id="toggleHeader"/);
  assert.match(html, /aria-controls="appHeader"/);
  assert.match(html, /class="skip-link" href="#map"/);
  assert.match(html, /id="focusMapButton"/);
  assert.match(html, /id="commissioningSection"/);
  assert.match(html, /id="commissioningEventFile"/);
  assert.match(html, /id="runCommissioningButton"/);
  assert.match(html, /id="commissioningResultSection"/);
  assert.doesNotMatch(html, /id="publicReadinessSection"/);
  assert.doesNotMatch(html, /id="publicReadinessResultSection"/);
  assert.match(html, /id="homePage"/);
  assert.match(html, /id="documentationDialog"/);
  assert.match(html, /Full creation including ideation, website, code, and interface by Hudson Dong/);
  assert.match(html, /The LUMOS Team/);
  assert.match(entry, /href="about.html"/);
  assert.match(entry, /href="documentation.html#quickstart"/);
  assert.match(entry, /href="research.html#paper"/);
  assert.match(entry, /href="contact.html"/);
  assert.match(entry, /data-lumos-domain="core"/);
  assert.match(entry, /LUMOS—Unified/);
});

test("cross-domain consistency audit passes and exports reproducible tidy rows", () => {
  const releaseMetadata = {
    version: "3.3.0",
    status: "stable-public-v3",
    supportedDomains: ["heat", "air", "soil", "water"],
    supportedWorkspaces: [
      "unified-cross-domain-audit",
      "unified-cross-domain-budget-allocation",
      "unified-sequential-evidence-reallocation",
      "unified-multi-round-adaptive-simulation",
      "unified-trajectory-uncertainty-ensemble",
      "unified-spatially-coupled-deployment",
      "unified-verified-host-field-review",
      "unified-field-campaign-operations",
      "unified-live-campaign-tracking",
      "unified-commissioning-maintenance-operations"
    ],
    architecture: {
      budgetAllocator: "js/model/unified/budget-allocation.js",
      sequentialReallocator: "js/model/unified/sequential-reallocation.js",
      adaptiveProgramSimulator: "js/model/unified/adaptive-program-simulation.js",
      robustPolicyEvaluator: "js/model/unified/robust-policy-ensemble.js",
      spatialDeploymentPlanner: "js/model/unified/spatial-deployment.js",
      hostInventoryReviewer: "js/model/unified/host-inventory.js",
      fieldCampaignPlanner: "js/model/unified/field-campaign.js",
      liveCampaignTracker: "js/model/unified/campaign-tracking.js",
      commissioningOperations: "js/model/unified/commissioning-operations.js",
      publicReadinessAuditor: "js/release/public-readiness.js"
    }
  };
  const first = runCrossDomainConsistencyAudit({ releaseMetadata });
  const second = runCrossDomainConsistencyAudit({ releaseMetadata });
  assert.equal(first.ready, true);
  assert.equal(first.counts.fail, 0);
  assert.ok(first.counts.pass >= 86);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.domains.length, 4);
  assert.ok(first.domains.every((domain) => domain.ready));
  const rows = crossDomainAuditRows(first);
  assert.equal(rows.length, first.checks.length);
  assert.match(rowsToCrossDomainAuditCsv(rows), /shared-domain-parity/);
});

test("Unified onboarding explains the adapter audit before domain selection", () => {
  assert.equal(onboardingStepsForDomain("core"), UNIFIED_ONBOARDING_STEPS);
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#runCrossDomainAuditButton"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#unifiedBudgetSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#crossDomainBudgetResultSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#sequentialReallocationSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#commissioningSection"));
  assert.ok(!UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#publicReadinessSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#focusMapButton"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#sequentialResultSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#robustPolicySection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#robustPolicyResultSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#spatialDeploymentSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#spatialDeploymentResultSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#fieldCampaignSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#fieldCampaignResultSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#campaignTrackingSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === "#campaignTrackingResultSection"));
  assert.ok(UNIFIED_ONBOARDING_STEPS.some((step) => step.target === ".workspace-page-header"));
});

test("release health check validates local capabilities without remote access", async () => {
  const values = new Map();
  const windowObject = {
    isSecureContext: true,
    maplibregl: {},
    localStorage: {
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  };
  const documentObject = {
    createElement: () => ({
      getContext: () => ({}),
      toDataURL: () => "data:image/png;base64,"
    })
  };
  const checks = checkLocalCapabilities({ windowObject, documentObject, navigatorObject: { onLine: true } });
  assert.equal(checks.every((check) => check.status === "pass"), true);
  const summary = await runReleaseHealthCheck({
    includeRemote: false,
    windowObject,
    documentObject,
    navigatorObject: { onLine: true }
  });
  assert.equal(summary.ready, true);
  assert.equal(summary.counts.pass, checks.length);
});

test("release health check treats optional remote failures as warnings", async () => {
  const windowObject = {
    isSecureContext: true,
    maplibregl: {},
    localStorage: { setItem() {}, removeItem() {} }
  };
  const documentObject = { createElement: () => ({ getContext: () => ({}), toDataURL: () => "data:" }) };
  const fetchImpl = async (url) => {
    if (String(url).includes("enviroatlas") || String(url).includes("openfreemap")) throw new Error("optional unavailable");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const summary = await runReleaseHealthCheck({
    fetchImpl,
    timeoutMs: 100,
    windowObject,
    documentObject,
    navigatorObject: { onLine: true }
  });
  assert.equal(summary.ready, true);
  assert.equal(summary.counts.fail, 0);
  assert.equal(summary.counts.warn, 2);
});



test("Air system health treats the atmospheric-composition source as required", async () => {
  const windowObject = {
    isSecureContext: true,
    maplibregl: {},
    localStorage: { setItem() {}, removeItem() {} }
  };
  const documentObject = { createElement: () => ({ getContext: () => ({}), toDataURL: () => "data:" }) };
  const fetchImpl = async (url) => {
    if (String(url).includes("air-quality-api.open-meteo.com")) throw new Error("air model unavailable");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const air = await runReleaseHealthCheck({
    fetchImpl,
    timeoutMs: 100,
    domainKey: "air",
    windowObject,
    documentObject,
    navigatorObject: { onLine: true }
  });
  const heat = await runReleaseHealthCheck({
    fetchImpl,
    timeoutMs: 100,
    domainKey: "heat",
    windowObject,
    documentObject,
    navigatorObject: { onLine: true }
  });
  assert.equal(air.ready, false);
  assert.equal(air.checks.find((check) => check.id === "air-quality").status, "fail");
  assert.equal(heat.ready, true);
  assert.equal(heat.checks.find((check) => check.id === "air-quality").status, "warn");
});

test("Unified system health requires every service needed by a public adapter", async () => {
  const windowObject = {
    isSecureContext: true,
    maplibregl: {},
    localStorage: { setItem() {}, removeItem() {} }
  };
  const documentObject = { createElement: () => ({ getContext: () => ({}), toDataURL: () => "data:" }) };
  const fetchImpl = async (url) => {
    if (String(url).includes("sdmdataaccess")) throw new Error("soil service unavailable");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const unified = await runReleaseHealthCheck({ fetchImpl, timeoutMs: 100, domainKey: "core", windowObject, documentObject, navigatorObject: { onLine: true } });
  const heat = await runReleaseHealthCheck({ fetchImpl, timeoutMs: 100, domainKey: "heat", windowObject, documentObject, navigatorObject: { onLine: true } });
  assert.equal(unified.ready, false);
  assert.equal(unified.checks.find((check) => check.id === "soil-data").status, "fail");
  assert.equal(heat.ready, true);
  assert.equal(heat.checks.find((check) => check.id === "soil-data").status, "warn");
});

test("desktop workspace fills the viewport above a compact footer", async () => {
  const { readFile } = await import("node:fs/promises");
  const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
  assert.match(styles, /@media \(min-width: 1181px\)[\s\S]*?body \{[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) 68px;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.control-panel,[\s\S]*?\.results-panel \{[\s\S]*?height: 100%;[\s\S]*?max-height: none;/);
  assert.match(styles, /\.map-shell \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(styles, /\.app-footer \{[\s\S]*?height: 68px;[\s\S]*?max-height: 68px;/);
  assert.match(styles, /body\.header-collapsed \.app-header \{[\s\S]*?height: 0;[\s\S]*?pointer-events: none;/);
  assert.match(styles, /body\.header-collapsed \.header-collapse-toggle/);
});

test("official motion Home preserves the editorial stage without a duplicate compatibility route", async () => {
  const { access, readFile } = await import("node:fs/promises");
  const standard = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const immersive = await readFile(new URL("../home-3d.html", import.meta.url), "utf8");
  await assert.rejects(access(new URL("../home-spiral.html", import.meta.url)));
  const styles = await readFile(new URL("../css/home-spiral.css", import.meta.url), "utf8");
  const script = await readFile(new URL("../js/home-spiral.js", import.meta.url), "utf8");
  assert.doesNotMatch(standard, /href="home-spiral\.html"/);
  assert.doesNotMatch(immersive, /href="home-spiral\.html"/);
  assert.match(standard, /name="robots" content="index,follow"/);
  assert.match(standard, /id="spiralSequence"/);
  assert.match(standard, /id="spiralOrbit"/);
  assert.match(standard, /id="spiralContent"/);
  assert.match(standard, /id="spiralParticleCanvas"/);
  assert.match(standard, /class="motion-core"/);
  assert.match(standard, /class="motion-blueprint-grid"/);
  assert.match(standard, /id="motionTypingWord"/);
  assert.doesNotMatch(standard, /class="motion-film-orbit"/);
  assert.doesNotMatch(standard, /id="motionGhostOrbit"/);
  assert.doesNotMatch(standard, /id="motionGhostLabel"/);
  assert.match(standard, /data-spiral-title="UNIFIED"/);
  assert.match(standard, /id="spiralCounter">01 \/ 06/);
  assert.match(standard, /class="domain-glyph"/);
  assert.match(standard, /Social Bayesian design/);
  assert.doesNotMatch(standard, /id="spiralRestartButton"/);
  assert.doesNotMatch(standard, />Skip motion</);
  assert.match(standard, /data-spiral-title="HEAT"/);
  assert.match(standard, /data-spiral-title="AIR"/);
  assert.match(standard, /data-spiral-title="WATER"/);
  assert.match(standard, /data-spiral-title="SOIL"/);
  assert.match(standard, /Choose the decision scale that matches your work/);
  assert.match(standard, /Move from uncertainty to a maintained operational network/);
  assert.match(standard, /Every recommendation carries its evidence and its limits/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /transform-style:\s*preserve-3d/);
  assert.match(styles, /motion-display-word/);
  assert.match(styles, /motion-plane-stack/);
  assert.doesNotMatch(styles, /motion-ghost-orbit/);
  assert.match(styles, /margin-top:\s*-100vh/);
  assert.match(script, /scrollProgress\(\)/);
  assert.match(script, /refreshScrollMetrics/);
  assert.doesNotMatch(script, /cardVisibility/);
  assert.match(script, /const SCENE_CENTERS = \[0, 0\.145, 0\.29, 0\.435, 0\.58, 0\.725\]/);
  assert.match(script, /CONTENT_REVEAL_START/);
  assert.match(script, /TYPING_WORDS/);
  assert.doesNotMatch(script, /renderGhostOrbit/);
  assert.doesNotMatch(script, /renderFilmOrbit/);
  assert.match(script, /const SNAP_RADIUS = 0\.052/);
  assert.match(script, /const SNAP_SETTLE_DELAY = 34/);
  assert.match(script, /const SNAP_DURATION = 230/);
  assert.match(script, /function magnetizedProgress\(progress\)/);
  assert.match(script, /function settleSceneSnap\(\)/);
  assert.match(script, /magnetizedProgress/);
  assert.match(script, /scheduleSceneSnap/);
  assert.doesNotMatch(script, /snapZoneIndex/);
  assert.match(script, /scheduleSceneSnap\(\);/);
  assert.doesNotMatch(script, /SNAP_DELAY|snapZoneIndex/);
  assert.doesNotMatch(script, /card\.style\.filter/);
  assert.match(script, /drawParticleField/);
  assert.match(script, /renderedCardIndex/);
  assert.match(script, /setCardCss/);
  assert.match(script, /requestIdleCallback/);
  assert.match(script, /if \(reduced \|\| !stageIntersecting\) return/);
  assert.doesNotMatch(styles, /filter:\s*blur\(132px\)/);
  assert.match(styles, /core-node-glow/);
  assert.match(script, /spiral-reduced/);
  assert.match(standard, /id="homeMobileMenuButton"/);
  assert.match(standard, /id="homePrimaryNavigation"/);
  assert.match(styles, /@media \(max-width: 780px\)/);
  assert.match(styles, /height:\s*100dvh/);
  assert.match(script, /const MOBILE_SCENE_CENTERS = \[0, 0\.135, 0\.27, 0\.405, 0\.54, 0\.675\]/);
  assert.match(script, /mobileLayoutQuery/);
  assert.match(script, /initializeMobileNavigation/);
});

test("v3 release metadata is internally consistent", async () => {
  const { readFile } = await import("node:fs/promises");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(APP_NAME, "LUMOS");
  assert.equal(APP_VERSION, "3.3.0");
  assert.equal(RELEASE_CHANNEL, "stable-public");
  assert.equal(packageJson.version, APP_VERSION);
  assert.equal(packageJson.scripts.verify, "node scripts/run-verification.mjs");
  assert.equal(release.version, APP_VERSION);
  assert.equal(release.status, "stable-public-v3");
  assert.ok(release.supportedDomains.includes("water"));
  assert.ok(release.supportedWorkspaces.includes("unified-cross-domain-budget-allocation"));
  assert.ok(release.supportedWorkspaces.includes("unified-sequential-evidence-reallocation"));
  assert.ok(release.supportedWorkspaces.includes("unified-multi-round-adaptive-simulation"));
  assert.ok(release.supportedWorkspaces.includes("unified-trajectory-uncertainty-ensemble"));
  assert.ok(release.supportedWorkspaces.includes("unified-spatially-coupled-deployment"));
  assert.ok(release.supportedWorkspaces.includes("unified-verified-host-field-review"));
  assert.ok(release.supportedWorkspaces.includes("unified-field-campaign-operations"));
  assert.ok(release.supportedWorkspaces.includes("unified-live-campaign-tracking"));
  assert.ok(release.supportedWorkspaces.includes("unified-commissioning-maintenance-operations"));
  assert.equal(release.architecture.budgetAllocator, "js/model/unified/budget-allocation.js");
  assert.equal(release.architecture.sequentialReallocator, "js/model/unified/sequential-reallocation.js");
  assert.equal(release.architecture.adaptiveProgramSimulator, "js/model/unified/adaptive-program-simulation.js");
  assert.equal(release.architecture.robustPolicyEvaluator, "js/model/unified/robust-policy-ensemble.js");
  assert.equal(release.architecture.spatialDeploymentPlanner, "js/model/unified/spatial-deployment.js");
  assert.equal(release.architecture.hostInventoryReviewer, "js/model/unified/host-inventory.js");
  assert.equal(release.architecture.fieldCampaignPlanner, "js/model/unified/field-campaign.js");
  assert.equal(release.architecture.liveCampaignTracker, "js/model/unified/campaign-tracking.js");
  assert.equal(release.architecture.commissioningOperations, "js/model/unified/commissioning-operations.js");
  assert.equal(release.architecture.publicReadinessAuditor, "js/release/public-readiness.js");
  assert.equal(release.publicRelease.professionalRelease, true);
  assert.equal(release.publicRelease.limitationsAndScope, true);
  assert.equal(release.publicRelease.aboutPage, true);
  assert.equal(release.publicRelease.compatibilityMotionPreview, undefined);
  assert.deepEqual(release.experimentalEntryPoints, ["home-3d.html"]);
  assert.equal(release.publicRelease.embeddedCredentials, false);
  assert.ok(release.publicRelease.accessibility.includes("home-navigation"));
  assert.ok(release.publicRelease.accessibility.includes("in-app-documentation"));
  assert.equal(packageJson.scripts["campaign:field"], "node scripts/run-field-campaign-operations.mjs");
  assert.equal(packageJson.scripts["track:campaign"], "node scripts/run-live-campaign-tracking.mjs");
  assert.equal(packageJson.scripts["commission:operations"], "node scripts/run-commissioning-operations.mjs");
  assert.equal(packageJson.scripts["audit:public"], "node scripts/run-public-launch-readiness.mjs");
  assert.equal(manifest.short_name, "LUMOS");
  assert.equal(manifest.start_url, "./");
});

test("v3 service worker preserves the complete same-origin application shell", async () => {
  const { readFile } = await import("node:fs/promises");
  const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  assert.match(worker, /lumos-v3\.3\.0/);
  assert.match(worker, /\.\/index\.html/);
  assert.match(worker, /\.\/home-3d\.html/);
  assert.match(worker, /\.\/css\/home-3d\.css/);
  assert.match(worker, /\.\/js\/home-3d\.js/);
  assert.doesNotMatch(worker, /\.\/home-spiral\.html/);
  assert.match(worker, /\.\/css\/home-spiral\.css/);
  assert.match(worker, /\.\/js\/home-spiral\.js/);
  assert.match(worker, /\.\/about\.html/);
  assert.match(worker, /\.\/documentation\.html/);
  assert.match(worker, /\.\/research\.html/);
  assert.match(worker, /\.\/contact\.html/);
  assert.match(worker, /\.\/unified\.html/);
  assert.match(worker, /\.\/heat\.html/);
  assert.match(worker, /\.\/air\.html/);
  assert.match(worker, /\.\/soil\.html/);
  assert.match(worker, /\.\/water\.html/);
  assert.match(worker, /\.\/workspace-shell\.html/);
  assert.match(worker, /\.\/js\/workspace-bootstrap\.js/);
  assert.match(worker, /\.\/js\/content-page\.js/);
  assert.match(worker, /\.\/js\/model\/optimizer\.js/);
  assert.match(worker, /\.\/js\/config\/domain-registry\.js/);
  assert.match(worker, /\.\/js\/release\/domain-audit\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/budget-allocation\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/sequential-reallocation\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/adaptive-program-simulation\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/robust-policy-ensemble\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/spatial-deployment\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/host-inventory\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/field-campaign\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/campaign-tracking\.js/);
  assert.match(worker, /\.\/js\/model\/unified\/commissioning-operations\.js/);
  assert.doesNotMatch(worker, /\.\/js\/release\/public-readiness\.js/);
  assert.match(worker, /\.\/js\/release\/documentation\.js/);
  assert.match(worker, /\.\/js\/data\/air\/national\.js/);
  assert.match(worker, /\.\/js\/model\/air\/intervention\.js/);
  assert.match(worker, /\.\/js\/model\/air\/inference\.js/);
  assert.match(worker, /\.\/js\/model\/air\/sensitivity\.js/);
  assert.match(worker, /\.\/js\/model\/air\/paper-runner\.js/);
  assert.match(worker, /\.\/js\/data\/soil\/national\.js/);
  assert.match(worker, /\.\/js\/model\/soil\/intervention\.js/);
  assert.match(worker, /\.\/js\/model\/soil\/inference\.js/);
  assert.match(worker, /\.\/js\/model\/soil\/sensitivity\.js/);
  assert.match(worker, /\.\/js\/model\/soil\/paper-runner\.js/);
  assert.match(worker, /\.\/js\/model\/soil\/evidence-runner\.js/);
  assert.match(worker, /\.\/js\/data\/water\/national\.js/);
  assert.match(worker, /\.\/js\/model\/water\/intervention\.js/);
  assert.match(worker, /\.\/js\/model\/water\/inference\.js/);
  assert.match(worker, /\.\/js\/model\/water\/sensitivity\.js/);
  assert.match(worker, /\.\/js\/model\/water\/paper-runner\.js/);
  assert.match(worker, /\.\/js\/model\/water\/evidence-runner\.js/);
  assert.match(worker, /updateSensitive/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /unpkg\.com/);
  assert.match(worker, /request\.mode === "navigate"/);
});

test("public Home and permanent documentation page keep release metadata out of routine product chrome", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const about = await readFile(new URL("../about.html", import.meta.url), "utf8");
  const documentation = await readFile(new URL("../documentation.html", import.meta.url), "utf8");
  const research = await readFile(new URL("../research.html", import.meta.url), "utf8");
  const contact = await readFile(new URL("../contact.html", import.meta.url), "utf8");
  const contentSource = await readFile(new URL("../js/content-page.js", import.meta.url), "utf8");
  const siteSource = await readFile(new URL("../js/site.js", import.meta.url), "utf8");
  const motionSource = await readFile(new URL("../js/home-spiral.js", import.meta.url), "utf8");
  assert.equal(DEFAULT_DOCUMENTATION_PAGE, "quickstart");
  assert.equal(DOCUMENTATION_ORDER.length, 8);
  assert.ok(DOCUMENTATION_ORDER.every((key) => DOCUMENTATION_PAGES[key]?.title && DOCUMENTATION_PAGES[key]?.html));
  assert.match(DOCUMENTATION_PAGES["release-notes"].html, /3\.3\.0/);
  assert.equal(DOCUMENTATION_PAGES.about.title, "About Us");
  assert.match(DOCUMENTATION_PAGES.about.html, /The LUMOS Team/);
  assert.match(html, /id="homePage"/);
  assert.match(html, /href="unified.html"/);
  assert.match(html, /href="unified.html\?tour=1"/);
  assert.match(html, /id="installAppButton"/);
  assert.match(html, /class="brand-mark"[^>]*lumos-mark\.svg/);
  assert.match(html, /Design environmental monitoring, intervention, planning, optimization, deployment, and evaluation/);
  assert.match(html, /id="spiralIntro"/);
  assert.match(html, /id="spiralPersistentBackdrop"/);
  assert.match(html, /id="spiralPersistentCanvas"/);
  assert.match(html, /class="motion-title-intro-word motion-title-intro-word-depth/);
  assert.match(html, /class="motion-title-intro-shutters"/);
  assert.match(html, /class="motion-title-intro-black"/);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.doesNotMatch(html, /home-spiral-experiment-chip|Motion experiment/);
  assert.match(html, /class="home-install-card[^"]*"/);
  assert.match(html, /id="motionTypingWord"/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.match(html, /family=Orbitron/);
  assert.match(html, /family=Tektur/);
  assert.match(siteSource, /mouseenter/);
  assert.match(siteSource, /mouseleave/);
  assert.match(siteSource, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(html, /class="home-install-mark"[^>]*lumos-mark\.svg/);
  assert.match(html, /LOCALIZED UNIFIED MONITORING OPTIMIZATION SYSTEM/);
  assert.match(html, /class="motion-typing-lockup motion-typing-lockup-hero"/);
  assert.match(html, /class="motion-display-word">LUMOS/);
  assert.match(html, /css\/home-spiral\.css\?build=motion-canvas-official-6/);
  assert.match(html, /js\/home-spiral\.js\?build=motion-canvas-official-6/);
  assert.match(html, /https:\/\/github\.com\/hgd-dev\/lumos/);
  assert.match(html, /mailto:Lumosystem\.team@gmail\.com/);
  assert.match(html, /instagram\.com\/lumos_optimization/);
  assert.match(html, /linkedin\.com\/in\/lumos-team-7786b2425/);
  assert.match(html, /<strong>Unified<\/strong>/);
  assert.match(html, /<strong>Heat<\/strong>/);
  assert.match(motionSource, /TYPING_WORDS/);
  assert.match(motionSource, /"monitoring"[\s\S]*"intervention"[\s\S]*"planning"[\s\S]*"optimization"/);
  assert.match(motionSource, /reducedMotionQuery/);
  assert.match(motionSource, /TITLE_INTRO_DURATION/);
  assert.match(motionSource, /initializeTitleIntro/);
  assert.match(html, /The LUMOS Team/);
  assert.doesNotMatch(html, /and the LUMOS team/);
  assert.match(html, /href="documentation.html#quickstart"/);
  assert.match(html, /href="about.html"/);
  assert.match(html, /href="research.html#methodology"/);
  assert.match(html, /href="contact.html"/);
  assert.match(about, /id="aboutTitle"/);
  assert.match(about, /Hudson Dong/);
  assert.match(about, /The LUMOS Team/);
  assert.match(documentation, /data-content-group="documentation"/);
  assert.match(documentation, /id="infoNavigation"/);
  assert.match(research, /data-content-group="research"/);
  assert.match(contentSource, /Manuscript in preparation/);
  assert.match(contentSource, /replace-with-paper-url/);
  assert.match(contact, /id="contactTitle"/);
  assert.match(contact, /replace-with-feedback-form/);
  assert.doesNotMatch(html, /id="documentationDialog"/);
  assert.match(html, /class="spiral-footer"/);
  assert.doesNotMatch(html, /href="docs\//);
  assert.match(html, /Based on professional research/);
  assert.doesNotMatch(html, /Scientific monitoring design and operations/);
  assert.doesNotMatch(html, /Scientific position/);
  assert.doesNotMatch(html, /Claim boundaries|claim boundaries/);
  assert.doesNotMatch(html, /Launch audit|Public launch readiness/);
});

test("multi-page navigation exposes dedicated Unified, Heat, Air, Soil, and Water entry points", async () => {
  const { readFile } = await import("node:fs/promises");
  const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const shell = await readFile(new URL("../workspace-shell.html", import.meta.url), "utf8");
  const unified = await readFile(new URL("../unified.html", import.meta.url), "utf8");
  const heat = await readFile(new URL("../heat.html", import.meta.url), "utf8");
  const air = await readFile(new URL("../air.html", import.meta.url), "utf8");
  const soil = await readFile(new URL("../soil.html", import.meta.url), "utf8");
  const water = await readFile(new URL("../water.html", import.meta.url), "utf8");
  assert.doesNotMatch(home, />[^<]*v?3\.1\.2[^<]*</i);
  assert.match(home, /href="unified.html"/);
  assert.match(home, /href="heat.html"/);
  assert.match(home, /href="air.html"/);
  assert.match(home, /href="soil.html"/);
  assert.match(home, /href="water.html"/);
  assert.doesNotMatch(home, /class="domain-tabs"/);
  assert.match(unified, /data-lumos-domain="core"/);
  assert.match(heat, /data-lumos-domain="heat"/);
  assert.match(air, /data-lumos-domain="air"/);
  assert.match(soil, /data-lumos-domain="soil"/);
  assert.match(water, /data-lumos-domain="water"/);
  assert.match(shell, /id="unifiedArchitectureSection"/);
  assert.match(shell, /id="crossDomainAuditSection"/);
  assert.match(shell, /id="soilWorkspaceControls"/);
  assert.match(shell, /id="soilLabSampleInput"/);
  assert.match(shell, /id="recalibrateSoilButton"/);
  assert.match(shell, /id="runSoilSensitivityButton"/);
  assert.match(shell, /id="exportSoilPaperButton"/);
  assert.match(shell, /id="soilValidationSection"/);
  assert.match(shell, /id="soilSensitivitySection"/);
  assert.match(shell, /id="soilEvidenceSection"/);
  assert.match(shell, /id="runSoilEvidenceButton"/);
  assert.match(shell, /id="soilQaStatus"/);
  assert.match(shell, /data-preset="fresno-organic-matter"/);
  assert.match(shell, /id="soilInterventionControls"/);
  assert.match(shell, /data-preset="los-angeles-pm25"/);
  assert.match(shell, /id="runAirEvidenceButton"/);
  assert.match(shell, /id="airEvidenceSection"/);
  assert.match(shell, /id="waterWorkspaceControls"/);
  assert.match(shell, /id="waterValidationSection"/);
  assert.match(shell, /id="waterSensitivitySection"/);
  assert.match(shell, /id="waterEvidenceSection"/);
  assert.match(shell, /id="runWaterSensitivityButton"/);
  assert.match(shell, /id="runWaterEvidenceButton"/);
  assert.match(shell, /id="waterInterventionControls"/);
  assert.match(shell, /data-preset="denver-temperature"/);
  assert.match(shell, /id="toggleLocationPanelButton"/);
  assert.match(shell, /id="locationPanelDragHandle"/);
  assert.match(shell, /<option value="positron" selected>Positron<\/option>/);
  assert.match(home, /<summary>Documentation<\/summary>/);
  assert.match(home, /<summary>Research &amp; Process<\/summary>/);
  assert.match(home, /href="about.html"/);
  assert.match(home, /href="contact.html"/);
  assert.doesNotMatch(home, /class="footer-documentation"/);
});


test("USDA SDA tables and soil horizon rows normalize into depth-weighted properties", () => {
  const table = normalizeSdaTable({ Table: [
    ["mukey", "muname", "cokey", "comppct_r", "hzdept_r", "hzdepb_r", "chph1to1h_r", "om_r", "claytotal_r", "awc_r", "ec_r"],
    ["100", "Test loam", "1", "70", "0", "10", "6.0", "4", "20", "0.18", "0.3"],
    ["100", "Test loam", "1", "70", "10", "30", "7.0", "2", "35", "0.12", "0.5"],
    ["100", "Test loam", "2", "30", "0", "20", "6.5", "3", "25", "0.15", "0.4"]
  ]});
  const properties = aggregateSoilRows(table, "0-15").get("100");
  assert.ok(properties.soilPh > 6 && properties.soilPh < 7);
  assert.ok(properties.organicMatter > 2 && properties.organicMatter < 4);
  assert.ok(properties.clayPercent > 20 && properties.clayPercent < 35);
  assert.match(buildSdaPointQuery([{ id: "a", lng: -105, lat: 39.7 }]), /SDA_Get_Mukey/);
  assert.match(buildSdaPropertyQuery(["100"], { top: 0, bottom: 15 }), /chorizon/);
});

test("mapped Soil hosts normalize into field-verification candidate roles", () => {
  const hosts = normalizeSoilHosts({ elements: [
    { type: "node", id: 1, lat: 39.7, lon: -105, tags: { landuse: "brownfield", name: "Former works" } },
    { type: "node", id: 2, lat: 39.71, lon: -104.99, tags: { leisure: "park", name: "City Park" } }
  ] }, { west: -105.1, south: 39.6, east: -104.9, north: 39.8 });
  assert.equal(hosts.length, 2);
  assert.equal(hosts[0].hostType, "Disturbance screening site");
  assert.equal(hosts[1].hostType, "Park sampling site");
  assert.ok(hosts.every((host) => host.requiresFieldVerification));
});

test("national Soil loader builds an optimizable SSURGO survey scenario", async () => {
  const rectangle = { type: "Polygon", coordinates: [[[-105.1,39.6],[-104.9,39.6],[-104.9,39.8],[-105.1,39.8],[-105.1,39.6]]] };
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("tigerWMS_ACS2024")) return new Response(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { GEOID: "08031000100", STATE: "08", COUNTY: "031", TRACT: "000100", NAME: "Test tract", AREALAND: 2000000, CENTLAT: "39.7", CENTLON: "-105.0" }, geometry: rectangle }] }), { status: 200 });
    if (url.includes("api.census.gov")) return new Response(JSON.stringify([
      ["NAME","B01003_001E","B17001_001E","B17001_002E","B01001_003E","B01001_027E","B01001_020E","B01001_021E","B01001_022E","B01001_023E","B01001_024E","B01001_025E","B01001_044E","B01001_045E","B01001_046E","B01001_047E","B01001_048E","B01001_049E","B08201_001E","B08201_002E","state","county","tract"],
      ["Test tract","1000","900","180","30","28","20","15","20","15","10","5","22","16","20","16","11","7","400","80","08","031","000100"]
    ]), { status: 200 });
    if (url.includes("post.rest")) {
      const body = new URLSearchParams(options.body);
      const query = body.get("query") ?? "";
      if (query.includes("point_id")) {
        const ids = [...query.matchAll(/SELECT '([^']+)' AS point_id/g)].map((match) => match[1]);
        return new Response(JSON.stringify({ Table: [["point_id","mukey","muname"], ...ids.map((id) => [id,"100","Test loam"])] }), { status: 200 });
      }
      return new Response(JSON.stringify({ Table: [
        ["mukey","muname","cokey","compname","comppct_r","majcompflag","hzdept_r","hzdepb_r","chph1to1h_r","om_r","claytotal_r","sandtotal_r","silttotal_r","awc_r","ksat_r","ec_r","cec7_r"],
        ["100","Test loam","1","Test","100","Yes","0","20","6.4","3.2","28","45","27","0.16","18","0.4","14"]
      ] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
  const scenario = await loadNationalSoilScenario(
    { west: -105.1, south: 39.6, east: -104.9, north: 39.8 },
    { property: "organic_matter", depth: "0-15", fetchImpl, candidateStrategy: "systematic", label: "Test Soil viewport" }
  );
  assert.equal(scenario.domainKey, "soil");
  assert.equal(scenario.scenarioType, "live-national-soil");
  assert.equal(scenario.model.propertyLabel, SOIL_PROPERTIES.organic_matter.label);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.risk) && Number.isFinite(cell.organicMatter)));
  assert.ok(scenario.candidates.length > 0);
  assert.doesNotThrow(() => validateScenario(scenario));
  const optimized = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: [],
    domain: DOMAINS.soil,
    weights: DOMAINS.soil.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.3,
    constraints: { enforceSocialConstraints: true, fairnessLimit: 0.3, minimumGroupInformation: 0.01, minimumReliability: 0.5, budget: 5 },
    modelSettings: { measurementNoise: 0.06, lengthScaleMultiplier: 1 },
    seed: 15
  }, 4, { beamWidth: 2, profileKeys: ["balanced"], exactPoolSize: 7, exactSelectionCount: 3 });
  assert.ok(optimized.selected.length > 0);
  applyNationalSoilIntervention(scenario, "restoration");
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.interventionBenefit)));
});

test("Soil intervention design allocates treatment and control sample sites", () => {
  const scenario = generateScenario("soil", 915);
  scenario.cells.forEach((cell) => { cell.interventionBenefit = Math.min(1, 0.6 * cell.risk + 0.4 * cell.ecology); });
  const result = designSoilInterventionNetwork(scenario, { count: 9, budget: 12, repeatedMeasurements: 4, residualStd: 0.18 });
  assert.ok(result.selected.length >= 4);
  assert.ok((result.roleCounts.treatment ?? 0) > 0);
  assert.ok((result.roleCounts.control ?? 0) > 0);
  assert.equal(result.effectUnits, "priority-index units");
});

test("Soil onboarding and health checks are domain-aware", async () => {
  assert.ok(SOIL_ONBOARDING_STEPS.length >= 8);
  assert.equal(onboardingStepsForDomain("soil"), SOIL_ONBOARDING_STEPS);
  const health = await runReleaseHealthCheck({ includeRemote: false, domainKey: "soil", windowObject: { localStorage: { setItem(){}, removeItem(){} }, isSecureContext: true }, documentObject: { createElement: () => ({ getContext: () => ({}), toDataURL: () => "data:" }) }, navigatorObject: { onLine: true } });
  assert.equal(health.ready, true);
});

test("GitHub Pages workflow gates deployment on tests, release checks, and build", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run check:release/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});


test("OpenAQ reference locations normalize into GP conditioning observations", () => {
  const observations = normalizeOpenAqLocations({ results: [{
    id: 42,
    isMonitor: true,
    provider: { name: "AirNow" },
    coordinates: { latitude: 39.7, longitude: -105.0 },
    sensors: [{ id: 501, parameter: { id: AIR_POLLUTANTS.pm2_5.openAqParameterId, units: "µg/m³", name: "pm25" } }]
  }] }, { minLng: -105.1, minLat: 39.6, maxLng: -104.9, maxLat: 39.8 }, "pm2_5");
  assert.equal(observations.length, 1);
  assert.equal(observations[0].monitorType, "reference");
  assert.equal(observations[0].provider, "AirNow");
  assert.ok(observations[0].x > 0 && observations[0].x < 1);
});


test("OpenAQ values normalize to canonical micrograms per cubic meter", () => {
  assert.equal(convertOpenAqValue(12.5, "µg/m³", "pm2_5"), 12.5);
  assert.equal(convertOpenAqValue(0.012, "mg/m3", "pm10"), 12);
  assert.ok(Math.abs(convertOpenAqValue(20, "ppb", "nitrogen_dioxide") - 37.63) < 0.1);
  assert.ok(Math.abs(convertOpenAqValue(0.04, "ppm", "ozone") - 78.52) < 0.2);
  assert.equal(convertOpenAqValue(10, "unknown", "pm2_5"), null);
});

test("meteorological wind directions convert to a downwind mathematical transport axis", () => {
  assert.ok(Math.abs(meteorologicalWindToTransportRadians(270)) < 1e-12);
  assert.ok(Math.abs(meteorologicalWindToTransportRadians(180) - Math.PI / 2) < 1e-12);
  const meanDirection = circularMeanTransportRadians([350, 10]);
  assert.ok(Math.abs(Math.cos(meanDirection)) < 0.05);
  assert.ok(Math.sin(meanDirection) < -0.95);
});

test("OpenAQ latest payloads attach compatible values and freshness-aware reliability", () => {
  const location = normalizeOpenAqLocations({ results: [{
    id: 77,
    isMonitor: true,
    coordinates: { latitude: 39.7, longitude: -105.0 },
    sensors: [{ id: 7701, parameter: { id: 2, units: "µg/m³", name: "pm25" } }]
  }] }, { minLng: -105.1, minLat: 39.6, maxLng: -104.9, maxLat: 39.8 }, "pm2_5")[0];
  const observation = normalizeOpenAqLatest({ results: [{
    datetime: { utc: "2026-07-24T18:00:00Z" },
    value: 11.2,
    sensorsId: 7701,
    locationsId: 77
  }] }, location, "pm2_5", Date.parse("2026-07-24T20:00:00Z"));
  assert.equal(observation.observedValue, 11.2);
  assert.equal(observation.sensorId, 7701);
  assert.ok(observation.reliability > 0.9);
});

test("Air inference calibrates wind-aware residuals and produces a locked comparison", () => {
  const observations = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const x = 0.12 + column * 0.24;
      const y = 0.12 + row * 0.24;
      const prior = 9 + 2.2 * x + 0.8 * y;
      const traffic = column / 3;
      const industry = row / 3;
      observations.push({
        id: `air-${row}-${column}`,
        x,
        y,
        observedValue: prior + 2.5 * traffic - 1.2 * industry + Math.sin((x + y) * Math.PI) * 0.5,
        pollutantValue: prior,
        priorPollutantValue: prior,
        trafficIntensity: traffic,
        industrialProximity: industry,
        sourceRisk: 0.55 * traffic + 0.45 * industry,
        downwindSourceRisk: 0.7 * traffic + 0.3 * industry,
        exposure: 0.25 + 0.65 * x,
        vulnerability: 0.2 + 0.7 * y,
        windSpeed: 10,
        uncertainty: 0.6,
        reliability: 0.95,
        sensorNoise: 0.25
      });
    }
  }
  const domain = { ...DOMAINS.air, transportAngle: 0 };
  const validation = crossValidateAir(observations, domain, { lengthScaleMultiplier: 1, measurementNoise: 0.06 }, 4);
  assert.equal(validation.available, true);
  assert.ok(Number.isFinite(validation.model.rmse));
  const calibration = calibrateAirModel(observations, domain, {
    lengthScaleGrid: [0.9, 1.1],
    noiseGrid: [0.05, 0.08],
    transportRegimes: [
      { key: "isotropic", label: "Isotropic", along: 1, across: 1 },
      { key: "moderate", label: "Moderate", along: 2.35, across: 0.56 }
    ]
  });
  assert.equal(calibration.available, true);
  const experiment = runAirValidationExperiment(observations, domain, {
    lengthScaleGrid: [1],
    noiseGrid: [0.06],
    transportRegimes: [{ key: "moderate", label: "Moderate", along: 2.35, across: 0.56 }],
    seed: 12
  });
  assert.equal(experiment.available, true);
  assert.ok(Number.isFinite(experiment.locked.lumos.rmse));
  assert.equal(experiment.split.locked.length, 4);

  const scenario = { cells: observations.map((entry) => ({ ...entry, risk: 0.5, uncertainty: 0.6 })), observations, model: {} };
  attachAirInference(scenario, domain, experiment.calibration.settings);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.posteriorPollutant)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.predictiveAirUncertainty)));
});

test("national Air loader creates a wind-aware optimizable pollutant scenario", async () => {
  const rectangle = {
    type: "Polygon",
    coordinates: [[[-105.1, 39.6], [-104.9, 39.6], [-104.9, 39.8], [-105.1, 39.8], [-105.1, 39.6]]]
  };
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("air-quality-api.open-meteo.com")) {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude").split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude").split(",").map(Number);
      return new Response(JSON.stringify(latitudes.map((lat, index) => ({
        latitude: lat,
        longitude: longitudes[index],
        current: {
          time: "2026-07-24T18:00",
          pm2_5: 8 + index * 0.2,
          us_aqi_pm2_5: 35 + index,
          us_aqi: 38 + index
        }
      }))), { status: 200 });
    }
    if (url.includes("api.open-meteo.com")) {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude").split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude").split(",").map(Number);
      return new Response(JSON.stringify(latitudes.map((lat, index) => ({
        latitude: lat,
        longitude: longitudes[index],
        elevation: 1600,
        current: {
          time: "2026-07-24T18:00",
          temperature_2m: 82,
          apparent_temperature: 83,
          relative_humidity_2m: 30,
          wind_speed_10m: 9,
          wind_direction_10m: 245
        }
      }))), { status: 200 });
    }
    if (url.includes("enviroatlas.epa.gov")) {
      const geometry = JSON.parse(new URLSearchParams(options.body).get("geometry"));
      return new Response(JSON.stringify({ samples: geometry.points.map((point, index) => ({ location: { x: point[0], y: point[1] }, value: String(index % 2 ? 24 : 41) })) }), { status: 200 });
    }
    if (url.includes("tigerWMS_ACS2024")) {
      return new Response(JSON.stringify({ type: "FeatureCollection", features: [{
        type: "Feature",
        properties: { GEOID: "08031000100", STATE: "08", COUNTY: "031", TRACT: "000100", NAME: "Test tract", AREALAND: 2000000, CENTLAT: "39.7", CENTLON: "-105.0" },
        geometry: rectangle
      }] }), { status: 200 });
    }
    if (url.includes("api.census.gov")) {
      return new Response(JSON.stringify([
        ["NAME", "B01003_001E", "B17001_001E", "B17001_002E", "B01001_003E", "B01001_027E", "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E", "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E", "B08201_001E", "B08201_002E", "state", "county", "tract"],
        ["Test tract", "1000", "900", "180", "30", "28", "20", "15", "20", "15", "10", "5", "22", "16", "20", "16", "11", "7", "400", "80", "08", "031", "000100"]
      ]), { status: 200 });
    }
    if (url.includes("api.openaq.org/v3/locations/99/latest")) {
      return new Response(JSON.stringify({ results: [{
        datetime: { utc: "2026-07-24T18:00:00Z" },
        value: 12.4,
        sensorsId: 9901,
        locationsId: 99
      }] }), { status: 200 });
    }
    if (url.includes("api.openaq.org/v3/locations?")) {
      return new Response(JSON.stringify({ results: [{
        id: 99,
        isMonitor: true,
        provider: { name: "AirNow" },
        coordinates: { latitude: 39.71, longitude: -105.01 },
        sensors: [{ id: 9901, parameter: { id: 2, units: "µg/m³", name: "pm25" } }]
      }] }), { status: 200 });
    }
    if (url.includes("overpass")) {
      return new Response(JSON.stringify({ elements: [
        { type: "way", id: 10, center: { lat: 39.68, lon: -105.02 }, tags: { highway: "primary" } },
        { type: "node", id: 11, lat: 39.74, lon: -104.96, tags: { landuse: "industrial" } }
      ] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const airProgress = [];
  const scenario = await loadNationalAirScenario(
    { west: -105.1, south: 39.6, east: -104.9, north: 39.8 },
    { pollutant: "pm2_5", openAqApiKey: "test-key", fetchImpl, label: "Test Air viewport", candidateStrategy: "systematic", onProgress: (message) => airProgress.push(message) }
  );
  assert.equal(scenario.domainKey, "air");
  assert.equal(scenario.scenarioType, "live-national-air");
  assert.equal(scenario.model.pollutantLabel, "PM2.5");
  assert.equal(scenario.observations.length, 1);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.pollutantValue) && Number.isFinite(cell.risk)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.trafficIntensity) && Number.isFinite(cell.industrialProximity)));
  assert.ok(Number.isFinite(scenario.model.transportAngle));
  assert.ok(airProgress.some((message) => /weather and atmospheric transport context/i.test(message)));
  assert.equal(airProgress.some((message) => /heat conditions/i.test(message)), false);
  assert.doesNotThrow(() => validateScenario(scenario));
  const optimized = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: { ...DOMAINS.air, transportAngle: scenario.model.transportAngle },
    weights: DOMAINS.air.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.25,
    constraints: { enforceSocialConstraints: true, fairnessLimit: 0.25, minimumGroupInformation: 0.02, minimumReliability: 0.55, budget: 5 },
    modelSettings: { measurementNoise: 0.06, lengthScaleMultiplier: 1 },
    seed: 10
  }, 4, { minimumSeparation: true, beamWidth: 2, profileKeys: ["balanced"], exactPoolSize: 7, exactSelectionCount: 3 });
  assert.ok(optimized.selected.length > 0);
  assert.ok(Number.isFinite(optimized.metrics.score));

  applyNationalAirIntervention(scenario, "industrial");
  assert.equal(scenario.model.interventionTarget, "industrial");
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.interventionBenefit)));
});

test("optional Air source timeouts degrade to proxies instead of aborting the workspace", async () => {
  const rectangle = {
    type: "Polygon",
    coordinates: [[[-105.1, 39.6], [-104.9, 39.6], [-104.9, 39.8], [-105.1, 39.8], [-105.1, 39.6]]]
  };
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("air-quality-api.open-meteo.com")) {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude").split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude").split(",").map(Number);
      return new Response(JSON.stringify(latitudes.map((lat, index) => ({
        latitude: lat,
        longitude: longitudes[index],
        current: { time: "2026-07-24T18:00", pm2_5: 9, us_aqi_pm2_5: 40, us_aqi: 42 }
      }))), { status: 200 });
    }
    if (url.includes("api.open-meteo.com")) {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude").split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude").split(",").map(Number);
      return new Response(JSON.stringify(latitudes.map((lat, index) => ({
        latitude: lat,
        longitude: longitudes[index],
        elevation: 1600,
        current: {
          time: "2026-07-24T18:00",
          temperature_2m: 82,
          apparent_temperature: 83,
          relative_humidity_2m: 30,
          wind_speed_10m: 9,
          wind_direction_10m: 245
        }
      }))), { status: 200 });
    }
    if (url.includes("enviroatlas.epa.gov")) {
      const geometry = JSON.parse(new URLSearchParams(options.body).get("geometry"));
      return new Response(JSON.stringify({ samples: geometry.points.map((point) => ({ location: { x: point[0], y: point[1] }, value: "41" })) }), { status: 200 });
    }
    if (url.includes("tigerWMS_ACS2024")) {
      return new Response(JSON.stringify({ type: "FeatureCollection", features: [{
        type: "Feature",
        properties: { GEOID: "08031000100", STATE: "08", COUNTY: "031", TRACT: "000100", NAME: "Test tract", AREALAND: 2000000, CENTLAT: "39.7", CENTLON: "-105.0" },
        geometry: rectangle
      }] }), { status: 200 });
    }
    if (url.includes("api.census.gov")) {
      return new Response(JSON.stringify([
        ["NAME", "B01003_001E", "B17001_001E", "B17001_002E", "B01001_003E", "B01001_027E", "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E", "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E", "B08201_001E", "B08201_002E", "state", "county", "tract"],
        ["Test tract", "1000", "900", "180", "30", "28", "20", "15", "20", "15", "10", "5", "22", "16", "20", "16", "11", "7", "400", "80", "08", "031", "000100"]
      ]), { status: 200 });
    }
    if (url.includes("overpass")) throw new DOMException("optional service timed out", "AbortError");
    return new Response("not found", { status: 404 });
  };

  const scenario = await loadNationalAirScenario(
    { west: -105.1, south: 39.6, east: -104.9, north: 39.8 },
    { pollutant: "pm2_5", fetchImpl, label: "Timeout fallback", candidateStrategy: "systematic" }
  );
  assert.equal(scenario.domainKey, "air");
  assert.match(scenario.model.airSourceStatus, /proxy fallback/i);
  assert.ok(scenario.candidates.length > 0);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.sourceRisk)));
});

test("Air intervention design allocates treatment and control sites with pollutant units", () => {
  const scenario = generateScenario("air", 9182);
  scenario.model = { pollutantUnit: "µg/m³" };
  scenario.cells.forEach((cell, index) => {
    cell.pollutantValue = 8 + cell.risk * 20;
    cell.sourceRisk = cell.risk;
    cell.interventionBenefit = Math.min(1, 0.65 * cell.risk + 0.35 * cell.exposure);
  });
  const result = designAirInterventionNetwork(scenario, { count: 9, budget: 12, repeatedMeasurements: 8, residualStd: 4 });
  assert.ok(result.selected.length >= 4);
  assert.ok((result.roleCounts.treatment ?? 0) > 0);
  assert.ok((result.roleCounts.control ?? 0) > 0);
  assert.equal(result.effectUnits, "µg/m³");
  assert.ok(Number.isFinite(result.approximatePower));
});


test("Air robustness lab preserves the full objective while screening assumptions", () => {
  const scenario = generateScenario("air", 1307);
  scenario.model = {
    ...scenario.model,
    pollutant: "pm2_5",
    pollutantLabel: "PM2.5",
    pollutantUnit: "µg/m³",
    transportAngle: 0.35
  };
  scenario.observations = scenario.cells.filter((_, index) => index % 52 === 0).slice(0, 16).map((cell, index) => ({
    ...cell,
    id: `reference-${index}`,
    observedValue: 8 + 5 * cell.risk + 2 * cell.exposure - cell.vulnerability + Math.sin(index) * 0.2,
    pollutantValue: 8 + 4 * cell.risk,
    priorPollutantValue: 8 + 4 * cell.risk,
    trafficIntensity: cell.risk,
    industrialProximity: cell.uncertainty,
    sourceRisk: 0.6 * cell.risk + 0.4 * cell.uncertainty,
    downwindSourceRisk: cell.risk,
    monitorType: index % 4 === 0 ? "community" : "reference",
    official: index % 4 !== 0,
    reliability: index % 4 === 0 ? 0.75 : 0.96,
    sensorNoise: index % 4 === 0 ? 0.8 : 0.3
  }));
  enrichAirCandidateRoles(scenario);
  const domain = { ...DOMAINS.air, transportAngle: scenario.model.transportAngle };
  const result = runAirSensitivityAnalysis({
    scenario,
    domain,
    calibrationSettings: { lengthScaleMultiplier: 1, measurementNoise: 0.06, transportRegime: "moderate" },
    monitorCount: 6,
    budget: 7,
    splitSeeds: [12, 24],
    lengthFactors: [1],
    noiseFactors: [1],
    fairnessThresholds: [0.12, 0.24]
  });
  assert.equal(result.splitSeeds.length, 2);
  assert.equal(result.covarianceTransport.length, 3);
  assert.equal(result.observationRobustness.length, 5);
  assert.equal(result.candidateRoles.length, 5);
  assert.equal(result.fairness.length, 2);
  assert.ok(result.candidateRoles.every((entry) => entry.monitorCount <= 6));
  assert.ok(result.candidateRoles.some((entry) => Number.isFinite(entry.information)));
  assert.ok(rowsToAirCsv(buildAirPaperRows(result, scenario)).includes("candidate_role_stress"));
});

test("Air paper bundle exports validation, benchmarks, and selected monitor roles", () => {
  const scenario = generateScenario("air", 1313);
  scenario.domainKey = "air";
  scenario.scenarioType = "live-national-air";
  scenario.cityLabel = "Test Air paper workspace";
  scenario.model = {
    ...scenario.model,
    pollutant: "nitrogen_dioxide",
    pollutantLabel: "Nitrogen dioxide",
    pollutantUnit: "µg/m³",
    transportAngle: 0.25,
    airValidation: { available: false, reason: "test fixture" }
  };
  enrichAirCandidateRoles(scenario);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: { ...DOMAINS.air, transportAngle: 0.25 },
    weights: DOMAINS.air.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.2,
    constraints: { enforceSocialConstraints: true, fairnessLimit: 0.2, minimumGroupInformation: 0.04, minimumReliability: 0.55, budget: 6 },
    modelSettings: { measurementNoise: 0.06, lengthScaleMultiplier: 1, transportAngle: 0.25 },
    seed: scenario.seed
  }, 5, { minimumSeparation: true, beamWidth: 2, exactPoolSize: 8, exactSelectionCount: 3 });
  const bundle = buildCurrentAirPaperBundle({ scenario, result, settings: { budget: 6 } });
  assert.equal(bundle.format, "lumos-air-paper-suite-v1");
  assert.equal(bundle.cases.length, 1);
  assert.ok(bundle.cases[0].selectedNetwork.selected.every((site) => "airRole" in site));
  const rows = airPaperRows(bundle);
  assert.ok(rows.some((row) => row.table === "benchmark"));
  assert.ok(rowsToAirPaperCsv(rows).includes("nitrogen_dioxide"));
  assert.equal(AIR_PAPER_CASE_STUDIES.length, 4);
});


test("Soil laboratory CSV import validates extent, analytes, units, and QA flags", () => {
  const csv = [
    "sample_id,latitude,longitude,analyte,value,unit,depth_top_cm,depth_bottom_cm,qa_flag,reliability",
    "A,40.71,-74.00,lead,1250,ug/kg,0,15,accepted,0.95",
    "B,40.72,-74.01,pH,6.7,pH,0,15,accepted,0.90",
    "C,42.0,-74.0,lead,12,mg/kg,0,15,accepted,0.90",
    "D,40.715,-74.005,lead,15,mg/kg,0,15,rejected,0.90"
  ].join("\n");
  const parsed = parseSoilLabText(csv, {
    defaultAnalyte: "lead",
    scenarioBounds: { minLng: -74.1, minLat: 40.6, maxLng: -73.9, maxLat: 40.8 }
  });
  assert.equal(parsed.samples.length, 2);
  assert.equal(parsed.rejected.length, 2);
  assert.equal(parsed.samples[0].analyte, "lead");
  assert.equal(parsed.samples[0].observedValue, 1.25);
  assert.equal(parsed.samples[1].analyte, "ph");
  assert.match(soilLabTemplateCsv(), /sample_id,latitude,longitude/);
});

test("Soil inference conditions posterior values and produces locked validation", () => {
  const scenario = generateScenario("soil", 1606);
  scenario.domainKey = "soil";
  scenario.scenarioType = "live-national-soil";
  scenario.model = { property: "lead", propertyLabel: "Lead", propertyUnit: "mg/kg" };
  scenario.cells.forEach((cell, index) => {
    cell.soilPh = 6 + 0.8 * cell.x;
    cell.organicMatter = 1.5 + 2 * cell.y;
    cell.clayPercent = 15 + 35 * cell.x;
    cell.availableWater = 0.08 + 0.1 * cell.y;
    cell.electricalConductivity = 0.2 + cell.risk;
    cell.soilComposite = cell.risk;
    cell.disturbancePressure = 0.7 * cell.risk;
    cell.landClass = 0.4 * cell.x + 0.6 * cell.y;
    cell.soilDataConfidence = 0.8;
    cell.lat = 40 + cell.y;
    cell.lng = -75 + cell.x;
  });
  const samples = scenario.cells.filter((_, index) => index % 37 === 0).slice(0, 18).map((cell, index) => ({
    ...cell,
    id: `soil-lab-${index}`,
    sampleId: `soil-lab-${index}`,
    analyte: "lead",
    observedValue: 18 + 42 * cell.disturbancePressure + 8 * cell.vulnerability + Math.sin(index) * 0.8,
    unit: "mg/kg",
    reliability: 0.94,
    feasibility: 1,
    sensorNoise: 0.6
  }));
  const calibration = calibrateSoilModel(samples, DOMAINS.soil, {
    analyte: "lead",
    lengthGrid: [0.85, 1],
    noiseGrid: [0.045, 0.08]
  });
  assert.equal(calibration.available, true);
  attachSoilInference(scenario, DOMAINS.soil, { samples, analyte: "lead", calibration });
  assert.equal(scenario.model.labSampleCount, 18);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.posteriorSoilValue)));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.predictiveSoilUncertainty)));
  assert.equal(scenario.model.soilValidation.available, true);
  const validation = runSoilValidationExperiment(scenario.observations, DOMAINS.soil, scenario.model.soilInference, { seed: 42 });
  assert.equal(validation.available, true);
  assert.ok(Number.isFinite(validation.locked.lumos.rmse));
});

test("Soil robustness and paper exports preserve validation and benchmark evidence", () => {
  const scenario = generateScenario("soil", 1616);
  scenario.domainKey = "soil";
  scenario.scenarioType = "live-national-soil";
  scenario.cityLabel = "Test Soil workspace";
  scenario.model = { property: "ph", propertyLabel: "Soil pH", propertyUnit: "pH" };
  scenario.cells.forEach((cell, index) => {
    cell.soilPh = 5.7 + 1.6 * cell.x + 0.2 * Math.sin(index);
    cell.organicMatter = 2 + cell.y;
    cell.clayPercent = 20 + 20 * cell.x;
    cell.availableWater = 0.1 + 0.08 * cell.y;
    cell.electricalConductivity = 0.2 + 0.2 * cell.risk;
    cell.soilComposite = cell.risk;
    cell.disturbancePressure = cell.uncertainty;
    cell.landClass = 0.5 * cell.x + 0.5 * cell.y;
    cell.soilDataConfidence = 0.8;
  });
  const samples = scenario.cells.filter((_, index) => index % 39 === 0).slice(0, 16).map((cell, index) => ({
    ...cell,
    id: `ph-${index}`,
    sampleId: `ph-${index}`,
    analyte: "ph",
    observedValue: cell.soilPh + 0.18 * cell.disturbancePressure + Math.cos(index) * 0.03,
    reliability: 0.95,
    feasibility: 1,
    sensorNoise: 0.03
  }));
  attachSoilInference(scenario, DOMAINS.soil, { samples, analyte: "ph" });
  const sensitivity = runSoilSensitivityAnalysis({
    scenario,
    domain: DOMAINS.soil,
    splitSeeds: [17, 31]
  });
  assert.equal(sensitivity.available, true);
  assert.ok(sensitivity.rows.some((row) => row.analysis === "covariance_sensitivity"));
  assert.ok(rowsToSoilSensitivityCsv(sensitivity.rows).includes("validation_stability"));
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.soil,
    weights: DOMAINS.soil.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.2,
    constraints: { enforceSocialConstraints: true, fairnessLimit: 0.2, minimumGroupInformation: 0.04, minimumReliability: 0.55, budget: 6 },
    modelSettings: { measurementNoise: 0.07, lengthScaleMultiplier: 1 },
    seed: scenario.seed
  }, 5, { minimumSeparation: true, beamWidth: 2, exactPoolSize: 8, exactSelectionCount: 3 });
  const bundle = buildCurrentSoilPaperBundle({ scenario, result, sensitivity, settings: { budget: 6 } });
  assert.equal(bundle.format, "lumos-soil-paper-bundle-v1");
  assert.equal(bundle.scenario.laboratorySamples, 16);
  const rows = soilPaperRows(bundle);
  assert.ok(rows.some((row) => row.table === "benchmark"));
  assert.ok(rowsToSoilPaperCsv(rows).includes("Test Soil workspace"));
});

test("Soil laboratory-conditioned legends use the active analyte and unit", () => {
  const scenario = { domainKey: "soil", model: { labAnalyteLabel: "Lead", labAnalyteUnit: "mg/kg" } };
  assert.equal(describeMapLegend("posteriorSoilValue", { low: 2, high: 20 }, scenario, "soil").label, "Lead laboratory-conditioned field");
  assert.match(describeMapLegend("predictiveSoilUncertainty", { low: 1, high: 3 }, scenario, "soil").high, /mg\/kg/);
});

test("Soil import QA enforces duplicates, depth compatibility, plausible ranges, dates, and non-detect handling", () => {
  const csv = [
    "sample_id,latitude,longitude,analyte,value,unit,depth_top_cm,depth_bottom_cm,sample_date,detection_limit,qa_flag,reliability",
    "A,40.7100,-74.0000,lead,<0.5,mg/kg,0,15,2026-07-20,0.5,accepted,0.95",
    "A,40.7100,-74.0000,lead,0.4,mg/kg,0,15,2026-07-20,0.5,accepted,0.95",
    "DEPTH,40.7150,-74.0050,lead,12,mg/kg,30,60,2026-07-20,0.5,accepted,0.95",
    "RANGE,40.7160,-74.0060,ph,20,pH,0,15,2026-07-20,,accepted,0.95",
    "FUTURE,40.7170,-74.0070,lead,8,mg/kg,0,15,2027-01-01,0.5,accepted,0.95",
    "OLD,40.7180,-74.0080,lead,9,mg/kg,0,15,2010-01-01,0.5,accepted,0.95"
  ].join("\n");
  const parsed = parseSoilLabText(csv, {
    defaultAnalyte: "lead",
    scenarioBounds: { minLng: -74.1, minLat: 40.6, maxLng: -73.9, maxLat: 40.8 },
    selectedDepth: { top: 0, bottom: 15 },
    now: Date.parse("2026-07-25T12:00:00Z")
  });
  assert.equal(parsed.samples.length, 2);
  assert.equal(parsed.samples[0].censored, true);
  assert.equal(parsed.samples[0].observedValue, 0.25);
  assert.equal(parsed.samples[1].stale, true);
  assert.ok(parsed.samples[1].reliability < 0.95);
  assert.equal(parsed.summary.accepted, 2);
  assert.equal(parsed.summary.rejected, 4);
  assert.equal(parsed.summary.censored, 1);
  assert.equal(parsed.summary.stale, 1);
  assert.equal(parsed.summary.rejectionReasons.duplicate_sample, 1);
  assert.equal(parsed.summary.rejectionReasons.outside_depth, 1);
  assert.equal(parsed.summary.rejectionReasons.implausible_value, 1);
  assert.equal(parsed.summary.rejectionReasons.future_date, 1);
  assert.deepEqual(buildSoilImportQaReport(parsed), parsed.summary);
});

test("Soil public presets select property, depth, and local study extent", () => {
  assert.equal(Object.keys(SOIL_PRESETS).length, 4);
  assert.equal(SOIL_PRESETS["fresno-organic-matter"].property, "organic_matter");
  assert.equal(SOIL_PRESETS["des-moines-water"].depth, "15-30");
  assert.ok(SOIL_PRESETS["phoenix-salinity"].location.boundingBox.east > SOIL_PRESETS["phoenix-salinity"].location.boundingBox.west);
});

test("controlled Soil benchmark samples are deterministic, distributed, and explicitly non-observational", () => {
  const scenario = generateScenario("soil", 1707);
  scenario.domainKey = "soil";
  scenario.model = { property: "ph", propertyLabel: "Soil pH", propertyUnit: "pH" };
  scenario.cells.forEach((cell, index) => {
    cell.soilPh = 5.8 + 1.4 * cell.x + 0.15 * Math.sin(index);
    cell.organicMatter = 1.5 + 2 * cell.y;
    cell.clayPercent = 18 + 30 * cell.x;
    cell.availableWater = 0.08 + 0.1 * cell.y;
    cell.electricalConductivity = 0.2 + 0.3 * cell.risk;
    cell.soilComposite = cell.risk;
    cell.disturbancePressure = cell.uncertainty;
    cell.lat = 33.56 + cell.y * 0.38;
    cell.lng = -84.62 + cell.x * 0.5;
  });
  const definition = SOIL_PUBLIC_CASE_STUDIES.find((entry) => entry.property === "ph");
  const first = createControlledSoilBenchmarkSamples(scenario, definition, 16);
  const second = createControlledSoilBenchmarkSamples(scenario, definition, 16);
  assert.equal(first.length, 16);
  assert.deepEqual(first.map((entry) => entry.observedValue), second.map((entry) => entry.observedValue));
  assert.ok(first.every((entry) => entry.controlledBenchmark && entry.sourceType === "controlled_benchmark_sample"));
  assert.ok(first.every((entry) => Number.isFinite(entry.observedValue) && entry.observedValue >= 0 && entry.observedValue <= 14));
});

test("Soil public evidence suite runs a frozen benchmark protocol and exports tidy evidence", async () => {
  const definition = SOIL_PUBLIC_CASE_STUDIES.find((entry) => entry.property === "ph");
  const loadScenarioImpl = async (_bounds, options) => {
    const scenario = generateScenario("soil", 1717);
    scenario.domainKey = "soil";
    scenario.scenarioType = "live-national-soil";
    scenario.cityLabel = options.label;
    scenario.geoBounds = { minLng: definition.bounds.west, minLat: definition.bounds.south, maxLng: definition.bounds.east, maxLat: definition.bounds.north };
    scenario.model = {
      ...scenario.model,
      property: options.property,
      propertyLabel: "Soil pH",
      propertyUnit: "pH",
      depth: options.depth,
      soilCoverageRate: 0.92
    };
    scenario.cells.forEach((cell, index) => {
      cell.soilPh = 5.7 + 1.5 * cell.x + 0.12 * Math.sin(index);
      cell.organicMatter = 1.8 + 1.6 * cell.y;
      cell.clayPercent = 17 + 32 * cell.x;
      cell.availableWater = 0.08 + 0.1 * cell.y;
      cell.electricalConductivity = 0.25 + 0.35 * cell.risk;
      cell.soilComposite = cell.risk;
      cell.disturbancePressure = cell.uncertainty;
      cell.soilDataConfidence = 0.82;
      cell.lat = definition.bounds.south + cell.y * (definition.bounds.north - definition.bounds.south);
      cell.lng = definition.bounds.west + cell.x * (definition.bounds.east - definition.bounds.west);
    });
    return scenario;
  };
  const bundle = await runNationalSoilEvidenceSuite({
    caseStudies: [definition],
    loadScenarioImpl,
    includeSensitivity: false,
    settings: { monitorCount: 5, budget: 6, benchmarkSampleCount: 12, minimumGroupInformation: 0.02, minimumReliability: 0.5 }
  });
  assert.equal(bundle.format, "lumos-soil-public-evidence-v1");
  assert.equal(bundle.version, "1.9.1");
  assert.equal(bundle.cases.length, 1);
  assert.equal(bundle.cases[0].scenario.evidenceType, "controlled_benchmark_over_public_survey_context");
  assert.equal(bundle.cases[0].validation.available, true);
  assert.ok(bundle.cases[0].selectedNetwork.selected.length > 0);
  assert.match(bundle.methodology.evidenceBoundary, /controlled simulations/i);
  const rows = soilEvidenceRows(bundle);
  assert.ok(rows.some((row) => row.table === "locked_validation"));
  assert.match(rowsToSoilEvidenceCsv(rows), /atlanta-soil-ph/);
});

test("Soil system health treats the Soil Data Access query as required", async () => {
  const windowObject = {
    isSecureContext: true,
    maplibregl: {},
    localStorage: { setItem() {}, removeItem() {} }
  };
  const documentObject = { createElement: () => ({ getContext: () => ({}), toDataURL: () => "data:" }) };
  const fetchImpl = async (url) => {
    if (String(url).includes("sdmdataaccess")) throw new Error("soil service unavailable");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const soil = await runReleaseHealthCheck({
    fetchImpl,
    timeoutMs: 100,
    domainKey: "soil",
    windowObject,
    documentObject,
    navigatorObject: { onLine: true }
  });
  const heat = await runReleaseHealthCheck({
    fetchImpl,
    timeoutMs: 100,
    domainKey: "heat",
    windowObject,
    documentObject,
    navigatorObject: { onLine: true }
  });
  assert.equal(soil.ready, false);
  assert.equal(soil.checks.find((check) => check.id === "soil-data").status, "fail");
  assert.equal(heat.ready, true);
  assert.equal(heat.checks.find((check) => check.id === "soil-data").status, "warn");
});


test("USGS instantaneous Water observations normalize coordinates, values, units, and provisional reliability", () => {
  const payload = {
    value: {
      timeSeries: [{
        name: "USGS:06711565:00060:00000",
        sourceInfo: {
          siteName: "South Platte River at Denver",
          siteCode: [{ value: "06711565" }],
          geoLocation: { geogLocation: { latitude: 39.76, longitude: -105.01 } }
        },
        variable: { unit: { unitCode: "ft3/s" } },
        values: [{ value: [
          { value: "142", dateTime: "2026-07-25T12:00:00.000Z", qualifiers: ["P"] },
          { value: "151", dateTime: "2026-07-25T12:15:00.000Z", qualifiers: ["P"] }
        ] }]
      }]
    }
  };
  const rows = normalizeUsgsInstantaneous(payload, { minLng: -105.2, minLat: 39.6, maxLng: -104.8, maxLat: 39.9 }, "discharge");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].siteCode, "06711565");
  assert.equal(rows[0].observedValue, 151);
  assert.equal(rows[0].indicator, "discharge");
  assert.equal(rows[0].unit, "ft3/s");
  assert.ok(rows[0].x >= 0 && rows[0].x <= 1 && rows[0].y >= 0 && rows[0].y <= 1);
  assert.ok(rows[0].reliability < 0.9);
});

test("Water adapter exposes supported indicators, systems, and Water-specific map legends", () => {
  assert.equal(WATER_INDICATORS.turbidity.parameterCd, "63680");
  assert.match(WATER_SYSTEMS.distribution.description, /proxy/i);
  const scenario = { domainKey: "water", model: { indicatorLabel: "Dissolved oxygen", indicatorUnit: "mg/L" } };
  assert.equal(describeMapLegend("waterIndicatorValue", { low: 4, high: 11 }, scenario, "water").label, "Dissolved oxygen");
  assert.match(describeMapLegend("waterIndicatorValue", { low: 4, high: 11 }, scenario, "water").high, /mg\/L/);
  assert.equal(describeMapLegend("upstreamSourcePressure", { low: 0, high: 1 }, scenario, "water").label, "Upstream source pressure");
  assert.equal(describeMapLegend("interventionBenefit", { low: 0, high: 1 }, scenario, "water").label, "Water intervention priority");
});

test("Water candidate roles and intervention targets preserve source-to-receptor structure", () => {
  const scenario = generateScenario("water", 1808);
  scenario.domainKey = "water";
  scenario.scenarioType = "live-national-water";
  scenario.model = { indicatorUnit: "mg/L", transportAngle: 0.4 };
  scenario.observations = [{ x: scenario.candidates[0].x, y: scenario.candidates[0].y }];
  scenario.cells.forEach((cell, index) => {
    cell.waterIndicatorValue = 5 + cell.x;
    cell.flowConnectivity = 0.25 + 0.7 * cell.y;
    cell.upstreamSourcePressure = index % 4 === 0 ? 0.9 : 0.2 + 0.4 * cell.x;
    cell.downstreamExposure = index % 5 === 0 ? 0.88 : 0.2 + 0.5 * cell.y;
    cell.monitoringDensity = 0.35;
    cell.interventionBenefit = 0;
    cell.networkBranch = index % 4;
  });
  enrichWaterCandidateRoles(scenario);
  assert.ok(scenario.candidates.some((candidate) => candidate.waterRole === "reference-collocation"));
  assert.ok(scenario.candidates.every((candidate) => Number.isFinite(candidate.networkBranch)));
  applyNationalWaterIntervention(scenario, "stormwater");
  assert.equal(scenario.model.interventionTarget, "stormwater");
  assert.ok(scenario.cells.every((cell) => cell.interventionBenefit >= 0 && cell.interventionBenefit <= 1));
});

test("Water post-intervention design assigns treatment, control, and flow sentinel roles", () => {
  const scenario = generateScenario("water", 1818);
  scenario.domainKey = "water";
  scenario.scenarioType = "live-national-water";
  scenario.model = { indicatorUnit: "mg/L", interventionTarget: "wastewater" };
  scenario.cells.forEach((cell, index) => {
    cell.waterIndicatorValue = 4 + 2 * cell.x;
    cell.interventionBenefit = 0.2 + 0.75 * cell.risk;
    cell.upstreamSourcePressure = index % 3 === 0 ? 0.92 : 0.25 + 0.35 * cell.x;
    cell.downstreamExposure = index % 4 === 0 ? 0.9 : 0.2 + 0.5 * cell.y;
  });
  const design = designWaterInterventionNetwork(scenario, { count: 10, budget: 14, minimumDistance: 0.02, repeatedMeasurements: 6 });
  assert.equal(design.available, true);
  assert.ok(design.selected.length >= 6);
  assert.ok(design.roleCounts.treatment > 0);
  assert.ok(design.roleCounts.control > 0);
  assert.ok((design.roleCounts.upstream ?? 0) + (design.roleCounts.downstream ?? 0) > 0);
  assert.ok(design.approximatePower >= 0 && design.approximatePower <= 1);
});

test("Water presets, onboarding, and health checks are domain aware", async () => {
  assert.equal(Object.keys(WATER_PRESETS).length, 4);
  assert.equal(WATER_PRESETS["houston-turbidity"].indicator, "turbidity");
  assert.equal(onboardingStepsForDomain("water"), WATER_ONBOARDING_STEPS);
  assert.ok(WATER_ONBOARDING_STEPS.some((step) => step.target === "#waterWorkspaceControls"));
  const windowObject = { isSecureContext: true, maplibregl: {}, localStorage: { setItem() {}, removeItem() {} } };
  const documentObject = { createElement: () => ({ getContext: () => ({}), toDataURL: () => "data:" }) };
  const fetchImpl = async (url) => {
    if (String(url).includes("waterservices.usgs.gov")) throw new Error("water service unavailable");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const water = await runReleaseHealthCheck({ fetchImpl, timeoutMs: 100, domainKey: "water", windowObject, documentObject, navigatorObject: { onLine: true } });
  const soil = await runReleaseHealthCheck({ fetchImpl, timeoutMs: 100, domainKey: "soil", windowObject, documentObject, navigatorObject: { onLine: true } });
  assert.equal(water.ready, false);
  assert.equal(water.checks.find((check) => check.id === "water-observations").status, "fail");
  assert.equal(soil.ready, true);
  assert.equal(soil.checks.find((check) => check.id === "water-observations").status, "warn");
});


test("national Water loader builds an observation-informed optimizable flow-screening scenario", async () => {
  const bounds = { west: -105.1, south: 39.6, east: -104.9, north: 39.8 };
  const rectangle = { type: "Polygon", coordinates: [[[-105.1,39.6],[-104.9,39.6],[-104.9,39.8],[-105.1,39.8],[-105.1,39.6]]] };
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("waterservices.usgs.gov")) return new Response(JSON.stringify({ value: { timeSeries: [
      { sourceInfo: { siteName: "River A", siteCode: [{ value: "A" }], geoLocation: { geogLocation: { latitude: 39.67, longitude: -105.04 } } }, variable: { unit: { unitCode: "deg C" } }, values: [{ value: [{ value: "16.2", dateTime: "2026-07-25T12:00:00Z", qualifiers: ["A"] }] }] },
      { sourceInfo: { siteName: "River B", siteCode: [{ value: "B" }], geoLocation: { geogLocation: { latitude: 39.73, longitude: -104.98 } } }, variable: { unit: { unitCode: "deg C" } }, values: [{ value: [{ value: "19.1", dateTime: "2026-07-25T12:15:00Z", qualifiers: ["P"] }] }] }
    ] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("open-meteo.com")) {
      const parsed = new URL(url); const lats = parsed.searchParams.get("latitude").split(",").map(Number); const lngs = parsed.searchParams.get("longitude").split(",").map(Number);
      return new Response(JSON.stringify(lats.map((lat, index) => ({ latitude: lat, longitude: lngs[index], elevation: 1600, current: { time: "2026-07-25T12:00", temperature_2m: 82, apparent_temperature: 83, relative_humidity_2m: 35, wind_speed_10m: 6, wind_direction_10m: 210 } }))), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("enviroatlas.epa.gov")) {
      const geometry = JSON.parse(new URLSearchParams(options.body).get("geometry"));
      return new Response(JSON.stringify({ samples: geometry.points.map((point, index) => ({ location: { x: point[0], y: point[1] }, value: String(index % 2 ? 41 : 22) })) }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("tigerWMS_ACS2024")) return new Response(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { GEOID: "08031000100", STATE: "08", COUNTY: "031", TRACT: "000100", NAME: "Test tract", AREALAND: 2000000, CENTLAT: "39.7", CENTLON: "-105.0" }, geometry: rectangle }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("api.census.gov")) return new Response(JSON.stringify([
      ["NAME","B01003_001E","B17001_001E","B17001_002E","B01001_003E","B01001_027E","B01001_020E","B01001_021E","B01001_022E","B01001_023E","B01001_024E","B01001_025E","B01001_044E","B01001_045E","B01001_046E","B01001_047E","B01001_048E","B01001_049E","B08201_001E","B08201_002E","state","county","tract"],
      ["Test tract","1000","900","180","30","28","20","15","20","15","10","5","22","16","20","16","11","7","400","80","08","031","000100"]
    ]), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("overpass")) return new Response(JSON.stringify({ elements: [
      { type: "way", id: 1, tags: { waterway: "river", name: "Test River" }, geometry: [{ lat: 39.62, lon: -105.08 }, { lat: 39.69, lon: -105.01 }, { lat: 39.77, lon: -104.93 }] },
      { type: "node", id: 2, lat: 39.65, lon: -105.05, tags: { man_made: "wastewater_plant", name: "Treatment Plant" } },
      { type: "node", id: 3, lat: 39.74, lon: -104.96, tags: { amenity: "drinking_water", name: "Public Access" } }
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response("not found", { status: 404 });
  };
  const waterProgress = [];
  const scenario = await loadNationalWaterScenario(bounds, { indicator: "temperature", systemType: "surface", candidateStrategy: "hybrid", fetchImpl, label: "Test Water viewport", monitorCount: 6, onProgress: (message) => waterProgress.push(message) });
  assert.equal(scenario.domainKey, "water");
  assert.equal(scenario.scenarioType, "live-national-water");
  assert.equal(scenario.model.waterObservationCount, 2);
  assert.ok(scenario.model.waterwayPointCount >= 3);
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.waterIndicatorValue) && Number.isFinite(cell.flowConnectivity) && Number.isFinite(cell.risk)));
  assert.ok(scenario.candidates.length > 0);
  assert.ok(waterProgress.some((message) => /weather and watershed context/i.test(message)));
  assert.equal(waterProgress.some((message) => /heat conditions/i.test(message)), false);
  assert.doesNotThrow(() => validateScenario(scenario));
  const optimized = optimizeNetwork({
    cells: scenario.cells, candidates: scenario.candidates, observations: scenario.observations,
    domain: { ...DOMAINS.water, transportAngle: scenario.model.transportAngle }, weights: DOMAINS.water.weights,
    fairnessConstraint: true, fairnessLimit: 0.3,
    constraints: { enforceSocialConstraints: true, fairnessLimit: 0.3, minimumGroupInformation: 0.01, minimumReliability: 0.5, budget: 7 },
    modelSettings: { measurementNoise: 0.06, lengthScaleMultiplier: 1, transportAngle: scenario.model.transportAngle }, seed: 18
  }, 5, { beamWidth: 2, profileKeys: ["balanced"], exactPoolSize: 7, exactSelectionCount: 3 });
  assert.ok(optimized.selected.length > 0);
});


function waterInferenceScenario(seed = 1919) {
  const scenario = generateScenario("water", seed);
  scenario.domainKey = "water";
  scenario.scenarioType = "live-national-water";
  scenario.cityLabel = "Controlled Water inference test";
  scenario.geoBounds = { minLng: -105.1, minLat: 39.6, maxLng: -104.9, maxLat: 39.8 };
  scenario.model = {
    ...scenario.model,
    indicator: "temperature",
    indicatorLabel: "Water temperature",
    indicatorUnit: "°C",
    systemType: "surface",
    systemLabel: "Surface water / watershed",
    transportAngle: 0.42,
    flowDirectionConfidence: "geometric proxy"
  };
  scenario.cells.forEach((cell, index) => {
    cell.networkBranch = index % 4;
    cell.flowPosition = Math.max(0, Math.min(1, 0.12 + 0.76 * cell.x));
    cell.flowConnectivity = 0.25 + 0.68 * cell.y;
    cell.upstreamSourcePressure = 0.12 + 0.72 * cell.x;
    cell.downstreamExposure = 0.15 + 0.7 * cell.y;
    cell.monitoringDensity = 0.2 + 0.55 * ((index % 9) / 8);
    cell.waterIndicatorValue = 12.5 + 5.2 * cell.x - 1.8 * cell.y + 0.35 * cell.networkBranch;
    cell.priorWaterIndicatorValue = cell.waterIndicatorValue;
    cell.ecology = cell.ecology ?? 0.5;
  });
  const picks = [20, 63, 109, 156, 205, 252, 301, 350, 399, 448, 497, 546, 595, 644, 693, 742];
  scenario.observations = picks.map((index, observationIndex) => {
    const cell = scenario.cells[index];
    return {
      ...cell,
      id: `water-observation-${observationIndex + 1}`,
      siteCode: `WO-${observationIndex + 1}`,
      observedValue: cell.waterIndicatorValue + Math.sin(observationIndex * 1.7) * 0.42,
      indicator: "temperature",
      unit: "°C",
      reliability: observationIndex % 5 === 0 ? 0.84 : 0.96,
      sensorNoise: 0.08,
      qualifiers: observationIndex % 7 === 0 ? ["P"] : ["A"],
      existing: true,
      official: true
    };
  });
  scenario.sourceMetadata = { sources: [], layers: [], limitations: [] };
  return scenario;
}

test("Water inference conditions a directional posterior and preserves a deterministic locked test", () => {
  const scenario = waterInferenceScenario();
  const domain = { ...DOMAINS.water, transportAngle: scenario.model.transportAngle };
  const firstSplit = createLockedWaterSplit(scenario.observations, 0.25, 1901);
  const secondSplit = createLockedWaterSplit(scenario.observations, 0.25, 1901);
  assert.deepEqual(firstSplit.locked.map((entry) => entry.id), secondSplit.locked.map((entry) => entry.id));
  attachWaterInference(scenario, domain, { indicator: "temperature", indicatorDefinition: WATER_INDICATORS.temperature, lockedSeed: 1901 });
  assert.equal(scenario.model.waterInference.observationsUsed, 16);
  assert.equal(scenario.model.waterValidation.available, true);
  assert.ok(Number.isFinite(scenario.model.waterValidation.locked.lumos.rmse));
  assert.ok(Number.isFinite(scenario.model.waterValidation.locked.isotropic.rmse));
  assert.ok(scenario.cells.every((cell) => Number.isFinite(cell.posteriorWaterValue) && Number.isFinite(cell.predictiveWaterUncertainty)));
  assert.ok(scenario.sourceMetadata.layers.some((layer) => layer.label === "Flow-aware Water posterior"));
});

test("Water robustness and paper exports retain validation, benchmarks, and assumptions", () => {
  const scenario = waterInferenceScenario(2020);
  const domain = { ...DOMAINS.water, transportAngle: scenario.model.transportAngle };
  attachWaterInference(scenario, domain, { indicator: "temperature", indicatorDefinition: WATER_INDICATORS.temperature });
  const sensitivity = runWaterSensitivityAnalysis({ scenario, domain, calibrationSettings: scenario.model.waterInference, splitSeeds: [1901, 2903] });
  assert.equal(sensitivity.available, true);
  assert.ok(sensitivity.rows.some((row) => row.analysis === "flow_covariance_sensitivity"));
  assert.match(rowsToWaterSensitivityCsv(sensitivity.rows), /flow_covariance_sensitivity/);
  const selected = scenario.candidates.slice(0, 5).map((candidate, index) => ({ ...candidate, waterRole: index % 2 ? "receptor" : "source-oriented" }));
  const result = {
    solutions: [{ profileKey: "balanced", profileLabel: "Balanced", selected, metrics: { information: 0.42, fairnessGap: 0.11 }, constraintStatus: { feasible: true } }],
    baselines: [{ name: "A-optimality", criterion: "trace", metrics: { information: 0.39 }, constraintStatus: { feasible: true } }]
  };
  const bundle = buildCurrentWaterPaperBundle({ scenario, result, sensitivity, activeProfile: "balanced", settings: { monitorCount: 5 } });
  assert.equal(bundle.version, "1.9.1");
  assert.equal(bundle.scenario.validation.available, true);
  assert.equal(bundle.selectedNetwork.selected.length, 5);
  assert.match(rowsToWaterPaperCsv(waterPaperRows(bundle)), /locked_validation/);
});

test("Water intervention allocations respect small requested counts and indicator-specific effect assumptions", () => {
  const scenario = waterInferenceScenario(2121);
  scenario.model.interventionTarget = "stormwater";
  scenario.candidates.forEach((candidate, index) => {
    const cell = scenario.cells[(index * 5) % scenario.cells.length];
    Object.assign(candidate, {
      interventionBenefit: 0.25 + 0.65 * (cell.risk ?? 0.5),
      upstreamSourcePressure: cell.upstreamSourcePressure,
      downstreamExposure: cell.downstreamExposure,
      networkBranch: cell.networkBranch,
      flowPosition: cell.flowPosition,
      waterIndicatorValue: cell.waterIndicatorValue,
      feasibility: 1,
      cost: 1
    });
  });
  const design = designWaterInterventionNetwork(scenario, { count: 3, budget: 5, minimumDistance: 0, repeatedMeasurements: 5 });
  assert.equal(design.available, true);
  assert.ok(design.selected.length <= 3);
  assert.equal(design.assumptions.indicator, "temperature");
  assert.ok(Number.isFinite(design.expectedEffect));
});

test("controlled Water benchmark observations are deterministic, distributed, and explicitly simulated", () => {
  const scenario = waterInferenceScenario(2222);
  const definition = WATER_PUBLIC_CASE_STUDIES[0];
  const first = createControlledWaterBenchmarkObservations(scenario, definition, 12);
  const second = createControlledWaterBenchmarkObservations(scenario, definition, 12);
  assert.deepEqual(first.map((entry) => entry.observedValue), second.map((entry) => entry.observedValue));
  assert.ok(first.every((entry) => entry.controlledBenchmark && entry.official === false));
  assert.ok(new Set(first.map((entry) => entry.networkBranch)).size > 1);
});

test("Water public evidence suite runs a frozen protocol and exports tidy evidence", async () => {
  const base = waterInferenceScenario(2323);
  base.cells = base.cells.filter((_, index) => index % 12 === 0).slice(0, 64);
  base.candidates = base.candidates.filter((_, index) => index % 4 === 0).slice(0, 36);
  base.observations = [];
  const definition = { ...WATER_PUBLIC_CASE_STUDIES[0], key: "test-water-evidence", label: "Test Water evidence" };
  const loader = async (_bounds, options) => {
    const scenario = structuredClone(base);
    scenario.cityLabel = options.label;
    scenario.model.indicator = options.indicator;
    scenario.model.indicatorLabel = WATER_INDICATORS[options.indicator].label;
    scenario.model.indicatorUnit = WATER_INDICATORS[options.indicator].unit;
    scenario.model.systemType = options.systemType;
    return scenario;
  };
  const bundle = await runNationalWaterEvidenceSuite({
    caseStudies: [definition],
    loadScenarioImpl: loader,
    settings: { monitorCount: 4, budget: 6, fairnessLimit: 0.4, minimumGroupInformation: 0, minimumReliability: 0.4, benchmarkObservationCount: 10 }
  });
  assert.equal(bundle.version, "1.9.1");
  assert.equal(bundle.cases.length, 1);
  assert.equal(bundle.cases[0].validation.available, true);
  assert.ok(bundle.cases[0].selectedNetwork.selected.length > 0);
  const csv = rowsToWaterEvidenceCsv(waterEvidenceRows(bundle));
  assert.match(csv, /locked_validation/);
  assert.match(csv, /test-water-evidence/);
});
