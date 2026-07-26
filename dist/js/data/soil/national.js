import {
  buildSystematicCandidates,
  buildViewportGrid,
  estimateNationalHeatWorkload,
  loadNationalSocialContext,
  applyNationalSocialContext
} from "../heat/national.js";

const SDA_URL = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

export const SOIL_PROPERTIES = {
  composite: { label: "Soil-health composite", unit: "index", field: "soilComposite" },
  ph: { label: "Soil pH", unit: "pH", field: "soilPh" },
  organic_matter: { label: "Organic matter", unit: "%", field: "organicMatter" },
  clay: { label: "Clay content", unit: "%", field: "clayPercent" },
  available_water: { label: "Available water capacity", unit: "cm/cm", field: "availableWater" },
  salinity: { label: "Electrical conductivity", unit: "dS/m", field: "electricalConductivity" },
  lead: { label: "Lead", unit: "mg/kg", field: "posteriorSoilValue", requiresLaboratorySamples: true },
  arsenic: { label: "Arsenic", unit: "mg/kg", field: "posteriorSoilValue", requiresLaboratorySamples: true },
  cadmium: { label: "Cadmium", unit: "mg/kg", field: "posteriorSoilValue", requiresLaboratorySamples: true }
};

export const SOIL_DEPTHS = {
  "0-15": { label: "0–15 cm topsoil", top: 0, bottom: 15 },
  "15-30": { label: "15–30 cm", top: 15, bottom: 30 },
  "30-60": { label: "30–60 cm", top: 30, bottom: 60 }
};

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > -1e8 ? number : null;
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

export function normalizeSdaTable(payload) {
  const table = payload?.Table ?? payload?.table ?? payload?.result ?? null;
  if (!Array.isArray(table) || !table.length) return [];
  if (Array.isArray(table[0])) {
    const headers = table[0].map((entry) => String(entry));
    return table.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
  }
  if (typeof table[0] === "object") return table;
  return [];
}

async function querySda(query, fetchImpl, signal = null) {
  const body = new URLSearchParams({
    service: "query",
    request: "query",
    query,
    format: "JSON+COLUMNNAME"
  });
  const response = await fetchImpl(SDA_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body,
    signal,
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`USDA Soil Data Access returned HTTP ${response.status}.`);
  return normalizeSdaTable(await response.json());
}

export function buildSdaPointQuery(points) {
  return points.map((point, index) => {
    const id = escapeSql(point.id ?? `point-${index}`);
    const lng = Number(point.lng).toFixed(7);
    const lat = Number(point.lat).toFixed(7);
    return `SELECT '${id}' AS point_id, M.mukey, M.muname\nFROM mapunit M\nWHERE M.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point (${lng} ${lat})'))`;
  }).join("\nUNION ALL\n");
}

export function buildSdaPropertyQuery(mukeys, depth = SOIL_DEPTHS["0-15"]) {
  const ids = [...new Set(mukeys.map(String).filter(Boolean))];
  if (!ids.length) return "SELECT TOP 0 mukey FROM mapunit";
  const inClause = ids.map((id) => `'${escapeSql(id)}'`).join(",");
  return `SELECT M.mukey, M.muname, C.cokey, C.compname, C.comppct_r, C.majcompflag,\nH.hzdept_r, H.hzdepb_r, H.chph1to1h_r, H.om_r, H.claytotal_r, H.sandtotal_r, H.silttotal_r, H.awc_r, H.ksat_r, H.ec_r, H.cec7_r\nFROM mapunit M\nINNER JOIN component C ON C.mukey = M.mukey\nINNER JOIN chorizon H ON H.cokey = C.cokey\nWHERE M.mukey IN (${inClause})\nAND C.majcompflag = 'Yes'\nAND H.hzdept_r < ${depth.bottom}\nAND H.hzdepb_r > ${depth.top}`;
}

function weightedMean(rows, field, depth) {
  let numerator = 0;
  let denominator = 0;
  for (const row of rows) {
    const value = finite(row[field]);
    const top = finite(row.hzdept_r);
    const bottom = finite(row.hzdepb_r);
    const component = finite(row.comppct_r) ?? 0;
    if (value === null || top === null || bottom === null) continue;
    const overlap = Math.max(0, Math.min(bottom, depth.bottom) - Math.max(top, depth.top));
    if (overlap <= 0) continue;
    const weight = overlap * Math.max(1, component);
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : null;
}

export function aggregateSoilRows(rows, depthKey = "0-15") {
  const depth = SOIL_DEPTHS[depthKey] ?? SOIL_DEPTHS["0-15"];
  const grouped = new Map();
  for (const row of rows) {
    const mukey = String(row.mukey ?? "");
    if (!mukey) continue;
    if (!grouped.has(mukey)) grouped.set(mukey, []);
    grouped.get(mukey).push(row);
  }
  const output = new Map();
  for (const [mukey, group] of grouped) {
    output.set(mukey, {
      mukey,
      mapUnitName: group[0]?.muname ?? `Map unit ${mukey}`,
      soilPh: weightedMean(group, "chph1to1h_r", depth),
      organicMatter: weightedMean(group, "om_r", depth),
      clayPercent: weightedMean(group, "claytotal_r", depth),
      sandPercent: weightedMean(group, "sandtotal_r", depth),
      siltPercent: weightedMean(group, "silttotal_r", depth),
      availableWater: weightedMean(group, "awc_r", depth),
      saturatedConductivity: weightedMean(group, "ksat_r", depth),
      electricalConductivity: weightedMean(group, "ec_r", depth),
      cationExchangeCapacity: weightedMean(group, "cec7_r", depth),
      componentCount: new Set(group.map((row) => row.cokey)).size,
      horizonCount: group.length
    });
  }
  return output;
}

function propertyPriority(property, values) {
  if (["lead", "arsenic", "cadmium"].includes(property)) {
    return clamp(0.48 * (values.disturbancePressure ?? 0.35) + 0.22 * (values.soilDataObserved ? 0.25 : 0.65) + 0.18 * ((values.clayPercent ?? 30) / 60) + 0.12 * (1 - (values.organicMatter ?? 2) / 6));
  }
  if (property === "ph") {
    const value = values.soilPh;
    return value === null ? 0.5 : clamp(Math.abs(value - 6.5) / 2.6);
  }
  if (property === "organic_matter") {
    const value = values.organicMatter;
    return value === null ? 0.5 : clamp(1 - value / 5);
  }
  if (property === "clay") {
    const value = values.clayPercent;
    return value === null ? 0.5 : clamp(Math.abs(value - 30) / 45);
  }
  if (property === "available_water") {
    const value = values.availableWater;
    return value === null ? 0.5 : clamp(1 - value / 0.22);
  }
  if (property === "salinity") {
    const value = values.electricalConductivity;
    return value === null ? 0.5 : clamp(value / 4);
  }
  const phRisk = values.soilPh === null ? 0.45 : clamp(Math.abs(values.soilPh - 6.5) / 2.6);
  const organicDeficit = values.organicMatter === null ? 0.5 : clamp(1 - values.organicMatter / 5);
  const waterDeficit = values.availableWater === null ? 0.45 : clamp(1 - values.availableWater / 0.22);
  const salinity = values.electricalConductivity === null ? 0.15 : clamp(values.electricalConductivity / 4);
  const slowDrainage = values.saturatedConductivity === null ? 0.25 : clamp(1 - Math.log1p(values.saturatedConductivity) / Math.log(101));
  return clamp(0.28 * phRisk + 0.26 * organicDeficit + 0.22 * waterDeficit + 0.14 * salinity + 0.10 * slowDrainage);
}

function fallbackSoil(point) {
  const wave = 0.5 + 0.5 * Math.sin((point.x * 3.2 + point.y * 2.4) * Math.PI);
  return {
    mukey: null,
    mapUnitName: "Unresolved SSURGO map unit",
    soilPh: 5.8 + 1.5 * wave,
    organicMatter: 1.2 + 2.4 * (1 - wave),
    clayPercent: 18 + 34 * wave,
    sandPercent: 65 - 35 * wave,
    siltPercent: 17 + 8 * (1 - wave),
    availableWater: 0.08 + 0.10 * (1 - Math.abs(wave - 0.5) * 2),
    saturatedConductivity: 4 + 32 * (1 - wave),
    electricalConductivity: 0.2 + 0.6 * wave,
    cationExchangeCapacity: 8 + 18 * wave,
    componentCount: 0,
    horizonCount: 0,
    soilDataObserved: false,
    soilDataConfidence: 0.18
  };
}

function soilForCell(point, pointMap, properties) {
  const mapUnit = pointMap.get(point.id) ?? null;
  const values = mapUnit ? properties.get(String(mapUnit.mukey)) : null;
  if (!values) return fallbackSoil(point);
  return { ...values, soilDataObserved: true, soilDataConfidence: 0.82 };
}

function assignSoilGroups(cells) {
  const sorted = [...cells].sort((left, right) => left.vulnerability - right.vulnerability);
  sorted.forEach((cell, index) => { cell.vulnerabilityQuartile = Math.min(3, Math.floor(index / Math.max(1, sorted.length / 4))); });
  const riskMedian = [...cells].map((cell) => cell.risk).sort((a, b) => a - b)[Math.floor(cells.length / 2)] ?? 0.5;
  for (const cell of cells) {
    const highRisk = cell.risk >= riskMedian ? 1 : 0;
    cell.communityGroup = cell.vulnerabilityQuartile * 2 + highRisk;
    cell.communityGroupLabel = `Vulnerability Q${cell.vulnerabilityQuartile + 1} · ${highRisk ? "higher" : "lower"} soil priority`;
  }
}

async function fetchSdaGrid(points, depthKey, fetchImpl, signal, onProgress) {
  const pointRows = [];
  const batchSize = 12;
  for (let start = 0; start < points.length; start += batchSize) {
    const batch = points.slice(start, start + batchSize);
    onProgress(`Resolving USDA soil map units ${Math.floor(start / batchSize) + 1} of ${Math.ceil(points.length / batchSize)}...`);
    pointRows.push(...await querySda(buildSdaPointQuery(batch), fetchImpl, signal));
  }
  const pointMap = new Map();
  for (const row of pointRows) {
    const pointId = String(row.point_id ?? "");
    if (pointId && !pointMap.has(pointId)) pointMap.set(pointId, { mukey: String(row.mukey ?? ""), mapUnitName: row.muname ?? null });
  }
  const mukeys = [...new Set([...pointMap.values()].map((entry) => entry.mukey).filter(Boolean))];
  const propertyRows = [];
  const propertyBatch = 70;
  for (let start = 0; start < mukeys.length; start += propertyBatch) {
    const batch = mukeys.slice(start, start + propertyBatch);
    onProgress(`Loading USDA horizon properties ${Math.floor(start / propertyBatch) + 1} of ${Math.ceil(mukeys.length / propertyBatch)}...`);
    propertyRows.push(...await querySda(buildSdaPropertyQuery(batch, SOIL_DEPTHS[depthKey] ?? SOIL_DEPTHS["0-15"]), fetchImpl, signal));
  }
  return { pointMap, properties: aggregateSoilRows(propertyRows, depthKey), pointRows, propertyRows };
}

function overpassQuery(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:18];(\n nwr["leisure"="park"](${bbox});\n nwr["landuse"~"allotments|farmland|orchard|vineyard|brownfield|landfill|industrial"](${bbox});\n nwr["amenity"~"school|community_centre|university|waste_transfer_station"](${bbox});\n nwr["man_made"="works"](${bbox});\n);out center tags 500;`;
}

function normalizedPosition(lng, lat, bounds) {
  return {
    x: clamp((lng - bounds.west) / Math.max(1e-9, bounds.east - bounds.west)),
    y: clamp((lat - bounds.south) / Math.max(1e-9, bounds.north - bounds.south))
  };
}

export function normalizeSoilHosts(payload, bounds) {
  const output = [];
  const seen = new Set();
  for (const element of payload?.elements ?? []) {
    const lat = finite(element.lat ?? element.center?.lat);
    const lng = finite(element.lon ?? element.center?.lon);
    if (lat === null || lng === null) continue;
    const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = element.tags ?? {};
    const landuse = tags.landuse ?? null;
    const hostType = landuse === "brownfield" || landuse === "industrial" || landuse === "landfill"
      ? "Disturbance screening site"
      : landuse === "farmland" || landuse === "orchard" || landuse === "vineyard"
        ? "Agricultural sampling site"
        : tags.leisure === "park"
          ? "Park sampling site"
          : tags.amenity === "school"
            ? "School grounds"
            : "Community soil site";
    const position = normalizedPosition(lng, lat, bounds);
    output.push({
      id: `soil-osm-${element.type}-${element.id}`,
      name: tags.name ?? hostType,
      hostType,
      source: "OpenStreetMap",
      sourceType: "mapped_host",
      ...position,
      lat,
      lng,
      cost: hostType.includes("Disturbance") ? 1.08 : 0.78,
      feasibility: 0.70,
      reliability: 0.82,
      feasible: true,
      sitingConfidence: 0.58,
      permissionStatus: "unknown",
      powerConfidence: 0.35,
      maintenanceAccess: 0.65,
      requiresFieldVerification: true
    });
    if (output.length >= 150) break;
  }
  return output;
}

function nearestCell(candidate, cells) {
  return cells.reduce((best, cell) => {
    const distance = (cell.x - candidate.x) ** 2 + (cell.y - candidate.y) ** 2;
    return distance < best.distance ? { cell, distance } : best;
  }, { cell: cells[0], distance: Infinity }).cell;
}

function enrichCandidates(candidates, cells) {
  return candidates.map((candidate) => {
    const cell = nearestCell(candidate, cells);
    return {
      ...candidate,
      soilPriority: cell.risk,
      disturbancePressure: cell.disturbancePressure ?? 0,
      vulnerability: cell.vulnerability,
      exposure: cell.exposure,
      landClass: cell.landClass,
      ecology: cell.ecology,
      networkBranch: cell.networkBranch
    };
  });
}

function applyMappedDisturbance(cells, hosts) {
  const disturbed = hosts.filter((host) => host.hostType === "Disturbance screening site");
  for (const cell of cells) {
    const distance = disturbed.reduce((best, host) => Math.min(best, Math.hypot(cell.x - host.x, cell.y - host.y)), Infinity);
    cell.disturbancePressure = disturbed.length ? Math.exp(-distance / 0.10) : 0;
    cell.risk = clamp(0.82 * cell.risk + 0.18 * cell.disturbancePressure);
    cell.communityPriority = clamp(0.38 * cell.vulnerability + 0.24 * cell.exposure + 0.26 * cell.risk + 0.12 * cell.disturbancePressure);
  }
}

export function applyNationalSoilIntervention(scenario, target = "remediation") {
  for (const cell of scenario.cells ?? []) {
    if (target === "garden-safety") cell.interventionBenefit = clamp(0.46 * cell.exposure + 0.30 * cell.vulnerability + 0.24 * cell.risk);
    else if (target === "restoration") cell.interventionBenefit = clamp(0.44 * cell.ecology + 0.30 * cell.risk + 0.26 * (1 - (cell.organicMatter ?? 2) / 6));
    else if (target === "agricultural") cell.interventionBenefit = clamp(0.36 * cell.risk + 0.34 * (1 - (cell.availableWater ?? 0.12) / 0.25) + 0.30 * cell.ecology);
    else cell.interventionBenefit = clamp(0.40 * cell.risk + 0.28 * cell.disturbancePressure + 0.18 * cell.exposure + 0.14 * cell.vulnerability);
  }
  scenario.model.interventionTarget = target;
  return scenario;
}

export async function enrichNationalSoilCandidateHosts(scenario, {
  fetchImpl = globalThis.fetch,
  signal = null,
  onProgress = () => {},
  candidateStrategy = scenario.model?.candidateStrategy ?? "hybrid"
} = {}) {
  if (candidateStrategy === "systematic") return { scenario, mappedCount: 0, candidateCount: scenario.candidates.length, skipped: true };
  const bounds = {
    west: scenario.geoBounds.minLng,
    south: scenario.geoBounds.minLat,
    east: scenario.geoBounds.maxLng,
    north: scenario.geoBounds.maxLat
  };
  const body = `data=${encodeURIComponent(overpassQuery(bounds))}`;
  let payload = null;
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      onProgress("Loading optional mapped soil sampling locations...");
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
      break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  if (!payload) throw lastError ?? new Error("Mapped soil-site enrichment failed.");
  const mapped = normalizeSoilHosts(payload, bounds);
  applyMappedDisturbance(scenario.cells, mapped);
  const systematic = (scenario._systematicCandidates ?? scenario.candidates).filter((candidate) => candidate.sourceType === "systematic_proxy");
  const combined = candidateStrategy === "mapped" ? mapped : [...mapped, ...systematic];
  const deduped = [];
  for (const candidate of combined) {
    if (deduped.some((entry) => Math.hypot(entry.x - candidate.x, entry.y - candidate.y) < 0.018)) continue;
    deduped.push(candidate);
    if (deduped.length >= (scenario.model?.workload?.candidateCap ?? 300)) break;
  }
  scenario.candidates = enrichCandidates(deduped, scenario.cells);
  scenario.model.mappedCandidateCount = mapped.length;
  scenario.model.hostEnrichmentStatus = mapped.length ? "loaded" : "no mapped sites returned";
  return { scenario, mappedCount: mapped.length, candidateCount: scenario.candidates.length, skipped: false };
}

export async function loadNationalSoilScenario(bounds, {
  property = "composite",
  depth = "0-15",
  candidateStrategy = "hybrid",
  candidateTarget = null,
  candidateCap = null,
  monitorCount = 10,
  interventionTarget = "remediation",
  fetchImpl = globalThis.fetch,
  signal = null,
  onProgress = () => {},
  label = null
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A Fetch-compatible implementation is required.");
  const workload = estimateNationalHeatWorkload(bounds, { monitorCount, candidateStrategy });
  if (workload.blocked) throw new Error(workload.message);
  const grid = buildViewportGrid(bounds, { maxPoints: workload.weatherPoints });
  let social = { tracts: [], status: "unavailable" };
  try {
    social = await loadNationalSocialContext(grid.bounds, { fetchImpl, signal, onProgress });
  } catch (error) {
    if (signal?.aborted) throw error;
    social = { tracts: [], status: `unavailable: ${error.message}` };
  }

  let soil = { pointMap: new Map(), properties: new Map(), status: "loaded" };
  try {
    soil = { ...await fetchSdaGrid(grid.points, depth, fetchImpl, signal, onProgress), status: "loaded" };
  } catch (error) {
    if (signal?.aborted) throw error;
    soil = { pointMap: new Map(), properties: new Map(), status: `unavailable: ${error.message}` };
  }

  const socialized = applyNationalSocialContext(grid.points.map((point) => ({ ...point })), social.tracts);
  const cells = socialized.map((point) => {
    const values = soilForCell(point, soil.pointMap, soil.properties);
    const risk = propertyPriority(property, values);
    const missingPenalty = values.soilDataObserved ? 0 : 0.42;
    return {
      ...point,
      ...values,
      propertyValue: values[SOIL_PROPERTIES[property]?.field ?? "soilComposite"] ?? null,
      soilComposite: propertyPriority("composite", values),
      risk,
      uncertainty: clamp(0.18 + missingPenalty + 0.20 * risk + 0.12 * point.vulnerability),
      exposure: point.exposure ?? 0.35,
      vulnerability: point.vulnerability ?? 0.35,
      communityPriority: clamp(0.36 * (point.vulnerability ?? 0.35) + 0.24 * (point.exposure ?? 0.35) + 0.30 * risk + 0.10 * missingPenalty),
      ecology: clamp(0.40 * (values.organicMatter ?? 2) / 6 + 0.28 * (values.availableWater ?? 0.12) / 0.25 + 0.18 * (1 - risk) + 0.14 * (1 - (point.exposure ?? 0.35))),
      landClass: clamp(0.48 * (values.clayPercent ?? 30) / 60 + 0.32 * (values.organicMatter ?? 2) / 6 + 0.20 * (values.availableWater ?? 0.12) / 0.25),
      networkBranch: Math.min(3, Math.floor((point.x + point.y) * 2)),
      disturbancePressure: 0
    };
  });
  assignSoilGroups(cells);

  onProgress("Generating systematic soil sampling candidates...");
  const systematic = buildSystematicCandidates(cells, grid.bounds, {
    target: candidateTarget ?? workload.candidateTarget,
    maximum: candidateCap ?? workload.candidateCap
  }).map((candidate) => ({
    ...candidate,
    name: "Systematic soil sampling proxy",
    hostType: "Systematic soil sample",
    cost: 0.66,
    reliability: 0.90,
    measurementType: "field_sample"
  }));
  const candidates = candidateStrategy === "mapped" ? [] : enrichCandidates(systematic, cells);
  const centerLat = (grid.bounds.south + grid.bounds.north) / 2;
  const centerLng = (grid.bounds.west + grid.bounds.east) / 2;
  const observedCount = cells.filter((cell) => cell.soilDataObserved).length;
  const scenario = {
    domainKey: "soil",
    scenarioType: "live-national-soil",
    cityKey: "national-soil-viewport",
    cityLabel: label || `U.S. soil viewport near ${centerLat.toFixed(3)}, ${centerLng.toFixed(3)}`,
    seed: 0,
    center: { lat: centerLat, lng: centerLng },
    bounds: [[grid.bounds.south, grid.bounds.west], [grid.bounds.north, grid.bounds.east]],
    geoBounds: { minLng: grid.bounds.west, minLat: grid.bounds.south, maxLng: grid.bounds.east, maxLat: grid.bounds.north },
    cells,
    candidates,
    observations: [],
    boundaries: social.tracts.map((tract) => ({
      id: tract.properties.GEOID,
      label: tract.properties.NAME,
      geoGeometry: tract.geometry,
      exposure: tract.exposure,
      vulnerability: tract.vulnerability
    })),
    groups: [...new Set(cells.map((cell) => cell.communityGroup))].sort((a, b) => a - b),
    model: {
      source: "USDA-NRCS SSURGO Soil Data Access",
      property,
      propertyLabel: SOIL_PROPERTIES[property]?.label ?? "Soil-health composite",
      propertyUnit: SOIL_PROPERTIES[property]?.unit ?? "index",
      depth,
      depthLabel: SOIL_DEPTHS[depth]?.label ?? SOIL_DEPTHS["0-15"].label,
      soilDataStatus: soil.status,
      soilObservedCount: observedCount,
      soilCoverageRate: observedCount / Math.max(1, cells.length),
      censusStatus: social.status,
      candidateStrategy,
      systematicCandidateCount: systematic.length,
      mappedCandidateCount: 0,
      hostEnrichmentStatus: candidateStrategy === "systematic" ? "skipped" : "pending",
      workload,
      interventionTarget,
      requiresLaboratorySamples: Boolean(SOIL_PROPERTIES[property]?.requiresLaboratorySamples),
      labSampleCount: 0,
      soilInference: null,
      soilValidation: null
    },
    sourceMetadata: {
      live: soil.status === "loaded",
      sources: [
        { label: "USDA Soil Data Access / SSURGO", agency: "USDA Natural Resources Conservation Service", role: "Official mapped soil survey map units and component/horizon properties." },
        { label: "2024 ACS 5-year estimates", agency: "U.S. Census Bureau", role: "Population exposure and area-level social vulnerability." },
        { label: "OpenStreetMap Overpass", agency: "OpenStreetMap contributors", role: "Optional parks, schools, agriculture, brownfields, landfills, and industrial-site sampling proxies." }
      ],
      layers: [
        { label: SOIL_PROPERTIES[property]?.label ?? "Soil-health composite", source: "USDA SSURGO horizon aggregation", status: soil.status, resolution: "Mapped soil map unit; source surveys commonly 1:12,000–1:63,360", confidence: soil.status === "loaded" ? "medium" : "low", interpretation: "Representative map-unit property, not a laboratory measurement at the exact displayed point." },
        { label: "Social vulnerability", source: "2024 ACS 5-year estimates", status: social.status, resolution: "Census tract", confidence: social.status === "loaded" ? "medium" : "low", interpretation: "Area-level social indicator used for monitoring equity, not individual-level data." }
      ],
      limitations: [
        "SSURGO map units can contain multiple soil components and within-unit variability; LUMOS aggregates major-component horizons over the selected depth interval.",
        "The SoilGrids REST API is not used because ISRIC currently reports that service as paused; USDA Soil Data Access is the primary live U.S. source.",
        "Contaminant targets remain screening-only until compatible laboratory samples are imported; SSURGO does not supply contaminant concentrations.",
        "Mapped public or disturbed sites are sampling proxies and require permission, access, safety review, and field verification."
      ]
    },
    _systematicCandidates: systematic
  };
  applyNationalSoilIntervention(scenario, interventionTarget);
  return scenario;
}
