import { loadNationalHeatScenario, estimateNationalHeatWorkload } from "../heat/national.js";
import { DOMAINS } from "../../config/domains.js";
import { attachWaterInference } from "../../model/water/inference.js";

const USGS_IV_URL = "https://waterservices.usgs.gov/nwis/iv/";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

export const WATER_SYSTEMS = Object.freeze({
  surface: {
    label: "Surface water / watershed",
    description: "River- and stream-oriented screening using USGS monitoring sites and mapped hydrologic features."
  },
  distribution: {
    label: "Drinking-water distribution proxy",
    description: "A planning proxy for service-zone and distribution sampling when an authoritative local pipe model is unavailable."
  }
});

export const WATER_INDICATORS = Object.freeze({
  temperature: { label: "Water temperature", unit: "°C", parameterCd: "00010", direction: "high", fallback: 18 },
  dissolved_oxygen: { label: "Dissolved oxygen", unit: "mg/L", parameterCd: "00300", direction: "low", fallback: 8 },
  ph: { label: "pH", unit: "standard units", parameterCd: "00400", direction: "deviation", center: 7.5, spread: 2.2, fallback: 7.4 },
  specific_conductance: { label: "Specific conductance", unit: "µS/cm", parameterCd: "00095", direction: "high", fallback: 420 },
  turbidity: { label: "Turbidity", unit: "FNU", parameterCd: "63680", direction: "high", fallback: 4 },
  discharge: { label: "Stream discharge", unit: "ft³/s", parameterCd: "00060", direction: "extreme", fallback: 250 }
});

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

function quantile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = clamp(probability) * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const ratio = position - low;
  return sorted[low] + (sorted[high] - sorted[low]) * ratio;
}

function normalize(value, values) {
  if (!Number.isFinite(value)) return 0.5;
  const low = quantile(values, 0.05);
  const high = quantile(values, 0.95);
  if (!Number.isFinite(low) || !Number.isFinite(high) || Math.abs(high - low) < 1e-9) return 0.5;
  return clamp((value - low) / (high - low));
}

function normalizedPosition(lng, lat, bounds) {
  return {
    x: clamp((lng - bounds.minLng) / Math.max(1e-9, bounds.maxLng - bounds.minLng)),
    y: clamp((lat - bounds.minLat) / Math.max(1e-9, bounds.maxLat - bounds.minLat))
  };
}

function boundsToBbox(bounds) {
  return `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`;
}

function latestSeriesValue(series) {
  const values = (series?.values ?? []).flatMap((group) => group?.value ?? [])
    .map((entry) => ({
      value: finite(entry?.value),
      sampledAt: entry?.dateTime ?? null,
      qualifiers: entry?.qualifiers ?? []
    }))
    .filter((entry) => entry.value !== null);
  return values.at(-1) ?? null;
}

export function normalizeUsgsInstantaneous(payload, bounds, indicatorKey = "temperature") {
  const definition = WATER_INDICATORS[indicatorKey] ?? WATER_INDICATORS.temperature;
  return (payload?.value?.timeSeries ?? []).flatMap((series) => {
    const location = series?.sourceInfo?.geoLocation?.geogLocation ?? {};
    const lat = finite(location.latitude);
    const lng = finite(location.longitude);
    const latest = latestSeriesValue(series);
    if (lat === null || lng === null || !latest) return [];
    const siteCode = String(series?.sourceInfo?.siteCode?.[0]?.value ?? series?.name ?? "unknown");
    const position = normalizedPosition(lng, lat, bounds);
    const provisional = latest.qualifiers.some((value) => /p|provisional/i.test(String(value)));
    return [{
      id: `usgs-${siteCode}-${definition.parameterCd}`,
      siteCode,
      name: series?.sourceInfo?.siteName ?? `USGS site ${siteCode}`,
      ...position,
      lat,
      lng,
      observedValue: latest.value,
      sampledAt: latest.sampledAt,
      unit: series?.variable?.unit?.unitCode ?? definition.unit,
      indicator: indicatorKey,
      parameterCd: definition.parameterCd,
      reliability: provisional ? 0.86 : 0.96,
      feasibility: 1,
      sensorNoise: provisional ? 0.065 : 0.035,
      official: true,
      existing: true,
      sourceType: "usgs_instantaneous_value",
      qualifiers: latest.qualifiers
    }];
  });
}

async function fetchJsonWithRetry(url, { fetchImpl, signal, attempts = 2, label = "Water service" }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal, cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError ?? new Error(`${label} did not respond.`);
}

async function fetchUsgsObservations(bounds, indicatorKey, fetchImpl, signal, onProgress) {
  const definition = WATER_INDICATORS[indicatorKey] ?? WATER_INDICATORS.temperature;
  const params = new URLSearchParams({
    format: "json",
    bBox: boundsToBbox(bounds),
    parameterCd: definition.parameterCd,
    siteStatus: "active",
    period: "P2D"
  });
  onProgress(`Loading recent USGS ${definition.label.toLowerCase()} readings...`);
  const payload = await fetchJsonWithRetry(`${USGS_IV_URL}?${params}`, {
    fetchImpl,
    signal,
    attempts: 3,
    label: "USGS instantaneous values"
  });
  return normalizeUsgsInstantaneous(payload, bounds, indicatorKey);
}

function overpassQuery(bounds) {
  const bbox = `${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng}`;
  return `[out:json][timeout:14];(\nway["waterway"~"river|stream|canal|drain"](${bbox});\nnwr["man_made"="wastewater_plant"](${bbox});\nnwr["man_made"="water_works"](${bbox});\nnwr["industrial"="water_treatment"](${bbox});\nnwr["landuse"~"industrial|landfill|farmland|orchard"](${bbox});\nnwr["amenity"="drinking_water"](${bbox});\n);out center geom tags 500;`;
}

function normalizeWaterFeatures(payload, bounds) {
  const waterways = [];
  const sources = [];
  const access = [];
  for (const element of payload?.elements ?? []) {
    const tags = element.tags ?? {};
    const geometry = Array.isArray(element.geometry) ? element.geometry : [];
    if (tags.waterway) {
      const points = geometry.length ? geometry : [{ lat: element.lat ?? element.center?.lat, lon: element.lon ?? element.center?.lon }];
      for (const point of points) {
        const lat = finite(point.lat);
        const lng = finite(point.lon);
        if (lat === null || lng === null) continue;
        waterways.push({ lat, lng, ...normalizedPosition(lng, lat, bounds), name: tags.name ?? tags.waterway, waterway: tags.waterway });
      }
      continue;
    }
    const lat = finite(element.lat ?? element.center?.lat);
    const lng = finite(element.lon ?? element.center?.lon);
    if (lat === null || lng === null) continue;
    const record = { lat, lng, tags, ...normalizedPosition(lng, lat, bounds) };
    if (tags.amenity === "drinking_water" || tags.man_made === "water_works") access.push(record);
    else sources.push(record);
  }
  return { waterways, sources, access };
}

async function fetchWaterFeatures(bounds, fetchImpl, signal, onProgress) {
  const body = `data=${encodeURIComponent(overpassQuery(bounds))}`;
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("Water feature request timed out", "TimeoutError")), 9000);
    const forwardAbort = () => controller.abort(signal?.reason ?? new DOMException("Request aborted", "AbortError"));
    signal?.addEventListener("abort", forwardAbort, { once: true });
    try {
      onProgress("Loading optional waterways, treatment facilities, and runoff-source proxies...");
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
        body,
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return normalizeWaterFeatures(await response.json(), bounds);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forwardAbort);
    }
  }
  throw lastError ?? new Error("No water-feature endpoint responded.");
}

function principalFlowAxis(points, bounds) {
  if (points.length < 2) return Math.PI * 0.08;
  const centerLat = mean(points.map((point) => point.lat));
  const centerLng = mean(points.map((point) => point.lng));
  const cosine = Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
  const projected = points.map((point) => ({
    east: (point.lng - centerLng) * 111.32 * cosine,
    north: (point.lat - centerLat) * 110.57
  }));
  const xx = mean(projected.map((point) => point.east ** 2));
  const yy = mean(projected.map((point) => point.north ** 2));
  const xy = mean(projected.map((point) => point.east * point.north));
  const physicalAngle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const east = Math.cos(physicalAngle);
  const north = Math.sin(physicalAngle);
  const xScale = Math.max(1e-9, (bounds.maxLng - bounds.minLng) * 111.32 * cosine);
  const yScale = Math.max(1e-9, (bounds.maxLat - bounds.minLat) * 110.57);
  return Math.atan2(north / yScale, east / xScale);
}

function orientFlowAxis(angle, features, observations) {
  const sources = features.sources ?? [];
  const receptors = [...(features.access ?? []), ...observations];
  if (!sources.length || !receptors.length) return angle;
  const project = (point) => point.x * Math.cos(angle) + point.y * Math.sin(angle);
  const sourcePosition = mean(sources.map(project));
  const receptorPosition = mean(receptors.map(project));
  return sourcePosition <= receptorPosition ? angle : angle + Math.PI;
}

function rotated(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    along: point.x * cosine + point.y * sine,
    across: -point.x * sine + point.y * cosine
  };
}

function nearestDistance(point, features) {
  if (!features.length) return Infinity;
  let best = Infinity;
  for (const feature of features) best = Math.min(best, Math.hypot(point.x - feature.x, point.y - feature.y));
  return best;
}

function nearestCell(candidate, cells) {
  let best = cells[0];
  let distance = Infinity;
  for (const cell of cells) {
    const current = (cell.x - candidate.x) ** 2 + (cell.y - candidate.y) ** 2;
    if (current < distance) { best = cell; distance = current; }
  }
  return best;
}

function idwValue(cell, observations, fallback) {
  if (!observations.length) return fallback;
  let numerator = 0;
  let denominator = 0;
  for (const observation of observations) {
    const distance = Math.max(0.008, Math.hypot(cell.x - observation.x, cell.y - observation.y));
    const weight = (observation.reliability ?? 0.9) / (distance ** 1.7);
    numerator += observation.observedValue * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : fallback;
}

function riskFromIndicator(value, values, definition) {
  if (!Number.isFinite(value)) return 0.5;
  if (definition.direction === "low") return 1 - normalize(value, values);
  if (definition.direction === "deviation") return clamp(Math.abs(value - definition.center) / definition.spread);
  if (definition.direction === "extreme") {
    const logs = values.filter((entry) => entry > 0).map(Math.log1p);
    const center = quantile(logs, 0.5) ?? Math.log1p(definition.fallback);
    const spread = Math.max(0.4, (quantile(logs, 0.9) ?? center + 1) - (quantile(logs, 0.1) ?? center - 1));
    return clamp(Math.abs(Math.log1p(Math.max(0, value)) - center) / spread);
  }
  return normalize(value, values);
}

function buildMappedCandidates(features, observations, bounds, flowAngle) {
  const points = [...features.waterways.filter((_, index) => index % Math.max(1, Math.floor(features.waterways.length / 70)) === 0), ...features.access, ...features.sources]
    .slice(0, 140);
  const candidates = points.map((point, index) => {
    const nearObservation = observations.some((observation) => Math.hypot(observation.x - point.x, observation.y - point.y) < 0.025);
    const isSource = Boolean(point.tags && (
      point.tags.man_made === "wastewater_plant"
      || point.tags.industrial === "water_treatment"
      || point.tags.landuse === "industrial"
      || point.tags.landuse === "landfill"
      || point.tags.landuse === "farmland"
    ));
    const rotatedPoint = rotated(point, flowAngle);
    return {
      id: `water-mapped-${index}`,
      name: point.name ?? (isSource ? "Mapped source-adjacent site" : "Mapped water-access proxy"),
      source: "OpenStreetMap",
      sourceType: "mapped_water_candidate",
      x: point.x,
      y: point.y,
      lat: point.lat,
      lng: point.lng,
      cost: nearObservation ? 0.75 : isSource ? 1.05 : 0.86,
      feasibility: 0.72,
      reliability: nearObservation ? 0.94 : 0.82,
      feasible: true,
      flowAngle,
      networkBranch: Math.max(0, Math.min(3, Math.floor(clamp(rotatedPoint.across + 0.5) * 4))),
      requiresFieldVerification: true,
      permissionStatus: "unknown",
      waterRole: nearObservation ? "reference-collocation" : isSource ? "upstream-source" : "water-access"
    };
  });
  return candidates;
}

function applyWaterFields(scenario, indicatorKey, systemType, observations, features) {
  const definition = WATER_INDICATORS[indicatorKey] ?? WATER_INDICATORS.temperature;
  const waterPoints = features.waterways.length ? features.waterways : observations;
  const flowAngle = orientFlowAxis(principalFlowAxis(waterPoints, scenario.geoBounds), features, observations);
  const rotations = scenario.cells.map((cell) => rotated(cell, flowAngle));
  const acrossValues = rotations.map((entry) => entry.across);
  const alongValues = rotations.map((entry) => entry.along);
  const acrossLow = Math.min(...acrossValues);
  const acrossHigh = Math.max(...acrossValues);
  const alongLow = Math.min(...alongValues);
  const alongHigh = Math.max(...alongValues);
  const observedValues = observations.map((entry) => entry.observedValue);
  const meanObserved = mean(observedValues) || definition.fallback;

  for (let index = 0; index < scenario.cells.length; index += 1) {
    const cell = scenario.cells[index];
    const rotatedCell = rotations[index];
    const waterDistance = nearestDistance(cell, waterPoints);
    const stationDistance = nearestDistance(cell, observations);
    const sourceDistance = nearestDistance(cell, features.sources);
    const waterProximity = Number.isFinite(waterDistance) ? Math.exp(-waterDistance / 0.08) : 0.35;
    const monitoringDensity = Number.isFinite(stationDistance) ? Math.exp(-stationDistance / 0.10) : 0;
    const sourcePressure = Number.isFinite(sourceDistance) ? Math.exp(-sourceDistance / 0.09) : 0.25 * cell.landClass + 0.20 * cell.builtForm;
    const networkBranch = Math.max(0, Math.min(3, Math.floor(clamp((rotatedCell.across - acrossLow) / Math.max(1e-9, acrossHigh - acrossLow)) * 4)));
    const flowPosition = clamp((rotatedCell.along - alongLow) / Math.max(1e-9, alongHigh - alongLow));
    const crossPosition = clamp((rotatedCell.across - acrossLow) / Math.max(1e-9, acrossHigh - acrossLow));
    const value = idwValue(cell, observations, meanObserved * (0.9 + 0.2 * cell.risk));
    const indicatorRisk = riskFromIndicator(value, observedValues.length ? observedValues : [definition.fallback * 0.8, definition.fallback, definition.fallback * 1.2], definition);
    const flowConnectivity = clamp(waterProximity * (0.72 + 0.28 * (1 - Math.abs(crossPosition - 0.5) * 2)));
    const upstreamSourcePressure = clamp(sourcePressure * (0.82 + 0.18 * (1 - flowPosition)));
    const downstreamExposure = clamp(flowConnectivity * (0.52 * cell.exposure + 0.30 * cell.vulnerability + 0.18 * upstreamSourcePressure));
    const distributionPenalty = systemType === "distribution" ? 0.18 * cell.builtForm + 0.12 * cell.vulnerability : 0;
    cell.priorWaterIndicatorValue = value;
    cell.waterIndicatorValue = value;
    cell.flowConnectivity = flowConnectivity;
    cell.waterwayProximity = waterProximity;
    cell.monitoringDensity = monitoringDensity;
    cell.upstreamSourcePressure = upstreamSourcePressure;
    cell.downstreamExposure = downstreamExposure;
    cell.networkBranch = networkBranch;
    cell.flowPosition = flowPosition;
    cell.risk = clamp(0.48 * indicatorRisk + 0.22 * upstreamSourcePressure + 0.18 * downstreamExposure + distributionPenalty + 0.12 * (1 - monitoringDensity));
    cell.uncertainty = clamp(0.18 + 0.62 * (1 - monitoringDensity) + 0.20 * (1 - flowConnectivity));
    cell.ecology = clamp(0.68 * cell.ecology + 0.32 * waterProximity);
    cell.communityPriority = clamp(0.42 * cell.risk + 0.30 * cell.vulnerability + 0.20 * cell.exposure + 0.08 * (1 - monitoringDensity));
  }

  for (const candidate of scenario.candidates) {
    const cell = nearestCell(candidate, scenario.cells);
    Object.assign(candidate, {
      localRisk: cell.risk,
      localUncertainty: cell.uncertainty,
      flowConnectivity: cell.flowConnectivity,
      upstreamSourcePressure: cell.upstreamSourcePressure,
      downstreamExposure: cell.downstreamExposure,
      waterIndicatorValue: cell.waterIndicatorValue,
      networkBranch: cell.networkBranch,
      flowAngle
    });
  }

  return { flowAngle, meanObserved };
}

export function enrichWaterCandidateRoles(scenario) {
  if (!scenario?.candidates?.length || !scenario?.cells?.length) return scenario;
  const observations = scenario.observations ?? [];
  for (const candidate of scenario.candidates) {
    const cell = nearestCell(candidate, scenario.cells);
    const nearReference = observations.some((observation) => Math.hypot(observation.x - candidate.x, observation.y - candidate.y) < 0.025);
    candidate.flowAngle = scenario.model?.transportAngle ?? candidate.flowAngle ?? 0;
    candidate.networkBranch = cell.networkBranch ?? candidate.networkBranch ?? 0;
    candidate.flowConnectivity = cell.flowConnectivity ?? 0;
    candidate.upstreamSourcePressure = cell.upstreamSourcePressure ?? 0;
    candidate.downstreamExposure = cell.downstreamExposure ?? 0;
    candidate.waterRole = nearReference
      ? "reference-collocation"
      : candidate.upstreamSourcePressure > 0.68
        ? "upstream-source"
        : candidate.downstreamExposure > 0.68
          ? "downstream-receptor"
          : candidate.flowConnectivity > 0.65
            ? "network-coverage"
            : "background";
  }
  return scenario;
}

export async function enrichNationalWaterCandidateHosts(scenario, { candidateStrategy = "hybrid", onProgress = () => {} } = {}) {
  const systematic = scenario._systematicCandidates ?? scenario.candidates ?? [];
  const mapped = scenario._waterMappedCandidates ?? [];
  onProgress("Activating mapped water-access and source-oriented candidates...");
  scenario.candidates = candidateStrategy === "mapped"
    ? [...mapped]
    : candidateStrategy === "systematic"
      ? [...systematic]
      : [...systematic, ...mapped.filter((candidate) => !systematic.some((site) => Math.hypot(site.x - candidate.x, site.y - candidate.y) < 0.015))];
  enrichWaterCandidateRoles(scenario);
  scenario.model.systematicCandidateCount = systematic.length;
  scenario.model.mappedCandidateCount = mapped.length;
  scenario.model.hostEnrichmentStatus = mapped.length ? "mapped water candidates loaded" : "no mapped water candidates returned";
  scenario.model.candidateStatus = `${scenario.candidates.length} active water candidates`;
  return { mappedCount: mapped.length, candidateCount: scenario.candidates.length };
}

export function applyNationalWaterIntervention(scenario, target = "wastewater") {
  if (!scenario?.cells?.length) return scenario;
  for (const cell of scenario.cells) {
    const targetPressure = target === "stormwater"
      ? 0.55 * cell.builtForm + 0.45 * cell.upstreamSourcePressure
      : target === "agriculture"
        ? 0.55 * cell.landClass + 0.45 * cell.upstreamSourcePressure
        : target === "distribution"
          ? 0.52 * cell.downstreamExposure + 0.30 * cell.vulnerability + 0.18 * (1 - cell.monitoringDensity)
          : cell.upstreamSourcePressure;
    cell.interventionBenefit = clamp(0.40 * targetPressure + 0.25 * cell.risk + 0.18 * cell.downstreamExposure + 0.17 * cell.uncertainty);
  }
  scenario.model.interventionTarget = target;
  return scenario;
}

export async function loadNationalWaterScenario(bounds, {
  indicator = "temperature",
  systemType = "surface",
  fetchImpl = fetch,
  signal,
  onProgress = () => {},
  label = null,
  candidateStrategy = "hybrid",
  monitorCount = 10,
  interventionTarget = "wastewater",
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
    weatherProgressLabel: "current weather and watershed context",
    weatherCacheLabel: "Open-Meteo Water weather context"
  });

  let observations = [];
  let observationStatus = "no recent compatible readings returned";
  try {
    observations = await fetchUsgsObservations(baseScenario.geoBounds, indicator, fetchImpl, signal, onProgress);
    observationStatus = observations.length ? `${observations.length} recent USGS readings loaded` : observationStatus;
  } catch (error) {
    if (signal?.aborted) throw error;
    observationStatus = `USGS readings unavailable: ${error.message}`;
  }

  let features = { waterways: [], sources: [], access: [] };
  let featureStatus = "not loaded";
  try {
    features = await fetchWaterFeatures(baseScenario.geoBounds, fetchImpl, signal, onProgress);
    featureStatus = `${features.waterways.length} waterway points, ${features.sources.length} source proxies, and ${features.access.length} access proxies`;
  } catch (error) {
    if (signal?.aborted) throw error;
    featureStatus = `mapped hydrologic enrichment unavailable: ${error.message}`;
  }

  baseScenario.domainKey = "water";
  baseScenario.scenarioType = "live-national-water";
  baseScenario.cityKey = "national-water-viewport";
  baseScenario.cityLabel = label || baseScenario.cityLabel.replace("Heat", "Water");
  baseScenario.observations = observations;
  const status = applyWaterFields(baseScenario, indicator, systemType, observations, features);
  const definition = WATER_INDICATORS[indicator] ?? WATER_INDICATORS.temperature;
  baseScenario._systematicCandidates = [...baseScenario.candidates];
  baseScenario._waterMappedCandidates = buildMappedCandidates(features, observations, baseScenario.geoBounds, status.flowAngle);
  if (candidateStrategy === "mapped") baseScenario.candidates = [];
  enrichWaterCandidateRoles(baseScenario);
  baseScenario.model = {
    ...baseScenario.model,
    source: "National viewport Water workspace",
    indicator,
    indicatorLabel: definition.label,
    indicatorUnit: definition.unit,
    parameterCd: definition.parameterCd,
    systemType,
    systemLabel: WATER_SYSTEMS[systemType]?.label ?? WATER_SYSTEMS.surface.label,
    transportAngle: status.flowAngle,
    flowDirectionConfidence: features.waterways.length >= 8 ? "moderate geometric-axis proxy" : "low fallback proxy",
    waterObservationStatus: observationStatus,
    waterObservationCount: observations.length,
    waterFeatureStatus: featureStatus,
    waterwayPointCount: features.waterways.length,
    sourceProxyCount: features.sources.length,
    accessProxyCount: features.access.length,
    candidateStrategy,
    fullModelEnabled: true,
    systematicCandidateCount: baseScenario._systematicCandidates.length,
    mappedCandidateCount: baseScenario._waterMappedCandidates.length
  };
  const inferenceDomain = { ...DOMAINS.water, transportAngle: status.flowAngle };
  attachWaterInference(baseScenario, inferenceDomain, {
    indicator,
    indicatorDefinition: definition,
    lockedSeed: 1901
  });
  enrichWaterCandidateRoles(baseScenario);
  applyNationalWaterIntervention(baseScenario, interventionTarget);

  baseScenario.sourceMetadata = {
    live: true,
    sourceType: "national-water-screening-model",
    sources: [
      {
        label: "USGS Water Services instantaneous values",
        agency: "U.S. Geological Survey",
        role: `${definition.label} readings from active sites in the fitted extent; status: ${observationStatus}.`
      },
      ...(baseScenario.sourceMetadata?.sources ?? []).filter((source) => !/Open-Meteo Weather Forecast API|OpenStreetMap Overpass API/.test(source.label)),
      {
        label: "OpenStreetMap waterways and source proxies",
        agency: "OpenStreetMap contributors through Overpass",
        role: `${featureStatus}. Features inform flow orientation, source-to-receptor screening, and optional candidate enrichment.`
      },
      {
        label: "USGS NHDPlus / NLDI methodological target",
        agency: "U.S. Geological Survey",
        role: "The public screening adapter preserves flow direction and branches as explicit proxies; authoritative NHDPlus network navigation can replace those proxies when available."
      }
    ],
    layers: [
      {
        key: "risk", label: `${definition.label} monitoring priority`, source: "USGS readings + hydrologic/source/social screening",
        status: observations.length ? "observation-informed screening field" : "proxy screening field", resolution: `${baseScenario.cells.length} viewport evaluation points`, confidence: observations.length >= 3 ? "moderate" : "low",
        interpretation: "Prioritizes monitoring and inspection; it is not a regulatory exceedance or drinking-water safety determination."
      },
      {
        key: "waterIndicatorValue", label: definition.label, source: observations.length >= 3 ? "USGS readings with screening trend and flow-aware residual Gaussian process" : observations.length ? "USGS latest readings with inverse-distance screening interpolation" : "transparent fallback proxy",
        status: observations.length >= 3 ? "posterior observation-conditioned field" : observations.length ? "recent observation-informed screening field" : "unobserved proxy field", resolution: `${observations.length} current sites over ${baseScenario.cells.length} evaluation points`, confidence: baseScenario.model.waterValidation?.available ? "medium" : observations.length >= 3 ? "low-to-medium" : "low",
        interpretation: `Displayed in ${definition.unit}. Values between sites are posterior or screening model outputs, not measurements.`
      },
      {
        key: "flowConnectivity", label: "Flow-network connectivity", source: features.waterways.length ? "mapped waterway geometry" : "geometric fallback",
        status: "directional network proxy", resolution: "viewport", confidence: features.waterways.length >= 8 ? "moderate" : "low",
        interpretation: "Represents likely along-network correlation; it is not a hydraulic or hydrodynamic simulation."
      },
      {
        key: "upstreamSourcePressure", label: "Upstream source pressure", source: features.sources.length ? "mapped treatment, industrial, landfill, and agricultural features" : "land-use fallback",
        status: "source-to-receptor proxy", resolution: "viewport", confidence: features.sources.length ? "screening" : "low",
        interpretation: "A prioritization proxy, not a discharge inventory or contaminant loading estimate."
      },
      {
        key: "vulnerability", label: "Social vulnerability", source: "2024 ACS five-year tract estimates",
        status: baseScenario.model.censusStatus === "loaded" ? "area-level composite" : "neutral fallback", resolution: "Census tract", confidence: "moderate",
        interpretation: "Area-level vulnerability indicators; they do not characterize individuals or establish service-area boundaries."
      }
    ],
    limitations: [
      "USGS instantaneous values are provisional or operational observations and may not be available for every indicator or locality.",
      "The flow axis and branch labels are screening proxies unless an authoritative NHDPlus, watershed, or utility network is supplied.",
      systemType === "distribution" ? "The drinking-water distribution mode does not include authoritative pipe topology, pressure zones, water age, asset condition, or utility operations." : "Surface-water interpolation does not replace watershed, hydrodynamic, or contaminant-transport modeling.",
      "Waterway and source features from OpenStreetMap may be incomplete and do not represent permitted loads or verified discharge rates.",
      "Recommendations require access, safety, sampling-method, chain-of-custody, laboratory, and regulatory review before field use.",
      observations.length ? "Values between monitoring sites are modeled screening estimates rather than observed concentrations." : "No recent compatible readings were returned, so the indicator surface is an explicitly low-confidence proxy."
    ]
  };
  return baseScenario;
}
