import { candidateDistance } from "./kernels.js";
import { evaluateNetwork, explainCandidate } from "./objective.js";

function isSeparated(candidate, selected, minimumDistance) {
  return selected.every((item) => candidateDistance(candidate, item) >= minimumDistance);
}

function compareCandidates(candidate, best, selected, context) {
  const metrics = evaluateNetwork({ ...context, selected: [...selected, candidate] });
  if (!best || metrics.score > best.metrics.score) return { candidate, metrics };
  return best;
}

function greedySelect(context, count, options = {}) {
  const selected = [];
  const remaining = new Set(context.candidates.map((candidate) => candidate.id));
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;

  while (selected.length < count && remaining.size > 0) {
    let best = null;
    for (const candidate of context.candidates) {
      if (!remaining.has(candidate.id) || !candidate.feasible) continue;
      if (minimumDistance > 0 && !isSeparated(candidate, selected, minimumDistance)) continue;
      best = compareCandidates(candidate, best, selected, context);
    }
    if (!best) break;
    selected.push(best.candidate);
    remaining.delete(best.candidate.id);
  }
  return selected;
}

function localImprove(context, initial, options = {}) {
  let selected = [...initial];
  let currentMetrics = evaluateNetwork({ ...context, selected });
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  let improved = true;
  let passes = 0;

  while (improved && passes < 4) {
    improved = false;
    passes += 1;
    const selectedIds = new Set(selected.map((item) => item.id));

    for (let position = 0; position < selected.length; position += 1) {
      const without = selected.filter((_, index) => index !== position);
      for (const candidate of context.candidates) {
        if (selectedIds.has(candidate.id) || !candidate.feasible) continue;
        if (minimumDistance > 0 && !isSeparated(candidate, without, minimumDistance)) continue;
        const trial = [...without, candidate];
        const metrics = evaluateNetwork({ ...context, selected: trial });
        if (metrics.score > currentMetrics.score + 1e-7) {
          selected = trial;
          currentMetrics = metrics;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return { selected, metrics: currentMetrics };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomStrategy(candidates, count, seed) {
  const random = seededRandom(seed);
  return [...candidates]
    .filter((item) => item.feasible)
    .sort(() => random() - 0.5)
    .slice(0, count);
}

function hotspotStrategy(candidates, count) {
  return [...candidates].filter((item) => item.feasible).sort((a, b) => b.localRisk - a.localRisk).slice(0, count);
}

function uncertaintyStrategy(candidates, count) {
  return [...candidates].filter((item) => item.feasible).sort((a, b) => b.localUncertainty - a.localUncertainty).slice(0, count);
}

function uniformStrategy(candidates, count) {
  const feasible = candidates.filter((item) => item.feasible);
  if (count >= feasible.length) return feasible;
  const selected = [feasible.reduce((best, item) => item.x + item.y < best.x + best.y ? item : best, feasible[0])];
  while (selected.length < count) {
    const selectedIds = new Set(selected.map((item) => item.id));
    let best = null;
    let bestDistance = -Infinity;
    for (const candidate of feasible) {
      if (selectedIds.has(candidate.id)) continue;
      const nearest = Math.min(...selected.map((item) => candidateDistance(candidate, item)));
      if (nearest > bestDistance) {
        best = candidate;
        bestDistance = nearest;
      }
    }
    if (!best) break;
    selected.push(best);
  }
  return selected;
}

export function optimizeNetwork(context, count, options = {}) {
  const greedy = greedySelect(context, count, options);
  const improved = localImprove(context, greedy, options);

  const explanations = [];
  const prefix = [];
  for (const candidate of improved.selected) {
    explanations.push({
      id: candidate.id,
      text: explainCandidate(candidate, context.cells, prefix, context.domain, context.weights, context.influenceScale, context.fairnessConstraint)
    });
    prefix.push(candidate);
  }

  const baselineNetworks = {
    LUMOS: improved.selected,
    Random: randomStrategy(context.candidates, count, context.seed + 91),
    Uniform: uniformStrategy(context.candidates, count),
    Hotspot: hotspotStrategy(context.candidates, count),
    Uncertainty: uncertaintyStrategy(context.candidates, count)
  };

  const baselines = Object.entries(baselineNetworks).map(([name, selected]) => ({
    name,
    selected,
    metrics: evaluateNetwork({ ...context, selected })
  })).sort((a, b) => b.metrics.score - a.metrics.score);

  return {
    selected: improved.selected,
    metrics: improved.metrics,
    explanations,
    baselines
  };
}
