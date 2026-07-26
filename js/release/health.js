const REMOTE_CHECKS = Object.freeze([
  {
    id: "weather",
    label: "Weather API",
    requiredFor: ["heat", "air", "water"],
    url: "https://api.open-meteo.com/v1/forecast?latitude=39.7392&longitude=-104.9903&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=GMT&forecast_days=1"
  },
  {
    id: "air-quality",
    label: "Air-quality model API",
    requiredFor: ["air"],
    url: "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.7392&longitude=-104.9903&current=pm2_5,us_aqi_pm2_5,us_aqi&timezone=GMT"
  },
  {
    id: "census",
    label: "Census social indicators",
    requiredFor: ["heat", "air", "soil", "water"],
    url: "https://api.census.gov/data/2024/acs/acs5?get=NAME,B01003_001E&for=state:08"
  },
  {
    id: "water-observations",
    label: "USGS instantaneous water observations",
    requiredFor: ["water"],
    url: "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=06711565&parameterCd=00060&period=P1D"
  },
  {
    id: "water-network",
    label: "USGS hydrologic network service",
    requiredFor: [],
    url: "https://api.water.usgs.gov/nldi/linked-data?f=json"
  },
  {
    id: "soil-data",
    label: "USDA Soil Data Access",
    requiredFor: ["soil"],
    url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest",
    options: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: "service=query&request=query&query=SELECT%20TOP%201%20mukey%20FROM%20mapunit&format=JSON%2BCOLUMNNAME"
    }
  },
  {
    id: "land-cover",
    label: "National land cover",
    requiredFor: [],
    url: "https://enviroatlas.epa.gov/arcgis/rest/services/Rasters/CONUS_NLCD_10yr_intervals/ImageServer?f=json"
  },
  {
    id: "basemap",
    label: "Vector basemap",
    requiredFor: [],
    url: "https://tiles.openfreemap.org/styles/dark"
  },
  {
    id: "openaq-docs",
    label: "OpenAQ reference-monitor service",
    requiredFor: [],
    url: "https://api.openaq.org/v3/parameters?limit=1"
  }
]);

function result(id, label, status, detail, required = true, elapsedMs = null) {
  return { id, label, status, detail, required, elapsedMs };
}

export function checkLocalCapabilities({ windowObject = globalThis.window, documentObject = globalThis.document, navigatorObject = globalThis.navigator } = {}) {
  const checks = [];
  checks.push(result(
    "online",
    "Network connection",
    navigatorObject?.onLine === false ? "fail" : "pass",
    navigatorObject?.onLine === false ? "Browser reports that it is offline." : "Browser reports an active connection."
  ));

  let storageStatus = "pass";
  let storageDetail = "Browser storage is writable.";
  try {
    const storage = windowObject?.localStorage;
    if (!storage) throw new Error("localStorage unavailable");
    const key = `lumos-health-${Date.now()}`;
    storage.setItem(key, "1");
    storage.removeItem(key);
  } catch (error) {
    storageStatus = "fail";
    storageDetail = `Browser storage is unavailable: ${error.message}`;
  }
  checks.push(result("storage", "Browser storage", storageStatus, storageDetail));

  let canvasStatus = "pass";
  let canvasDetail = "Canvas rendering and export are available.";
  try {
    const canvas = documentObject?.createElement?.("canvas");
    const context = canvas?.getContext?.("2d");
    if (!context || typeof canvas.toDataURL !== "function") throw new Error("2D canvas unavailable");
  } catch (error) {
    canvasStatus = "fail";
    canvasDetail = `Canvas support is unavailable: ${error.message}`;
  }
  checks.push(result("canvas", "Map rendering", canvasStatus, canvasDetail));

  const mapLibreReady = Boolean(windowObject?.maplibregl);
  checks.push(result(
    "maplibre",
    "Interactive map engine",
    mapLibreReady ? "pass" : "warn",
    mapLibreReady ? "MapLibre loaded successfully." : "MapLibre has not loaded; LUMOS can retain a canvas-only fallback.",
    false
  ));

  const secureContext = windowObject?.isSecureContext !== false;
  checks.push(result(
    "secure-context",
    "Location permission context",
    secureContext ? "pass" : "warn",
    secureContext ? "Secure context available for browser-location features." : "Browser location may be unavailable outside HTTPS or localhost.",
    false
  ));
  return checks;
}

async function fetchWithTimeout(definition, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetchImpl(definition.url, {
      headers: { Accept: "application/json", ...(definition.options?.headers ?? {}) },
      method: definition.options?.method ?? "GET",
      body: definition.options?.body,
      cache: "no-store",
      signal: controller.signal
    });
    const elapsedMs = Math.round(performance.now() - started);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType.includes("json")) await response.json();
    else await response.text();
    return { elapsedMs };
  } finally {
    clearTimeout(timeout);
  }
}

function checkDefinitionForDomain(definition, domainKey) {
  return {
    ...definition,
    required: domainKey === "core" ? definition.requiredFor.length > 0 : definition.requiredFor.includes(domainKey)
  };
}

export async function runReleaseHealthCheck({
  fetchImpl = globalThis.fetch,
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  navigatorObject = globalThis.navigator,
  timeoutMs = 7000,
  includeRemote = true,
  domainKey = "heat",
  onUpdate = () => {}
} = {}) {
  const checks = checkLocalCapabilities({ windowObject, documentObject, navigatorObject });
  for (const check of checks) onUpdate(check, checks.slice());
  if (!includeRemote || typeof fetchImpl !== "function") return summarizeHealthChecks(checks);

  for (const rawDefinition of REMOTE_CHECKS) {
    const definition = checkDefinitionForDomain(rawDefinition, domainKey);
    let check;
    try {
      const { elapsedMs } = await fetchWithTimeout(definition, { fetchImpl, timeoutMs });
      check = result(definition.id, definition.label, "pass", `Available in ${elapsedMs} ms.`, definition.required, elapsedMs);
    } catch (error) {
      const status = definition.required ? "fail" : "warn";
      check = result(
        definition.id,
        definition.label,
        status,
        `${definition.required ? "Required source unavailable" : "Optional source unavailable"}: ${error.name === "AbortError" ? "timed out" : error.message}`,
        definition.required
      );
    }
    checks.push(check);
    onUpdate(check, checks.slice());
  }
  return summarizeHealthChecks(checks);
}

export function summarizeHealthChecks(checks) {
  const counts = checks.reduce((summary, check) => {
    summary[check.status] = (summary[check.status] ?? 0) + 1;
    return summary;
  }, { pass: 0, warn: 0, fail: 0 });
  const ready = !checks.some((check) => check.required && check.status === "fail");
  return { checks, counts, ready };
}

export const RELEASE_REMOTE_CHECKS = REMOTE_CHECKS;
