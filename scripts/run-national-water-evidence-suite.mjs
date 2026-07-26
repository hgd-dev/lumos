import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  rowsToWaterEvidenceCsv,
  runNationalWaterEvidenceSuite,
  waterEvidenceRows
} from "../js/model/water/evidence-runner.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "data", "cities", "national-water", "exports");

console.log("Running the LUMOS four-case Water public evidence suite...");
const bundle = await runNationalWaterEvidenceSuite({
  includeSensitivity: true,
  onProgress: ({ caseIndex, caseCount, caseLabel, stage }) => {
    console.log(`[${caseIndex + 1}/${caseCount}] ${caseLabel}: ${stage}`);
  }
});
await mkdir(outputDir, { recursive: true });
const stem = `lumos-water-public-evidence-${bundle.checksum.slice(0, 12)}`;
const jsonPath = path.join(outputDir, `${stem}.json`);
const csvPath = path.join(outputDir, `${stem}.csv`);
await writeFile(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`);
await writeFile(csvPath, `${rowsToWaterEvidenceCsv(waterEvidenceRows(bundle))}\n`);
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${csvPath}`);
console.log(`Checksum: ${bundle.checksum}`);
