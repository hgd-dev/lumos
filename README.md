# LUMOS v0.2 Bayesian Core

**Localized Unified Monitoring Optimization System**

LUMOS is a static, browser-executed environmental monitoring design tool intended for GitHub Pages. A shared probabilistic optimization engine branches into Heat, Air, Soil, and Water modes through domain adapters.

## What v0.2 does

- Runs entirely in HTML, CSS, and JavaScript.
- Uses one map interface with Core, Heat, Air, Soil, and Water tabs.
- Separates 841 dense field-evaluation points from 169 feasible installation candidates.
- Conditions a Gaussian-process field model on six existing observations.
- Uses domain-aware Matérn 3/2 covariance structures.
- Selects new monitors by expected posterior epistemic-variance reduction.
- Weights information gain by risk, human exposure, vulnerability, community priorities, and ecology.
- Measures group-level remaining information loss and an uncertainty-equity gap.
- Includes measurement noise, reliability, feasibility, cost, redundancy, and minimum-separation controls.
- Benchmarks LUMOS against random, uniform, hotspot-only, and uncertainty-only placement.
- Explains the largest marginal reasons for every selected site.
- Runs without a backend, build system, external package, or API key.

## Scientific status

Version 0.2 is the first genuine Bayesian experimental-design core. It replaces the v0.1 geometric observation proxy with conditional posterior variance reduction.

It is not yet the final research system. Current limitations include:

- synthetic demonstration fields rather than real environmental data;
- a fixed Matérn family rather than learned hyperparameters;
- one scalar objective rather than a generated Pareto frontier;
- a strong fairness penalty and target diagnostic rather than a guaranteed constrained solver;
- greedy sequential design rather than exact, continuous, or robust solver comparisons;
- no temporal field, sensor relocation, or intervention-effect design yet.

Read `MODEL_SPECIFICATION.md` for equations and architecture.

## Run locally

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Run tests

```bash
npm test
```

No package installation is required; the test suite uses Node's built-in test runner.

## Publish on GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings > Pages**.
3. Choose **Deploy from a branch**.
4. Select `main` and `/root`.

## Core architecture

```text
Shared standardized field and social layers
                    |
Existing observations -> Bayesian field conditioning
                    |
Domain-aware covariance and measurement model
                    |
Socially weighted posterior variance reduction
                    |
Sequential monitor selection and diagnostics
                    |
       +------------+------------+------------+
       |            |            |            |
     Heat          Air          Soil         Water
```

## Next milestones

1. Add hard constrained and Pareto optimization modes.
2. Add A-optimal, D-optimal, mutual-information, and pivoted-Cholesky benchmarks.
3. Add robust sensor-failure and uncertain-source scenarios.
4. Add temporal and adaptive batch deployment.
5. Connect the Heat adapter to versioned public datasets.
6. Add intervention/control/spillover monitoring design.
7. Add Air, Soil, and Water data and physics adapters incrementally.
