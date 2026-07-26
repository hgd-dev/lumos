import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  publicReadinessRows,
  rowsToPublicReadinessCsv,
  runPublicLaunchReadiness
} from "../js/release/public-readiness.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "examples");
await mkdir(outputDirectory, { recursive: true });

const releaseMetadata = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
const domainAudit = JSON.parse(await readFile(path.join(outputDirectory, "cross-domain-audit.json"), "utf8"));
const commissioningResult = JSON.parse(await readFile(path.join(outputDirectory, "commissioning-operations.json"), "utf8"));
const result = runPublicLaunchReadiness({
  releaseMetadata,
  domainAudit,
  commissioningResult,
  runtimeContract: {
    collapsibleHeader: true,
    collapsiblePanels: true,
    mapFocusMode: true,
    skipLink: true,
    visibleFocus: true,
    reducedMotion: true,
    colorVisionPalette: true,
    homeNavigation: true,
    inAppDocumentation: true,
    aboutPage: true
  }
});

await writeFile(path.join(outputDirectory, "public-release-readiness.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "public-release-readiness.csv"), `${rowsToPublicReadinessCsv(publicReadinessRows(result))}\n`, "utf8");

console.log(`Internal release quality: ${result.counts.pass} passed, ${result.counts.warn} warnings, ${result.counts.fail} failures.`);
console.log(`Internal release-quality checksum: ${result.checksum}`);
if (!result.ready) process.exitCode = 1;
