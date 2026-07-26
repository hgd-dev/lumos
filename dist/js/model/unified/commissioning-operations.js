import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";

export const COMMISSIONING_OPERATIONS_SCHEMA_VERSION = "1.0";

const PROCUREMENT_VALUES = new Set(["planned", "ordered", "received", "unavailable"]);
const PERMIT_VALUES = new Set(["pending", "approved", "denied", "not-required"]);
const INSTALLATION_VALUES = new Set(["pending", "scheduled", "installed", "failed"]);
const CALIBRATION_VALUES = new Set(["pending", "passed", "conditional", "failed", "not-required"]);
const OPERATIONAL_VALUES = new Set(["commissioning", "online", "degraded", "offline", "maintenance", "failed", "replaced", "retired"]);
const MAINTENANCE_VALUES = new Set(["current", "due", "overdue", "in-progress", "completed"]);
const TICKET_SEVERITY_VALUES = new Set(["none", "low", "medium", "high", "critical"]);
const TICKET_STATUS_VALUES = new Set(["none", "open", "scheduled", "closed"]);
const CHAIN_VALUES = new Set(["pending", "complete", "exception", "not-required"]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback, low, high) {
  return Math.max(low, Math.min(high, Math.round(finite(value, fallback))));
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
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

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value ?? fallback).trim().toLowerCase().replace(/[ _]+/g, "-");
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeRatio(value, fallback = 0) {
  const number = finite(value, fallback);
  return clamp(number > 1 ? number / 100 : number, 0, 1);
}

function validIso(value, fallback) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function optionalIso(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function latestCampaignSnapshot(trackingResult) {
  if (!trackingResult?.ready || !trackingResult.currentSnapshot) {
    throw new Error("Complete live campaign tracking before commissioning the operational network.");
  }
  return trackingResult.currentSnapshot;
}

function campaignPlan(campaignResult, profileKey = "balanced") {
  const plan = campaignResult?.portfolio?.find((entry) => entry.profileKey === profileKey)
    ?? campaignResult?.portfolio?.[0];
  if (!plan) throw new Error("A field-campaign plan is required for reserve and replacement planning.");
  return plan;
}

function assignmentIndex(trackingResult) {
  const snapshot = latestCampaignSnapshot(trackingResult);
  const byId = new Map();
  const byHostDomain = new Map();
  for (const assignment of snapshot.assignments) {
    byId.set(assignment.assignmentId, assignment);
    if (assignment.currentHostId) byHostDomain.set(`${assignment.currentHostId}:${assignment.domainKey}`, assignment);
  }
  return { snapshot, byId, byHostDomain };
}

function normalizeCommissioningEvent(record, index, context, sourceName) {
  const fallbackDate = new Date(Date.UTC(2026, 7, 1, 0, 0, index)).toISOString();
  const requestedAssignmentId = String(record.assignment_id ?? record.assignmentId ?? "").trim();
  const hostId = String(record.host_id ?? record.hostId ?? "").trim();
  const domainKey = String(record.domain ?? record.domain_key ?? record.domainKey ?? "").trim().toLowerCase();
  let assignment = requestedAssignmentId ? context.byId.get(requestedAssignmentId) : null;
  if (!assignment && hostId && domainKey) assignment = context.byHostDomain.get(`${hostId}:${domainKey}`);
  if (!assignment) throw new Error(`Commissioning row ${index + 1} does not match a current operational assignment.`);
  if (!PUBLIC_DOMAIN_KEYS.includes(assignment.domainKey)) throw new Error(`Commissioning row ${index + 1} has unsupported domain ${assignment.domainKey}.`);
  const eventId = String(record.event_id ?? record.eventId ?? `${sourceName || "commissioning"}-${String(index + 1).padStart(3, "0")}`).trim();
  const occurredAt = validIso(record.occurred_at ?? record.occurredAt, fallbackDate);
  return {
    eventId,
    assignmentId: assignment.assignmentId,
    hostId: hostId || assignment.currentHostId,
    domainKey: assignment.domainKey,
    role: assignment.role,
    assetId: String(record.asset_id ?? record.assetId ?? `${assignment.domainKey}-${assignment.currentHostId}`).trim(),
    occurredAt,
    procurementStatus: normalizeEnum(record.procurement_status ?? record.procurementStatus, PROCUREMENT_VALUES, "planned"),
    permitStatus: normalizeEnum(record.permit_status ?? record.permitStatus, PERMIT_VALUES, "pending"),
    installationStatus: normalizeEnum(record.installation_status ?? record.installationStatus, INSTALLATION_VALUES, "pending"),
    calibrationStatus: normalizeEnum(record.calibration_status ?? record.calibrationStatus, CALIBRATION_VALUES, "pending"),
    chainOfCustodyStatus: normalizeEnum(record.chain_of_custody_status ?? record.chainOfCustodyStatus, CHAIN_VALUES, "not-required"),
    operationalStatus: normalizeEnum(record.operational_status ?? record.operationalStatus, OPERATIONAL_VALUES, "commissioning"),
    uptime: normalizeRatio(record.uptime_percent ?? record.uptime ?? record.uptimePercent, 0),
    dataCompleteness: normalizeRatio(record.data_completeness ?? record.dataCompleteness, 0),
    maintenanceStatus: normalizeEnum(record.maintenance_status ?? record.maintenanceStatus, MAINTENANCE_VALUES, "current"),
    ticketSeverity: normalizeEnum(record.ticket_severity ?? record.ticketSeverity, TICKET_SEVERITY_VALUES, "none"),
    ticketStatus: normalizeEnum(record.ticket_status ?? record.ticketStatus, TICKET_STATUS_VALUES, "none"),
    calibrationDueAt: optionalIso(record.calibration_due_at ?? record.calibrationDueAt),
    maintenanceDueAt: optionalIso(record.maintenance_due_at ?? record.maintenanceDueAt),
    technician: String(record.technician ?? record.reviewer ?? "").trim(),
    notes: String(record.notes ?? "").trim(),
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

export function createCommissioningEventBundle(records = [], options = {}) {
  const context = assignmentIndex(options.trackingResult);
  const sourceName = String(options.sourceName ?? "Commissioning operations import");
  const accepted = [];
  const rejected = [];
  const eventIds = new Set();
  for (let index = 0; index < records.length; index += 1) {
    try {
      const event = normalizeCommissioningEvent(records[index], index, context, sourceName);
      if (eventIds.has(event.eventId)) throw new Error(`duplicate event_id ${event.eventId}`);
      eventIds.add(event.eventId);
      accepted.push(event);
    } catch (error) {
      rejected.push({ row: index + 1, reason: error.message, record: records[index] });
    }
  }
  accepted.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId));
  const events = chainEvents(accepted);
  const bundle = {
    schemaVersion: COMMISSIONING_OPERATIONS_SCHEMA_VERSION,
    architecture: "append-only-installation-calibration-and-maintenance-ledger",
    sourceName,
    generatedAt: new Date(0).toISOString(),
    trackingChecksum: options.trackingResult?.checksum ?? null,
    events,
    rejected,
    summary: {
      acceptedRows: events.length,
      rejectedRows: rejected.length,
      assignmentsWithEvents: new Set(events.map((event) => event.assignmentId)).size,
      domainsRepresented: new Set(events.map((event) => event.domainKey)).size,
      onlineEvents: events.filter((event) => event.operationalStatus === "online").length,
      degradedEvents: events.filter((event) => event.operationalStatus === "degraded").length,
      offlineEvents: events.filter((event) => ["offline", "failed", "retired"].includes(event.operationalStatus)).length,
      openTickets: events.filter((event) => ["open", "scheduled"].includes(event.ticketStatus)).length
    },
    claimBoundary: "The ledger preserves imported commissioning and maintenance records but does not authenticate technicians, permits, procurement, calibration certificates, timestamps, asset identifiers, or field evidence. Hashes support deterministic change detection, not digital signatures."
  };
  bundle.checksum = checksum({ ...bundle, generatedAt: null, checksum: null });
  return bundle;
}

export function parseCommissioningEventText(text, options = {}) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("The commissioning operations file is empty.");
  let records;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    records = Array.isArray(parsed) ? parsed : (parsed.events ?? parsed.records ?? []);
  } else records = csvObjects(trimmed);
  if (!Array.isArray(records) || !records.length) throw new Error("No commissioning or maintenance records were found.");
  return createCommissioningEventBundle(records, options);
}

export function commissioningEventTemplateCsv() {
  return [
    "event_id,assignment_id,host_id,domain,asset_id,occurred_at,procurement_status,permit_status,installation_status,calibration_status,chain_of_custody_status,operational_status,uptime_percent,data_completeness,maintenance_status,ticket_severity,ticket_status,calibration_due_at,maintenance_due_at,technician,supersedes_event_id,notes",
    "commission-001,reviewed-host-01:heat:reference,reviewed-host-01,heat,heat-asset-001,2026-08-01T14:00:00Z,received,approved,installed,passed,not-required,online,96,94,current,none,none,2027-02-01T00:00:00Z,2026-11-01T00:00:00Z,Local technician,,Replace this example with an actual commissioning record"
  ].join("\n");
}

function commissioningContract(domainKey) {
  const contract = DOMAIN_REGISTRY[domainKey]?.planning?.commissioning;
  if (!contract) throw new Error(`No commissioning contract is declared for ${domainKey}.`);
  return contract;
}

export function createIllustrativeCommissioningEvents(trackingResult) {
  const snapshot = latestCampaignSnapshot(trackingResult);
  const eligible = snapshot.assignments.filter((assignment) => assignment.currentHostId && assignment.operationalState !== "unresolved-gap");
  const failureIndexes = new Set([7, 9, 14].filter((index) => index < eligible.length));
  const records = eligible.map((assignment, index) => {
    const contract = commissioningContract(assignment.domainKey);
    const failed = failureIndexes.has(index);
    const degraded = !failed && index % 11 === 5;
    const calibrationStatus = contract.calibrationRequired
      ? (index % 13 === 4 ? "conditional" : "passed")
      : "not-required";
    const uptime = contract.assetClass === "sample-program"
      ? 1
      : failed ? 0.18 : degraded ? Math.max(0.65, contract.minimumUptime - 0.05) : Math.min(0.99, contract.minimumUptime + 0.07 + (index % 3) * 0.01);
    const dataCompleteness = failed ? 0.22 : degraded ? 0.76 : Math.min(0.99, contract.minimumDataCompleteness + 0.08);
    return {
      event_id: `controlled-commission-${String(index + 1).padStart(3, "0")}`,
      assignment_id: assignment.assignmentId,
      host_id: assignment.currentHostId,
      domain: assignment.domainKey,
      asset_id: `${assignment.domainKey}-asset-${String(index + 1).padStart(3, "0")}`,
      occurred_at: new Date(Date.UTC(2026, 7, 1 + (index % 20), 13, index % 60, 0)).toISOString(),
      procurement_status: "received",
      permit_status: contract.permitRequired ? "approved" : "not-required",
      installation_status: failed && index % 2 === 0 ? "failed" : "installed",
      calibration_status: failed && contract.calibrationRequired && index % 2 === 1 ? "failed" : calibrationStatus,
      chain_of_custody_status: contract.chainOfCustodyRequired ? "complete" : "not-required",
      operational_status: failed ? "offline" : degraded ? "degraded" : "online",
      uptime_percent: Math.round(uptime * 1000) / 10,
      data_completeness: Math.round(dataCompleteness * 1000) / 10,
      maintenance_status: index % 17 === 8 ? "due" : "current",
      ticket_severity: failed ? "critical" : degraded ? "medium" : index % 17 === 8 ? "low" : "none",
      ticket_status: failed || degraded || index % 17 === 8 ? "open" : "none",
      calibration_due_at: contract.calibrationRequired ? "2027-02-01T00:00:00.000Z" : "",
      maintenance_due_at: index % 17 === 8 ? "2026-08-20T00:00:00.000Z" : "2026-12-01T00:00:00.000Z",
      technician: "Controlled example technician",
      notes: failed ? "Controlled equipment failure used to test replacement planning." : "Controlled commissioning example; not an observed deployment record."
    };
  });
  return createCommissioningEventBundle(records, {
    trackingResult,
    sourceName: "Controlled v3 commissioning and maintenance example"
  });
}

function latestEventsByAssignment(events, asOfAt) {
  const cutoff = Date.parse(asOfAt);
  const latest = new Map();
  for (const event of events) {
    if (Date.parse(event.occurredAt) > cutoff) continue;
    const prior = latest.get(event.assignmentId);
    if (!prior || event.occurredAt > prior.occurredAt || (event.occurredAt === prior.occurredAt && event.eventId > prior.eventId)) {
      latest.set(event.assignmentId, event);
    }
  }
  return latest;
}

function dueBefore(value, asOfAt) {
  return Boolean(value && Date.parse(value) <= Date.parse(asOfAt));
}

function ticketFor(assignment, event, contract, asOfAt) {
  const tickets = [];
  const push = (type, severity, detail) => tickets.push({
    ticketId: `${assignment.assignmentId}:${type}`,
    assignmentId: assignment.assignmentId,
    hostId: assignment.currentHostId,
    domainKey: assignment.domainKey,
    type,
    severity,
    status: event?.ticketStatus === "closed" ? "closed" : "open",
    detail
  });
  if (!event) {
    push("commissioning-record", "low", "No commissioning record has been imported for this assignment.");
    return tickets;
  }
  if (event.permitStatus === "denied") push("permit", "critical", "Permit or authorization is denied.");
  if (event.procurementStatus === "unavailable") push("procurement", "critical", "Required equipment is unavailable.");
  if (event.installationStatus === "failed") push("installation", "critical", "Installation failed and requires corrective work or replacement.");
  if (event.calibrationStatus === "failed") push("calibration", "critical", "Calibration or collocation failed.");
  if (event.chainOfCustodyStatus === "exception") push("chain-of-custody", "high", "Sampling or laboratory chain of custody has an exception.");
  if (["offline", "failed", "retired"].includes(event.operationalStatus)) push("availability", "critical", `Asset is ${event.operationalStatus}.`);
  if (event.operationalStatus === "degraded") push("availability", "high", "Asset is operating in a degraded state.");
  if (contract.assetClass !== "sample-program" && event.uptime < contract.minimumUptime) {
    push("uptime", event.uptime < contract.minimumUptime * 0.75 ? "high" : "medium", `Uptime ${(100 * event.uptime).toFixed(1)}% is below the ${(100 * contract.minimumUptime).toFixed(0)}% domain floor.`);
  }
  if (event.dataCompleteness < contract.minimumDataCompleteness) push("data-completeness", "high", "Data completeness is below the domain commissioning floor.");
  if (contract.calibrationRequired && dueBefore(event.calibrationDueAt, asOfAt)) push("calibration-due", "high", "Calibration or collocation is due or overdue.");
  if (dueBefore(event.maintenanceDueAt, asOfAt) || ["due", "overdue"].includes(event.maintenanceStatus)) {
    push("maintenance", event.maintenanceStatus === "overdue" ? "high" : "medium", "Preventive maintenance is due or overdue.");
  }
  if (event.ticketSeverity !== "none" && event.ticketStatus !== "closed") {
    push("imported-ticket", event.ticketSeverity, "The imported record declares an open maintenance ticket.");
  }
  return tickets;
}

function evaluateAssignment(assignment, event, asOfAt) {
  const contract = commissioningContract(assignment.domainKey);
  const fieldOperational = ["active-primary", "provisional-primary", "replacement-active", "replacement-provisional"].includes(assignment.operationalState);
  const tickets = ticketFor(assignment, event, contract, asOfAt);
  const critical = tickets.some((ticket) => ticket.status === "open" && ticket.severity === "critical");
  const high = tickets.some((ticket) => ticket.status === "open" && ticket.severity === "high");
  const prerequisites = Boolean(event
    && event.procurementStatus === "received"
    && ["approved", "not-required"].includes(event.permitStatus)
    && event.installationStatus === "installed"
    && (!contract.calibrationRequired || ["passed", "conditional"].includes(event.calibrationStatus))
    && (!contract.chainOfCustodyRequired || event.chainOfCustodyStatus === "complete"));
  const online = Boolean(event && ["online", "degraded"].includes(event.operationalStatus));
  const uptimeOkay = contract.assetClass === "sample-program" || Boolean(event && event.uptime >= contract.minimumUptime);
  const completenessOkay = Boolean(event && event.dataCompleteness >= contract.minimumDataCompleteness);
  let commissioningState = "awaiting-record";
  if (!fieldOperational) commissioningState = "field-not-operational";
  else if (critical) commissioningState = "offline-or-blocked";
  else if (prerequisites && online && uptimeOkay && completenessOkay && !high) commissioningState = "commissioned";
  else if (prerequisites && online) commissioningState = "provisional";
  else if (event) commissioningState = "commissioning";
  const readiness = !fieldOperational ? 0
    : commissioningState === "commissioned" ? 1
      : commissioningState === "provisional" ? contract.conditionalCommissioningCredit
        : commissioningState === "commissioning" ? 0.35
          : 0;
  return {
    ...assignment,
    assetClass: contract.assetClass,
    latestEventId: event?.eventId ?? null,
    assetId: event?.assetId ?? null,
    commissioningState,
    readiness,
    uptime: event?.uptime ?? 0,
    dataCompleteness: event?.dataCompleteness ?? 0,
    procurementStatus: event?.procurementStatus ?? "planned",
    permitStatus: event?.permitStatus ?? "pending",
    installationStatus: event?.installationStatus ?? "pending",
    calibrationStatus: event?.calibrationStatus ?? (contract.calibrationRequired ? "pending" : "not-required"),
    chainOfCustodyStatus: event?.chainOfCustodyStatus ?? (contract.chainOfCustodyRequired ? "pending" : "not-required"),
    operationalStatus: event?.operationalStatus ?? "commissioning",
    maintenanceStatus: event?.maintenanceStatus ?? "current",
    calibrationDueAt: event?.calibrationDueAt ?? null,
    maintenanceDueAt: event?.maintenanceDueAt ?? null,
    tickets
  };
}

function reserveCandidates(campaign, domainKey, usedHosts, currentHosts) {
  const contract = commissioningContract(domainKey);
  return campaign.reserves
    .filter((reserve) => reserve.domainKey === domainKey)
    .filter((reserve) => !usedHosts.has(reserve.hostId) && !currentHosts.has(reserve.hostId))
    .filter((reserve) => reserve.reliability >= contract.replacementReliabilityFloor)
    .filter((reserve) => ["verified", "conditional"].includes(reserve.reviewStatus))
    .map((reserve) => ({
      ...reserve,
      replacementScore: 0.5 * reserve.reliability
        + 0.4 * reserve.suitability
        + (reserve.reviewStatus === "verified" ? 0.08 : 0)
        - 0.02 * Math.min(5, finite(reserve.distanceKm, 5))
    }))
    .sort((left, right) => right.replacementScore - left.replacementScore || left.hostId.localeCompare(right.hostId));
}

export const DEFAULT_COMMISSIONING_OPERATIONS_CONFIG = Object.freeze({
  asOfAt: "2026-09-01T00:00:00.000Z",
  installationsPerPhase: 8,
  maximumPhases: 6,
  activateEligibleReplacements: true,
  campaignProfileKey: "balanced"
});

export function normalizeCommissioningOperationsConfig(config = {}) {
  const asOfAt = validIso(config.asOfAt, DEFAULT_COMMISSIONING_OPERATIONS_CONFIG.asOfAt);
  return {
    asOfAt,
    installationsPerPhase: integer(config.installationsPerPhase, DEFAULT_COMMISSIONING_OPERATIONS_CONFIG.installationsPerPhase, 1, 40),
    maximumPhases: integer(config.maximumPhases, DEFAULT_COMMISSIONING_OPERATIONS_CONFIG.maximumPhases, 1, 12),
    activateEligibleReplacements: config.activateEligibleReplacements !== false,
    campaignProfileKey: String(config.campaignProfileKey ?? DEFAULT_COMMISSIONING_OPERATIONS_CONFIG.campaignProfileKey)
  };
}

export function runCommissioningOperations(config = {}) {
  const normalized = normalizeCommissioningOperationsConfig(config);
  const snapshot = latestCampaignSnapshot(config.trackingResult);
  const campaign = campaignPlan(config.campaignResult, normalized.campaignProfileKey);
  const eventBundle = config.eventBundle ?? createCommissioningEventBundle([], {
    trackingResult: config.trackingResult,
    sourceName: "Empty commissioning ledger"
  });
  if (eventBundle.trackingChecksum && eventBundle.trackingChecksum !== config.trackingResult?.checksum) {
    throw new Error("The commissioning ledger was created for a different live operational network.");
  }
  const latest = latestEventsByAssignment(eventBundle.events, normalized.asOfAt);
  const assignments = snapshot.assignments.map((assignment) => evaluateAssignment(assignment, latest.get(assignment.assignmentId), normalized.asOfAt));
  const currentHosts = new Set(assignments.map((assignment) => assignment.currentHostId).filter(Boolean));
  const usedReserveHosts = new Set();
  const replacements = [];
  for (const assignment of assignments.filter((entry) => entry.commissioningState === "offline-or-blocked")) {
    if (!normalized.activateEligibleReplacements) continue;
    const candidate = reserveCandidates(campaign, assignment.domainKey, usedReserveHosts, currentHosts)[0];
    if (!candidate) {
      replacements.push({
        assignmentId: assignment.assignmentId,
        domainKey: assignment.domainKey,
        failedHostId: assignment.currentHostId,
        failedHostLabel: assignment.currentHostLabel,
        status: "unresolved",
        replacementHostId: null,
        replacementHostLabel: null,
        reserveId: null,
        reliability: 0,
        suitability: 0
      });
      continue;
    }
    usedReserveHosts.add(candidate.hostId);
    replacements.push({
      assignmentId: assignment.assignmentId,
      domainKey: assignment.domainKey,
      role: assignment.role,
      failedHostId: assignment.currentHostId,
      failedHostLabel: assignment.currentHostLabel,
      status: "replacement-ready",
      replacementHostId: candidate.hostId,
      replacementHostLabel: candidate.label,
      reserveId: candidate.reserveId,
      reviewStatus: candidate.reviewStatus,
      reliability: candidate.reliability,
      suitability: candidate.suitability,
      lat: candidate.lat,
      lng: candidate.lng,
      requiresFieldVerification: candidate.reviewStatus !== "verified"
    });
  }
  const replacementByAssignment = new Map(replacements.map((replacement) => [replacement.assignmentId, replacement]));
  for (const assignment of assignments) assignment.replacement = replacementByAssignment.get(assignment.assignmentId) ?? null;

  const queue = assignments
    .filter((assignment) => ["awaiting-record", "commissioning", "provisional"].includes(assignment.commissioningState))
    .sort((left, right) => {
      const leftPriority = commissioningContract(left.domainKey).commissioningPriority;
      const rightPriority = commissioningContract(right.domainKey).commissioningPriority;
      return rightPriority - leftPriority || right.reliability - left.reliability || left.assignmentId.localeCompare(right.assignmentId);
    })
    .map((assignment, index) => ({
      assignmentId: assignment.assignmentId,
      hostId: assignment.currentHostId,
      domainKey: assignment.domainKey,
      role: assignment.role,
      phase: Math.min(normalized.maximumPhases, Math.floor(index / normalized.installationsPerPhase) + 1),
      priority: commissioningContract(assignment.domainKey).commissioningPriority,
      state: assignment.commissioningState
    }));

  const openTickets = assignments.flatMap((assignment) => assignment.tickets).filter((ticket) => ticket.status === "open");
  const commissioned = assignments.filter((assignment) => assignment.commissioningState === "commissioned");
  const provisional = assignments.filter((assignment) => assignment.commissioningState === "provisional");
  const offline = assignments.filter((assignment) => assignment.commissioningState === "offline-or-blocked");
  const pending = assignments.filter((assignment) => ["awaiting-record", "commissioning"].includes(assignment.commissioningState));
  const protectedFailures = replacements.filter((replacement) => replacement.status === "replacement-ready").length;
  const unresolvedFailures = replacements.filter((replacement) => replacement.status === "unresolved").length;
  const continuousAssignments = assignments.filter((assignment) => assignment.assetClass !== "sample-program" && assignment.latestEventId);
  const meanUptime = continuousAssignments.length
    ? continuousAssignments.reduce((sum, assignment) => sum + assignment.uptime, 0) / continuousAssignments.length
    : 0;
  const meanDataCompleteness = assignments.length
    ? assignments.reduce((sum, assignment) => sum + assignment.dataCompleteness, 0) / assignments.length
    : 0;
  const calibrationApplicable = assignments.filter((assignment) => commissioningContract(assignment.domainKey).calibrationRequired);
  const calibrationCompliant = calibrationApplicable.filter((assignment) => ["passed", "conditional"].includes(assignment.calibrationStatus));
  const maintenanceCurrent = assignments.filter((assignment) => !assignment.tickets.some((ticket) => ["maintenance", "calibration-due"].includes(ticket.type) && ticket.status === "open"));
  const readinessCredit = assignments.reduce((sum, assignment) => {
    if (assignment.replacement?.status === "replacement-ready") return sum + commissioningContract(assignment.domainKey).replacementProtectionCredit;
    return sum + assignment.readiness;
  }, 0);
  const commissioningCost = assignments.reduce((sum, assignment) => sum + commissioningContract(assignment.domainKey).commissioningCost, 0);
  const annualMaintenanceCost = assignments.reduce((sum, assignment) => sum + commissioningContract(assignment.domainKey).annualMaintenanceCost, 0);
  const replacementMobilizationCost = replacements.filter((replacement) => replacement.status === "replacement-ready")
    .reduce((sum, replacement) => sum + commissioningContract(replacement.domainKey).replacementMobilizationCost, 0);
  const currentSiteLookup = new Map(snapshot.operationalSites.map((site) => [site.id, site]));
  const mapSites = [];
  for (const assignment of assignments) {
    const site = currentSiteLookup.get(assignment.currentHostId);
    if (site?.lat === undefined || site?.lng === undefined) continue;
    mapSites.push({
      id: `${assignment.assignmentId}:commissioning`,
      label: assignment.currentHostLabel,
      lat: site.lat,
      lng: site.lng,
      domainKey: assignment.domainKey,
      domainKeys: [assignment.domainKey],
      interventionRole: assignment.commissioningState === "commissioned" ? "treatment" : "supplemental",
      commissioningState: assignment.commissioningState,
      requiresFieldVerification: assignment.commissioningState !== "commissioned"
    });
  }
  for (const replacement of replacements.filter((entry) => entry.status === "replacement-ready")) {
    mapSites.push({
      id: `${replacement.assignmentId}:replacement`,
      label: replacement.replacementHostLabel,
      lat: replacement.lat,
      lng: replacement.lng,
      domainKey: replacement.domainKey,
      domainKeys: [replacement.domainKey],
      interventionRole: "boundary",
      commissioningState: "replacement-ready",
      requiresFieldVerification: replacement.requiresFieldVerification
    });
  }

  const metrics = {
    totalAssignments: assignments.length,
    commissionedAssignments: commissioned.length,
    provisionalAssignments: provisional.length,
    pendingAssignments: pending.length,
    offlineAssignments: offline.length,
    protectedFailures,
    unresolvedFailures,
    openTickets: openTickets.length,
    criticalTickets: openTickets.filter((ticket) => ticket.severity === "critical").length,
    highTickets: openTickets.filter((ticket) => ticket.severity === "high").length,
    meanUptime,
    meanDataCompleteness,
    calibrationCompliance: calibrationApplicable.length ? calibrationCompliant.length / calibrationApplicable.length : 1,
    maintenanceCurrentRate: assignments.length ? maintenanceCurrent.length / assignments.length : 1,
    readinessRate: assignments.length ? readinessCredit / assignments.length : 0,
    commissioningCost,
    annualMaintenanceCost,
    replacementMobilizationCost,
    firstYearOperationsCost: commissioningCost + annualMaintenanceCost + replacementMobilizationCost
  };
  const result = {
    schemaVersion: COMMISSIONING_OPERATIONS_SCHEMA_VERSION,
    architecture: "domain-aware-installation-commissioning-calibration-maintenance-and-replacement-planning",
    generatedAt: new Date(0).toISOString(),
    ready: true,
    asOfAt: normalized.asOfAt,
    trackingChecksum: config.trackingResult?.checksum ?? null,
    campaignChecksum: config.campaignResult?.checksum ?? null,
    config: normalized,
    eventBundle,
    assignments,
    commissioningQueue: queue,
    replacements,
    tickets: openTickets,
    mapSites,
    metrics,
    protected: unresolvedFailures === 0,
    claimBoundary: "Commissioning, uptime, calibration, maintenance, permit, procurement, and ticket statuses are user-supplied or controlled planning records. LUMOS does not authenticate certificates, permits, technicians, procurement, calibration traceability, data quality, asset telemetry, or deployment approval. Replacement-ready sites remain subject to renewed field verification and commissioning."
  };
  result.checksum = checksum({ ...result, generatedAt: null, checksum: null });
  return result;
}

export function commissioningOperationsRows(result) {
  if (!result?.ready) return [];
  const eventRows = result.eventBundle.events.map((event) => ({
    record_type: "event",
    assignment_id: event.assignmentId,
    host_id: event.hostId,
    domain: event.domainKey,
    role: event.role,
    state: event.operationalStatus,
    phase: "",
    asset_id: event.assetId,
    uptime: event.uptime,
    data_completeness: event.dataCompleteness,
    ticket_severity: event.ticketSeverity,
    ticket_status: event.ticketStatus,
    replacement_host_id: "",
    event_id: event.eventId,
    previous_hash: event.previousHash,
    event_hash: event.eventHash,
    notes: event.notes,
    checksum: result.checksum
  }));
  const assignmentRows = result.assignments.map((assignment) => ({
    record_type: "assignment",
    assignment_id: assignment.assignmentId,
    host_id: assignment.currentHostId ?? "",
    domain: assignment.domainKey,
    role: assignment.role,
    state: assignment.commissioningState,
    phase: result.commissioningQueue.find((entry) => entry.assignmentId === assignment.assignmentId)?.phase ?? "",
    asset_id: assignment.assetId ?? "",
    uptime: assignment.uptime,
    data_completeness: assignment.dataCompleteness,
    ticket_severity: assignment.tickets.find((ticket) => ticket.status === "open")?.severity ?? "none",
    ticket_status: assignment.tickets.some((ticket) => ticket.status === "open") ? "open" : "none",
    replacement_host_id: assignment.replacement?.replacementHostId ?? "",
    event_id: assignment.latestEventId ?? "",
    previous_hash: "",
    event_hash: "",
    notes: assignment.replacement?.status ?? "",
    checksum: result.checksum
  }));
  const replacementRows = result.replacements.map((replacement) => ({
    record_type: "replacement",
    assignment_id: replacement.assignmentId,
    host_id: replacement.failedHostId ?? "",
    domain: replacement.domainKey,
    role: replacement.role ?? "",
    state: replacement.status,
    phase: "",
    asset_id: "",
    uptime: "",
    data_completeness: "",
    ticket_severity: replacement.status === "unresolved" ? "critical" : "high",
    ticket_status: "open",
    replacement_host_id: replacement.replacementHostId ?? "",
    event_id: "",
    previous_hash: "",
    event_hash: "",
    notes: replacement.replacementHostLabel ?? "No eligible reserve",
    checksum: result.checksum
  }));
  return [...eventRows, ...assignmentRows, ...replacementRows];
}

export function rowsToCommissioningOperationsCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
