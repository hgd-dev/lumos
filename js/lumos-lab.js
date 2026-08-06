import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "./config/domain-registry.js";

const STORAGE_KEY = "lumoslab-projects-v1";
const ACTIVE_KEY = "lumoslab-active-project-v1";
const FORMAT_VERSION = 1;
const DOMAIN_GLYPHS = Object.freeze({ heat: "H", air: "A", soil: "S", water: "W" });
const DOMAIN_COPY = Object.freeze({
  heat: "Heat fields, exposure, canopy, apparent temperature, and cooling interventions.",
  air: "Pollutant-specific, wind-aware networks with calibration and source roles.",
  soil: "Survey and laboratory evidence for sampling and remediation evaluation.",
  water: "Indicator-specific, flow-aware sampling and intervention monitoring."
});
const PROVENANCE = Object.freeze({
  heat: [
    ["Weather conditions", "Field trend and live context", "Station / gridded", "Live or recent", "Weather does not replace local surface measurements."],
    ["Land cover and canopy", "Heat modifiers", "Block / raster", "Periodic", "Resolution and seasonal canopy assumptions can affect local gradients."],
    ["Population and vulnerability", "Exposure and equity", "Census geography", "Annual / survey cycle", "Demographic indicators are not direct measurements of heat exposure."],
    ["Existing sensors", "Calibration and network baseline", "Point observations", "Network dependent", "Coverage and calibration quality vary by operator."]
  ],
  air: [
    ["Regulatory and public monitors", "Observation and calibration", "Point observations", "Hourly to annual", "Sparse networks may not represent near-source variation."],
    ["Meteorology", "Transport orientation", "Station / gridded", "Live or recent", "Planning anisotropy is an approximation of atmospheric transport."],
    ["Sources and roads", "Trend and candidate context", "Point / line / polygon", "Variable", "Inventories can be incomplete or temporally mismatched."],
    ["Population and vulnerability", "Exposure and equity", "Census geography", "Annual / survey cycle", "Population proxies do not establish individual exposure."]
  ],
  soil: [
    ["Soil survey properties", "Background trend", "Map unit / raster", "Periodic", "Survey properties are not substitutes for contaminant samples."],
    ["Laboratory samples", "Observed analyte evidence", "Point and depth interval", "Campaign dependent", "Methods, detection limits, and chain of custody must be harmonized."],
    ["Land use and sources", "Prior and stratification", "Parcel / polygon", "Variable", "Historic activity layers can be incomplete."],
    ["Community priorities", "Sampling emphasis", "User-defined", "Project specific", "Priority areas should be documented independently from modeled risk."]
  ],
  water: [
    ["Water-quality observations", "Indicator evidence", "Station / sample", "Variable", "Sampling frequency and laboratory methods can differ across sites."],
    ["Hydrography and flow", "Directional structure", "Reach / catchment", "Periodic", "Static networks may not represent event-specific hydraulic behavior."],
    ["Facilities and sources", "Upstream context", "Point / polygon", "Variable", "Presence does not establish discharge magnitude or causality."],
    ["Communities and receptors", "Exposure and equity", "Census / facility", "Annual / survey cycle", "Receptor proximity is a planning proxy, not a health finding."]
  ]
});

let projects = loadProjects();
let activeId = localStorage.getItem(ACTIVE_KEY) || projects[0]?.id || null;
let activeView = "plan";
let currentAnalysis = null;
let currentData = null;
let playbackTimer = null;
let selectedTradeoffIndex = 4;

function nowIso() { return new Date().toISOString(); }
function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, Number(value) || 0)); }
function percent(value) { return `${Math.round(clamp(value) * 100)}%`; }
function money(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function slug(value) { return String(value || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "plan"; }
function uid(prefix = "plan") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function hashString(value) { let hash = 2166136261; for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seededRandom(seed) { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let result = state; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4294967296; }; }
function normalizeWeights(weights) { const sum = Object.values(weights).reduce((total, value) => total + Math.max(0, Number(value) || 0), 0) || 1; return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0, Number(value) || 0) / sum])); }
function domainConfig(domain) { return DOMAIN_REGISTRY[domain] || DOMAIN_REGISTRY.heat; }
function activeProject() { return projects.find((project) => project.id === activeId) || null; }
function notifyProjectChange(reason = "update") {
  const project = activeProject();
  window.dispatchEvent(new CustomEvent("lumoslab:project-change", { detail: { reason, project: project ? structuredClone(project) : null } }));
}

function defaultProject(overrides = {}) {
  const created = nowIso();
  return {
    format: "lumoslab-project",
    formatVersion: FORMAT_VERSION,
    id: uid(),
    name: "Community monitoring plan",
    domain: "heat",
    region: "New York City",
    budget: 60000,
    units: 10,
    objective: "balanced",
    mode: "fixed",
    priority: "Improve information quality near schools, public housing, outdoor workers, and neighborhoods with limited existing monitoring.",
    weights: { information: 30, exposure: 20, equity: 25, robustness: 15, intervention: 10 },
    constraints: { equity: true, access: true, power: false, failure: true },
    intervention: { description: "Neighborhood cooling and shade intervention", treatmentArea: "Target neighborhoods", controlArea: "Matched comparison neighborhoods", preWeeks: 8, postWeeks: 12, effectSize: "moderate", spilloverConcern: "moderate" },
    createdAt: created,
    updatedAt: created,
    analysis: null,
    ...overrides
  };
}

function loadProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed.filter((project) => project?.format === "lumoslab-project");
  } catch (error) { console.warn("Could not restore LUMOSLab projects", error); }
  const starter = defaultProject();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([starter]));
  return [starter];
}
function persistProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
}

function readForm() {
  return {
    name: document.querySelector("#planName").value.trim() || "Untitled plan",
    domain: document.querySelector("#planDomain").value,
    region: document.querySelector("#planRegion").value.trim() || "Unspecified study area",
    budget: Math.max(1000, Number(document.querySelector("#planBudget").value) || 1000),
    units: Math.max(2, Math.min(60, Number(document.querySelector("#planUnits").value) || 2)),
    objective: document.querySelector("#planObjective").value,
    mode: document.querySelector("#planMode").value,
    priority: document.querySelector("#planPriority").value.trim(),
    weights: {
      information: Number(document.querySelector("#weightInformation").value),
      exposure: Number(document.querySelector("#weightExposure").value),
      equity: Number(document.querySelector("#weightEquity").value),
      robustness: Number(document.querySelector("#weightRobustness").value),
      intervention: Number(document.querySelector("#weightIntervention").value)
    },
    constraints: {
      equity: document.querySelector("#constraintEquity").checked,
      access: document.querySelector("#constraintAccess").checked,
      power: document.querySelector("#constraintPower").checked,
      failure: document.querySelector("#constraintFailure").checked
    }
  };
}
function writeForm(project) {
  document.querySelector("#planName").value = project.name;
  document.querySelector("#planDomain").value = project.domain;
  document.querySelector("#planRegion").value = project.region;
  document.querySelector("#planBudget").value = project.budget;
  document.querySelector("#planUnits").value = project.units;
  document.querySelector("#planObjective").value = project.objective;
  document.querySelector("#planMode").value = project.mode;
  document.querySelector("#planPriority").value = project.priority || "";
  for (const [key, value] of Object.entries(project.weights || {})) {
    const input = document.querySelector(`#weight${key[0].toUpperCase()}${key.slice(1)}`);
    if (input) input.value = value;
  }
  for (const [key, value] of Object.entries(project.constraints || {})) {
    const input = document.querySelector(`#constraint${key[0].toUpperCase()}${key.slice(1)}`);
    if (input) input.checked = Boolean(value);
  }
  updateSliderOutputs();
  writeInterventionForm(project.intervention || defaultProject().intervention);
}
function readInterventionForm() {
  return {
    description: document.querySelector("#interventionDescription").value.trim(),
    treatmentArea: document.querySelector("#treatmentArea").value.trim(),
    controlArea: document.querySelector("#controlArea").value.trim(),
    preWeeks: Number(document.querySelector("#preWeeks").value) || 1,
    postWeeks: Number(document.querySelector("#postWeeks").value) || 1,
    effectSize: document.querySelector("#effectSize").value,
    spilloverConcern: document.querySelector("#spilloverConcern").value
  };
}
function writeInterventionForm(intervention) {
  document.querySelector("#interventionDescription").value = intervention.description || "";
  document.querySelector("#treatmentArea").value = intervention.treatmentArea || "";
  document.querySelector("#controlArea").value = intervention.controlArea || "";
  document.querySelector("#preWeeks").value = intervention.preWeeks || 8;
  document.querySelector("#postWeeks").value = intervention.postWeeks || 12;
  document.querySelector("#effectSize").value = intervention.effectSize || "moderate";
  document.querySelector("#spilloverConcern").value = intervention.spilloverConcern || "moderate";
}

function updateSliderOutputs() {
  const ids = ["Information", "Exposure", "Equity", "Robustness", "Intervention"];
  for (const id of ids) document.querySelector(`#weight${id}Value`).textContent = `${document.querySelector(`#weight${id}`).value}%`;
  for (const [id, suffix] of [["failureRate", "%"], ["missingRate", "%"], ["costOverrun", "%"], ["environmentShift", "%"]]) {
    document.querySelector(`#${id}Value`).textContent = `${document.querySelector(`#${id}`).value}${suffix}`;
  }
}

function objectiveBoost(objective, key) {
  const map = {
    balanced: {}, uncertainty: { information: .09 }, equity: { equity: .1 }, exposure: { exposure: .1 },
    intervention: { intervention: .11 }, resilience: { robustness: .1 }
  };
  return map[objective]?.[key] || 0;
}

function calculateMetrics(project) {
  const registry = domainConfig(project.domain);
  const planning = registry.planning;
  const weights = normalizeWeights(project.weights);
  const affordableUnits = Math.max(1, Math.floor(project.budget / planning.unitCost));
  const deployedUnits = Math.min(project.units, affordableUnits, planning.maximumUnits);
  const saturation = 1 - Math.exp(-deployedUnits / Math.max(2, planning.saturationUnits));
  const budgetUse = clamp((deployedUnits * planning.unitCost) / project.budget);
  const reliabilityBase = planning.unitReliability;
  const information = clamp(.25 + .66 * saturation * planning.dimensionPotential.information + .18 * weights.information + objectiveBoost(project.objective, "information"));
  const exposure = clamp(.2 + .62 * saturation * planning.dimensionPotential.exposure + .2 * weights.exposure + objectiveBoost(project.objective, "exposure"));
  const equityConstraint = project.constraints.equity ? .08 : -.035;
  const equity = clamp(.2 + .54 * saturation * planning.dimensionPotential.equity + .22 * weights.equity + equityConstraint + objectiveBoost(project.objective, "equity"));
  const redundancyPenalty = deployedUnits <= 3 ? .09 : 0;
  const failureBonus = project.constraints.failure ? .075 : 0;
  const robustness = clamp(.24 + .48 * reliabilityBase + .16 * saturation + .2 * weights.robustness + failureBonus - redundancyPenalty + objectiveBoost(project.objective, "robustness"));
  const interventionMode = ["intervention", "mixed"].includes(project.mode) ? .09 : 0;
  const intervention = clamp(.17 + .56 * saturation * planning.dimensionPotential.intervention + .2 * weights.intervention + interventionMode + objectiveBoost(project.objective, "intervention"));
  const fairnessGap = clamp(.36 - equity * .28 - (project.constraints.equity ? .06 : 0), 0, .5);
  const composite = clamp(information * weights.information + exposure * weights.exposure + equity * weights.equity + robustness * weights.robustness + intervention * weights.intervention);
  return {
    information, exposure, equity, robustness, intervention, fairnessGap, composite,
    deployedUnits, affordableUnits, budgetUse, plannedCost: deployedUnits * planning.unitCost,
    unitCost: planning.unitCost, unitLabel: planning.unitLabel,
    feasible: project.units <= affordableUnits && (!project.constraints.power || project.domain === "air" || project.domain === "water")
  };
}

function generateCandidates(project, metrics) {
  const seed = hashString(`${project.id}|${project.name}|${project.domain}|${project.region}|${project.budget}|${project.units}|${JSON.stringify(project.weights)}|${JSON.stringify(project.constraints)}`);
  const random = seededRandom(seed);
  const count = Math.max(20, Math.min(52, metrics.deployedUnits * 3));
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const x = 62 + random() * 676;
    const y = 55 + random() * 355;
    const priority = clamp(.18 + random() * .82);
    const uncertainty = clamp(.2 + random() * .8);
    const exposure = clamp(.16 + random() * .84);
    const access = clamp(.3 + random() * .7);
    const resilience = clamp(.25 + random() * .75);
    const score = uncertainty * .34 + exposure * .22 + priority * .24 + access * .09 + resilience * .11;
    candidates.push({ id: `C${String(index + 1).padStart(2, "0")}`, x, y, priority, uncertainty, exposure, access, resilience, score });
  }
  const selected = [...candidates].sort((a, b) => b.score - a.score).slice(0, Math.min(metrics.deployedUnits, 14));
  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  return candidates.map((candidate) => ({ ...candidate, selected: selectedIds.has(candidate.id), rank: selected.findIndex((item) => item.id === candidate.id) + 1 }));
}

function buildAnalysis(project) {
  const metrics = calculateMetrics(project);
  const candidates = generateCandidates(project, metrics);
  const selected = candidates.filter((candidate) => candidate.selected).sort((a, b) => a.rank - b.rank);
  const analysis = { generatedAt: nowIso(), metrics, candidates, selected };
  project.analysis = analysis;
  project.updatedAt = nowIso();
  currentAnalysis = analysis;
  persistProjects();
  renderAnalysis(project, analysis);
  renderComparison();
  renderTradeoffs();
  updateReproducibility(project);
  return analysis;
}

function renderDomainLaunchers() {
  const grid = document.querySelector("#domainLauncherGrid");
  grid.innerHTML = PUBLIC_DOMAIN_KEYS.map((domain) => `<a class="lab-domain-card" href="${domain}.html"><span class="lab-domain-icon">${DOMAIN_GLYPHS[domain]}</span><span><strong>${domainConfig(domain).displayName}</strong><small>${DOMAIN_COPY[domain]}</small></span></a>`).join("");
  const continuation = document.querySelector("#workspaceContinuationGrid");
  continuation.innerHTML = `<a href="unified.html"><strong>Unified</strong><small>Cross-domain budgets, sequential allocation, field deployment, and operations.</small></a>${PUBLIC_DOMAIN_KEYS.map((domain) => `<a href="${domain}.html"><strong>${domainConfig(domain).displayName}</strong><small>${escapeHtml(domainConfig(domain).primaryField)}</small></a>`).join("")}`;
}

function renderSavedPlans() {
  const list = document.querySelector("#savedPlanList");
  list.innerHTML = projects.map((project) => `<div class="saved-plan-item ${project.id === activeId ? "active" : ""}"><button type="button" data-project-id="${project.id}"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(domainConfig(project.domain).displayName)} · ${escapeHtml(project.region)}</small></button><span>${project.analysis ? Math.round(project.analysis.metrics.composite * 100) : "—"}</span></div>`).join("");
  for (const button of list.querySelectorAll("button[data-project-id]")) button.addEventListener("click", () => selectProject(button.dataset.projectId));
  const project = activeProject();
  document.querySelector("#activeProjectLabel").textContent = project?.name || "Untitled plan";
  document.querySelector("#activeProjectMeta").textContent = project ? `${domainConfig(project.domain).displayName} · updated ${new Date(project.updatedAt).toLocaleDateString()}` : "No saved scenario";
}

function selectProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  activeId = id;
  currentAnalysis = project.analysis || null;
  persistProjects();
  writeForm(project);
  renderSavedPlans();
  renderAnalysis(project, currentAnalysis || buildAnalysis(project));
  renderComparisonPicker();
  renderProvenance();
  updateReproducibility(project);
  document.querySelector("#planStatus").textContent = `Loaded ${project.name}.`;
  notifyProjectChange("select");
}

function createNewProject() {
  const project = defaultProject({ name: `Monitoring plan ${projects.length + 1}` });
  projects.unshift(project);
  activeId = project.id;
  persistProjects();
  writeForm(project);
  renderSavedPlans();
  renderComparisonPicker();
  renderProvenance();
  buildAnalysis(project);
  setView("plan");
  document.querySelector("#planName").focus();
  notifyProjectChange("create");
}

function saveActiveProject() {
  let project = activeProject();
  if (!project) {
    project = defaultProject();
    projects.unshift(project);
    activeId = project.id;
  }
  Object.assign(project, readForm(), { intervention: readInterventionForm(), updatedAt: nowIso() });
  project.analysis = buildAnalysis(project);
  persistProjects();
  renderSavedPlans();
  renderComparisonPicker();
  renderProvenance();
  document.querySelector("#planStatus").textContent = `Saved ${project.name}. Planning preview refreshed.`;
  notifyProjectChange("save");
}

function duplicateActiveProject() {
  const source = activeProject() || defaultProject();
  const project = structuredClone(source);
  project.id = uid();
  project.name = `${source.name} copy`;
  project.createdAt = nowIso();
  project.updatedAt = project.createdAt;
  project.analysis = null;
  projects.unshift(project);
  activeId = project.id;
  persistProjects();
  writeForm(project);
  renderSavedPlans();
  renderComparisonPicker();
  buildAnalysis(project);
  document.querySelector("#planStatus").textContent = "Created a separate scenario copy for comparison.";
  notifyProjectChange("duplicate");
}

function deleteActiveProject() {
  if (projects.length <= 1) {
    const reset = defaultProject({ id: projects[0]?.id || uid() });
    projects = [reset];
    activeId = reset.id;
  } else {
    projects = projects.filter((project) => project.id !== activeId);
    activeId = projects[0].id;
  }
  persistProjects();
  selectProject(activeId);
}

function setView(view) {
  activeView = view;
  for (const button of document.querySelectorAll("[data-lab-view]")) button.classList.toggle("active", button.dataset.labView === view && button.closest(".lab-view-nav"));
  for (const panel of document.querySelectorAll("[data-lab-panel]")) panel.classList.toggle("active", panel.dataset.labPanel === view);
  if (view === "compare") renderComparison();
  if (view === "data") renderProvenance();
  if (view === "tradeoffs") renderTradeoffs();
  if (view === "timeline") renderTimeline();
  if (view === "export") updateReproducibility(activeProject());
  window.dispatchEvent(new CustomEvent("lumoslab:view-change", { detail: { view } }));
  document.querySelector(`.lab-view[data-lab-panel="${view}"]`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function renderAnalysis(project, analysis) {
  if (!analysis) analysis = buildAnalysis(project);
  currentAnalysis = analysis;
  const metrics = analysis.metrics;
  const cards = [
    ["Information", percent(metrics.information), "posterior knowledge"], ["Equity", percent(metrics.equity), `gap ${percent(metrics.fairnessGap)}`],
    ["Robustness", percent(metrics.robustness), "failure resilience"], ["Intervention", percent(metrics.intervention), "evaluation readiness"],
    ["Composite", percent(metrics.composite), `${metrics.deployedUnits} ${metrics.unitLabel}${metrics.deployedUnits === 1 ? "" : "s"}`]
  ];
  document.querySelector("#analysisMetricGrid").innerHTML = cards.map(([label, value, detail]) => `<article class="lab-metric"><span>${label}</span><strong>${value}</strong><small>${escapeHtml(detail)}</small></article>`).join("");
  document.querySelector("#analysisMapSubtitle").textContent = `${domainConfig(project.domain).displayName} · ${project.region} · ${money(metrics.plannedCost)} planned`;
  renderAnalysisMap(analysis.candidates);
  document.querySelector("#recommendationList").innerHTML = analysis.selected.map((site) => {
    const contributions = [
      ["uncertainty", site.uncertainty, "reduces uncertainty"], ["priority", site.priority, "supports priority areas"],
      ["exposure", site.exposure, "improves exposure coverage"], ["resilience", site.resilience, "adds network resilience"]
    ].sort((a, b) => b[1] - a[1]);
    const top = contributions.slice(0, 2).map((item) => item[2]).join(" and ");
    return `<article class="recommendation-item"><header><strong>Site ${site.id}</strong><span>#${site.rank} · ${Math.round(site.score * 100)}</span></header><p>Selected because it ${top}, while retaining an access score of ${Math.round(site.access * 100)}%.</p><div class="contribution-bar" aria-label="Relative site value"><i style="width:${Math.round(site.score * 100)}%"></i></div></article>`;
  }).join("");
  renderReadiness(project, metrics);
}

function renderAnalysisMap(candidates, visibleSelected = null) {
  const svg = document.querySelector("#analysisMap");
  const grid = [];
  for (let x = 40; x <= 760; x += 60) grid.push(`<line class="grid-line" x1="${x}" y1="20" x2="${x}" y2="450"></line>`);
  for (let y = 30; y <= 450; y += 60) grid.push(`<line class="grid-line" x1="20" y1="${y}" x2="780" y2="${y}"></line>`);
  const zones = `<ellipse class="priority-zone" cx="240" cy="170" rx="130" ry="84"></ellipse><ellipse class="priority-zone" cx="580" cy="312" rx="150" ry="95"></ellipse>`;
  const circles = candidates.map((candidate) => {
    const hidden = candidate.selected && visibleSelected !== null && candidate.rank > visibleSelected;
    const radius = candidate.selected ? 8 : 3.5 + candidate.priority * 2;
    return `<g><circle class="candidate ${candidate.selected ? "selected" : ""} ${hidden ? "playback-hidden" : ""}" cx="${candidate.x.toFixed(1)}" cy="${candidate.y.toFixed(1)}" r="${radius.toFixed(1)}"><title>${candidate.id}: score ${Math.round(candidate.score * 100)}</title></circle>${candidate.selected && !hidden ? `<text class="site-label" x="${(candidate.x + 11).toFixed(1)}" y="${(candidate.y + 4).toFixed(1)}">${candidate.id}</text>` : ""}</g>`;
  }).join("");
  svg.innerHTML = `${grid.join("")}${zones}${circles}`;
}

function playOptimization() {
  if (!currentAnalysis) buildAnalysis(activeProject());
  clearInterval(playbackTimer);
  let visible = 0;
  const total = currentAnalysis.selected.length;
  const status = document.querySelector("#analysisPlaybackStatus");
  status.textContent = `0 / ${total} selected`;
  renderAnalysisMap(currentAnalysis.candidates, 0);
  playbackTimer = window.setInterval(() => {
    visible += 1;
    renderAnalysisMap(currentAnalysis.candidates, visible);
    const site = currentAnalysis.selected[visible - 1];
    status.textContent = site ? `Selected ${site.id} · ${visible} / ${total}` : `${visible} / ${total}`;
    if (visible >= total) {
      clearInterval(playbackTimer);
      playbackTimer = null;
      status.textContent = `Portfolio complete · ${total} sites`;
    }
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 520);
}

function renderReadiness(project, metrics) {
  const checks = [
    { label: "Budget feasibility", status: project.units <= metrics.affordableUnits ? "pass" : "fail", detail: project.units <= metrics.affordableUnits ? `${project.units} requested units fit the declared budget.` : `Budget supports about ${metrics.affordableUnits} units at the registry planning cost.` },
    { label: "Candidate access", status: project.constraints.access ? "pass" : "warn", detail: project.constraints.access ? "Field access and permission review is enabled." : "Candidate sites are not being filtered for access or permission." },
    { label: "Equity protection", status: project.constraints.equity ? "pass" : "warn", detail: project.constraints.equity ? "Minimum group information is represented in the plan." : "The plan may optimize averages without a group-level information floor." },
    { label: "Evidence status", status: currentData ? "pass" : "warn", detail: currentData ? "A local file has been reviewed in this session." : "No project-specific observation file has been reviewed in LUMOSLab." }
  ];
  document.querySelector("#readinessChecks").innerHTML = checks.map((check) => `<article class="readiness-item ${check.status}"><strong>${escapeHtml(check.label)} · ${check.status.toUpperCase()}</strong><small>${escapeHtml(check.detail)}</small></article>`).join("");
}

function renderComparisonPicker() {
  const selectedIds = projects.slice(0, 3).map((project) => project.id);
  document.querySelector("#comparisonPicker").innerHTML = projects.map((project) => `<label><input type="checkbox" value="${project.id}" ${selectedIds.includes(project.id) ? "checked" : ""}><span>${escapeHtml(project.name)}</span></label>`).join("");
  for (const input of document.querySelectorAll("#comparisonPicker input")) input.addEventListener("change", renderComparison);
}
function comparisonSelection() {
  const checked = [...document.querySelectorAll("#comparisonPicker input:checked")].map((input) => input.value).slice(0, 3);
  const selected = checked.map((id) => projects.find((project) => project.id === id)).filter(Boolean);
  return selected.length ? selected : projects.slice(0, 3);
}
function renderComparison() {
  if (!document.querySelector("#comparisonPicker input")) renderComparisonPicker();
  const selected = comparisonSelection().map((project) => ({ project, metrics: project.analysis?.metrics || calculateMetrics(project) }));
  const bestScore = Math.max(...selected.map((item) => item.metrics.composite), 0);
  document.querySelector("#comparisonCards").innerHTML = selected.map(({ project, metrics }) => `<article class="comparison-card ${metrics.composite === bestScore ? "best" : ""}"><strong>${escapeHtml(project.name)}</strong><small>${domainConfig(project.domain).displayName} · ${escapeHtml(project.region)}</small><span class="score">${percent(metrics.composite)}</span><small>${metrics.composite === bestScore ? "Highest composite among selected plans" : `${percent(bestScore - metrics.composite)} behind selected leader`}</small></article>`).join("");
  document.querySelector("#comparisonTableBody").innerHTML = selected.map(({ project, metrics }) => `<tr class="${metrics.composite === bestScore ? "best-row" : ""}"><td>${escapeHtml(project.name)}</td><td>${domainConfig(project.domain).displayName}</td><td>${percent(metrics.information)}</td><td>${percent(metrics.equity)}</td><td>${percent(metrics.robustness)}</td><td>${percent(metrics.intervention)}</td><td>${percent(metrics.budgetUse)}</td><td>${percent(metrics.composite)}</td></tr>`).join("");
}

function renderProvenance(project = activeProject() || defaultProject()) {
  const rows = PROVENANCE[project.domain] || PROVENANCE.heat;
  document.querySelector("#provenanceTableBody").innerHTML = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
}

async function readDataFile(file) {
  if (!file) return;
  const text = await file.text();
  let rows = [];
  let columns = [];
  let type = file.name.toLowerCase().endsWith(".csv") ? "CSV" : "JSON";
  try {
    if (type === "CSV") {
      const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 5001);
      columns = parseCsvLine(lines[0] || "");
      rows = lines.slice(1).map(parseCsvLine);
    } else {
      const parsed = JSON.parse(text);
      const records = parsed.type === "FeatureCollection" ? parsed.features.map((feature) => ({ ...feature.properties, geometry: feature.geometry })) : Array.isArray(parsed) ? parsed : [parsed];
      rows = records.slice(0, 5000);
      columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
      if (parsed.type === "FeatureCollection") type = "GeoJSON";
    }
    currentData = { name: file.name, size: file.size, type, rows, columns, reviewedAt: nowIso() };
    renderDataSummary();
    populateColumnSelectors(columns);
    renderReadiness(activeProject(), currentAnalysis?.metrics || calculateMetrics(activeProject()));
  } catch (error) {
    currentData = null;
    document.querySelector("#dataFileSummary").innerHTML = `<article class="readiness-item fail"><strong>Could not parse file</strong><small>${escapeHtml(error.message)}</small></article>`;
  }
}
function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}
function renderDataSummary() {
  const data = currentData;
  if (!data) return;
  document.querySelector("#dataFileSummary").innerHTML = `<dl><dt>File</dt><dd>${escapeHtml(data.name)}</dd><dt>Type</dt><dd>${data.type}</dd><dt>Rows reviewed</dt><dd>${data.rows.length.toLocaleString()}</dd><dt>Columns</dt><dd>${data.columns.length}</dd><dt>Size</dt><dd>${(data.size / 1024).toFixed(1)} KiB</dd></dl>`;
}
function populateColumnSelectors(columns) {
  for (const id of ["latitudeColumn", "longitudeColumn", "measurementColumn", "groupColumn"]) {
    const select = document.querySelector(`#${id}`);
    const previous = select.value;
    select.innerHTML = `<option value="">Not mapped</option>${columns.map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`).join("")}`;
    if (columns.includes(previous)) select.value = previous;
  }
  const lower = columns.map((column) => String(column).toLowerCase());
  const auto = (id, candidates) => {
    const foundIndex = lower.findIndex((column) => candidates.some((candidate) => column === candidate || column.includes(candidate)));
    if (foundIndex >= 0) document.querySelector(`#${id}`).value = columns[foundIndex];
  };
  auto("latitudeColumn", ["latitude", "lat"]); auto("longitudeColumn", ["longitude", "lon", "lng"]); auto("measurementColumn", ["value", "measurement", "result", "concentration", "temperature"]); auto("groupColumn", ["group", "priority", "community", "population"]);
}
function validateDataMapping() {
  const results = [];
  if (!currentData) results.push({ status: "fail", label: "File required", detail: "Choose a CSV, JSON, or GeoJSON file first." });
  else {
    const latitude = document.querySelector("#latitudeColumn").value;
    const longitude = document.querySelector("#longitudeColumn").value;
    const measurement = document.querySelector("#measurementColumn").value;
    results.push({ status: latitude && longitude ? "pass" : "warn", label: "Coordinates", detail: latitude && longitude ? `${latitude} and ${longitude} are mapped.` : "Map latitude and longitude for point-based analysis, or continue with geometry in GeoJSON." });
    results.push({ status: measurement ? "pass" : "warn", label: "Measurement", detail: measurement ? `${measurement} is mapped as the observed value.` : "No measurement column is mapped; the file may still serve as candidate or priority data." });
    results.push({ status: currentData.rows.length >= 5 ? "pass" : "warn", label: "Record count", detail: `${currentData.rows.length} records were reviewed. Very small files may not support stable field inference.` });
  }
  document.querySelector("#dataValidationResults").innerHTML = results.map((result) => `<article class="readiness-item ${result.status}"><strong>${escapeHtml(result.label)} · ${result.status.toUpperCase()}</strong><small>${escapeHtml(result.detail)}</small></article>`).join("");
}

function evaluateIntervention() {
  const project = activeProject();
  project.intervention = readInterventionForm();
  project.updatedAt = nowIso();
  const metrics = project.analysis?.metrics || calculateMetrics(project);
  const intervention = project.intervention;
  const effect = { small: .62, moderate: .78, large: .9 }[intervention.effectSize];
  const timeBalance = clamp(1 - Math.abs(intervention.preWeeks - intervention.postWeeks) / Math.max(intervention.preWeeks + intervention.postWeeks, 1));
  const spillover = { low: .92, moderate: .76, high: .58 }[intervention.spilloverConcern];
  const comparison = intervention.controlArea.length >= 5 ? .86 : .45;
  const readiness = clamp(metrics.intervention * .42 + effect * .18 + timeBalance * .14 + spillover * .12 + comparison * .14);
  persistProjects();
  const rows = [
    ["Treatment–comparison structure", comparison, comparison > .7 ? "Treatment and comparison areas are declared; matching quality still requires full diagnostics." : "A clearer comparison area is needed."],
    ["Pre/post balance", timeBalance, `${intervention.preWeeks} pre-period weeks and ${intervention.postWeeks} post-period weeks are declared.`],
    ["Spillover protection", spillover, `${intervention.spilloverConcern} spillover concern changes boundary and supplemental monitoring needs.`],
    ["Overall design readiness", readiness, "Planning readiness combines the saved network profile and declared evaluation assumptions."]
  ];
  document.querySelector("#interventionResults").innerHTML = rows.map(([label, score, detail]) => `<article class="lab-result-row"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(detail)}</p><span>${percent(score)}</span></article>`).join("");
}

function runStressTests() {
  const project = activeProject();
  const base = project.analysis?.metrics || calculateMetrics(project);
  const failure = Number(document.querySelector("#failureRate").value) / 100;
  const missing = Number(document.querySelector("#missingRate").value) / 100;
  const cost = Number(document.querySelector("#costOverrun").value) / 100;
  const environment = Number(document.querySelector("#environmentShift").value) / 100;
  const access = document.querySelector("#stressAccess").checked ? .06 : 0;
  const calibration = document.querySelector("#stressCalibration").checked ? .07 : 0;
  const communications = document.querySelector("#stressCommunications").checked ? .05 : 0;
  const informationRetained = clamp(base.information * (1 - failure * .46 - missing * .38 - environment * .2 - access));
  const equityRetained = clamp(base.equity * (1 - failure * .3 - missing * .24 - access * .45));
  const operational = clamp(base.robustness * (1 - failure * .5 - cost * .18 - calibration - communications));
  const budgetFeasibility = clamp(1 - cost - Math.max(0, base.budgetUse - .85) * .5);
  const cards = [
    ["Information retained", informationRetained, "Posterior knowledge remaining under the declared combined stress."],
    ["Equity retained", equityRetained, "Protection of priority-group information after site and data loss."],
    ["Operational resilience", operational, "Reliability after failure, calibration, and communication disruptions."],
    ["Budget feasibility", budgetFeasibility, "Ability to absorb the declared cost overrun without reducing the portfolio."]
  ];
  document.querySelector("#stressResultGrid").innerHTML = cards.map(([label, score, detail]) => `<article class="stress-card"><strong>${escapeHtml(label)}</strong><span>${percent(score)}</span><small>${escapeHtml(detail)}</small></article>`).join("");
}

function buildTradeoffPoints(project) {
  const base = calculateMetrics(project);
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const equityShare = .08 + index * .085;
    const informationShare = .86 - index * .045 + Math.sin(index * .8) * .018;
    points.push({
      index, equity: clamp(base.equity * .55 + equityShare * .55), information: clamp(base.information * .55 + informationShare * .5),
      robustness: clamp(base.robustness * (.88 + index * .008)), cost: clamp(base.budgetUse * (.78 + index * .025)),
      profile: { information: Math.round((.58 - index * .04) * 100), exposure: 18, equity: Math.round((.12 + index * .045) * 100), robustness: 14, intervention: 10 }
    });
  }
  return points.sort((a, b) => a.equity - b.equity);
}
function renderTradeoffs() {
  const project = activeProject();
  const points = buildTradeoffPoints(project);
  selectedTradeoffIndex = Math.min(selectedTradeoffIndex, points.length - 1);
  const chart = document.querySelector("#paretoChart");
  const x = (value) => 70 + value * 620;
  const y = (value) => 370 - value * 300;
  const grid = [];
  for (let tick = 0; tick <= 1; tick += .2) {
    grid.push(`<line class="chart-grid" x1="70" y1="${y(tick)}" x2="700" y2="${y(tick)}"></line><line class="chart-grid" x1="${x(tick)}" y1="60" x2="${x(tick)}" y2="370"></line><text x="${x(tick) - 9}" y="393">${Math.round(tick * 100)}</text><text x="38" y="${y(tick) + 4}">${Math.round(tick * 100)}</text>`);
  }
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.equity).toFixed(1)},${y(point.information).toFixed(1)}`).join(" ");
  chart.innerHTML = `${grid.join("")}<line class="axis" x1="70" y1="370" x2="710" y2="370"></line><line class="axis" x1="70" y1="370" x2="70" y2="50"></line><text x="320" y="420">Equity score</text><text transform="translate(17 260) rotate(-90)">Information score</text><path class="frontier" d="${path}"></path>${points.map((point, index) => `<circle class="point ${index === selectedTradeoffIndex ? "selected" : ""}" data-index="${index}" cx="${x(point.equity)}" cy="${y(point.information)}" r="8"><title>Plan ${index + 1}: equity ${percent(point.equity)}, information ${percent(point.information)}</title></circle>`).join("")}`;
  for (const point of chart.querySelectorAll(".point")) point.addEventListener("click", () => { selectedTradeoffIndex = Number(point.dataset.index); applyTradeoff(points[selectedTradeoffIndex]); renderTradeoffs(); });
  renderSelectedTradeoff(points[selectedTradeoffIndex]);
  renderBenchmarks(project);
}
function renderSelectedTradeoff(point) {
  const rows = [["Information", point.information], ["Equity", point.equity], ["Robustness", point.robustness], ["Budget use", point.cost]];
  document.querySelector("#selectedTradeoff").innerHTML = `${rows.map(([label, score]) => `<div class="tradeoff-score"><span>${label}</span><strong>${percent(score)}</strong></div>`).join("")}<p class="lab-note">Applying this point updates the plan-builder objective weights. Save the plan to preserve the profile as a separate scenario.</p>`;
}
function applyTradeoff(point) {
  for (const [key, value] of Object.entries(point.profile)) {
    const id = `#weight${key[0].toUpperCase()}${key.slice(1)}`;
    const input = document.querySelector(id);
    if (input) input.value = value;
  }
  updateSliderOutputs();
  document.querySelector("#planStatus").textContent = "Applied a Pareto tradeoff profile. Save or duplicate the plan to retain it.";
}
function renderBenchmarks(project) {
  const base = calculateMetrics(project);
  const methods = [
    ["Random", .62, .58, .55, "Low", "Sanity baseline"], ["Uniform grid", .7, .66, .68, "Low", "Spatial coverage baseline"],
    ["Hotspot", .74, .48, .57, "Low", "Known-risk emphasis"], ["A-optimal", .88, .7, .72, "Medium", "Integrated variance reduction"],
    ["D-optimal", .91, .65, .7, "Medium", "Log-determinant information"], ["Target MI", .9, .73, .71, "High", "Representative field targets"],
    ["Pivoted Cholesky", .84, .68, .75, "Medium", "Covariance approximation"], ["LUMOS integrated", base.information, base.equity, base.robustness, "High", "Socially constrained multi-objective design"]
  ];
  document.querySelector("#benchmarkTableBody").innerHTML = methods.map(([name, info, equity, robust, runtime, role]) => `<tr class="${name.startsWith("LUMOS") ? "best-row" : ""}"><td>${name}</td><td>${percent(info)}</td><td>${percent(equity)}</td><td>${percent(robust)}</td><td>${runtime}</td><td>${role}</td></tr>`).join("");
}

function renderTimeline() {
  const project = activeProject();
  const metrics = project.analysis?.metrics || calculateMetrics(project);
  const rounds = Math.max(2, Math.min(8, Number(document.querySelector("#timelineRounds").value) || 4));
  const initialShare = clamp(Number(document.querySelector("#initialShare").value) / 100, .2, .9);
  const response = document.querySelector("#learningResponse").value;
  const relocation = document.querySelector("#allowRelocation").value === "yes";
  const responseRate = { conservative: .45, central: .62, optimistic: .78 }[response];
  let remaining = metrics.deployedUnits;
  const cards = [];
  for (let round = 1; round <= rounds; round += 1) {
    const units = round === 1 ? Math.max(1, Math.round(metrics.deployedUnits * initialShare)) : Math.max(0, Math.round(remaining / (rounds - round + 1)));
    remaining = Math.max(0, remaining - units);
    const learning = clamp(metrics.information * (1 - Math.exp(-round * responseRate / rounds)));
    const actions = round === 1
      ? [`Deploy ${units} initial ${metrics.unitLabel}${units === 1 ? "" : "s"}.`, "Establish calibration, access, and data-quality baselines."]
      : [`Add ${units} units where posterior uncertainty remains high.`, `Recompute group-level information and intervention balance.`];
    if (relocation && round > 1) actions.push("Review temporary units for possible relocation.");
    if (round === rounds) actions.push("Freeze the evaluated network and export a reproducible configuration.");
    cards.push(`<article class="timeline-card"><span class="round">Round ${round}</span><h3>${round === 1 ? "Initial design" : round === rounds ? "Final evaluation" : "Adaptive update"}</h3><ul>${actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul><p class="lab-note">Modeled accumulated information: ${percent(learning)}</p></article>`);
  }
  document.querySelector("#timelineResults").innerHTML = cards.join("");
}

function updateReproducibility(project) {
  if (!project) return;
  const id = `LUMOSLAB-${project.domain.toUpperCase()}-${slug(project.region).toUpperCase().slice(0, 12)}-${hashString(JSON.stringify({ ...project, analysis: null })).toString(16).toUpperCase().padStart(8, "0")}`;
  document.querySelector("#reproducibilityId").textContent = id;
  return id;
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportProject() {
  saveActiveProject();
  const project = activeProject();
  const payload = { ...project, exportedAt: nowIso(), reproducibilityId: updateReproducibility(project), application: "LUMOSLab", applicationVersion: "4.1.0" };
  download(`lumoslab-${slug(project.name)}.json`, JSON.stringify(payload, null, 2), "application/json");
}
function exportReport() {
  saveActiveProject();
  const project = activeProject();
  const analysis = project.analysis;
  const id = updateReproducibility(project);
  const rows = analysis.selected.slice(0, 10).map((site) => `<tr><td>${site.id}</td><td>${Math.round(site.score * 100)}%</td><td>${Math.round(site.uncertainty * 100)}%</td><td>${Math.round(site.priority * 100)}%</td><td>${Math.round(site.access * 100)}%</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.name)} · LUMOSLab report</title><style>body{font:15px/1.55 Arial,sans-serif;max-width:980px;margin:40px auto;padding:0 28px;color:#17231f}h1,h2{line-height:1.15}small{color:#5d6f68}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.metrics div{border:1px solid #ccd8d3;padding:12px}.metrics strong{display:block;font-size:24px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #d9e1de;text-align:left}.note{padding:14px;background:#f2f7f5;border-left:4px solid #587a6f}</style></head><body><small>Localized Unified Monitoring Optimization System</small><h1>${escapeHtml(project.name)}</h1><p><strong>${domainConfig(project.domain).displayName}</strong> · ${escapeHtml(project.region)} · ${money(project.budget)} budget · ${project.units} target units</p><div class="metrics"><div>Information<strong>${percent(analysis.metrics.information)}</strong></div><div>Equity<strong>${percent(analysis.metrics.equity)}</strong></div><div>Robustness<strong>${percent(analysis.metrics.robustness)}</strong></div><div>Intervention<strong>${percent(analysis.metrics.intervention)}</strong></div><div>Composite<strong>${percent(analysis.metrics.composite)}</strong></div></div><h2>Planning objective</h2><p>${escapeHtml(project.objective)} · ${escapeHtml(project.mode)}</p><h2>Community priority statement</h2><p>${escapeHtml(project.priority)}</p><h2>Recommended planning sites</h2><table><thead><tr><th>Site</th><th>Value</th><th>Uncertainty</th><th>Priority</th><th>Access</th></tr></thead><tbody>${rows}</tbody></table><h2>Next step</h2><p>Open <strong>LUMOS—${domainConfig(project.domain).displayName}</strong> to configure the full scientific model, inspect mapped evidence, run domain-specific validation, and export operational results.</p><p class="note"><strong>Scope:</strong> LUMOSLab metrics are decision-support previews for scenario design and communication. They are not regulatory determinations, certification, causal proof, health findings, or guaranteed field deployability. Review source data, assumptions, calibration, access, safety, and domain-specific validation before use.</p><small>Reproducibility ID: ${id}<br>Generated ${new Date().toLocaleString()}</small></body></html>`;
  download(`lumoslab-${slug(project.name)}-report.html`, html, "text/html");
}
async function importProject(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.format !== "lumoslab-project") throw new Error("This is not a LUMOSLab project file.");
    const project = { ...defaultProject(), ...parsed, id: uid(), name: `${parsed.name || "Imported plan"} imported`, createdAt: nowIso(), updatedAt: nowIso() };
    projects.unshift(project); activeId = project.id; persistProjects(); selectProject(project.id); setView("plan");
    document.querySelector("#planStatus").textContent = "Imported a project as a new local scenario.";
  } catch (error) { document.querySelector("#planStatus").textContent = `Import failed: ${error.message}`; setView("plan"); }
}

function initializeEvents() {
  for (const button of document.querySelectorAll("[data-lab-view]")) button.addEventListener("click", () => setView(button.dataset.labView));
  document.querySelector("#heroNewPlanButton").addEventListener("click", createNewProject);
  document.querySelector("#newPlanButton").addEventListener("click", createNewProject);
  document.querySelector("#savePlanButton").addEventListener("click", saveActiveProject);
  document.querySelector("#duplicatePlanButton").addEventListener("click", duplicateActiveProject);
  document.querySelector("#deletePlanButton").addEventListener("click", deleteActiveProject);
  document.querySelector("#generatePlanButton").addEventListener("click", () => { saveActiveProject(); setView("analysis"); });
  document.querySelector("#runAnalysisButton").addEventListener("click", () => buildAnalysis(activeProject()));
  document.querySelector("#playOptimizationButton").addEventListener("click", playOptimization);
  document.querySelector("#refreshComparisonButton").addEventListener("click", renderComparison);
  document.querySelector("#labDataFile").addEventListener("change", (event) => void readDataFile(event.target.files[0]));
  document.querySelector("#validateDataButton").addEventListener("click", validateDataMapping);
  document.querySelector("#runInterventionButton").addEventListener("click", evaluateIntervention);
  document.querySelector("#runStressTestsButton").addEventListener("click", runStressTests);
  document.querySelector("#rebuildTradeoffsButton").addEventListener("click", renderTradeoffs);
  document.querySelector("#buildTimelineButton").addEventListener("click", renderTimeline);
  document.querySelector("#exportProjectButton").addEventListener("click", exportProject);
  document.querySelector("#exportReportButton").addEventListener("click", exportReport);
  document.querySelector("#importProjectFile").addEventListener("change", (event) => void importProject(event.target.files[0]));
  for (const input of document.querySelectorAll('input[type="range"]')) input.addEventListener("input", updateSliderOutputs);
  document.querySelector("#planDomain").addEventListener("change", () => { const project = { ...(activeProject() || defaultProject()), ...readForm() }; renderProvenance(project); });
  document.querySelector("#planName").addEventListener("input", (event) => { document.querySelector("#activeProjectLabel").textContent = event.target.value || "Untitled plan"; });
}

window.LUMOSLabCore = Object.freeze({
  getProjects: () => structuredClone(projects),
  getActiveProject: () => { const project = activeProject(); return project ? structuredClone(project) : null; },
  getActiveProjectId: () => activeId,
  calculateMetrics: (project = activeProject()) => project ? structuredClone(calculateMetrics(project)) : null,
  getAnalysis: () => currentAnalysis ? structuredClone(currentAnalysis) : null,
  rebuildAnalysis: () => { const project = activeProject(); return project ? structuredClone(buildAnalysis(project)) : null; },
  patchActiveProject: (patch = {}) => {
    const project = activeProject();
    if (!project) return null;
    Object.assign(project, structuredClone(patch), { updatedAt: nowIso() });
    persistProjects();
    renderSavedPlans();
    notifyProjectChange("patch");
    return structuredClone(project);
  },
  importProjectObject: (payload = {}) => {
    const imported = { ...defaultProject(), ...structuredClone(payload), id: uid(), name: `${payload.name || "Imported plan"} imported`, createdAt: nowIso(), updatedAt: nowIso() };
    imported.format = "lumoslab-project";
    projects.unshift(imported);
    activeId = imported.id;
    persistProjects();
    selectProject(imported.id);
    return structuredClone(imported);
  },
  setView,
  format: Object.freeze({ percent, money }),
  helpers: Object.freeze({ clamp, hashString, seededRandom, escapeHtml, slug, uid })
});

function initialize() {
  if (!projects.length) { const project = defaultProject(); projects = [project]; activeId = project.id; persistProjects(); }
  if (!activeProject()) activeId = projects[0].id;
  renderDomainLaunchers();
  initializeEvents();
  updateSliderOutputs();
  renderComparisonPicker();
  selectProject(activeId);
  renderTimeline();
  runStressTests();
  evaluateIntervention();
}

initialize();
