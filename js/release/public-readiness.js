import { PUBLIC_DOMAIN_KEYS, REQUIRED_PUBLIC_CAPABILITIES } from "../config/domain-registry.js";

export const PUBLIC_READINESS_SCHEMA_VERSION = "1.0";

const REQUIRED_WORKSPACES = Object.freeze([
  "unified-cross-domain-audit",
  "unified-cross-domain-budget-allocation",
  "unified-sequential-evidence-reallocation",
  "unified-multi-round-adaptive-simulation",
  "unified-trajectory-uncertainty-ensemble",
  "unified-spatially-coupled-deployment",
  "unified-verified-host-field-review",
  "unified-field-campaign-operations",
  "unified-live-campaign-tracking",
  "unified-commissioning-maintenance-operations"
]);

const REQUIRED_ACCESSIBILITY = Object.freeze([
  "keyboard-navigation",
  "visible-focus",
  "reduced-motion",
  "color-vision-safe-palette",
  "collapsible-header",
  "collapsible-panels",
  "map-focus-mode",
  "skip-link",
  "home-navigation",
  "in-app-documentation"
]);

const REQUIRED_GOVERNANCE = Object.freeze([
  "docs/LIMITATIONS.md",
  "docs/PRIVACY_AND_DATA_GOVERNANCE.md",
  "SECURITY.md",
  "CITATION.cff",
  "LICENSE"
]);

const REQUIRED_EVIDENCE = Object.freeze([
  "cross-domain-audit",
  "cross-domain-budget-allocation",
  "sequential-reallocation",
  "adaptive-program-simulation",
  "robust-policy-ensemble",
  "spatial-deployment",
  "verified-host-inventory",
  "field-feasibility-deployment",
  "field-campaign-operations",
  "live-campaign-tracking",
  "commissioning-operations"
]);

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

function readinessCheck({ id, category, label, satisfied, detail, severity = "fail" }) {
  return { id, category, label, status: satisfied ? "pass" : severity, detail };
}

function countsFor(checks) {
  return checks.reduce((counts, check) => {
    counts[check.status] = (counts[check.status] ?? 0) + 1;
    return counts;
  }, { pass: 0, warn: 0, fail: 0 });
}

function includesAll(values, required) {
  const set = new Set(values ?? []);
  return required.every((value) => set.has(value));
}

export function runPublicLaunchReadiness(options = {}) {
  const release = options.releaseMetadata ?? {};
  const domainAudit = options.domainAudit ?? null;
  const commissioning = options.commissioningResult ?? null;
  const runtime = options.runtimeContract ?? {};
  const checks = [];

  checks.push(readinessCheck({
    id: "release-version", category: "release", label: "Release metadata identity",
    satisfied: release.version === "3.1.1",
    detail: release.version ? "Release metadata, citation, and packaged assets identify one consistent release." : "Release metadata does not identify a packaged release."
  }));
  checks.push(readinessCheck({
    id: "release-status", category: "release", label: "Stable public release channel",
    satisfied: release.status === "stable-public-v3",
    detail: `Release status: ${release.status ?? "not declared"}.`
  }));
  checks.push(readinessCheck({
    id: "domain-coverage", category: "architecture", label: "Four public scientific adapters",
    satisfied: includesAll(release.supportedDomains, PUBLIC_DOMAIN_KEYS),
    detail: `Declared domains: ${(release.supportedDomains ?? []).join(", ") || "none"}.`
  }));
  checks.push(readinessCheck({
    id: "workspace-coverage", category: "architecture", label: "Complete unified decision lifecycle",
    satisfied: includesAll(release.supportedWorkspaces, REQUIRED_WORKSPACES),
    detail: `${(release.supportedWorkspaces ?? []).filter((value) => REQUIRED_WORKSPACES.includes(value)).length}/${REQUIRED_WORKSPACES.length} required unified workspaces declared.`
  }));
  checks.push(readinessCheck({
    id: "domain-audit", category: "science", label: "Cross-domain scientific audit",
    satisfied: Boolean(domainAudit?.ready && domainAudit?.counts?.fail === 0),
    detail: domainAudit ? `${domainAudit.counts.pass} passes, ${domainAudit.counts.warn} warnings, ${domainAudit.counts.fail} failures; checksum ${domainAudit.checksum}.` : "Cross-domain audit evidence was not supplied."
  }));
  checks.push(readinessCheck({
    id: "commissioning-example", category: "operations", label: "Commissioning and maintenance evidence",
    satisfied: Boolean(commissioning?.ready && commissioning?.metrics?.totalAssignments > 0 && commissioning?.metrics?.unresolvedFailures === 0),
    detail: commissioning
      ? `${commissioning.metrics.commissionedAssignments}/${commissioning.metrics.totalAssignments} commissioned; ${commissioning.metrics.protectedFailures} protected failures; ${commissioning.metrics.unresolvedFailures} unresolved; checksum ${commissioning.checksum}.`
      : "Commissioning evidence was not supplied."
  }));
  checks.push(readinessCheck({
    id: "capability-contract", category: "science", label: "Required public capabilities",
    satisfied: REQUIRED_PUBLIC_CAPABILITIES.includes("commissioningOperations") && REQUIRED_PUBLIC_CAPABILITIES.length >= 11,
    detail: `${REQUIRED_PUBLIC_CAPABILITIES.length} mandatory public-adapter capabilities are registered.`
  }));
  checks.push(readinessCheck({
    id: "evidence-manifest", category: "reproducibility", label: "Frozen evidence artifact manifest",
    satisfied: includesAll(release.publicRelease?.evidenceArtifacts, REQUIRED_EVIDENCE),
    detail: `${(release.publicRelease?.evidenceArtifacts ?? []).filter((value) => REQUIRED_EVIDENCE.includes(value)).length}/${REQUIRED_EVIDENCE.length} required evidence artifacts declared.`
  }));
  checks.push(readinessCheck({
    id: "governance-docs", category: "governance", label: "Limitations, privacy, security, citation, and license",
    satisfied: includesAll(release.publicRelease?.governanceDocuments, REQUIRED_GOVERNANCE),
    detail: `${(release.publicRelease?.governanceDocuments ?? []).filter((value) => REQUIRED_GOVERNANCE.includes(value)).length}/${REQUIRED_GOVERNANCE.length} governance documents declared.`
  }));
  checks.push(readinessCheck({
    id: "limitations-scope", category: "governance", label: "Limitations and intended-use guidance",
    satisfied: release.publicRelease?.limitationsAndScope === true,
    detail: release.publicRelease?.limitationsAndScope ? "Release metadata requires a centralized limitations and intended-use record." : "Limitations and intended-use guidance are not declared."
  }));
  checks.push(readinessCheck({
    id: "accessibility-contract", category: "accessibility", label: "Public accessibility contract",
    satisfied: includesAll(release.publicRelease?.accessibility, REQUIRED_ACCESSIBILITY),
    detail: `${(release.publicRelease?.accessibility ?? []).filter((value) => REQUIRED_ACCESSIBILITY.includes(value)).length}/${REQUIRED_ACCESSIBILITY.length} required accessibility features declared.`
  }));
  checks.push(readinessCheck({
    id: "runtime-layout", category: "accessibility", label: "Runtime map-expansion controls",
    satisfied: runtime.collapsibleHeader !== false && runtime.collapsiblePanels !== false && runtime.mapFocusMode !== false,
    detail: `Header collapse ${runtime.collapsibleHeader === false ? "missing" : "available"}; panel collapse ${runtime.collapsiblePanels === false ? "missing" : "available"}; map focus ${runtime.mapFocusMode === false ? "missing" : "available"}.`
  }));
  checks.push(readinessCheck({
    id: "runtime-a11y", category: "accessibility", label: "Runtime keyboard and motion controls",
    satisfied: runtime.skipLink !== false && runtime.visibleFocus !== false && runtime.reducedMotion !== false && runtime.colorVisionPalette !== false,
    detail: "Skip navigation, visible focus, reduced-motion, and color-vision-safe controls are required in the application shell."
  }));
  checks.push(readinessCheck({
    id: "runtime-home", category: "accessibility", label: "Dedicated public Home navigation",
    satisfied: runtime.homeNavigation !== false,
    detail: runtime.homeNavigation === false ? "The public Home entry point is missing." : "A dedicated Home entry point introduces the system and routes users into each scientific workspace."
  }));
  checks.push(readinessCheck({
    id: "runtime-documentation", category: "governance", label: "In-application documentation center",
    satisfied: runtime.inAppDocumentation !== false,
    detail: runtime.inAppDocumentation === false ? "Documentation still requires leaving the application." : "Core public documentation is available inside an accessible application dialog."
  }));
  checks.push(readinessCheck({
    id: "runtime-about", category: "governance", label: "About Us and team attribution",
    satisfied: runtime.aboutPage !== false && release.publicRelease?.aboutPage === true,
    detail: runtime.aboutPage === false || release.publicRelease?.aboutPage !== true ? "The About Us page or team attribution contract is missing." : "The in-application About Us page and team attribution are declared."
  }));
  checks.push(readinessCheck({
    id: "static-hosting", category: "deployment", label: "Static public deployment",
    satisfied: release.hosting === "static-github-pages",
    detail: `Hosting contract: ${release.hosting ?? "not declared"}.`
  }));
  checks.push(readinessCheck({
    id: "offline-shell", category: "deployment", label: "Offline application shell",
    satisfied: release.publicRelease?.offlineApplicationShell === true,
    detail: release.publicRelease?.offlineApplicationShell ? "Versioned service-worker application shell declared." : "Offline application shell is not declared."
  }));
  checks.push(readinessCheck({
    id: "credential-boundary", category: "security", label: "Frontend credential boundary",
    satisfied: release.publicRelease?.embeddedCredentials === false,
    detail: release.publicRelease?.embeddedCredentials === false ? "No permanent API credentials are permitted in the public application bundle." : "Credential boundary is not declared."
  }));
  checks.push(readinessCheck({
    id: "license", category: "governance", label: "Open-source license",
    satisfied: release.license === "MIT",
    detail: `Declared license: ${release.license ?? "not declared"}.`
  }));

  const counts = countsFor(checks);
  const result = {
    schemaVersion: PUBLIC_READINESS_SCHEMA_VERSION,
    architecture: "LUMOS-v3-internal-release-quality-audit",
    generatedAt: new Date(0).toISOString(),
    version: release.version ?? null,
    checks,
    counts,
    ready: counts.fail === 0,
    claimBoundary: "This readiness audit verifies declared software, evidence, accessibility, governance, and release contracts. It does not certify environmental accuracy, cybersecurity, regulatory compliance, accessibility conformance, field deployment, or institutional approval."
  };
  result.checksum = checksum({ ...result, generatedAt: null, checksum: null });
  return result;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function publicReadinessRows(result) {
  return result.checks.map((check) => ({
    version: result.version,
    checksum: result.checksum,
    category: check.category,
    check_id: check.id,
    label: check.label,
    status: check.status,
    detail: check.detail
  }));
}

export function rowsToPublicReadinessCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
