import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG,
  allocateSequentialFundingRound,
  createIllustrativeEvidenceBundle,
  rowsToSequentialReallocationCsv,
  sequentialReallocationRows
} from "../js/model/unified/sequential-reallocation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "data/examples");
await mkdir(outputDirectory, { recursive: true });

const evidence = createIllustrativeEvidenceBundle();
const result = allocateSequentialFundingRound(DEFAULT_SEQUENTIAL_REALLOCATION_CONFIG, evidence);
if (!result.ready) throw new Error(result.reason);

await writeFile(resolve(outputDirectory, "sequential-evidence-example.json"), `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(resolve(outputDirectory, "sequential-reallocation.json"), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  resolve(outputDirectory, "sequential-reallocation.csv"),
  `${rowsToSequentialReallocationCsv(sequentialReallocationRows(result))}\n`
);

console.log(`Sequential reallocation: ${result.portfolio.length} profiles from ${result.evaluatedAllocations} tested allocations (${result.feasibleAllocations} floor-feasible).`);
console.log(`Evidence checksum: ${evidence.checksum}`);
console.log(`Allocation checksum: ${result.checksum}`);
