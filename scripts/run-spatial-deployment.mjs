import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SPATIAL_DEPLOYMENT_CONFIG,
  planSpatialDeployment,
  rowsToSpatialDeploymentCsv,
  spatialDeploymentRows
} from "../js/model/unified/spatial-deployment.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "examples");
await mkdir(outputDirectory, { recursive: true });

const result = planSpatialDeployment(DEFAULT_SPATIAL_DEPLOYMENT_CONFIG);
await writeFile(path.join(outputDirectory, "spatial-deployment.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "spatial-deployment.csv"), `${rowsToSpatialDeploymentCsv(spatialDeploymentRows(result))}\n`, "utf8");

const coordinated = result.portfolio.find((plan) => plan.profileKey === "coordinated") ?? result.portfolio[0];
console.log(`Spatial deployment: ${result.portfolio.length} profiles across ${result.hostPoolCount} host proxies.`);
console.log(`Coordinated plan: ${coordinated.metrics.assignedUnits} assignments on ${coordinated.metrics.physicalHostCount} physical hosts.`);
console.log(`Shared hosts: ${coordinated.metrics.sharedHostCount}; modeled savings: $${coordinated.metrics.savings.toFixed(2)}.`);
console.log(`Spatial deployment checksum: ${result.checksum}`);
