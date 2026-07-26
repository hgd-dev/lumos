const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const CACHE_KEY = "lumos-location-search-v1";
const MIN_REQUEST_INTERVAL_MS = 1100;
let lastRequestAt = 0;

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseCoordinateQuery(query) {
  const match = String(query ?? "").trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = finiteCoordinate(match[1]);
  const lng = finiteCoordinate(match[2]);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    id: `coordinate-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    detail: "Entered coordinates",
    lat,
    lng,
    type: "coordinate",
    boundingBox: null
  };
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable in privacy modes; search still works without caching.
  }
}

function normalizeResult(row) {
  const lat = finiteCoordinate(row.lat);
  const lng = finiteCoordinate(row.lon);
  if (lat === null || lng === null) return null;
  const box = Array.isArray(row.boundingbox) && row.boundingbox.length === 4
    ? row.boundingbox.map(finiteCoordinate)
    : null;
  return {
    id: String(row.place_id ?? `${lat}:${lng}`),
    label: String(row.name ?? row.display_name?.split(",")[0] ?? "Location"),
    detail: String(row.display_name ?? "United States location"),
    lat,
    lng,
    type: String(row.type ?? row.addresstype ?? "location"),
    boundingBox: box?.every(Number.isFinite) ? {
      south: box[0],
      north: box[1],
      west: box[2],
      east: box[3]
    } : null
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function searchUnitedStatesLocations(query) {
  const cleaned = String(query ?? "").trim();
  if (!cleaned) return [];

  const coordinates = parseCoordinateQuery(cleaned);
  if (coordinates) return [coordinates];

  const key = cleaned.toLowerCase();
  const cache = loadCache();
  if (Array.isArray(cache[key])) return cache[key];

  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) await delay(MIN_REQUEST_INTERVAL_MS - elapsed);
  lastRequestAt = Date.now();

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", cleaned);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
    cache: "default"
  });
  if (!response.ok) throw new Error(`Location search returned HTTP ${response.status}.`);
  const rows = await response.json();
  const results = rows.map(normalizeResult).filter(Boolean);
  cache[key] = results;
  saveCache(cache);
  return results;
}
