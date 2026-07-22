import test from "node:test";
import assert from "node:assert/strict";
import { DOMAINS } from "../js/config/domains.js";
import { generateScenario } from "../js/data/synthetic.js";
import { evaluateNetwork } from "../js/model/objective.js";
import { optimizeNetwork } from "../js/model/optimizer.js";

test("synthetic scenario has dense cells and distinct candidate sites", () => {
  const scenario = generateScenario("core", 1234);
  assert.equal(scenario.cells.length, 29 * 29);
  assert.equal(scenario.candidates.length, 13 * 13);
  assert.ok(scenario.cells.every((cell) => cell.risk >= 0 && cell.risk <= 1));
});

test("adding a feasible sensor improves information over an empty network", () => {
  const scenario = generateScenario("heat", 1234);
  const context = {
    cells: scenario.cells,
    domain: DOMAINS.heat,
    weights: DOMAINS.heat.weights,
    influenceScale: 1,
    fairnessConstraint: true
  };
  const empty = evaluateNetwork({ ...context, selected: [] });
  const one = evaluateNetwork({ ...context, selected: [scenario.candidates.find((candidate) => candidate.feasible)] });
  assert.ok(one.information > empty.information);
});

test("optimizer returns requested count when sufficient feasible sites exist", () => {
  const scenario = generateScenario("air", 4321);
  const result = optimizeNetwork({
    cells: scenario.cells,
    candidates: scenario.candidates,
    domain: DOMAINS.air,
    weights: DOMAINS.air.weights,
    influenceScale: 1,
    fairnessConstraint: true,
    seed: scenario.seed
  }, 8, { minimumSeparation: true });
  assert.equal(result.selected.length, 8);
  assert.equal(result.baselines.length, 5);
  assert.ok(Number.isFinite(result.metrics.score));
});
