import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedVersion = "4.1.0";
const required = [
  "index.html", "home-3d.html", "about.html", "documentation.html", "research.html", "contact.html", "lumos-lab.html", "unified.html", "heat.html", "air.html", "soil.html", "water.html", "workspace-shell.html",
  "package.json", "release.json", "manifest.webmanifest", "service-worker.js", "404.html",
  "README.md", "MODEL_SPECIFICATION.md", "CITATION.cff", "LICENSE", ".nojekyll",
  ".github/workflows/deploy-pages.yml", ".github/workflows/release-quality.yml",
  "docs/PUBLIC_RELEASE.md", "docs/PUBLIC_LAUNCH_READINESS.md", "docs/UNIFIED_ARCHITECTURE.md", "docs/LIVE_CAMPAIGN_TRACKING.md", "docs/COMMISSIONING_AND_MAINTENANCE.md", "docs/CROSS_DOMAIN_BUDGET_ALLOCATION.md", "docs/SEQUENTIAL_REALLOCATION.md", "docs/ADAPTIVE_PROGRAM_SIMULATION.md", "docs/ROBUST_POLICY_SELECTION.md", "docs/SPATIAL_DEPLOYMENT.md", "docs/HOST_INVENTORY_AND_FIELD_REVIEW.md", "docs/FIELD_CAMPAIGN_OPERATIONS.md", "docs/AIR_PUBLIC_RELEASE.md", "docs/SOIL_PREVIEW.md", "docs/SOIL_INFERENCE.md", "docs/SOIL_PUBLIC_RELEASE.md", "docs/WATER_PREVIEW.md", "docs/WATER_INFERENCE.md", "docs/WATER_PUBLIC_RELEASE.md", "docs/RELEASE_CHECKLIST.md", "SECURITY.md",
  "assets/lumos-192.png", "css/home-3d.css", "js/home-3d.js", "css/home-spiral.css", "js/home-spiral.js", "js/site.js", "js/lumos-lab.js", "js/lumos-lab-advanced.js", "css/lumos-lab.css", "css/lumos-lab-intro.css", "js/lumos-lab-intro.js", "docs/LUMOSLAB.md", "js/info-page.js", "js/content-page.js", "js/workspace-bootstrap.js", "js/config/domain-registry.js", "js/release/domain-audit.js", "js/model/unified/budget-allocation.js", "js/model/unified/sequential-reallocation.js", "js/model/unified/adaptive-program-simulation.js", "js/model/unified/robust-policy-ensemble.js", "js/model/unified/spatial-deployment.js", "js/model/unified/host-inventory.js", "js/model/unified/field-campaign.js", "js/model/unified/campaign-tracking.js", "js/model/unified/commissioning-operations.js", "js/release/public-readiness.js", "js/release/documentation.js", "scripts/run-tests.mjs", "scripts/run-verification.mjs", "scripts/run-cross-domain-audit.mjs", "scripts/run-cross-domain-budget-allocation.mjs", "scripts/run-sequential-reallocation.mjs", "scripts/run-adaptive-program-simulation.mjs", "scripts/run-robust-policy-ensemble.mjs", "scripts/run-spatial-deployment.mjs", "scripts/run-host-feasibility-review.mjs", "scripts/run-field-campaign-operations.mjs", "scripts/run-live-campaign-tracking.mjs", "scripts/run-commissioning-operations.mjs", "scripts/run-public-launch-readiness.mjs", "data/examples/cross-domain-audit.json", "data/examples/cross-domain-audit.csv", "data/examples/cross-domain-budget-allocation.json", "data/examples/cross-domain-budget-allocation.csv", "data/examples/sequential-evidence-example.json", "data/examples/sequential-reallocation.json", "data/examples/sequential-reallocation.csv", "data/examples/adaptive-program-simulation.json", "data/examples/adaptive-program-simulation.csv", "data/examples/robust-policy-ensemble.json", "data/examples/robust-policy-ensemble.csv", "data/examples/spatial-deployment.json", "data/examples/spatial-deployment.csv", "data/examples/verified-host-inventory.json", "data/examples/verified-host-inventory.csv", "data/examples/field-feasibility-deployment.json", "data/examples/field-feasibility-deployment.csv", "data/examples/field-campaign-operations.json", "data/examples/field-campaign-operations.csv", "data/examples/live-campaign-outcomes.json", "data/examples/live-campaign-tracking.json", "data/examples/live-campaign-tracking.csv", "data/examples/commissioning-events.json", "data/examples/commissioning-operations.json", "data/examples/commissioning-operations.csv", "data/examples/public-release-readiness.json", "data/examples/public-release-readiness.csv", "assets/lumos-512.png", "data/examples/soil-public-cases.json", "data/examples/water-public-cases.json", "js/model/soil/evidence-runner.js", "scripts/run-national-soil-evidence-suite.mjs", "js/data/water/national.js", "js/model/water/intervention.js", "js/model/water/inference.js", "js/model/water/sensitivity.js", "js/model/water/paper-runner.js", "js/model/water/evidence-runner.js", "scripts/run-national-water-evidence-suite.mjs"
];
const failures = [];
for (const file of required) if (!existsSync(path.join(root, file))) failures.push(`Missing required release file: ${file}`);

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const release = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
if (packageJson.version !== expectedVersion) failures.push(`package.json version is ${packageJson.version}`);
if (release.version !== expectedVersion) failures.push(`release.json version is ${release.version}`);
if (release.status !== "stable-public-v4") failures.push(`release.json status is ${release.status}`);
if (manifest.short_name !== "LUMOS") failures.push("manifest short_name must be LUMOS");

const versionedReleaseFiles = ["CHANGELOG.md", "CITATION.cff", "docs/PUBLIC_RELEASE.md", "docs/RELEASE_CHECKLIST.md"];
for (const file of versionedReleaseFiles) {
  const text = await readFile(path.join(root, file), "utf8");
  if (!text.includes(expectedVersion)) failures.push(`${file} does not identify release ${expectedVersion}`);
}
const publicShell = await readFile(path.join(root, "index.html"), "utf8");
const experimentalHome = await readFile(path.join(root, "home-3d.html"), "utf8");
const aboutPage = await readFile(path.join(root, "about.html"), "utf8");
const documentationPage = await readFile(path.join(root, "documentation.html"), "utf8");
const researchPage = await readFile(path.join(root, "research.html"), "utf8");
const contactPage = await readFile(path.join(root, "contact.html"), "utf8");
const labPage = await readFile(path.join(root, "lumos-lab.html"), "utf8");
const workspaceShell = await readFile(path.join(root, "workspace-shell.html"), "utf8");
const entryPages = Object.fromEntries(await Promise.all(["unified", "heat", "air", "soil", "water"].map(async (key) => [key, await readFile(path.join(root, `${key}.html`), "utf8")])));
for (const [label, html] of [["index.html", publicShell], ["home-3d.html", experimentalHome], ["about.html", aboutPage], ["documentation.html", documentationPage], ["research.html", researchPage], ["contact.html", contactPage], ["lumos-lab.html", labPage], ...Object.entries(entryPages)]) {
  if (html.includes(expectedVersion)) failures.push(`${label} exposes the release number in routine public chrome`);
}
if (publicShell.includes('href="home-3d.html"') || publicShell.includes('href="home-spiral.html"')) failures.push("index.html must not link experimental Home routes");
if (existsSync(path.join(root, "home-spiral.html"))) failures.push("retired home-spiral.html compatibility route must not be packaged");
if (experimentalHome.includes('href="home-spiral.html"')) failures.push("home-3d.html must not link the retired spiral route");
if (!experimentalHome.includes('name="robots" content="noindex,nofollow,noarchive"') || !experimentalHome.includes('id="lumos3dCanvas"') || !experimentalHome.includes('js/home-3d.js') || !experimentalHome.includes('href="index.html"')) failures.push("home-3d.html is missing the unlinked experimental-page contract");
if (!experimentalHome.includes("Choose the decision scale that matches your work") || !experimentalHome.includes("Move from uncertainty to a maintained operational network") || !experimentalHome.includes("Every recommendation carries its evidence and its limits")) failures.push("home-3d.html does not preserve the current Home content");
if (!labPage.includes('name="robots" content="index,follow"') || !labPage.includes('id="protocolIntro"') || !labPage.includes('id="protocolCircuitLayer"') || !labPage.includes('id="protocolSkipButton"') || labPage.includes('id="protocolReplayButton"') || !labPage.includes('css/lumos-lab.css?build=lab-3') || !labPage.includes('js/lumos-lab-intro.js?build=intro-2') || !labPage.includes('css/lumos-lab-intro.css?build=intro-2')) failures.push("lumos-lab.html is missing the official Convergence Protocol intro contract or final header polish");
if (existsSync(path.join(root, "lumos-lab-protocol.html")) || existsSync(path.join(root, "css/lumos-lab-protocol.css")) || existsSync(path.join(root, "js/lumos-lab-protocol.js"))) failures.push("retired LUMOSLab experiment route or assets remain in the public repository");
if (/EXPERIMENT 01|Secret experiment|Convergence Protocol Experiment/.test(labPage)) failures.push("lumos-lab.html still exposes experiment labeling");
if (!publicShell.includes('href="unified.html"')) failures.push("index.html is missing the Unified page link");
for (const domain of ["heat", "air", "soil", "water"]) {
  if (!publicShell.includes(`href="${domain}.html"`)) failures.push(`index.html is missing the ${domain} workspace link`);
  if (!entryPages[domain].includes(`data-lumos-domain="${domain}"`)) failures.push(`${domain}.html is missing its fixed domain entry contract`);
}
if (!entryPages.unified.includes('data-lumos-domain="core"')) failures.push("unified.html is missing its fixed Unified entry contract");
if (!workspaceShell.includes('id="workspace"')) failures.push("workspace-shell.html is missing the shared workspace interface");
if (!workspaceShell.includes('id="newScenarioButton"') || !workspaceShell.includes('id="optimizeButton"')) failures.push("workspace-shell.html is missing page-local reset or generation controls");
if (!aboutPage.includes('id="aboutTitle"') || !aboutPage.includes("Hudson Dong") || !aboutPage.includes("The LUMOS Team")) failures.push("about.html is missing the permanent About Us content");
if (!documentationPage.includes('data-content-group="documentation"') || !documentationPage.includes('id="infoNavigation"')) failures.push("documentation.html is missing the documentation layout");
if (!researchPage.includes('data-content-group="research"') || !researchPage.includes('id="infoContent"')) failures.push("research.html is missing the research layout");
if (!contactPage.includes('id="contactTitle"') || !contactPage.includes("replace-with-feedback-form")) failures.push("contact.html is missing contact and feedback placeholders");
if (!publicShell.includes("Full creation including ideation, website, code, and interface by Hudson Dong")) failures.push("index.html is missing the required creator attribution");
if (!publicShell.includes("The LUMOS Team")) failures.push("index.html is missing the LUMOS team attribution");
if (publicShell.includes("and the LUMOS team")) failures.push("index.html incorrectly joins creator and team attribution");
if (publicShell.includes("Scientific monitoring design and operations · not regulatory or emergency guidance")) failures.push("index.html still exposes the removed disclaimer tagline");
if (publicShell.includes("Scientific position")) failures.push("index.html still uses the retired Scientific position heading");
if (workspaceShell.includes('id="publicReadinessSection"') || workspaceShell.includes('id="publicReadinessResultSection"')) failures.push("workspace-shell.html exposes the internal public-readiness audit");
if (/Claim boundaries|claim boundaries/.test(workspaceShell)) failures.push("workspace-shell.html exposes dedicated claim-boundary copy instead of centralized limitations");
if (!publicShell.includes("https://github.com/hgd-dev/lumos")) failures.push("index.html is missing the public GitHub repository link");
if (!publicShell.includes('name="robots" content="index,follow"') || !publicShell.includes('id="spiralIntro"') || !publicShell.includes('id="spiralSequence"') || !publicShell.includes('id="spiralOrbit"')) failures.push("index.html is missing the official cinematic Home contract");
if (!publicShell.includes('id="spiralPersistentBackdrop"') || !publicShell.includes('id="spiralPersistentCanvas"') || !publicShell.includes('class="spiral-persistent-grid"')) failures.push("index.html is missing the persistent cosmic Home background");
if (!publicShell.includes('class="motion-title-intro-word motion-title-intro-word-depth') || !publicShell.includes('motion-title-intro-shutters') || !publicShell.includes('motion-title-intro-black')) failures.push("index.html is missing the cinematic three-dimensional LUMOS title intro");
if (!publicShell.includes('id="motionTypingWord"') || !publicShell.includes('Design environmental monitoring, intervention, planning, optimization, deployment, and evaluation')) failures.push("index.html is missing the animated environmental-design identity");
if (!publicShell.includes('css/home-spiral.css') || !publicShell.includes('js/home-spiral.js')) failures.push("index.html is missing the official motion Home assets");
if (publicShell.includes('home-spiral-experiment-chip') || publicShell.includes('Motion experiment')) failures.push("index.html still exposes experimental presentation labeling");
if (!publicShell.includes('class="home-install-mark"')) failures.push("index.html is missing the install-card LUMOS mark");
if (publicShell.includes("From uncertainty to action")) failures.push("index.html still exposes the removed masthead slogan");
if (!publicShell.includes("fonts.googleapis.com/css2?family=Inter")) failures.push("index.html is missing the technical public font stylesheet");
if (!publicShell.includes("Lumosystem.team@gmail.com") || !publicShell.includes("lumos_optimization") || !publicShell.includes("lumos-team-7786b2425")) failures.push("index.html is missing one or more official LUMOS social destinations");
if (!labPage.includes('id="labWorkspace"') || !labPage.includes('js/lumos-lab.js') || !labPage.includes('js/lumos-lab-advanced.js') || !labPage.includes('data-lab-panel="tradeoffs"') || !labPage.includes('data-lab-panel="geography"') || !labPage.includes('data-lab-panel="research-studio"')) failures.push("LUMOSLab is missing its core shell, advanced controller, or comprehensive studios");
if (!publicShell.includes('href="lumos-lab.html"') || !entryPages.unified.includes('href="lumos-lab.html"')) failures.push("LUMOSLab is missing from public top navigation");
if (!entryPages.unified.includes('href="about.html"') || !entryPages.unified.includes('href="documentation.html#quickstart"') || !entryPages.unified.includes('href="research.html#paper"') || !entryPages.unified.includes('href="contact.html"') || !entryPages.heat.includes('href="unified.html"')) failures.push("workspace top navigation is incomplete");
if (!entryPages.unified.includes('js/workspace-bootstrap.js')) failures.push("workspace pages are not loading the shared workspace bootstrap");
if (!publicShell.includes('<summary>Documentation</summary>')) failures.push("global header is missing the Documentation menu");
if (!publicShell.includes('<summary>Research &amp; Process</summary>')) failures.push("global header is missing the Research & Process menu");
if (!publicShell.includes('href="about.html"') || !publicShell.includes('href="contact.html"')) failures.push("global header is missing About Us or Contact");
const contentPageSource = await readFile(path.join(root, "js/content-page.js"), "utf8");
if (!contentPageSource.includes("Manuscript in preparation") || !contentPageSource.includes("replace-with-paper-url")) failures.push("research content is missing the paper and conference placeholder");
if (publicShell.includes('class="footer-documentation"')) failures.push("footer still duplicates documentation navigation");
if (!workspaceShell.includes('id="toggleLocationPanelButton"') || !workspaceShell.includes('id="locationPanelDragHandle"')) failures.push("workspace shell is missing toggleable draggable map search controls");
if (!workspaceShell.includes('<option value="positron" selected>Positron</option>')) failures.push("workspace shell does not default to the Positron basemap");


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
for (const entry of ["index.html", "home-3d.html", "about.html", "documentation.html", "research.html", "contact.html", "lumos-lab.html", "unified.html", "heat.html", "air.html", "soil.html", "water.html", "workspace-shell.html", "404.html", "manifest.webmanifest", "service-worker.js", "release.json", "assets", "css", "js", "docs", "data"]) {
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
