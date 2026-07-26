import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  campaignTrackingRows,
  createIllustrativeCampaignOutcomes,
  rowsToCampaignTrackingCsv,
  trackLiveCampaign
} from "../js/model/unified/campaign-tracking.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "examples");
await mkdir(outputDirectory, { recursive: true });

const deploymentResult = JSON.parse(await readFile(path.join(outputDirectory, "field-feasibility-deployment.json"), "utf8"));
const campaignResult = JSON.parse(await readFile(path.join(outputDirectory, "field-campaign-operations.json"), "utf8"));
const outcomeBundle = createIllustrativeCampaignOutcomes(campaignResult, "balanced");
const result = trackLiveCampaign({
  deploymentResult,
  campaignResult,
  campaignProfileKey: "balanced",
  outcomeBundle,
  completedPhase: outcomeBundle.summary.maximumPhase
});

await writeFile(path.join(outputDirectory, "live-campaign-outcomes.json"), `${JSON.stringify(outcomeBundle, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "live-campaign-tracking.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "live-campaign-tracking.csv"), `${rowsToCampaignTrackingCsv(campaignTrackingRows(result))}\n`, "utf8");

const metrics = result.currentSnapshot.metrics;
console.log(`Live campaign tracking: ${result.eventHistory.length} events through phase ${result.completedPhase}.`);
console.log(`Operational network: ${metrics.operationalAssignments}/${metrics.totalAssignments} assignments; ${metrics.replacementAssignments} replacements; ${metrics.unresolvedAssignments} gaps.`);
console.log(`Outcome ledger checksum: ${outcomeBundle.checksum}`);
console.log(`Live campaign checksum: ${result.checksum}`);
