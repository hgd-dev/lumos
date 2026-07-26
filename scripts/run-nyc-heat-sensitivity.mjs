import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DOMAINS } from "../js/config/domains.js";
import { loadNycHeatScenario } from "../js/data/heat/nyc.js";
import { calibrateHeatModel } from "../js/model/heat/inference.js";
import {
  createHeatExperimentPackage,
  createLockedHeatSplit,
  runLockedHeatExperiment
} from "../js/model/heat/experiments.js";
import {
  buildHeatPaperRows,
  rowsToCsv,
  runHeatSensitivityAnalysis
} from "../js/model/heat/sensitivity.js";

const seed = 20260722;
console.log("Loading official NYC Heat scenario...");
const scenario = await loadNycHeatScenario(seed, {
  heatScenario: "baseline",
  onProgress: (message) => console.log(message)
});

console.log("Calibrating on development sensors...");
const split = createLockedHeatSplit(scenario.observations ?? [], { seed });
const development = split.available ? split.development : scenario.observations;
const calibration = calibrateHeatModel({ ...scenario, observations: development }, DOMAINS.heat);
const lockedExperiment = runLockedHeatExperiment({
  observations: scenario.observations,
  domain: DOMAINS.heat,
  settings: calibration.settings,
  splitOptions: { seed }
});

console.log("Running Heat Sensitivity Lab...");
const sensitivity = runHeatSensitivityAnalysis({
  scenario,
  domain: DOMAINS.heat,
  calibrationSettings: calibration.settings,
  monitorCount: 10,
  budget: 10,
  fairnessLimit: 0.16,
  minimumGroupInformation: 0.12,
  minimumReliability: 0.70,
  enforceSocialConstraints: true,
  minimumSeparation: true
});
const experiment = createHeatExperimentPackage({
  scenario,
  calibration,
  lockedExperiment,
  configuration: {
    heatScenario: "baseline",
    monitorCount: 10,
    budget: 10,
    fairnessLimit: 0.16,
    minimumGroupInformation: 0.12,
    minimumReliability: 0.70
  },
  release: "0.8.0"
});
const rows = buildHeatPaperRows({ sensitivity, lockedExperiment, calibration });
const outputDirectory = resolve("data/cities/nyc/exports");
await mkdir(outputDirectory, { recursive: true });
const stem = experiment.experimentId;
await writeFile(resolve(outputDirectory, `${stem}-paper-tables.csv`), rowsToCsv(rows));
await writeFile(resolve(outputDirectory, `${stem}-sensitivity.json`), JSON.stringify({
  experimentId: experiment.experimentId,
  experimentChecksum: experiment.checksum,
  sensitivity,
  rows
}, null, 2));
console.log(`Wrote ${outputDirectory}/${stem}-paper-tables.csv`);
console.log(`Wrote ${outputDirectory}/${stem}-sensitivity.json`);
console.log(`Sensitivity runtime: ${(sensitivity.runtimeMs / 1000).toFixed(2)} s`);
