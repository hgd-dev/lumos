export const HEAT_PRESETS = Object.freeze({
  phoenix: {
    id: "phoenix",
    domain: "heat",
    label: "Phoenix",
    description: "Hot, sprawling desert metro",
    location: {
      display_name: "Phoenix, Arizona",
      lat: 33.4484,
      lng: -112.0740,
      boundingBox: { south: 33.25, north: 33.70, west: -112.35, east: -111.80 }
    }
  },
  denver: {
    id: "denver",
    domain: "heat",
    label: "Denver",
    description: "High-elevation inland metro",
    location: {
      display_name: "Denver, Colorado",
      lat: 39.7392,
      lng: -104.9903,
      boundingBox: { south: 39.55, north: 39.95, west: -105.25, east: -104.70 }
    }
  },
  atlanta: {
    id: "atlanta",
    domain: "heat",
    label: "Atlanta",
    description: "Humid, tree-covered urban region",
    location: {
      display_name: "Atlanta, Georgia",
      lat: 33.7490,
      lng: -84.3880,
      boundingBox: { south: 33.55, north: 33.95, west: -84.65, east: -84.10 }
    }
  },
  newyork: {
    id: "newyork",
    domain: "heat",
    label: "New York",
    description: "Dense coastal validated case study",
    location: {
      display_name: "New York City, New York",
      lat: 40.7128,
      lng: -74.0060,
      boundingBox: { south: 40.49, north: 40.93, west: -74.27, east: -73.68 }
    }
  }
});

export const AIR_PRESETS = Object.freeze({
  "los-angeles-pm25": {
    id: "los-angeles-pm25",
    domain: "air",
    pollutant: "pm2_5",
    label: "Los Angeles",
    description: "PM2.5 · traffic and basin transport",
    location: {
      display_name: "Los Angeles, California",
      lat: 34.0522,
      lng: -118.2437,
      boundingBox: { south: 33.75, north: 34.25, west: -118.55, east: -117.85 }
    }
  },
  "houston-ozone": {
    id: "houston-ozone",
    domain: "air",
    pollutant: "ozone",
    label: "Houston",
    description: "Ozone · industry and sea-breeze transport",
    location: {
      display_name: "Houston, Texas",
      lat: 29.7604,
      lng: -95.3698,
      boundingBox: { south: 29.45, north: 30.10, west: -95.75, east: -95.05 }
    }
  },
  "chicago-no2": {
    id: "chicago-no2",
    domain: "air",
    pollutant: "nitrogen_dioxide",
    label: "Chicago",
    description: "NO₂ · urban transport corridors",
    location: {
      display_name: "Chicago, Illinois",
      lat: 41.8781,
      lng: -87.6298,
      boundingBox: { south: 41.55, north: 42.10, west: -88.15, east: -87.45 }
    }
  },
  "new-york-pm25": {
    id: "new-york-pm25",
    domain: "air",
    pollutant: "pm2_5",
    label: "New York",
    description: "PM2.5 · dense coastal exposure",
    location: {
      display_name: "New York City, New York",
      lat: 40.7128,
      lng: -74.0060,
      boundingBox: { south: 40.48, north: 40.95, west: -74.27, east: -73.68 }
    }
  }
});

export const SOIL_PRESETS = Object.freeze({
  "fresno-organic-matter": {
    id: "fresno-organic-matter",
    domain: "soil",
    property: "organic_matter",
    depth: "0-15",
    label: "Fresno",
    description: "Organic matter · agricultural edge",
    location: {
      display_name: "Fresno, California",
      lat: 36.7378,
      lng: -119.7871,
      boundingBox: { south: 36.60, north: 36.92, west: -119.98, east: -119.55 }
    }
  },
  "phoenix-salinity": {
    id: "phoenix-salinity",
    domain: "soil",
    property: "salinity",
    depth: "0-15",
    label: "Phoenix",
    description: "Salinity · arid topsoil",
    location: {
      display_name: "Phoenix, Arizona",
      lat: 33.4484,
      lng: -112.0740,
      boundingBox: { south: 33.28, north: 33.66, west: -112.32, east: -111.78 }
    }
  },
  "des-moines-water": {
    id: "des-moines-water",
    domain: "soil",
    property: "available_water",
    depth: "15-30",
    label: "Des Moines",
    description: "Available water · 15–30 cm",
    location: {
      display_name: "Des Moines, Iowa",
      lat: 41.5868,
      lng: -93.6250,
      boundingBox: { south: 41.42, north: 41.75, west: -93.86, east: -93.42 }
    }
  },
  "atlanta-ph": {
    id: "atlanta-ph",
    domain: "soil",
    property: "ph",
    depth: "0-15",
    label: "Atlanta",
    description: "pH · urban and vegetated soil",
    location: {
      display_name: "Atlanta, Georgia",
      lat: 33.7490,
      lng: -84.3880,
      boundingBox: { south: 33.56, north: 33.94, west: -84.62, east: -84.12 }
    }
  }
});

export const WATER_PRESETS = Object.freeze({
  "denver-temperature": {
    id: "denver-temperature", domain: "water", indicator: "temperature", systemType: "surface", label: "Denver", description: "Water temperature · South Platte screening",
    location: { display_name: "Denver, Colorado", lat: 39.7392, lng: -104.9903, boundingBox: { south: 39.55, north: 39.95, west: -105.25, east: -104.70 } }
  },
  "houston-turbidity": {
    id: "houston-turbidity", domain: "water", indicator: "turbidity", systemType: "surface", label: "Houston", description: "Turbidity · bayou and stormwater screening",
    location: { display_name: "Houston, Texas", lat: 29.7604, lng: -95.3698, boundingBox: { south: 29.45, north: 30.10, west: -95.75, east: -95.05 } }
  },
  "pittsburgh-conductance": {
    id: "pittsburgh-conductance", domain: "water", indicator: "specific_conductance", systemType: "surface", label: "Pittsburgh", description: "Conductance · river confluence screening",
    location: { display_name: "Pittsburgh, Pennsylvania", lat: 40.4406, lng: -79.9959, boundingBox: { south: 40.28, north: 40.58, west: -80.18, east: -79.78 } }
  },
  "portland-discharge": {
    id: "portland-discharge", domain: "water", indicator: "discharge", systemType: "surface", label: "Portland", description: "Discharge · watershed monitoring",
    location: { display_name: "Portland, Oregon", lat: 45.5152, lng: -122.6784, boundingBox: { south: 45.35, north: 45.68, west: -122.88, east: -122.45 } }
  }
});

const SHARED_FINAL_STEPS = Object.freeze([
  {
    id: "portfolio",
    title: "Generate alternative networks",
    body: "Generate balanced, information-first, exposure-first, equity-first, and cost-efficient networks, then switch among them without rerunning the model.",
    target: "#optimizeButton"
  },
  {
    id: "results",
    title: "Audit tradeoffs",
    body: "The right panel reports feasibility, uncertainty reduction, worst-group benefit, cost, reliability, scientific baselines, and an exact reduced-instance oracle.",
    target: "#resultsPanel"
  },
  {
    id: "intervention",
    title: "Evaluate interventions",
    body: "Switch to Post-intervention evaluation to design treatment, matched control, boundary, and spillover monitoring sites.",
    target: "#planningStageSection"
  },
  {
    id: "export",
    title: "Save and reproduce",
    body: "Save the workspace, export model inputs and results, or run the paper experiment tools. Every source and proxy remains labeled in the provenance panel.",
    target: "#workspacePersistenceControls"
  }
]);

export const UNIFIED_ONBOARDING_STEPS = Object.freeze([
  {
    id: "welcome",
    title: "Welcome to unified LUMOS",
    body: "LUMOS uses one socially constrained Bayesian monitoring engine with distinct Heat, Air, Soil, and Water adapters. The unified view audits that shared architecture before you open a domain workspace.",
    target: ".app-header"
  },
  {
    id: "adapters",
    title: "Review the four adapters",
    body: "Each adapter preserves its own field model, observations, transport assumptions, validation, robustness experiments, and intervention roles while sharing optimization and social-information constraints.",
    target: "#unifiedArchitectureSection"
  },
  {
    id: "audit",
    title: "Run the architecture audit",
    body: "The audit checks objective parity, workflow capabilities, required-source health contracts, systematic fallbacks, onboarding, intervention roles, release metadata, documented limitations, and scientific scope.",
    target: "#runCrossDomainAuditButton"
  },
  {
    id: "budget",
    title: "Allocate one shared budget",
    body: "Set an illustrative total budget, protected reserve, domain-specific unit costs, minimum viable programs, maximum program sizes, and public priorities. LUMOS evaluates feasible integer allocations across all four adapters.",
    target: "#unifiedBudgetSection"
  },
  {
    id: "budget-results",
    title: "Compare cross-domain portfolios",
    body: "Balanced, information, exposure, equity, resilience, and cost-efficient profiles report committed cost, normalized program benefit, reliability, worst-domain benefit, and the cross-domain balance gap.",
    target: "#crossDomainBudgetResultSection"
  },
  {
    id: "sequential-evidence",
    title: "Calibrate the next round from evidence",
    body: "Load named domain workspaces, use the latest autosave, or open the controlled example. LUMOS summarizes residual uncertainty, validated yield, reliability, equity need, and intervention readiness without treating modeled evidence as causal outcomes.",
    target: "#sequentialReallocationSection"
  },
  {
    id: "sequential-results",
    title: "Compare next-round portfolios",
    body: "The sequential portfolio distinguishes existing and additional units, enforces displayed equity, reliability, intervention, and minimum-program floors, and preserves an exploration share for domains with weak evidence.",
    target: "#sequentialResultSection"
  },
  {
    id: "adaptive-simulation",
    title: "Compare complete funding trajectories",
    body: "Choose the number of future rounds, round budget, evidence-transition scenario, and discount factor. LUMOS reruns the sequential allocator after each simulated evidence update and compares fixed and adaptive policies.",
    target: "#adaptiveSimulationSection"
  },
  {
    id: "adaptive-results",
    title: "Inspect multi-round tradeoffs",
    body: "Trajectory results report cumulative funding, discounted incremental benefit, terminal residual need, evidence strength, and the policy selected in every simulated round. These are scenario comparisons, not forecasts.",
    target: "#adaptiveSimulationResultSection"
  },
  {
    id: "robust-policy",
    title: "Stress-test complete trajectories",
    body: "Run a seeded uncertainty ensemble over evidence response, deployment cost, unit failure, and environmental conditions. LUMOS compares expected utility, downside performance, feasibility, and regret without presenting the draws as forecast probabilities.",
    target: "#robustPolicySection"
  },
  {
    id: "robust-results",
    title: "Choose a robust policy",
    body: "Compare the risk-adjusted recommendation with the expected-value, minimax-regret, and most-feasible policies. Export the complete scenario evidence for review.",
    target: "#robustPolicyResultSection"
  },
  {
    id: "spatial-deployment",
    title: "Coordinate physical deployment",
    body: "Translate an initial or sequential allocation into one shared host network. LUMOS preserves domain-specific suitability, spacing, access, power, reliability, and co-location compatibility while exposing the assumed infrastructure savings.",
    target: "#spatialDeploymentSection"
  },
  {
    id: "spatial-results",
    title: "Inspect shared-host tradeoffs",
    body: "Compare balanced, savings, coverage, equity, and failure-resilient site plans. Every mapped host remains an unverified mathematical proxy requiring permissions, safety checks, maintenance planning, and domain-specific field review.",
    target: "#spatialDeploymentResultSection"
  },
  {
    id: "field-campaign",
    title: "Stage inspections and reserve sites",
    body: "Convert the active deployment into phased field inspections and domain-specific reserve assignments. Review-response scenarios are deterministic planning assumptions, not predictions of owner approval or field safety.",
    target: "#fieldCampaignSection"
  },
  {
    id: "field-campaign-results",
    title: "Review rejection and replacement readiness",
    body: "Compare balanced, rapid-verification, coverage-protection, and resilience-first campaigns. Residual gaps remain visible whenever inspection capacity or eligible reserve hosts are insufficient.",
    target: "#fieldCampaignResultSection"
  },
  {
    id: "live-campaign",
    title: "Apply actual inspection outcomes",
    body: "Import append-only CSV or JSON field records, choose the latest completed phase, and preserve the complete status history. Controlled outcomes remain clearly labeled when used for demonstration.",
    target: "#campaignTrackingSection"
  },
  {
    id: "live-campaign-results",
    title: "Recompute the operational network",
    body: "Accepted and conditional hosts remain visible, rejected properties activate reviewed reserves, and unresolved assignment gaps stay explicit after every completed phase.",
    target: "#campaignTrackingResultSection"
  },
  {
    id: "commissioning",
    title: "Commission and maintain the network",
    body: "Import procurement, permit, installation, calibration or chain-of-custody, uptime, completeness, maintenance, and ticket records. Offline assets remain explicit and may activate eligible reviewed reserves.",
    target: "#commissioningSection"
  },
  {
    id: "commissioning-results",
    title: "Review operational readiness",
    body: "Inspect commissioned, provisional, pending, and offline assignments; installation phases; maintenance tickets; replacement-ready reserves; and modeled first-year operations cost.",
    target: "#commissioningResultSection"
  },
  {
    id: "map-focus",
    title: "Expand the map workspace",
    body: "Focus map collapses the header and both side panels for a near-full-window view. Press Escape or use the visible restore controls to return to the prior layout.",
    target: "#focusMapButton"
  },
  {
    id: "results",
    title: "Inspect adapter parity",
    body: "The right panel separates shared checks from domain-specific checks and exports a reproducible JSON and CSV audit bundle.",
    target: "#crossDomainAuditSection"
  },
  {
    id: "domains",
    title: "Open a scientific domain",
    body: "Choose Heat, Air, Soil, or Water above. The same map-centered workflow remains available, but each domain loads and validates its own scientific adapter.",
    target: ".workspace-page-header"
  }
]);

export const HEAT_ONBOARDING_STEPS = Object.freeze([
  {
    id: "welcome",
    title: "Welcome to LUMOS Heat",
    body: "Use live weather, environmental and social layers, Bayesian uncertainty, and hard fairness constraints to design a monitoring network for any reasonable U.S. locality.",
    target: ".app-header"
  },
  {
    id: "experience",
    title: "Choose the Heat experience",
    body: "Live Conditions explains what is happening now. Heat Risk and Monitoring is the scientific optimization workspace. Forecast Playback animates already-downloaded hourly predictions.",
    target: "#heatExperienceControls"
  },
  {
    id: "location",
    title: "Choose a Heat location",
    body: "Search the map, use your location, or open a Heat preset. Nationwide workspaces rebuild the complete active model around the fitted extent.",
    target: ".location-panel"
  },
  {
    id: "fit",
    title: "Fit the current area",
    body: "LUMOS validates the viewport, retrieves public data, builds the adaptive evaluation field, creates systematic candidates, and optionally enriches them with mapped public hosts.",
    target: "#fitScenarioButton"
  },
  {
    id: "priorities",
    title: "Set priorities and requirements",
    body: "Adjust monitor count, budget, scientific objectives, and hard social-information thresholds. Guardrails change numerical resolution, not the core Bayesian decision problem.",
    target: "#interventionPlanningControls"
  },
  ...SHARED_FINAL_STEPS
]);

export const AIR_ONBOARDING_STEPS = Object.freeze([
  {
    id: "welcome",
    title: "Welcome to LUMOS Air",
    body: "Fit a U.S. locality, choose a pollutant, combine atmospheric-model fields with wind, sources, exposure, and optional reference readings, then design a socially constrained monitoring network.",
    target: ".app-header"
  },
  {
    id: "pollutant",
    title: "Choose the Air pollutant",
    body: "Select PM2.5, PM10, nitrogen dioxide, or ozone. An optional OpenAQ key enables compatible current reference readings and held-out inference validation.",
    target: "#airWorkspaceControls"
  },
  {
    id: "location",
    title: "Choose an Air location",
    body: "Search the map or open a pollutant-specific Air preset. Each preset uses the same public APIs, guardrails, candidate generation, and optimization model as a manual fit.",
    target: ".location-panel"
  },
  {
    id: "fit",
    title: "Fit the current Air area",
    body: "LUMOS loads atmospheric composition, weather, Census social indicators, source proxies, systematic candidates, and optional reference monitors for the visible extent.",
    target: "#fitScenarioButton"
  },
  {
    id: "priorities",
    title: "Set Air priorities and requirements",
    body: "Adjust monitor count, budget, uncertainty, source detection, exposure, equity, reliability, and hard group-information requirements without simplifying the shared Bayesian model.",
    target: "#interventionPlanningControls"
  },
  {
    id: "validation",
    title: "Audit Air inference and robustness",
    body: "When reference values are available, inspect locked-monitor reconstruction. The robustness lab tests wind regimes, reading loss, candidate roles, and fairness thresholds.",
    target: "#airValidationSection"
  },
  ...SHARED_FINAL_STEPS
]);


export const SOIL_ONBOARDING_STEPS = Object.freeze([
  {
    id: "welcome",
    title: "Welcome to LUMOS Soil",
    body: "Fit a U.S. locality, choose a soil property or contaminant target, combine USDA soil survey information with optional local laboratory samples, validate the inferred field, and design a constrained sampling network.",
    target: ".app-header"
  },
  {
    id: "property",
    title: "Choose the soil property and depth",
    body: "Select a survey-supported soil property or a laboratory-dependent contaminant target. LUMOS aggregates major SSURGO components over the chosen depth interval and clearly labels contaminant screening until compatible samples are imported.",
    target: "#soilWorkspaceControls"
  },
  {
    id: "location",
    title: "Choose a soil study area",
    body: "Search or zoom to a local U.S. area. Soil sampling is most meaningful at local and county scales rather than across an entire state in one browser run.",
    target: ".location-panel"
  },
  {
    id: "fit",
    title: "Fit the current soil area",
    body: "LUMOS resolves SSURGO map units, loads component and horizon properties, adds Census social indicators, generates systematic sample sites, and optionally enriches them with mapped land uses. Imported laboratory samples remain local to the browser.",
    target: "#fitScenarioButton"
  },
  {
    id: "laboratory",
    title: "Import and validate laboratory samples",
    body: "Import CSV or JSON observations with coordinates, analyte, value, units, depth, date, and QA metadata. LUMOS fits a survey/source trend plus localized residual GP, reserves a locked sample set, and reports reconstruction and uncertainty calibration.",
    target: "#soilWorkspaceControls"
  },
  {
    id: "priorities",
    title: "Set sampling priorities and requirements",
    body: "Adjust sample count, budget, information gain, ecological representation, social equity, reliability, and hard group-information requirements without changing the shared Bayesian engine.",
    target: "#interventionPlanningControls"
  },
  {
    id: "validation",
    title: "Audit Soil inference and robustness",
    body: "Review locked-sample validation, recalibrate covariance, test split stability and sample loss, then export a publication-ready Soil evidence bundle.",
    target: "#soilValidationSection"
  },
  ...SHARED_FINAL_STEPS
]);


export const WATER_ONBOARDING_STEPS = Object.freeze([
  {
    id: "welcome", title: "Welcome to LUMOS Water",
    body: "Fit a U.S. locality, choose a surface-water or distribution screening context, combine recent USGS readings with flow, source, social, and ecological layers, then design a constrained monitoring or inspection network.",
    target: ".app-header"
  },
  {
    id: "indicator", title: "Choose the Water system and indicator",
    body: "Select water temperature, dissolved oxygen, pH, conductance, turbidity, or discharge. The distribution option remains an explicit proxy until authoritative local pipe topology is supplied.",
    target: "#waterWorkspaceControls"
  },
  {
    id: "location", title: "Choose a Water study area",
    body: "Search or zoom to a local watershed, river corridor, or service-area proxy. Presets use the same public-data and optimization workflow as a manual fit.",
    target: ".location-panel"
  },
  {
    id: "fit", title: "Fit the current Water area",
    body: "LUMOS loads recent USGS readings, mapped waterways and source proxies, Census social indicators, a directional flow-network approximation, and systematic sampling candidates.",
    target: "#fitScenarioButton"
  },
  {
    id: "priorities", title: "Set monitoring priorities and requirements",
    body: "Balance total information, source detection, downstream exposure, ecological representation, social equity, reliability, cost, and spacing through the shared constrained Bayesian engine.",
    target: "#interventionPlanningControls"
  },
  ...SHARED_FINAL_STEPS
]);

// Backward-compatible export used by existing tests and integrations.
export const ONBOARDING_STEPS = HEAT_ONBOARDING_STEPS;

export function onboardingStepsForDomain(domainKey) {
  if (domainKey === "core") return UNIFIED_ONBOARDING_STEPS;
  return domainKey === "air" ? AIR_ONBOARDING_STEPS : domainKey === "soil" ? SOIL_ONBOARDING_STEPS : domainKey === "water" ? WATER_ONBOARDING_STEPS : HEAT_ONBOARDING_STEPS;
}

export function presetForDomain(domainKey, presetId) {
  if (domainKey === "air") return AIR_PRESETS[presetId];
  if (domainKey === "soil") return SOIL_PRESETS[presetId];
  if (domainKey === "water") return WATER_PRESETS[presetId];
  return HEAT_PRESETS[presetId];
}

export function clampOnboardingStep(index, steps = ONBOARDING_STEPS) {
  return Math.max(0, Math.min(Math.max(0, steps.length - 1), Number(index) || 0));
}
