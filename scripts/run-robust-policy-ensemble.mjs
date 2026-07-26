import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIllustrativeEvidenceBundle } from "../js/model/unified/sequential-reallocation.js";
import {
  DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG,
  evaluateRobustPolicies,
  robustPolicyEnsembleRows,
  rowsToRobustPolicyEnsembleCsv
} from "../js/model/unified/robust-policy-ensemble.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "data/examples");
await mkdir(outputDirectory, { recursive: true });

const result = evaluateRobustPolicies(DEFAULT_ROBUST_POLICY_ENSEMBLE_CONFIG, createIllustrativeEvidenceBundle());
if (!result.ready) throw new Error("No robust multi-round policy comparison was generated.");

await writeFile(resolve(outputDirectory, "robust-policy-ensemble.json"), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  resolve(outputDirectory, "robust-policy-ensemble.csv"),
  `${rowsToRobustPolicyEnsembleCsv(robustPolicyEnsembleRows(result))}\n`
);

console.log(`Robust policy ensemble: ${result.config.ensembleSize} members across ${result.policies.length} trajectories.`);
console.log(`Robust recommendation: ${result.robustPolicyKey}`);
console.log(`Expected-value recommendation: ${result.expectedValuePolicyKey}`);
console.log(`Minimax-regret recommendation: ${result.minimaxRegretPolicyKey}`);
console.log(`Robust ensemble checksum: ${result.checksum}`);
