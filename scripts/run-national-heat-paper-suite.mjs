import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  paperSuiteRows,
  rowsToPaperSuiteCsv,
  runNationalPaperSuite
} from "../js/model/heat/paper-runner.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outputDirectory = path.join(root, "data", "cities", "national", "exports");

console.log("Running the four-city LUMOS Heat paper suite...");
const bundle = await runNationalPaperSuite({
  includeFairnessScreen: true,
  onProgress: ({ caseIndex, caseCount, caseLabel, stage }) => {
    console.log(`[${caseIndex + 1}/${caseCount}] ${caseLabel}: ${stage}`);
  }
});

await fs.mkdir(outputDirectory, { recursive: true });
const stem = `lumos-heat-paper-${bundle.checksum.slice(0, 12)}`;
const jsonPath = path.join(outputDirectory, `${stem}.json`);
const csvPath = path.join(outputDirectory, `${stem}.csv`);
await fs.writeFile(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
await fs.writeFile(csvPath, `${rowsToPaperSuiteCsv(paperSuiteRows(bundle))}\n`, "utf8");
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${csvPath}`);
