import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  airPaperRows,
  rowsToAirPaperCsv,
  runNationalAirPaperSuite
} from "../js/model/air/paper-runner.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "data", "cities", "national-air", "exports");
const openAqApiKey = process.env.OPENAQ_API_KEY ?? "";

console.log("Running the LUMOS national Air paper suite...");
const bundle = await runNationalAirPaperSuite({
  openAqApiKey,
  includeSensitivity: true,
  onProgress: ({ caseIndex, caseCount, caseLabel, stage }) => {
    console.log(`[${caseIndex + 1}/${caseCount}] ${caseLabel}: ${stage}`);
  }
});
await mkdir(outputDir, { recursive: true });
const stem = `lumos-air-paper-${bundle.checksum.slice(0, 12)}`;
await writeFile(path.join(outputDir, `${stem}.json`), `${JSON.stringify(bundle, null, 2)}\n`);
await writeFile(path.join(outputDir, `${stem}.csv`), `${rowsToAirPaperCsv(airPaperRows(bundle))}\n`);
console.log(`Wrote ${path.join(outputDir, `${stem}.json`)}`);
console.log(`Wrote ${path.join(outputDir, `${stem}.csv`)}`);
console.log(`Checksum: ${bundle.checksum}`);
