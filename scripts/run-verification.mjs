import { spawn } from "node:child_process";

function runScript(label, script) {
  console.log(`\n=== ${label} ===`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited with ${signal ? `signal ${signal}` : `status ${code}`}.`));
    });
  });
}

await runScript("Automated tests", "scripts/run-tests.mjs");
await runScript("Release integrity check", "scripts/release-check.mjs");
await runScript("Deterministic static build", "scripts/build-static-site.mjs");
await Promise.all([
  runScript("Cross-domain architecture audit", "scripts/run-cross-domain-audit.mjs"),
  runScript("Initial cross-domain allocation", "scripts/run-cross-domain-budget-allocation.mjs"),
  runScript("Sequential evidence reallocation", "scripts/run-sequential-reallocation.mjs"),
  runScript("Adaptive multi-round simulation", "scripts/run-adaptive-program-simulation.mjs"),
  runScript("Robust policy ensemble", "scripts/run-robust-policy-ensemble.mjs"),
  runScript("Spatially coupled deployment", "scripts/run-spatial-deployment.mjs"),
  runScript("Host inventory field-feasibility review", "scripts/run-host-feasibility-review.mjs"),
  runScript("Field-campaign operations and reserve planning", "scripts/run-field-campaign-operations.mjs"),
  runScript("Live campaign tracking and adaptive replacement", "scripts/run-live-campaign-tracking.mjs"),
  runScript("Installation commissioning and maintenance operations", "scripts/run-commissioning-operations.mjs")
]);
await runScript("Internal release quality audit", "scripts/run-public-launch-readiness.mjs");
console.log("\nLUMOS verification completed successfully.");
