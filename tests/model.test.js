import test from "node:test";
import assert from "node:assert/strict";
import { DOMAINS } from "../js/config/domains.js";
import { generateScenario } from "../js/data/synthetic.js";
import { prepareBayesianDesign, assimilateCandidate } from "../js/model/bayesian/design.js";
import { optimizeNetwork } from "../js/model/optimizer.js";
import { validateScenario } from "../js/model/schema/scenario.js";

function varianceSum(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

test("synthetic scenario conforms to the shared LUMOS schema", () => {
  const scenario = generateScenario("core", 1234);
  assert.doesNotThrow(() => validateScenario(scenario));
  assert.equal(scenario.cells.length, 29 * 29);
  assert.equal(scenario.candidates.length, 13 * 13);
  assert.equal(scenario.observations.length, 6);
});

test("conditioning on existing observations lowers prior field uncertainty", () => {
  const scenario = generateScenario("heat", 1234);
  const withoutObservations = prepareBayesianDesign({
    evaluationPoints: scenario.cells,
    candidates: scenario.candidates,
    observations: [],
    domain: DOMAINS.heat,
    modelSettings: { measurementNoise: 0.06 }
  });
  const withObservations = prepareBayesianDesign({
    evaluationPoints: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.heat,
    modelSettings: { measurementNoise: 0.06 }
  });
  assert.ok(varianceSum(withObservations.posteriorVariance) < varianceSum(withoutObservations.posteriorVariance));
});

test("assimilating a feasible candidate monotonically reduces posterior variance", () => {
  const scenario = generateScenario("air", 2222);
  const design = prepareBayesianDesign({
    evaluationPoints: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.air,
    modelSettings: { measurementNoise: 0.06 }
  });
  const before = Float64Array.from(design.posteriorVariance);
  const candidateIndex = scenario.candidates.findIndex((candidate) => candidate.feasible);
  assimilateCandidate(design, candidateIndex);
  assert.ok(design.posteriorVariance.every((value, index) => value <= before[index] + 1e-10));
  assert.ok(varianceSum(design.posteriorVariance) < varianceSum(before));
});

test("optimizer returns the requested network and Bayesian diagnostics", () => {
  const scenario = generateScenario("air", 4321);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    observations: scenario.observations,
    domain: DOMAINS.air,
    weights: DOMAINS.air.weights,
    fairnessConstraint: true,
    fairnessLimit: 0.18,
    modelSettings: {
      measurementNoise: 0.06,
      lengthScaleMultiplier: 1,
      transportAngle: scenario.model.transportAngle
    },
    seed: scenario.seed
  }, 8, { minimumSeparation: true });

  assert.equal(result.selected.length, 8);
  assert.equal(result.baselines.length, 5);
  assert.equal(result.posteriorVariance.length, scenario.cells.length);
  assert.ok(result.metrics.information > 0);
  assert.ok(Number.isFinite(result.metrics.score));
  assert.equal(result.model.observationsConditioned, 6);
});

test("all domain adapters produce finite optimization results", () => {
  for (const domainKey of Object.keys(DOMAINS)) {
    const scenario = generateScenario(domainKey, 7788);
    const result = optimizeNetwork({
      cells: scenario.cells,
      candidates: scenario.candidates,
      observations: scenario.observations,
      domain: DOMAINS[domainKey],
      weights: DOMAINS[domainKey].weights,
      fairnessConstraint: true,
      fairnessLimit: 0.2,
      modelSettings: {
        measurementNoise: 0.06,
        lengthScaleMultiplier: 1,
        transportAngle: scenario.model.transportAngle
      },
      seed: scenario.seed
    }, 6, { minimumSeparation: true });
    assert.equal(result.selected.length, 6, domainKey);
    assert.ok(Number.isFinite(result.metrics.score), domainKey);
    assert.ok(result.metrics.information > 0, domainKey);
  }
});
