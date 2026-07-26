import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG,
  allocateCrossDomainBudget,
  crossDomainAllocationRows,
  rowsToCrossDomainAllocationCsv
} from "../js/model/unified/budget-allocation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "data", "examples");
const result = allocateCrossDomainBudget(DEFAULT_CROSS_DOMAIN_BUDGET_CONFIG);
if (!result.ready) throw new Error(result.reason);
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "cross-domain-budget-allocation.json"), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  path.join(outputDir, "cross-domain-budget-allocation.csv"),
  `${rowsToCrossDomainAllocationCsv(crossDomainAllocationRows(result))}\n`
);
console.log(`Cross-domain budget portfolio: ${result.portfolio.length} profiles from ${result.evaluatedAllocations} feasible allocations.`);
console.log(`Checksum: ${result.checksum}`);
