import { CACHE_DURATIONS, getCachedJson, putCachedJson } from "../../storage/cache.js";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const MAX_BATCH = 24;
const LIVE_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "cloud_cover",
  "precipitation",
  "weather_code",
  "is_day"
];

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function responseList(payload) {
  return Array.isArray(payload) ? payload : [payload];
}

function currentRecord(response) {
  const current = response?.current ?? {};
  return {
    time: current.time ?? null,
    temperature: finite(current.temperature_2m),
    apparentTemperature: finite(current.apparent_temperature),
    humidity: finite(current.relative_humidity_2m),
    windSpeed: finite(current.wind_speed_10m),
    windDirection: finite(current.wind_direction_10m),
    cloudCover: finite(current.cloud_cover),
    precipitation: finite(current.precipitation),
    weatherCode: finite(current.weather_code),
    isDay: finite(current.is_day)
  };
}

function hourlyRecord(response, index) {
  const hourly = response?.hourly ?? {};
  return {
    time: hourly.time?.[index] ?? null,
    temperature: finite(hourly.temperature_2m?.[index]),
    apparentTemperature: finite(hourly.apparent_temperature?.[index]),
    humidity: finite(hourly.relative_humidity_2m?.[index]),
    windSpeed: finite(hourly.wind_speed_10m?.[index]),
    windDirection: finite(hourly.wind_direction_10m?.[index]),
    cloudCover: finite(hourly.cloud_cover?.[index]),
    precipitation: finite(hourly.precipitation?.[index]),
    weatherCode: finite(hourly.weather_code?.[index]),
    isDay: finite(hourly.is_day?.[index])
  };
}

async function fetchJson(url, fetchImpl, {
  signal = null,
  cache = true,
  label = "Open-Meteo live weather"
} = {}) {
  if (cache) {
    const cached = await getCachedJson(url, {
      fetchImpl,
      ttlMs: CACHE_DURATIONS.weather,
      options: { signal },
      label
    });
    if (cached) return cached.value;
  }
  const response = await fetchImpl(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (cache) await putCachedJson(url, payload, {
    fetchImpl,
    options: { signal },
    label
  });
  return payload;
}

function requestUrl(points, { current = false, forecastDays = 2 } = {}) {
  const params = new URLSearchParams({
    latitude: points.map((point) => Number(point.lat).toFixed(5)).join(","),
    longitude: points.map((point) => Number(point.lng).toFixed(5)).join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "GMT",
    forecast_days: String(Math.max(1, Math.min(3, forecastDays)))
  });
  if (current) params.set("current", LIVE_VARIABLES.join(","));
  else params.set("hourly", LIVE_VARIABLES.join(","));
  return `${OPEN_METEO_URL}?${params}`;
}

function validatePointRecords(points, records) {
  if (records.length !== points.length) {
    throw new Error(`Open-Meteo returned ${records.length} locations for ${points.length} requested points.`);
  }
  records.forEach((record, index) => {
    if (record.temperature === null || record.apparentTemperature === null) {
      throw new Error(`Open-Meteo did not return usable Heat values for point ${index + 1}.`);
    }
  });
}

async function fetchCurrentBatch(points, options) {
  const payload = await fetchJson(requestUrl(points, { current: true }), options.fetchImpl, {
    signal: options.signal,
    cache: options.cache,
    label: "Open-Meteo current conditions"
  });
  const records = responseList(payload).map(currentRecord);
  validatePointRecords(points, records);
  return records.map((record, index) => ({ id: points[index].id, ...record }));
}

async function fetchForecastBatch(points, options) {
  const payload = await fetchJson(requestUrl(points, {
    current: false,
    forecastDays: options.forecastDays
  }), options.fetchImpl, {
    signal: options.signal,
    cache: options.cache,
    label: "Open-Meteo forecast playback"
  });
  const responses = responseList(payload);
  if (responses.length !== points.length) {
    throw new Error(`Open-Meteo returned ${responses.length} locations for ${points.length} requested points.`);
  }
  return responses;
}

function representativePoints(cells, maximum = 96) {
  if (cells.length <= maximum) return cells;
  const selected = [];
  const used = new Set();
  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.min(cells.length - 1, Math.round(index * (cells.length - 1) / Math.max(1, maximum - 1)));
    if (!used.has(sourceIndex)) {
      used.add(sourceIndex);
      selected.push(cells[sourceIndex]);
    }
  }
  return selected;
}

function expandRecords(cells, sampledPoints, sampledRecords) {
  const direct = new Map(sampledRecords.map((record) => [record.id, record]));
  return cells.map((cell) => {
    const existing = direct.get(cell.id);
    if (existing) return existing;
    const nearest = sampledPoints.map((point, index) => ({
      point,
      record: sampledRecords[index],
      distanceSquared: (Number(point.lng) - Number(cell.lng)) ** 2 + (Number(point.lat) - Number(cell.lat)) ** 2
    })).sort((left, right) => left.distanceSquared - right.distanceSquared).slice(0, 6);
    const interpolated = { id: cell.id };
    for (const key of ["temperature", "apparentTemperature", "humidity", "windSpeed", "windDirection", "cloudCover", "precipitation", "isDay"]) {
      let weighted = 0;
      let totalWeight = 0;
      for (const neighbor of nearest) {
        const value = finite(neighbor.record?.[key]);
        if (value === null) continue;
        const weight = 1 / (neighbor.distanceSquared + 1e-8);
        weighted += weight * value;
        totalWeight += weight;
      }
      interpolated[key] = totalWeight ? weighted / totalWeight : null;
    }
    interpolated.weatherCode = nearest[0]?.record?.weatherCode ?? null;
    interpolated.time = nearest[0]?.record?.time ?? null;
    return interpolated;
  });
}

export function initializeLiveFields(scenario) {
  if (!scenario?.cells?.length) return scenario;
  scenario.cells.forEach((cell) => {
    cell.liveTemperature = finite(cell.temperature) ?? finite(cell.apparentTemperature) ?? null;
    cell.liveApparentTemperature = finite(cell.apparentTemperature) ?? finite(cell.temperature) ?? null;
    cell.liveHumidity = finite(cell.humidity);
    cell.liveWindSpeed = finite(cell.windSpeed);
    cell.liveWindDirection = finite(cell.windDirection);
    cell.liveCloudCover = finite(cell.cloudCover) ?? 0;
    cell.livePrecipitation = finite(cell.precipitation) ?? 0;
    cell.liveWeatherCode = finite(cell.weatherCode);
    cell.liveIsDay = finite(cell.isDay);
  });
  scenario.liveWeather = {
    ...(scenario.liveWeather ?? {}),
    updatedAt: scenario.cells.find((cell) => cell.time)?.time ?? null,
    mode: "current",
    frameIndex: null
  };
  return scenario;
}

export async function fetchCurrentHeatSnapshot(scenario, {
  fetchImpl = globalThis.fetch,
  signal = null,
  cache = false,
  onProgress = () => {}
} = {}) {
  if (!scenario?.cells?.length) throw new Error("Fit a Heat workspace before loading live conditions.");
  const sampledPoints = representativePoints(scenario.cells);
  const sampledRecords = [];
  const batches = Math.ceil(sampledPoints.length / MAX_BATCH);
  for (let start = 0, batchIndex = 0; start < sampledPoints.length; start += MAX_BATCH, batchIndex += 1) {
    onProgress(`Refreshing live conditions ${batchIndex + 1} of ${batches}...`, (batchIndex + 1) / batches);
    sampledRecords.push(...await fetchCurrentBatch(sampledPoints.slice(start, start + MAX_BATCH), {
      fetchImpl,
      signal,
      cache
    }));
  }
  const records = expandRecords(scenario.cells, sampledPoints, sampledRecords);
  return {
    fetchedAt: new Date().toISOString(),
    sourceTime: sampledRecords.find((record) => record.time)?.time ?? null,
    sampledPointCount: sampledPoints.length,
    records
  };
}

export async function fetchHeatForecast(scenario, {
  hours = 24,
  fetchImpl = globalThis.fetch,
  signal = null,
  cache = true,
  onProgress = () => {}
} = {}) {
  if (!scenario?.cells?.length) throw new Error("Fit a Heat workspace before loading forecast playback.");
  const forecastHours = Math.max(6, Math.min(48, Math.round(hours)));
  const sampledPoints = representativePoints(scenario.cells);
  const responses = [];
  const batches = Math.ceil(sampledPoints.length / MAX_BATCH);
  for (let start = 0, batchIndex = 0; start < sampledPoints.length; start += MAX_BATCH, batchIndex += 1) {
    onProgress(`Loading forecast field ${batchIndex + 1} of ${batches}...`, (batchIndex + 1) / batches);
    responses.push(...await fetchForecastBatch(sampledPoints.slice(start, start + MAX_BATCH), {
      fetchImpl,
      signal,
      cache,
      forecastDays: forecastHours > 24 ? 2 : 1
    }));
  }
  const available = Math.min(
    forecastHours,
    ...responses.map((response) => response?.hourly?.time?.length ?? 0)
  );
  if (!Number.isFinite(available) || available < 2) throw new Error("Open-Meteo did not return enough hourly frames for playback.");
  const frames = [];
  for (let index = 0; index < available; index += 1) {
    const sampledRecords = responses.map((response, pointIndex) => ({
      id: sampledPoints[pointIndex].id,
      ...hourlyRecord(response, index)
    }));
    validatePointRecords(sampledPoints, sampledRecords);
    const records = expandRecords(scenario.cells, sampledPoints, sampledRecords);
    frames.push({
      index,
      time: sampledRecords[0]?.time ?? null,
      records
    });
  }
  return {
    format: "lumos-heat-forecast-v1",
    fetchedAt: new Date().toISOString(),
    hours: available,
    pointCount: scenario.cells.length,
    sampledPointCount: sampledPoints.length,
    frames
  };
}

export function applyLiveSnapshot(scenario, snapshot) {
  if (!scenario?.cells?.length || !snapshot?.records?.length) return scenario;
  const byId = new Map(snapshot.records.map((record) => [record.id, record]));
  scenario.cells.forEach((cell) => {
    const record = byId.get(cell.id);
    if (!record) return;
    cell.liveTemperature = record.temperature;
    cell.liveApparentTemperature = record.apparentTemperature;
    cell.liveHumidity = record.humidity;
    cell.liveWindSpeed = record.windSpeed;
    cell.liveWindDirection = record.windDirection;
    cell.liveCloudCover = record.cloudCover;
    cell.livePrecipitation = record.precipitation;
    cell.liveWeatherCode = record.weatherCode;
    cell.liveIsDay = record.isDay;
  });
  scenario.liveWeather = {
    ...(scenario.liveWeather ?? {}),
    updatedAt: snapshot.sourceTime ?? snapshot.fetchedAt,
    fetchedAt: snapshot.fetchedAt,
    mode: "current",
    frameIndex: null
  };
  return scenario;
}

function blendedValue(left, right, blend) {
  if (!Number.isFinite(left)) return right;
  if (!Number.isFinite(right)) return left;
  return left + (right - left) * blend;
}

export function applyForecastFrame(scenario, forecast, frameIndex, {
  fromFrameIndex = null,
  blend = 1
} = {}) {
  if (!scenario?.cells?.length || !forecast?.frames?.length) return scenario;
  const bounded = Math.max(0, Math.min(forecast.frames.length - 1, Math.round(frameIndex)));
  const target = forecast.frames[bounded];
  const source = Number.isInteger(fromFrameIndex)
    ? forecast.frames[Math.max(0, Math.min(forecast.frames.length - 1, fromFrameIndex))]
    : null;
  const sourceById = source ? new Map(source.records.map((record) => [record.id, record])) : null;
  const targetById = new Map(target.records.map((record) => [record.id, record]));
  const mix = Math.max(0, Math.min(1, Number(blend)));
  scenario.cells.forEach((cell) => {
    const right = targetById.get(cell.id);
    const left = sourceById?.get(cell.id) ?? right;
    if (!right) return;
    cell.liveTemperature = blendedValue(left?.temperature, right.temperature, mix);
    cell.liveApparentTemperature = blendedValue(left?.apparentTemperature, right.apparentTemperature, mix);
    cell.liveHumidity = blendedValue(left?.humidity, right.humidity, mix);
    cell.liveWindSpeed = blendedValue(left?.windSpeed, right.windSpeed, mix);
    cell.liveWindDirection = blendedValue(left?.windDirection, right.windDirection, mix);
    cell.liveCloudCover = blendedValue(left?.cloudCover, right.cloudCover, mix);
    cell.livePrecipitation = blendedValue(left?.precipitation, right.precipitation, mix);
    cell.liveWeatherCode = right.weatherCode;
    cell.liveIsDay = right.isDay;
  });
  scenario.liveWeather = {
    ...(scenario.liveWeather ?? {}),
    updatedAt: target.time,
    fetchedAt: forecast.fetchedAt,
    mode: "forecast",
    frameIndex: bounded,
    frameCount: forecast.frames.length
  };
  return scenario;
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

export function summarizeLiveConditions(scenario) {
  const cells = scenario?.cells ?? [];
  return {
    temperature: mean(cells.map((cell) => cell.liveTemperature)),
    apparentTemperature: mean(cells.map((cell) => cell.liveApparentTemperature)),
    humidity: mean(cells.map((cell) => cell.liveHumidity)),
    windSpeed: mean(cells.map((cell) => cell.liveWindSpeed)),
    precipitation: mean(cells.map((cell) => cell.livePrecipitation)),
    cloudCover: mean(cells.map((cell) => cell.liveCloudCover)),
    updatedAt: scenario?.liveWeather?.updatedAt ?? null
  };
}

export function compareLiveToPlanningSnapshot(scenario) {
  const deltas = (scenario?.cells ?? []).map((cell) => {
    const live = finite(cell.liveApparentTemperature);
    const planned = finite(cell.apparentTemperature);
    return live === null || planned === null ? null : Math.abs(live - planned);
  }).filter(Number.isFinite);
  const meanAbsoluteChangeF = mean(deltas) ?? 0;
  const maximumChangeF = deltas.length ? Math.max(...deltas) : 0;
  return {
    meanAbsoluteChangeF,
    maximumChangeF,
    classification: maximumChangeF >= 5 || meanAbsoluteChangeF >= 2.5
      ? "meaningful"
      : maximumChangeF >= 2.5 || meanAbsoluteChangeF >= 1.2
        ? "moderate"
        : "minor"
  };
}
