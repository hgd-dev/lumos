import { PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";

export const HOST_INVENTORY_SCHEMA_VERSION = "1.0";

export const HOST_REVIEW_POLICIES = Object.freeze({
  "verified-only": Object.freeze({ label: "Verified only", allowed: Object.freeze(["verified"]) }),
  "verified-or-conditional": Object.freeze({ label: "Verified + conditional", allowed: Object.freeze(["verified", "conditional"]) }),
  "all-not-denied": Object.freeze({ label: "Include unresolved", allowed: Object.freeze(["verified", "conditional", "unresolved"]) })
});

export const HOST_CATEGORIES = Object.freeze([
  "municipal", "school", "park", "transit", "community", "utility",
  "treatment", "industrial-edge", "watershed-access", "background"
]);

const STATUS_ALIASES = Object.freeze({
  yes: "verified", approved: "verified", confirmed: "verified", complete: "verified", verified: "verified",
  conditional: "pending", review: "pending", pending: "pending", requested: "pending",
  no: "denied", rejected: "denied", unavailable: "denied", denied: "denied",
  na: "not-required", "n/a": "not-required", none: "not-required", "not required": "not-required", "not-required": "not-required",
  unknown: "unverified", unresolved: "unverified", unverified: "unverified", "": "unverified"
});

const STATUS_SCORE = Object.freeze({
  verified: 0.96,
  "not-required": 0.86,
  pending: 0.64,
  unverified: 0.46,
  denied: 0
});

const CATEGORY_LABELS = Object.freeze({
  municipal: "Municipal facility",
  school: "School or childcare",
  park: "Park or recreation",
  transit: "Transit or mobility",
  community: "Community facility",
  utility: "Utility infrastructure",
  treatment: "Treatment facility",
  "industrial-edge": "Industrial-edge property",
  "watershed-access": "Watershed access",
  background: "Background/reference site"
});

const CATEGORY_SUITABILITY = Object.freeze({
  heat: Object.freeze({ municipal: 0.82, school: 0.96, park: 0.94, transit: 0.84, community: 0.91, utility: 0.58, treatment: 0.46, "industrial-edge": 0.48, "watershed-access": 0.62, background: 0.70 }),
  air: Object.freeze({ municipal: 0.76, school: 0.72, park: 0.67, transit: 0.96, community: 0.68, utility: 0.83, treatment: 0.72, "industrial-edge": 0.94, "watershed-access": 0.50, background: 0.90 }),
  soil: Object.freeze({ municipal: 0.68, school: 0.93, park: 0.96, transit: 0.44, community: 0.92, utility: 0.58, treatment: 0.55, "industrial-edge": 0.95, "watershed-access": 0.75, background: 0.65 }),
  water: Object.freeze({ municipal: 0.62, school: 0.45, park: 0.69, transit: 0.34, community: 0.48, utility: 0.91, treatment: 0.98, "industrial-edge": 0.68, "watershed-access": 0.98, background: 0.78 })
});

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, Number(value) || 0));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function slug(value, fallback = "host") {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeStatus(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return STATUS_ALIASES[key] ?? "unverified";
}

function normalizeCategory(value) {
  const key = slug(value, "community");
  return HOST_CATEGORIES.includes(key) ? key : "community";
}

function normalizeDomains(value) {
  if (Array.isArray(value)) {
    const keys = value.map((entry) => String(entry).trim().toLowerCase()).filter((entry) => PUBLIC_DOMAIN_KEYS.includes(entry));
    return [...new Set(keys.length ? keys : PUBLIC_DOMAIN_KEYS)];
  }
  const keys = String(value ?? "").split(/[|;,\s]+/).map((entry) => entry.trim().toLowerCase()).filter((entry) => PUBLIC_DOMAIN_KEYS.includes(entry));
  return [...new Set(keys.length ? keys : PUBLIC_DOMAIN_KEYS)];
}

function reviewStatus(record) {
  const critical = [record.permissionStatus, record.accessStatus, record.safetyStatus, record.maintenanceStatus];
  if (critical.includes("denied")) return "infeasible";
  const complete = critical.every((status) => status === "verified" || status === "not-required");
  if (complete) return "verified";
  if (critical.some((status) => status === "verified" || status === "pending")) return "conditional";
  return "unresolved";
}

function statusLabel(status) {
  return ({ verified: "Verified", conditional: "Conditional", unresolved: "Unresolved", infeasible: "Infeasible" })[status] ?? "Unresolved";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const nonempty = rows.filter((entry) => entry.some((value) => String(value).trim() !== ""));
  if (!nonempty.length) return [];
  const headers = nonempty[0].map((value) => slug(value, "column").replaceAll("-", "_"));
  return nonempty.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function valueFrom(record, ...keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return undefined;
}

function defaultMetric(record, key, fallback) {
  return clamp(finite(valueFrom(record, key, key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)), fallback));
}

function normalizeRecord(raw, index, seenIds) {
  const latitude = finite(valueFrom(raw, "latitude", "lat"));
  const longitude = finite(valueFrom(raw, "longitude", "lng", "lon"));
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { rejected: true, reason: "Missing or invalid latitude/longitude.", row: index + 2 };
  }
  const category = normalizeCategory(valueFrom(raw, "category", "host_category", "type"));
  const baseId = slug(valueFrom(raw, "host_id", "id", "site_id", "label", "name"), `inventory-host-${index + 1}`);
  let id = baseId;
  let suffix = 2;
  while (seenIds.has(id)) id = `${baseId}-${suffix++}`;
  seenIds.add(id);
  const permissionStatus = normalizeStatus(valueFrom(raw, "permission_status", "permission"));
  const accessStatus = normalizeStatus(valueFrom(raw, "access_status", "access_review"));
  const powerStatus = normalizeStatus(valueFrom(raw, "power_status", "power_review"));
  const safetyStatus = normalizeStatus(valueFrom(raw, "safety_status", "safety_review"));
  const maintenanceStatus = normalizeStatus(valueFrom(raw, "maintenance_status", "maintenance_review"));
  const eligibleDomains = normalizeDomains(valueFrom(raw, "eligible_domains", "domains", "domain"));
  const access = defaultMetric(raw, "access", STATUS_SCORE[accessStatus]);
  const power = defaultMetric(raw, "power", STATUS_SCORE[powerStatus]);
  const maintenance = defaultMetric(raw, "maintenance", STATUS_SCORE[maintenanceStatus]);
  const reliability = defaultMetric(raw, "reliability", clamp(0.42 + 0.20 * access + 0.18 * power + 0.20 * maintenance));
  const vulnerability = defaultMetric(raw, "vulnerability", 0.5);
  const exposure = defaultMetric(raw, "exposure", 0.5);
  const ecology = defaultMetric(raw, "ecology", 0.5);
  const sourcePressure = defaultMetric(raw, "sourcePressure", 0.45);
  const waterConnectivity = defaultMetric(raw, "waterConnectivity", ["treatment", "watershed-access", "utility"].includes(category) ? 0.86 : 0.38);
  const equity = defaultMetric(raw, "equity", clamp(0.58 * vulnerability + 0.28 * exposure + 0.14 * (["school", "community"].includes(category) ? 1 : 0)));
  const domainSuitability = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => {
    const explicit = finite(valueFrom(raw, `${domainKey}_suitability`, `${domainKey}Suitability`));
    return [domainKey, clamp(explicit ?? CATEGORY_SUITABILITY[domainKey][category])];
  }));
  const record = {
    id,
    label: String(valueFrom(raw, "label", "name", "site_name") ?? `${CATEGORY_LABELS[category]} ${index + 1}`).trim(),
    category,
    lat: latitude,
    lng: longitude,
    eligibleDomains,
    permissionStatus,
    accessStatus,
    powerStatus,
    safetyStatus,
    maintenanceStatus,
    access,
    power,
    maintenance,
    reliability,
    vulnerability,
    exposure,
    ecology,
    sourcePressure,
    waterConnectivity,
    equity,
    domainSuitability,
    ownerOrAgency: String(valueFrom(raw, "owner_or_agency", "owner", "agency") ?? "").trim(),
    reviewer: String(valueFrom(raw, "reviewer", "reviewed_by") ?? "").trim(),
    verificationDate: String(valueFrom(raw, "verification_date", "review_date") ?? "").trim(),
    notes: String(valueFrom(raw, "notes", "comment") ?? "").trim(),
    sourceType: "verified-inventory",
    sourceRecord: index + 1
  };
  record.reviewStatus = reviewStatus(record);
  record.reviewStatusLabel = statusLabel(record.reviewStatus);
  record.fieldVerified = record.reviewStatus === "verified";
  record.requiresFieldVerification = !record.fieldVerified;
  return { rejected: false, record };
}

export function summarizeHostInventory(records = []) {
  const byStatus = { verified: 0, conditional: 0, unresolved: 0, infeasible: 0 };
  const byDomain = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((key) => [key, 0]));
  for (const record of records) {
    byStatus[record.reviewStatus] = (byStatus[record.reviewStatus] ?? 0) + 1;
    for (const domainKey of record.eligibleDomains ?? []) byDomain[domainKey] += 1;
  }
  return {
    total: records.length,
    byStatus,
    byDomain,
    reviewed: byStatus.verified + byStatus.conditional,
    usableNotDenied: records.length - byStatus.infeasible,
    verifiedRate: records.length ? byStatus.verified / records.length : 0
  };
}

export function parseHostInventoryText(text, options = {}) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("The host inventory file is empty.");
  let rawRecords;
  const format = options.format ?? (trimmed.startsWith("[") || trimmed.startsWith("{") ? "json" : "csv");
  if (format === "json") {
    const parsed = JSON.parse(trimmed);
    rawRecords = Array.isArray(parsed) ? parsed : parsed.records ?? parsed.hosts ?? [];
  } else {
    rawRecords = parseCsv(trimmed);
  }
  if (!Array.isArray(rawRecords) || !rawRecords.length) throw new Error("No host records were found.");
  const seenIds = new Set();
  const records = [];
  const rejected = [];
  rawRecords.forEach((raw, index) => {
    const normalized = normalizeRecord(raw, index, seenIds);
    if (normalized.rejected) rejected.push(normalized);
    else records.push(normalized.record);
  });
  if (!records.length) throw new Error("No host records had valid coordinates.");
  const bundle = {
    schemaVersion: HOST_INVENTORY_SCHEMA_VERSION,
    sourceType: options.sourceType ?? "user-import",
    sourceName: options.sourceName ?? "Imported host inventory",
    importedAt: new Date(0).toISOString(),
    records,
    rejected,
    summary: summarizeHostInventory(records),
    claimBoundary: "Imported records preserve the supplied field-review status. LUMOS does not independently verify permission, access, power, safety, ownership, maintenance, or professional approval."
  };
  bundle.checksum = checksum({ ...bundle, importedAt: null, checksum: null });
  return bundle;
}

export function hostPassesReviewPolicy(host, policyKey = "verified-or-conditional") {
  if (host.sourceType === "controlled-proxy") return policyKey === "all-not-denied";
  const policy = HOST_REVIEW_POLICIES[policyKey] ?? HOST_REVIEW_POLICIES["verified-or-conditional"];
  return policy.allowed.includes(host.reviewStatus);
}

export function prepareHostInventoryForDeployment(bundleOrRecords, bounds) {
  const records = Array.isArray(bundleOrRecords) ? bundleOrRecords : bundleOrRecords?.records ?? [];
  const west = Number(bounds?.west);
  const east = Number(bounds?.east);
  const south = Number(bounds?.south);
  const north = Number(bounds?.north);
  const spanX = Math.max(1e-9, east - west);
  const spanY = Math.max(1e-9, north - south);
  return records.map((record) => ({
    ...record,
    x: clamp((record.lng - west) / spanX),
    y: clamp((record.lat - south) / spanY),
    withinBounds: record.lng >= west && record.lng <= east && record.lat >= south && record.lat <= north
  }));
}

export function hostInventoryTemplateCsv() {
  return [
    "host_id,label,latitude,longitude,category,eligible_domains,permission_status,access_status,power_status,safety_status,maintenance_status,reliability,vulnerability,exposure,ecology,source_pressure,water_connectivity,heat_suitability,air_suitability,soil_suitability,water_suitability,owner_or_agency,reviewer,verification_date,notes",
    "city-hall,City Hall,39.7392,-104.9903,municipal,heat|air|soil,verified,verified,verified,verified,verified,0.94,0.60,0.72,0.25,0.42,0.18,0.82,0.78,0.66,0.52,City facilities,Field team,2026-07-20,Example only",
    "creek-access,Creek access point,39.7500,-104.9600,watershed-access,water|soil,pending,verified,not-required,verified,pending,0.82,0.48,0.58,0.80,0.62,0.96,0.62,0.48,0.78,0.98,Watershed district,Field team,2026-07-21,Example only"
  ].join("\n");
}

export function createIllustrativeHostInventory(bounds = { west: -105.13, south: 39.63, east: -104.85, north: 39.84 }) {
  const categories = ["municipal", "school", "park", "transit", "community", "utility", "treatment", "industrial-edge", "watershed-access", "background"];
  const statuses = ["verified", "verified", "verified", "pending", "verified", "verified", "pending", "verified"];
  const records = [];
  for (let index = 0; index < 48; index += 1) {
    const x = ((index * 37) % 101 + 5) / 111;
    const y = ((index * 53) % 97 + 7) / 111;
    const category = categories[index % categories.length];
    const permission = index === 45 ? "denied" : statuses[index % statuses.length];
    const access = index === 46 ? "denied" : statuses[(index + 2) % statuses.length];
    const safety = index === 47 ? "denied" : statuses[(index + 1) % statuses.length];
    const power = ["transit", "municipal", "school", "utility", "treatment"].includes(category) ? "verified" : statuses[(index + 3) % statuses.length];
    records.push({
      host_id: `reviewed-host-${String(index + 1).padStart(2, "0")}`,
      label: `${CATEGORY_LABELS[category]} ${String(index + 1).padStart(2, "0")}`,
      latitude: bounds.south + y * (bounds.north - bounds.south),
      longitude: bounds.west + x * (bounds.east - bounds.west),
      category,
      eligible_domains: PUBLIC_DOMAIN_KEYS.join("|"),
      permission_status: permission,
      access_status: access,
      power_status: power,
      safety_status: safety,
      maintenance_status: statuses[(index + 4) % statuses.length],
      reliability: 0.76 + (index % 7) * 0.03,
      vulnerability: 0.35 + ((index * 17) % 50) / 100,
      exposure: 0.30 + ((index * 23) % 55) / 100,
      ecology: 0.25 + ((index * 29) % 60) / 100,
      source_pressure: 0.24 + ((index * 31) % 65) / 100,
      water_connectivity: ["treatment", "watershed-access", "utility"].includes(category) ? 0.92 : 0.34 + ((index * 11) % 40) / 100,
      owner_or_agency: index % 2 ? "Illustrative local partner" : "Illustrative public agency",
      reviewer: "Controlled v2.6 example",
      verification_date: "2026-07-25",
      notes: "Synthetic field-review record for reproducibility; not a real property."
    });
  }
  return parseHostInventoryText(JSON.stringify(records), { format: "json", sourceType: "controlled-reviewed-example", sourceName: "Controlled reviewed-host example" });
}

export function hostInventoryRows(bundle) {
  return (bundle?.records ?? []).map((record) => ({
    host_id: record.id,
    label: record.label,
    category: record.category,
    latitude: record.lat,
    longitude: record.lng,
    eligible_domains: record.eligibleDomains.join("|"),
    review_status: record.reviewStatus,
    permission_status: record.permissionStatus,
    access_status: record.accessStatus,
    power_status: record.powerStatus,
    safety_status: record.safetyStatus,
    maintenance_status: record.maintenanceStatus,
    reliability: record.reliability,
    owner_or_agency: record.ownerOrAgency,
    reviewer: record.reviewer,
    verification_date: record.verificationDate,
    notes: record.notes,
    field_verification_required: record.requiresFieldVerification,
    inventory_checksum: bundle.checksum
  }));
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToHostInventoryCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
