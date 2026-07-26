import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  rowsToSoilEvidenceCsv,
  runNationalSoilEvidenceSuite,
  soilEvidenceRows
} from "../js/model/soil/evidence-runner.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "data", "cities", "national-soil", "exports");

console.log("Running the LUMOS four-case Soil public evidence suite...");
const bundle = await runNationalSoilEvidenceSuite({
  includeSensitivity: true,
  onProgress: ({ caseIndex, caseCount, caseLabel, stage }) => {
    console.log(`[${caseIndex + 1}/${caseCount}] ${caseLabel}: ${stage}`);
  }
});
await mkdir(outputDir, { recursive: true });
const stem = `lumos-soil-public-evidence-${bundle.checksum.slice(0, 12)}`;
const jsonPath = path.join(outputDir, `${stem}.json`);
const csvPath = path.join(outputDir, `${stem}.csv`);
await writeFile(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`);
await writeFile(csvPath, `${rowsToSoilEvidenceCsv(soilEvidenceRows(bundle))}\n`);
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${csvPath}`);
console.log(`Checksum: ${bundle.checksum}`);
