import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIllustrativeHostInventory,
  hostInventoryRows,
  rowsToHostInventoryCsv
} from "../js/model/unified/host-inventory.js";
import {
  DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
  planSpatialDeployment,
  rowsToSpatialDeploymentCsv,
  spatialDeploymentRows
} from "../js/model/unified/spatial-deployment.js";

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

await writeFile(path.join(outputDirectory, "verified-host-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "verified-host-inventory.csv"), `${rowsToHostInventoryCsv(hostInventoryRows(inventory))}\n`, "utf8");
await writeFile(path.join(outputDirectory, "field-feasibility-deployment.json"), `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "field-feasibility-deployment.csv"), `${rowsToSpatialDeploymentCsv(spatialDeploymentRows(deployment))}\n`, "utf8");

const coordinated = deployment.portfolio.find((plan) => plan.profileKey === "coordinated") ?? deployment.portfolio[0];
console.log(`Host inventory review: ${inventory.summary.total} records (${inventory.summary.byStatus.verified} verified, ${inventory.summary.byStatus.conditional} conditional, ${inventory.summary.byStatus.infeasible} infeasible).`);
console.log(`Field-feasibility deployment: ${deployment.portfolio.length} profiles; coordinated ${coordinated.metrics.assignedUnits}/${coordinated.metrics.requestedUnits} assignments.`);
console.log(`Inventory checksum: ${inventory.checksum}`);
console.log(`Field-feasibility checksum: ${deployment.checksum}`);
