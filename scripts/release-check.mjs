import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedVersion = "3.0.4";
const required = [
  "index.html", "package.json", "release.json", "manifest.webmanifest", "service-worker.js", "404.html",
  "README.md", "MODEL_SPECIFICATION.md", "CITATION.cff", "LICENSE", ".nojekyll",
  ".github/workflows/deploy-pages.yml", ".github/workflows/release-quality.yml",
  "docs/PUBLIC_RELEASE.md", "docs/PUBLIC_LAUNCH_READINESS.md", "docs/UNIFIED_ARCHITECTURE.md", "docs/LIVE_CAMPAIGN_TRACKING.md", "docs/COMMISSIONING_AND_MAINTENANCE.md", "docs/CROSS_DOMAIN_BUDGET_ALLOCATION.md", "docs/SEQUENTIAL_REALLOCATION.md", "docs/ADAPTIVE_PROGRAM_SIMULATION.md", "docs/ROBUST_POLICY_SELECTION.md", "docs/SPATIAL_DEPLOYMENT.md", "docs/HOST_INVENTORY_AND_FIELD_REVIEW.md", "docs/FIELD_CAMPAIGN_OPERATIONS.md", "docs/AIR_PUBLIC_RELEASE.md", "docs/SOIL_PREVIEW.md", "docs/SOIL_INFERENCE.md", "docs/SOIL_PUBLIC_RELEASE.md", "docs/WATER_PREVIEW.md", "docs/WATER_INFERENCE.md", "docs/WATER_PUBLIC_RELEASE.md", "docs/RELEASE_CHECKLIST.md", "SECURITY.md",
  "assets/lumos-192.png", "js/config/domain-registry.js", "js/release/domain-audit.js", "js/model/unified/budget-allocation.js", "js/model/unified/sequential-reallocation.js", "js/model/unified/adaptive-program-simulation.js", "js/model/unified/robust-policy-ensemble.js", "js/model/unified/spatial-deployment.js", "js/model/unified/host-inventory.js", "js/model/unified/field-campaign.js", "js/model/unified/campaign-tracking.js", "js/model/unified/commissioning-operations.js", "js/release/public-readiness.js", "js/release/documentation.js", "scripts/run-tests.mjs", "scripts/run-verification.mjs", "scripts/run-cross-domain-audit.mjs", "scripts/run-cross-domain-budget-allocation.mjs", "scripts/run-sequential-reallocation.mjs", "scripts/run-adaptive-program-simulation.mjs", "scripts/run-robust-policy-ensemble.mjs", "scripts/run-spatial-deployment.mjs", "scripts/run-host-feasibility-review.mjs", "scripts/run-field-campaign-operations.mjs", "scripts/run-live-campaign-tracking.mjs", "scripts/run-commissioning-operations.mjs", "scripts/run-public-launch-readiness.mjs", "data/examples/cross-domain-audit.json", "data/examples/cross-domain-audit.csv", "data/examples/cross-domain-budget-allocation.json", "data/examples/cross-domain-budget-allocation.csv", "data/examples/sequential-evidence-example.json", "data/examples/sequential-reallocation.json", "data/examples/sequential-reallocation.csv", "data/examples/adaptive-program-simulation.json", "data/examples/adaptive-program-simulation.csv", "data/examples/robust-policy-ensemble.json", "data/examples/robust-policy-ensemble.csv", "data/examples/spatial-deployment.json", "data/examples/spatial-deployment.csv", "data/examples/verified-host-inventory.json", "data/examples/verified-host-inventory.csv", "data/examples/field-feasibility-deployment.json", "data/examples/field-feasibility-deployment.csv", "data/examples/field-campaign-operations.json", "data/examples/field-campaign-operations.csv", "data/examples/live-campaign-outcomes.json", "data/examples/live-campaign-tracking.json", "data/examples/live-campaign-tracking.csv", "data/examples/commissioning-events.json", "data/examples/commissioning-operations.json", "data/examples/commissioning-operations.csv", "data/examples/public-release-readiness.json", "data/examples/public-release-readiness.csv", "assets/lumos-512.png", "data/examples/soil-public-cases.json", "data/examples/water-public-cases.json", "js/model/soil/evidence-runner.js", "scripts/run-national-soil-evidence-suite.mjs", "js/data/water/national.js", "js/model/water/intervention.js", "js/model/water/inference.js", "js/model/water/sensitivity.js", "js/model/water/paper-runner.js", "js/model/water/evidence-runner.js", "scripts/run-national-water-evidence-suite.mjs"
];
const failures = [];
for (const file of required) if (!existsSync(path.join(root, file))) failures.push(`Missing required release file: ${file}`);

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const release = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
if (packageJson.version !== expectedVersion) failures.push(`package.json version is ${packageJson.version}`);
if (release.version !== expectedVersion) failures.push(`release.json version is ${release.version}`);
if (release.status !== "stable-public-v3") failures.push(`release.json status is ${release.status}`);
if (manifest.short_name !== "LUMOS") failures.push("manifest short_name must be LUMOS");

const versionedReleaseFiles = ["CHANGELOG.md", "CITATION.cff", "docs/PUBLIC_RELEASE.md", "docs/RELEASE_CHECKLIST.md"];
for (const file of versionedReleaseFiles) {
  const text = await readFile(path.join(root, file), "utf8");
  if (!text.includes(expectedVersion)) failures.push(`${file} does not identify release ${expectedVersion}`);
}
const publicShell = await readFile(path.join(root, "index.html"), "utf8");
if (publicShell.includes(expectedVersion)) failures.push("index.html exposes the release number in the public product interface");
if (!publicShell.includes('data-domain="home"')) failures.push("index.html is missing the dedicated Home navigation tab");
if (!publicShell.includes('id="documentationDialog"')) failures.push("index.html is missing the in-application documentation center");
if (!publicShell.includes("Full creation including ideation, website, code, and interface by Hudson Dong")) failures.push("index.html is missing the required creator attribution");
if (!publicShell.includes("The LUMOS Team")) failures.push("index.html is missing the LUMOS team attribution");
if (publicShell.includes("and the LUMOS team")) failures.push("index.html incorrectly joins creator and team attribution");
if (!publicShell.includes('data-documentation-page="about"')) failures.push("index.html is missing the in-application About Us page");
if (publicShell.includes("Scientific monitoring design and operations · not regulatory or emergency guidance")) failures.push("index.html still exposes the removed disclaimer tagline");
if (publicShell.includes("Scientific position")) failures.push("index.html still uses the retired Scientific position heading");
if (publicShell.includes('id="publicReadinessSection"') || publicShell.includes('id="publicReadinessResultSection"')) failures.push("index.html still exposes the internal public-readiness audit");
if (/Claim boundaries|claim boundaries/.test(publicShell)) failures.push("index.html still exposes dedicated claim-boundary copy instead of centralized limitations");
if (!publicShell.includes("https://github.com/hgd-dev/lumos")) failures.push("index.html is missing the public GitHub repository link");
if (!publicShell.includes('id="heroTypeText"')) failures.push("index.html is missing the animated environmental-design phrase");
if (!publicShell.includes('class="home-install-mark"')) failures.push("index.html is missing the install-card LUMOS mark");
if (publicShell.includes("From uncertainty to action")) failures.push("index.html still exposes the removed masthead slogan");
if (!publicShell.includes("fonts.googleapis.com/css2?family=Inter")) failures.push("index.html is missing the technical public font stylesheet");
if (!publicShell.includes("replace-with-your-email@example.com") || !publicShell.includes("replace-with-your-handle") || !publicShell.includes("replace-with-your-profile")) failures.push("index.html is missing one or more declared placeholder social destinations");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["dist", ".git", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}
const files = await walk(root);
const jsFiles = files.filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`Syntax check failed: ${path.relative(root, file)}\n${result.stderr}`);
}
const secretPatterns = [/\bsk-[A-Za-z0-9_-]{20,}/, /\bghp_[A-Za-z0-9]{20,}/, /\bAIza[A-Za-z0-9_-]{20,}/];
for (const file of files.filter((file) => /\.(?:js|mjs|json|html|md|yml|yaml)$/.test(file))) {
  const text = await readFile(file, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(text))) failures.push(`Potential embedded credential in ${path.relative(root, file)}`);
}
let publicBytes = 0;
for (const entry of ["index.html", "404.html", "manifest.webmanifest", "service-worker.js", "release.json", "assets", "css", "js", "docs", "data"]) {
  const full = path.join(root, entry);
  if (!existsSync(full)) continue;
  const info = await stat(full);
  if (info.isFile()) publicBytes += info.size;
  else for (const file of await walk(full)) publicBytes += (await stat(file)).size;
}
if (publicBytes > 15_000_000) failures.push(`Static application is unexpectedly large: ${publicBytes} bytes`);

if (failures.length) {
  console.error("LUMOS public release check failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`LUMOS v${expectedVersion} release check passed.`);
console.log(`Validated ${jsFiles.length} JavaScript modules and ${(publicBytes / 1024).toFixed(1)} KiB of public assets.`);
