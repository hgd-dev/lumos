import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIllustrativeEvidenceBundle } from "../js/model/unified/sequential-reallocation.js";
import {
  DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG,
  adaptiveProgramSimulationRows,
  rowsToAdaptiveProgramSimulationCsv,
  simulateAdaptiveProgram
} from "../js/model/unified/adaptive-program-simulation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "data/examples");
await mkdir(outputDirectory, { recursive: true });

const evidence = createIllustrativeEvidenceBundle();
const result = simulateAdaptiveProgram(DEFAULT_ADAPTIVE_PROGRAM_SIMULATION_CONFIG, evidence);
if (!result.ready) throw new Error("No complete adaptive-program trajectory was generated.");

await writeFile(resolve(outputDirectory, "adaptive-program-simulation.json"), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  resolve(outputDirectory, "adaptive-program-simulation.csv"),
  `${rowsToAdaptiveProgramSimulationCsv(adaptiveProgramSimulationRows(result))}\n`
);

console.log(`Adaptive program simulation: ${result.trajectories.length} trajectories across ${result.config.rounds} rounds (${result.completeTrajectories} complete).`);
console.log(`Best trajectory: ${result.bestTrajectoryKey}`);
console.log(`Simulation checksum: ${result.checksum}`);
