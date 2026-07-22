import { DOMAINS, WEIGHT_LABELS } from "./config/domains.js";
import { generateScenario } from "./data/synthetic.js";
import { optimizeNetwork } from "./model/optimizer.js";
import { LumosMap } from "./map.js";

const state = {
  domainKey: "core",
  seed: 20260721,
  scenario: null,
  result: null,
  layer: "risk",
  weights: { ...DOMAINS.core.weights }
};

const elements = {
  domainTitle: document.querySelector("#domainTitle"),
  domainStatus: document.querySelector("#domainStatus"),
  domainDescription: document.querySelector("#domainDescription"),
  monitorCount: document.querySelector("#monitorCount"),
  monitorCountValue: document.querySelector("#monitorCountValue"),
  influenceScale: document.querySelector("#influenceScale"),
  influenceScaleValue: document.querySelector("#influenceScaleValue"),
  measurementNoise: document.querySelector("#measurementNoise"),
  measurementNoiseValue: document.querySelector("#measurementNoiseValue"),
  fairnessLimit: document.querySelector("#fairnessLimit"),
  fairnessLimitValue: document.querySelector("#fairnessLimitValue"),
  weightControls: document.querySelector("#weightControls"),
  fairnessConstraint: document.querySelector("#fairnessConstraint"),
  minimumSeparation: document.querySelector("#minimumSeparation"),
  showCandidates: document.querySelector("#showCandidates"),
  optimizeButton: document.querySelector("#optimizeButton"),
  newScenarioButton: document.querySelector("#newScenarioButton"),
  resetWeightsButton: document.querySelector("#resetWeightsButton"),
  runStatus: document.querySelector("#runStatus"),
  resultHeading: document.querySelector("#resultHeading"),
  resultSummary: document.querySelector("#resultSummary"),
  baselineTableBody: document.querySelector("#baselineTableBody"),
  explanationList: document.querySelector("#explanationList"),
  metricObjective: document.querySelector("#metricObjective"),
  metricInformation: document.querySelector("#metricInformation"),
  metricExposure: document.querySelector("#metricExposure"),
  metricFairness: document.querySelector("#metricFairness"),
  metricRedundancy: document.querySelector("#metricRedundancy"),
  metricReliability: document.querySelector("#metricReliability"),
  metricWorstGroup: document.querySelector("#metricWorstGroup")
};

const map = new LumosMap("map");

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderWeights() {
  elements.weightControls.innerHTML = "";
  for (const [key, label] of Object.entries(WEIGHT_LABELS)) {
    const wrapper = document.createElement("div");
    wrapper.className = "weight-control";
    wrapper.innerHTML = `
      <label for="weight-${key}">
        <span>${label}</span>
        <output id="weight-${key}-value">${state.weights[key].toFixed(2)}</output>
      </label>
      <input id="weight-${key}" data-weight="${key}" type="range" min="0" max="1.5" value="${state.weights[key]}" step="0.05">
    `;
    elements.weightControls.appendChild(wrapper);
  }

  elements.weightControls.querySelectorAll("input[data-weight]").forEach((input) => {
    input.addEventListener("input", () => {
      state.weights[input.dataset.weight] = Number(input.value);
      document.querySelector(`#weight-${input.dataset.weight}-value`).value = Number(input.value).toFixed(2);
    });
  });
}

function resetResults() {
  state.result = null;
  map.setResult(null);
  elements.resultHeading.textContent = "Run the optimizer";
  elements.resultSummary.textContent = "LUMOS will compare its selected network against random, uniform, hotspot-only, and uncertainty-only strategies.";
  elements.baselineTableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No run yet</td></tr>';
  elements.explanationList.innerHTML = "<li>Selections will appear after optimization.</li>";
  elements.metricObjective.textContent = "--";
  elements.metricInformation.textContent = "--";
  elements.metricExposure.textContent = "--";
  elements.metricFairness.textContent = "--";
  elements.metricRedundancy.textContent = "--";
  elements.metricReliability.textContent = "--";
  elements.metricWorstGroup.textContent = "--";
}

function loadScenario() {
  state.scenario = generateScenario(state.domainKey, state.seed);
  map.setScenario(state.scenario);
  resetResults();
  elements.runStatus.textContent = `Scenario ${state.seed} ready · ${state.scenario.cells.length} evaluation points · ${state.scenario.candidates.length} candidates · ${state.scenario.observations.length} existing observations`;
}

function applyDomain(domainKey) {
  state.domainKey = domainKey;
  const domain = DOMAINS[domainKey];
  state.weights = { ...domain.weights };
  elements.domainTitle.textContent = domain.label;
  elements.domainStatus.textContent = domain.status;
  elements.domainDescription.textContent = domain.description;
  document.querySelectorAll(".domain-tab").forEach((button) => button.classList.toggle("active", button.dataset.domain === domainKey));
  renderWeights();
  loadScenario();
}

function renderResult(result) {
  const metrics = result.metrics;
  map.setResult(result);
  elements.resultHeading.textContent = `${result.selected.length} recommended monitors`;
  elements.resultSummary.textContent = `${result.model.family} selected sites that reduce posterior epistemic uncertainty while balancing exposure, equity, reliability, cost, and redundancy.`;
  elements.metricObjective.textContent = metrics.score.toFixed(3);
  elements.metricInformation.textContent = formatPercent(metrics.information);
  elements.metricExposure.textContent = formatPercent(metrics.exposure);
  elements.metricFairness.textContent = formatPercent(metrics.fairnessGap);
  elements.metricRedundancy.textContent = formatPercent(metrics.redundancy);
  elements.metricReliability.textContent = formatPercent(metrics.reliability);
  elements.metricWorstGroup.textContent = formatPercent(metrics.fairnessWorstLoss);

  elements.baselineTableBody.innerHTML = result.baselines.map((baseline) => `
    <tr class="${baseline.name === "LUMOS" ? "best-row" : ""}">
      <td>${baseline.name}</td>
      <td>${baseline.metrics.score.toFixed(3)}</td>
      <td>${formatPercent(baseline.metrics.information)}</td>
      <td>${formatPercent(baseline.metrics.fairnessGap)}</td>
    </tr>
  `).join("");

  elements.explanationList.innerHTML = result.explanations.slice(0, 8).map((entry, index) => `<li><strong>Monitor ${index + 1}:</strong> ${entry.text || "balanced marginal improvement across objectives"}.</li>`).join("");
}

function runOptimization() {
  elements.optimizeButton.disabled = true;
  elements.runStatus.textContent = "Evaluating candidate networks...";
  requestAnimationFrame(() => {
    const domain = DOMAINS[state.domainKey];
    const context = {
      cells: state.scenario.cells,
      candidates: state.scenario.candidates,
      domain,
      weights: state.weights,
      observations: state.scenario.observations,
      fairnessConstraint: elements.fairnessConstraint.checked,
      fairnessLimit: Number(elements.fairnessLimit.value),
      modelSettings: {
        measurementNoise: Number(elements.measurementNoise.value),
        lengthScaleMultiplier: Number(elements.influenceScale.value),
        transportAngle: state.scenario.model?.transportAngle
      },
      seed: state.seed
    };
    state.result = optimizeNetwork(context, Number(elements.monitorCount.value), {
      minimumSeparation: elements.minimumSeparation.checked
    });
    renderResult(state.result);
    const constraintText = state.result.metrics.fairnessSatisfied ? "fairness target satisfied" : "fairness target not reached";
    elements.runStatus.textContent = `Optimization complete · score ${state.result.metrics.score.toFixed(3)} · ${constraintText}`;
    elements.optimizeButton.disabled = false;
  });
}

for (const button of document.querySelectorAll(".domain-tab")) {
  button.addEventListener("click", () => applyDomain(button.dataset.domain));
}

for (const button of document.querySelectorAll(".layer-button")) {
  button.addEventListener("click", () => {
    state.layer = button.dataset.layer;
    document.querySelectorAll(".layer-button").forEach((item) => item.classList.toggle("active", item === button));
    map.setLayer(state.layer);
  });
}

elements.monitorCount.addEventListener("input", () => {
  elements.monitorCountValue.value = elements.monitorCount.value;
});
elements.influenceScale.addEventListener("input", () => {
  elements.influenceScaleValue.value = `${Number(elements.influenceScale.value).toFixed(2)}x`;
});
elements.measurementNoise.addEventListener("input", () => {
  elements.measurementNoiseValue.value = Number(elements.measurementNoise.value).toFixed(3);
});
elements.fairnessLimit.addEventListener("input", () => {
  elements.fairnessLimitValue.value = formatPercent(Number(elements.fairnessLimit.value));
});
elements.showCandidates.addEventListener("change", () => map.setCandidatesVisible(elements.showCandidates.checked));
elements.optimizeButton.addEventListener("click", runOptimization);
elements.newScenarioButton.addEventListener("click", () => {
  state.seed += 137;
  loadScenario();
});
elements.resetWeightsButton.addEventListener("click", () => {
  state.weights = { ...DOMAINS[state.domainKey].weights };
  renderWeights();
});

applyDomain("core");
