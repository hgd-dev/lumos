import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  commissioningOperationsRows,
  createIllustrativeCommissioningEvents,
  rowsToCommissioningOperationsCsv,
  runCommissioningOperations
} from "../js/model/unified/commissioning-operations.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "examples");
await mkdir(outputDirectory, { recursive: true });

const trackingResult = JSON.parse(await readFile(path.join(outputDirectory, "live-campaign-tracking.json"), "utf8"));
const campaignResult = JSON.parse(await readFile(path.join(outputDirectory, "field-campaign-operations.json"), "utf8"));
const eventBundle = createIllustrativeCommissioningEvents(trackingResult);
const result = runCommissioningOperations({
  trackingResult,
  campaignResult,
  eventBundle,
  campaignProfileKey: "balanced",
  asOfAt: "2026-09-01T00:00:00.000Z",
  installationsPerPhase: 8,
  maximumPhases: 6,
  activateEligibleReplacements: true
});

await writeFile(path.join(outputDirectory, "commissioning-events.json"), `${JSON.stringify(eventBundle, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "commissioning-operations.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "commissioning-operations.csv"), `${rowsToCommissioningOperationsCsv(commissioningOperationsRows(result))}\n`, "utf8");

console.log(`Commissioning operations: ${result.metrics.commissionedAssignments}/${result.metrics.totalAssignments} commissioned; ${result.metrics.provisionalAssignments} provisional; ${result.metrics.offlineAssignments} offline.`);
console.log(`Replacement protection: ${result.metrics.protectedFailures} protected failures; ${result.metrics.unresolvedFailures} unresolved.`);
console.log(`Open tickets: ${result.metrics.openTickets}; first-year modeled operations cost: $${result.metrics.firstYearOperationsCost.toFixed(2)}.`);
console.log(`Commissioning event checksum: ${eventBundle.checksum}`);
console.log(`Commissioning operations checksum: ${result.checksum}`);
