import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";

export const CAMPAIGN_TRACKING_SCHEMA_VERSION = "1.0";

export const CAMPAIGN_OUTCOME_VALUES = Object.freeze([
  "accepted",
  "conditional",
  "rejected",
  "pending"
]);

const REVIEW_STATUS_VALUES = new Set(["verified", "not-required", "pending", "unverified", "denied"]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback, low, high) {
  return Math.max(low, Math.min(high, Math.round(finite(value, fallback))));
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

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvObjects(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeOutcome(value) {
  const normalized = String(value ?? "pending").trim().toLowerCase().replace(/[ _]+/g, "-");
  if (["approved", "pass", "passed", "accept"].includes(normalized)) return "accepted";
  if (["provisional", "conditions", "conditioned"].includes(normalized)) return "conditional";
  if (["deny", "denied", "fail", "failed"].includes(normalized)) return "rejected";
  if (["not-inspected", "uninspected", "open", "unknown"].includes(normalized)) return "pending";
  return CAMPAIGN_OUTCOME_VALUES.includes(normalized) ? normalized : "pending";
}

function normalizeReviewStatus(value, fallback = "unverified") {
  const normalized = String(value ?? fallback).trim().toLowerCase().replace(/[ _]+/g, "-");
  return REVIEW_STATUS_VALUES.has(normalized) ? normalized : fallback;
}

function validIso(value, fallback) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function campaignPlan(campaignResult, profileKey = "balanced") {
  const plan = campaignResult?.portfolio?.find((entry) => entry.profileKey === profileKey)
    ?? campaignResult?.portfolio?.[0];
  if (!plan) throw new Error("Plan field-campaign operations before tracking live outcomes.");
  return plan;
}

function deploymentPlan(deploymentResult, campaignResult) {
  const key = campaignResult?.deploymentProfileKey;
  const plan = deploymentResult?.portfolio?.find((entry) => entry.profileKey === key)
    ?? deploymentResult?.portfolio?.[0];
  if (!plan) throw new Error("A coordinated deployment is required for live campaign tracking.");
  return plan;
}

function knownHostIds(campaign) {
  return new Set([
    ...campaign.inspections.map((inspection) => inspection.hostId),
    ...campaign.reserves.map((reserve) => reserve.hostId)
  ]);
}

function normalizeEvent(record, index, campaign, sourceName) {
  const fallbackDate = new Date(index * 1000).toISOString();
  const hostId = String(record.host_id ?? record.hostId ?? "").trim();
  if (!hostId) throw new Error(`Outcome row ${index + 1} is missing host_id.`);
  if (!knownHostIds(campaign).has(hostId)) throw new Error(`Outcome row ${index + 1} references unknown host ${hostId}.`);
  const phase = integer(record.phase, 1, 1, 99);
  const outcome = normalizeOutcome(record.outcome ?? record.status);
  const occurredAt = validIso(record.occurred_at ?? record.occurredAt, fallbackDate);
  const eventId = String(record.event_id ?? record.eventId ?? `${sourceName || "event"}-${String(index + 1).padStart(3, "0")}`).trim();
  return {
    eventId,
    hostId,
    phase,
    outcome,
    occurredAt,
    reviewer: String(record.reviewer ?? "").trim(),
    notes: String(record.notes ?? "").trim(),
    permissionStatus: normalizeReviewStatus(record.permission_status ?? record.permissionStatus),
    accessStatus: normalizeReviewStatus(record.access_status ?? record.accessStatus),
    powerStatus: normalizeReviewStatus(record.power_status ?? record.powerStatus),
    safetyStatus: normalizeReviewStatus(record.safety_status ?? record.safetyStatus),
    maintenanceStatus: normalizeReviewStatus(record.maintenance_status ?? record.maintenanceStatus),
    supersedesEventId: String(record.supersedes_event_id ?? record.supersedesEventId ?? "").trim() || null,
    sourceName
  };
}

function chainEvents(events) {
  let previousHash = "00000000";
  return events.map((event) => {
    const entry = { ...event, previousHash };
    entry.eventHash = checksum(entry);
    previousHash = entry.eventHash;
    return entry;
  });
}

export function createCampaignOutcomeBundle(records = [], options = {}) {
  const campaign = campaignPlan(options.campaignResult, options.campaignProfileKey);
  const sourceName = String(options.sourceName ?? "Campaign outcome import");
  const accepted = [];
  const rejected = [];
  const eventIds = new Set();
  for (let index = 0; index < records.length; index += 1) {
    try {
      const event = normalizeEvent(records[index], index, campaign, sourceName);
      if (eventIds.has(event.eventId)) throw new Error(`duplicate event_id ${event.eventId}`);
      eventIds.add(event.eventId);
      accepted.push(event);
    } catch (error) {
      rejected.push({ row: index + 1, reason: error.message, record: records[index] });
    }
  }
  accepted.sort((left, right) => left.phase - right.phase || left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId));
  const events = chainEvents(accepted);
  const bundle = {
    schemaVersion: CAMPAIGN_TRACKING_SCHEMA_VERSION,
    architecture: "append-only-field-inspection-outcome-ledger",
    sourceName,
    generatedAt: new Date(0).toISOString(),
    campaignChecksum: options.campaignResult?.checksum ?? null,
    campaignProfileKey: campaign.profileKey,
    events,
    rejected,
    summary: {
      acceptedRows: events.length,
      rejectedRows: rejected.length,
      hostsWithEvents: new Set(events.map((event) => event.hostId)).size,
      maximumPhase: Math.max(0, ...events.map((event) => event.phase)),
      accepted: events.filter((event) => event.outcome === "accepted").length,
      conditional: events.filter((event) => event.outcome === "conditional").length,
      rejected: events.filter((event) => event.outcome === "rejected").length,
      pending: events.filter((event) => event.outcome === "pending").length
    },
    claimBoundary: "The ledger preserves imported records and deterministic hashes, but it does not authenticate reviewer identity, timestamps, signatures, permissions, or field evidence. Later events supersede earlier status operationally without deleting history."
  };
  bundle.checksum = checksum({ ...bundle, generatedAt: null, checksum: null });
  return bundle;
}

export function parseCampaignOutcomeText(text, options = {}) {
  const sourceName = String(options.sourceName ?? "Campaign outcome import");
  let records;
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("The campaign outcome file is empty.");
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    records = Array.isArray(parsed) ? parsed : (parsed.events ?? parsed.records ?? []);
  } else records = csvObjects(trimmed);
  if (!Array.isArray(records) || !records.length) throw new Error("No campaign outcome records were found.");
  return createCampaignOutcomeBundle(records, { ...options, sourceName });
}

export function campaignOutcomeTemplateCsv() {
  return [
    "event_id,host_id,phase,outcome,occurred_at,reviewer,permission_status,access_status,power_status,safety_status,maintenance_status,supersedes_event_id,notes",
    "inspection-001,reviewed-host-01,1,accepted,2026-07-25T14:00:00Z,Local reviewer,verified,verified,verified,verified,verified,,Replace this example with an actual reviewed host"
  ].join("\n");
}

export function createIllustrativeCampaignOutcomes(campaignResult, campaignProfileKey = "balanced") {
  const campaign = campaignPlan(campaignResult, campaignProfileKey);
  const replacementHosts = new Set(campaign.replacements.map((replacement) => replacement.failedHostId));
  const records = campaign.inspections
    .filter((inspection) => inspection.scheduled)
    .map((inspection, index) => {
      let outcome = "accepted";
      if (replacementHosts.has(inspection.hostId)) outcome = "rejected";
      else if (index % 7 === 4) outcome = "conditional";
      return {
        event_id: `illustrative-${String(index + 1).padStart(3, "0")}`,
        host_id: inspection.hostId,
        phase: inspection.phase,
        outcome,
        occurred_at: new Date(Date.UTC(2026, 6, 25 + inspection.phase, 12, index % 60, 0)).toISOString(),
        reviewer: "Controlled v2.8 example",
        permission_status: outcome === "rejected" ? "denied" : outcome === "conditional" ? "pending" : "verified",
        access_status: outcome === "rejected" ? "denied" : "verified",
        power_status: "verified",
        safety_status: outcome === "conditional" ? "pending" : "verified",
        maintenance_status: "verified",
        notes: "Synthetic outcome for deterministic live-campaign tracking; not an observed field inspection."
      };
    });
  return createCampaignOutcomeBundle(records, {
    campaignResult,
    campaignProfileKey,
    sourceName: "Controlled v2.8 outcome example"
  });
}

function latestEventsByHost(events, completedPhase) {
  const latest = new Map();
  for (const event of events) {
    if (event.phase > completedPhase) continue;
    const current = latest.get(event.hostId);
    if (!current || current.occurredAt < event.occurredAt || (current.occurredAt === event.occurredAt && current.eventId < event.eventId)) latest.set(event.hostId, event);
  }
  return latest;
}

function reserveEventStatus(reserve, latest) {
  const event = latest.get(reserve.hostId);
  if (event?.outcome === "rejected") return { usable: false, provisional: false, event };
  if (event?.outcome === "pending") return { usable: false, provisional: true, event };
  if (event?.outcome === "accepted") return { usable: true, provisional: false, event };
  if (event?.outcome === "conditional") return { usable: true, provisional: true, event };
  if (reserve.reviewStatus === "verified") return { usable: true, provisional: false, event: null };
  if (reserve.reviewStatus === "conditional") return { usable: true, provisional: true, event: null };
  return { usable: false, provisional: true, event: null };
}

function assignmentKey(hostId, assignment) {
  return `${hostId}:${assignment.domainKey}:${assignment.role}`;
}

function buildSnapshot({ deployment, campaign, events, completedPhase }) {
  const latest = latestEventsByHost(events, completedPhase);
  const inspectionByHost = new Map(campaign.inspections.map((inspection) => [inspection.hostId, inspection]));
  const reservesByDomain = new Map(PUBLIC_DOMAIN_KEYS.map((domainKey) => [domainKey, campaign.reserves.filter((reserve) => reserve.domainKey === domainKey)]));
  const usedReserves = new Set();
  const assignments = [];

  for (const site of deployment.sites) {
    const inspection = inspectionByHost.get(site.id);
    const event = latest.get(site.id);
    let primaryState;
    if (event?.outcome === "accepted") primaryState = "active-primary";
    else if (event?.outcome === "conditional") primaryState = "provisional-primary";
    else if (event?.outcome === "rejected") primaryState = "rejected-primary";
    else if (event?.outcome === "pending") primaryState = "pending-review";
    else if (inspection?.scheduled && inspection.phase <= completedPhase) primaryState = "overdue-review";
    else if (inspection?.scheduled) primaryState = "future-review";
    else if (site.reviewStatus === "verified") primaryState = "active-primary";
    else if (site.reviewStatus === "conditional") primaryState = "provisional-primary";
    else primaryState = "pending-review";

    for (const assignment of site.assignments) {
      const base = {
        assignmentId: assignmentKey(site.id, assignment),
        domainKey: assignment.domainKey,
        role: assignment.role,
        primaryHostId: site.id,
        primaryHostLabel: site.label,
        primaryReviewStatus: site.reviewStatus,
        phase: inspection?.phase ?? null,
        latestEventId: event?.eventId ?? null,
        latestOutcome: event?.outcome ?? null,
        currentHostId: site.id,
        currentHostLabel: site.label,
        reserveId: null,
        operationalState: primaryState,
        reliability: site.reliability,
        suitability: assignment.suitability,
        provisional: primaryState === "provisional-primary"
      };
      if (primaryState !== "rejected-primary") {
        assignments.push(base);
        continue;
      }
      const planned = campaign.reserves.filter((reserve) => reserve.primaryHostId === site.id && reserve.domainKey === assignment.domainKey);
      const fallback = reservesByDomain.get(assignment.domainKey) ?? [];
      const reliabilityFloor = DOMAIN_REGISTRY[assignment.domainKey]?.planning?.fieldCampaign?.outcomeReliabilityFloor ?? 0;
      const candidate = [...planned, ...fallback].find((reserve) => {
        if (usedReserves.has(reserve.reserveId)) return false;
        if (finite(reserve.reliability, 0) < reliabilityFloor) return false;
        return reserveEventStatus(reserve, latest).usable;
      });
      if (!candidate) {
        assignments.push({ ...base, operationalState: "unresolved-gap", currentHostId: null, currentHostLabel: null, reliability: 0, suitability: 0, provisional: false });
        continue;
      }
      usedReserves.add(candidate.reserveId);
      const status = reserveEventStatus(candidate, latest);
      assignments.push({
        ...base,
        currentHostId: candidate.hostId,
        currentHostLabel: candidate.label,
        reserveId: candidate.reserveId,
        operationalState: status.provisional ? "replacement-provisional" : "replacement-active",
        reliability: candidate.reliability,
        suitability: candidate.suitability,
        provisional: status.provisional,
        reserveEventId: status.event?.eventId ?? null
      });
    }
  }

  const operational = assignments.filter((assignment) => ["active-primary", "provisional-primary", "replacement-active", "replacement-provisional"].includes(assignment.operationalState));
  const active = assignments.filter((assignment) => ["active-primary", "replacement-active"].includes(assignment.operationalState));
  const provisional = assignments.filter((assignment) => ["provisional-primary", "replacement-provisional"].includes(assignment.operationalState));
  const pending = assignments.filter((assignment) => ["pending-review", "overdue-review", "future-review"].includes(assignment.operationalState));
  const gaps = assignments.filter((assignment) => assignment.operationalState === "unresolved-gap");
  const operationalSites = new Map();
  for (const assignment of operational) {
    if (!assignment.currentHostId) continue;
    if (!operationalSites.has(assignment.currentHostId)) {
      const reserve = campaign.reserves.find((entry) => entry.hostId === assignment.currentHostId);
      const primary = deployment.sites.find((entry) => entry.id === assignment.currentHostId);
      operationalSites.set(assignment.currentHostId, {
        id: assignment.currentHostId,
        label: assignment.currentHostLabel,
        lat: primary?.lat ?? reserve?.lat,
        lng: primary?.lng ?? reserve?.lng,
        assignments: [],
        provisional: false,
        requiresFieldVerification: assignment.provisional
      });
    }
    const site = operationalSites.get(assignment.currentHostId);
    site.assignments.push({ domainKey: assignment.domainKey, role: assignment.role, sourcePrimaryHostId: assignment.primaryHostId });
    site.provisional ||= assignment.provisional;
    site.requiresFieldVerification ||= assignment.provisional;
  }

  const total = assignments.length;
  const weightedOperationalAssignments = assignments.reduce((sum, assignment) => {
    if (["active-primary", "replacement-active"].includes(assignment.operationalState)) return sum + 1;
    if (["provisional-primary", "replacement-provisional"].includes(assignment.operationalState)) {
      return sum + (DOMAIN_REGISTRY[assignment.domainKey]?.planning?.fieldCampaign?.conditionalOperationalCredit ?? 0.7);
    }
    return sum;
  }, 0);
  return {
    completedPhase,
    eventCount: [...latest.values()].length,
    assignments,
    operationalSites: [...operationalSites.values()],
    metrics: {
      totalAssignments: total,
      activeAssignments: active.length,
      provisionalAssignments: provisional.length,
      operationalAssignments: operational.length,
      pendingAssignments: pending.length,
      unresolvedAssignments: gaps.length,
      replacementAssignments: assignments.filter((assignment) => assignment.operationalState.startsWith("replacement-")).length,
      reserveHostsActivated: usedReserves.size,
      operationalRate: total ? operational.length / total : 0,
      effectiveOperationalRate: total ? weightedOperationalAssignments / total : 0,
      verifiedOperationalRate: total ? active.length / total : 0,
      acceptedEvents: [...latest.values()].filter((event) => event.outcome === "accepted").length,
      conditionalEvents: [...latest.values()].filter((event) => event.outcome === "conditional").length,
      rejectedEvents: [...latest.values()].filter((event) => event.outcome === "rejected").length,
      overdueAssignments: assignments.filter((assignment) => assignment.operationalState === "overdue-review").length
    }
  };
}

export function trackLiveCampaign(config = {}) {
  const campaign = campaignPlan(config.campaignResult, config.campaignProfileKey);
  const deployment = deploymentPlan(config.deploymentResult, config.campaignResult);
  const outcomeBundle = config.outcomeBundle ?? createCampaignOutcomeBundle([], {
    campaignResult: config.campaignResult,
    campaignProfileKey: campaign.profileKey,
    sourceName: "Empty live campaign ledger"
  });
  if (outcomeBundle.campaignChecksum && outcomeBundle.campaignChecksum !== config.campaignResult?.checksum) {
    throw new Error("The imported outcome ledger was created for a different field-campaign plan.");
  }
  const maximumPhase = Math.max(1, ...campaign.inspections.filter((inspection) => inspection.scheduled).map((inspection) => inspection.phase ?? 1));
  const completedPhase = integer(config.completedPhase, maximumPhase, 0, maximumPhase);
  const phaseSnapshots = [];
  for (let phase = 0; phase <= completedPhase; phase += 1) phaseSnapshots.push(buildSnapshot({ deployment, campaign, events: outcomeBundle.events, completedPhase: phase }));
  const current = phaseSnapshots.at(-1);
  const result = {
    schemaVersion: CAMPAIGN_TRACKING_SCHEMA_VERSION,
    architecture: "phase-aware-live-field-campaign-ledger-and-adaptive-replacement",
    generatedAt: new Date(0).toISOString(),
    ready: true,
    campaignChecksum: config.campaignResult?.checksum ?? null,
    deploymentChecksum: config.deploymentResult?.checksum ?? null,
    campaignProfileKey: campaign.profileKey,
    completedPhase,
    maximumPhase,
    outcomeBundle,
    eventHistory: outcomeBundle.events,
    phaseSnapshots,
    currentSnapshot: current,
    claimBoundary: "Operational states reflect imported records and declared reserve rules. LUMOS does not verify reviewer identity, evidence authenticity, legal permission, safety, infrastructure, or deployment approval. The deterministic hash chain is for reproducibility and change detection, not cryptographic authentication."
  };
  result.checksum = checksum({ ...result, generatedAt: null, checksum: null });
  return result;
}

export function campaignTrackingRows(result) {
  if (!result?.ready) return [];
  const eventRows = result.eventHistory.map((event) => ({
    record_type: "event",
    completed_phase: result.completedPhase,
    event_id: event.eventId,
    previous_hash: event.previousHash,
    event_hash: event.eventHash,
    host_id: event.hostId,
    phase: event.phase,
    outcome: event.outcome,
    occurred_at: event.occurredAt,
    reviewer: event.reviewer,
    notes: event.notes,
    domain: "",
    role: "",
    primary_host_id: "",
    current_host_id: "",
    operational_state: "",
    checksum: result.checksum
  }));
  const assignmentRows = result.currentSnapshot.assignments.map((assignment) => ({
    record_type: "assignment",
    completed_phase: result.completedPhase,
    event_id: assignment.latestEventId ?? "",
    previous_hash: "",
    event_hash: "",
    host_id: assignment.currentHostId ?? "",
    phase: assignment.phase ?? "",
    outcome: assignment.latestOutcome ?? "",
    occurred_at: "",
    reviewer: "",
    notes: "",
    domain: assignment.domainKey,
    role: assignment.role,
    primary_host_id: assignment.primaryHostId,
    current_host_id: assignment.currentHostId ?? "",
    operational_state: assignment.operationalState,
    checksum: result.checksum
  }));
  const snapshotRows = result.phaseSnapshots.map((snapshot) => ({
    record_type: "phase_snapshot",
    completed_phase: snapshot.completedPhase,
    event_id: "",
    previous_hash: "",
    event_hash: "",
    host_id: "",
    phase: snapshot.completedPhase,
    outcome: "",
    occurred_at: "",
    reviewer: "",
    notes: `operational=${snapshot.metrics.operationalAssignments}; pending=${snapshot.metrics.pendingAssignments}; gaps=${snapshot.metrics.unresolvedAssignments}`,
    domain: "",
    role: "",
    primary_host_id: "",
    current_host_id: "",
    operational_state: snapshot.metrics.unresolvedAssignments ? "gaps" : "protected",
    checksum: result.checksum
  }));
  return [...eventRows, ...assignmentRows, ...snapshotRows];
}

export function rowsToCampaignTrackingCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
