import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createIllustrativeHostInventory } from "../js/model/unified/host-inventory.js";
import { DEFAULT_SPATIAL_DEPLOYMENT_CONFIG, planSpatialDeployment } from "../js/model/unified/spatial-deployment.js";
import { fieldCampaignRows, planFieldCampaign, rowsToFieldCampaignCsv } from "../js/model/unified/field-campaign.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "examples");
await mkdir(outputDirectory, { recursive: true });

const inventory = createIllustrativeHostInventory(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG.bounds);
const deployment = planSpatialDeployment({
  ...DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
  hostSource: "inventory",
  fieldReviewPolicy: "verified-or-conditional",
  hostInventory: inventory.records
});
const result = planFieldCampaign({
  deploymentResult: deployment,
  deploymentProfileKey: "coordinated",
  inspectionCapacityPerPhase: 8,
  maximumPhases: 3,
  reserveRatio: 0.5,
  responseScenario: "central",
  deterministicSeed: 270701,
  inspectionCostPerHost: 450,
  reserveMobilizationCost: 250
});

await writeFile(path.join(outputDirectory, "field-campaign-operations.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "field-campaign-operations.csv"), `${rowsToFieldCampaignCsv(fieldCampaignRows(result))}\n`, "utf8");

const balanced = result.portfolio.find((campaign) => campaign.profileKey === "balanced") ?? result.portfolio[0];
console.log(`Field campaign: ${result.portfolio.length} profiles across ${balanced.metrics.inspectionPhasesUsed} phases.`);
console.log(`Balanced campaign: ${balanced.metrics.scheduledInspections} inspections, ${balanced.metrics.reserveCount} reserves, ${balanced.metrics.unresolvedAssignments} residual gaps.`);
console.log(`Field campaign checksum: ${result.checksum}`);
