import {
  clearStoredNamespace,
  getStoredRecord,
  listStoredRecords,
  setStoredValue
} from "./browser-store.js";

const CACHE_NAMESPACE = "api-cache-v1";
const diagnostics = {
  hits: 0,
  misses: 0,
  stale: 0,
  writes: 0,
  errors: 0,
  bytesRead: 0,
  bytesWritten: 0,
  lastEvent: null
};

function simpleHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function requestCacheKey(url, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const body = typeof options.body === "string" ? options.body : options.body ? JSON.stringify(options.body) : "";
  return `${method}:${simpleHash(`${url}\n${body}`)}`;
}

function approximateBytes(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
}

function persistentCacheEnabled(fetchImpl) {
  return typeof window !== "undefined" && fetchImpl === globalThis.fetch;
}

export async function getCachedJson(url, {
  fetchImpl = globalThis.fetch,
  ttlMs,
  options = {},
  label = "Public data"
} = {}) {
  if (!persistentCacheEnabled(fetchImpl) || !Number.isFinite(ttlMs) || ttlMs <= 0) return null;
  const key = requestCacheKey(url, options);
  try {
    const record = await getStoredRecord(CACHE_NAMESPACE, key);
    if (!record) {
      diagnostics.misses += 1;
      diagnostics.lastEvent = `${label}: cache miss`;
      return null;
    }
    const ageMs = Date.now() - Number(record.updatedAt ?? 0);
    if (ageMs > ttlMs) {
      diagnostics.stale += 1;
      diagnostics.misses += 1;
      diagnostics.lastEvent = `${label}: stale cache entry`;
      return null;
    }
    diagnostics.hits += 1;
    const bytes = Number(record.bytes ?? approximateBytes(record.value));
    diagnostics.bytesRead += bytes;
    diagnostics.lastEvent = `${label}: cache hit`;
    return { value: record.value, ageMs, bytes, key };
  } catch (error) {
    diagnostics.errors += 1;
    diagnostics.lastEvent = `${label}: cache read failed`;
    console.warn("LUMOS cache read failed.", error);
    return null;
  }
}

export async function putCachedJson(url, value, {
  fetchImpl = globalThis.fetch,
  options = {},
  label = "Public data"
} = {}) {
  if (!persistentCacheEnabled(fetchImpl)) return null;
  const key = requestCacheKey(url, options);
  const bytes = approximateBytes(value);
  try {
    await setStoredValue(CACHE_NAMESPACE, key, value, {
      bytes,
      label,
      requestUrl: url,
      requestMethod: String(options.method ?? "GET").toUpperCase()
    });
    diagnostics.writes += 1;
    diagnostics.bytesWritten += bytes;
    diagnostics.lastEvent = `${label}: cached`;
    return { key, bytes };
  } catch (error) {
    diagnostics.errors += 1;
    diagnostics.lastEvent = `${label}: cache write failed`;
    console.warn("LUMOS cache write failed.", error);
    return null;
  }
}

export function getCacheDiagnostics() {
  return { ...diagnostics };
}

export function resetCacheDiagnostics() {
  for (const key of Object.keys(diagnostics)) diagnostics[key] = key === "lastEvent" ? null : 0;
}

export async function inspectApiCache() {
  const records = await listStoredRecords(CACHE_NAMESPACE);
  return {
    entries: records.length,
    bytes: records.reduce((sum, record) => sum + Number(record.bytes ?? 0), 0),
    oldestAt: records.length ? Math.min(...records.map((record) => Number(record.updatedAt ?? Date.now()))) : null,
    newestAt: records.length ? Math.max(...records.map((record) => Number(record.updatedAt ?? 0))) : null
  };
}

export async function clearApiCache() {
  const removed = await clearStoredNamespace(CACHE_NAMESPACE);
  resetCacheDiagnostics();
  return removed;
}

export const CACHE_DURATIONS = {
  weather: 15 * 60 * 1000,
  censusGeometry: 30 * 24 * 60 * 60 * 1000,
  censusSocial: 30 * 24 * 60 * 60 * 1000,
  landCover: 90 * 24 * 60 * 60 * 1000,
  mappedHosts: 7 * 24 * 60 * 60 * 1000
};
