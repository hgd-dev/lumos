import {
  deleteStoredValue,
  getStoredValue,
  listStoredRecords,
  setStoredValue
} from "../storage/browser-store.js";

const WORKSPACE_NAMESPACE = "workspaces-v1";
const AUTOSAVE_KEY = "__autosave__";
export const WORKSPACE_FORMAT = "lumos-workspace-v1";

function cloneSerializable(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function simpleHash(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function estimateSerializedBytes(value) {
  const text = JSON.stringify(value);
  if (typeof Blob !== "undefined") return new Blob([text]).size;
  return Buffer.byteLength(text, "utf8");
}

export function serializeScenario(scenario) {
  if (!scenario) return null;
  const output = cloneSerializable(scenario);
  const systematic = scenario._systematicCandidates ?? scenario.candidates?.filter((candidate) => candidate.sourceType === "systematic_proxy") ?? [];
  output._workspaceSystematicCandidates = cloneSerializable(systematic);
  return output;
}

export function deserializeScenario(serialized) {
  if (!serialized) return null;
  const scenario = cloneSerializable(serialized);
  const systematic = scenario._workspaceSystematicCandidates ?? scenario.candidates?.filter((candidate) => candidate.sourceType === "systematic_proxy") ?? [];
  delete scenario._workspaceSystematicCandidates;
  Object.defineProperty(scenario, "_systematicCandidates", {
    value: systematic,
    writable: true,
    enumerable: false,
    configurable: true
  });
  return scenario;
}

export function createWorkspaceSnapshot({
  scenario,
  controls = {},
  mapView = null,
  diagnostics = {},
  evidence = null,
  name = null,
  savedAt = Date.now()
} = {}) {
  if (!scenario) throw new Error("A fitted LUMOS scenario is required before saving a workspace.");
  const serializedScenario = serializeScenario(scenario);
  const identity = {
    cityLabel: scenario.cityLabel,
    scenarioType: scenario.scenarioType,
    sampledAt: scenario.model?.sampledAt ?? null,
    geoBounds: scenario.geoBounds ?? null,
    controls
  };
  const workspaceId = `workspace-${simpleHash(JSON.stringify(identity))}`;
  const snapshot = {
    format: WORKSPACE_FORMAT,
    version: 1,
    workspaceId,
    name: name?.trim() || scenario.cityLabel || "Saved LUMOS workspace",
    savedAt,
    scenario: serializedScenario,
    controls: cloneSerializable(controls),
    mapView: mapView ? cloneSerializable(mapView) : null,
    diagnostics: cloneSerializable(diagnostics),
    evidence: evidence ? cloneSerializable(evidence) : null
  };
  snapshot.bytes = estimateSerializedBytes(snapshot);
  return snapshot;
}

export function validateWorkspaceSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== WORKSPACE_FORMAT) throw new Error("This file is not a supported LUMOS workspace.");
  if (!snapshot.scenario?.cells?.length) throw new Error("The workspace does not contain a usable evaluation field.");
  if (!Array.isArray(snapshot.scenario.candidates)) throw new Error("The workspace does not contain a candidate network.");
  return true;
}

export async function saveWorkspaceSnapshot(snapshot, { autosave = false } = {}) {
  validateWorkspaceSnapshot(snapshot);
  const key = autosave ? AUTOSAVE_KEY : snapshot.workspaceId;
  await setStoredValue(WORKSPACE_NAMESPACE, key, snapshot, {
    label: snapshot.name,
    bytes: snapshot.bytes,
    autosave
  });
  return snapshot;
}

export async function loadWorkspaceSnapshot(key) {
  const snapshot = await getStoredValue(WORKSPACE_NAMESPACE, key);
  if (!snapshot) return null;
  validateWorkspaceSnapshot(snapshot);
  return snapshot;
}

export async function loadAutosavedWorkspace() {
  return loadWorkspaceSnapshot(AUTOSAVE_KEY);
}

export async function listSavedWorkspaces() {
  const records = await listStoredRecords(WORKSPACE_NAMESPACE);
  return records
    .filter((record) => record.key !== AUTOSAVE_KEY)
    .map((record) => ({
      key: record.key,
      name: record.value?.name ?? record.label ?? record.key,
      savedAt: record.value?.savedAt ?? record.updatedAt,
      bytes: record.value?.bytes ?? record.bytes ?? 0,
      scenarioType: record.value?.scenario?.scenarioType ?? null,
      cityLabel: record.value?.scenario?.cityLabel ?? null
    }));
}

export async function deleteSavedWorkspace(key) {
  if (!key || key === AUTOSAVE_KEY) return false;
  return deleteStoredValue(WORKSPACE_NAMESPACE, key);
}

export function parseWorkspaceText(text) {
  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch {
    throw new Error("The selected workspace file is not valid JSON.");
  }
  validateWorkspaceSnapshot(snapshot);
  return snapshot;
}

export function exportWorkspaceText(snapshot) {
  validateWorkspaceSnapshot(snapshot);
  return JSON.stringify(snapshot, null, 2);
}
