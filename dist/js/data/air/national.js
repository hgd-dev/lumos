import { loadNationalHeatScenario, estimateNationalHeatWorkload } from "../heat/national.js";
import { DOMAINS } from "../../config/domains.js";
import { attachAirInference, evaluateAirTransportRegimes, runAirValidationExperiment } from "../../model/air/inference.js";

const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const OPENAQ_URL = "https://api.openaq.org/v3/locations";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

export const AIR_POLLUTANTS = {
  pm2_5: { label: "PM2.5", unit: "µg/m³", apiField: "pm2_5", aqiField: "us_aqi_pm2_5", openAqParameterId: 2, molecularWeight: null },
  pm10: { label: "PM10", unit: "µg/m³", apiField: "pm10", aqiField: "us_aqi_pm10", openAqParameterId: 1, molecularWeight: null },
  nitrogen_dioxide: { label: "NO₂", unit: "µg/m³", apiField: "nitrogen_dioxide", aqiField: "us_aqi_nitrogen_dioxide", openAqParameterId: 7, molecularWeight: 46.0055 },
  ozone: { label: "Ozone", unit: "µg/m³", apiField: "ozone", aqiField: "us_aqi_ozone", openAqParameterId: 10, molecularWeight: 47.9982 }
};

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Request aborted", "AbortError"));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

async function fetchJsonWithRetry(url, {
  fetchImpl,
  signal,
  attempts = 2,
  label = "Air-quality service"
}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal, cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
      const payload = await response.json();
      if (payload?.error) throw new Error(payload.reason ?? payload.error.message ?? `${label} returned an error.`);
      return payload;
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
      if (attempt < attempts) await wait(350 * attempt, signal);
    }
  }
  throw lastError ?? new Error(`${label} did not respond.`);
}

export function meteorologicalWindToTransportRadians(degrees) {
  if (!Number.isFinite(degrees)) return 0;
  // Meteorological direction is where wind comes from, clockwise from north.
  // LUMOS uses the downwind axis, counter-clockwise from east.
  return ((270 - degrees) * Math.PI / 180 + Math.PI * 4) % (Math.PI * 2);
}

export function circularMeanTransportRadians(degreesValues) {
  const angles = degreesValues.filter(Number.isFinite).map(meteorologicalWindToTransportRadians);
  if (!angles.length) return 0;
  const x = angles.reduce((sum, angle) => sum + Math.cos(angle), 0);
  const y = angles.reduce((sum, angle) => sum + Math.sin(angle), 0);
  return Math.atan2(y, x);
}

function normalizeRange(values, value) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length || !Number.isFinite(value)) return 0.5;
  const low = usable[Math.floor((usable.length - 1) * 0.05)];
  const high = usable[Math.ceil((usable.length - 1) * 0.95)];
  return clamp((value - low) / Math.max(1e-9, high - low));
}

function geoDistanceSquared(left, right, bounds) {
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180;
  const dx = ((left.lng ?? 0) - (right.lng ?? 0)) * Math.cos(midLat);
  const dy = (left.lat ?? 0) - (right.lat ?? 0);
  return dx * dx + dy * dy;
}

function nearestSourceScore(cell, sources, bounds, scale = 0.04) {
  if (!sources.length) return null;
  let nearest = Infinity;
  for (const source of sources) nearest = Math.min(nearest, geoDistanceSquared(cell, source, bounds));
  return Math.exp(-nearest / Math.max(1e-9, scale * scale));
}

function directionalSourceScore(cell, sources, bounds, transportAngle, alongScale = 0.085, acrossScale = 0.028) {
  if (!sources.length) return null;
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180;
  const cosine = Math.cos(transportAngle);
  const sine = Math.sin(transportAngle);
  let best = 0;
  for (const source of sources) {
    const dx = ((cell.lng ?? 0) - (source.lng ?? 0)) * Math.cos(midLat);
    const dy = (cell.lat ?? 0) - (source.lat ?? 0);
    const parallel = dx * cosine + dy * sine;
    const perpendicular = -dx * sine + dy * cosine;
    const distance = (parallel / alongScale) ** 2 + (perpendicular / acrossScale) ** 2;
    const directionFactor = parallel >= -0.006 ? 1 : 0.16;
    best = Math.max(best, Math.exp(-0.5 * distance) * directionFactor);
  }
  return best;
}

function airCurrentRecord(payload, pollutant) {
  const current = payload?.current ?? {};
  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  return {
    pollutantValue: finite(current[definition.apiField]),
    pollutantAqi: finite(current[definition.aqiField]),
    usAqi: finite(current.us_aqi),
    sampledAt: current.time ?? null
  };
}

async function fetchAirBatch(cells, pollutant, fetchImpl, signal, onProgress) {
  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  const output = [];
  const batchSize = 24;
  for (let start = 0; start < cells.length; start += batchSize) {
    const batch = cells.slice(start, start + batchSize);
    onProgress(`Loading ${definition.label} field ${Math.floor(start / batchSize) + 1} of ${Math.ceil(cells.length / batchSize)}...`);
    const parameters = new URLSearchParams({
      latitude: batch.map((point) => point.lat).join(","),
      longitude: batch.map((point) => point.lng).join(","),
      current: `${definition.apiField},${definition.aqiField},us_aqi`,
      timezone: "auto"
    });
    const payload = await fetchJsonWithRetry(`${AIR_QUALITY_URL}?${parameters}`, {
      fetchImpl,
      signal,
      attempts: 3,
      label: "Open-Meteo Air Quality"
    });
    const records = Array.isArray(payload) ? payload : [payload];
    if (records.length !== batch.length) throw new Error(`Air-quality response returned ${records.length} points for ${batch.length} requested points.`);
    for (let index = 0; index < batch.length; index += 1) output.push(airCurrentRecord(records[index], pollutant));
  }
  return output;
}

function overpassQuery(bounds) {
  return `[out:json][timeout:12];\n(\nway["highway"~"motorway|trunk|primary"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});\nnwr["landuse"="industrial"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});\nnwr["man_made"="works"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});\nnwr["power"="plant"](${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng});\n);\nout center tags 350;`;
}

function normalizeSourceElements(payload) {
  const roads = [];
  const industry = [];
  for (const element of payload?.elements ?? []) {
    const lat = finite(element.lat ?? element.center?.lat);
    const lng = finite(element.lon ?? element.center?.lon);
    if (lat === null || lng === null) continue;
    const tags = element.tags ?? {};
    const record = { lat, lng, tags };
    if (tags.highway) roads.push(record);
    else industry.push(record);
  }
  return { roads, industry };
}

async function fetchSourceFeatures(bounds, fetchImpl, signal, onProgress) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 9000);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  try {
    const body = `data=${encodeURIComponent(overpassQuery(bounds))}`;
    let lastError = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        onProgress("Loading optional major-road and industrial source proxies...");
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
          body,
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return normalizeSourceElements(await response.json());
      } catch (error) {
        if (signal?.aborted) throw error;
        if (timedOut) throw new Error("OpenStreetMap source enrichment timed out; using transparent source proxies.");
        lastError = error;
      }
    }
    throw lastError ?? new Error("No Overpass source endpoint responded.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

function normalizedPosition(lng, lat, bounds) {
  return {
    x: clamp((lng - bounds.minLng) / Math.max(1e-9, bounds.maxLng - bounds.minLng)),
    y: clamp((lat - bounds.minLat) / Math.max(1e-9, bounds.maxLat - bounds.minLat))
  };
}

export function normalizeOpenAqLocations(payload, bounds, pollutant) {
  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  return (payload?.results ?? []).flatMap((location) => {
    const lat = finite(location?.coordinates?.latitude);
    const lng = finite(location?.coordinates?.longitude);
    if (lat === null || lng === null) return [];
    const matchingSensors = (location.sensors ?? []).filter((sensor) => Number(sensor?.parameter?.id) === definition.openAqParameterId);
    if (!matchingSensors.length) return [];
    const position = normalizedPosition(lng, lat, bounds);
    return [{
      id: `openaq-${location.id}`,
      locationId: Number(location.id),
      ...position,
      lat,
      lng,
      reliability: location.isMonitor === false ? 0.82 : 0.98,
      feasibility: 1,
      noiseVariance: location.isMonitor === false ? 0.08 : 0.025,
      monitorType: location.isMonitor === false ? "community" : "reference",
      provider: location.provider?.name ?? location.owner?.name ?? "OpenAQ provider",
      official: location.isMonitor !== false,
      matchingSensors: matchingSensors.map((sensor) => ({
        id: Number(sensor.id),
        units: sensor.parameter?.units ?? sensor.units ?? null,
        name: sensor.parameter?.name ?? sensor.name ?? null
      })).filter((sensor) => Number.isFinite(sensor.id))
    }];
  });
}

function normalizedUnit(unit) {
  return String(unit ?? "").toLowerCase().replaceAll("μ", "u").replaceAll("µ", "u").replaceAll("³", "3").replaceAll(" ", "");
}

export function convertOpenAqValue(value, unit, pollutant) {
  const numeric = finite(value);
  if (numeric === null) return null;
  const normalized = normalizedUnit(unit);
  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  if (!normalized) return null;
  if (/ug\/m3|ugm-?3|microgram/.test(normalized)) return numeric;
  if (/mg\/m3|mgm-?3/.test(normalized)) return numeric * 1000;
  if (definition.molecularWeight && /ppb/.test(normalized)) return numeric * definition.molecularWeight / 24.45;
  if (definition.molecularWeight && /ppm/.test(normalized)) return numeric * definition.molecularWeight * 1000 / 24.45;
  return null;
}

export function normalizeOpenAqLatest(payload, location, pollutant, now = Date.now()) {
  const sensors = new Map((location.matchingSensors ?? []).map((sensor) => [Number(sensor.id), sensor]));
  const candidates = (payload?.results ?? []).flatMap((result) => {
    const sensor = sensors.get(Number(result.sensorsId));
    if (!sensor) return [];
    const observedValue = convertOpenAqValue(result.value, sensor.units, pollutant);
    const timestamp = result.datetime?.utc ?? result.datetime?.local ?? null;
    const timestampMs = timestamp ? Date.parse(timestamp) : NaN;
    const ageHours = Number.isFinite(timestampMs) ? Math.max(0, (now - timestampMs) / 3_600_000) : null;
    if (!Number.isFinite(observedValue) || (Number.isFinite(ageHours) && ageHours > 168)) return [];
    return [{ observedValue, timestamp, ageHours, sensorId: sensor.id, sourceUnit: sensor.units }];
  }).sort((left, right) => (left.ageHours ?? Infinity) - (right.ageHours ?? Infinity));
  if (!candidates.length) return null;
  const latest = candidates[0];
  const ageReliability = Number.isFinite(latest.ageHours) ? Math.exp(-latest.ageHours / 96) : 0.7;
  return {
    ...location,
    ...latest,
    reliability: clamp((location.reliability ?? 0.9) * (0.68 + 0.32 * ageReliability), 0.35, 0.99),
    sensorNoise: location.monitorType === "reference" ? 0.35 : 0.8,
    valueUnit: AIR_POLLUTANTS[pollutant]?.unit ?? "µg/m³"
  };
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function fetchOpenAqLatest(locations, pollutant, apiKey, fetchImpl, signal, onProgress) {
  if (!locations.length) return [];
  const limited = locations.slice(0, 24);
  let completed = 0;
  const records = await mapWithConcurrency(limited, 4, async (location) => {
    if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 5000);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener("abort", forwardAbort, { once: true });
    try {
      const response = await fetchImpl(`${OPENAQ_URL}/${location.locationId}/latest`, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return normalizeOpenAqLatest(await response.json(), location, pollutant);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timedOut || error?.name === "AbortError") return null;
      return null;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
      completed += 1;
      onProgress(`Loading current reference measurements ${completed} of ${limited.length}...`);
    }
  });
  return records.filter(Boolean);
}

async function fetchOpenAqLocations(bounds, pollutant, apiKey, fetchImpl, signal, onProgress) {
  if (!apiKey) return [];
  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  onProgress("Loading optional reference-monitor locations through OpenAQ...");
  const params = new URLSearchParams({
    bbox: `${bounds.minLng.toFixed(4)},${bounds.minLat.toFixed(4)},${bounds.maxLng.toFixed(4)},${bounds.maxLat.toFixed(4)}`,
    parameters_id: String(definition.openAqParameterId),
    iso: "US",
    monitor: "true",
    limit: "100"
  });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  try {
    const response = await fetchImpl(`${OPENAQ_URL}?${params}`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`OpenAQ returned HTTP ${response.status}.`);
    const locations = normalizeOpenAqLocations(await response.json(), bounds, pollutant);
    clearTimeout(timer);
    return await fetchOpenAqLatest(locations, pollutant, apiKey, fetchImpl, signal, onProgress);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new Error("OpenAQ location request timed out.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

function enrichAirObservations(observations, cells) {
  for (const observation of observations) {
    let nearest = cells[0];
    let nearestDistance = Infinity;
    for (const cell of cells) {
      const distance = (observation.x - cell.x) ** 2 + (observation.y - cell.y) ** 2;
      if (distance < nearestDistance) { nearestDistance = distance; nearest = cell; }
    }
    observation.priorPollutantValue = nearest?.pollutantValue ?? observation.observedValue;
    observation.pollutantValue = nearest?.pollutantValue ?? observation.observedValue;
    observation.trafficIntensity = nearest?.trafficIntensity ?? 0.5;
    observation.industrialProximity = nearest?.industrialProximity ?? 0.5;
    observation.sourceRisk = nearest?.sourceRisk ?? 0.5;
    observation.downwindSourceRisk = nearest?.downwindSourceRisk ?? observation.sourceRisk;
    observation.exposure = nearest?.exposure ?? 0.5;
    observation.vulnerability = nearest?.vulnerability ?? 0.5;
    observation.windSpeed = nearest?.windSpeed ?? 0;
    observation.windDirection = nearest?.windDirection ?? 0;
    observation.uncertainty = nearest?.uncertainty ?? 0.5;
  }
  return observations;
}

function applyAirFields(baseScenario, records, pollutant, sourceFeatures) {
  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  const pollutantValues = records.map((record) => record.pollutantValue);
  const aqiValues = records.map((record) => record.pollutantAqi ?? record.usAqi);
  const bounds = baseScenario.geoBounds;
  const roads = sourceFeatures?.roads ?? [];
  const industry = sourceFeatures?.industry ?? [];
  const transportAngle = circularMeanTransportRadians(baseScenario.cells.map((cell) => cell.windDirection));

  baseScenario.cells.forEach((cell, index) => {
    const record = records[index] ?? {};
    const concentration = record.pollutantValue ?? mean(pollutantValues);
    const pollutantAqi = record.pollutantAqi ?? record.usAqi ?? mean(aqiValues);
    const trafficFallback = clamp(0.55 * (cell.impervious ?? 0.5) + 0.45 * (cell.exposure ?? 0.5));
    const industrialFallback = clamp(0.65 * (cell.impervious ?? 0.5) + 0.35 * (cell.uncertainty ?? 0.5));
    const trafficIntensity = nearestSourceScore(cell, roads, bounds, 0.035) ?? trafficFallback;
    const industrialProximity = nearestSourceScore(cell, industry, bounds, 0.055) ?? industrialFallback;
    const downwindRoad = directionalSourceScore(cell, roads, bounds, transportAngle, 0.075, 0.022) ?? trafficIntensity;
    const downwindIndustry = directionalSourceScore(cell, industry, bounds, transportAngle, 0.11, 0.035) ?? industrialProximity;
    const downwindSourceRisk = clamp(0.55 * downwindRoad + 0.45 * downwindIndustry);
    const concentrationRelative = normalizeRange(pollutantValues, concentration);
    const aqiRisk = clamp((pollutantAqi ?? concentrationRelative * 100) / 200);
    const sourceRisk = clamp(0.46 * trafficIntensity + 0.34 * industrialProximity + 0.20 * downwindSourceRisk);
    cell.pollutant = pollutant;
    cell.pollutantLabel = definition.label;
    cell.pollutantUnit = definition.unit;
    cell.pollutantValue = concentration;
    cell.pollutantAqi = pollutantAqi;
    cell.usAqi = record.usAqi ?? pollutantAqi;
    cell.trafficIntensity = trafficIntensity;
    cell.industrialProximity = industrialProximity;
    cell.sourceRisk = sourceRisk;
    cell.downwindSourceRisk = downwindSourceRisk;
    cell.windSpeed = cell.windSpeed ?? 0;
    cell.windDirection = cell.windDirection ?? 0;
    cell.risk = clamp(0.72 * aqiRisk + 0.18 * sourceRisk + 0.10 * concentrationRelative);
    cell.uncertainty = clamp(0.28 + 0.34 * (1 - Math.min(1, baseScenario.observations?.length / 10)) + 0.22 * sourceRisk + 0.16 * (cell.uncertainty ?? 0.5));
    cell.interventionBenefit = clamp(0.42 * sourceRisk + 0.18 * downwindSourceRisk + 0.22 * cell.exposure + 0.18 * cell.vulnerability);
  });

  enrichAirCandidateRoles(baseScenario);

  return {
    definition,
    sourceStatus: roads.length || industry.length ? "mapped" : "proxy fallback",
    roadCount: roads.length,
    industrialCount: industry.length,
    sampledAt: records.find((record) => record.sampledAt)?.sampledAt ?? null,
    transportAngle
  };
}


export function enrichAirCandidateRoles(scenario) {
  if (!scenario?.cells?.length || !scenario?.candidates?.length) return scenario;
  const observations = scenario.observations ?? [];
  const calibrationRadiusSquared = 0.025 ** 2;
  for (const candidate of scenario.candidates) {
    let nearest = scenario.cells[0];
    let distance = Infinity;
    for (const cell of scenario.cells) {
      const current = (candidate.x - cell.x) ** 2 + (candidate.y - cell.y) ** 2;
      if (current < distance) {
        distance = current;
        nearest = cell;
      }
    }
    candidate.trafficIntensity = nearest?.trafficIntensity ?? 0.5;
    candidate.industrialProximity = nearest?.industrialProximity ?? 0.5;
    const nearReference = observations.some((observation) => (
      (candidate.x - observation.x) ** 2 + (candidate.y - observation.y) ** 2
    ) <= calibrationRadiusSquared);
    candidate.airRole = nearReference
      ? "calibration-collocation"
      : candidate.trafficIntensity > 0.7
        ? "roadside"
        : candidate.industrialProximity > 0.7
          ? "source-oriented"
          : "background";
    candidate.requiresCalibrationReview = true;
    candidate.referenceCollocationCandidate = nearReference;
  }
  return scenario;
}

export function applyNationalAirIntervention(scenario, target = "traffic") {
  if (!scenario?.cells?.length) return scenario;
  for (const cell of scenario.cells) {
    const source = target === "industrial"
      ? cell.industrialProximity
      : target === "clean-freight"
        ? 0.7 * cell.trafficIntensity + 0.3 * cell.industrialProximity
        : target === "background-separation"
          ? 1 - cell.sourceRisk
          : cell.trafficIntensity;
    cell.interventionBenefit = clamp(
      0.45 * source
      + 0.25 * cell.risk
      + 0.17 * cell.exposure
      + 0.13 * cell.vulnerability
    );
  }
  scenario.model.interventionTarget = target;
  return scenario;
}

export async function loadNationalAirScenario(bounds, {
  pollutant = "pm2_5",
  openAqApiKey = "",
  fetchImpl = fetch,
  signal,
  onProgress = () => {},
  label = null,
  candidateStrategy = "hybrid",
  monitorCount = 10,
  interventionTarget = "traffic",
  maxPoints = null,
  candidateTarget = null,
  candidateCap = null
} = {}) {
  const workload = estimateNationalHeatWorkload(bounds, { monitorCount, candidateStrategy });
  if (workload.blocked) throw new Error(workload.message);

  onProgress("Loading national geographic and social substrate...");
  const baseScenario = await loadNationalHeatScenario(bounds, {
    fetchImpl,
    signal,
    onProgress,
    label,
    candidateStrategy: "systematic",
    awaitHostEnrichment: false,
    monitorCount,
    maxPoints: Number.isFinite(maxPoints) ? maxPoints : workload.weatherPoints,
    candidateTarget: Number.isFinite(candidateTarget) ? candidateTarget : workload.candidateTarget,
    candidateCap: Number.isFinite(candidateCap) ? candidateCap : workload.candidateCap,
    weatherProgressLabel: "current weather and atmospheric transport context",
    weatherCacheLabel: "Open-Meteo Air weather context"
  });

  const definition = AIR_POLLUTANTS[pollutant] ?? AIR_POLLUTANTS.pm2_5;
  const records = await fetchAirBatch(baseScenario.cells, pollutant, fetchImpl, signal, onProgress);

  let sourceFeatures = { roads: [], industry: [] };
  let sourceError = null;
  try {
    sourceFeatures = await fetchSourceFeatures(baseScenario.geoBounds, fetchImpl, signal, onProgress);
  } catch (error) {
    if (signal?.aborted) throw error;
    sourceError = error?.message ?? "source enrichment unavailable";
  }

  let observations = [];
  let monitorStatus = "not requested";
  if (openAqApiKey) {
    try {
      observations = await fetchOpenAqLocations(baseScenario.geoBounds, pollutant, openAqApiKey, fetchImpl, signal, onProgress);
      monitorStatus = observations.length ? `${observations.length} current reference measurements loaded` : "no recent compatible reference measurements returned";
    } catch (error) {
      if (signal?.aborted) throw error;
      monitorStatus = `unavailable: ${error?.message ?? "OpenAQ request failed"}`;
    }
  }

  baseScenario.observations = observations;
  const airStatus = applyAirFields(baseScenario, records, pollutant, sourceFeatures);
  applyNationalAirIntervention(baseScenario, interventionTarget);
  if (candidateStrategy === "mapped") {
    baseScenario._systematicCandidates = [...baseScenario.candidates];
    baseScenario.candidates = [];
    baseScenario.model.candidateStatus = "waiting for mapped public hosts";
  }
  baseScenario.domainKey = "air";
  baseScenario.scenarioType = "live-national-air";
  baseScenario.cityKey = "national-air-viewport";
  baseScenario.cityLabel = label || baseScenario.cityLabel.replace("Heat", "Air");
  baseScenario.model = {
    ...baseScenario.model,
    source: "National viewport Air workspace",
    pollutant,
    pollutantLabel: definition.label,
    pollutantUnit: definition.unit,
    sampledAt: airStatus.sampledAt,
    transportAngle: airStatus.transportAngle,
    airSourceStatus: sourceError ? `proxy fallback: ${sourceError}` : airStatus.sourceStatus,
    roadSourceCount: airStatus.roadCount,
    industrialSourceCount: airStatus.industrialCount,
    referenceMonitorStatus: monitorStatus,
    referenceMonitorCount: observations.length,
    candidateStrategy,
    fullModelEnabled: true
  };

  enrichAirObservations(observations, baseScenario.cells);
  const inferenceDomain = { ...DOMAINS.air, transportAngle: baseScenario.model.transportAngle };
  const validation = runAirValidationExperiment(observations, inferenceDomain, { seed: 1207 });
  const inferenceSettings = validation.calibration?.available
    ? validation.calibration.settings
    : { lengthScaleMultiplier: 1, measurementNoise: 0.06, transportRegime: "moderate" };
  if (observations.some((observation) => Number.isFinite(observation.observedValue))) {
    attachAirInference(baseScenario, inferenceDomain, inferenceSettings);
  }
  baseScenario.model.airValidation = validation;
  baseScenario.model.airTransportSensitivity = evaluateAirTransportRegimes(
    validation.split?.development?.length ? validation.split.development : observations,
    inferenceDomain,
    inferenceSettings
  );
  baseScenario.model.referenceMeasurementCount = observations.filter((observation) => Number.isFinite(observation.observedValue)).length;

  baseScenario.sourceMetadata = {
    live: true,
    sourceType: "national-air-model",
    sources: [
      {
        label: "Open-Meteo Air Quality API",
        agency: "Open-Meteo using CAMS atmospheric-composition forecasts",
        role: `${definition.label} concentration and U.S. AQI screening field.`
      },
      ...(baseScenario.sourceMetadata?.sources ?? []).filter((source) => !/Open-Meteo Weather Forecast API|OpenStreetMap Overpass API/.test(source.label)),
      {
        label: "OpenStreetMap source features",
        agency: "OpenStreetMap contributors through Overpass",
        role: sourceError
          ? `Major-road and industrial features were unavailable (${sourceError}); transparent land-use and exposure proxies were used.`
          : `${airStatus.roadCount} major-road and ${airStatus.industrialCount} industrial/source features inform source-oriented placement.`
      },
      {
        label: "OpenAQ reference-monitor locations",
        agency: "OpenAQ and contributing monitoring agencies",
        role: openAqApiKey
          ? `${monitorStatus}; compatible latest values condition posterior concentration and uncertainty, with held-out validation when enough monitors are available.`
          : "Optional. A user-supplied API key can load reference-monitor locations without exposing the key in the repository."
      }
    ],
    layers: [
      {
        key: "risk", label: `${definition.label} risk`, source: "Open-Meteo air-quality field + source and social layers",
        status: "modeled screening field", resolution: `${baseScenario.cells.length} viewport evaluation points`, confidence: "screening",
        interpretation: "Combines pollutant-specific AQI, relative concentration, and local source proximity; it is not a regulatory compliance determination."
      },
      {
        key: "pollutantValue", label: `${definition.label} concentration`, source: "Open-Meteo Air Quality API",
        status: "atmospheric-model output", resolution: "CAMS model grid sampled over the viewport", confidence: "moderate",
        interpretation: `Near-surface ${definition.label} concentration in ${definition.unit}.`
      },
      ...(observations.length ? [{
        key: "posteriorPollutant", label: `${definition.label} reference-conditioned concentration`, source: "Open-Meteo prior + OpenAQ latest compatible readings",
        status: validation.available ? "held-out validated posterior field" : "reference-conditioned posterior field", resolution: `${baseScenario.cells.length} viewport evaluation points`, confidence: validation.available ? "diagnostic" : "limited",
        interpretation: "A source-aware trend and wind-aligned residual Gaussian process update the atmospheric-model prior; it is not a regulatory compliance surface."
      }, {
        key: "predictiveAirUncertainty", label: "Predictive concentration uncertainty", source: "LUMOS Air posterior covariance",
        status: "modeled epistemic uncertainty", resolution: `${baseScenario.cells.length} viewport evaluation points`, confidence: validation.available ? "calibrated diagnostic" : "uncalibrated diagnostic",
        interpretation: "Estimated reducible uncertainty after conditioning on compatible reference readings."
      }] : []),
      {
        key: "trafficIntensity", label: "Traffic-source proximity", source: sourceError ? "land-use proxy fallback" : "OpenStreetMap major roads",
        status: sourceError ? "derived fallback" : "mapped-source proxy", resolution: "viewport screening", confidence: sourceError ? "low" : "moderate",
        interpretation: "A source-orientation proxy, not measured traffic volume or emissions."
      },
      {
        key: "industrialProximity", label: "Industrial-source proximity", source: sourceError ? "land-use proxy fallback" : "OpenStreetMap industrial and plant features",
        status: sourceError ? "derived fallback" : "mapped-source proxy", resolution: "viewport screening", confidence: sourceError ? "low" : "moderate",
        interpretation: "A mapped-source proximity indicator, not an emissions inventory."
      },
      {
        key: "vulnerability", label: "Social vulnerability", source: "2024 ACS five-year tract estimates",
        status: baseScenario.model.censusStatus === "loaded" ? "area-level composite" : "neutral fallback", resolution: "Census tract", confidence: "moderate",
        interpretation: "Area-level poverty, age susceptibility, and vehicle-access indicators; it does not characterize individuals."
      }
    ],
    limitations: [
      `${definition.label} values are atmospheric-model output and must not be treated as regulatory monitor readings.`,
      "Wind-aware covariance represents directional correlation and transport, but it is not a full chemical-transport or street-canyon simulation.",
      sourceError ? "Mapped source features were unavailable; traffic and industrial layers use lower-confidence transparent proxies." : "Road and industrial proximity are source proxies, not measured emissions rates.",
      openAqApiKey ? `OpenAQ monitor conditioning status: ${monitorStatus}.` : "No OpenAQ key was supplied, so the network was not conditioned on external reference-monitor locations.",
      "Systematic and mapped candidates remain siting proxies; permission, power, inlet height, calibration, security, and maintenance require field verification.",
      observations.length
        ? "OpenAQ readings can differ in timestamp and reporting method; LUMOS records age and source units and does not treat the fitted field as a regulatory compliance surface."
        : "Without compatible reference measurements, the posterior mean remains the atmospheric-model screening field and validation is unavailable."
    ]
  };
  return baseScenario;
}
