# LUMOS v0.1 Core

**Localized Unified Monitoring Optimization System**

LUMOS is a static, browser-executed environmental monitoring design tool intended for GitHub Pages. One shared optimization and social-objective engine branches into Heat, Air, Soil, and Water modes through domain adapters.

## What this starter already does

- Runs entirely in HTML, CSS, and JavaScript.
- Uses one map interface with Core, Heat, Air, Soil, and Water tabs.
- Generates continuous-field demonstration scenarios at 841 evaluation points.
- Separates evaluation points from 169 feasible installation candidates.
- Uses domain-specific proxy influence kernels.
- Optimizes information, risk, exposure, vulnerability, community priorities, ecology, reliability, cost, fairness, and redundancy.
- Supports minimum-separation and community-information-gap safeguards.
- Runs greedy construction followed by local swap improvement.
- Benchmarks LUMOS against random, uniform, hotspot, and uncertainty-only placement.
- Explains the largest marginal reasons for selected sites.

## Important scientific status

This is the **architectural and executable model scaffold**, not the final research algorithm. Its information term currently measures uncertainty-weighted expected observation. The next model milestone will implement probabilistic field reconstruction and posterior epistemic-variance reduction, then add hard social information-quality constraints and Pareto optimization.

Read `MODEL_SPECIFICATION.md` for equations and planned state-of-the-art extensions.

## Run locally

ES modules require a local web server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings > Pages**.
4. Select **Deploy from a branch**.
5. Select the `main` branch and `/root` directory.

No backend, build step, API key, or package installation is required.

## Planned milestones

1. Replace synthetic information proxy with stationary GP posterior variance.
2. Add sparse and nonstationary probabilistic backbones.
3. Add explicit hard fairness and geographic-representation constraints.
4. Implement Pareto-front generation.
5. Connect the Heat adapter to free public data.
6. Add Air, Soil, and Water data and physics adapters.
7. Add sequential and pre/post-intervention monitoring design.
