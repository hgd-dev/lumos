import { CACHE_DURATIONS, getCachedJson, putCachedJson } from "../../storage/cache.js";

const NLCD_SAMPLE_URL = "https://enviroatlas.epa.gov/arcgis/rest/services/Rasters/CONUS_NLCD_10yr_intervals/ImageServer/getSamples";
const SAMPLE_BATCH_SIZE = 60;
const RASTER_FUNCTIONS = ["NLCD-all-classes-2025", "NLCD-all-classes-2024", "None"];

const CLASS_PROFILES = {
  11: { label: "Open water", impervious: 0.00, treeCanopy: 0.00, vegetation: 0.00, water: 1.00, developed: 0.00 },
  12: { label: "Perennial ice or snow", impervious: 0.00, treeCanopy: 0.00, vegetation: 0.00, water: 0.55, developed: 0.00 },
  21: { label: "Developed open space", impervious: 0.20, treeCanopy: 0.24, vegetation: 0.48, water: 0.00, developed: 0.30 },
  22: { label: "Developed low intensity", impervious: 0.43, treeCanopy: 0.16, vegetation: 0.28, water: 0.00, developed: 0.52 },
  23: { label: "Developed medium intensity", impervious: 0.68, treeCanopy: 0.08, vegetation: 0.14, water: 0.00, developed: 0.76 },
  24: { label: "Developed high intensity", impervious: 0.90, treeCanopy: 0.03, vegetation: 0.05, water: 0.00, developed: 0.96 },
  31: { label: "Barren land", impervious: 0.34, treeCanopy: 0.01, vegetation: 0.05, water: 0.00, developed: 0.18 },
  41: { label: "Deciduous forest", impervious: 0.01, treeCanopy: 0.88, vegetation: 0.96, water: 0.00, developed: 0.00 },
  42: { label: "Evergreen forest", impervious: 0.01, treeCanopy: 0.92, vegetation: 0.97, water: 0.00, developed: 0.00 },
  43: { label: "Mixed forest", impervious: 0.01, treeCanopy: 0.90, vegetation: 0.97, water: 0.00, developed: 0.00 },
  52: { label: "Shrub or scrub", impervious: 0.01, treeCanopy: 0.30, vegetation: 0.80, water: 0.00, developed: 0.00 },
  71: { label: "Grassland or herbaceous", impervious: 0.01, treeCanopy: 0.05, vegetation: 0.72, water: 0.00, developed: 0.00 },
  81: { label: "Pasture or hay", impervious: 0.02, treeCanopy: 0.05, vegetation: 0.77, water: 0.00, developed: 0.00 },
  82: { label: "Cultivated crops", impervious: 0.03, treeCanopy: 0.02, vegetation: 0.63, water: 0.00, developed: 0.00 },
  90: { label: "Woody wetlands", impervious: 0.00, treeCanopy: 0.68, vegetation: 0.92, water: 0.75, developed: 0.00 },
  95: { label: "Emergent herbaceous wetlands", impervious: 0.00, treeCanopy: 0.03, vegetation: 0.86, water: 0.85, developed: 0.00 }
};

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > -1e8 ? number : null;
}

function parsePixelValue(value) {
  if (Array.isArray(value)) return finite(value[0]);
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? finite(match[0]) : null;
  }
  return finite(value);
}

export function deriveNlcdCovariates(classValue) {
  const code = Math.round(Number(classValue));
  const profile = CLASS_PROFILES[code] ?? {
    label: "Unclassified land cover",
    impervious: 0.25,
    treeCanopy: 0.25,
    vegetation: 0.40,
    water: 0.00,
    developed: 0.25
  };
  return {
    landCoverCode: Number.isFinite(code) ? code : null,
    landCoverLabel: profile.label,
    impervious: profile.impervious,
    treeCanopy: profile.treeCanopy,
    vegetation: profile.vegetation,
    waterPresence: profile.water,
    developedIntensity: profile.developed,
    landCoverObserved: Object.hasOwn(CLASS_PROFILES, code),
    landCoverConfidence: Object.hasOwn(CLASS_PROFILES, code) ? 0.78 : 0.25
  };
}

export function normalizeNlcdSamples(payload, points, { rasterFunction = null } = {}) {
  const samples = Array.isArray(payload?.samples) ? payload.samples : [];
  if (!samples.length) throw new Error("The national land-cover service returned no samples.");
  return points.map((point, index) => {
    const sample = samples[index] ?? null;
    const value = parsePixelValue(sample?.value ?? sample?.values ?? sample?.attributes?.Value ?? sample?.attributes?.value);
    return {
      id: point.id,
      ...deriveNlcdCovariates(value),
      rasterFunction,
      sampleLatitude: finite(sample?.location?.y),
      sampleLongitude: finite(sample?.location?.x)
    };
  });
}

export function buildNlcdSampleRequest(points, rasterFunction = RASTER_FUNCTIONS[0]) {
  const geometry = {
    points: points.map((point) => [Number(point.lng), Number(point.lat)]),
    spatialReference: { wkid: 4326 }
  };
  const body = new URLSearchParams({
    f: "json",
    geometryType: "esriGeometryMultipoint",
    geometry: JSON.stringify(geometry),
    returnFirstValueOnly: "true",
    outFields: "*"
  });
  if (rasterFunction && rasterFunction !== "None") {
    body.set("renderingRule", JSON.stringify({ rasterFunction }));
  }
  return {
    url: NLCD_SAMPLE_URL,
    options: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: body.toString()
    }
  };
}

async function requestSamples(points, rasterFunction, fetchImpl, signal) {
  const request = buildNlcdSampleRequest(points, rasterFunction);
  const cached = await getCachedJson(request.url, {
    fetchImpl,
    ttlMs: CACHE_DURATIONS.landCover,
    options: request.options,
    label: `Annual NLCD ${rasterFunction}`
  });
  const payload = cached?.value ?? await (async () => {
    const response = await fetchImpl(request.url, { ...request.options, signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json?.error) throw new Error(json.error.message ?? "ArcGIS raster request failed");
    await putCachedJson(request.url, json, {
      fetchImpl,
      options: request.options,
      label: `Annual NLCD ${rasterFunction}`
    });
    return json;
  })();
  return normalizeNlcdSamples(payload, points, { rasterFunction });
}

export async function loadNationalLandCover(points, {
  fetchImpl = globalThis.fetch,
  signal = null,
  onProgress = () => {}
} = {}) {
  if (!Array.isArray(points) || !points.length) return { records: new Map(), status: "no points", rasterFunction: null };
  let lastError = null;
  for (const rasterFunction of RASTER_FUNCTIONS) {
    try {
      const records = [];
      const batchCount = Math.ceil(points.length / SAMPLE_BATCH_SIZE);
      for (let start = 0, batchIndex = 0; start < points.length; start += SAMPLE_BATCH_SIZE, batchIndex += 1) {
        onProgress(`Loading national land cover ${batchIndex + 1} of ${batchCount}...`);
        records.push(...await requestSamples(points.slice(start, start + SAMPLE_BATCH_SIZE), rasterFunction, fetchImpl, signal));
      }
      const observedCount = records.filter((record) => record.landCoverObserved).length;
      if (!observedCount) throw new Error(`${rasterFunction} returned no classified land-cover values for this extent.`);
      return {
        records: new Map(records.map((record) => [record.id, record])),
        status: `loaded through ${rasterFunction} (${observedCount}/${records.length} classified points)`,
        rasterFunction,
        observedCount,
        coverageRate: observedCount / records.length
      };
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
    }
  }
  throw new Error(lastError?.message ?? "National land-cover loading failed");
}

export const NLCD_CLASS_PROFILES = CLASS_PROFILES;
