import { CACHE_DURATIONS, getCachedJson, putCachedJson } from "../../storage/cache.js";
import { loadNationalLandCover } from "./nlcd.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const TIGER_TRACTS_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/8/query";
const ACS_2024_URL = "https://api.census.gov/data/2024/acs/acs5";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const MAX_WEATHER_BATCH = 24;
const DEFAULT_MAX_POINTS = 96;
const MAX_VIEWPORT_AREA_KM2 = 40000;
const MAX_TRACTS = 1800;
const MAX_OSM_CANDIDATES = 110;
const MAX_SYSTEMATIC_CANDIDATES = 500;
const DEFAULT_OVERPASS_TIMEOUT_MS = 10000;

const WORKLOAD_TIERS = [
  {
    key: "standard",
    label: "Standard",
    maximumAreaKm2: 2500,
    weatherPoints: 96,
    candidateTarget: 220,
    candidateCap: 360,
    expectedRuntime: "8–20 s",
    overpassTimeoutMs: 10000,
    message: "Full LUMOS objectives, constraints, portfolio, and scientific benchmarks remain enabled."
  },
  {
    key: "large",
    label: "Large",
    maximumAreaKm2: 12000,
    weatherPoints: 80,
    candidateTarget: 180,
    candidateCap: 300,
    expectedRuntime: "12–30 s",
    overpassTimeoutMs: 8500,
    message: "Spatial inputs are sampled more coarsely, but the complete LUMOS model and solver portfolio remain enabled."
  },
  {
    key: "regional",
    label: "Regional screening",
    maximumAreaKm2: MAX_VIEWPORT_AREA_KM2,
    weatherPoints: 64,
    candidateTarget: 140,
    candidateCap: 220,
    expectedRuntime: "15–40 s",
    overpassTimeoutMs: 6500,
    message: "Regional screening uses coarser spatial inputs; no scientific objective, fairness constraint, or benchmark is removed."
  }
];

const ACS_VARIABLES = [
  "NAME",
  "B01003_001E",
  "B17001_001E",
  "B17001_002E",
  "B01001_003E",
  "B01001_027E",
  "B01001_020E",
  "B01001_021E",
  "B01001_022E",
  "B01001_023E",
  "B01001_024E",
  "B01001_025E",
  "B01001_044E",
  "B01001_045E",
  "B01001_046E",
  "B01001_047E",
  "B01001_048E",
  "B01001_049E",
  "B08201_001E",
  "B08201_002E"
];

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > -1e8 ? number : null;
}

function normalizeBounds(bounds) {
  const west = clamp(finite(bounds?.west) ?? -125, -180, 180);
  const east = clamp(finite(bounds?.east) ?? -66, -180, 180);
  const south = clamp(finite(bounds?.south) ?? 24, -89.5, 89.5);
  const north = clamp(finite(bounds?.north) ?? 50, -89.5, 89.5);
  if (!(east > west) || !(north > south)) throw new Error("The current map extent is not a valid environmental workspace.");
  return { west, east, south, north };
}

export function viewportAreaKm2(bounds) {
  const normalized = normalizeBounds(bounds);
  const midLatitude = (normalized.south + normalized.north) / 2;
  const northSouth = (normalized.north - normalized.south) * 111.32;
  const eastWest = (normalized.east - normalized.west) * 111.32 * Math.max(0.12, Math.cos(midLatitude * Math.PI / 180));
  return Math.abs(northSouth * eastWest);
}

export function validateNationalHeatBounds(bounds) {
  const normalized = normalizeBounds(bounds);
  const areaKm2 = viewportAreaKm2(normalized);
  if (areaKm2 > MAX_VIEWPORT_AREA_KM2) {
    throw new Error(`Zoom in before fitting the national model. The visible area is about ${Math.round(areaKm2).toLocaleString()} km²; the browser workspace supports up to ${MAX_VIEWPORT_AREA_KM2.toLocaleString()} km² per run.`);
  }
  return { ...normalized, areaKm2 };
}

export function estimateNationalHeatWorkload(bounds, {
  monitorCount = 10,
  candidateStrategy = "hybrid"
} = {}) {
  const normalized = normalizeBounds(bounds);
  const areaKm2 = viewportAreaKm2(normalized);
  const tier = WORKLOAD_TIERS.find((entry) => areaKm2 <= entry.maximumAreaKm2) ?? null;
  if (!tier) {
    return {
      ...normalized,
      areaKm2,
      blocked: true,
      key: "blocked",
      label: "Too large",
      weatherPoints: 0,
      evaluationPoints: 0,
      candidateTarget: 0,
      candidateCap: 0,
      expectedRuntime: "Not available",
      overpassTimeoutMs: 0,
      candidateStrategy,
      message: `Zoom in or divide the region into subregions. Browser runs are limited to ${MAX_VIEWPORT_AREA_KM2.toLocaleString()} km².`
    };
  }
  const countFloor = Math.max(72, Math.round(Number(monitorCount || 10) * 12));
  const candidateTarget = Math.min(tier.candidateCap, Math.max(tier.candidateTarget, countFloor));
  return {
    ...normalized,
    areaKm2,
    blocked: false,
    key: tier.key,
    label: tier.label,
    weatherPoints: tier.weatherPoints,
    evaluationPoints: tier.weatherPoints,
    candidateTarget,
    candidateCap: tier.candidateCap,
    expectedRuntime: tier.expectedRuntime,
    overpassTimeoutMs: tier.overpassTimeoutMs,
    candidateStrategy,
    message: tier.message,
    fullModelEnabled: true
  };
}

export function buildViewportGrid(bounds, { maxPoints = DEFAULT_MAX_POINTS } = {}) {
  const normalized = validateNationalHeatBounds(bounds);
  const width = normalized.east - normalized.west;
  const height = normalized.north - normalized.south;
  const aspect = Math.max(0.25, Math.min(4, width / Math.max(1e-9, height)));
  const rows = Math.max(5, Math.round(Math.sqrt(maxPoints / aspect)));
  const columns = Math.max(5, Math.round(rows * aspect));
  const cappedColumns = Math.max(5, Math.min(columns, 16));
  const cappedRows = Math.max(5, Math.min(rows, Math.floor(maxPoints / cappedColumns) || 5));
  const points = [];
  for (let row = 0; row < cappedRows; row += 1) {
    const y = cappedRows === 1 ? 0.5 : row / (cappedRows - 1);
    for (let column = 0; column < cappedColumns; column += 1) {
      const x = cappedColumns === 1 ? 0.5 : column / (cappedColumns - 1);
      points.push({
        id: `viewport-${row}-${column}`,
        x,
        y,
        lng: normalized.west + width * x,
        lat: normalized.south + height * y
      });
    }
  }
  return { bounds: normalized, rows: cappedRows, columns: cappedColumns, points };
}

function currentRecord(response) {
  const current = response?.current ?? {};
  return {
    temperature: finite(current.temperature_2m),
    apparentTemperature: finite(current.apparent_temperature),
    humidity: finite(current.relative_humidity_2m),
    windSpeed: finite(current.wind_speed_10m),
    windDirection: finite(current.wind_direction_10m),
    time: current.time ?? null,
    modelLatitude: finite(response?.latitude),
    modelLongitude: finite(response?.longitude),
    elevation: finite(response?.elevation)
  };
}

export function normalizeViewportHeatResponses(points, payloads) {
  const responses = Array.isArray(payloads) ? payloads : [payloads];
  if (responses.length !== points.length) {
    throw new Error(`Open-Meteo returned ${responses.length} locations for ${points.length} requested viewport points.`);
  }
  return points.map((point, index) => {
    const record = currentRecord(responses[index]);
    if (record.apparentTemperature === null || record.temperature === null) {
      throw new Error(`Open-Meteo did not return current heat values for viewport point ${index + 1}.`);
    }
    return {
      ...point,
      ...record,
      risk: record.apparentTemperature,
      uncertainty: 0.45,
      exposure: 0.5,
      vulnerability: 0.5,
      communityPriority: 0.5,
      ecology: 0.5,
      communityGroup: 0
    };
  });
}

async function fetchJsonWithRetry(url, fetchImpl, attempts = 2, options = {}) {
  const {
    cacheTtlMs = 0,
    cacheLabel = "Public data",
    ...fetchOptions
  } = options;
  const cached = await getCachedJson(url, {
    fetchImpl,
    ttlMs: cacheTtlMs,
    options: fetchOptions,
    label: cacheLabel
  });
  if (cached) return cached.value;

  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { cache: "no-store", ...fetchOptions });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      await putCachedJson(url, payload, {
        fetchImpl,
        options: fetchOptions,
        label: cacheLabel
      });
      return payload;
    } catch (error) {
      if (fetchOptions.signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw new Error(lastError?.message ?? "request failed");
}

async function fetchJsonWithTimeout(url, fetchImpl, {
  timeoutMs = DEFAULT_OVERPASS_TIMEOUT_MS,
  signal = null,
  ...options
} = {}) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal?.reason ?? new DOMException("Aborted", "AbortError"));
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);
  try {
    return await fetchJsonWithRetry(url, fetchImpl, 1, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      const timeoutError = new Error(`Request timed out after ${timeoutMs} ms`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", abortFromParent);
  }
}

async function fetchWeatherBatch(points, fetchImpl, signal = null, cacheLabel = "Open-Meteo heat field") {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.lat.toFixed(5)).join(","),
    longitude: points.map((point) => point.lng.toFixed(5)).join(","),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "GMT",
    forecast_days: "1"
  });
  const payload = await fetchJsonWithRetry(`${OPEN_METEO_URL}?${params}`, fetchImpl, 3, {
    signal,
    cacheTtlMs: CACHE_DURATIONS.weather,
    cacheLabel
  });
  return normalizeViewportHeatResponses(points, payload);
}

async function fetchWeatherGrid(grid, fetchImpl, onProgress, signal = null, {
  progressLabel = "current heat conditions",
  cacheLabel = "Open-Meteo heat field"
} = {}) {
  const output = [];
  const batches = Math.ceil(grid.points.length / MAX_WEATHER_BATCH);
  for (let start = 0, batchIndex = 0; start < grid.points.length; start += MAX_WEATHER_BATCH, batchIndex += 1) {
    onProgress(`Loading ${progressLabel} ${batchIndex + 1} of ${batches}...`);
    output.push(...await fetchWeatherBatch(grid.points.slice(start, start + MAX_WEATHER_BATCH), fetchImpl, signal, cacheLabel));
  }
  return output;
}

function tractQueryUrl(bounds) {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,STATE,COUNTY,TRACT,NAME,AREALAND,CENTLAT,CENTLON",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(MAX_TRACTS),
    f: "geojson"
  });
  return `${TIGER_TRACTS_URL}?${params}`;
}

export function normalizeTractFeatures(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.map((feature, index) => {
    const properties = feature.properties ?? feature.attributes ?? {};
    const geoid = String(properties.GEOID ?? properties.geoid ?? "").trim();
    if (!geoid || !feature.geometry) return null;
    return {
      type: "Feature",
      id: geoid,
      properties: {
        ...properties,
        GEOID: geoid,
        STATE: String(properties.STATE ?? properties.state ?? geoid.slice(0, 2)),
        COUNTY: String(properties.COUNTY ?? properties.county ?? geoid.slice(2, 5)),
        TRACT: String(properties.TRACT ?? properties.tract ?? geoid.slice(5)),
        NAME: properties.NAME ?? properties.name ?? `Census tract ${geoid}`,
        AREALAND: finite(properties.AREALAND ?? properties.arealand) ?? 0,
        CENTLAT: finite(properties.CENTLAT ?? properties.centlat),
        CENTLON: finite(properties.CENTLON ?? properties.centlon)
      },
      geometry: feature.geometry,
      _sourceIndex: index
    };
  }).filter(Boolean);
}

async function fetchTracts(bounds, fetchImpl, signal = null) {
  const payload = await fetchJsonWithRetry(tractQueryUrl(bounds), fetchImpl, 2, {
    signal,
    cacheTtlMs: CACHE_DURATIONS.censusGeometry,
    cacheLabel: "Census tract geometry"
  });
  const features = normalizeTractFeatures(payload);
  if (!features.length) throw new Error("Census TIGERweb returned no tract geometry for the fitted area.");
  if (features.length >= MAX_TRACTS) throw new Error("The fitted area contains too many census tracts. Zoom in and fit a smaller area.");
  return features;
}

function sumFields(record, names) {
  return names.reduce((sum, name) => sum + (finite(record[name]) ?? 0), 0);
}

export function normalizeAcsRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return new Map();
  const headers = rows[0];
  const output = new Map();
  for (const values of rows.slice(1)) {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const state = String(record.state ?? "").padStart(2, "0");
    const county = String(record.county ?? "").padStart(3, "0");
    const tract = String(record.tract ?? "").padStart(6, "0");
    const geoid = `${state}${county}${tract}`;
    const population = Math.max(0, finite(record.B01003_001E) ?? 0);
    const povertyUniverse = Math.max(0, finite(record.B17001_001E) ?? 0);
    const poverty = Math.max(0, finite(record.B17001_002E) ?? 0);
    const young = sumFields(record, ["B01001_003E", "B01001_027E"]);
    const older = sumFields(record, [
      "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
      "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E"
    ]);
    const households = Math.max(0, finite(record.B08201_001E) ?? 0);
    const noVehicle = Math.max(0, finite(record.B08201_002E) ?? 0);
    output.set(geoid, {
      geoid,
      name: record.NAME ?? geoid,
      population,
      povertyRate: povertyUniverse > 0 ? poverty / povertyUniverse : 0,
      youngRate: population > 0 ? young / population : 0,
      olderRate: population > 0 ? older / population : 0,
      noVehicleRate: households > 0 ? noVehicle / households : 0
    });
  }
  return output;
}

async function fetchCountyAcs(state, county, fetchImpl, signal = null) {
  const params = new URLSearchParams({
    get: ACS_VARIABLES.join(","),
    for: "tract:*",
    in: `state:${state} county:${county}`
  });
  const payload = await fetchJsonWithRetry(`${ACS_2024_URL}?${params}`, fetchImpl, 2, {
    signal,
    cacheTtlMs: CACHE_DURATIONS.censusSocial,
    cacheLabel: `ACS social indicators ${state}-${county}`
  });
  return normalizeAcsRows(payload);
}

async function fetchAcsForTracts(tracts, fetchImpl, onProgress, signal = null) {
  const pairs = [...new Set(tracts.map((feature) => `${feature.properties.STATE}:${feature.properties.COUNTY}`))];
  const output = new Map();
  for (let index = 0; index < pairs.length; index += 1) {
    const [state, county] = pairs[index].split(":");
    onProgress(`Loading Census social data ${index + 1} of ${pairs.length}...`);
    const countyRows = await fetchCountyAcs(state, county, fetchImpl, signal);
    for (const [geoid, record] of countyRows) output.set(geoid, record);
  }
  return output;
}


export async function loadNationalSocialContext(bounds, {
  fetchImpl = globalThis.fetch,
  signal = null,
  onProgress = () => {}
} = {}) {
  const normalized = normalizeBounds(bounds);
  onProgress("Loading Census tract geometry...");
  const tractFeatures = await fetchTracts(normalized, fetchImpl, signal);
  onProgress("Loading ACS population and vulnerability indicators...");
  const acs = await fetchAcsForTracts(tractFeatures, fetchImpl, onProgress, signal);
  return { tracts: enrichTracts(tractFeatures, acs), status: "loaded" };
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInRing(lng, lat, geometry.coordinates[0])
      && !geometry.coordinates.slice(1).some((ring) => pointInRing(lng, lat, ring));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => (
      pointInRing(lng, lat, polygon[0])
      && !polygon.slice(1).some((ring) => pointInRing(lng, lat, ring))
    ));
  }
  return false;
}

function geometryBounds(geometry) {
  const points = geometry.type === "Polygon"
    ? geometry.coordinates.flat(1)
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates.flat(2)
      : [];
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return {
    west: Math.min(...lngs), east: Math.max(...lngs),
    south: Math.min(...lats), north: Math.max(...lats)
  };
}

function enrichTracts(tracts, acsByGeoid) {
  return tracts.map((feature) => {
    const social = acsByGeoid.get(feature.properties.GEOID) ?? null;
    const landKm2 = Math.max(0.05, (feature.properties.AREALAND || 0) / 1e6);
    const density = social ? social.population / landKm2 : 0;
    const povertyScore = clamp((social?.povertyRate ?? 0) / 0.35);
    const olderScore = clamp((social?.olderRate ?? 0) / 0.30);
    const youngScore = clamp((social?.youngRate ?? 0) / 0.10);
    const noVehicleScore = clamp((social?.noVehicleRate ?? 0) / 0.40);
    const vulnerability = clamp(0.45 * povertyScore + 0.25 * olderScore + 0.15 * youngScore + 0.15 * noVehicleScore);
    const exposure = social ? clamp(Math.log1p(density) / Math.log1p(12000)) : 0.35;
    const bounds = geometryBounds(feature.geometry);
    const centroid = {
      lat: feature.properties.CENTLAT ?? (bounds.south + bounds.north) / 2,
      lng: feature.properties.CENTLON ?? (bounds.west + bounds.east) / 2
    };
    return { ...feature, social, density, exposure, vulnerability, bounds, centroid };
  });
}

function tractForPoint(point, tracts) {
  const candidates = tracts.filter((tract) => (
    point.lng >= tract.bounds.west && point.lng <= tract.bounds.east
    && point.lat >= tract.bounds.south && point.lat <= tract.bounds.north
  ));
  const containing = candidates.find((tract) => pointInGeometry(point.lng, point.lat, tract.geometry));
  if (containing) return containing;
  return tracts.reduce((best, tract) => {
    const distance = (point.lng - tract.centroid.lng) ** 2 + (point.lat - tract.centroid.lat) ** 2;
    return distance < best.distance ? { tract, distance } : best;
  }, { tract: null, distance: Infinity }).tract;
}

function minMax(values) {
  const finiteValues = values.filter(Number.isFinite);
  return {
    min: finiteValues.length ? Math.min(...finiteValues) : 0,
    max: finiteValues.length ? Math.max(...finiteValues) : 1
  };
}

function normalizeWithin(value, range, fallback = 0.5) {
  if (!Number.isFinite(value) || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return fallback;
  if (Math.abs(range.max - range.min) < 1e-9) return fallback;
  return clamp((value - range.min) / (range.max - range.min));
}

function assignCommunityGroups(cells) {
  const vulnerabilityOrder = [...cells].sort((left, right) => left.vulnerability - right.vulnerability);
  vulnerabilityOrder.forEach((cell, index) => {
    cell.vulnerabilityQuartile = Math.min(3, Math.floor(index / Math.max(1, vulnerabilityOrder.length / 4)));
  });
  const exposureValues = cells.map((cell) => cell.exposure).sort((left, right) => left - right);
  const exposureMedian = exposureValues[Math.floor(exposureValues.length / 2)] ?? 0.5;
  cells.forEach((cell) => {
    const exposureBand = cell.exposure >= exposureMedian ? 1 : 0;
    cell.communityGroup = cell.vulnerabilityQuartile * 2 + exposureBand;
    cell.communityGroupLabel = `Vulnerability Q${cell.vulnerabilityQuartile + 1} · ${exposureBand ? "higher" : "lower"} exposure`;
  });
}


export function applyNationalSocialContext(points, tracts = []) {
  const cells = points.map((point) => {
    const tract = tracts.length ? tractForPoint(point, tracts) : null;
    const exposure = tract?.exposure ?? 0.35;
    const vulnerability = tract?.vulnerability ?? 0.35;
    return {
      ...point,
      tractGeoid: tract?.properties?.GEOID ?? null,
      tractName: tract?.properties?.NAME ?? null,
      population: tract?.social?.population ?? null,
      populationDensityKm2: tract?.density ?? null,
      povertyRate: tract?.social?.povertyRate ?? null,
      olderRate: tract?.social?.olderRate ?? null,
      youngRate: tract?.social?.youngRate ?? null,
      noVehicleRate: tract?.social?.noVehicleRate ?? null,
      exposure,
      vulnerability,
      communityPriority: clamp(0.55 * vulnerability + 0.45 * exposure),
      ecology: clamp(1 - 0.45 * exposure),
      landClass: exposure,
      networkBranch: Math.min(3, Math.floor(((point.x ?? 0) + (point.y ?? 0)) * 2))
    };
  });
  assignCommunityGroups(cells);
  return cells;
}

function fallbackLandCover(exposure) {
  const impervious = clamp(0.08 + 0.76 * exposure);
  const treeCanopy = clamp(0.58 - 0.42 * exposure);
  return {
    landCoverCode: null,
    landCoverLabel: "Census-density land-cover proxy",
    impervious,
    treeCanopy,
    vegetation: clamp(0.72 - 0.48 * impervious),
    waterPresence: 0,
    developedIntensity: clamp(0.12 + 0.82 * impervious),
    landCoverObserved: false,
    landCoverConfidence: 0.24
  };
}

function nearestWaterProximity(cell, waterCells) {
  if (!waterCells.length) return 0;
  const distance = waterCells.reduce((best, waterCell) => Math.min(best, Math.hypot(cell.x - waterCell.x, cell.y - waterCell.y)), Infinity);
  return 1 - clamp(distance / 0.32);
}

function finalizeCells(weather, tracts, bounds, landCoverById = new Map()) {
  const apparentRange = minMax(weather.map((entry) => entry.apparentTemperature));
  const width = bounds.east - bounds.west;
  const height = bounds.north - bounds.south;
  const prelim = weather.map((entry) => {
    const tract = tracts.length ? tractForPoint(entry, tracts) : null;
    const exposure = tract?.exposure ?? 0.35;
    const vulnerability = tract?.vulnerability ?? 0.35;
    const sampledLandCover = landCoverById.get(entry.id) ?? null;
    const landCover = sampledLandCover?.landCoverObserved
      ? sampledLandCover
      : { ...fallbackLandCover(exposure), rasterFunction: sampledLandCover?.rasterFunction ?? null };
    const relativeHeat = normalizeWithin(entry.apparentTemperature, apparentRange);
    const absoluteHeat = clamp((entry.apparentTemperature - 65) / 40);
    const builtForm = clamp(0.64 * landCover.impervious + 0.36 * landCover.developedIntensity);
    const surfaceHeatAmplification = clamp(
      0.46 * landCover.impervious
      + 0.27 * (1 - landCover.treeCanopy)
      + 0.17 * landCover.developedIntensity
      + 0.10 * exposure
    );
    const risk = clamp(0.58 * absoluteHeat + 0.22 * relativeHeat + 0.20 * surfaceHeatAmplification);
    return {
      ...entry,
      ...landCover,
      tractGeoid: tract?.properties.GEOID ?? null,
      tractName: tract?.properties.NAME ?? null,
      population: tract?.social?.population ?? null,
      populationDensityKm2: tract?.density ?? null,
      povertyRate: tract?.social?.povertyRate ?? null,
      olderRate: tract?.social?.olderRate ?? null,
      youngRate: tract?.social?.youngRate ?? null,
      noVehicleRate: tract?.social?.noVehicleRate ?? null,
      risk,
      exposure,
      vulnerability,
      builtForm,
      surfaceHeatAmplification,
      landClass: clamp(0.62 * landCover.developedIntensity + 0.38 * (1 - landCover.vegetation)),
      ecology: clamp(0.46 * landCover.vegetation + 0.34 * landCover.treeCanopy + 0.20 * landCover.waterPresence),
      communityPriority: clamp(0.42 * vulnerability + 0.28 * exposure + 0.22 * risk + 0.08 * (1 - landCover.treeCanopy)),
      networkBranch: Math.min(3, Math.floor((entry.x + entry.y) * 2)),
      _edge: Math.min(entry.x, 1 - entry.x, entry.y, 1 - entry.y),
      _width: width,
      _height: height
    };
  });

  const waterCells = prelim.filter((cell) => cell.waterPresence >= 0.5);
  prelim.forEach((cell) => {
    cell.waterProximity = nearestWaterProximity(cell, waterCells);
    cell.surfaceHeatAmplification = clamp(cell.surfaceHeatAmplification - 0.10 * cell.waterProximity);
    cell.risk = clamp(cell.risk - 0.05 * cell.waterProximity);
  });

  const temperatureAt = new Map(prelim.map((cell) => [`${cell.x.toFixed(4)}:${cell.y.toFixed(4)}`, cell.apparentTemperature]));
  const gradientValues = prelim.map((cell) => {
    const neighborDeltas = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = clamp(cell.x + dx / Math.max(1, Math.round(Math.sqrt(prelim.length)) - 1));
      const y = clamp(cell.y + dy / Math.max(1, Math.round(Math.sqrt(prelim.length)) - 1));
      const neighbor = temperatureAt.get(`${x.toFixed(4)}:${y.toFixed(4)}`);
      if (Number.isFinite(neighbor)) neighborDeltas.push(Math.abs(cell.apparentTemperature - neighbor));
    }
    return neighborDeltas.length ? Math.max(...neighborDeltas) : 0;
  });
  const gradientRange = minMax(gradientValues);

  prelim.forEach((cell, index) => {
    const edgePriority = 1 - clamp(cell._edge / 0.22);
    const gradientPriority = normalizeWithin(gradientValues[index], gradientRange, 0.35);
    const missingSocial = cell.tractGeoid ? 0 : 1;
    const missingLandCover = cell.landCoverObserved ? 0 : 1;
    cell.uncertainty = clamp(
      0.16
      + 0.42 * gradientPriority
      + 0.13 * edgePriority
      + 0.13 * missingSocial
      + 0.16 * missingLandCover
    );
    delete cell._edge;
    delete cell._width;
    delete cell._height;
  });
  assignCommunityGroups(prelim);
  return prelim;
}

function overpassQuery(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:25];(
    nwr["amenity"~"school|library|community_centre|fire_station|police|hospital|clinic|townhall"](${bbox});
    nwr["building"~"civic|public|government"](${bbox});
    nwr["leisure"="park"](${bbox});
  );out center ${MAX_OSM_CANDIDATES * 3};`;
}

function hostProfile(tags = {}) {
  const amenity = String(tags.amenity ?? "");
  const building = String(tags.building ?? "");
  const leisure = String(tags.leisure ?? "");
  if (amenity === "library") return { hostType: "Library", cost: 0.72, feasibility: 0.92, reliability: 0.91 };
  if (amenity === "school") return { hostType: "School", cost: 0.82, feasibility: 0.88, reliability: 0.88 };
  if (["fire_station", "police", "townhall"].includes(amenity)) return { hostType: "Civic facility", cost: 0.78, feasibility: 0.93, reliability: 0.94 };
  if (["hospital", "clinic"].includes(amenity)) return { hostType: "Health facility", cost: 0.95, feasibility: 0.86, reliability: 0.94 };
  if (amenity === "community_centre") return { hostType: "Community center", cost: 0.76, feasibility: 0.87, reliability: 0.87 };
  if (leisure === "park") return { hostType: "Park", cost: 0.68, feasibility: 0.68, reliability: 0.72 };
  if (["civic", "public", "government"].includes(building)) return { hostType: "Public building", cost: 0.80, feasibility: 0.86, reliability: 0.86 };
  return { hostType: "Public-site proxy", cost: 0.85, feasibility: 0.75, reliability: 0.78 };
}

export function normalizeOverpassCandidates(payload, bounds) {
  const normalizedBounds = normalizeBounds(bounds);
  const width = normalizedBounds.east - normalizedBounds.west;
  const height = normalizedBounds.north - normalizedBounds.south;
  const dedupe = new Set();
  const output = [];
  for (const element of payload?.elements ?? []) {
    const lat = finite(element.lat ?? element.center?.lat);
    const lng = finite(element.lon ?? element.center?.lon);
    if (lat === null || lng === null) continue;
    if (lng < normalizedBounds.west || lng > normalizedBounds.east || lat < normalizedBounds.south || lat > normalizedBounds.north) continue;
    const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    const profile = hostProfile(element.tags);
    output.push({
      id: `osm-${element.type}-${element.id}`,
      name: element.tags?.name ?? `${profile.hostType} candidate`,
      hostType: profile.hostType,
      source: "OpenStreetMap",
      sourceType: "mapped_host",
      lat,
      lng,
      x: clamp((lng - normalizedBounds.west) / width),
      y: clamp((lat - normalizedBounds.south) / height),
      cost: profile.cost,
      feasibility: profile.feasibility,
      reliability: profile.reliability,
      feasible: profile.feasibility >= 0.55,
      sitingConfidence: 0.68,
      permissionStatus: "unknown",
      powerConfidence: 0.55,
      maintenanceAccess: 0.65,
      requiresFieldVerification: true
    });
    if (output.length >= MAX_OSM_CANDIDATES) break;
  }
  return output;
}

async function fetchOverpassCandidates(bounds, fetchImpl, {
  timeoutMs = DEFAULT_OVERPASS_TIMEOUT_MS,
  signal = null,
  onProgress = () => {}
} = {}) {
  const query = overpassQuery(bounds);
  let lastError = null;
  const perEndpointTimeout = Math.max(2800, Math.floor(timeoutMs / OVERPASS_ENDPOINTS.length));
  for (let index = 0; index < OVERPASS_ENDPOINTS.length; index += 1) {
    const endpoint = OVERPASS_ENDPOINTS[index];
    try {
      onProgress(`Searching mapped public hosts ${index + 1} of ${OVERPASS_ENDPOINTS.length}...`);
      const payload = await fetchJsonWithTimeout(endpoint, fetchImpl, {
        timeoutMs: perEndpointTimeout,
        signal,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: `data=${encodeURIComponent(query)}`,
        cacheTtlMs: CACHE_DURATIONS.mappedHosts,
        cacheLabel: "OpenStreetMap candidate hosts"
      });
      return normalizeOverpassCandidates(payload, bounds);
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
    }
  }
  throw new Error(lastError?.message ?? "OpenStreetMap candidate-host query failed");
}

function nearestCell(candidate, cells) {
  return cells.reduce((best, cell) => {
    const distance = (cell.x - candidate.x) ** 2 + (cell.y - candidate.y) ** 2;
    return distance < best.distance ? { cell, distance } : best;
  }, { cell: cells[0], distance: Infinity }).cell;
}

export function buildSystematicCandidates(cells, bounds, {
  target = 180,
  maximum = MAX_SYSTEMATIC_CANDIDATES
} = {}) {
  const normalized = normalizeBounds(bounds);
  const cappedTarget = Math.max(24, Math.min(maximum, Math.round(target)));
  const midLatitude = (normalized.south + normalized.north) / 2;
  const widthKm = (normalized.east - normalized.west) * 111.32 * Math.max(0.12, Math.cos(midLatitude * Math.PI / 180));
  const heightKm = (normalized.north - normalized.south) * 111.32;
  const aspect = Math.max(0.25, Math.min(4, widthKm / Math.max(1e-9, heightKm)));
  const rows = Math.max(4, Math.round(Math.sqrt(cappedTarget / Math.max(0.25, aspect * 0.866))));
  const columns = Math.max(4, Math.round(cappedTarget / rows));
  const output = [];
  for (let row = 0; row < rows; row += 1) {
    const y = (row + 0.5) / rows;
    const offset = row % 2 ? 0.5 : 0;
    for (let column = 0; column < columns; column += 1) {
      if (output.length >= cappedTarget) break;
      const x = (column + 0.5 + offset) / columns;
      if (x >= 0.995) continue;
      const lng = normalized.west + (normalized.east - normalized.west) * x;
      const lat = normalized.south + (normalized.north - normalized.south) * y;
      output.push({
        id: `systematic-${row}-${column}`,
        name: "Systematic siting proxy",
        hostType: "Systematic mesh",
        source: "LUMOS systematic candidate mesh",
        sourceType: "systematic_proxy",
        x,
        y,
        lat,
        lng,
        cost: 0.92,
        feasibility: 0.64,
        reliability: 0.74,
        feasible: true,
        proxy: true,
        sitingConfidence: 0.35,
        permissionStatus: "unknown",
        powerConfidence: 0.35,
        maintenanceAccess: 0.45,
        requiresFieldVerification: true
      });
    }
  }
  if (output.length < cappedTarget) {
    const orderedCells = [...cells].sort((left, right) => (
      ((right.risk ?? 0) + (right.uncertainty ?? 0) + (right.exposure ?? 0))
      - ((left.risk ?? 0) + (left.uncertainty ?? 0) + (left.exposure ?? 0))
      || String(left.id).localeCompare(String(right.id))
    ));
    for (const cell of orderedCells) {
      if (output.length >= cappedTarget) break;
      if (output.some((candidate) => Math.hypot(candidate.x - cell.x, candidate.y - cell.y) < 0.018)) continue;
      output.push({
        id: `systematic-cell-${cell.id}`,
        name: "Systematic siting proxy",
        hostType: "Systematic mesh",
        source: "LUMOS systematic candidate mesh",
        sourceType: "systematic_proxy",
        x: cell.x,
        y: cell.y,
        lat: cell.lat,
        lng: cell.lng,
        cost: 0.92,
        feasibility: 0.64,
        reliability: 0.74,
        feasible: true,
        proxy: true,
        sitingConfidence: 0.35,
        permissionStatus: "unknown",
        powerConfidence: 0.35,
        maintenanceAccess: 0.45,
        requiresFieldVerification: true
      });
    }
  }
  return output.slice(0, cappedTarget);
}

function deterministicSpatialSample(candidates, maximum) {
  if (candidates.length <= maximum) return candidates;
  const bins = new Map();
  for (const candidate of candidates) {
    const key = `${Math.min(9, Math.floor(candidate.x * 10))}:${Math.min(9, Math.floor(candidate.y * 10))}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(candidate);
  }
  const queues = [...bins.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, values]) => values.sort((left, right) => String(left.id).localeCompare(String(right.id))));
  const output = [];
  let index = 0;
  while (output.length < maximum && queues.some((queue) => queue.length)) {
    const queue = queues[index % queues.length];
    if (queue.length) output.push(queue.shift());
    index += 1;
  }
  return output;
}

function mergeCandidateNetworks(systematic, mapped, maximum) {
  const mappedSample = deterministicSpatialSample(mapped, Math.min(mapped.length, Math.max(24, Math.floor(maximum * 0.4))));
  const retainedSystematic = systematic.filter((candidate) => !mappedSample.some((host) => (
    Math.hypot(candidate.x - host.x, candidate.y - host.y) < 0.025
  )));
  return deterministicSpatialSample([...mappedSample, ...retainedSystematic], maximum);
}

function enrichCandidates(candidates, cells) {
  return candidates.map((candidate) => {
    const cell = nearestCell(candidate, cells);
    return {
      ...candidate,
      localRisk: cell.risk,
      localUncertainty: cell.uncertainty,
      exposure: cell.exposure,
      vulnerability: cell.vulnerability,
      communityGroup: cell.communityGroup,
      landClass: cell.landClass,
      builtForm: cell.builtForm,
      networkBranch: cell.networkBranch
    };
  });
}

export function applyNationalHeatIntervention(scenario, target = "general") {
  if (!scenario?.cells?.length) return scenario;
  const raw = scenario.cells.map((cell) => {
    if (target === "tree-shade") {
      return cell.risk
        * (0.24 + 0.76 * (1 - (cell.treeCanopy ?? 0.3)))
        * (0.30 + 0.70 * (cell.impervious ?? cell.builtForm ?? 0.5))
        * (0.42 + 0.58 * cell.exposure);
    }
    if (target === "cool-surfaces") {
      return cell.risk
        * (0.20 + 0.80 * (cell.impervious ?? cell.builtForm ?? 0.5))
        * (0.46 + 0.54 * cell.exposure);
    }
    if (target === "cooling-access") {
      return cell.risk * (0.22 + 0.78 * cell.vulnerability) * (0.32 + 0.68 * cell.exposure);
    }
    return cell.risk * (
      0.18
      + 0.24 * cell.exposure
      + 0.24 * cell.vulnerability
      + 0.18 * (cell.impervious ?? cell.builtForm ?? 0.5)
      + 0.16 * (1 - (cell.treeCanopy ?? 0.3))
    );
  });
  const range = minMax(raw);
  scenario.cells.forEach((cell, index) => {
    const benefit = normalizeWithin(raw[index], range, 0.5);
    const maximumEffect = target === "cooling-access" ? 1.55 : target === "cool-surfaces" ? 2.65 : 3.15;
    const expectedEffectF = 0.30 + maximumEffect * benefit;
    cell.interventionBenefit = benefit;
    cell.controlTemperatureF = cell.apparentTemperature;
    cell.plannedTemperatureF = cell.apparentTemperature - expectedEffectF;
    cell.baselineTemperatureF = cell.apparentTemperature;
  });
  scenario.model = {
    ...(scenario.model ?? {}),
    interventionTarget: target,
    interventionAssumptions: {
      type: "screening-priority surface",
      usesLandCover: scenario.cells.some((cell) => cell.landCoverObserved),
      note: "Expected cooling is a scenario-planning proxy, not a causal effect estimate."
    }
  };
  return scenario;
}

function averageDirection(cells) {
  const angles = cells.map((cell) => finite(cell.windDirection)).filter(Number.isFinite).map((degrees) => degrees * Math.PI / 180);
  if (!angles.length) return 0;
  const x = angles.reduce((sum, angle) => sum + Math.cos(angle), 0);
  const y = angles.reduce((sum, angle) => sum + Math.sin(angle), 0);
  return Math.atan2(y, x);
}

export async function enrichNationalHeatCandidateHosts(scenario, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_OVERPASS_TIMEOUT_MS,
  signal = null,
  onProgress = () => {},
  candidateStrategy = scenario?.model?.candidateStrategy ?? "hybrid"
} = {}) {
  if (!scenario?.cells?.length || !scenario?.geoBounds) throw new Error("A fitted national Heat scenario is required.");
  if (candidateStrategy === "systematic") {
    scenario.model.hostEnrichmentStatus = "disabled";
    return { scenario, mappedCount: 0, candidateCount: scenario.candidates.length, skipped: true };
  }
  const bounds = {
    west: scenario.geoBounds.minLng,
    south: scenario.geoBounds.minLat,
    east: scenario.geoBounds.maxLng,
    north: scenario.geoBounds.maxLat
  };
  const mapped = await fetchOverpassCandidates(bounds, fetchImpl, { timeoutMs, signal, onProgress });
  const cap = scenario.model?.workload?.candidateCap ?? MAX_SYSTEMATIC_CANDIDATES;
  const systematic = (scenario._systematicCandidates ?? scenario.candidates ?? []).filter((candidate) => candidate.sourceType === "systematic_proxy");
  const merged = candidateStrategy === "mapped"
    ? deterministicSpatialSample(mapped, cap)
    : mergeCandidateNetworks(systematic, mapped, cap);
  scenario.candidates = enrichCandidates(merged, scenario.cells);
  scenario.model.mappedCandidateCount = mapped.length;
  scenario.model.systematicCandidateCount = systematic.length;
  scenario.model.hostEnrichmentStatus = mapped.length ? "loaded" : "no mapped hosts returned";
  scenario.model.candidateStatus = mapped.length
    ? `${mapped.length} mapped public hosts loaded`
    : "No mapped public hosts returned";
  const osmSource = scenario.sourceMetadata?.sources?.find((source) => source.label === "OpenStreetMap Overpass API");
  if (osmSource) osmSource.role = mapped.length
    ? `${mapped.length} mapped public facilities enrich the systematic candidate network; every site still requires field verification.`
    : "No mapped public facilities were returned; the systematic candidate network remains active.";
  return { scenario, mappedCount: mapped.length, candidateCount: scenario.candidates.length, skipped: false };
}

export async function loadNationalHeatScenario(bounds, {
  maxPoints = null,
  candidateTarget = null,
  candidateCap = null,
  candidateStrategy = "hybrid",
  awaitHostEnrichment = false,
  overpassTimeoutMs = null,
  fetchImpl = globalThis.fetch,
  signal = null,
  onProgress = () => {},
  label = null,
  interventionTarget = "general",
  monitorCount = 10,
  weatherProgressLabel = "current heat conditions",
  weatherCacheLabel = "Open-Meteo heat field"
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A Fetch-compatible implementation is required.");
  const workload = estimateNationalHeatWorkload(bounds, { monitorCount, candidateStrategy });
  if (workload.blocked) throw new Error(workload.message);
  const grid = buildViewportGrid(bounds, { maxPoints: maxPoints ?? workload.weatherPoints });
  const sourceStatus = {
    census: "loaded",
    landCover: "loaded",
    candidates: candidateStrategy === "systematic" ? "systematic-only" : "pending optional enrichment"
  };

  const weather = await fetchWeatherGrid(grid, fetchImpl, onProgress, signal, {
    progressLabel: weatherProgressLabel,
    cacheLabel: weatherCacheLabel
  });

  let landCover = { records: new Map(), status: "unavailable", rasterFunction: null, observedCount: 0, coverageRate: 0 };
  try {
    landCover = await loadNationalLandCover(grid.points, { fetchImpl, signal, onProgress });
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw error;
    sourceStatus.landCover = `unavailable: ${error.message}`;
  }

  let tracts = [];
  try {
    onProgress("Loading Census tract geometry...");
    const tractFeatures = await fetchTracts(grid.bounds, fetchImpl, signal);
    onProgress("Loading ACS population and vulnerability indicators...");
    const acs = await fetchAcsForTracts(tractFeatures, fetchImpl, onProgress, signal);
    tracts = enrichTracts(tractFeatures, acs);
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw error;
    sourceStatus.census = `unavailable: ${error.message}`;
  }

  const cells = finalizeCells(weather, tracts, grid.bounds, landCover.records);
  onProgress("Generating systematic candidate network...");
  const systematicCandidates = buildSystematicCandidates(cells, grid.bounds, {
    target: candidateTarget ?? workload.candidateTarget,
    maximum: candidateCap ?? workload.candidateCap
  });
  const initialCandidates = candidateStrategy === "mapped" ? [] : systematicCandidates;
  const candidates = enrichCandidates(initialCandidates, cells);

  const centerLat = (grid.bounds.south + grid.bounds.north) / 2;
  const centerLng = (grid.bounds.west + grid.bounds.east) / 2;
  const sampledAt = cells.find((cell) => cell.time)?.time ?? null;
  const scenario = {
    domainKey: "heat",
    scenarioType: "live-national",
    cityKey: "national-viewport",
    cityLabel: label || `U.S. viewport near ${centerLat.toFixed(3)}, ${centerLng.toFixed(3)}`,
    seed: 0,
    center: { lat: centerLat, lng: centerLng },
    bounds: [[grid.bounds.south, grid.bounds.west], [grid.bounds.north, grid.bounds.east]],
    geoBounds: {
      minLng: grid.bounds.west,
      minLat: grid.bounds.south,
      maxLng: grid.bounds.east,
      maxLat: grid.bounds.north
    },
    cells,
    candidates,
    observations: [],
    boundaries: tracts.map((tract) => ({
      id: tract.properties.GEOID,
      label: tract.properties.NAME,
      geoGeometry: tract.geometry,
      exposure: tract.exposure,
      vulnerability: tract.vulnerability
    })),
    groups: [...new Set(cells.map((cell) => cell.communityGroup))].sort((left, right) => left - right),
    model: {
      source: "National viewport Heat workspace",
      sampledAt,
      gridRows: grid.rows,
      gridColumns: grid.columns,
      viewportAreaKm2: grid.bounds.areaKm2,
      transportAngle: averageDirection(cells),
      censusStatus: sourceStatus.census,
      landCoverStatus: sourceStatus.landCover === "loaded" ? landCover.status : sourceStatus.landCover,
      landCoverRasterFunction: landCover.rasterFunction,
      landCoverCoverage: landCover.coverageRate,
      candidateStatus: sourceStatus.candidates,
      candidateStrategy,
      systematicCandidateCount: systematicCandidates.length,
      mappedCandidateCount: 0,
      hostEnrichmentStatus: candidateStrategy === "systematic" ? "disabled" : "pending",
      workload,
      fullModelEnabled: true
    },
    sourceMetadata: {
      live: true,
      sourceType: "national-viewport-model",
      sources: [
        {
          label: "Open-Meteo Weather Forecast API",
          agency: "Open-Meteo using national weather-service forecast models",
          role: "Current apparent temperature, air temperature, humidity, wind speed, and wind direction"
        },
        {
          label: "2024 Census TIGERweb and ACS 5-year API",
          agency: "U.S. Census Bureau",
          role: sourceStatus.census === "loaded"
            ? "Census tract geometry, population density, poverty, age vulnerability, and vehicle-access indicators"
            : `Social layer fallback (${sourceStatus.census})`
        },
        {
          label: "Annual National Land Cover Database web service",
          agency: "U.S. Geological Survey and Multi-Resolution Land Characteristics Consortium, served through EPA EnviroAtlas",
          role: sourceStatus.landCover === "loaded"
            ? `${landCover.rasterFunction} land-cover classes inform imperviousness, vegetation, tree-canopy, water-proximity, and surface-amplification screening layers.`
            : `Land-cover covariates unavailable (${sourceStatus.landCover}); Census-density proxies were used and clearly flagged.`
        },
        {
          label: "LUMOS systematic candidate mesh",
          agency: "LUMOS",
          role: `${systematicCandidates.length} evenly distributed siting proxies guarantee complete candidate coverage before optional host enrichment.`
        },
        {
          label: "OpenStreetMap Overpass API",
          agency: "OpenStreetMap contributors",
          role: candidateStrategy === "systematic"
            ? "Mapped-host enrichment disabled by the selected candidate strategy."
            : "Optional public-host enrichment runs after the scenario becomes usable and cannot block the fitted model."
        }
      ],
      layers: [
        {
          key: "risk",
          label: "Heat risk",
          source: "Open-Meteo current apparent temperature + Annual NLCD + ACS",
          status: sourceStatus.landCover === "loaded" ? "multi-source screening model" : "weather and Census fallback",
          resolution: `${cells.length} adaptive viewport evaluation points`,
          confidence: "screening",
          interpretation: "Combines absolute and relative apparent heat with land-surface amplification; it is not a calibrated block-scale forecast."
        },
        {
          key: "impervious",
          label: "Impervious surface proxy",
          source: sourceStatus.landCover === "loaded" ? "Annual NLCD categorical developed classes" : "Census-density proxy",
          status: sourceStatus.landCover === "loaded" ? "observed categorical proxy" : "modeled fallback",
          resolution: "NLCD class sampled at each evaluation point",
          confidence: sourceStatus.landCover === "loaded" ? "moderate" : "low",
          interpretation: "A normalized surface-intensity proxy derived from land-cover classes, not fractional impervious percentage."
        },
        {
          key: "treeCanopy",
          label: "Tree-canopy proxy",
          source: sourceStatus.landCover === "loaded" ? "Annual NLCD forest and developed classes" : "Census-density proxy",
          status: sourceStatus.landCover === "loaded" ? "categorical vegetation proxy" : "modeled fallback",
          resolution: "NLCD class sampled at each evaluation point",
          confidence: sourceStatus.landCover === "loaded" ? "moderate" : "low",
          interpretation: "Represents expected canopy intensity by land-cover class; it is not a direct percentage-canopy measurement."
        },
        {
          key: "vulnerability",
          label: "Social vulnerability",
          source: "2024 ACS five-year tract estimates",
          status: sourceStatus.census === "loaded" ? "area-level composite" : "neutral fallback",
          resolution: "Census tract",
          confidence: sourceStatus.census === "loaded" ? "moderate" : "low",
          interpretation: "Combines poverty, age susceptibility, and vehicle access; it describes areas, not individuals."
        }
      ],
      limitations: [
        "Current national Heat values are numerical weather-model output, not a block-scale urban heat-island reconstruction.",
        sourceStatus.landCover === "loaded"
          ? "Annual NLCD classes enrich the Heat prior, but categorical class-to-canopy and class-to-impervious conversions remain transparent screening proxies rather than direct fractional measurements."
          : "The national land-cover service was unavailable, so land-surface variables use lower-confidence Census-density proxies.",
        "Census vulnerability indicators are area-level estimates and must not be interpreted as individual characteristics.",
        "Systematic candidates guarantee spatial coverage but are not verified installation sites; access, permission, power, communications, shade, security, and maintenance require field verification.",
        "Mapped OpenStreetMap facilities are also planning proxies and do not imply deployment approval.",
        sourceStatus.census === "loaded"
          ? "Social layers use 2024 ACS tract estimates and may be less precise in small or sparsely sampled areas."
          : "Census social data were unavailable, so neutral exposure and vulnerability defaults were used.",
        "Performance guardrails change spatial sampling density only. The complete Bayesian objective, social constraints, Pareto portfolio, and benchmark architecture remain enabled.",
        "The nationwide model is operational and socially informed, but NYC remains the independently validated Heat inference case study."
      ]
    }
  };
  Object.defineProperty(scenario, "_systematicCandidates", {
    value: systematicCandidates,
    writable: true,
    enumerable: false,
    configurable: true
  });
  applyNationalHeatIntervention(scenario, interventionTarget);

  if (awaitHostEnrichment && candidateStrategy !== "systematic") {
    try {
      await enrichNationalHeatCandidateHosts(scenario, {
        fetchImpl,
        timeoutMs: overpassTimeoutMs ?? workload.overpassTimeoutMs,
        signal,
        onProgress,
        candidateStrategy
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      scenario.model.hostEnrichmentStatus = `unavailable: ${error.message}`;
      scenario.model.candidateStatus = candidateStrategy === "mapped"
        ? `mapped hosts unavailable: ${error.message}`
        : `systematic network active; mapped hosts unavailable: ${error.message}`;
    }
  }
  return scenario;
}

// Backward-compatible alias used by older interface code and tests.
export const loadNationalHeatViewport = loadNationalHeatScenario;
