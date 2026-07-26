import { DOMAIN_REGISTRY, PUBLIC_DOMAIN_KEYS } from "../../config/domain-registry.js";
import {
  HOST_REVIEW_POLICIES,
  hostPassesReviewPolicy,
  prepareHostInventoryForDeployment,
  summarizeHostInventory
} from "./host-inventory.js";

export const SPATIAL_DEPLOYMENT_SCHEMA_VERSION = "1.1";

export const SPATIAL_DEPLOYMENT_PROFILES = Object.freeze({
  coordinated: Object.freeze({
    label: "Coordinated Balanced",
    shortLabel: "Balanced",
    description: "Balances domain suitability, spatial coverage, equity, reliability, and defensible shared-host savings.",
    weights: Object.freeze({ suitability: 0.28, separation: 0.18, equity: 0.18, reliability: 0.14, savings: 0.14, resilience: 0.08 })
  }),
  savings: Object.freeze({
    label: "Shared Infrastructure",
    shortLabel: "Savings",
    description: "Prioritizes compatible co-location and shared infrastructure without violating domain feasibility rules.",
    weights: Object.freeze({ suitability: 0.22, separation: 0.10, equity: 0.10, reliability: 0.10, savings: 0.40, resilience: 0.08 })
  }),
  coverage: Object.freeze({
    label: "Coverage Protection",
    shortLabel: "Coverage",
    description: "Protects within-domain spatial separation and local scientific suitability before seeking savings.",
    weights: Object.freeze({ suitability: 0.34, separation: 0.34, equity: 0.12, reliability: 0.10, savings: 0.04, resilience: 0.06 })
  }),
  equity: Object.freeze({
    label: "Equity Shared Access",
    shortLabel: "Equity",
    description: "Favors accessible shared hosts in high-vulnerability and high-community-priority areas.",
    weights: Object.freeze({ suitability: 0.22, separation: 0.14, equity: 0.38, reliability: 0.10, savings: 0.10, resilience: 0.06 })
  }),
  resilient: Object.freeze({
    label: "Failure-Resilient",
    shortLabel: "Resilient",
    description: "Limits correlated failure and host concentration while protecting reliable domain-specific coverage.",
    weights: Object.freeze({ suitability: 0.25, separation: 0.22, equity: 0.12, reliability: 0.18, savings: 0.05, resilience: 0.18 })
  })
});

const HOST_CATEGORIES = Object.freeze([
  "municipal", "school", "park", "transit", "community", "utility",
  "treatment", "industrial-edge", "watershed-access", "background"
]);

const HOST_LABELS = Object.freeze({
  municipal: "Municipal facility proxy",
  school: "School or childcare proxy",
  park: "Park or recreation proxy",
  transit: "Transit or mobility proxy",
  community: "Community facility proxy",
  utility: "Utility infrastructure proxy",
  treatment: "Treatment facility proxy",
  "industrial-edge": "Industrial-edge proxy",
  "watershed-access": "Watershed access proxy",
  background: "Background/reference proxy"
});

const COMPATIBILITY = Object.freeze({
  "air|heat": 0.88,
  "heat|soil": 0.76,
  "heat|water": 0.58,
  "air|soil": 0.48,
  "air|water": 0.69,
  "soil|water": 0.61
});

export const DEFAULT_SPATIAL_DEPLOYMENT_CONFIG = Object.freeze({
  seed: 250501,
  bounds: Object.freeze({ west: -105.13, south: 39.63, east: -104.85, north: 39.84 }),
  hostCount: 72,
  sharedHostDiscount: 0.18,
  maximumDomainsPerHost: 3,
  minimumCompatibility: 0.55,
  colocationRadiusKm: 0.25,
  allocationSource: "initial",
  hostSource: "controlled",
  fieldReviewPolicy: "all-not-denied",
  hostInventory: Object.freeze([]),
  units: Object.freeze({ heat: 9, air: 5, soil: 22, water: 6 })
});

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, Number(value) || 0));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function halton(index, base) {
  let result = 0;
  let fraction = 1 / base;
  let current = index;
  while (current > 0) {
    result += fraction * (current % base);
    current = Math.floor(current / base);
    fraction /= base;
  }
  return result;
}

function compatibility(left, right) {
  if (left === right) return 1;
  return COMPATIBILITY[[left, right].sort().join("|")] ?? 0.35;
}

function distanceKm(left, right) {
  const meanLat = ((left.lat + right.lat) / 2) * Math.PI / 180;
  const dx = (left.lng - right.lng) * 111.32 * Math.cos(meanLat);
  const dy = (left.lat - right.lat) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeBounds(bounds = {}) {
  let west = finite(bounds.west, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds.west);
  let east = finite(bounds.east, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds.east);
  let south = finite(bounds.south, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds.south);
  let north = finite(bounds.north, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds.north);
  if (east <= west) [west, east] = [Math.min(west, east), Math.max(west, east) + 0.05];
  if (north <= south) [south, north] = [Math.min(south, north), Math.max(south, north) + 0.05];
  const maximumSpan = 2.5;
  if (east - west > maximumSpan) {
    const center = (east + west) / 2;
    west = center - maximumSpan / 2;
    east = center + maximumSpan / 2;
  }
  if (north - south > maximumSpan) {
    const center = (north + south) / 2;
    south = center - maximumSpan / 2;
    north = center + maximumSpan / 2;
  }
  return { west, south, east, north };
}

export function normalizeSpatialDeploymentConfig(config = {}) {
  const bounds = normalizeBounds(config.bounds ?? DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds);
  const units = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => {
    const maximum = DOMAIN_REGISTRY[domainKey].planning.maximumUnits;
    return [domainKey, Math.max(0, Math.min(maximum, Math.round(finite(config.units?.[domainKey], DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.units[domainKey]))))];
  }));
  return {
    seed: Math.max(1, Math.round(finite(config.seed, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.seed))),
    bounds,
    hostCount: Math.max(36, Math.min(160, Math.round(finite(config.hostCount, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.hostCount)))),
    sharedHostDiscount: clamp(config.sharedHostDiscount ?? DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.sharedHostDiscount, 0, 0.4),
    maximumDomainsPerHost: Math.max(1, Math.min(4, Math.round(finite(config.maximumDomainsPerHost, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.maximumDomainsPerHost)))),
    minimumCompatibility: clamp(config.minimumCompatibility ?? DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.minimumCompatibility, 0.25, 0.95),
    colocationRadiusKm: Math.max(0.05, Math.min(2, finite(config.colocationRadiusKm, DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.colocationRadiusKm))),
    allocationSource: String(config.allocationSource ?? DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.allocationSource),
    hostSource: ["controlled", "inventory", "hybrid"].includes(config.hostSource) ? config.hostSource : DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.hostSource,
    fieldReviewPolicy: HOST_REVIEW_POLICIES[config.fieldReviewPolicy] ? config.fieldReviewPolicy : DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.fieldReviewPolicy,
    hostInventory: Array.isArray(config.hostInventory) ? config.hostInventory : (config.hostInventory?.records ?? []),
    units
  };
}

function hostBaseSuitability(category, domainKey) {
  const table = {
    heat: { municipal: 0.82, school: 0.96, park: 0.94, transit: 0.84, community: 0.91, utility: 0.58, treatment: 0.46, "industrial-edge": 0.48, "watershed-access": 0.62, background: 0.70 },
    air: { municipal: 0.76, school: 0.72, park: 0.67, transit: 0.96, community: 0.68, utility: 0.83, treatment: 0.72, "industrial-edge": 0.94, "watershed-access": 0.50, background: 0.90 },
    soil: { municipal: 0.68, school: 0.93, park: 0.96, transit: 0.44, community: 0.92, utility: 0.58, treatment: 0.55, "industrial-edge": 0.95, "watershed-access": 0.75, background: 0.65 },
    water: { municipal: 0.62, school: 0.45, park: 0.69, transit: 0.34, community: 0.48, utility: 0.91, treatment: 0.98, "industrial-edge": 0.68, "watershed-access": 0.98, background: 0.78 }
  };
  return table[domainKey]?.[category] ?? 0.4;
}

function domainRole(domainKey, host) {
  if (domainKey === "heat") {
    if (host.category === "park") return "canopy-gap";
    if (host.exposure > 0.7) return "exposure";
    return "reference";
  }
  if (domainKey === "air") {
    if (["transit", "industrial-edge"].includes(host.category)) return "source-oriented";
    if (host.category === "background") return "background";
    return "community";
  }
  if (domainKey === "soil") {
    if (host.category === "industrial-edge") return "disturbance";
    if (["school", "community"].includes(host.category)) return "community-safety";
    return "ecological";
  }
  if (["treatment", "utility"].includes(host.category)) return "treatment-system";
  if (host.sourcePressure > 0.67) return "upstream-source";
  if (host.exposure > 0.67) return "downstream-receptor";
  return "reference";
}

function buildControlledHostPool(config = DEFAULT_SPATIAL_DEPLOYMENT_CONFIG) {
  const normalized = normalizeSpatialDeploymentConfig(config);
  const random = mulberry32(normalized.seed);
  const hosts = [];
  for (let index = 1; index <= normalized.hostCount; index += 1) {
    const x = clamp(halton(index + normalized.seed % 17, 2) + (random() - 0.5) * 0.018, 0.015, 0.985);
    const y = clamp(halton(index + normalized.seed % 23, 3) + (random() - 0.5) * 0.018, 0.015, 0.985);
    const category = HOST_CATEGORIES[(index + Math.floor(random() * HOST_CATEGORIES.length)) % HOST_CATEGORIES.length];
    const vulnerability = clamp(0.16 + 0.60 * Math.exp(-((x - 0.27) ** 2 + (y - 0.70) ** 2) / 0.08) + random() * 0.17);
    const exposure = clamp(0.14 + 0.55 * Math.exp(-((x - 0.64) ** 2 + (y - 0.42) ** 2) / 0.10) + 0.20 * Math.abs(Math.sin(5 * x + 2 * y)));
    const ecology = clamp(0.10 + 0.70 * Math.exp(-((x - 0.57) ** 2 + (y - 0.82) ** 2) / 0.11) + random() * 0.12);
    const sourcePressure = clamp(0.10 + 0.72 * Math.exp(-((x - 0.79) ** 2 + (y - 0.63) ** 2) / 0.07) + 0.16 * Math.abs(Math.sin(7 * y)));
    const waterConnectivity = clamp(0.08 + 0.78 * Math.exp(-((y - (0.18 + 0.23 * x)) ** 2) / 0.018));
    const access = clamp(0.62 + random() * 0.34 - (category === "industrial-edge" ? 0.10 : 0));
    const power = clamp(0.54 + random() * 0.42 + (["municipal", "school", "utility", "treatment", "transit"].includes(category) ? 0.12 : 0));
    const maintenance = clamp(0.58 + random() * 0.38 + (["municipal", "school", "community", "utility"].includes(category) ? 0.10 : 0));
    const reliability = clamp(0.70 + 0.10 * power + 0.10 * maintenance + random() * 0.10);
    const equity = clamp(0.58 * vulnerability + 0.26 * exposure + 0.16 * (category === "community" || category === "school" ? 1 : 0));
    const lng = normalized.bounds.west + x * (normalized.bounds.east - normalized.bounds.west);
    const lat = normalized.bounds.south + y * (normalized.bounds.north - normalized.bounds.south);
    const domainSuitability = Object.fromEntries(PUBLIC_DOMAIN_KEYS.map((domainKey) => {
      const base = hostBaseSuitability(category, domainKey);
      const domainSignal = domainKey === "heat"
        ? 0.30 * exposure + 0.22 * vulnerability + 0.12 * (1 - ecology)
        : domainKey === "air"
          ? 0.28 * sourcePressure + 0.24 * exposure + 0.12 * power
          : domainKey === "soil"
            ? 0.26 * sourcePressure + 0.20 * ecology + 0.18 * vulnerability
            : 0.32 * waterConnectivity + 0.22 * sourcePressure + 0.14 * exposure;
      return [domainKey, clamp(0.58 * base + domainSignal + 0.08 * access + 0.05 * reliability)];
    }));
    hosts.push({
      id: `shared-host-${String(index).padStart(3, "0")}`,
      label: `${HOST_LABELS[category]} ${String(index).padStart(2, "0")}`,
      category,
      x,
      y,
      lng,
      lat,
      vulnerability,
      exposure,
      ecology,
      sourcePressure,
      waterConnectivity,
      access,
      power,
      maintenance,
      reliability,
      equity,
      domainSuitability,
      permissionStatus: "unverified",
      accessStatus: "unverified",
      powerStatus: "unverified",
      safetyStatus: "unverified",
      maintenanceStatus: "unverified",
      reviewStatus: "unresolved",
      fieldVerified: false,
      eligibleDomains: [...PUBLIC_DOMAIN_KEYS],
      sourceType: "controlled-proxy",
      withinBounds: true,
      requiresFieldVerification: true
    });
  }
  return hosts;
}

export function buildSharedHostPool(config = DEFAULT_SPATIAL_DEPLOYMENT_CONFIG) {
  const normalized = normalizeSpatialDeploymentConfig(config);
  const inventory = prepareHostInventoryForDeployment(normalized.hostInventory, normalized.bounds)
    .filter((host) => host.withinBounds);
  if (normalized.hostSource === "inventory") return inventory;
  const controlled = buildControlledHostPool(normalized);
  if (normalized.hostSource === "hybrid") {
    const ids = new Set(inventory.map((host) => host.id));
    return [...inventory, ...controlled.filter((host) => !ids.has(host.id))];
  }
  return controlled;
}

function hostFeasibleForDomain(host, domainKey, config) {
  const contract = DOMAIN_REGISTRY[domainKey].planning.spatialDeployment;
  if (!contract) return false;
  if (host.withinBounds === false) return false;
  if (!(host.eligibleDomains ?? PUBLIC_DOMAIN_KEYS).includes(domainKey)) return false;
  if (!hostPassesReviewPolicy(host, config.fieldReviewPolicy)) return false;
  if (host.permissionStatus === "denied" || host.accessStatus === "denied" || host.safetyStatus === "denied" || host.maintenanceStatus === "denied") return false;
  if (domainKey === "air" && host.powerStatus === "denied") return false;
  if (contract.excludedHosts.includes(host.category)) return false;
  if (host.access < contract.minimumAccess) return false;
  if (domainKey === "air" && host.power < contract.minimumPower) return false;
  if (domainKey === "water" && host.waterConnectivity < 0.24 && !["utility", "treatment"].includes(host.category)) return false;
  return host.domainSuitability[domainKey] >= contract.minimumSuitability;
}

function assignmentSavings(host, domainKey, assignments, config) {
  if (!assignments.length) return 0;
  const contract = DOMAIN_REGISTRY[domainKey].planning.spatialDeployment;
  const meanCompatibility = assignments.reduce((sum, assignment) => sum + compatibility(domainKey, assignment.domainKey), 0) / assignments.length;
  return DOMAIN_REGISTRY[domainKey].planning.unitCost
    * contract.sharedInfrastructureShare
    * config.sharedHostDiscount
    * meanCompatibility;
}

function separationScore(host, domainKey, selected) {
  const sameDomain = selected.filter((assignment) => assignment.domainKey === domainKey);
  if (!sameDomain.length) return 1;
  const nearest = Math.min(...sameDomain.map((assignment) => distanceKm(host, assignment.host)));
  const minimum = DOMAIN_REGISTRY[domainKey].planning.spatialDeployment.minimumSpacingKm;
  return clamp(nearest / Math.max(0.01, minimum * 1.8));
}

function candidateScore({ host, domainKey, selected, assignmentsAtHost, profile, config }) {
  const contract = DOMAIN_REGISTRY[domainKey].planning.spatialDeployment;
  const savings = assignmentSavings(host, domainKey, assignmentsAtHost, config);
  const savingRatio = savings / DOMAIN_REGISTRY[domainKey].planning.unitCost;
  const separation = separationScore(host, domainKey, selected);
  const compatibilityFloor = assignmentsAtHost.length
    ? Math.min(...assignmentsAtHost.map((assignment) => compatibility(domainKey, assignment.domainKey)))
    : 1;
  const resilience = clamp(
    0.55 * host.reliability
    + 0.25 * (1 - assignmentsAtHost.length / Math.max(1, config.maximumDomainsPerHost))
    + 0.20 * compatibilityFloor
  );
  const reviewFactor = host.reviewStatus === "verified" ? 1 : host.reviewStatus === "conditional" ? 0.84 : host.reviewStatus === "unresolved" ? 0.62 : 0;
  const score = profile.weights.suitability * host.domainSuitability[domainKey] * (0.76 + 0.24 * reviewFactor)
    + profile.weights.separation * separation
    + profile.weights.equity * host.equity
    + profile.weights.reliability * host.reliability
    + profile.weights.savings * clamp(savingRatio / Math.max(0.01, contract.sharedInfrastructureShare * config.sharedHostDiscount))
    + profile.weights.resilience * resilience;
  return { score, savings, separation, resilience, compatibilityFloor, reviewFactor };
}

function chooseAssignment({ domainKey, hosts, selected, byHost, profile, config }) {
  let best = null;
  for (const host of hosts) {
    if (!hostFeasibleForDomain(host, domainKey, config)) continue;
    const assignmentsAtHost = byHost.get(host.id) ?? [];
    if (assignmentsAtHost.some((assignment) => assignment.domainKey === domainKey)) continue;
    if (assignmentsAtHost.length >= config.maximumDomainsPerHost) continue;
    if (assignmentsAtHost.length) {
      const compatible = assignmentsAtHost.every((assignment) => compatibility(domainKey, assignment.domainKey) >= config.minimumCompatibility);
      if (!compatible) continue;
    }
    const scored = candidateScore({ host, domainKey, selected, assignmentsAtHost, profile, config });
    const sameDomain = selected.filter((assignment) => assignment.domainKey === domainKey);
    const minimumSpacing = DOMAIN_REGISTRY[domainKey].planning.spatialDeployment.minimumSpacingKm;
    if (sameDomain.length && scored.separation < 0.22) continue;
    const tie = host.id.localeCompare(best?.host.id ?? "");
    if (!best || scored.score > best.score + 1e-12 || (Math.abs(scored.score - best.score) <= 1e-12 && tie < 0)) {
      best = { host, domainKey, ...scored };
    }
  }
  return best;
}

function domainOrder(units, strategy) {
  const keys = PUBLIC_DOMAIN_KEYS.filter((key) => units[key] > 0);
  if (strategy === "cost-desc") return [...keys].sort((a, b) => DOMAIN_REGISTRY[b].planning.unitCost - DOMAIN_REGISTRY[a].planning.unitCost);
  if (strategy === "scarcity") return [...keys].sort((a, b) => units[a] - units[b] || a.localeCompare(b));
  return [...keys];
}

function buildSequence(units, strategy) {
  const sequence = [];
  const remaining = { ...units };
  const order = domainOrder(units, strategy);
  while (order.some((key) => remaining[key] > 0)) {
    for (const domainKey of order) {
      if (remaining[domainKey] <= 0) continue;
      sequence.push(domainKey);
      remaining[domainKey] -= 1;
    }
  }
  return sequence;
}

function evaluatePlan(selected, config, profileKey) {
  const physicalHosts = new Map();
  for (const assignment of selected) {
    const record = physicalHosts.get(assignment.host.id) ?? { host: assignment.host, assignments: [] };
    record.assignments.push(assignment);
    physicalHosts.set(assignment.host.id, record);
  }
  const baseCost = selected.reduce((sum, assignment) => sum + DOMAIN_REGISTRY[assignment.domainKey].planning.unitCost, 0);
  const savings = selected.reduce((sum, assignment) => sum + assignment.savings, 0);
  const finalCost = baseCost - savings;
  const sharedHosts = [...physicalHosts.values()].filter((record) => record.assignments.length > 1);
  const byDomain = PUBLIC_DOMAIN_KEYS.map((domainKey) => {
    const assignments = selected.filter((assignment) => assignment.domainKey === domainKey);
    const mean = (key) => assignments.length ? assignments.reduce((sum, assignment) => sum + assignment[key], 0) / assignments.length : 0;
    return {
      domainKey,
      units: assignments.length,
      meanSuitability: assignments.length ? assignments.reduce((sum, assignment) => sum + assignment.host.domainSuitability[domainKey], 0) / assignments.length : 0,
      meanSeparation: mean("separation"),
      meanEquity: assignments.length ? assignments.reduce((sum, assignment) => sum + assignment.host.equity, 0) / assignments.length : 0,
      meanReliability: assignments.length ? assignments.reduce((sum, assignment) => sum + assignment.host.reliability, 0) / assignments.length : 0,
      sharedAssignments: assignments.filter((assignment) => (physicalHosts.get(assignment.host.id)?.assignments.length ?? 0) > 1).length
    };
  });
  const completed = byDomain.every((entry) => entry.units === config.units[entry.domainKey]);
  const meanCoverage = byDomain.reduce((sum, entry) => sum + 0.55 * entry.meanSuitability + 0.45 * entry.meanSeparation, 0) / byDomain.length;
  const worstDomainCoverage = Math.min(...byDomain.map((entry) => 0.55 * entry.meanSuitability + 0.45 * entry.meanSeparation));
  const meanEquity = byDomain.reduce((sum, entry) => sum + entry.meanEquity, 0) / byDomain.length;
  const meanReliability = byDomain.reduce((sum, entry) => sum + entry.meanReliability, 0) / byDomain.length;
  const maximumHostLoad = Math.max(0, ...[...physicalHosts.values()].map((record) => record.assignments.length));
  const verifiedAssignmentCount = selected.filter((assignment) => assignment.host.reviewStatus === "verified").length;
  const conditionalAssignmentCount = selected.filter((assignment) => assignment.host.reviewStatus === "conditional").length;
  const unresolvedAssignmentCount = selected.filter((assignment) => assignment.host.reviewStatus === "unresolved").length;
  const correlatedFailureRisk = selected.length
    ? [...physicalHosts.values()].reduce((sum, record) => {
      if (record.assignments.length <= 1) return sum;
      const averageSensitivity = record.assignments.reduce((subtotal, assignment) => subtotal + DOMAIN_REGISTRY[assignment.domainKey].planning.spatialDeployment.failureCorrelation, 0) / record.assignments.length;
      return sum + averageSensitivity * (record.assignments.length - 1);
    }, 0) / selected.length
    : 0;
  const composite = 0.28 * meanCoverage + 0.18 * worstDomainCoverage + 0.17 * meanEquity + 0.16 * meanReliability + 0.13 * clamp(savings / Math.max(1, baseCost) / 0.08) + 0.08 * (1 - correlatedFailureRisk);
  return {
    profileKey,
    profile: SPATIAL_DEPLOYMENT_PROFILES[profileKey],
    complete: completed,
    selected,
    sites: [...physicalHosts.values()].map((record) => ({
      id: record.host.id,
      label: record.host.label,
      category: record.host.category,
      lat: record.host.lat,
      lng: record.host.lng,
      reliability: record.host.reliability,
      equity: record.host.equity,
      assignments: record.assignments.map((assignment) => ({
        domainKey: assignment.domainKey,
        role: assignment.role,
        suitability: assignment.host.domainSuitability[assignment.domainKey],
        savings: assignment.savings
      })),
      sourceType: record.host.sourceType,
      reviewStatus: record.host.reviewStatus,
      permissionStatus: record.host.permissionStatus,
      accessStatus: record.host.accessStatus,
      powerStatus: record.host.powerStatus,
      safetyStatus: record.host.safetyStatus,
      maintenanceStatus: record.host.maintenanceStatus,
      ownerOrAgency: record.host.ownerOrAgency ?? "",
      reviewer: record.host.reviewer ?? "",
      verificationDate: record.host.verificationDate ?? "",
      notes: record.host.notes ?? "",
      requiresFieldVerification: record.host.requiresFieldVerification !== false
    })).sort((a, b) => b.assignments.length - a.assignments.length || a.id.localeCompare(b.id)),
    metrics: {
      requestedUnits: Object.values(config.units).reduce((sum, value) => sum + value, 0),
      assignedUnits: selected.length,
      physicalHostCount: physicalHosts.size,
      sharedHostCount: sharedHosts.length,
      sharedAssignmentCount: selected.filter((assignment) => (physicalHosts.get(assignment.host.id)?.assignments.length ?? 0) > 1).length,
      maximumHostLoad,
      baseCost,
      savings,
      finalCost,
      savingsRate: baseCost ? savings / baseCost : 0,
      meanCoverage,
      worstDomainCoverage,
      meanEquity,
      meanReliability,
      correlatedFailureRisk,
      verifiedAssignmentCount,
      conditionalAssignmentCount,
      unresolvedAssignmentCount,
      verifiedAssignmentRate: selected.length ? verifiedAssignmentCount / selected.length : 0,
      composite,
      byDomain
    }
  };
}

function generatePlan(profileKey, hosts, config, strategy) {
  const profile = SPATIAL_DEPLOYMENT_PROFILES[profileKey];
  const selected = [];
  const byHost = new Map();
  for (const domainKey of buildSequence(config.units, strategy)) {
    const choice = chooseAssignment({ domainKey, hosts, selected, byHost, profile, config });
    if (!choice) continue;
    const assignment = {
      id: `${domainKey}-${selected.filter((entry) => entry.domainKey === domainKey).length + 1}`,
      domainKey,
      host: choice.host,
      role: domainRole(domainKey, choice.host),
      score: choice.score,
      savings: choice.savings,
      separation: choice.separation,
      resilience: choice.resilience,
      compatibilityFloor: choice.compatibilityFloor,
      reviewFactor: choice.reviewFactor,
      interventionRole: "supplemental",
      lat: choice.host.lat,
      lng: choice.host.lng,
      x: choice.host.x,
      y: choice.host.y,
      requiresFieldVerification: true
    };
    selected.push(assignment);
    const record = byHost.get(choice.host.id) ?? [];
    record.push(assignment);
    byHost.set(choice.host.id, record);
  }
  return evaluatePlan(selected, config, profileKey);
}

function dominates(left, right) {
  const leftVector = [left.metrics.meanCoverage, left.metrics.worstDomainCoverage, left.metrics.meanEquity, left.metrics.meanReliability, left.metrics.savingsRate, 1 - left.metrics.correlatedFailureRisk];
  const rightVector = [right.metrics.meanCoverage, right.metrics.worstDomainCoverage, right.metrics.meanEquity, right.metrics.meanReliability, right.metrics.savingsRate, 1 - right.metrics.correlatedFailureRisk];
  return leftVector.every((value, index) => value >= rightVector[index] - 1e-12)
    && leftVector.some((value, index) => value > rightVector[index] + 1e-12);
}

export function planSpatialDeployment(config = DEFAULT_SPATIAL_DEPLOYMENT_CONFIG) {
  const normalized = normalizeSpatialDeploymentConfig(config);
  const hosts = buildSharedHostPool(normalized);
  const strategies = ["round-robin", "cost-desc", "scarcity"];
  const portfolio = Object.keys(SPATIAL_DEPLOYMENT_PROFILES).map((profileKey) => {
    const candidates = strategies.map((strategy) => generatePlan(profileKey, hosts, normalized, strategy));
    return candidates.sort((left, right) => Number(right.complete) - Number(left.complete) || right.metrics.composite - left.metrics.composite || left.metrics.finalCost - right.metrics.finalCost)[0];
  });
  for (const plan of portfolio) {
    plan.paretoOptimal = !portfolio.some((other) => other.profileKey !== plan.profileKey && dominates(other, plan));
  }
  const ready = portfolio.some((plan) => plan.complete);
  const result = {
    schemaVersion: SPATIAL_DEPLOYMENT_SCHEMA_VERSION,
    architecture: "spatially-coupled-cross-domain-deployment",
    generatedAt: new Date(0).toISOString(),
    ready,
    config: normalized,
    hostPoolCount: hosts.length,
    hostSource: normalized.hostSource,
    fieldReviewPolicy: normalized.fieldReviewPolicy,
    hostReviewSummary: summarizeHostInventory(hosts),
    inventoryRecordCount: normalized.hostInventory.length,
    portfolio,
    claimBoundary: normalized.hostSource === "controlled"
      ? "Shared-host plans use controlled mathematical siting proxies. Co-location savings are declared planning assumptions; every host requires field verification, permissions, access, power, maintenance, safety, and domain-specific professional review before deployment."
      : "Imported field-review records are filtered according to the displayed policy, but LUMOS does not independently verify their accuracy. Permission, access, power, maintenance, safety, ownership, and professional approval must remain traceable to local evidence before deployment."
  };
  result.checksum = checksum({ ...result, generatedAt: null, checksum: null });
  return result;
}

export function spatialDeploymentRows(result) {
  if (!result?.ready) return [];
  return result.portfolio.flatMap((plan) => plan.sites.flatMap((site) => site.assignments.map((assignment) => ({
    profile: plan.profileKey,
    profile_label: plan.profile.label,
    pareto: plan.paretoOptimal,
    complete: plan.complete,
    site_id: site.id,
    site_label: site.label,
    host_category: site.category,
    latitude: site.lat,
    longitude: site.lng,
    colocated_domains: site.assignments.map((entry) => entry.domainKey).join("|"),
    domain: assignment.domainKey,
    role: assignment.role,
    suitability: assignment.suitability,
    assignment_savings_usd: assignment.savings,
    site_reliability: site.reliability,
    site_equity: site.equity,
    review_status: site.reviewStatus,
    permission_status: site.permissionStatus,
    access_status: site.accessStatus,
    power_status: site.powerStatus,
    safety_status: site.safetyStatus,
    maintenance_status: site.maintenanceStatus,
    owner_or_agency: site.ownerOrAgency,
    reviewer: site.reviewer,
    verification_date: site.verificationDate,
    field_verification_required: site.requiresFieldVerification,
    total_base_cost_usd: plan.metrics.baseCost,
    total_savings_usd: plan.metrics.savings,
    total_final_cost_usd: plan.metrics.finalCost,
    mean_coverage: plan.metrics.meanCoverage,
    worst_domain_coverage: plan.metrics.worstDomainCoverage,
    correlated_failure_risk: plan.metrics.correlatedFailureRisk,
    checksum: result.checksum
  }))));
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToSpatialDeploymentCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
