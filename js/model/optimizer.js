import { candidateDistance } from "./kernels.js";
import {
  prepareBayesianDesign,
  cloneDesign,
  forkDesign,
  marginalVarianceReduction,
  assimilateCandidate,
  evaluateSelectedOrder
} from "./bayesian/design.js";
import {
  calculateBayesianMetrics,
  summarizeMarginalContributions
} from "./bayesian/metrics.js";
import { validateScenario } from "./schema/scenario.js";
import { SOLUTION_PROFILES, profileWeights } from "./optimization/profiles.js";
import {
  normalizeConstraints,
  evaluateConstraintStatus,
  progressiveConstraintPenalty
} from "./optimization/constraints.js";
import { nondominatedSolutions } from "./optimization/pareto.js";
import {
  buildScientificBenchmarkNetworks,
  evaluateScientificBenchmarks,
  buildExactBenchmark
} from "./benchmarks/index.js";

function isSeparated(candidate, selectedIndices, candidates, minimumDistance, fixedSites = []) {
  return selectedIndices.every((index) => (
    candidateDistance(candidate, candidates[index]) >= minimumDistance
  )) && fixedSites.every((site) => candidateDistance(candidate, site) >= minimumDistance);
}

function posteriorAfterReduction(posteriorVariance, reduction) {
  const trial = new Float64Array(posteriorVariance.length);
  for (let index = 0; index < trial.length; index += 1) {
    trial[index] = Math.max(1e-12, posteriorVariance[index] - reduction[index]);
  }
  return trial;
}

function metricsFor(
  design,
  selectedIndices,
  posteriorVariance,
  weights,
  context,
  baseCandidateCovariance
) {
  return calculateBayesianMetrics({
    points: design.evaluationPoints,
    candidates: design.candidates,
    selectedIndices,
    baselineVariance: design.baselineVariance,
    posteriorVariance,
    baseCandidateCovariance,
    weights,
    fairnessConstraint: context.constraints.enforceSocialConstraints,
    fairnessLimit: context.constraints.fairnessLimit
  });
}

function stateKey(indices) {
  return [...indices].sort((left, right) => left - right).join(",");
}

function compareFinalStates(left, right) {
  if (left.constraintStatus.feasible !== right.constraintStatus.feasible) {
    return left.constraintStatus.feasible ? -1 : 1;
  }
  if (!left.constraintStatus.feasible && left.constraintStatus.totalViolation !== right.constraintStatus.totalViolation) {
    return left.constraintStatus.totalViolation - right.constraintStatus.totalViolation;
  }
  return right.metrics.score - left.metrics.score;
}

function constrainedBeamSelect(baseDesign, count, context, weights, options = {}) {
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const beamWidth = Math.max(1, options.beamWidth ?? 4);
  const initialDesign = cloneDesign(baseDesign);
  const initialMetrics = metricsFor(
    initialDesign,
    [],
    initialDesign.posteriorVariance,
    weights,
    context,
    baseCandidateCovariance
  );

  let beam = [{
    design: initialDesign,
    selectedIndices: [],
    selectedSet: new Set(),
    totalCost: 0,
    metrics: initialMetrics,
    explanations: [],
    rank: 0
  }];

  for (let step = 0; step < count; step += 1) {
    const expansions = [];
    const progress = (step + 1) / count;

    for (const state of beam) {
      for (let candidateIndex = 0; candidateIndex < state.design.candidates.length; candidateIndex += 1) {
        const candidate = state.design.candidates[candidateIndex];
        if (state.selectedSet.has(candidateIndex) || !candidate.feasible) continue;
        if (state.totalCost + candidate.cost > context.constraints.budget + 1e-9) continue;
        if (minimumDistance > 0 && !isSeparated(
          candidate,
          state.selectedIndices,
          state.design.candidates,
          minimumDistance,
          context.observations
        )) continue;

        const reduction = marginalVarianceReduction(state.design, candidateIndex);
        const trialPosterior = posteriorAfterReduction(state.design.posteriorVariance, reduction);
        const trialIndices = [...state.selectedIndices, candidateIndex];
        const trialMetrics = metricsFor(
          state.design,
          trialIndices,
          trialPosterior,
          weights,
          context,
          baseCandidateCovariance
        );
        const penalty = progressiveConstraintPenalty(trialMetrics, context.constraints, progress);
        const deterministicTieBreak = ((candidateIndex * 2654435761 + step * 1013904223) >>> 0) / 4294967296;

        expansions.push({
          parent: state,
          candidateIndex,
          metrics: trialMetrics,
          rank: trialMetrics.score - penalty + deterministicTieBreak * 1e-8
        });
      }
    }

    if (expansions.length === 0) break;
    expansions.sort((left, right) => right.rank - left.rank);

    const nextBeam = [];
    const seen = new Set();
    for (const expansion of expansions) {
      const selectedIndices = [...expansion.parent.selectedIndices, expansion.candidateIndex];
      const key = stateKey(selectedIndices);
      if (seen.has(key)) continue;
      seen.add(key);

      const design = forkDesign(expansion.parent.design);
      assimilateCandidate(design, expansion.candidateIndex);
      const candidate = design.candidates[expansion.candidateIndex];
      nextBeam.push({
        design,
        selectedIndices,
        selectedSet: new Set(selectedIndices),
        totalCost: expansion.parent.totalCost + candidate.cost,
        metrics: metricsFor(
          design,
          selectedIndices,
          design.posteriorVariance,
          weights,
          context,
          baseCandidateCovariance
        ),
        explanations: [
          ...expansion.parent.explanations,
          {
            id: candidate.id,
            text: summarizeMarginalContributions(expansion.parent.metrics, expansion.metrics)
          }
        ],
        rank: expansion.rank
      });
      if (nextBeam.length >= beamWidth) break;
    }

    beam = nextBeam;
  }

  const finalized = beam.map((state) => ({
    ...state,
    constraintStatus: evaluateConstraintStatus(state.metrics, context.constraints)
  })).sort(compareFinalStates);
  const best = finalized[0];

  return {
    selectedIndices: best?.selectedIndices ?? [],
    selected: (best?.selectedIndices ?? []).map((index) => baseDesign.candidates[index]),
    metrics: best?.metrics ?? initialMetrics,
    posteriorVariance: Float64Array.from(best?.design.posteriorVariance ?? initialDesign.posteriorVariance),
    explanations: best?.explanations ?? [],
    constraintStatus: best?.constraintStatus ?? evaluateConstraintStatus(initialMetrics, context.constraints),
    searchDiagnostics: {
      beamWidth,
      completedMonitors: best?.selectedIndices.length ?? 0,
      alternativesRetained: finalized.length
    }
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function feasibleIndices(candidates, observations = [], minimumDistance = 0) {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => (
      candidate.feasible
      && (minimumDistance <= 0 || observations.every((site) => (
        candidateDistance(candidate, site) >= minimumDistance
      )))
    ))
    .map(({ index }) => index);
}

function selectFromOrder(order, candidates, count, minimumDistance, budget = Infinity) {
  const selected = [];
  let totalCost = 0;
  for (const index of order) {
    if (totalCost + candidates[index].cost > budget + 1e-9) continue;
    if (minimumDistance > 0 && !isSeparated(
      candidates[index], selected, candidates, minimumDistance
    )) continue;
    selected.push(index);
    totalCost += candidates[index].cost;
    if (selected.length >= count) break;
  }
  return selected;
}

function randomStrategy(candidates, count, seed, observations, minimumDistance, budget) {
  const random = seededRandom(seed);
  const order = feasibleIndices(candidates, observations, minimumDistance)
    .map((index) => ({ index, key: random() }))
    .sort((left, right) => left.key - right.key)
    .map(({ index }) => index);
  return selectFromOrder(order, candidates, count, minimumDistance, budget);
}

function rankedStrategy(candidates, count, field, observations, minimumDistance, budget) {
  const order = feasibleIndices(candidates, observations, minimumDistance)
    .sort((left, right) => (candidates[right][field] ?? 0) - (candidates[left][field] ?? 0));
  return selectFromOrder(order, candidates, count, minimumDistance, budget);
}

function uniformStrategy(candidates, count, observations, minimumDistance, budget) {
  const feasible = feasibleIndices(candidates, observations, minimumDistance);
  if (feasible.length === 0) return [];
  const first = feasible.reduce((best, index) => (
    candidates[index].x + candidates[index].y < candidates[best].x + candidates[best].y ? index : best
  ), feasible[0]);
  const selected = candidates[first].cost <= budget ? [first] : [];
  let totalCost = selected.length ? candidates[first].cost : 0;

  while (selected.length < count) {
    let bestIndex = null;
    let bestDistance = -Infinity;
    for (const index of feasible) {
      if (selected.includes(index) || totalCost + candidates[index].cost > budget + 1e-9) continue;
      const nearest = selected.length
        ? Math.min(...selected.map((selectedIndex) => candidateDistance(candidates[index], candidates[selectedIndex])))
        : Infinity;
      if (nearest >= minimumDistance && nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    if (bestIndex === null) break;
    selected.push(bestIndex);
    totalCost += candidates[bestIndex].cost;
  }

  return selected;
}

function evaluateBaseline(baseDesign, selectedIndices, context, baseCandidateCovariance, weights) {
  const evaluated = evaluateSelectedOrder(baseDesign, selectedIndices);
  const metrics = calculateBayesianMetrics({
    points: evaluated.evaluationPoints,
    candidates: evaluated.candidates,
    selectedIndices,
    baselineVariance: evaluated.baselineVariance,
    posteriorVariance: evaluated.posteriorVariance,
    baseCandidateCovariance,
    weights,
    fairnessConstraint: context.constraints.enforceSocialConstraints,
    fairnessLimit: context.constraints.fairnessLimit
  });
  return {
    metrics,
    constraintStatus: evaluateConstraintStatus(metrics, context.constraints)
  };
}

function buildBaselines(
  baseDesign,
  solution,
  context,
  weights,
  options,
  scientificNetworks
) {
  const minimumDistance = options.minimumSeparation ? context.domain.minSeparation : 0;
  const observations = context.observations;
  const budget = context.constraints.budget;
  const count = solution.selectedIndices.length;
  const baseCandidateCovariance = baseDesign.candidateCovariance.map((row) => Float64Array.from(row));
  const networks = {
    LUMOS: solution.selectedIndices,
    Random: randomStrategy(context.candidates, count, (context.seed ?? 1) + 91, observations, minimumDistance, budget),
    Uniform: uniformStrategy(context.candidates, count, observations, minimumDistance, budget),
    Hotspot: rankedStrategy(context.candidates, count, "localRisk", observations, minimumDistance, budget),
    Uncertainty: rankedStrategy(context.candidates, count, "localUncertainty", observations, minimumDistance, budget)
  };

  const simpleBaselines = Object.entries(networks).map(([name, selectedIndices]) => {
    if (name === "LUMOS") {
      return {
        name,
        criterion: "Socially constrained posterior design",
        runtimeMs: solution.runtimeMs,
        selected: solution.selected,
        selectedIndices,
        metrics: solution.metrics,
        constraintStatus: solution.constraintStatus
      };
    }
    const evaluated = evaluateBaseline(baseDesign, selectedIndices, context, baseCandidateCovariance, weights);
    return {
      name,
      runtimeMs: 0,
      criterion: name === "Uniform"
        ? "Space-filling distance"
        : name === "Hotspot"
          ? "Highest prior risk"
          : name === "Uncertainty"
            ? "Highest local uncertainty"
            : "Seeded random",
      selected: selectedIndices.map((index) => context.candidates[index]),
      selectedIndices,
      ...evaluated
    };
  });

  const scientificBaselines = evaluateScientificBenchmarks(
    baseDesign,
    scientificNetworks,
    context,
    weights
  );

  return [...simpleBaselines, ...scientificBaselines]
    .sort((left, right) => {
      if (left.constraintStatus.feasible !== right.constraintStatus.feasible) {
        return left.constraintStatus.feasible ? -1 : 1;
      }
      return right.metrics.score - left.metrics.score;
    });
}

export function optimizeNetwork(contextInput, count, options = {}) {
  validateScenario({
    cells: contextInput.cells,
    candidates: contextInput.candidates,
    observations: contextInput.observations ?? []
  });

  const context = {
    ...contextInput,
    observations: contextInput.observations ?? [],
    constraints: normalizeConstraints({
      fairnessLimit: contextInput.fairnessLimit,
      enforceSocialConstraints: contextInput.fairnessConstraint,
      ...contextInput.constraints
    })
  };
  const baseDesign = prepareBayesianDesign({
    evaluationPoints: context.cells,
    candidates: context.candidates,
    observations: context.observations,
    domain: context.domain,
    modelSettings: context.modelSettings ?? {}
  });

  const scientificBenchmarkCache = new Map();
  const scientificNetworksForCount = (networkCount) => {
    if (!scientificBenchmarkCache.has(networkCount)) {
      scientificBenchmarkCache.set(
        networkCount,
        buildScientificBenchmarkNetworks(baseDesign, networkCount, context, options)
      );
    }
    return scientificBenchmarkCache.get(networkCount);
  };

  const profileKeys = options.profileKeys ?? Object.keys(SOLUTION_PROFILES);
  const solutions = profileKeys.map((profileKey) => {
    const weights = profileWeights(context.weights, profileKey);
    const started = globalThis.performance?.now?.() ?? Date.now();
    const optimized = constrainedBeamSelect(baseDesign, count, context, weights, options);
    const runtimeMs = (globalThis.performance?.now?.() ?? Date.now()) - started;
    const profile = SOLUTION_PROFILES[profileKey];
    const solution = {
      profileKey,
      profile,
      weights,
      runtimeMs,
      ...optimized
    };
    solution.baselines = buildBaselines(
      baseDesign,
      solution,
      context,
      weights,
      options,
      scientificNetworksForCount(solution.selectedIndices.length)
    );
    return solution;
  });

  const paretoSolutions = nondominatedSolutions(solutions);
  const paretoKeys = new Set(paretoSolutions.map((solution) => solution.profileKey));
  solutions.forEach((solution) => {
    solution.paretoOptimal = paretoKeys.has(solution.profileKey);
  });

  const preferredProfile = options.preferredProfile ?? "balanced";
  const active = solutions.find((solution) => solution.profileKey === preferredProfile)
    ?? solutions.find((solution) => solution.constraintStatus.feasible)
    ?? solutions[0];
  const exactBenchmark = buildExactBenchmark(
    baseDesign,
    context,
    profileWeights(context.weights, "balanced"),
    options
  );

  return {
    ...active,
    solutions,
    paretoSolutions,
    exactBenchmark,
    preferredProfile: active.profileKey,
    baselineVariance: Float64Array.from(baseDesign.baselineVariance),
    model: {
      family: "Constrained sequential Gaussian-process experimental design",
      covariance: "Domain-aware Matérn 3/2",
      acquisition: "Socially weighted integrated posterior variance reduction",
      optimizer: `Deterministic constrained beam search (width ${options.beamWidth ?? 4})`,
      portfolio: "Preference-vector portfolio with nondominance filtering",
      benchmarks: "A-optimality, D-optimality, target mutual information, pivoted Cholesky, and an exact reduced-pool oracle",
      observationsConditioned: context.observations.length
    }
  };
}
