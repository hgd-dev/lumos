import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "./config/domain-registry.js";

const Core = window.LUMOSLabCore;
if (!Core) throw new Error("LUMOSLab core controller must load before advanced studios.");

const STORAGE_KEY = "lumoslab-advanced-v1";
const DISPLAY_KEY = "lumoslab-display-v1";
const ADVANCED_FORMAT = 1;
const DOMAIN_COLORS = Object.freeze({ heat: "#ffb47a", air: "#86d9ff", soil: "#d6a96d", water: "#76d7c8" });
const NAV_TRANSLATIONS = Object.freeze({
  plan: "Constructor del plan", analysis: "Análisis y explicación", compare: "Comparar escenarios", data: "Datos y procedencia",
  intervention: "Plan de intervención", robustness: "Centro de robustez", tradeoffs: "Explorar compromisos", timeline: "Cronología secuencial",
  command: "Centro de mando", geography: "Geografía y mapa", operations: "Viabilidad y costos", monitoring: "Observaciones y sensores",
  validation: "Validación y potencia", "unified-program": "Programa unificado", intelligence: "Estabilidad y sensibilidad",
  governance: "Gobernanza y revisión", "research-studio": "Estudio de investigación", story: "Historia y asistente", export: "Exportar y reproducir"
});
const DATA_CATALOG = Object.freeze([
  { key: "population", label: "Population and households", source: "Census / official statistics", resolution: "Block group to tract", cadence: "Annual or survey cycle", domains: ["heat", "air", "soil", "water"] },
  { key: "vulnerability", label: "Social vulnerability indicators", source: "Public demographic datasets", resolution: "Census geography", cadence: "Periodic", domains: ["heat", "air", "soil", "water"] },
  { key: "land-cover", label: "Land cover, canopy, and imperviousness", source: "Public raster products", resolution: "Raster / parcel", cadence: "Periodic", domains: ["heat", "soil", "water"] },
  { key: "weather", label: "Weather and meteorology", source: "Public weather services", resolution: "Station / grid", cadence: "Hourly to daily", domains: ["heat", "air", "water"] },
  { key: "sources", label: "Facilities, roads, and source context", source: "Public inventories", resolution: "Point / line / polygon", cadence: "Variable", domains: ["air", "soil", "water"] },
  { key: "hydrography", label: "Hydrography and catchments", source: "Public hydrography", resolution: "Reach / watershed", cadence: "Periodic", domains: ["water"] },
  { key: "soil-survey", label: "Soil survey properties", source: "Public soil survey", resolution: "Map unit / raster", cadence: "Periodic", domains: ["soil"] },
  { key: "hosts", label: "Public facilities and candidate hosts", source: "Municipal / open map data", resolution: "Point / parcel", cadence: "Variable", domains: ["heat", "air", "soil", "water"] }
]);

let store = loadStore();
let currentProjectId = Core.getActiveProjectId();
let currentMapTool = "select";
let draftShape = { type: null, points: [] };
let selectedSiteId = null;
let draggingSiteId = null;
let storyIndex = 0;
let storySlides = [];
let currentStakeholder = "executive";
let autosaveTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const percent = (value) => `${Math.round(clamp(value) * 100)}%`;
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const hashString = (value) => { let hash = 2166136261; for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; };
const seededRandom = (seed) => { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let result = state; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4294967296; }; };
const mean = (values) => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
const standardDeviation = (values) => { if (!values.length) return 0; const average = mean(values); return Math.sqrt(mean(values.map((value) => (value - average) ** 2))); };
const nowIso = () => new Date().toISOString();
const project = () => Core.getActiveProject();
const metrics = () => Core.calculateMetrics(project()) || { information: 0, equity: 0, robustness: 0, intervention: 0, composite: 0, deployedUnits: 0, budgetUse: 0 };

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (parsed && typeof parsed === "object") return parsed;
  } catch (error) { console.warn("Could not restore advanced LUMOSLab state", error); }
  return {};
}

function starterSites(activeProject) {
  const random = seededRandom(hashString(`${activeProject?.id}|${activeProject?.region}|advanced-sites`));
  const count = Math.max(5, Math.min(12, Number(activeProject?.units) || 8));
  return Array.from({ length: count }, (_, index) => ({
    id: `S-${String(index + 1).padStart(2, "0")}`,
    x: 95 + random() * 700,
    y: 80 + random() * 365,
    role: index === 0 ? "reference" : index % 4 === 0 ? "temporary" : "fixed",
    locked: index === 0,
    status: index % 7 === 0 ? "review" : "ready",
    access: clamp(.56 + random() * .42),
    power: clamp(.34 + random() * .62),
    safety: clamp(.58 + random() * .4),
    connectivity: clamp(.42 + random() * .56),
    suitability: clamp(.48 + random() * .5),
    costMultiplier: .85 + random() * .5,
    score: clamp(.48 + random() * .49)
  }));
}

function defaultAdvanced(activeProject = project()) {
  const planning = DOMAIN_REGISTRY[activeProject?.domain || "heat"].planning;
  const sites = starterSites(activeProject);
  return {
    format: "lumoslab-advanced",
    formatVersion: ADVANCED_FORMAT,
    updatedAt: nowIso(),
    geography: {
      referenceBounds: [-74.10, 40.60, -73.70, 40.95],
      boundary: [{ x: 60, y: 55 }, { x: 835, y: 70 }, { x: 820, y: 480 }, { x: 75, y: 495 }],
      priorityZones: [[{ x: 145, y: 125 }, { x: 365, y: 105 }, { x: 390, y: 275 }, { x: 185, y: 300 }]],
      exclusionZones: [[{ x: 590, y: 150 }, { x: 760, y: 165 }, { x: 735, y: 275 }, { x: 615, y: 260 }]],
      sites
    },
    catalogDomain: activeProject?.domain || "heat",
    catalog: defaultSensorCatalog(activeProject?.domain || "heat"),
    lifecycle: { years: 5, contingency: 12, staffHourlyCost: 55, annualFieldHours: 240 },
    observations: [],
    posteriorUpdates: [],
    validation: null,
    unified: { budget: 250000, principle: "marginal", sharedSavings: 18, mobileHours: 16, allocations: null },
    intelligence: null,
    governance: {
      stage: "Draft",
      approvals: { data: false, scientific: false, community: false, operations: false, privacy: true },
      assumptions: ["Planning previews require domain-workspace validation before operational use."],
      decisions: [{ id: uid("decision"), text: `Created the ${activeProject?.name || "LUMOSLab"} planning project.`, at: nowIso() }]
    },
    research: { ablations: { equity: true, robustness: true, sequential: true, community: true, heterogeneous: true, intervention: true, feasibility: true } },
    story: [],
    dataCatalog: DATA_CATALOG.filter((entry) => entry.domains.includes(activeProject?.domain || "heat")).map((entry) => entry.key),
    sensorUnitCost: planning?.unitCost || 3000
  };
}

function defaultSensorCatalog(domain) {
  const catalogs = {
    heat: [
      ["Continuous heat package", "Fixed temperature, humidity, radiation, and enclosure package", 3000, 480, .92, 1],
      ["Mobile heat logger", "Temporary pedestrian or vehicle-supported sampling package", 1100, 260, .86, 0],
      ["Reference weather station", "Higher-quality collocation and calibration anchor", 9500, 1250, .97, 1]
    ],
    air: [
      ["Calibrated air station", "Fixed pollutant-specific low-cost station with collocation plan", 8000, 1500, .88, 1],
      ["Mobile air package", "Temporary route-based pollutant sampling", 5200, 1100, .82, 0],
      ["Reference-grade anchor", "High-quality collocation and calibration site", 28000, 4200, .98, 1]
    ],
    soil: [
      ["Surface sample + laboratory", "Field collection, chain of custody, and laboratory analysis", 750, 120, .96, 8],
      ["Depth-profile sample", "Multi-depth sampling and laboratory package", 1350, 160, .94, 2],
      ["Portable screening visit", "Field screening for stratification, not laboratory confirmation", 420, 80, .82, 3]
    ],
    water: [
      ["Grab sample + laboratory", "Indicator-specific sampling and chain-of-custody package", 1200, 240, .94, 5],
      ["Continuous water sonde", "Fixed multiparameter instrument with maintenance plan", 12500, 2800, .88, 1],
      ["Event-response kit", "Temporary storm or discharge-response sampling package", 3600, 900, .84, 1]
    ]
  };
  return catalogs[domain].map(([name, description, capitalCost, annualCost, reliability, count], index) => ({ id: `${domain}-asset-${index + 1}`, name, description, capitalCost, annualCost, reliability, count, selected: count > 0 }));
}

function state() {
  const activeProject = project();
  if (!activeProject) return defaultAdvanced(null);
  if (!store[activeProject.id]) store[activeProject.id] = defaultAdvanced(activeProject);
  return store[activeProject.id];
}

function saveState(reason = "autosave") {
  const activeProject = project();
  if (!activeProject) return;
  state().updatedAt = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  const status = $("#labAutosaveStatus");
  if (status) status.textContent = `${reason === "manual" ? "Saved" : "Autosaved"} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function scheduleSave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => saveState("autosave"), 180);
}

function makeKv(rows) {
  return rows.map(([label, value]) => `<div class="lab-kv-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function makeResult(label, copy, value = "") {
  return `<div class="lab-result-row"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(copy)}</p><span>${escapeHtml(value)}</span></div>`;
}

function makeReadiness(label, detail, status = "pass") {
  return `<div class="readiness-item ${status}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function activeSites() { return state().geography.sites || []; }
function selectedSite() { return activeSites().find((site) => site.id === selectedSiteId) || null; }

function injectAdvancedDataTools() {
  const panel = $('[data-lab-panel="data"]');
  if (!panel || $("#advancedDataTools")) return;
  panel.insertAdjacentHTML("beforeend", `<section id="advancedDataTools" class="lab-card"><div class="lab-card-heading"><div><strong>Layer catalog and harmonization</strong><small>Select public context layers, declare units and coordinate systems, and record every transformation.</small></div><button id="applyHarmonizationButton" class="secondary-button" type="button">Apply transformations</button></div><div class="lab-three-column-grid"><div><p class="section-kicker">Data catalog</p><div id="dataCatalogGrid" class="sensor-catalog"></div></div><div><p class="section-kicker">Unit harmonization</p><div class="lab-form-grid compact"><label class="lab-field">Input temperature<select id="inputTemperatureUnit"><option value="c">Celsius</option><option value="f">Fahrenheit</option></select></label><label class="lab-field">Concentration<select id="inputConcentrationUnit"><option value="ugm3">µg/m³</option><option value="ppm">ppm</option><option value="mgl">mg/L</option><option value="mgkg">mg/kg</option></select></label><label class="lab-field">Coordinates<select id="inputCoordinateSystem"><option value="wgs84">WGS84 latitude/longitude</option><option value="webmercator">Web Mercator</option><option value="local">Local projected coordinates</option></select></label><label class="lab-field">Time zone<select id="inputTimeZone"><option value="project">Project local time</option><option value="utc">UTC</option></select></label></div></div><div><p class="section-kicker">Transformation ledger</p><div id="harmonizationLedger" class="decision-log-list"></div></div></div></section>`);
  $("#applyHarmonizationButton").addEventListener("click", applyHarmonization);
}

function injectAdvancedExportTools() {
  const grid = $(".lab-export-grid");
  if (!grid || $("#exportCompleteBundleButton")) return;
  grid.insertAdjacentHTML("beforeend", `<article class="lab-card"><p class="section-kicker">Complete planning archive</p><h3>Core + advanced JSON</h3><p>Exports or restores the plan, geography, operations, observations, validation, governance, research settings, and decision history in one local file.</p><div class="lab-action-stack"><button id="exportCompleteBundleButton" class="secondary-button" type="button">Export complete archive</button><label class="secondary-button button-link file-button">Import complete archive<input id="importCompleteBundleFile" type="file" accept="application/json,.json"></label></div></article>`);
  $("#exportCompleteBundleButton").addEventListener("click", exportCompleteBundle);
  $("#importCompleteBundleFile").addEventListener("change", (event) => void importCompleteBundle(event.target.files[0]));
}

function renderDataCatalog() {
  const grid = $("#dataCatalogGrid");
  if (!grid) return;
  const active = new Set(state().dataCatalog || []);
  const domain = project()?.domain || "heat";
  grid.innerHTML = DATA_CATALOG.filter((entry) => entry.domains.includes(domain)).map((entry) => `<label class="sensor-card"><header><span><h3>${escapeHtml(entry.label)}</h3><small>${escapeHtml(entry.source)}</small></span><input type="checkbox" data-catalog-key="${entry.key}" ${active.has(entry.key) ? "checked" : ""}></header><p>${escapeHtml(entry.resolution)} · ${escapeHtml(entry.cadence)}</p></label>`).join("");
  $$('[data-catalog-key]', grid).forEach((input) => input.addEventListener("change", () => {
    state().dataCatalog = $$('[data-catalog-key]:checked', grid).map((item) => item.dataset.catalogKey);
    scheduleSave();
  }));
}

function applyHarmonization() {
  const entries = [
    `Temperature interpreted as ${$("#inputTemperatureUnit").selectedOptions[0].textContent}.`,
    `Concentration interpreted as ${$("#inputConcentrationUnit").selectedOptions[0].textContent}.`,
    `Coordinates interpreted as ${$("#inputCoordinateSystem").selectedOptions[0].textContent}.`,
    `Time normalized to ${$("#inputTimeZone").selectedOptions[0].textContent}.`
  ];
  state().harmonization = { at: nowIso(), entries };
  $("#harmonizationLedger").innerHTML = entries.map((entry) => `<div class="decision-log-item"><strong>${escapeHtml(entry)}</strong><small>${new Date().toLocaleString()}</small></div>`).join("");
  saveState("manual");
}

function renderCommandCenter() {
  const activeProject = project();
  const current = state();
  const planMetrics = metrics();
  const sites = current.geography.sites.length;
  const readySites = current.geography.sites.filter((site) => feasibilityStatus(site) === "Ready").length;
  const observations = current.observations.length;
  const validation = current.validation;
  const approvals = Object.values(current.governance.approvals).filter(Boolean).length;
  const readinessDimensions = [
    clamp((activeProject?.name && activeProject?.region ? 1 : .35)),
    clamp(sites / Math.max(1, activeProject?.units || 1)),
    sites ? readySites / sites : 0,
    clamp(observations / Math.max(10, sites * 4)),
    validation ? clamp(validation.calibration) : .15,
    approvals / 5
  ];
  const readiness = mean(readinessDimensions);
  const cards = [
    ["Program readiness", percent(readiness), "Plan, data, operations, validation, and governance"],
    ["Deployment sites", String(sites), `${readySites} ready for field review`],
    ["Observations", String(observations), observations ? "Available for adaptive update" : "No evidence uploaded yet"],
    ["Lifecycle estimate", money(calculateLifecycle().total), `${current.lifecycle.years}-year planning horizon`],
    ["Model confidence", validation ? percent(validation.calibration) : "Pending", validation ? "Local diagnostic suite completed" : "Run validation diagnostics"],
    ["Review stage", current.governance.stage, `${approvals}/5 review checks complete`]
  ];
  $("#commandMetricGrid").innerHTML = cards.map(([label, value, detail]) => `<article class="lab-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join("");
  $("#commandReadinessScore").textContent = percent(readiness);
  $("#commandReadinessList").innerHTML = [
    makeReadiness("Plan definition", activeProject?.region ? `Study area: ${activeProject.region}.` : "Study area missing.", activeProject?.region ? "pass" : "fail"),
    makeReadiness("Geographic design", `${sites} sites and ${current.geography.priorityZones.length} priority zone(s).`, sites >= 3 ? "pass" : "warn"),
    makeReadiness("Operational feasibility", `${readySites}/${sites || 0} sites currently pass readiness thresholds.`, readySites >= Math.min(sites, 3) ? "pass" : "warn"),
    makeReadiness("Observation evidence", observations ? `${observations} records available.` : "Upload or simulate observations.", observations ? "pass" : "warn"),
    makeReadiness("Validation", validation ? `Calibration ${percent(validation.calibration)}.` : "Diagnostic suite not yet run.", validation ? "pass" : "warn"),
    makeReadiness("Governance", `${approvals}/5 review checks complete.`, approvals >= 4 ? "pass" : "warn")
  ].join("");
  const actions = [];
  if (!observations) actions.push("Upload or generate observations before interpreting adaptive recommendations.");
  if (!validation) actions.push("Run the validation, simulation, and power suite.");
  if (readySites < Math.min(sites, 3)) actions.push("Resolve access, power, safety, or suitability constraints for more candidate sites.");
  if (approvals < 4) actions.push("Complete scientific, community, operational, privacy, and data review checks.");
  if (planMetrics.budgetUse > .95) actions.push("Add budget contingency or reduce the requested deployment units.");
  if (!actions.length) actions.push("Continue into the authoritative domain workspace for full model execution and evidence export.");
  $("#commandActionList").innerHTML = actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("");
  $("#commandPulse").innerHTML = makeKv([
    ["Active plan", activeProject?.name || "Untitled"], ["Domain", DOMAIN_REGISTRY[activeProject?.domain || "heat"].displayName], ["Region", activeProject?.region || "Unspecified"],
    ["Composite preview", percent(planMetrics.composite)], ["Saved scenarios", String(Core.getProjects().length)], ["Last advanced update", new Date(current.updatedAt).toLocaleString()]
  ]);
}

function svgPoint(event, svg) {
  const rect = svg.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1) * 900, y: clamp((event.clientY - rect.top) / rect.height, 0, 1) * 540 };
}

function polygonPoints(points) { return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "); }

function renderGeography() {
  const svg = $("#geographyCanvas");
  if (!svg) return;
  const geo = state().geography;
  const grid = [];
  for (let x = 0; x <= 900; x += 60) grid.push(`<line class="map-grid" x1="${x}" y1="0" x2="${x}" y2="540"></line>`);
  for (let y = 0; y <= 540; y += 60) grid.push(`<line class="map-grid" x1="0" y1="${y}" x2="900" y2="${y}"></line>`);
  const priority = geo.priorityZones.map((points) => `<polygon class="priority-shape" points="${polygonPoints(points)}"></polygon>`).join("");
  const exclusions = geo.exclusionZones.map((points) => `<polygon class="exclusion-shape" points="${polygonPoints(points)}"></polygon>`).join("");
  const boundary = geo.boundary.length >= 3 ? `<polygon class="study-boundary" points="${polygonPoints(geo.boundary)}"></polygon>` : "";
  const draft = draftShape.points.length ? `<polyline class="draft-shape" points="${polygonPoints(draftShape.points)}"></polyline>${draftShape.points.map((point) => `<circle class="shape-vertex" cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}` : "";
  const sites = geo.sites.map((site) => `<g data-site-group="${site.id}"><circle class="site-node ${site.locked ? "locked" : ""} ${feasibilityStatus(site) === "Ineligible" ? "infeasible" : ""}" data-site-id="${site.id}" cx="${site.x}" cy="${site.y}" r="${site.id === selectedSiteId ? 10 : 7}"></circle><text class="site-label" x="${site.x + 10}" y="${site.y - 9}">${escapeHtml(site.id)}</text></g>`).join("");
  svg.innerHTML = `${grid.join("")}${boundary}${priority}${exclusions}${draft}${sites}`;
  $$('[data-site-id]', svg).forEach((node) => node.addEventListener("pointerdown", (event) => {
    event.stopPropagation(); selectedSiteId = node.dataset.siteId; draggingSiteId = currentMapTool === "select" ? selectedSiteId : null; node.setPointerCapture?.(event.pointerId); renderSelectedSiteEditor(); renderGeography();
  }));
  renderSelectedSiteEditor();
  $("#geographyStats").innerHTML = makeKv([["Study boundary", geo.boundary.length >= 3 ? `${geo.boundary.length} vertices` : "Not defined"], ["Priority zones", String(geo.priorityZones.length)], ["Exclusion zones", String(geo.exclusionZones.length)], ["Candidate sites", String(geo.sites.length)], ["Locked sites", String(geo.sites.filter((site) => site.locked).length)]]);
}

function handleGeographyPointer(event) {
  const svg = $("#geographyCanvas");
  if (!svg) return;
  const point = svgPoint(event, svg);
  if (draggingSiteId && event.type === "pointermove") {
    const site = activeSites().find((item) => item.id === draggingSiteId);
    if (site && !site.locked) { site.x = point.x; site.y = point.y; renderGeography(); scheduleSave(); }
    return;
  }
  if (event.type !== "pointerdown" || event.target.closest?.("[data-site-id]")) return;
  if (currentMapTool === "site") {
    const site = { id: `S-${String(activeSites().length + 1).padStart(2, "0")}`, x: point.x, y: point.y, role: "fixed", locked: false, status: "review", access: .65, power: .55, safety: .75, connectivity: .65, suitability: .7, costMultiplier: 1, score: .62 };
    activeSites().push(site); selectedSiteId = site.id; renderGeography(); scheduleSave(); return;
  }
  if (["boundary", "priority", "exclusion"].includes(currentMapTool)) {
    if (draftShape.type !== currentMapTool) draftShape = { type: currentMapTool, points: [] };
    draftShape.points.push(point); renderGeography();
  } else { selectedSiteId = null; renderGeography(); }
}

function finishShape() {
  if (draftShape.points.length < 3) return;
  const geo = state().geography;
  if (draftShape.type === "boundary") geo.boundary = [...draftShape.points];
  if (draftShape.type === "priority") geo.priorityZones.push([...draftShape.points]);
  if (draftShape.type === "exclusion") geo.exclusionZones.push([...draftShape.points]);
  draftShape = { type: null, points: [] };
  currentMapTool = "select";
  $$("[data-map-tool]").forEach((button) => button.classList.toggle("active", button.dataset.mapTool === "select"));
  renderGeography(); saveState("manual");
}

function renderSelectedSiteEditor() {
  const container = $("#selectedSiteEditor");
  if (!container) return;
  const site = selectedSite();
  if (!site) { container.innerHTML = `<p class="lab-note">Select a site to edit its role, lock state, cost, and feasibility.</p>`; return; }
  container.innerHTML = `<strong>${escapeHtml(site.id)}</strong><div class="site-editor-grid"><label class="lab-field">Role<select id="siteRole"><option value="fixed">Fixed</option><option value="temporary">Temporary</option><option value="reference">Reference</option><option value="mobile-stop">Mobile stop</option></select></label><label class="lab-field">Status<select id="siteStatus"><option value="ready">Ready</option><option value="review">Needs review</option><option value="ineligible">Ineligible</option></select></label><label class="lab-field">Access %<input id="siteAccess" type="number" min="0" max="100" value="${Math.round(site.access * 100)}"></label><label class="lab-field">Power %<input id="sitePower" type="number" min="0" max="100" value="${Math.round(site.power * 100)}"></label><label class="lab-field">Safety %<input id="siteSafety" type="number" min="0" max="100" value="${Math.round(site.safety * 100)}"></label><label class="lab-field">Cost multiplier<input id="siteCostMultiplier" type="number" min="0.2" max="5" step="0.05" value="${site.costMultiplier.toFixed(2)}"></label></div><label class="lab-check-inline"><input id="siteLocked" type="checkbox" ${site.locked ? "checked" : ""}> Lock this required location</label><div class="lab-inline-actions"><button id="applySiteEditButton" class="secondary-button" type="button">Apply</button><button id="deleteSiteButton" class="text-button danger-text" type="button">Remove site</button></div>`;
  $("#siteRole").value = site.role; $("#siteStatus").value = site.status;
  $("#applySiteEditButton").addEventListener("click", () => {
    site.role = $("#siteRole").value; site.status = $("#siteStatus").value; site.access = clamp(Number($("#siteAccess").value) / 100); site.power = clamp(Number($("#sitePower").value) / 100); site.safety = clamp(Number($("#siteSafety").value) / 100); site.costMultiplier = Math.max(.2, Number($("#siteCostMultiplier").value) || 1); site.locked = $("#siteLocked").checked; renderGeography(); saveState("manual");
  });
  $("#deleteSiteButton").addEventListener("click", () => { state().geography.sites = activeSites().filter((item) => item.id !== site.id); selectedSiteId = null; renderGeography(); saveState("manual"); });
}

function feasibilityStatus(site) {
  if (site.status === "ineligible" || site.safety < .45 || site.access < .35 || site.suitability < .4) return "Ineligible";
  const domain = project()?.domain || "heat";
  const powerRequired = DOMAIN_REGISTRY[domain].planning?.spatialDeployment?.minimumPower > 0;
  if (site.status === "review" || site.access < .58 || site.safety < .62 || (powerRequired && site.power < .6)) return "Review";
  return "Ready";
}

function calculateLifecycle() {
  const current = state();
  const years = Math.max(1, Number(current.lifecycle.years) || 5);
  const selectedAssets = current.catalog.filter((asset) => asset.selected && asset.count > 0);
  const capital = selectedAssets.reduce((sum, asset) => sum + asset.capitalCost * asset.count, 0);
  const recurring = selectedAssets.reduce((sum, asset) => sum + asset.annualCost * asset.count * years, 0);
  const staff = Math.max(0, current.lifecycle.staffHourlyCost) * Math.max(0, current.lifecycle.annualFieldHours) * years;
  const siteAdjustment = activeSites().reduce((sum, site) => sum + (site.costMultiplier - 1) * (DOMAIN_REGISTRY[project()?.domain || "heat"].planning?.unitCost || 1000) * .2, 0);
  const subtotal = capital + recurring + staff + Math.max(0, siteAdjustment);
  const contingency = subtotal * clamp(current.lifecycle.contingency / 100, 0, .5);
  return { years, capital, recurring, staff, siteAdjustment, contingency, total: subtotal + contingency };
}

function renderOperations() {
  const current = state();
  const sites = activeSites();
  const statuses = { Ready: 0, Review: 0, Ineligible: 0 };
  sites.forEach((site) => { statuses[feasibilityStatus(site)] += 1; });
  $("#feasibilitySummary").innerHTML = makeKv([["Ready", String(statuses.Ready)], ["Needs review", String(statuses.Review)], ["Ineligible", String(statuses.Ineligible)], ["Mean suitability", percent(mean(sites.map((site) => site.suitability)))]]);
  $("#feasibilityTableBody").innerHTML = sites.slice(0, 20).map((site) => `<tr><td>${escapeHtml(site.id)}</td><td><span class="lab-mode-badge">${feasibilityStatus(site)}</span></td><td>${percent(site.access)}</td><td>${percent(site.power)}</td><td>${percent(site.safety)}</td></tr>`).join("") || `<tr><td colspan="5">Add sites in the geography editor.</td></tr>`;
  $("#sensorCatalog").innerHTML = current.catalog.map((asset) => `<article class="sensor-card"><header><span><h3>${escapeHtml(asset.name)}</h3><small>${money(asset.capitalCost)} capital · ${money(asset.annualCost)}/year</small></span><input type="checkbox" data-asset-enabled="${asset.id}" ${asset.selected ? "checked" : ""}></header><p>${escapeHtml(asset.description)}</p><label class="lab-field">Count<input type="number" data-asset-count="${asset.id}" min="0" max="100" value="${asset.count}"></label><small>Expected reliability ${percent(asset.reliability)}</small></article>`).join("");
  $$('[data-asset-enabled]').forEach((input) => input.addEventListener("change", () => { const asset = current.catalog.find((item) => item.id === input.dataset.assetEnabled); asset.selected = input.checked; scheduleSave(); renderOperations(); }));
  $$('[data-asset-count]').forEach((input) => input.addEventListener("change", () => { const asset = current.catalog.find((item) => item.id === input.dataset.assetCount); asset.count = Math.max(0, Number(input.value) || 0); asset.selected = asset.count > 0; scheduleSave(); renderOperations(); }));
  $("#lifecycleYears").value = current.lifecycle.years; $("#lifecycleContingency").value = current.lifecycle.contingency; $("#staffHourlyCost").value = current.lifecycle.staffHourlyCost; $("#annualFieldHours").value = current.lifecycle.annualFieldHours;
  const cost = calculateLifecycle();
  $("#lifecycleCostSummary").innerHTML = makeKv([["Capital", money(cost.capital)], ["Recurring", money(cost.recurring)], ["Staff", money(cost.staff)], ["Site adjustment", money(cost.siteAdjustment)], ["Contingency", money(cost.contingency)], [`${cost.years}-year total`, money(cost.total)]]);
  renderConstraintConflicts(cost, statuses);
}

function renderConstraintConflicts(cost = calculateLifecycle(), statuses = null) {
  const activeProject = project(); const sites = activeSites();
  statuses ||= sites.reduce((result, site) => { result[feasibilityStatus(site)] = (result[feasibilityStatus(site)] || 0) + 1; return result; }, { Ready: 0, Review: 0, Ineligible: 0 });
  const conflicts = [];
  if (cost.total > activeProject.budget) conflicts.push(["Lifecycle budget conflict", `Estimated ${cost.years}-year lifecycle cost exceeds the planning budget by ${money(cost.total - activeProject.budget)}.`, "Reduce asset counts, shorten the planning horizon, or increase the budget."]);
  if ((statuses.Ready || 0) < Math.min(activeProject.units, 3)) conflicts.push(["Insufficient ready sites", `Only ${statuses.Ready || 0} candidates currently pass readiness thresholds.`, "Review access and power, add hosts, or reduce the initial deployment count."]);
  if (activeProject.constraints.power && sites.filter((site) => site.power >= .6).length < activeProject.units) conflicts.push(["Power constraint binding", "Fewer sites meet the power threshold than the requested unit count.", "Add solar/battery packages, allow temporary sampling, or expand the host inventory."]);
  if (activeProject.constraints.equity && state().geography.priorityZones.length === 0) conflicts.push(["Equity geography missing", "The plan requests a group information floor but no priority geography is recorded.", "Draw a priority zone or import a documented community-priority layer."]);
  if (!conflicts.length) conflicts.push(["No immediate conflict", "Current local assumptions form a feasible planning preview.", "Continue with field verification and authoritative domain-workspace validation."]);
  $("#constraintConflictResults").innerHTML = conflicts.map(([label, copy, resolution]) => makeResult(label, `${copy} ${resolution}`, conflicts.length === 1 && label === "No immediate conflict" ? "Pass" : "Review")).join("");
}

function generateDemoObservations() {
  const random = seededRandom(hashString(`${project()?.id}|observations|${Date.now().toString().slice(0, 7)}`));
  const sites = activeSites();
  const records = [];
  const periods = 24;
  sites.forEach((site, siteIndex) => {
    for (let index = 0; index < periods; index += 1) {
      const missing = random() < .04 + (1 - site.connectivity) * .08;
      records.push({ siteId: site.id, time: new Date(Date.now() - (periods - index) * 3600000).toISOString(), value: missing ? null : 20 + siteIndex * .45 + Math.sin(index / 3) * 3 + (random() - .5) * 1.8, quality: random() < .05 ? "suspect" : "accepted", calibrationDays: Math.round(random() * 240), battery: Math.round(55 + random() * 45) });
    }
  });
  state().observations = records; saveState("manual"); renderMonitoring();
}

async function readObservations(file) {
  if (!file) return;
  try {
    const text = await file.text();
    let records;
    if (/\.csv$/i.test(file.name)) {
      const lines = text.trim().split(/\r?\n/); const headers = lines.shift().split(",").map((item) => item.trim());
      records = lines.filter(Boolean).map((line) => { const values = line.split(","); return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim()])); });
    } else {
      const parsed = JSON.parse(text); records = Array.isArray(parsed) ? parsed : parsed.records || parsed.features?.map((feature) => feature.properties) || [];
    }
    state().observations = records.map((record, index) => ({ siteId: record.siteId || record.site_id || record.sensor || record.id || `OBS-${index + 1}`, time: record.time || record.timestamp || nowIso(), value: record.value === "" || record.value == null ? null : Number(record.value ?? record.measurement), quality: record.quality || "accepted", calibrationDays: Number(record.calibrationDays ?? record.calibration_days ?? 0), battery: Number(record.battery ?? 100) }));
    saveState("manual"); renderMonitoring();
  } catch (error) { $("#observationSummary").innerHTML = makeKv([["Import error", error.message]]); }
}

function observationDiagnostics() {
  const records = state().observations;
  const values = records.filter((record) => Number.isFinite(record.value)).map((record) => Number(record.value));
  const missingRate = records.length ? 1 - values.length / records.length : 1;
  const suspectRate = records.length ? records.filter((record) => /suspect|flag|reject/i.test(record.quality || "")).length / records.length : 0;
  const siteIds = [...new Set(records.map((record) => record.siteId))];
  const outlierThreshold = values.length ? mean(values) + 3 * standardDeviation(values) : Infinity;
  const outlierRate = values.length ? values.filter((value) => Math.abs(value - mean(values)) > Math.abs(outlierThreshold - mean(values))).length / values.length : 0;
  return { records, values, missingRate, suspectRate, outlierRate, siteIds, mean: mean(values), sd: standardDeviation(values) };
}

function renderMonitoring() {
  const diagnostic = observationDiagnostics();
  $("#observationSummary").innerHTML = makeKv([["Records", String(diagnostic.records.length)], ["Assets", String(diagnostic.siteIds.length)], ["Mean value", Number.isFinite(diagnostic.mean) ? diagnostic.mean.toFixed(2) : "—"], ["Standard deviation", Number.isFinite(diagnostic.sd) ? diagnostic.sd.toFixed(2) : "—"]]);
  const cards = [["Completeness", percent(1 - diagnostic.missingRate)], ["Accepted quality", percent(1 - diagnostic.suspectRate)], ["Outlier control", percent(1 - diagnostic.outlierRate)]];
  $("#qualityMetricGrid").innerHTML = cards.map(([label, value]) => `<article class="lab-metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
  $("#qualityWarnings").innerHTML = [
    makeReadiness("Missingness", diagnostic.missingRate <= .1 ? "Missingness is within the planning threshold." : `Missingness is ${percent(diagnostic.missingRate)}.`, diagnostic.missingRate <= .1 ? "pass" : "warn"),
    makeReadiness("Quality flags", diagnostic.suspectRate <= .08 ? "Few records are flagged." : `Flagged records: ${percent(diagnostic.suspectRate)}.`, diagnostic.suspectRate <= .08 ? "pass" : "warn"),
    makeReadiness("Coverage", diagnostic.siteIds.length >= Math.min(4, activeSites().length) ? "Multiple sites are represented." : "Evidence is concentrated in too few sites.", diagnostic.siteIds.length >= Math.min(4, activeSites().length) ? "pass" : "warn")
  ].join("");
  const health = diagnostic.siteIds.map((siteId) => {
    const records = diagnostic.records.filter((record) => record.siteId === siteId); const valid = records.filter((record) => Number.isFinite(record.value)); const completeness = records.length ? valid.length / records.length : 0;
    const drift = valid.length > 5 ? clamp(Math.abs(mean(valid.slice(-Math.ceil(valid.length / 3)).map((record) => record.value)) - mean(valid.slice(0, Math.ceil(valid.length / 3)).map((record) => record.value))) / Math.max(1, diagnostic.sd * 3)) : 0;
    const calibration = Math.max(...records.map((record) => Number(record.calibrationDays) || 0), 0); const healthScore = clamp(completeness * .48 + (1 - drift) * .28 + (calibration <= 180 ? 1 : .55) * .24);
    const action = completeness < .8 ? "Inspect communications" : drift > .35 ? "Review drift / recalibrate" : calibration > 180 ? "Schedule calibration" : "Continue monitoring";
    return { siteId, completeness, drift, calibration, healthScore, action };
  });
  $("#sensorHealthTableBody").innerHTML = health.map((item) => `<tr><td>${escapeHtml(item.siteId)}</td><td>${percent(item.healthScore)}</td><td>${percent(item.completeness)}</td><td>${percent(item.drift)}</td><td>${item.calibration} days</td><td>${escapeHtml(item.action)}</td></tr>`).join("") || `<tr><td colspan="6">Upload or generate observations to calculate health diagnostics.</td></tr>`;
}

function updatePosterior() {
  const diagnostic = observationDiagnostics(); const base = metrics();
  const evidence = clamp(diagnostic.values.length / Math.max(20, activeSites().length * 12));
  const quality = clamp(1 - diagnostic.missingRate * .6 - diagnostic.suspectRate * .4);
  const uncertaintyBefore = clamp(1 - base.information * .72);
  const uncertaintyAfter = clamp(uncertaintyBefore * (1 - evidence * quality * .38), .05, .95);
  const relocationNeed = activeSites().filter((site) => feasibilityStatus(site) !== "Ready").length + (diagnostic.siteIds.length < activeSites().length ? 1 : 0);
  const update = { at: nowIso(), evidence, quality, uncertaintyBefore, uncertaintyAfter, relocationNeed };
  state().posteriorUpdates.unshift(update); state().posteriorUpdates = state().posteriorUpdates.slice(0, 12); saveState("manual");
  $("#posteriorUpdateResults").innerHTML = [
    makeResult("Posterior uncertainty", `Observation coverage and quality reduce the planning uncertainty proxy from ${percent(uncertaintyBefore)} to ${percent(uncertaintyAfter)}.`, `${Math.round((uncertaintyBefore - uncertaintyAfter) * 100)} pt improvement`),
    makeResult("Next deployment round", relocationNeed ? `${relocationNeed} site or coverage issue(s) should be reviewed before adding units.` : "The current network is ready for a targeted adaptive addition.", relocationNeed ? "Review" : "Ready"),
    makeResult("Scientific boundary", "This update is a local planning diagnostic. Run domain-specific inference and locked validation in the dedicated workspace.", "Required")
  ].join("");
  renderCommandCenter();
}

function normalCdfApprox(z) { return 1 / (1 + Math.exp(-1.702 * z)); }

function runValidationSuite() {
  const activeProject = project(); const base = metrics(); const diagnostic = observationDiagnostics();
  const folds = Math.max(3, Math.min(10, Number($("#validationFolds").value) || 5));
  const repeats = Math.max(20, Math.min(1000, Number($("#simulationRepeats").value) || 200));
  const noise = clamp(Number($("#validationNoise").value) / 100, .01, .8);
  const effect = clamp(Number($("#expectedEffect").value) / 100, .01, 1);
  const pre = Math.max(1, Number($("#powerPreWeeks").value) || 8); const post = Math.max(1, Number($("#powerPostWeeks").value) || 8);
  const evidence = clamp(diagnostic.values.length / Math.max(20, activeSites().length * 10));
  const calibration = clamp(.48 + base.information * .24 + evidence * .22 - noise * .18);
  const sampleFactor = Math.sqrt(Math.max(1, activeSites().length) * (pre + post) / 8);
  const z = effect * sampleFactor / Math.max(.08, noise * 1.8);
  const power = clamp(normalCdfApprox(z - 1.64));
  const minimumDetectableEffect = clamp((1.64 + .84) * Math.max(.08, noise * 1.8) / sampleFactor, .01, 1);
  const models = [
    ["Integrated LUMOS preview", .72, .68, calibration, calibration], ["Stationary GP", .84, .78, clamp(calibration - .07), clamp(calibration - .06)], ["Sparse GP", .9, .82, clamp(calibration - .1), clamp(calibration - .09)], ["Kriging / interpolation", 1.0, .91, clamp(calibration - .15), clamp(calibration - .13)], ["Uniform baseline", 1.14, 1.03, clamp(calibration - .22), clamp(calibration - .2)]
  ].map(([name, rmseScale, maeScale, coverage, cal]) => ({ name, rmse: (noise * 10 + (1 - base.information) * 2.8) * rmseScale, mae: (noise * 7 + (1 - base.information) * 2.1) * maeScale, coverage, calibration: cal }));
  state().validation = { at: nowIso(), folds, repeats, noise, effect, pre, post, evidence, calibration, power, minimumDetectableEffect, models };
  saveState("manual"); renderValidation(); renderCommandCenter();
}

function renderValidation() {
  const validation = state().validation;
  if (!validation) {
    $("#validationMetricGrid").innerHTML = [["Calibration", "Pending"], ["Detection power", "Pending"], ["Minimum effect", "Pending"], ["Evidence coverage", "Pending"]].map(([label, value]) => `<article class="lab-metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
    $("#validationModelTable").innerHTML = `<tr><td colspan="5">Run the local diagnostic suite.</td></tr>`; $("#powerResults").innerHTML = makeResult("Not yet evaluated", "Configure the suite and run the local simulation.", "Pending"); return;
  }
  const cards = [["Calibration", percent(validation.calibration)], ["Detection power", percent(validation.power)], ["Minimum effect", percent(validation.minimumDetectableEffect)], ["Evidence coverage", percent(validation.evidence)], ["Validation folds", String(validation.folds)], ["Simulation repeats", String(validation.repeats)]];
  $("#validationMetricGrid").innerHTML = cards.map(([label, value]) => `<article class="lab-metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
  $("#validationModelTable").innerHTML = validation.models.map((model) => `<tr><td>${escapeHtml(model.name)}</td><td>${model.rmse.toFixed(2)}</td><td>${model.mae.toFixed(2)}</td><td>${percent(model.coverage)}</td><td>${percent(model.calibration)}</td></tr>`).join("");
  $("#powerResults").innerHTML = [
    makeResult("Detectable-effect probability", `With ${validation.pre} pre and ${validation.post} post weeks, the planning design has an estimated ${percent(validation.power)} probability of detecting the stated effect under local assumptions.`, validation.power >= .8 ? "Adequate" : "Underpowered"),
    makeResult("Minimum detectable effect", `Effects smaller than approximately ${percent(validation.minimumDetectableEffect)} may not be distinguishable from assumed noise and correlation.`, percent(validation.minimumDetectableEffect)),
    makeResult("Validation limitation", "These diagnostics do not replace locked spatial and temporal validation in the full domain workspace.", "Domain run required")
  ].join("");
}

function initializeUnifiedCards() {
  const grid = $("#domainAllocationGrid"); if (!grid) return;
  grid.innerHTML = PUBLIC_DOMAIN_KEYS.map((domain) => `<article class="domain-allocation-card" data-domain-allocation="${domain}"><h3>${DOMAIN_REGISTRY[domain].displayName}</h3><small>${escapeHtml(DOMAIN_REGISTRY[domain].primaryField)}</small><output id="allocationOutput-${domain}">25%</output><input id="allocation-${domain}" type="range" min="0" max="100" value="25" aria-label="${domain} allocation share"></article>`).join("");
  $$('[id^="allocation-"]', grid).forEach((input) => input.addEventListener("input", renderManualUnifiedAllocation));
}

function normalizeAllocation(values) { const total = Object.values(values).reduce((sum, value) => sum + Math.max(0, value), 0) || 1; return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.max(0, value) / total])); }

function renderManualUnifiedAllocation() {
  const values = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domain) => [domain, Number($(`#allocation-${domain}`).value)]));
  const normalized = normalizeAllocation(values);
  PUBLIC_DOMAIN_KEYS.forEach((domain) => { $(`#allocationOutput-${domain}`).textContent = percent(normalized[domain]); });
}

function optimizeUnifiedProgram() {
  const current = state();
  current.unified.budget = Math.max(10000, Number($("#unifiedBudget").value) || 250000); current.unified.principle = $("#allocationPrinciple").value; current.unified.sharedSavings = Number($("#sharedHostSavings").value) || 0; current.unified.mobileHours = Number($("#mobileRouteHours").value) || 0;
  const activeProject = project(); const seed = hashString(`${activeProject?.region}|unified|${current.unified.principle}`); const random = seededRandom(seed);
  const raw = {};
  PUBLIC_DOMAIN_KEYS.forEach((domain) => {
    const planning = DOMAIN_REGISTRY[domain].planning;
    const readiness = planning.readiness; const marginal = planning.dimensionPotential.information / Math.sqrt(planning.unitCost / 750);
    const equity = planning.dimensionPotential.equity; const base = current.unified.principle === "balanced" ? 1 : current.unified.principle === "equity" ? equity : current.unified.principle === "readiness" ? readiness : marginal;
    raw[domain] = Math.max(.05, base * (.92 + random() * .16));
  });
  const shares = normalizeAllocation(raw); const savings = clamp(current.unified.sharedSavings / 100, 0, .5);
  const allocations = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domain) => {
    const budget = current.unified.budget * shares[domain]; const unitCost = DOMAIN_REGISTRY[domain].planning.unitCost; const units = Math.max(DOMAIN_REGISTRY[domain].planning.minimumUnits, Math.floor(budget * (1 + savings * .2) / unitCost));
    return [domain, { share: shares[domain], budget, units, marginalValue: clamp(raw[domain] / Math.max(...Object.values(raw))) }];
  }));
  current.unified.allocations = allocations; saveState("manual");
  PUBLIC_DOMAIN_KEYS.forEach((domain) => { $(`#allocation-${domain}`).value = Math.round(shares[domain] * 100); $(`#allocationOutput-${domain}`).textContent = `${percent(shares[domain])} · ${money(allocations[domain].budget)} · ${allocations[domain].units} units`; });
  renderUnifiedResults();
}

function renderUnifiedResults() {
  const current = state(); const allocations = current.unified.allocations;
  const random = seededRandom(hashString(`${project()?.region}|compound-risk`));
  const dimensions = ["Observed", "Modeled", "Uncertainty", "Gap"];
  $("#compoundRiskGrid").innerHTML = `<div class="compound-risk-row"><strong>Domain</strong>${dimensions.map((dimension) => `<strong>${dimension}</strong>`).join("")}</div>${PUBLIC_DOMAIN_KEYS.map((domain) => { const values = dimensions.map(() => clamp(.24 + random() * .7)); return `<div class="compound-risk-row"><strong>${DOMAIN_REGISTRY[domain].displayName}</strong>${values.map((value) => `<span class="risk-cell" style="--risk:${value.toFixed(2)}">${percent(value)}</span>`).join("")}</div>`; }).join("")}`;
  const hosts = activeSites().filter((site) => feasibilityStatus(site) !== "Ineligible").slice(0, 5);
  const savings = allocations ? Object.values(allocations).reduce((sum, item) => sum + item.budget, 0) * clamp(current.unified.sharedSavings / 100) * .22 : 0;
  $("#sharedHostResults").innerHTML = hosts.map((site, index) => makeResult(site.id, `Potential co-location host for ${index % 2 ? "Heat + Air" : "Soil + Water field logistics"}; verify domain compatibility, failure coupling, permission, and maintenance.`, percent(site.suitability))).join("") + makeResult("Estimated co-location savings", "Savings are a planning estimate and should be replaced by host-specific quotes.", money(savings));
  renderMobileRoute();
}

function renderMobileRoute() {
  const svg = $("#mobileRouteCanvas"); if (!svg) return;
  const sites = [...activeSites()].sort((a, b) => a.x - b.x).slice(0, Math.max(3, Math.min(10, Math.round((state().unified.mobileHours || 16) / 2))));
  const grid = []; for (let x = 0; x <= 900; x += 75) grid.push(`<line class="map-grid" x1="${x}" y1="0" x2="${x}" y2="330"></line>`); for (let y = 0; y <= 330; y += 55) grid.push(`<line class="map-grid" x1="0" y1="${y}" x2="900" y2="${y}"></line>`);
  const normalized = sites.map((site) => ({ ...site, routeY: 45 + (site.y / 540) * 230 }));
  const path = normalized.map((site, index) => `${index ? "L" : "M"}${site.x.toFixed(1)},${site.routeY.toFixed(1)}`).join(" ");
  svg.innerHTML = `${grid.join("")}<path class="route-line" d="${path}"></path>${normalized.map((site, index) => `<circle class="route-stop" cx="${site.x}" cy="${site.routeY}" r="7"></circle><text class="route-label" x="${site.x + 10}" y="${site.routeY - 8}">${index + 1}. ${escapeHtml(site.id)}</text>`).join("")}`;
}

function renderUnified() {
  const current = state().unified;
  $("#unifiedBudget").value = current.budget; $("#allocationPrinciple").value = current.principle; $("#sharedHostSavings").value = current.sharedSavings; $("#mobileRouteHours").value = current.mobileHours;
  if (current.allocations) PUBLIC_DOMAIN_KEYS.forEach((domain) => { const allocation = current.allocations[domain]; $(`#allocation-${domain}`).value = Math.round(allocation.share * 100); $(`#allocationOutput-${domain}`).textContent = `${percent(allocation.share)} · ${money(allocation.budget)} · ${allocation.units} units`; });
  else renderManualUnifiedAllocation();
  renderUnifiedResults();
}

function runIntelligence() {
  const seeds = Math.max(10, Math.min(500, Number($("#stabilitySeeds").value) || 100)); const weightChange = clamp(Number($("#weightPerturbation").value) / 100, .01, .5); const budgetChange = clamp(Number($("#budgetPerturbation").value) / 100, .01, .5); const loss = clamp(Number($("#candidateLoss").value) / 100, 0, .8);
  const random = seededRandom(hashString(`${project()?.id}|stability|${seeds}|${weightChange}|${budgetChange}|${loss}`));
  const sites = activeSites().map((site) => {
    const baseline = site.score * .55 + site.suitability * .2 + site.access * .15 + site.safety * .1;
    const frequency = clamp(.18 + baseline * .78 - weightChange * .16 - budgetChange * .12 - loss * .34 + (random() - .5) * .12);
    return { id: site.id, frequency, classification: frequency >= .8 ? "Core recommendation" : frequency >= .6 ? "Frequently selected" : frequency >= .35 ? "Configuration-dependent" : "Fragile" };
  }).sort((a, b) => b.frequency - a.frequency);
  const sensitivity = [
    ["Equity weight", clamp(.35 + weightChange * .8 + random() * .15)], ["Budget", clamp(.32 + budgetChange * .9 + random() * .14)], ["Candidate access", clamp(.28 + loss * .8 + random() * .18)], ["Correlation length", clamp(.25 + random() * .42)], ["Noise / calibration", clamp(.3 + random() * .45)], ["Community priority", clamp(.24 + random() * .48)], ["Failure probability", clamp(.2 + random() * .44)]
  ].sort((a, b) => b[1] - a[1]);
  const coreShare = sites.length ? sites.filter((site) => site.frequency >= .8).length / sites.length : 0; const medianFrequency = sites.length ? [...sites].sort((a, b) => a.frequency - b.frequency)[Math.floor(sites.length / 2)].frequency : 0;
  state().intelligence = { at: nowIso(), seeds, weightChange, budgetChange, loss, sites, sensitivity, coreShare, medianFrequency }; saveState("manual"); renderIntelligence();
}

function renderIntelligence() {
  const intel = state().intelligence;
  if (!intel) { $("#stabilityMetricGrid").innerHTML = [["Core sites", "Pending"], ["Median selection", "Pending"], ["Alternative runs", "Pending"], ["Fragile sites", "Pending"]].map(([label, value]) => `<article class="lab-metric"><span>${label}</span><strong>${value}</strong></article>`).join(""); $("#stabilitySiteList").innerHTML = `<p class="lab-note">Run stability analysis.</p>`; $("#sensitivityBars").innerHTML = ""; return; }
  const fragile = intel.sites.filter((site) => site.frequency < .35).length;
  $("#stabilityMetricGrid").innerHTML = [["Core sites", percent(intel.coreShare)], ["Median selection", percent(intel.medianFrequency)], ["Alternative runs", String(intel.seeds)], ["Fragile sites", String(fragile)]].map(([label, value]) => `<article class="lab-metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
  $("#stabilitySiteList").innerHTML = intel.sites.map((site) => `<article class="recommendation-item"><header><strong>${escapeHtml(site.id)}</strong><span>${percent(site.frequency)}</span></header><p>${escapeHtml(site.classification)}</p><div class="contribution-bar"><i style="width:${Math.round(site.frequency * 100)}%"></i></div></article>`).join("");
  $("#sensitivityBars").innerHTML = intel.sensitivity.map(([label, value]) => `<div class="sensitivity-row"><strong>${escapeHtml(label)}</strong><div class="sensitivity-track"><div class="sensitivity-fill" style="width:${Math.round(value * 100)}%"></div></div><span>${percent(value)}</span></div>`).join("");
}

function renderGovernance() {
  const governance = state().governance;
  $("#projectStage").value = governance.stage;
  const approvalLabels = { data: "Data provenance reviewed", scientific: "Scientific assumptions reviewed", community: "Community priorities reviewed", operations: "Operational feasibility reviewed", privacy: "Privacy and local-data handling reviewed" };
  $("#approvalChecklist").innerHTML = Object.entries(approvalLabels).map(([key, label]) => `<label><input type="checkbox" data-approval="${key}" ${governance.approvals[key] ? "checked" : ""}><span><strong>${escapeHtml(label)}</strong></span></label>`).join("");
  $$('[data-approval]').forEach((input) => input.addEventListener("change", () => { governance.approvals[input.dataset.approval] = input.checked; scheduleSave(); }));
  $("#assumptionList").innerHTML = governance.assumptions.map((assumption, index) => `<div class="decision-log-item"><strong>${escapeHtml(assumption)}</strong><small>Assumption ${index + 1}</small></div>`).join("");
  $("#decisionLogList").innerHTML = governance.decisions.map((entry) => `<div class="decision-log-item"><strong>${escapeHtml(entry.text)}</strong><small>${new Date(entry.at).toLocaleString()}</small></div>`).join("");
  renderStakeholderBrief(currentStakeholder);
}

function renderStakeholderBrief(type = "executive") {
  currentStakeholder = type; const activeProject = project(); const base = metrics(); const current = state(); const cost = calculateLifecycle(); const ready = activeSites().filter((site) => feasibilityStatus(site) === "Ready").length; const validation = current.validation;
  const briefs = {
    executive: `<h3>Executive decision brief</h3><p>${escapeHtml(activeProject.name)} proposes ${activeProject.units} ${escapeHtml(DOMAIN_REGISTRY[activeProject.domain].planning.unitLabel)} units in ${escapeHtml(activeProject.region)}. The current planning preview scores ${percent(base.composite)} on the weighted objective and estimates a ${money(cost.total)} lifecycle cost.</p><ul><li>${ready} candidate sites currently pass local feasibility thresholds.</li><li>${validation ? `Estimated detectable-effect power is ${percent(validation.power)}.` : "Validation and detectable-effect analysis remain pending."}</li><li>Decision requested: approve the next scientific and field-review stage, not deployment certification.</li></ul>`,
    technical: `<h3>Technical review brief</h3><p>The plan uses the shared socially constrained sequential Bayesian design framing with domain-specific ${escapeHtml(DOMAIN_REGISTRY[activeProject.domain].inferenceModel)} assumptions.</p><ul><li>Information ${percent(base.information)}, equity ${percent(base.equity)}, robustness ${percent(base.robustness)}.</li><li>${current.observations.length} local observation records; ${validation ? `${validation.folds}-fold diagnostic completed` : "diagnostic suite not completed"}.</li><li>Review calibration, covariance, missingness, benchmark definitions, and locked validation in the dedicated workspace.</li></ul>`,
    operations: `<h3>Operations brief</h3><p>${ready}/${activeSites().length} sites pass the local readiness screen. The ${cost.years}-year estimate is ${money(cost.total)}, including ${money(cost.contingency)} contingency.</p><ul><li>Confirm permission, access, safety, connectivity, maintenance routing, and host-specific cost.</li><li>Resolve every “Review” or “Ineligible” site before procurement.</li><li>Use the field-campaign and commissioning workflows in Unified for deployment staging.</li></ul>`,
    community: `<h3>Community-facing brief</h3><p>This project is designed to improve environmental information in ${escapeHtml(activeProject.region)} while documenting community priorities separately from demographic and modeled-risk indicators.</p><ul><li>Priority statement: ${escapeHtml(activeProject.priority || "No priority statement recorded.")}</li><li>The proposed locations are not final and require community and field review.</li><li>LUMOS does not make individual health findings or regulatory determinations.</li></ul>`
  };
  $("#stakeholderBrief").innerHTML = briefs[type] || briefs.executive;
}

function addGovernanceEntry(kind) {
  const input = kind === "assumption" ? $("#assumptionInput") : $("#decisionInput"); const text = input.value.trim(); if (!text) return;
  if (kind === "assumption") state().governance.assumptions.push(text); else state().governance.decisions.unshift({ id: uid("decision"), text, at: nowIso() });
  input.value = ""; saveState("manual"); renderGovernance();
}

function runResearchStudio() {
  const controls = state().research.ablations;
  $$('[data-ablation]').forEach((input) => { controls[input.dataset.ablation] = input.checked; });
  const base = metrics(); const enabled = Object.values(controls).filter(Boolean).length; const random = seededRandom(hashString(`${project()?.id}|ablation|${JSON.stringify(controls)}`));
  state().research.ablationResults = Object.entries(controls).map(([key, active]) => ({ key, active, change: active ? 0 : -(0.02 + random() * .11), score: clamp(base.composite + (active ? 0 : -(0.02 + random() * .11))) }));
  const budgets = parseNumberList($("#batchBudgets").value); const units = parseNumberList($("#batchUnits").value); const noise = parseNumberList($("#batchNoise").value); const replicates = Math.max(1, Math.min(100, Number($("#batchReplicates").value) || 10));
  state().research.batch = { budgets, units, noise, replicates, runs: budgets.length * units.length * noise.length * replicates, configurations: budgets.length * units.length * noise.length, enabledComponents: enabled };
  state().research.synthetic = { hotspots: Number($("#syntheticHotspots").value) || 4, inequality: Number($("#syntheticInequality").value) || 55, barriers: Number($("#syntheticBarriers").value) || 2, mobility: $("#syntheticMobility").value };
  saveState("manual"); renderResearchStudio();
}

function parseNumberList(value) { return String(value).split(/[,\s]+/).map(Number).filter(Number.isFinite).slice(0, 20); }

function renderResearchStudio() {
  const research = state().research;
  const labels = { equity: "Equity constraints", robustness: "Robust optimization", sequential: "Sequential updating", community: "Community priorities", heterogeneous: "Heterogeneous sensors", intervention: "Intervention design", feasibility: "Operational feasibility" };
  $("#ablationControls").innerHTML = Object.entries(labels).map(([key, label]) => `<label><input type="checkbox" data-ablation="${key}" ${research.ablations[key] ? "checked" : ""}><span><strong>${escapeHtml(label)}</strong></span></label>`).join("");
  $("#ablationResults").innerHTML = research.ablationResults ? research.ablationResults.map((row) => makeResult(labels[row.key], row.active ? "Component enabled in the full integrated preview." : `Disabled for ablation; estimated composite change ${Math.round(row.change * 100)} points.`, percent(row.score))).join("") : makeResult("Ablation preview", "Choose components and run the research preview.", "Pending");
  const batch = research.batch;
  $("#batchSummary").innerHTML = makeKv(batch ? [["Configurations", String(batch.configurations)], ["Replicates", String(batch.replicates)], ["Total runs", String(batch.runs)], ["Export target", "Tidy CSV / JSON manifest"]] : [["Configurations", "Pending"], ["Total runs", "Pending"]]);
  renderSyntheticCity(); renderModelCard();
}

function renderSyntheticCity() {
  const svg = $("#syntheticCityCanvas"); if (!svg) return;
  const config = state().research.synthetic || { hotspots: 4, inequality: 55, barriers: 2, mobility: "fixed" }; const random = seededRandom(hashString(`${project()?.id}|synthetic|${JSON.stringify(config)}`));
  const roads = Array.from({ length: 5 }, (_, index) => `<line class="city-road" x1="0" y1="${35 + index * 48}" x2="420" y2="${20 + index * 50}"></line>`).join("");
  const hotspots = Array.from({ length: config.hotspots }, () => { const x = 35 + random() * 350; const y = 28 + random() * 200; const radius = 8 + random() * 20; return `<circle class="city-hotspot" cx="${x}" cy="${y}" r="${radius}"></circle>`; }).join("");
  const communities = Array.from({ length: 5 }, (_, index) => { const x = 35 + random() * 350; const y = 28 + random() * 200; const radius = 5 + (config.inequality / 100) * (index + 2); return `<circle class="city-community" cx="${x}" cy="${y}" r="${radius}"></circle>`; }).join("");
  const barriers = Array.from({ length: config.barriers }, () => { const x = 60 + random() * 300; return `<line class="city-barrier" x1="${x}" y1="20" x2="${x + (random() - .5) * 80}" y2="240"></line>`; }).join("");
  svg.innerHTML = `${roads}${hotspots}${communities}${barriers}`;
}

function modelCardHtml() {
  const activeProject = project(); const current = state(); const validation = current.validation;
  return `<h3>${escapeHtml(activeProject.name)} — LUMOSLab model card</h3><p><strong>Intended use:</strong> compare monitoring plans, document assumptions, explore operational feasibility, and prepare authoritative domain-workspace analyses.</p><p><strong>Unsupported use:</strong> regulatory determination, certification, individual health inference, causal proof, or guaranteed deployability.</p><ul><li><strong>Domain:</strong> ${escapeHtml(DOMAIN_REGISTRY[activeProject.domain].displayName)} — ${escapeHtml(DOMAIN_REGISTRY[activeProject.domain].primaryField)}</li><li><strong>Shared method:</strong> socially constrained sequential Bayesian environmental monitoring design.</li><li><strong>Inputs:</strong> geography, candidate sites, objective weights, constraints, community priorities, sensor catalog, observations, and intervention assumptions.</li><li><strong>Validation status:</strong> ${validation ? `Local calibration ${percent(validation.calibration)}; power ${percent(validation.power)}.` : "Local diagnostic suite pending."}</li><li><strong>Equity:</strong> community priorities, demographic vulnerability, exposure, and formal information constraints remain separately documented.</li><li><strong>Human review:</strong> source data, calibration, permission, safety, maintenance, domain assumptions, and locked validation are required.</li></ul>`;
}

function renderModelCard() { $("#modelCardPreview").innerHTML = modelCardHtml(); }

function buildStory() {
  const activeProject = project(); const base = metrics(); const current = state(); const cost = calculateLifecycle(); const validation = current.validation; const ready = activeSites().filter((site) => feasibilityStatus(site) === "Ready").length;
  storySlides = [
    ["Why this project exists", `${activeProject.name} addresses monitoring and information gaps in ${activeProject.region} for the ${DOMAIN_REGISTRY[activeProject.domain].displayName} domain.`],
    ["What the plan prioritizes", activeProject.priority || "No community priority statement has been recorded."],
    ["What alternatives were considered", `${Core.getProjects().length} local scenario(s) can be compared across information, equity, robustness, intervention value, and cost.`],
    ["What LUMOSLab recommends", `${activeProject.units} target units with a ${percent(base.composite)} composite planning preview; ${ready} sites currently pass local feasibility thresholds.`],
    ["What it costs", `The current ${cost.years}-year lifecycle estimate is ${money(cost.total)}, including capital, recurring operations, staff, site adjustments, and contingency.`],
    ["What evidence supports it", `${current.observations.length} observation records are loaded. ${validation ? `Local calibration is ${percent(validation.calibration)} and estimated detection power is ${percent(validation.power)}.` : "Validation diagnostics remain pending."}`],
    ["What uncertainty remains", "The recommended sites, costs, and metrics remain planning outputs until source data, assumptions, calibration, access, safety, and domain-specific validation are reviewed."],
    ["What happens next", `Continue into LUMOS—${DOMAIN_REGISTRY[activeProject.domain].displayName} and Unified for full execution, mapped evidence, field staging, and reproducible scientific exports.`]
  ];
  state().story = storySlides; storyIndex = 0; saveState("manual"); renderStory();
}

function renderStory() {
  if (!storySlides.length) storySlides = state().story?.length ? state().story : [["Build the project story", "Generate an audience-ready sequence from the active project."]];
  storyIndex = Math.max(0, Math.min(storySlides.length - 1, storyIndex)); const [title, copy] = storySlides[storyIndex];
  $("#storySlides").innerHTML = `<article class="story-slide"><span class="story-number">${String(storyIndex + 1).padStart(2, "0")} / ${String(storySlides.length).padStart(2, "0")}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></article>`;
  $("#storyPosition").textContent = `${storyIndex + 1} / ${storySlides.length}`;
}

function answerProjectQuestion(question) {
  const q = question.toLowerCase(); const activeProject = project(); const base = metrics(); const current = state(); const cost = calculateLifecycle(); const site = selectedSite() || activeSites()[0];
  if (/why.*site|selected|recommend/.test(q)) return site ? `${site.id} is retained because its planning score is ${percent(site.score)}, suitability is ${percent(site.suitability)}, and access is ${percent(site.access)}. It is classified ${feasibilityStatus(site)}. This is an explainable planning preview, not a final installation decision.` : "No site is currently available. Add or generate candidate sites first.";
  if (/cost|budget|afford/.test(q)) return `The current ${cost.years}-year lifecycle estimate is ${money(cost.total)} against a core planning budget of ${money(activeProject.budget)}. It includes ${money(cost.capital)} capital, ${money(cost.recurring)} recurring operations, ${money(cost.staff)} staff cost, and ${money(cost.contingency)} contingency.`;
  if (/equity|fair/.test(q)) return `The equity planning indicator is ${percent(base.equity)}. Community priorities are recorded separately from demographic vulnerability, exposure, and formal group-information constraints, so they should not be interpreted as one combined “equity score.”`;
  if (/robust|failure/.test(q)) return `The robustness preview is ${percent(base.robustness)}. Review single-sensor failure, access loss, communications, calibration drift, and candidate removal in the robustness and stability studios before relying on the network.`;
  if (/valid|confidence|power|detect/.test(q)) return current.validation ? `The local diagnostic calibration is ${percent(current.validation.calibration)}, with estimated power ${percent(current.validation.power)} and minimum detectable effect ${percent(current.validation.minimumDetectableEffect)}. Full locked validation remains in the dedicated domain workspace.` : "The validation suite has not been run. Open “Validation, simulation & power” and run the local diagnostic suite.";
  if (/next|do now|action/.test(q)) return $("#commandActionList")?.firstElementChild?.textContent || `Continue to LUMOS—${DOMAIN_REGISTRY[activeProject.domain].displayName} for authoritative execution.`;
  if (/limitation|cannot|unsupported/.test(q)) return "LUMOSLab does not provide regulatory determinations, certification, individual health findings, causal proof, or guaranteed field deployability. It supports planning, comparison, documentation, and simulation.";
  return `For ${activeProject.name}, the current planning preview is ${percent(base.composite)} across ${activeSites().length} candidate sites, with ${current.observations.length} observation records and project stage “${current.governance.stage}.” Ask about site selection, cost, equity, robustness, validation, next steps, or limitations.`;
}

function appendAssistantMessage(role, text) {
  const transcript = $("#assistantTranscript"); transcript.insertAdjacentHTML("beforeend", `<div class="assistant-message ${role}">${escapeHtml(text)}</div>`); transcript.scrollTop = transcript.scrollHeight;
}

function exportGeoJson() {
  const geo = state().geography; const [minLon, minLat, maxLon, maxLat] = geo.referenceBounds;
  const toCoordinate = ({ x, y }) => [minLon + (x / 900) * (maxLon - minLon), maxLat - (y / 540) * (maxLat - minLat)];
  const close = (points) => { const coords = points.map(toCoordinate); if (coords.length && (coords[0][0] !== coords.at(-1)[0] || coords[0][1] !== coords.at(-1)[1])) coords.push(coords[0]); return coords; };
  const features = [];
  if (geo.boundary.length >= 3) features.push({ type: "Feature", properties: { layer: "study-boundary" }, geometry: { type: "Polygon", coordinates: [close(geo.boundary)] } });
  geo.priorityZones.forEach((points, index) => features.push({ type: "Feature", properties: { layer: "priority-zone", id: index + 1 }, geometry: { type: "Polygon", coordinates: [close(points)] } }));
  geo.exclusionZones.forEach((points, index) => features.push({ type: "Feature", properties: { layer: "exclusion-zone", id: index + 1 }, geometry: { type: "Polygon", coordinates: [close(points)] } }));
  geo.sites.forEach((site) => features.push({ type: "Feature", properties: { ...site, x: undefined, y: undefined, layer: "candidate-site", feasibility: feasibilityStatus(site) }, geometry: { type: "Point", coordinates: toCoordinate(site) } }));
  download(`lumoslab-${slug(project()?.name)}-gis.geojson`, JSON.stringify({ type: "FeatureCollection", name: project()?.name, crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }, features }, null, 2), "application/geo+json");
}

async function importGeography(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text()); const features = parsed.type === "FeatureCollection" ? parsed.features : [parsed];
    const coordinates = [];
    features.forEach((feature) => { const geometry = feature.geometry || feature; if (geometry.type === "Point") coordinates.push(geometry.coordinates); if (geometry.type === "Polygon") geometry.coordinates.flat().forEach((coord) => coordinates.push(coord)); });
    const lons = coordinates.map((coord) => Number(coord[0])).filter(Number.isFinite); const lats = coordinates.map((coord) => Number(coord[1])).filter(Number.isFinite); if (!lons.length || !lats.length) throw new Error("No usable Point or Polygon coordinates were found.");
    const bounds = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]; const [minLon, minLat, maxLon, maxLat] = bounds; const dx = maxLon - minLon || 1; const dy = maxLat - minLat || 1;
    const toPoint = ([lon, lat]) => ({ x: 50 + ((lon - minLon) / dx) * 800, y: 40 + ((maxLat - lat) / dy) * 460 });
    const geo = state().geography; geo.referenceBounds = bounds;
    features.forEach((feature) => { const geometry = feature.geometry || feature; const layer = feature.properties?.layer || ""; if (geometry.type === "Point") { const point = toPoint(geometry.coordinates); geo.sites.push({ id: feature.properties?.id || `S-${String(geo.sites.length + 1).padStart(2, "0")}`, ...point, role: feature.properties?.role || "fixed", locked: Boolean(feature.properties?.locked), status: "review", access: .65, power: .55, safety: .7, connectivity: .65, suitability: .68, costMultiplier: 1, score: .62 }); } else if (geometry.type === "Polygon") { const points = geometry.coordinates[0].map(toPoint); if (/priority/i.test(layer)) geo.priorityZones.push(points); else if (/exclusion/i.test(layer)) geo.exclusionZones.push(points); else geo.boundary = points; } });
    saveState("manual"); renderGeography();
  } catch (error) { alert(`GeoJSON import failed: ${error.message}`); }
}

function slug(value) { return String(value || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "plan"; }
function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function exportCompleteBundle() {
  const payload = { format: "lumoslab-complete-planning-archive", formatVersion: 1, applicationVersion: "4.1.0", exportedAt: nowIso(), coreProject: project(), advancedProject: state(), scientificBoundary: "Planning, simulation, operations, and communication layer; dedicated domain workspaces remain authoritative for full scientific execution and validation." };
  download(`lumoslab-${slug(project()?.name)}-complete.json`, JSON.stringify(payload, null, 2), "application/json");
}

async function importCompleteBundle(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.format !== "lumoslab-complete-planning-archive" || !parsed.coreProject || !parsed.advancedProject) throw new Error("This is not a complete LUMOSLab planning archive.");
    const imported = Core.importProjectObject(parsed.coreProject);
    store[imported.id] = { ...defaultAdvanced(imported), ...structuredClone(parsed.advancedProject), updatedAt: nowIso() };
    currentProjectId = imported.id;
    saveState("manual");
    Core.setView("command");
    renderAll();
  } catch (error) {
    alert(`Complete archive import failed: ${error.message}`);
  }
}

function exportModelCard() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project()?.name)} model card</title><style>body{font:15px/1.55 Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#16231e}h1,h2,h3{line-height:1.2}li{margin:7px 0}.note{padding:14px;background:#eff6f3;border-left:4px solid #47786b}</style></head><body><h1>LUMOSLab model card</h1>${modelCardHtml()}<p class="note">Generated ${new Date().toLocaleString()}. Preserve the accompanying project archive and domain-workspace evidence for reproducibility.</p></body></html>`;
  download(`lumoslab-${slug(project()?.name)}-model-card.html`, html, "text/html");
}

function resetGeography() { state().geography = defaultAdvanced(project()).geography; selectedSiteId = null; draftShape = { type: null, points: [] }; saveState("manual"); renderGeography(); }

function renderAll() {
  renderDataCatalog(); renderCommandCenter(); renderGeography(); renderOperations(); renderMonitoring(); renderValidation(); renderUnified(); renderIntelligence(); renderGovernance(); renderResearchStudio(); renderStory();
}

function renderView(view) {
  const map = { command: renderCommandCenter, geography: renderGeography, operations: renderOperations, monitoring: renderMonitoring, validation: renderValidation, "unified-program": renderUnified, intelligence: renderIntelligence, governance: renderGovernance, "research-studio": renderResearchStudio, story: renderStory, data: renderDataCatalog };
  map[view]?.();
}

function initializeDisplayControls() {
  let display = {};
  try { display = JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}"); } catch { display = {}; }
  const body = document.body;
  const apply = () => { body.classList.toggle("lab-high-contrast", Boolean(display.highContrast)); body.classList.toggle("lab-reduced-motion", Boolean(display.reducedMotion)); body.classList.toggle("lab-spanish", display.language === "es"); $("#labContrastButton").setAttribute("aria-pressed", String(Boolean(display.highContrast))); $("#labMotionButton").setAttribute("aria-pressed", String(Boolean(display.reducedMotion))); $("#labLanguageButton").setAttribute("aria-pressed", String(display.language === "es")); translateNavigation(display.language === "es"); localStorage.setItem(DISPLAY_KEY, JSON.stringify(display)); };
  $("#labContrastButton").addEventListener("click", () => { display.highContrast = !display.highContrast; apply(); });
  $("#labMotionButton").addEventListener("click", () => { display.reducedMotion = !display.reducedMotion; apply(); });
  $("#labLanguageButton").addEventListener("click", () => { display.language = display.language === "es" ? "en" : "es"; $("#labLanguageButton").textContent = display.language === "es" ? "English" : "Español"; apply(); });
  $("#labLanguageButton").textContent = display.language === "es" ? "English" : "Español"; apply();
}

function translateNavigation(spanish) {
  $$('.lab-view-nav button[data-lab-view]').forEach((button) => {
    const number = button.querySelector("span")?.outerHTML || "";
    if (!button.dataset.englishLabel) button.dataset.englishLabel = button.textContent.trim().replace(/^\d+\s*/, "");
    const label = spanish ? NAV_TRANSLATIONS[button.dataset.labView] || button.dataset.englishLabel : button.dataset.englishLabel;
    button.innerHTML = `${number}${escapeHtml(label)}`;
  });
}

function initializeEvents() {
  injectAdvancedDataTools(); injectAdvancedExportTools(); initializeUnifiedCards(); initializeDisplayControls();
  window.addEventListener("lumoslab:project-change", (event) => {
    const previousProjectId = currentProjectId;
    currentProjectId = event.detail.project?.id || Core.getActiveProjectId();
    selectedSiteId = null; storySlides = [];
    const activeProject = project();
    if (activeProject && !store[currentProjectId]) {
      store[currentProjectId] = event.detail.reason === "duplicate" && store[previousProjectId] ? structuredClone(store[previousProjectId]) : defaultAdvanced(activeProject);
      store[currentProjectId].updatedAt = nowIso();
    }
    if (activeProject && store[currentProjectId].catalogDomain !== activeProject.domain) {
      store[currentProjectId].catalogDomain = activeProject.domain;
      store[currentProjectId].catalog = defaultSensorCatalog(activeProject.domain);
      store[currentProjectId].dataCatalog = DATA_CATALOG.filter((entry) => entry.domains.includes(activeProject.domain)).map((entry) => entry.key);
    }
    saveState("autosave"); renderAll();
  });
  window.addEventListener("lumoslab:view-change", (event) => renderView(event.detail.view));
  $("#refreshCommandButton").addEventListener("click", renderCommandCenter);
  $$('[data-map-tool]').forEach((button) => button.addEventListener("click", () => { currentMapTool = button.dataset.mapTool; draftShape = { type: null, points: [] }; $$('[data-map-tool]').forEach((item) => item.classList.toggle("active", item === button)); renderGeography(); }));
  $("#geographyCanvas").addEventListener("pointerdown", handleGeographyPointer); $("#geographyCanvas").addEventListener("pointermove", handleGeographyPointer); window.addEventListener("pointerup", () => { draggingSiteId = null; });
  $("#finishShapeButton").addEventListener("click", finishShape); $("#saveGeographyButton").addEventListener("click", () => saveState("manual")); $("#resetGeographyButton").addEventListener("click", resetGeography); $("#exportGeoJsonButton").addEventListener("click", exportGeoJson); $("#geographyImportFile").addEventListener("change", (event) => void importGeography(event.target.files[0]));
  $("#recalculateOperationsButton").addEventListener("click", () => { const current = state(); current.lifecycle = { years: Number($("#lifecycleYears").value) || 5, contingency: Number($("#lifecycleContingency").value) || 0, staffHourlyCost: Number($("#staffHourlyCost").value) || 0, annualFieldHours: Number($("#annualFieldHours").value) || 0 }; saveState("manual"); renderOperations(); renderCommandCenter(); });
  $("#simulateObservationsButton").addEventListener("click", generateDemoObservations); $("#observationFile").addEventListener("change", (event) => void readObservations(event.target.files[0])); $("#updatePosteriorButton").addEventListener("click", updatePosterior);
  $("#runValidationSuiteButton").addEventListener("click", runValidationSuite); $("#optimizeUnifiedProgramButton").addEventListener("click", optimizeUnifiedProgram); $("#runIntelligenceButton").addEventListener("click", runIntelligence);
  $("#saveGovernanceButton").addEventListener("click", () => { state().governance.stage = $("#projectStage").value; saveState("manual"); renderGovernance(); renderCommandCenter(); }); $("#addAssumptionButton").addEventListener("click", () => addGovernanceEntry("assumption")); $("#addDecisionButton").addEventListener("click", () => addGovernanceEntry("decision")); $$('[data-stakeholder]').forEach((button) => button.addEventListener("click", () => renderStakeholderBrief(button.dataset.stakeholder)));
  $("#runResearchStudioButton").addEventListener("click", runResearchStudio); $("#exportModelCardButton").addEventListener("click", exportModelCard);
  $("#buildStoryButton").addEventListener("click", buildStory); $("#previousStoryButton").addEventListener("click", () => { storyIndex = Math.max(0, storyIndex - 1); renderStory(); }); $("#nextStoryButton").addEventListener("click", () => { storyIndex = Math.min(storySlides.length - 1, storyIndex + 1); renderStory(); });
  $("#assistantForm").addEventListener("submit", (event) => { event.preventDefault(); const input = $("#assistantQuestion"); const question = input.value.trim(); if (!question) return; appendAssistantMessage("user", question); appendAssistantMessage("system", answerProjectQuestion(question)); input.value = ""; });
}

function initialize() {
  if (!store[currentProjectId]) store[currentProjectId] = defaultAdvanced(project());
  initializeEvents();
  appendAssistantMessage("system", "Ask about site selection, cost, equity, robustness, validation, next actions, or limitations. Answers use only this local project record.");
  renderAll(); saveState("autosave");
}

initialize();
