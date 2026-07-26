import { cholesky, solveCholesky } from "../bayesian/linalg.js";
import { predictGaussianProcess } from "../bayesian/prediction.js";

export const SOIL_LAB_ANALYTES = Object.freeze({
  composite: { label: "Soil-health composite", unit: "index", surveyField: "soilComposite", kind: "survey" },
  ph: { label: "Soil pH", unit: "pH", surveyField: "soilPh", kind: "survey" },
  organic_matter: { label: "Organic matter", unit: "%", surveyField: "organicMatter", kind: "survey" },
  clay: { label: "Clay content", unit: "%", surveyField: "clayPercent", kind: "survey" },
  available_water: { label: "Available water capacity", unit: "cm/cm", surveyField: "availableWater", kind: "survey" },
  salinity: { label: "Electrical conductivity", unit: "dS/m", surveyField: "electricalConductivity", kind: "survey" },
  lead: { label: "Lead", unit: "mg/kg", surveyField: null, kind: "contaminant" },
  arsenic: { label: "Arsenic", unit: "mg/kg", surveyField: null, kind: "contaminant" },
  cadmium: { label: "Cadmium", unit: "mg/kg", surveyField: null, kind: "contaminant" }
});

export const SOIL_ANALYTE_LIMITS = Object.freeze({
  composite: { min: 0, max: 1.5 },
  ph: { min: 0, max: 14 },
  organic_matter: { min: 0, max: 100 },
  clay: { min: 0, max: 100 },
  available_water: { min: 0, max: 1 },
  salinity: { min: 0, max: 100 },
  lead: { min: 0, max: 1_000_000 },
  arsenic: { min: 0, max: 100_000 },
  cadmium: { min: 0, max: 100_000 }
});

export const SOIL_IMPORT_QA_VERSION = "1.7";

const DEFAULT_LENGTH_GRID = [0.65, 0.85, 1, 1.2, 1.45];
const DEFAULT_NOISE_GRID = [0.025, 0.045, 0.07, 0.11, 0.16];
const EPSILON = 1e-12;

function clamp(value, low = 0, high = 1) { return Math.max(low, Math.min(high, value)); }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function mean(values) { const usable = values.filter(Number.isFinite); return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0; }
function rmse(errors) { return Math.sqrt(mean(errors.map((error) => error * error))); }
function standardDeviation(values) { const center = mean(values); return Math.sqrt(mean(values.map((value) => (value - center) ** 2))); }
function percentile(values, probability) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return 0;
  const position = clamp(probability) * (usable.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return usable[lower] + (usable[upper] - usable[lower]) * (position - lower);
}
function simpleHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value); if (row.some((entry) => entry.trim())) rows.push(row); row = []; value = ""; }
    else if (character !== "\r") value += character;
  }
  row.push(value);
  if (row.some((entry) => entry.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_"));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const ANALYTE_ALIASES = Object.freeze({
  soil_ph: "ph",
  acidity: "ph",
  om: "organic_matter",
  organicmatter: "organic_matter",
  ec: "salinity",
  electrical_conductivity: "salinity",
  pb: "lead",
  as: "arsenic",
  cd: "cadmium",
  awc: "available_water"
});

function normalizedAnalyteToken(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_+|_+$/g, "");
}

function resolveAnalyte(value, fallback = "ph") {
  const explicit = value !== null && value !== undefined && String(value).trim() !== "";
  const token = normalizedAnalyteToken(explicit ? value : fallback);
  const resolved = ANALYTE_ALIASES[token] ?? token;
  if (SOIL_LAB_ANALYTES[resolved]) return { analyte: resolved, recognized: true, explicit };
  return { analyte: fallback, recognized: !explicit, explicit };
}

function normalizeAnalyte(value, fallback = "ph") {
  return resolveAnalyte(value, fallback).analyte;
}

function normalizeUnit(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll("µ", "u").replaceAll("³", "3");
}

function parseReportedNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? { value, censored: false } : { value: null, censored: false };
  const text = String(value ?? "").trim();
  if (!text) return { value: null, censored: false };
  const lower = text.toLowerCase();
  const censored = /^\s*(?:<|<=|nd\b|non[- ]?detect)/i.test(text);
  const match = text.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) return { value: null, censored };
  const numeric = Number(match[0]);
  return { value: Number.isFinite(numeric) ? numeric : null, censored };
}

function convertValue(value, unit, analyte) {
  const numeric = finite(value);
  if (numeric === null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (["lead", "arsenic", "cadmium"].includes(analyte)) {
    if (!normalizedUnit || ["mg/kg", "mgkg", "ppm", "mg kg-1", "mg_kg"].includes(normalizedUnit)) return numeric;
    if (["ug/g", "ug g-1", "ug_g"].includes(normalizedUnit)) return numeric;
    if (["ug/kg", "ugkg", "ppb"].includes(normalizedUnit)) return numeric / 1000;
    return null;
  }
  if (["organic_matter", "clay"].includes(analyte)) {
    if (!normalizedUnit || ["%", "percent", "pct"].includes(normalizedUnit)) return numeric;
    if (["fraction", "ratio"].includes(normalizedUnit)) return numeric * 100;
    return null;
  }
  if (analyte === "available_water") {
    if (!normalizedUnit || ["cm/cm", "cm3/cm3", "fraction", "ratio"].includes(normalizedUnit)) return numeric;
    if (["%", "percent", "pct"].includes(normalizedUnit)) return numeric / 100;
    return null;
  }
  if (analyte === "salinity") {
    if (!normalizedUnit || ["ds/m", "dsm", "ms/cm", "mscm"].includes(normalizedUnit)) return numeric;
    return null;
  }
  return numeric;
}

function normalizeDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function boundsPosition(lat, lng, bounds) {
  if (!bounds) return { x: null, y: null, inside: true };
  const x = (lng - bounds.minLng) / Math.max(EPSILON, bounds.maxLng - bounds.minLng);
  const y = (lat - bounds.minLat) / Math.max(EPSILON, bounds.maxLat - bounds.minLat);
  return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
}

function selectedDepthRange(selectedDepth) {
  if (!selectedDepth || typeof selectedDepth !== "object") return null;
  const top = finite(selectedDepth.top);
  const bottom = finite(selectedDepth.bottom);
  return top !== null && bottom !== null && bottom > top ? { top, bottom } : null;
}

function depthOverlap(top, bottom, selectedDepth) {
  if (!selectedDepth) return { overlap: bottom - top, fraction: 1 };
  const overlap = Math.max(0, Math.min(bottom, selectedDepth.bottom) - Math.max(top, selectedDepth.top));
  return { overlap, fraction: overlap / Math.max(EPSILON, bottom - top) };
}

function reasonSummary(entries) {
  return entries.reduce((counts, entry) => {
    const key = entry.code ?? "other";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function buildSoilImportQaReport(parsed = {}) {
  const samples = parsed.samples ?? [];
  const rejected = parsed.rejected ?? [];
  const warnings = parsed.warnings ?? [];
  return {
    version: SOIL_IMPORT_QA_VERSION,
    imported: parsed.imported ?? samples.length + rejected.length,
    accepted: samples.length,
    rejected: rejected.length,
    warningCount: warnings.length,
    censored: samples.filter((sample) => sample.censored).length,
    stale: samples.filter((sample) => sample.stale).length,
    partiallyOverlappingDepth: samples.filter((sample) => sample.depthOverlapFraction < 0.999).length,
    rejectionReasons: reasonSummary(rejected),
    warningReasons: reasonSummary(warnings)
  };
}

export function parseSoilLabText(text, {
  defaultAnalyte = "ph",
  scenarioBounds = null,
  selectedDepth = null,
  sourceName = "Imported laboratory file",
  now = Date.now()
} = {}) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("The selected laboratory file is empty.");
  let records;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    records = Array.isArray(parsed) ? parsed : (parsed.samples ?? parsed.records ?? []);
  } else records = parseCsv(trimmed);
  if (!Array.isArray(records)) throw new Error("Laboratory data must be a CSV row set or a JSON array.");

  const samples = [];
  const rejected = [];
  const warnings = [];
  const seenIds = new Set();
  const seenFingerprints = new Set();
  const activeDepth = selectedDepthRange(selectedDepth);
  const reject = (row, code, reason) => rejected.push({ row, code, reason });
  const warn = (row, code, reason) => warnings.push({ row, code, reason });

  records.forEach((record, index) => {
    const row = index + 2;
    const analyteResolution = resolveAnalyte(record.analyte ?? record.target ?? record.parameter, defaultAnalyte);
    if (!analyteResolution.recognized) {
      reject(row, "unknown_analyte", `Unrecognized analyte: ${record.analyte ?? record.target ?? record.parameter}.`);
      return;
    }
    const analyte = analyteResolution.analyte;
    const lat = finite(record.lat ?? record.latitude ?? record.y_lat);
    const lng = finite(record.lng ?? record.lon ?? record.longitude ?? record.x_lon);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      reject(row, "invalid_coordinates", "Latitude or longitude is missing or outside the valid geographic range.");
      return;
    }

    const reported = parseReportedNumber(record.value ?? record.result ?? record.concentration ?? record.measurement);
    const rawDetectionLimit = parseReportedNumber(record.detection_limit ?? record.reporting_limit ?? record.mdl).value;
    const convertedDetectionLimit = rawDetectionLimit === null ? null : convertValue(rawDetectionLimit, record.unit ?? record.units, analyte);
    let observedValue = reported.value === null ? null : convertValue(reported.value, record.unit ?? record.units, analyte);
    const censored = reported.censored || /\b(?:nd|non[- ]?detect|below detection)\b/i.test(String(record.qualifier ?? record.qa_flag ?? record.status ?? ""));
    if (censored) {
      const censorLimit = convertedDetectionLimit ?? observedValue;
      if (censorLimit === null) {
        reject(row, "missing_detection_limit", "A non-detect result requires a numeric result or detection limit.");
        return;
      }
      observedValue = censorLimit / 2;
    }
    if (observedValue === null) {
      reject(row, "incompatible_value_or_unit", "Value or unit is missing or incompatible with the selected analyte.");
      return;
    }
    const plausible = SOIL_ANALYTE_LIMITS[analyte];
    if (plausible && (observedValue < plausible.min || observedValue > plausible.max)) {
      reject(row, "implausible_value", `${SOIL_LAB_ANALYTES[analyte].label} is outside the broad QA range ${plausible.min}–${plausible.max} ${SOIL_LAB_ANALYTES[analyte].unit}.`);
      return;
    }

    const position = boundsPosition(lat, lng, scenarioBounds);
    if (!position.inside) {
      reject(row, "outside_extent", "Sample lies outside the currently fitted model extent.");
      return;
    }

    const qaFlag = String(record.qa_flag ?? record.qualifier ?? record.status ?? "accepted").trim().toLowerCase();
    if (/reject|invalid|failed|contaminated blank/.test(qaFlag)) {
      reject(row, "qa_rejected", `Rejected by QA flag: ${qaFlag}.`);
      return;
    }

    const depthTopCm = finite(record.depth_top_cm ?? record.depth_top ?? record.top_cm) ?? activeDepth?.top ?? 0;
    const depthBottomCm = finite(record.depth_bottom_cm ?? record.depth_bottom ?? record.bottom_cm) ?? activeDepth?.bottom ?? Math.max(depthTopCm + 15, 15);
    if (depthTopCm < 0 || depthBottomCm <= depthTopCm || depthBottomCm > 500) {
      reject(row, "invalid_depth", "Depth interval must have 0 ≤ top < bottom ≤ 500 cm.");
      return;
    }
    const overlap = depthOverlap(depthTopCm, depthBottomCm, activeDepth);
    if (activeDepth && overlap.overlap <= 0) {
      reject(row, "outside_depth", `Sample depth ${depthTopCm}–${depthBottomCm} cm does not overlap the active ${activeDepth.top}–${activeDepth.bottom} cm interval.`);
      return;
    }

    const sampledAt = normalizeDate(record.sample_date ?? record.date ?? record.sampled_at);
    if ((record.sample_date ?? record.date ?? record.sampled_at) && !sampledAt) {
      reject(row, "invalid_date", "Sample date could not be parsed.");
      return;
    }
    const timestamp = sampledAt ? Date.parse(sampledAt) : null;
    if (timestamp !== null && timestamp > now + 48 * 60 * 60 * 1000) {
      reject(row, "future_date", "Sample date is more than 48 hours in the future.");
      return;
    }
    const ageYears = timestamp === null ? null : Math.max(0, (now - timestamp) / (365.25 * 24 * 60 * 60 * 1000));
    const stale = ageYears !== null && ageYears > 10;
    if (!sampledAt) warn(row, "missing_date", "No sample date was supplied; temporal comparability cannot be audited.");
    else if (stale) warn(row, "stale_sample", `Sample is approximately ${ageYears.toFixed(1)} years old and receives reduced reliability.`);
    if (censored) warn(row, "censored_result", "Non-detect result was represented as one-half of the reporting limit and given higher uncertainty.");
    if (overlap.fraction < 0.999) warn(row, "partial_depth_overlap", "Sample only partially overlaps the selected model depth and receives reduced reliability.");

    const sampleId = String(record.sample_id ?? record.id ?? `sample-${index + 1}`).trim() || `sample-${index + 1}`;
    const idKey = sampleId.toLowerCase();
    const fingerprint = [analyte, lat.toFixed(6), lng.toFixed(6), depthTopCm.toFixed(2), depthBottomCm.toFixed(2), sampledAt ?? "undated"].join(":");
    if (seenIds.has(idKey) || seenFingerprints.has(fingerprint)) {
      reject(row, "duplicate_sample", `Duplicate sample identifier or analyte/location/depth/date record: ${sampleId}.`);
      return;
    }
    seenIds.add(idKey);
    seenFingerprints.add(fingerprint);

    let reliability = clamp(finite(record.reliability) ?? (/estimated|j flag|qualified/.test(qaFlag) ? 0.68 : 0.92), 0.15, 1);
    if (censored) reliability *= 0.82;
    if (stale) reliability *= Math.max(0.55, 1 - (ageYears - 10) * 0.025);
    reliability *= Math.max(0.5, overlap.fraction);
    reliability = clamp(reliability, 0.15, 1);

    const sensorNoiseBase = convertedDetectionLimit !== null
      ? Math.max(convertedDetectionLimit * (censored ? 0.5 : 0.18), Math.abs(observedValue) * 0.025)
      : Math.max(Math.abs(observedValue) * (censored ? 0.12 : 0.035), analyte === "ph" ? 0.03 : 0.01);
    samples.push({
      id: String(record.sample_id ?? record.id ?? `lab-${simpleHash(`${lat}:${lng}:${analyte}:${index}`)}`),
      sampleId,
      analyte,
      analyteLabel: SOIL_LAB_ANALYTES[analyte].label,
      unit: SOIL_LAB_ANALYTES[analyte].unit,
      observedValue,
      reportedValue: reported.value,
      lat,
      lng,
      x: position.x,
      y: position.y,
      depthTopCm,
      depthBottomCm,
      depthOverlapFraction: overlap.fraction,
      sampledAt,
      ageYears,
      stale,
      detectionLimit: convertedDetectionLimit,
      censored,
      qaFlag: qaFlag || "accepted",
      reliability,
      feasibility: 1,
      sensorNoise: sensorNoiseBase / Math.max(reliability, 0.25),
      source: sourceName,
      sourceType: "laboratory_sample",
      requiresFieldVerification: false
    });
  });
  const parsed = { samples, rejected, warnings, imported: records.length };
  parsed.summary = buildSoilImportQaReport(parsed);
  return parsed;
}

function nearestCell(point, cells) {
  let best = null;
  let bestDistance = Infinity;
  for (const cell of cells ?? []) {
    const distance = (cell.x - point.x) ** 2 + (cell.y - point.y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = cell; }
  }
  return best;
}

function surveyValue(point, analyte) {
  const field = SOIL_LAB_ANALYTES[analyte]?.surveyField;
  return field && Number.isFinite(point?.[field]) ? point[field] : null;
}

function priorStatistics(points, observations, analyte) {
  const survey = points.map((point) => surveyValue(point, analyte)).filter(Number.isFinite);
  const observed = observations.map((entry) => entry.observedValue).filter(Number.isFinite);
  const center = survey.length ? mean(survey) : observed.length ? percentile(observed, 0.5) : 0;
  const spread = Math.max(standardDeviation(survey), standardDeviation(observed), Math.abs(center) * 0.08, 0.05);
  return { center, spread };
}

function featureVector(point, analyte, statistics) {
  const survey = surveyValue(point, analyte);
  return new Float64Array([
    1,
    survey === null ? 0 : (survey - statistics.center) / Math.max(statistics.spread, 1e-6),
    (point.disturbancePressure ?? 0) - 0.25,
    (point.landClass ?? 0.5) - 0.5,
    (point.exposure ?? 0.5) - 0.5,
    (point.vulnerability ?? 0.5) - 0.5,
    (point.ecology ?? 0.5) - 0.5
  ]);
}

export function fitSoilTrend(observations, analyte, points = observations, ridge = 0.75) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  const statistics = priorStatistics(points, usable, analyte);
  const dimension = 7;
  const normal = Array.from({ length: dimension }, () => new Float64Array(dimension));
  const target = new Float64Array(dimension);
  for (const observation of usable) {
    const features = featureVector(observation, analyte, statistics);
    const baseline = surveyValue(observation, analyte) ?? statistics.center;
    const residual = observation.observedValue - baseline;
    const weight = clamp(observation.reliability ?? 0.9, 0.15, 1);
    for (let row = 0; row < dimension; row += 1) {
      target[row] += weight * features[row] * residual;
      for (let column = 0; column < dimension; column += 1) normal[row][column] += weight * features[row] * features[column];
    }
  }
  for (let index = 0; index < dimension; index += 1) normal[index][index] += index === 0 ? ridge * 0.08 : ridge;
  const coefficients = usable.length ? solveCholesky(cholesky(normal), target) : new Float64Array(dimension);
  const predict = (point) => {
    const baseline = surveyValue(point, analyte) ?? statistics.center;
    const features = featureVector(point, analyte, statistics);
    let adjustment = 0;
    for (let index = 0; index < coefficients.length; index += 1) adjustment += coefficients[index] * features[index];
    return Math.max(0, baseline + adjustment);
  };
  const residualScale = Math.max(rmse(usable.map((entry) => entry.observedValue - predict(entry))), standardDeviation(usable.map((entry) => entry.observedValue)) * 0.12, Math.abs(statistics.center) * 0.015, 0.025);
  return { coefficients, residualScale, statistics, observationsUsed: usable.length, predict };
}

function residualObservations(observations, trend) {
  return observations.map((observation) => ({
    ...observation,
    observedValue: (observation.observedValue - trend.predict(observation)) / trend.residualScale,
    sensorNoise: (observation.sensorNoise ?? 0) / trend.residualScale,
    priorMean: 0
  }));
}

export function predictSoilField(points, observations, domain, { analyte = "ph", lengthScaleMultiplier = 1, measurementNoise = 0.06, trendRidge = 0.75 } = {}) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  const trend = fitSoilTrend(usable, analyte, points, trendRidge);
  const prediction = predictGaussianProcess({
    predictionPoints: points.map((point) => ({ ...point, priorMean: 0 })),
    observations: residualObservations(usable, trend),
    domain,
    modelSettings: { lengthScaleMultiplier, measurementNoise },
    priorMean: () => 0
  });
  const means = new Float64Array(points.length);
  const variances = new Float64Array(points.length);
  for (let index = 0; index < points.length; index += 1) {
    means[index] = trend.predict(points[index]) + prediction.means[index] * trend.residualScale;
    variances[index] = prediction.variances[index] * trend.residualScale * trend.residualScale;
  }
  return { means, variances, trend, observationsUsed: prediction.observationsUsed };
}

function spatialFold(point, folds, seed = 0) {
  const xBand = Math.min(5, Math.floor(clamp(point.x) * 6));
  const yBand = Math.min(5, Math.floor(clamp(point.y) * 6));
  return (xBand * 7 + yBand * 11 + xBand * yBand + seed) % folds;
}

function regressionMetrics(actual, predicted, variances = []) {
  const errors = actual.map((value, index) => predicted[index] - value);
  const actualMean = mean(actual);
  const totalSquares = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const residualSquares = errors.reduce((sum, value) => sum + value * value, 0);
  let covered = 0;
  let intervalWidth = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const width = 1.96 * Math.sqrt(Math.max(0, variances[index] ?? 0));
    intervalWidth += 2 * width;
    if (actual[index] >= predicted[index] - width && actual[index] <= predicted[index] + width) covered += 1;
  }
  return {
    count: actual.length,
    mae: mean(errors.map(Math.abs)),
    rmse: rmse(errors),
    bias: mean(errors),
    r2: totalSquares > EPSILON ? 1 - residualSquares / totalSquares : 0,
    coverage95: actual.length ? covered / actual.length : 0,
    meanIntervalWidth95: actual.length ? intervalWidth / actual.length : 0
  };
}

function nearestPrediction(testing, training) {
  return testing.map((test) => {
    let best = training[0];
    let bestDistance = Infinity;
    for (const candidate of training) {
      const distance = (test.x - candidate.x) ** 2 + (test.y - candidate.y) ** 2;
      if (distance < bestDistance) { bestDistance = distance; best = candidate; }
    }
    return best?.observedValue ?? 0;
  });
}

function idwPrediction(testing, training) {
  return testing.map((test) => {
    let weighted = 0;
    let weights = 0;
    for (const candidate of training) {
      const distance = Math.hypot(test.x - candidate.x, test.y - candidate.y);
      if (distance < 1e-9) return candidate.observedValue;
      const weight = 1 / Math.max(1e-6, distance * distance);
      weighted += weight * candidate.observedValue;
      weights += weight;
    }
    return weights ? weighted / weights : 0;
  });
}

export function crossValidateSoil(observations, domain, settings = {}, folds = 4, seed = 0) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  if (usable.length < 6) return { available: false, reason: "At least six compatible laboratory samples are required.", count: usable.length };
  const records = [];
  for (let fold = 0; fold < folds; fold += 1) {
    const testing = usable.filter((entry) => spatialFold(entry, folds, seed) === fold);
    const training = usable.filter((entry) => spatialFold(entry, folds, seed) !== fold);
    if (!testing.length || training.length < 3) continue;
    const prediction = predictSoilField(testing, training, domain, settings);
    const trend = fitSoilTrend(training, settings.analyte ?? "ph", usable, settings.trendRidge ?? 0.75);
    const nearest = nearestPrediction(testing, training);
    const idw = idwPrediction(testing, training);
    testing.forEach((entry, index) => records.push({
      actual: entry.observedValue,
      predicted: prediction.means[index],
      variance: prediction.variances[index],
      surveyTrend: trend.predict(entry),
      nearest: nearest[index],
      idw: idw[index],
      vulnerability: entry.vulnerability ?? 0.5,
      exposure: entry.exposure ?? 0.5
    }));
  }
  if (!records.length) return { available: false, reason: "Spatial folds could not be formed from these sample locations.", count: usable.length };
  const actual = records.map((entry) => entry.actual);
  const groups = new Map();
  for (const record of records) {
    const label = `${record.vulnerability >= 0.5 ? "Higher" : "Lower"} vulnerability · ${record.exposure >= 0.5 ? "higher" : "lower"} exposure`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(record);
  }
  return {
    available: true,
    count: records.length,
    lumos: regressionMetrics(actual, records.map((entry) => entry.predicted), records.map((entry) => entry.variance)),
    surveyTrend: regressionMetrics(actual, records.map((entry) => entry.surveyTrend)),
    nearest: regressionMetrics(actual, records.map((entry) => entry.nearest)),
    idw: regressionMetrics(actual, records.map((entry) => entry.idw)),
    groups: [...groups.entries()].map(([group, entries]) => ({
      group,
      count: entries.length,
      mae: mean(entries.map((entry) => Math.abs(entry.predicted - entry.actual))),
      rmse: rmse(entries.map((entry) => entry.predicted - entry.actual)),
      bias: mean(entries.map((entry) => entry.predicted - entry.actual))
    }))
  };
}

export function calibrateSoilModel(observations, domain, { analyte = "ph", lengthGrid = DEFAULT_LENGTH_GRID, noiseGrid = DEFAULT_NOISE_GRID, folds = 4 } = {}) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  if (usable.length < 6) return { available: false, reason: "At least six compatible laboratory samples are required.", count: usable.length };
  const candidates = [];
  for (const lengthScaleMultiplier of lengthGrid) {
    for (const measurementNoise of noiseGrid) {
      const validation = crossValidateSoil(usable, domain, { analyte, lengthScaleMultiplier, measurementNoise }, folds);
      if (!validation.available) continue;
      const score = validation.lumos.rmse * (1 + 0.55 * Math.abs(validation.lumos.coverage95 - 0.95));
      candidates.push({ lengthScaleMultiplier, measurementNoise, score, validation });
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  return { available: Boolean(candidates.length), count: usable.length, selected: candidates[0] ?? null, candidates };
}

export function createLockedSoilSplit(observations, fraction = 0.25, seed = 1601) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  const ordered = [...usable].sort((left, right) => simpleHash(`${seed}:${left.sampleId ?? left.id}:${left.x}:${left.y}`) - simpleHash(`${seed}:${right.sampleId ?? right.id}:${right.x}:${right.y}`));
  const lockedCount = Math.max(1, Math.min(ordered.length - 3, Math.round(ordered.length * fraction)));
  return { development: ordered.slice(lockedCount), locked: ordered.slice(0, lockedCount), seed, fraction };
}

export function runSoilValidationExperiment(observations, domain, settings = {}, { lockedFraction = 0.25, seed = 1601 } = {}) {
  const usable = observations.filter((entry) => Number.isFinite(entry.observedValue));
  if (usable.length < 8) return { available: false, reason: "At least eight compatible laboratory samples are required for a locked validation experiment.", count: usable.length };
  const split = createLockedSoilSplit(usable, lockedFraction, seed);
  const prediction = predictSoilField(split.locked, split.development, domain, settings);
  const trend = fitSoilTrend(split.development, settings.analyte ?? "ph", usable, settings.trendRidge ?? 0.75);
  const nearest = nearestPrediction(split.locked, split.development);
  const idw = idwPrediction(split.locked, split.development);
  const actual = split.locked.map((entry) => entry.observedValue);
  return {
    available: true,
    seed,
    developmentCount: split.development.length,
    lockedCount: split.locked.length,
    locked: {
      lumos: regressionMetrics(actual, [...prediction.means], [...prediction.variances]),
      surveyTrend: regressionMetrics(actual, split.locked.map((entry) => trend.predict(entry))),
      nearest: regressionMetrics(actual, nearest),
      idw: regressionMetrics(actual, idw)
    }
  };
}

function attachContext(samples, scenario) {
  return samples.map((sample) => {
    const cell = nearestCell(sample, scenario.cells);
    return {
      ...sample,
      soilPh: cell?.soilPh ?? null,
      organicMatter: cell?.organicMatter ?? null,
      clayPercent: cell?.clayPercent ?? null,
      availableWater: cell?.availableWater ?? null,
      electricalConductivity: cell?.electricalConductivity ?? null,
      soilComposite: cell?.soilComposite ?? null,
      disturbancePressure: cell?.disturbancePressure ?? 0,
      landClass: cell?.landClass ?? 0.5,
      ecology: cell?.ecology ?? 0.5,
      vulnerability: cell?.vulnerability ?? 0.5,
      exposure: cell?.exposure ?? 0.5,
      communityGroup: cell?.communityGroup ?? null,
      priorMean: surveyValue(cell, sample.analyte)
    };
  });
}

function normalizedRisk(values, analyte) {
  const low = percentile(values, 0.08);
  const high = percentile(values, 0.92);
  return values.map((value) => {
    const normalized = clamp((value - low) / Math.max(EPSILON, high - low));
    if (["organic_matter", "available_water"].includes(analyte)) return 1 - normalized;
    if (analyte === "ph") return clamp(Math.abs(value - 6.5) / Math.max(1.2, high - low));
    return normalized;
  });
}

export function attachSoilInference(scenario, domain, { samples = scenario?.observations ?? [], analyte = scenario?.model?.property ?? "ph", calibration = null, lockedSeed = 1601 } = {}) {
  if (!scenario?.cells?.length) throw new Error("A fitted Soil scenario is required.");
  const compatible = attachContext(samples.filter((entry) => normalizeAnalyte(entry.analyte, analyte) === analyte), scenario);
  scenario.observations = compatible;
  scenario.model.labSampleCount = compatible.length;
  scenario.model.labAnalyte = analyte;
  scenario.model.labAnalyteLabel = SOIL_LAB_ANALYTES[analyte]?.label ?? analyte;
  scenario.model.labAnalyteUnit = SOIL_LAB_ANALYTES[analyte]?.unit ?? "";
  if (compatible.length < 3) {
    scenario.model.soilInference = null;
    scenario.model.soilValidation = { available: false, count: compatible.length, reason: "At least three compatible laboratory samples are required for posterior conditioning." };
    scenario.cells.forEach((cell) => { cell.posteriorSoilValue = null; cell.predictiveSoilUncertainty = null; cell.soilModelResidual = null; });
    return scenario;
  }
  const resolvedCalibration = calibration?.available ? calibration : calibrateSoilModel(compatible, domain, { analyte });
  const settings = resolvedCalibration?.selected
    ? { analyte, lengthScaleMultiplier: resolvedCalibration.selected.lengthScaleMultiplier, measurementNoise: resolvedCalibration.selected.measurementNoise }
    : { analyte, lengthScaleMultiplier: 1, measurementNoise: 0.07 };
  const prediction = predictSoilField(scenario.cells, compatible, domain, settings);
  const posteriorValues = [...prediction.means];
  const risks = normalizedRisk(posteriorValues, analyte);
  scenario.cells.forEach((cell, index) => {
    const prior = surveyValue(cell, analyte) ?? prediction.trend.statistics.center;
    cell.posteriorSoilValue = posteriorValues[index];
    cell.predictiveSoilUncertainty = Math.sqrt(Math.max(0, prediction.variances[index]));
    cell.soilModelResidual = posteriorValues[index] - prior;
    cell.propertyValue = posteriorValues[index];
    cell.risk = clamp(0.78 * risks[index] + 0.12 * (cell.disturbancePressure ?? 0) + 0.10 * (cell.vulnerability ?? 0.5));
    cell.uncertainty = clamp(0.18 + 0.62 * (cell.predictiveSoilUncertainty / Math.max(prediction.trend.residualScale * 2, EPSILON)) + 0.20 * (1 - (cell.soilDataConfidence ?? 0.2)));
    cell.communityPriority = clamp(0.34 * cell.vulnerability + 0.22 * cell.exposure + 0.32 * cell.risk + 0.12 * (cell.disturbancePressure ?? 0));
  });
  scenario.model.soilInference = {
    analyte,
    analyteLabel: SOIL_LAB_ANALYTES[analyte]?.label ?? analyte,
    unit: SOIL_LAB_ANALYTES[analyte]?.unit ?? "",
    observationsUsed: compatible.length,
    residualScale: prediction.trend.residualScale,
    lengthScaleMultiplier: settings.lengthScaleMultiplier,
    measurementNoise: settings.measurementNoise,
    calibrationCandidates: resolvedCalibration?.candidates?.length ?? 0
  };
  scenario.model.soilCalibration = resolvedCalibration;
  scenario.model.soilValidation = runSoilValidationExperiment(compatible, domain, settings, { seed: lockedSeed });
  scenario.sourceMetadata ??= { sources: [], layers: [], limitations: [] };
  if (!scenario.sourceMetadata.sources.some((source) => source.label === "Imported laboratory samples")) {
    scenario.sourceMetadata.sources.push({ label: "Imported laboratory samples", agency: "User-supplied laboratory or field program", role: "Target-specific observations used for posterior mean and uncertainty conditioning." });
  }
  scenario.sourceMetadata.layers = (scenario.sourceMetadata.layers ?? []).filter((layer) => layer.label !== "Laboratory-conditioned Soil field");
  scenario.sourceMetadata.layers.push({
    label: "Laboratory-conditioned Soil field",
    source: `${compatible.length} compatible imported samples`,
    status: scenario.model.soilValidation.available ? "conditioned and locked-validated" : "conditioned; locked validation unavailable",
    resolution: "Continuous posterior on the active LUMOS evaluation mesh",
    confidence: scenario.model.soilValidation.available ? "medium" : "low-to-medium",
    interpretation: `Posterior ${SOIL_LAB_ANALYTES[analyte]?.label ?? analyte} estimate in ${SOIL_LAB_ANALYTES[analyte]?.unit ?? "source units"}; not a regulatory determination.`
  });
  return scenario;
}

export function soilLabTemplateCsv() {
  return [
    "sample_id,latitude,longitude,analyte,value,unit,depth_top_cm,depth_bottom_cm,sample_date,detection_limit,qa_flag,reliability",
    "S-001,40.7128,-74.0060,lead,42.5,mg/kg,0,15,2026-06-15,0.5,accepted,0.95",
    "S-002,40.7165,-74.0120,lead,18.2,mg/kg,0,15,2026-06-15,0.5,accepted,0.95"
  ].join("\n");
}
