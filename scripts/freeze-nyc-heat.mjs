import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMAINS } from "../js/config/domains.js";
import { loadNycHeatScenario } from "../js/data/heat/nyc.js";
import { attachHeatInference, calibrateHeatModel } from "../js/model/heat/inference.js";
import {
  createHeatExperimentPackage,
  createLockedHeatSplit,
  runLockedHeatExperiment
} from "../js/model/heat/experiments.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "data/cities/nyc/frozen/nyc-heat-v0.7.json");
const seed = Number(process.env.LUMOS_SEED ?? 20260722);

console.log("Loading official NYC heat sources...");
const scenario = await loadNycHeatScenario({
  seed,
  onProgress: (message) => console.log(message)
});

const split = createLockedHeatSplit(scenario.observations, { seed });
const development = split.available ? split.development : scenario.observations;
console.log(`Calibrating on ${development.length} development sensors; ${split.test.length} locked sensors.`);
const calibration = calibrateHeatModel({ ...scenario, observations: development }, DOMAINS.heat);
const lockedExperiment = runLockedHeatExperiment({
  observations: scenario.observations,
  domain: DOMAINS.heat,
  settings: calibration.settings,
  splitOptions: { seed }
});
attachHeatInference(scenario, DOMAINS.heat, calibration.settings);

const experiment = createHeatExperimentPackage({
  scenario,
  calibration,
  lockedExperiment,
  configuration: {
    heatScenario: "baseline",
    protocol: "data/cities/nyc/experiment-protocol.json"
  }
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(experiment, null, 2));
console.log(`Wrote ${output}`);
console.log(`Experiment: ${experiment.experimentId}`);
console.log(`Checksum: ${experiment.checksum}`);
if (lockedExperiment.available) {
  console.log(`Locked MAE: ${lockedExperiment.lumos.metrics.mae.toFixed(3)} F`);
  console.log(`Locked RMSE: ${lockedExperiment.lumos.metrics.rmse.toFixed(3)} F`);
}
