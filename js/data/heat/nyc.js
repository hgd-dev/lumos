const NYC_BOUNDS = {
  minLat: 40.4774,
  maxLat: 40.9176,
  minLng: -74.2591,
  maxLng: -73.7002
};

export const NYC_HEAT_ENDPOINTS = {
  ntaBoundaries: "https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=5000",
  heatForecast: "https://data.cityofnewyork.us/resource/95zn-7w5f.json?$limit=5000",
  heatForecastExport: "https://data.cityofnewyork.us/api/views/95zn-7w5f/rows.json?accessType=DOWNLOAD",
  hvi: "https://data.cityofnewyork.us/resource/4mhf-duep.json?$limit=5000",
  zctaBoundaries: "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/tigerWMS_Census2020/MapServer/84/query?where=1%3D1&geometry=-74.30%2C40.45%2C-73.65%2C40.95&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=ZCTA5%2CGEOID%2CPOP100%2CAREALAND%2CCENTLAT%2CCENTLON&returnGeometry=true&outSR=4326&f=geojson",
  hyperlocalSensors: "https://data.cityofnewyork.us/resource/qdq3-9eqn.json?$select=sensor_id%2Clatitude%2Clongitude%2Cntacode%2Cavg(airtemp)%20as%20mean_temp%2Cmax(airtemp)%20as%20max_temp%2Ccount(*)%20as%20readings&$where=airtemp%20is%20not%20null%20and%20hour%20between%2014%20and%2017&$group=sensor_id%2Clatitude%2Clongitude%2Cntacode&$limit=5000",
  landCoverBlockGroups: "https://services.arcgis.com/hO5ZdGshYvEANBop/ArcGIS/rest/services/Census_Block_Groups_Land_Cover_and_Tree_Canopy_Analysis/FeatureServer/0/query",
  coolingSites: "https://data.cityofnewyork.us/resource/h2bn-gu9k.json?$where=y%20is%20not%20null%20and%20x%20is%20not%20null&$limit=5000",
  libraries: "https://data.cityofnewyork.us/resource/p4pf-fyc4.geojson?$limit=1000",
  schools: "https://data.cityofnewyork.us/resource/kiyv-ks3f.json?$select=loccode%2Clocname%2Cborough%2Clatitude%2Clongitude&$where=latitude%20is%20not%20null%20and%20longitude%20is%20not%20null&$limit=5000"
};

const DATASET_SOURCES = [
  {
    id: "95zn-7w5f",
    label: "NYC Outdoor Heat Resiliency Exposure Forecast",
    agency: "NYC Office of Management and Budget",
    role: "Observed neighborhood baseline and modeled 2050 control/planned-action temperatures"
  },
  {
    id: "qdq3-9eqn",
    label: "Hyperlocal Temperature Monitoring",
    agency: "NYC Department of Health and Mental Hygiene",
    role: "Existing street-level temperature sensor locations from 2018-2019"
  },
  {
    id: "4mhf-duep",
    label: "Heat Vulnerability Index Rankings",
    agency: "NYC Department of Health and Mental Hygiene",
    role: "Social heat vulnerability quintiles by ZCTA"
  },
  {
    id: "9nt8-h7nd",
    label: "2020 Neighborhood Tabulation Areas",
    agency: "NYC Department of City Planning",
    role: "Neighborhood geometry"
  },
  {
    id: "Census2020-ZCTA",
    label: "2020 Census ZIP Code Tabulation Areas",
    agency: "U.S. Census Bureau TIGERweb",
    role: "Population and ZCTA geometry"
  },
  {
    id: "USFS-ArborDay-BlockGroups",
    label: "Census Block Groups Land Cover and Tree Canopy Analysis",
    agency: "U.S. Forest Service / Arbor Day Foundation",
    role: "Recent block-group tree canopy and impervious-surface covariates"
  },
  {
    id: "h2bn-gu9k / p4pf-fyc4 / kiyv-ks3f",
    label: "Cooling sites, libraries, and schools",
    agency: "NYC Open Data",
    role: "Publicly accessible candidate-host proxies"
  }
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalize(value, minimum, maximum, fallback = 0.5) {
  if (!Number.isFinite(value)) return fallback;
  const span = maximum - minimum;
  return span > 1e-12 ? clamp((value - minimum) / span) : fallback;
}

function percentile(values, fraction) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  const position = clamp(fraction) * (finite.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return finite[lower];
  return finite[lower] + (finite[upper] - finite[lower]) * (position - lower);
}

function featureProperties(feature) {
  return feature?.properties ?? feature?.attributes ?? {};
}

function normalizeAreaCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function coerceGeometry(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeNycGeometry(geometryValue) {
  const geometry = coerceGeometry(geometryValue);
  if (!geometry?.coordinates) return geometry;

  const normalizeCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates)) return coordinates;
    if (coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))) {
      const first = Number(coordinates[0]);
      const second = Number(coordinates[1]);
      const directLooksNyc = first >= NYC_BOUNDS.minLng - 1 && first <= NYC_BOUNDS.maxLng + 1
        && second >= NYC_BOUNDS.minLat - 1 && second <= NYC_BOUNDS.maxLat + 1;
      const swappedLooksNyc = second >= NYC_BOUNDS.minLng - 1 && second <= NYC_BOUNDS.maxLng + 1
        && first >= NYC_BOUNDS.minLat - 1 && first <= NYC_BOUNDS.maxLat + 1;
      return swappedLooksNyc && !directLooksNyc
        ? [second, first, ...coordinates.slice(2)]
        : [first, second, ...coordinates.slice(2)];
    }
    return coordinates.map(normalizeCoordinates);
  };

  const lowerType = String(geometry.type ?? "").toLowerCase();
  const type = lowerType === "polygon"
    ? "Polygon"
    : lowerType === "multipolygon"
      ? "MultiPolygon"
      : geometry.type;
  return { ...geometry, type, coordinates: normalizeCoordinates(geometry.coordinates) };
}

function getProperty(properties, ...keys) {
  for (const key of keys) {
    if (properties[key] !== undefined && properties[key] !== null) return properties[key];
    const found = Object.keys(properties).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (found) return properties[found];
  }
  return undefined;
}

function flattenRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function ringBounds(ring) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const coordinate of ring) {
    minLng = Math.min(minLng, coordinate[0]);
    maxLng = Math.max(maxLng, coordinate[0]);
    minLat = Math.min(minLat, coordinate[1]);
    maxLat = Math.max(maxLat, coordinate[1]);
  }
  return { minLng, minLat, maxLng, maxLat };
}

function geometryBounds(geometry) {
  const rings = flattenRings(geometry);
  if (!rings.length) return null;
  return rings.reduce((accumulator, ring) => {
    const bounds = ringBounds(ring);
    accumulator.minLng = Math.min(accumulator.minLng, bounds.minLng);
    accumulator.minLat = Math.min(accumulator.minLat, bounds.minLat);
    accumulator.maxLng = Math.max(accumulator.maxLng, bounds.maxLng);
    accumulator.maxLat = Math.max(accumulator.maxLat, bounds.maxLat);
    return accumulator;
  }, { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity });
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentLng, currentLat] = ring[current];
    const [previousLng, previousLat] = ring[previous];
    const intersects = ((currentLat > lat) !== (previousLat > lat))
      && (lng < ((previousLng - currentLng) * (lat - currentLat)) / ((previousLat - currentLat) || 1e-12) + currentLng);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng, lat, geometry) {
  for (const polygon of geometryPolygons(geometry)) {
    if (!polygon.length || !pointInRing(lng, lat, polygon[0])) continue;
    const inHole = polygon.slice(1).some((hole) => pointInRing(lng, lat, hole));
    if (!inHole) return true;
  }
  return false;
}

function geometryAreaApprox(geometry) {
  let area = 0;
  for (const polygon of geometryPolygons(geometry)) {
    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      const ring = polygon[ringIndex];
      let ringArea = 0;
      for (let index = 0; index < ring.length; index += 1) {
        const [x1, y1] = ring[index];
        const [x2, y2] = ring[(index + 1) % ring.length];
        ringArea += x1 * y2 - x2 * y1;
      }
      area += (ringIndex === 0 ? 1 : -1) * Math.abs(ringArea / 2);
    }
  }
  return Math.max(0, area);
}

function simplifyRing(ring, maximumPoints = 180) {
  if (ring.length <= maximumPoints) return ring;
  const stride = Math.ceil(ring.length / maximumPoints);
  const simplified = ring.filter((_, index) => index % stride === 0);
  const last = ring[ring.length - 1];
  if (simplified[simplified.length - 1] !== last) simplified.push(last);
  return simplified;
}

function simplifyGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => simplifyRing(ring)) };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => simplifyRing(ring)))
    };
  }
  return geometry;
}

function deriveBounds(features) {
  const bounds = features.reduce((accumulator, feature) => {
    const current = geometryBounds(feature.geometry);
    if (!current) return accumulator;
    accumulator.minLng = Math.min(accumulator.minLng, current.minLng);
    accumulator.minLat = Math.min(accumulator.minLat, current.minLat);
    accumulator.maxLng = Math.max(accumulator.maxLng, current.maxLng);
    accumulator.maxLat = Math.max(accumulator.maxLat, current.maxLat);
    return accumulator;
  }, { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity });

  return Number.isFinite(bounds.minLat) ? bounds : { ...NYC_BOUNDS };
}

function project(lng, lat, bounds) {
  return {
    x: clamp((lng - bounds.minLng) / Math.max(1e-12, bounds.maxLng - bounds.minLng)),
    y: clamp((lat - bounds.minLat) / Math.max(1e-12, bounds.maxLat - bounds.minLat))
  };
}

function prepareAreas(features, idKeys, nameKeys) {
  return features.map((feature) => {
    const properties = featureProperties(feature);
    const geometry = normalizeNycGeometry(
      feature.geometry ?? getProperty(properties, "the_geom", "geometry")
    );
    const rawId = getProperty(properties, ...idKeys);
    return {
      id: normalizeAreaCode(rawId),
      rawId: rawId ?? null,
      name: String(getProperty(properties, ...nameKeys) ?? "Unnamed area"),
      properties,
      geometry,
      bounds: geometryBounds(geometry),
      areaApprox: geometryAreaApprox(geometry)
    };
  }).filter((area) => area.id && area.bounds);
}

function findContainingArea(lng, lat, areas) {
  for (const area of areas) {
    const bounds = area.bounds;
    if (lng < bounds.minLng || lng > bounds.maxLng || lat < bounds.minLat || lat > bounds.maxLat) continue;
    if (pointInGeometry(lng, lat, area.geometry)) return area;
  }
  return null;
}

function euclideanDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function deterministicSpatialSample(points, targetCount, priority = () => 0) {
  if (points.length <= targetCount) return points;
  const sorted = [...points].sort((left, right) => priority(right) - priority(left) || String(left.id).localeCompare(String(right.id)));
  const selected = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < targetCount && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const point = remaining[index];
      const minimumDistance = selected.reduce((minimum, chosen) => Math.min(minimum, euclideanDistance(point, chosen)), Infinity);
      const score = minimumDistance + priority(point) * 0.08;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function distanceToNearest(point, points) {
  if (!points.length) return 1;
  return points.reduce((minimum, candidate) => Math.min(minimum, euclideanDistance(point, candidate)), Infinity);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createFetcher(fetchImplementation = globalThis.fetch) {
  if (typeof fetchImplementation !== "function") throw new Error("A Fetch API implementation is required.");
  return async function fetchJson(url, {
    timeoutMs = 25000,
    optional = false,
    retries = 1,
    cache = "no-store"
  } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetchImplementation(url, {
          signal: controller?.signal,
          headers: { Accept: "application/json" },
          cache
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < retries) await wait(350 * (attempt + 1));
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    if (optional) return null;
    throw new Error(`Unable to load ${url}: ${lastError?.message ?? "unknown fetch failure"}`);
  };
}

export function normalizeSocrataRowsPayload(payload) {
  if (Array.isArray(payload)) return payload;

  const columns = payload?.meta?.view?.columns;
  const rows = payload?.data;
  if (!Array.isArray(columns) || !Array.isArray(rows)) return [];

  const fields = columns.map((column) => column?.fieldName ?? null);
  return rows.map((values) => {
    const row = {};
    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];
      if (!field || field.startsWith(":")) continue;
      row[field] = values?.[index] ?? null;
    }
    return row;
  });
}

export function normalizeNtaBoundaryPayload(payload) {
  const rawFeatures = Array.isArray(payload?.features) ? payload.features : null;
  if (rawFeatures) {
    return {
      type: "FeatureCollection",
      features: rawFeatures.map((feature) => {
        const properties = { ...(feature?.properties ?? feature?.attributes ?? {}) };
        for (const [key, value] of Object.entries(feature ?? {})) {
          if (["type", "geometry", "properties", "attributes"].includes(key)) continue;
          if (properties[key] === undefined) properties[key] = value;
        }
        const geometry = normalizeNycGeometry(
          feature?.geometry ?? getProperty(properties, "the_geom", "geometry")
        );
        return { type: "Feature", properties, geometry };
      }).filter((feature) => feature.geometry)
    };
  }

  const rows = normalizeSocrataRowsPayload(payload);
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      properties: { ...row },
      geometry: normalizeNycGeometry(row?.the_geom ?? row?.geometry)
    })).filter((feature) => feature.geometry)
  };
}

function countCodedNtaFeatures(payload) {
  return (payload?.features ?? []).filter((feature) => {
    const properties = featureProperties(feature);
    return normalizeAreaCode(getProperty(properties, "nta2020", "nta_code", "ntacode"));
  }).length;
}

async function fetchNtaBoundaries(fetchJson) {
  const sources = [
    {
      label: "current NTA GeoJSON route",
      url: NYC_HEAT_ENDPOINTS.ntaBoundaries,
      retries: 2
    },
    {
      label: "current NTA SODA row route",
      url: "https://data.cityofnewyork.us/resource/9nt8-h7nd.json?$limit=5000",
      retries: 2
    },
    {
      label: "legacy mapped NTA GeoJSON route",
      url: "https://data.cityofnewyork.us/resource/4hft-v355.geojson?$limit=5000",
      retries: 1
    }
  ];
  const failures = [];

  for (const source of sources) {
    try {
      const raw = await fetchJson(source.url, { retries: source.retries, timeoutMs: 30000 });
      const payload = normalizeNtaBoundaryPayload(raw);
      const codedFeatures = countCodedNtaFeatures(payload);
      if (!codedFeatures) throw new Error("response contained no NTA-coded geometry features");
      return { payload, source: source.label, codedFeatures };
    } catch (error) {
      failures.push(`${source.label}: ${error.message}`);
    }
  }

  throw new Error(`All official NTA boundary routes failed validation. ${failures.join(" | ")}`);
}

async function fetchFirstJson(fetchJson, sources, options = {}) {
  const failures = [];
  for (const source of sources) {
    try {
      return {
        payload: await fetchJson(source.url, { ...options, retries: source.retries ?? options.retries }),
        source: source.label
      };
    } catch (error) {
      failures.push(`${source.label}: ${error.message}`);
    }
  }
  throw new Error(`All official source routes failed. ${failures.join(" | ")}`);
}

async function fetchArcGisFeaturePages(fetchJson, baseUrl, { pageSize = 2000, maximumPages = 5 } = {}) {
  const features = [];
  for (let page = 0; page < maximumPages; page += 1) {
    const url = new URL(baseUrl);
    const parameters = {
      where: "1=1",
      geometry: "-74.30,40.45,-73.65,40.95",
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "GEOID,NAME,To_IA_Pct,To_TC_Pct,UTC_Pct_y2,To_Veg_Pct,NAIP_y2",
      returnGeometry: "true",
      outSR: "4326",
      f: "geojson",
      resultRecordCount: String(pageSize),
      resultOffset: String(page * pageSize)
    };
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    const payload = await fetchJson(url.toString(), { optional: true, timeoutMs: 35000 });
    const pageFeatures = payload?.features ?? [];
    features.push(...pageFeatures);
    if (pageFeatures.length < pageSize) break;
  }
  return { type: "FeatureCollection", features };
}

function parseHeatForecast(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const code = normalizeAreaCode(row.nta_code ?? row.nta2020 ?? row.ntacode);
    if (!code) continue;
    const baseline = finiteNumber(row.baseline);
    const control = finiteNumber(row.control_scenario_temperature, baseline);
    const planned = finiteNumber(row.planned_action_temperature ?? row.planned_action_scenario_temperature, control);
    const change = finiteNumber(
      row.percent_managed_by_action
        ?? row.percent_change_from_control_scenario
        ?? row.planned_action_percent_change
        ?? row.change_from_control_scenario,
      control && planned ? ((planned - control) / control) * 100 : 0
    );
    map.set(code, {
      code,
      name: row.nta_name ?? row.ntaname ?? code,
      baseline,
      control,
      planned,
      change
    });
  }
  return map;
}

function parseHvi(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const code = normalizeAreaCode(row.zcta20 ?? row.zcta5 ?? row.geoid);
    const value = finiteNumber(row.hvi);
    if (code && value !== null) map.set(code, value);
  }
  return map;
}

function parseObservations(rows, bounds) {
  const parsed = [];
  for (const row of rows ?? []) {
    const lat = finiteNumber(row.latitude);
    const lng = finiteNumber(row.longitude);
    if (lat === null || lng === null) continue;
    if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng) continue;
    const projected = project(lng, lat, bounds);
    const readings = finiteNumber(row.readings, 1);
    const meanTemp = finiteNumber(row.mean_temp);
    const maxTemp = finiteNumber(row.max_temp, meanTemp);
    parsed.push({
      id: `nyc-temp-${row.sensor_id ?? parsed.length + 1}`,
      sensorId: String(row.sensor_id ?? parsed.length + 1),
      lat,
      lng,
      ...projected,
      ntacode: row.ntacode ?? null,
      observedValue: meanTemp ?? maxTemp,
      meanTemp,
      maxTemp,
      readings,
      existing: true,
      sensorNoise: clamp(0.075 / Math.sqrt(Math.max(1, readings / 100)), 0.015, 0.075),
      reliability: clamp(0.82 + Math.log10(Math.max(10, readings)) * 0.035, 0.82, 0.96),
      feasibility: 1
    });
  }
  return deterministicSpatialSample(parsed, 42, (point) => normalize(point.readings, 1, 10000));
}

function parsePointFeature(feature, type, index, bounds) {
  if (!feature?.geometry || feature.geometry.type !== "Point") return null;
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const properties = featureProperties(feature);
  return {
    id: `${type}-${getProperty(properties, "uid", "loccode", "objectid", "name") ?? index}`,
    name: String(getProperty(properties, "name", "facname", "locname", "park_name") ?? `${type} site`),
    type,
    lat,
    lng,
    ...project(lng, lat, bounds)
  };
}

function parseCandidateRows(payloads, bounds) {
  const raw = [];

  for (const [index, row] of (payloads.coolingSites ?? []).entries()) {
    const lat = finiteNumber(row.latitude ?? row.lat ?? row.y);
    const lng = finiteNumber(row.longitude ?? row.lon ?? row.lng ?? row.x);
    if (lat === null || lng === null) continue;
    raw.push({
      id: `cooling-${row.objectid ?? row.gispropnum ?? index}`,
      name: String(row.name ?? row.site_name ?? row.location ?? row.park_name ?? row.propertyname ?? "Cooling amenity"),
      type: "Cooling amenity",
      lat,
      lng,
      ...project(lng, lat, bounds)
    });
  }

  for (const [index, feature] of (payloads.libraries?.features ?? []).entries()) {
    const parsed = parsePointFeature(feature, "Library", index, bounds);
    if (parsed) raw.push(parsed);
  }

  for (const [index, row] of (payloads.schools ?? []).entries()) {
    const lat = finiteNumber(row.latitude);
    const lng = finiteNumber(row.longitude);
    if (lat === null || lng === null) continue;
    raw.push({
      id: `school-${row.loccode ?? index}`,
      name: String(row.locname ?? "Public school"),
      type: "School",
      lat,
      lng,
      ...project(lng, lat, bounds)
    });
  }

  const deduplicated = [];
  const seen = new Set();
  for (const site of raw) {
    const key = `${site.lat.toFixed(4)}:${site.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const typeSettings = site.type === "Library"
      ? { cost: 0.68, reliability: 0.93 }
      : site.type === "School"
        ? { cost: 0.82, reliability: 0.90 }
        : { cost: 0.58, reliability: 0.88 };
    deduplicated.push({
      ...site,
      ...typeSettings,
      feasibility: 0.96,
      feasible: true,
      hostType: site.type,
      sensorNoise: 0.025
    });
  }

  return deterministicSpatialSample(deduplicated, 156, (site) => {
    if (site.type === "Cooling amenity") return 1;
    if (site.type === "Library") return 0.75;
    return 0.55;
  });
}

function createFallbackCandidateGrid(cells, bounds) {
  const candidates = [];
  const stride = Math.max(1, Math.floor(cells.length / 160));
  for (let index = 0; index < cells.length; index += stride) {
    const cell = cells[index];
    candidates.push({
      id: `fallback-public-${index}`,
      name: "Generated feasible public-site proxy",
      type: "Generated fallback",
      lat: cell.lat,
      lng: cell.lng,
      x: cell.x,
      y: cell.y,
      cost: 0.75,
      reliability: 0.84,
      feasibility: 0.82,
      feasible: true,
      hostType: "Generated fallback",
      sensorNoise: 0.035,
      localRisk: cell.risk,
      localUncertainty: cell.uncertainty,
      landClass: cell.landClass,
      builtForm: cell.builtForm
    });
  }
  return deterministicSpatialSample(candidates, 130);
}

function mapGeometryToNormalized(geometry, bounds) {
  if (!geometry) return null;
  const convertRing = (ring) => ring.map(([lng, lat]) => {
    const point = project(lng, lat, bounds);
    return [point.x, point.y];
  });
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: geometry.coordinates.map(convertRing) };
  }
  if (geometry.type === "MultiPolygon") {
    return { type: "MultiPolygon", coordinates: geometry.coordinates.map((polygon) => polygon.map(convertRing)) };
  }
  return null;
}

function populateLocalCandidateFields(candidates, cells) {
  return candidates.map((candidate) => {
    const nearest = cells.reduce((best, cell) => {
      const distance = euclideanDistance(candidate, cell);
      return distance < best.distance ? { cell, distance } : best;
    }, { cell: cells[0], distance: Infinity }).cell;
    return {
      ...candidate,
      localRisk: nearest?.risk ?? 0.5,
      localUncertainty: nearest?.uncertainty ?? 0.5,
      landClass: nearest?.landClass ?? 0.5,
      builtForm: nearest?.builtForm ?? 0.5
    };
  });
}

function populateObservationFields(observations, cells) {
  return observations.map((observation) => {
    const nearest = cells.reduce((best, cell) => {
      const distance = euclideanDistance(observation, cell);
      return distance < best.distance ? { cell, distance } : best;
    }, { cell: cells[0], distance: Infinity }).cell;
    return {
      ...observation,
      baselineTemperatureF: nearest?.baselineTemperatureF ?? observation.meanTemp ?? observation.maxTemp ?? 86,
      priorMeanTemperatureF: nearest?.baselineTemperatureF ?? 86,
      uncertainty: nearest?.uncertainty ?? 0.5,
      exposure: nearest?.exposure ?? 0.5,
      vulnerability: nearest?.vulnerability ?? 0.5,
      hvi: nearest?.hvi ?? null,
      communityGroup: nearest?.communityGroup ?? 0,
      treeCanopy: nearest?.treeCanopy ?? 0.24,
      impervious: nearest?.impervious ?? nearest?.builtForm ?? 0.6,
      builtForm: nearest?.builtForm ?? 0.6,
      landClass: nearest?.landClass ?? 0.5
    };
  });
}

export function buildNycHeatScenario(payloads, seed = 20260722) {
  const ntaFeatures = payloads.ntaBoundaries?.features ?? [];
  if (!ntaFeatures.length) throw new Error("NYC NTA boundary data were empty.");

  const bounds = deriveBounds(ntaFeatures);
  const heatByNta = parseHeatForecast(payloads.heatForecast ?? []);
  if (!heatByNta.size) throw new Error("NYC heat forecast data were empty.");

  const ntaAreas = prepareAreas(ntaFeatures, ["nta2020", "nta_code", "ntacode"], ["ntaname", "nta_name"]);
  const zctaFeatures = payloads.zctaBoundaries?.features ?? [];
  const zctaAreas = prepareAreas(zctaFeatures, ["zcta5", "geoid", "zcta20"], ["name", "basename", "zcta5"]);
  const hviByZcta = parseHvi(payloads.hvi ?? []);
  const landCoverAreas = prepareAreas(payloads.landCoverBlockGroups?.features ?? [], ["geoid"], ["name"]);
  const observations = parseObservations(payloads.hyperlocalSensors ?? [], bounds);

  const heatValues = [...heatByNta.values()];
  const baselineValues = heatValues.map((entry) => entry.baseline).filter(Number.isFinite);
  const controlValues = heatValues.map((entry) => entry.control).filter(Number.isFinite);
  const plannedValues = heatValues.map((entry) => entry.planned).filter(Number.isFinite);
  const coolingValues = heatValues.map((entry) => Math.max(0, (entry.control ?? 0) - (entry.planned ?? entry.control ?? 0)));
  const sharedTemperatureValues = [...baselineValues, ...controlValues, ...plannedValues];
  const temperatureLow = percentile(sharedTemperatureValues, 0.03);
  const temperatureHigh = percentile(sharedTemperatureValues, 0.97);
  const coolingHigh = Math.max(0.01, percentile(coolingValues, 0.97));

  const populationDensityValues = zctaAreas.map((area) => {
    const population = finiteNumber(getProperty(area.properties, "pop100"), 0);
    const landArea = finiteNumber(getProperty(area.properties, "arealand"), 0);
    return landArea > 0 ? population / landArea : 0;
  });
  const populationLow = percentile(populationDensityValues, 0.03);
  const populationHigh = percentile(populationDensityValues, 0.97);

  const matchedNtaAreas = ntaAreas.filter((area) => heatByNta.has(area.id));
  if (!matchedNtaAreas.length) {
    const boundaryCodes = ntaAreas.slice(0, 8).map((area) => area.id).join(", ");
    const heatCodes = [...heatByNta.keys()].slice(0, 8).join(", ");
    throw new Error(
      `NYC NTA geometry and heat rows could not be joined. Boundary codes: [${boundaryCodes}] Heat codes: [${heatCodes}]`
    );
  }

  const longitudeSpan = bounds.maxLng - bounds.minLng;
  const latitudeSpan = bounds.maxLat - bounds.minLat;
  const columns = 48;
  const rows = Math.max(34, Math.round(columns * latitudeSpan / Math.max(1e-9, longitudeSpan) * 1.18));
  const cells = [];
  const representedNtas = new Set();

  const appendEvaluationCell = (lng, lat, row, column, ntaOverride = null) => {
    const nta = ntaOverride ?? findContainingArea(lng, lat, matchedNtaAreas);
    if (!nta) return false;
    const heat = heatByNta.get(nta.id);
    if (!heat || !Number.isFinite(heat.baseline)) return false;
    const projected = project(lng, lat, bounds);
    const x = projected.x;
    const y = projected.y;
    const zcta = findContainingArea(lng, lat, zctaAreas);
    const hvi = zcta ? hviByZcta.get(zcta.id) : null;
    const landCover = findContainingArea(lng, lat, landCoverAreas);
    const landCoverProperties = landCover?.properties ?? {};
    const canopyPercent = finiteNumber(getProperty(landCoverProperties, "utc_pct_y2", "to_tc_pct"));
    const imperviousPercent = finiteNumber(getProperty(landCoverProperties, "to_ia_pct", "ia_pct"));
    const vegetationPercent = finiteNumber(getProperty(landCoverProperties, "to_veg_pct"));
    const treeCanopy = canopyPercent === null ? null : clamp(canopyPercent / 100);
    const impervious = imperviousPercent === null ? null : clamp(imperviousPercent / 100);
    const vegetation = vegetationPercent === null ? null : clamp(vegetationPercent / 100);
    const population = zcta ? finiteNumber(getProperty(zcta.properties, "pop100"), 0) : 0;
    const landArea = zcta ? finiteNumber(getProperty(zcta.properties, "arealand"), 0) : 0;
    const populationDensity = landArea > 0 ? population / landArea : 0;
    const exposure = normalize(populationDensity, populationLow, populationHigh, 0.35);
    const vulnerability = hvi ? clamp((hvi - 1) / 4) : clamp(0.25 + exposure * 0.45);
    const riskBaseline = normalize(heat.baseline, temperatureLow, temperatureHigh);
    const futureRisk = normalize(heat.control, temperatureLow, temperatureHigh, riskBaseline);
    const plannedRisk = normalize(heat.planned, temperatureLow, temperatureHigh, futureRisk);
    const interventionBenefit = normalize(Math.max(0, (heat.control ?? 0) - (heat.planned ?? heat.control ?? 0)), 0, coolingHigh, 0);
    const builtForm = impervious ?? clamp(0.18 + futureRisk * 0.56 + exposure * 0.26);
    const ecology = treeCanopy !== null
      ? clamp(0.72 * treeCanopy + 0.28 * (vegetation ?? treeCanopy))
      : clamp(0.18 + interventionBenefit * 0.72 + (1 - builtForm) * 0.1);
    const communityPriority = clamp(0.12 + 0.45 * vulnerability + 0.28 * exposure + 0.15 * riskBaseline);
    cells.push({
      id: `nyc-cell-${row}-${column}-${cells.length}`,
      x,
      y,
      lat,
      lng,
      ntaCode: nta.id,
      ntaName: nta.name,
      zcta: zcta?.id ?? null,
      hvi: hvi ?? null,
      communityGroup: hvi ? Math.round(hvi) - 1 : Number(getProperty(nta.properties, "borocode") ?? 0),
      risk: riskBaseline,
      riskBaseline,
      futureRisk,
      plannedRisk,
      interventionBenefit,
      baselineTemperatureF: heat.baseline,
      controlTemperatureF: heat.control,
      plannedTemperatureF: heat.planned,
      exposure,
      vulnerability,
      communityPriority,
      ecology,
      treeCanopy: treeCanopy ?? clamp(ecology * 0.72),
      impervious: impervious ?? builtForm,
      vegetation: vegetation ?? clamp(ecology),
      landCoverYear: getProperty(landCoverProperties, "naip_y2") ?? null,
      builtForm,
      landClass: clamp(1 - ecology),
      populationDensity
    });
    representedNtas.add(nta.id);
    return true;
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = (column + 0.5) / columns;
      const y = (row + 0.5) / rows;
      appendEvaluationCell(
        bounds.minLng + x * longitudeSpan,
        bounds.minLat + y * latitudeSpan,
        row,
        column
      );
    }
  }

  // Guarantee representation for narrow or coastal NTAs that a citywide lattice may miss.
  for (const nta of matchedNtaAreas) {
    if (representedNtas.has(nta.id)) continue;
    let added = false;
    const localResolution = 16;
    for (let localRow = 0; localRow < localResolution && !added; localRow += 1) {
      for (let localColumn = 0; localColumn < localResolution; localColumn += 1) {
        const lng = nta.bounds.minLng + ((localColumn + 0.5) / localResolution) * (nta.bounds.maxLng - nta.bounds.minLng);
        const lat = nta.bounds.minLat + ((localRow + 0.5) / localResolution) * (nta.bounds.maxLat - nta.bounds.minLat);
        if (!pointInGeometry(lng, lat, nta.geometry)) continue;
        added = appendEvaluationCell(lng, lat, `nta-${nta.id}-${localRow}`, localColumn, nta);
        if (added) break;
      }
    }
  }

  if (!cells.length) {
    throw new Error(
      `No fine-grid evaluation points could be generated inside NYC after joining ${matchedNtaAreas.length} NTA polygons to ${heatByNta.size} heat rows.`
    );
  }

  const maximumNearestDistance = Math.max(0.02, percentile(cells.map((cell) => distanceToNearest(cell, observations)), 0.95));
  for (const cell of cells) {
    const nearestDistance = distanceToNearest(cell, observations);
    const coverageGap = normalize(nearestDistance, 0, maximumNearestDistance, 0.6);
    cell.uncertainty = clamp(0.18 + 0.58 * coverageGap + 0.16 * Math.abs(cell.futureRisk - cell.riskBaseline) + 0.08 * cell.vulnerability);
  }

  const enrichedObservations = populateObservationFields(observations, cells);

  let candidates = parseCandidateRows(payloads, bounds);
  if (!candidates.length) candidates = createFallbackCandidateGrid(cells, bounds);
  candidates = populateLocalCandidateFields(candidates, cells);

  const normalizedBoundaries = ntaAreas.map((area) => {
    const simplifiedGeometry = simplifyGeometry(area.geometry);
    return {
      id: area.id,
      name: area.name,
      geometry: mapGeometryToNormalized(simplifiedGeometry, bounds),
      geoGeometry: simplifiedGeometry,
      baselineTemperatureF: heatByNta.get(area.id)?.baseline ?? null,
      controlTemperatureF: heatByNta.get(area.id)?.control ?? null,
      plannedTemperatureF: heatByNta.get(area.id)?.planned ?? null
    };
  });

  const center = {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2
  };

  return {
    seed,
    domainKey: "heat",
    scenarioType: "live-city",
    cityKey: "nyc",
    cityLabel: "New York City",
    center,
    geoBounds: bounds,
    bounds: [
      [bounds.minLat, bounds.minLng],
      [bounds.maxLat, bounds.maxLng]
    ],
    model: {
      transportAngle: 0,
      heatScenario: "baseline",
      dataResolution: "Adaptive fine grid from NTA/ZCTA source surfaces"
    },
    cells,
    candidates,
    observations: enrichedObservations,
    boundaries: normalizedBoundaries,
    sourceMetadata: {
      live: true,
      retrievedAt: new Date().toISOString(),
      sources: DATASET_SOURCES,
      limitations: [
        "Neighborhood temperature values are source-model surfaces, not independent measurements at every fine-grid point.",
        "The heat observation network is spatially thinned for browser-scale Gaussian-process conditioning and uses aggregated afternoon readings.",
        "Tree-canopy and impervious-surface covariates are summarized at Census block-group scale; they do not reproduce the source imagery pixel by pixel.",
        "Schools, libraries, and cooling amenities are public-site proxies; actual monitor installation requires permission, power, safety, and field verification.",
        "Posterior inference combines the official neighborhood baseline with aggregated sensor readings; differences in sampling windows and years remain a source of model error."
      ]
    }
  };
}

export async function loadNycHeatScenario({
  seed = 20260722,
  fetchImplementation = globalThis.fetch,
  onProgress = () => {}
} = {}) {
  const fetchJson = createFetcher(fetchImplementation);
  onProgress("Loading official neighborhood heat and boundary data...");
  const [ntaBoundaryResult, heatForecastResult] = await Promise.all([
    fetchNtaBoundaries(fetchJson),
    fetchFirstJson(fetchJson, [
      {
        label: "Socrata SODA resource route",
        url: NYC_HEAT_ENDPOINTS.heatForecast,
        retries: 2
      },
      {
        label: "NYC Open Data export route",
        url: NYC_HEAT_ENDPOINTS.heatForecastExport,
        retries: 1
      }
    ], { timeoutMs: 30000 })
  ]);
  const ntaBoundaries = ntaBoundaryResult.payload;
  const heatForecast = normalizeSocrataRowsPayload(heatForecastResult.payload);
  onProgress(`Loaded ${ntaBoundaryResult.codedFeatures} NTA boundaries through ${ntaBoundaryResult.source}.`);
  onProgress(`Loaded official heat forecast through ${heatForecastResult.source}.`);

  onProgress("Loading social vulnerability, population, sensors, and candidate hosts...");
  const [hvi, zctaBoundaries, hyperlocalSensors, landCoverBlockGroups, coolingSites, libraries, schools] = await Promise.all([
    fetchJson(NYC_HEAT_ENDPOINTS.hvi, { optional: true }),
    fetchJson(NYC_HEAT_ENDPOINTS.zctaBoundaries, { optional: true }),
    fetchJson(NYC_HEAT_ENDPOINTS.hyperlocalSensors, { optional: true }),
    fetchArcGisFeaturePages(fetchJson, NYC_HEAT_ENDPOINTS.landCoverBlockGroups),
    fetchJson(NYC_HEAT_ENDPOINTS.coolingSites, { optional: true }),
    fetchJson(NYC_HEAT_ENDPOINTS.libraries, { optional: true }),
    fetchJson(NYC_HEAT_ENDPOINTS.schools, { optional: true })
  ]);

  onProgress("Constructing the adaptive evaluation field...");
  return buildNycHeatScenario({
    ntaBoundaries,
    heatForecast,
    hvi,
    zctaBoundaries,
    hyperlocalSensors,
    landCoverBlockGroups,
    coolingSites,
    libraries,
    schools
  }, seed);
}

export function applyHeatScenario(scenario, heatScenario = "baseline") {
  if (!scenario?.cells) return scenario;
  const field = heatScenario === "control"
    ? "futureRisk"
    : heatScenario === "planned"
      ? "plannedRisk"
      : "riskBaseline";
  scenario.model = { ...scenario.model, heatScenario };
  scenario.cells = scenario.cells.map((cell) => ({ ...cell, risk: cell[field] ?? cell.risk }));
  return scenario;
}
