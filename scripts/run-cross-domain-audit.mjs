import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  crossDomainAuditRows,
  rowsToCrossDomainAuditCsv,
  runCrossDomainConsistencyAudit
} from "../js/release/domain-audit.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseMetadata = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
const audit = runCrossDomainConsistencyAudit({ releaseMetadata });
const outputDir = path.join(root, "data", "examples");
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "cross-domain-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
await writeFile(path.join(outputDir, "cross-domain-audit.csv"), `${rowsToCrossDomainAuditCsv(crossDomainAuditRows(audit))}\n`);
console.log(`Cross-domain audit: ${audit.counts.pass} passed, ${audit.counts.warn} warnings, ${audit.counts.fail} failures.`);
console.log(`Checksum: ${audit.checksum}`);
if (!audit.ready) process.exit(1);
