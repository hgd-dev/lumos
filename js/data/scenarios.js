import { generateScenario } from "./synthetic.js";
import { applyHeatScenario, loadNycHeatScenario } from "./heat/nyc.js";

export async function loadScenario({
  domainKey,
  seed,
  dataMode = "live",
  heatScenario = "baseline",
  fetchImplementation = globalThis.fetch,
  onProgress = () => {}
}) {
  if (domainKey === "heat" && dataMode === "live") {
    try {
      const scenario = await loadNycHeatScenario({ seed, fetchImplementation, onProgress });
      return applyHeatScenario(scenario, heatScenario);
    } catch (error) {
      const fallback = generateScenario("heat", seed);
      fallback.scenarioType = "synthetic-fallback";
      fallback.cityKey = "fallback";
      fallback.cityLabel = "Synthetic fallback city";
      fallback.sourceMetadata = {
        live: false,
        error: error.message,
        sources: [],
        limitations: ["Official NYC data could not be loaded; this run uses the deterministic synthetic heat scenario."]
      };
      return fallback;
    }
  }

  const scenario = generateScenario(domainKey, seed);
  scenario.scenarioType = "synthetic";
  scenario.cityKey = "synthetic";
  scenario.cityLabel = "Synthetic validation region";
  scenario.sourceMetadata = {
    live: false,
    sources: [],
    limitations: ["This mode still uses the controlled synthetic validation scenario."]
  };
  return scenario;
}
