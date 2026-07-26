import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";
import { buildSharedHostPool } from "./spatial-deployment.js";

export const FIELD_CAMPAIGN_SCHEMA_VERSION = "1.0";

export const FIELD_CAMPAIGN_PROFILES = Object.freeze({
  balanced: Object.freeze({
    label: "Balanced campaign",
    description: "Balances inspection urgency, reserve coverage, operational reliability, and shared-host importance.",
    inspectionWeights: Object.freeze({ reviewNeed: 0.34, sharedImportance: 0.22, reliabilityNeed: 0.18, domainCriticality: 0.16, equity: 0.10 }),
    reserveWeights: Object.freeze({ suitability: 0.34, reliability: 0.24, review: 0.18, proximity: 0.12, equity: 0.12 })
  }),
  rapid: Object.freeze({
    label: "Rapid verification",
    description: "Prioritizes the highest-uncertainty and most heavily shared primary hosts for early inspection.",
    inspectionWeights: Object.freeze({ reviewNeed: 0.48, sharedImportance: 0.27, reliabilityNeed: 0.12, domainCriticality: 0.08, equity: 0.05 }),
    reserveWeights: Object.freeze({ suitability: 0.31, reliability: 0.19, review: 0.27, proximity: 0.17, equity: 0.06 })
  }),
  coverage: Object.freeze({
    label: "Coverage protection",
    description: "Emphasizes domain-complete reserve coverage and geographically useful replacement sites.",
    inspectionWeights: Object.freeze({ reviewNeed: 0.26, sharedImportance: 0.14, reliabilityNeed: 0.16, domainCriticality: 0.31, equity: 0.13 }),
    reserveWeights: Object.freeze({ suitability: 0.39, reliability: 0.18, review: 0.14, proximity: 0.18, equity: 0.11 })
  }),
  resilient: Object.freeze({
    label: "Resilience first",
    description: "Favors reliable independent backups and reduces dependence on shared-host failure points.",
    inspectionWeights: Object.freeze({ reviewNeed: 0.27, sharedImportance: 0.24, reliabilityNeed: 0.31, domainCriticality: 0.12, equity: 0.06 }),
    reserveWeights: Object.freeze({ suitability: 0.25, reliability: 0.39, review: 0.20, proximity: 0.06, equity: 0.10 })
  })
});

export const DEFAULT_FIELD_CAMPAIGN_CONFIG = Object.freeze({
  deploymentProfileKey: "coordinated",
  inspectionCapacityPerPhase: 8,
  maximumPhases: 3,
  reserveRatio: 0.5,
  responseScenario: "central",
  inspectionCostPerHost: 450,
  reserveMobilizationCost: 250,
  deterministicSeed: 270701,
  includeVerifiedAuditShare: 0.08
});

const RESPONSE_SCENARIOS = Object.freeze({
  optimistic: Object.freeze({ label: "Optimistic review response", failureMultiplier: 0.70 }),
  central: Object.freeze({ label: "Central review response", failureMultiplier: 1.00 }),
  conservative: Object.freeze({ label: "Conservative review response", failureMultiplier: 1.45 })
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, finite(value, low)));
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

function seededUnit(seed, key) {
  let hash = Math.max(1, Math.round(seed));
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 1664525) + 1013904223;
  }
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

function haversineKm(a, b) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b.lng - a.lng);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function normalizeStatus(value, fallback = "unverified") {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return ["verified", "not-required", "pending", "unverified", "denied"].includes(normalized) ? normalized : fallback;
}

function reviewNeed(host) {
  const statusNeed = ({ verified: 0.04, conditional: 0.68, unresolved: 1, infeasible: 1.2 })[host.reviewStatus] ?? 0.88;
  const reviewStates = [host.permissionStatus, host.accessStatus, host.powerStatus, host.safetyStatus, host.maintenanceStatus].map((status) => normalizeStatus(status));
  const pending = reviewStates.filter((status) => status === "pending" || status === "unverified").length;
  return clamp(statusNeed + 0.055 * pending);
}

function hostDomainCriticality(site) {
  if (!site.assignments?.length) return 0;
  return site.assignments.reduce((sum, assignment) => {
    const planning = DOMAIN_REGISTRY[assignment.domainKey]?.planning;
    const cost = planning?.unitCost ?? 0;
    const failure = planning?.spatialDeployment?.failureCorrelation ?? 0.5;
    const campaign = planning?.fieldCampaign ?? {};
    return sum + clamp((0.44 * cost / 8000 + 0.31 * failure + 0.25 * (campaign.inspectionPriority ?? 0.75)) * (campaign.replacementCriticality ?? 0.8));
  }, 0) / site.assignments.length;
}

function reviewScore(host) {
  return ({ verified: 1, conditional: 0.74, unresolved: 0.48, infeasible: 0 })[host.reviewStatus] ?? 0.45;
}

function operationallyFeasible(host, domainKey) {
  const contract = DOMAIN_REGISTRY[domainKey]?.planning?.spatialDeployment;
  if (!contract || host.reviewStatus === "infeasible") return false;
  if (Array.isArray(host.eligibleDomains) && !host.eligibleDomains.includes(domainKey)) return false;
  if (host.permissionStatus === "denied" || host.accessStatus === "denied" || host.safetyStatus === "denied" || host.maintenanceStatus === "denied") return false;
  if (domainKey === "air" && host.powerStatus === "denied") return false;
  if (finite(host.domainSuitability?.[domainKey], 0) < contract.minimumSuitability) return false;
  if (finite(host.access, 0) < contract.minimumAccess) return false;
  if (finite(host.power, 0) < contract.minimumPower) return false;
  const reserveFloor = DOMAIN_REGISTRY[domainKey]?.planning?.fieldCampaign?.reserveReliabilityFloor ?? 0;
  if (finite(host.reliability, 0) < reserveFloor) return false;
  if (domainKey === "water" && finite(host.waterConnectivity, 0) < 0.42) return false;
  if (contract.excludedHosts?.includes(host.category)) return false;
  return true;
}

export function normalizeFieldCampaignConfig(config = {}) {
  const deploymentResult = config.deploymentResult ?? null;
  const availableProfiles = deploymentResult?.portfolio?.map((plan) => plan.profileKey) ?? [];
  const requestedProfile = String(config.deploymentProfileKey ?? DEFAULT_FIELD_CAMPAIGN_CONFIG.deploymentProfileKey);
  const responseScenario = RESPONSE_SCENARIOS[config.responseScenario] ? config.responseScenario : DEFAULT_FIELD_CAMPAIGN_CONFIG.responseScenario;
  return {
    deploymentResult,
    deploymentProfileKey: availableProfiles.includes(requestedProfile) ? requestedProfile : (availableProfiles[0] ?? requestedProfile),
    inspectionCapacityPerPhase: integer(config.inspectionCapacityPerPhase, DEFAULT_FIELD_CAMPAIGN_CONFIG.inspectionCapacityPerPhase, 1, 40),
    maximumPhases: integer(config.maximumPhases, DEFAULT_FIELD_CAMPAIGN_CONFIG.maximumPhases, 1, 8),
    reserveRatio: clamp(config.reserveRatio ?? DEFAULT_FIELD_CAMPAIGN_CONFIG.reserveRatio, 0, 1.5),
    responseScenario,
    inspectionCostPerHost: Math.max(0, finite(config.inspectionCostPerHost, DEFAULT_FIELD_CAMPAIGN_CONFIG.inspectionCostPerHost)),
    reserveMobilizationCost: Math.max(0, finite(config.reserveMobilizationCost, DEFAULT_FIELD_CAMPAIGN_CONFIG.reserveMobilizationCost)),
    deterministicSeed: integer(config.deterministicSeed, DEFAULT_FIELD_CAMPAIGN_CONFIG.deterministicSeed, 1, 2147483647),
    includeVerifiedAuditShare: clamp(config.includeVerifiedAuditShare ?? DEFAULT_FIELD_CAMPAIGN_CONFIG.includeVerifiedAuditShare, 0, 0.5)
  };
}

function activeDeploymentPlan(config) {
  const plan = config.deploymentResult?.portfolio?.find((entry) => entry.profileKey === config.deploymentProfileKey)
    ?? config.deploymentResult?.portfolio?.[0];
  if (!plan) throw new Error("Run coordinated spatial deployment before planning field operations.");
  return plan;
}

function buildQueue(plan, config, profile) {
  const verified = plan.sites.filter((site) => site.reviewStatus === "verified");
  const verifiedAuditCount = Math.ceil(verified.length * config.includeVerifiedAuditShare);
  const verifiedAuditIds = new Set(verified
    .slice()
    .sort((a, b) => (a.reliability ?? 0) - (b.reliability ?? 0) || a.id.localeCompare(b.id))
    .slice(0, verifiedAuditCount)
    .map((site) => site.id));
  const candidates = plan.sites.filter((site) => site.reviewStatus !== "verified" || verifiedAuditIds.has(site.id));
  const rows = candidates.map((site) => {
    const sharedImportance = clamp((site.assignments?.length ?? 1) / 3);
    const reliabilityNeed = 1 - clamp(site.reliability ?? 0.5);
    const criticality = hostDomainCriticality(site);
    const priority = profile.inspectionWeights.reviewNeed * reviewNeed(site)
      + profile.inspectionWeights.sharedImportance * sharedImportance
      + profile.inspectionWeights.reliabilityNeed * reliabilityNeed
      + profile.inspectionWeights.domainCriticality * criticality
      + profile.inspectionWeights.equity * clamp(site.equity ?? 0.5);
    return {
      hostId: site.id,
      label: site.label,
      reviewStatus: site.reviewStatus,
      assignments: site.assignments.map((assignment) => assignment.domainKey),
      assignmentCount: site.assignments.length,
      priority,
      sharedImportance,
      reliability: site.reliability,
      equity: site.equity,
      verifiedAudit: verifiedAuditIds.has(site.id)
    };
  }).sort((a, b) => b.priority - a.priority || b.assignmentCount - a.assignmentCount || a.hostId.localeCompare(b.hostId));
  const capacity = config.inspectionCapacityPerPhase * config.maximumPhases;
  return rows.map((row, index) => ({
    ...row,
    queueRank: index + 1,
    scheduled: index < capacity,
    phase: index < capacity ? Math.floor(index / config.inspectionCapacityPerPhase) + 1 : null
  }));
}

function failureProbability(site, config) {
  if (site.reviewStatus === "verified") return 0.015;
  const base = site.reviewStatus === "conditional" ? 0.15 : 0.31;
  const states = [site.permissionStatus, site.accessStatus, site.powerStatus, site.safetyStatus, site.maintenanceStatus].map((status) => normalizeStatus(status));
  const unresolvedShare = states.filter((status) => status === "pending" || status === "unverified").length / states.length;
  const reliabilityPenalty = 1 - clamp(site.reliability ?? 0.5);
  return clamp(base * RESPONSE_SCENARIOS[config.responseScenario].failureMultiplier * (0.78 + 0.70 * unresolvedShare + 0.65 * reliabilityPenalty), 0.01, 0.92);
}

function evaluateInspections(plan, queue, config, profileKey) {
  const queueById = new Map(queue.map((entry) => [entry.hostId, entry]));
  return plan.sites.map((site) => {
    const queued = queueById.get(site.id);
    if (!queued?.scheduled) {
      return {
        hostId: site.id,
        label: site.label,
        scheduled: false,
        phase: null,
        reviewStatus: site.reviewStatus,
        outcome: site.reviewStatus === "verified" ? "accepted" : "not-inspected",
        failureProbability: site.reviewStatus === "verified" ? 0 : failureProbability(site, config),
        assignments: site.assignments
      };
    }
    const probability = failureProbability(site, config);
    const draw = seededUnit(config.deterministicSeed, `${profileKey}:${site.id}:inspection`);
    return {
      hostId: site.id,
      label: site.label,
      scheduled: true,
      phase: queued.phase,
      reviewStatus: site.reviewStatus,
      outcome: draw < probability ? "rejected" : "accepted",
      failureProbability: probability,
      assignments: site.assignments
    };
  });
}

function reserveCandidatesForAssignment({ assignment, primarySite, hostPool, primaryIds, usedReserveIds, config, profile }) {
  return hostPool.filter((host) => !primaryIds.has(host.id) && !usedReserveIds.has(host.id) && operationallyFeasible(host, assignment.domainKey)).map((host) => {
    const distance = haversineKm(primarySite, host);
    const targetDistance = Math.max(0.5, DOMAIN_REGISTRY[assignment.domainKey].planning.spatialDeployment.minimumSpacingKm * 2.5);
    const proximity = 1 / (1 + Math.abs(distance - targetDistance) / targetDistance);
    const score = profile.reserveWeights.suitability * clamp(host.domainSuitability?.[assignment.domainKey] ?? 0)
      + profile.reserveWeights.reliability * clamp(host.reliability ?? 0.5)
      + profile.reserveWeights.review * reviewScore(host)
      + profile.reserveWeights.proximity * proximity
      + profile.reserveWeights.equity * clamp(host.equity ?? 0.5);
    return { host, distance, score };
  }).sort((a, b) => b.score - a.score || b.host.reliability - a.host.reliability || a.host.id.localeCompare(b.host.id));
}

function buildReserves(plan, hostPool, config, profile) {
  const primaryIds = new Set(plan.sites.map((site) => site.id));
  const usedReserveIds = new Set();
  const reserves = [];
  for (const domainKey of PUBLIC_DOMAIN_KEYS) {
    const primaries = plan.sites.flatMap((site) => site.assignments.filter((assignment) => assignment.domainKey === domainKey).map((assignment) => ({ assignment, site })));
    const quota = Math.min(primaries.length, Math.ceil(primaries.length * config.reserveRatio));
    const prioritized = primaries.slice().sort((a, b) => reviewNeed(b.site) - reviewNeed(a.site) || (a.site.reliability ?? 0) - (b.site.reliability ?? 0) || a.site.id.localeCompare(b.site.id));
    for (const primary of prioritized.slice(0, quota)) {
      const candidate = reserveCandidatesForAssignment({
        assignment: primary.assignment,
        primarySite: primary.site,
        hostPool,
        primaryIds,
        usedReserveIds,
        config,
        profile
      })[0];
      if (!candidate) continue;
      usedReserveIds.add(candidate.host.id);
      reserves.push({
        reserveId: `${domainKey}-reserve-${reserves.filter((entry) => entry.domainKey === domainKey).length + 1}`,
        domainKey,
        primaryHostId: primary.site.id,
        primaryHostLabel: primary.site.label,
        primaryAssignmentRole: primary.assignment.role,
        hostId: candidate.host.id,
        label: candidate.host.label,
        category: candidate.host.category,
        reviewStatus: candidate.host.reviewStatus,
        reliability: candidate.host.reliability,
        suitability: candidate.host.domainSuitability[domainKey],
        distanceKm: candidate.distance,
        score: candidate.score,
        lat: candidate.host.lat,
        lng: candidate.host.lng,
        requiresFieldVerification: candidate.host.requiresFieldVerification !== false
      });
    }
  }
  return reserves;
}

function applyReplacementWorkflow(plan, inspections, reserves) {
  const reserveByDomain = new Map(PUBLIC_DOMAIN_KEYS.map((key) => [key, reserves.filter((entry) => entry.domainKey === key)]));
  const used = new Set();
  const replacements = [];
  const unresolved = [];
  for (const inspection of inspections) {
    if (inspection.outcome === "accepted") continue;
    for (const assignment of inspection.assignments) {
      if (inspection.outcome === "not-inspected") {
        unresolved.push({ hostId: inspection.hostId, domainKey: assignment.domainKey, reason: "Primary host remains uninspected." });
        continue;
      }
      const reserve = (reserveByDomain.get(assignment.domainKey) ?? []).find((entry) => !used.has(entry.reserveId));
      if (!reserve) {
        unresolved.push({ hostId: inspection.hostId, domainKey: assignment.domainKey, reason: "No eligible reserve host was available." });
        continue;
      }
      used.add(reserve.reserveId);
      replacements.push({
        failedHostId: inspection.hostId,
        failedHostLabel: inspection.label,
        domainKey: assignment.domainKey,
        role: assignment.role,
        reserveId: reserve.reserveId,
        replacementHostId: reserve.hostId,
        replacementHostLabel: reserve.label,
        reviewStatus: reserve.reviewStatus,
        reliability: reserve.reliability,
        suitability: reserve.suitability,
        distanceKm: reserve.distanceKm
      });
    }
  }
  return { replacements, unresolved, usedReserveCount: used.size };
}

function evaluateCampaign(profileKey, plan, hostPool, config) {
  const profile = FIELD_CAMPAIGN_PROFILES[profileKey];
  const queue = buildQueue(plan, config, profile);
  const inspections = evaluateInspections(plan, queue, config, profileKey);
  const reserves = buildReserves(plan, hostPool, config, profile);
  const workflow = applyReplacementWorkflow(plan, inspections, reserves);
  const requestedAssignments = plan.metrics.assignedUnits;
  const scheduledInspections = queue.filter((entry) => entry.scheduled).length;
  const rejectedHosts = inspections.filter((entry) => entry.outcome === "rejected").length;
  const acceptedHosts = inspections.filter((entry) => entry.outcome === "accepted").length;
  const notInspectedHosts = inspections.filter((entry) => entry.outcome === "not-inspected").length;
  const reserveCoverageRate = requestedAssignments ? reserves.length / requestedAssignments : 0;
  const replacementDemand = inspections.filter((entry) => entry.outcome === "rejected").reduce((sum, entry) => sum + entry.assignments.length, 0);
  const replacementRecoveryRate = replacementDemand ? workflow.replacements.length / replacementDemand : 1;
  const operationallyProtectedAssignments = requestedAssignments - workflow.unresolved.length;
  const operationalResilience = requestedAssignments ? operationallyProtectedAssignments / requestedAssignments : 0;
  const inspectionCompletion = queue.length ? scheduledInspections / queue.length : 1;
  const campaignCost = scheduledInspections * config.inspectionCostPerHost + reserves.length * config.reserveMobilizationCost;
  const meanReserveReliability = reserves.length ? reserves.reduce((sum, reserve) => sum + reserve.reliability, 0) / reserves.length : 0;
  const sharedFailureExposure = plan.metrics.correlatedFailureRisk;
  const score = 0.26 * operationalResilience
    + 0.20 * replacementRecoveryRate
    + 0.18 * clamp(reserveCoverageRate / Math.max(0.01, config.reserveRatio || 1))
    + 0.14 * inspectionCompletion
    + 0.12 * meanReserveReliability
    + 0.10 * (1 - sharedFailureExposure);
  return {
    profileKey,
    profile,
    complete: workflow.unresolved.length === 0,
    queue,
    inspections,
    reserves,
    replacements: workflow.replacements,
    unresolvedAssignments: workflow.unresolved,
    metrics: {
      requestedAssignments,
      primaryHostCount: plan.metrics.physicalHostCount,
      queuedHosts: queue.length,
      scheduledInspections,
      inspectionPhasesUsed: Math.max(0, ...queue.filter((entry) => entry.scheduled).map((entry) => entry.phase ?? 0)),
      acceptedHosts,
      rejectedHosts,
      notInspectedHosts,
      reserveCount: reserves.length,
      reserveCoverageRate,
      replacementDemand,
      recoveredAssignments: workflow.replacements.length,
      replacementRecoveryRate,
      unresolvedAssignments: workflow.unresolved.length,
      operationalResilience,
      inspectionCompletion,
      meanReserveReliability,
      sharedFailureExposure,
      campaignCost,
      score
    }
  };
}

function dominates(left, right) {
  const leftVector = [left.metrics.operationalResilience, left.metrics.replacementRecoveryRate, left.metrics.inspectionCompletion, left.metrics.meanReserveReliability, -left.metrics.campaignCost];
  const rightVector = [right.metrics.operationalResilience, right.metrics.replacementRecoveryRate, right.metrics.inspectionCompletion, right.metrics.meanReserveReliability, -right.metrics.campaignCost];
  return leftVector.every((value, index) => value >= rightVector[index] - 1e-12)
    && leftVector.some((value, index) => value > rightVector[index] + 1e-12);
}

export function planFieldCampaign(config = {}) {
  const normalized = normalizeFieldCampaignConfig(config);
  const deploymentPlan = activeDeploymentPlan(normalized);
  const hostPool = buildSharedHostPool(normalized.deploymentResult.config);
  const portfolio = Object.keys(FIELD_CAMPAIGN_PROFILES).map((profileKey) => evaluateCampaign(profileKey, deploymentPlan, hostPool, normalized));
  for (const campaign of portfolio) campaign.paretoOptimal = !portfolio.some((other) => other.profileKey !== campaign.profileKey && dominates(other, campaign));
  const result = {
    schemaVersion: FIELD_CAMPAIGN_SCHEMA_VERSION,
    architecture: "field-campaign-operations-and-reserve-site-planning",
    generatedAt: new Date(0).toISOString(),
    ready: Boolean(deploymentPlan),
    deploymentChecksum: normalized.deploymentResult.checksum,
    deploymentProfileKey: deploymentPlan.profileKey,
    responseScenario: normalized.responseScenario,
    responseScenarioLabel: RESPONSE_SCENARIOS[normalized.responseScenario].label,
    config: { ...normalized, deploymentResult: undefined },
    hostPoolCount: hostPool.length,
    portfolio,
    claimBoundary: "Inspection outcomes and reserve activation are deterministic planning scenarios under declared response assumptions. They do not authenticate host reviews, replace site visits, grant permission, establish safety, or guarantee that a reserve property can accept a domain-specific monitor or sample."
  };
  result.checksum = checksum({ ...result, generatedAt: null, checksum: null });
  return result;
}

export function fieldCampaignRows(result) {
  if (!result?.ready) return [];
  return result.portfolio.flatMap((campaign) => {
    const inspectionRows = campaign.inspections.map((inspection) => ({
      record_type: "inspection",
      profile: campaign.profileKey,
      profile_label: campaign.profile.label,
      pareto: campaign.paretoOptimal,
      complete: campaign.complete,
      host_id: inspection.hostId,
      host_label: inspection.label,
      phase: inspection.phase ?? "",
      scheduled: inspection.scheduled,
      review_status: inspection.reviewStatus,
      outcome: inspection.outcome,
      failure_probability: inspection.failureProbability,
      domains: inspection.assignments.map((assignment) => assignment.domainKey).join("|"),
      reserve_id: "",
      replacement_host_id: "",
      campaign_cost: campaign.metrics.campaignCost,
      checksum: result.checksum
    }));
    const reserveRows = campaign.reserves.map((reserve) => ({
      record_type: "reserve",
      profile: campaign.profileKey,
      profile_label: campaign.profile.label,
      pareto: campaign.paretoOptimal,
      complete: campaign.complete,
      host_id: reserve.primaryHostId,
      host_label: reserve.primaryHostLabel,
      phase: "",
      scheduled: "",
      review_status: reserve.reviewStatus,
      outcome: "reserve-candidate",
      failure_probability: "",
      domains: reserve.domainKey,
      reserve_id: reserve.reserveId,
      replacement_host_id: reserve.hostId,
      campaign_cost: campaign.metrics.campaignCost,
      checksum: result.checksum
    }));
    const replacementRows = campaign.replacements.map((replacement) => ({
      record_type: "replacement",
      profile: campaign.profileKey,
      profile_label: campaign.profile.label,
      pareto: campaign.paretoOptimal,
      complete: campaign.complete,
      host_id: replacement.failedHostId,
      host_label: replacement.failedHostLabel,
      phase: "",
      scheduled: true,
      review_status: replacement.reviewStatus,
      outcome: "replacement-activated",
      failure_probability: "",
      domains: replacement.domainKey,
      reserve_id: replacement.reserveId,
      replacement_host_id: replacement.replacementHostId,
      campaign_cost: campaign.metrics.campaignCost,
      checksum: result.checksum
    }));
    return [...inspectionRows, ...reserveRows, ...replacementRows];
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToFieldCampaignCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
