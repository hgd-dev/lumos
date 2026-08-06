<p align="center">
  <img src="assets/lumos-mark.svg" alt="LUMOS logo" width="112">
</p>

<h1 align="center">LUMOS</h1>

<p align="center">
  <strong>Localized Unified Monitoring Optimization System</strong><br>
  Design environmental monitoring that is informative, equitable, and operationally realistic.
</p>

<p align="center">
  <a href="https://hgd-dev.github.io/lumos/"><strong>Launch LUMOS</strong></a>
  ·
  <a href="https://hgd-dev.github.io/lumos/unified.html">Unified</a>
  ·
  <a href="https://hgd-dev.github.io/lumos/lumos-lab.html">LUMOSLab</a>
  ·
  <a href="https://hgd-dev.github.io/lumos/about.html">About Us</a>
  ·
  <a href="https://hgd-dev.github.io/lumos/research.html">Research</a>
  ·
  <a href="MODEL_SPECIFICATION.md">Model specification</a>
</p>

<p align="center">
  <a href="https://github.com/hgd-dev/lumos/actions/workflows/deploy-pages.yml"><img alt="GitHub Pages deployment" src="https://github.com/hgd-dev/lumos/actions/workflows/deploy-pages.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-bdfc6b"></a>
  <a href="https://github.com/hgd-dev/lumos/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/hgd-dev/lumos?display_name=tag&sort=semver"></a>
  <img alt="Static browser application" src="https://img.shields.io/badge/platform-static%20web-89ddff">
</p>

## Overview

LUMOS is a free, map-centered research and planning platform for environmental monitoring across **heat, air, soil, and water**. It helps users move from an uncertain environmental field to a defensible monitoring program—then continue through intervention evaluation, field review, deployment, commissioning, maintenance, and replacement planning.

The system combines domain-specific environmental science with a shared framework for:

- probabilistic field reconstruction;
- epistemic-uncertainty reduction;
- Bayesian and optimal experimental design;
- group-level information quality and fairness constraints;
- exposure, vulnerability, ecological, and community priorities;
- heterogeneous monitoring networks;
- operational feasibility and reliability;
- robust and sequential allocation;
- pre/post-intervention evaluation; and
- full monitoring-program operations.

LUMOS runs as a static browser application. It requires no account, paywall, or permanent application backend.

## Why LUMOS

Environmental monitoring networks are often designed around existing stations, obvious hotspots, administrative boundaries, or convenience. Those approaches can leave major information gaps, oversample already well-characterized areas, and provide unequal evidence quality across communities.

LUMOS instead asks:

> Where should limited monitoring resources go to reduce the most decision-relevant uncertainty while remaining fair, feasible, reliable, and useful for action?

Rather than return one opaque answer, LUMOS generates and compares alternative portfolios so users can inspect the tradeoffs among information, exposure protection, equity, cost, reliability, redundancy, and intervention value.

## Environmental workspaces

| Workspace | Scientific focus |
| --- | --- |
| **LUMOSLab** | Circuit-convergence introduction plus a complete local-first program studio for geographic design, editable sites, feasibility, sensor catalogs, lifecycle budgets, observation and sensor health, validation and power, cross-domain allocation, stability, governance, research, story mode, and reproducible exports |
| **Unified** | Cross-domain budgeting, sequential reallocation, robust trajectories, shared hosts, field campaigns, commissioning, and maintenance |
| **Heat** | Temperature and apparent heat, canopy, imperviousness, exposure, vulnerability, live conditions, forecasts, and heat-intervention evaluation |
| **Air** | PM2.5, PM10, nitrogen dioxide, and ozone with meteorological transport, source context, reference observations, and calibration roles |
| **Soil** | Survey-informed properties, depth-aware laboratory samples, contamination QA, persistent localized variation, and sample-program design |
| **Water** | Indicator-specific observations, directional flow structure, source-to-receptor reasoning, and upstream/downstream intervention roles |

## End-to-end monitoring lifecycle

LUMOS supports a continuous workflow:

1. **Reconstruct** — estimate the environmental field and distinguish reducible epistemic uncertainty from irreducible variation.
2. **Optimize** — compare networks under information, exposure, fairness, reliability, spacing, and budget constraints.
3. **Evaluate** — design treatment, control, boundary, spillover, upstream, downstream, and longitudinal monitoring roles.
4. **Allocate** — distribute resources across environmental domains and future funding rounds.
5. **Stress-test** — compare policies under response, cost, failure, and environmental uncertainty.
6. **Deploy** — coordinate hosts, co-location, infrastructure, permissions, inspections, and reserves.
7. **Track** — apply append-only field outcomes and activate replacements without erasing history.
8. **Operate** — manage installation, calibration, uptime, data completeness, maintenance tickets, and replacement readiness.

## Scientific framing

LUMOS is organized as a **Socially Constrained Sequential Bayesian Environmental Monitoring Design** framework.

Its contribution is the integration of established methods—not a claim to have invented Gaussian-process sensor placement, mutual information, A- or D-optimality, adaptive sampling, equity-aware placement, robust optimization, or BACI-style evaluation.

The architecture separates:

- a shared probabilistic, social, optimization, persistence, and operations engine; and
- domain adapters with distinct observations, units, transport behavior, covariance assumptions, validation procedures, candidate roles, and intervention designs.

Serious baselines and reduced-instance exact benchmarks are included so LUMOS recommendations can be compared against random, uniform, hotspot, information-only, cost-oriented, and classical design strategies.

## Public interface

The public application includes:

- dedicated Home, About Us, Documentation, Research & Process, and Contact & Feedback pages;
- separate Unified, Heat, Air, Soil, and Water workspace URLs;
- one shared workspace shell and model engine across every scientific page;
- a persistent top navigation bar with separate Workspaces, Documentation, and Research & Process menus;
- animated environmental-design branding;
- multiple portfolio recommendations rather than one hidden score;
- map, table, diagnostic, and explainability views;
- permanent documentation and research pages with stable section URLs, including a paper and conference-status area;
- browser-local workspace persistence and local autosave;
- a comprehensive LUMOSLab program studio with schematic GIS editing, operational costing, observation health, validation, research, governance, and stakeholder communication;
- JSON, CSV, GeoJSON, HTML, model-card, and complete planning-archive exports;
- an installable progressive web app shell;
- reduced-motion, high-contrast, color-vision-safe, and Spanish navigation settings;
- keyboard navigation, visible focus, and skip navigation;
- collapsible controls and a near-full-window Focus Map mode; and
- responsive desktop and mobile layouts.

## Public page architecture

| Page | URL | Purpose |
| --- | --- | --- |
| Home | [`index.html`](index.html) | Project introduction, installation, guided-tour entry, and workspace selection |
| About Us | [`about.html`](about.html) | Mission, project origin, creator credit, team profiles, values, and current work |
| Documentation | [`documentation.html`](documentation.html) | Quickstart, user guide, interface guide, limitations, privacy, release notes, and changelog |
| Research & Process | [`research.html`](research.html) | Methodology, architecture, data sources, validation, reproducibility, monitoring lifecycle, paper/conference status, and citation |
| Contact & Feedback | [`contact.html`](contact.html) | General contact, GitHub issues, feature requests, feedback form, and official social links |
| LUMOSLab | [`lumos-lab.html`](lumos-lab.html) | Official circuit-convergence introduction plus complete cross-domain planning, geography, operations, validation, research, governance, and communication studio |
| Unified | [`unified.html`](unified.html) | Cross-domain allocation, simulation, deployment, campaigns, commissioning, and maintenance |
| Heat | [`heat.html`](heat.html) | LUMOS—Heat scientific workspace |
| Air | [`air.html`](air.html) | LUMOS—Air scientific workspace |
| Soil | [`soil.html`](soil.html) | LUMOS—Soil scientific workspace |
| Water | [`water.html`](water.html) | LUMOS—Water scientific workspace |

All five scientific entry pages load the same `workspace-shell.html` and `js/app.js`. The informational pages remain lightweight and do not initialize the map or model engine. This keeps navigation modular without creating separate or inconsistent model implementations.

## Data and provenance

Depending on domain, location, and availability, LUMOS can use or derive context from public sources including weather and atmospheric products, U.S. Census geography and social indicators, OpenStreetMap context, USDA soil surveys, USGS water observations, official case-study datasets, and user-imported field records.

Every input is labeled by evidentiary role—such as observed, modeled, derived, proxied, synthetic, or fallback. Optional-source failure is recorded rather than silently converted into observed evidence.

See:

- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)
- [`docs/PRIVACY_AND_DATA_GOVERNANCE.md`](docs/PRIVACY_AND_DATA_GOVERNANCE.md)
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md)

## Run locally

LUMOS has no runtime package dependencies. Serve the repository through a local HTTP server:

```bash
python -m http.server 5500
```

Open `http://localhost:5500`.

After changing the service worker or release shell, hard-refresh twice with `Ctrl+Shift+R`.

## Verification and reproducibility

Run the complete release verifier:

```bash
npm run verify
```

The verifier covers automated model tests, cross-domain architecture contracts, frozen evidence generators, commissioning operations, internal release-quality checks, credential scanning, release consistency, and the deterministic static build.

Useful individual commands include:

```bash
npm test
npm run audit:domains
npm run allocate:domains
npm run reallocate:domains
npm run simulate:program
npm run robust:program
npm run deploy:spatial
npm run review:hosts
npm run campaign:field
npm run track:campaign
npm run commission:operations
npm run check:release
npm run build
```

The static deployment artifact is written to `dist/`.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`.

Every push to `main`:

1. checks out the repository;
2. runs the complete LUMOS verifier;
3. builds the static site into `dist/`;
4. uploads only the built static artifact; and
5. deploys it to GitHub Pages.

In repository settings, choose **Settings → Pages → Source → GitHub Actions** once. The public site is then deployed at:

**https://hgd-dev.github.io/lumos/**

The workflow can also be launched manually from the repository's **Actions** tab.

## Repository structure

```text
index.html                      application shell and public interface
css/styles.css                  responsive visual system and accessibility
js/app.js                       application orchestration
js/config/domain-registry.js    shared and domain-specific contracts
js/data/                        public-data adapters and controlled scenarios
js/model/                       Bayesian, optimization, domain, and unified models
js/release/                     health, documentation, architecture, and release checks
js/workspace/                   browser-local persistence
scripts/                        tests, evidence generation, QA, and static build
data/examples/                  frozen reproducibility artifacts
docs/                           methodology, operations, governance, and limitations
.github/workflows/              continuous verification and Pages deployment
```

## Documentation

- [Model specification](MODEL_SPECIFICATION.md)
- [Methodology](docs/METHODOLOGY.md)
- [Unified architecture](docs/UNIFIED_ARCHITECTURE.md)
- [Cross-domain budget allocation](docs/CROSS_DOMAIN_BUDGET_ALLOCATION.md)
- [Sequential reallocation](docs/SEQUENTIAL_REALLOCATION.md)
- [Adaptive program simulation](docs/ADAPTIVE_PROGRAM_SIMULATION.md)
- [Robust policy selection](docs/ROBUST_POLICY_SELECTION.md)
- [Spatial deployment](docs/SPATIAL_DEPLOYMENT.md)
- [Host inventory and field review](docs/HOST_INVENTORY_AND_FIELD_REVIEW.md)
- [Field campaign operations](docs/FIELD_CAMPAIGN_OPERATIONS.md)
- [Live campaign tracking](docs/LIVE_CAMPAIGN_TRACKING.md)
- [Commissioning and maintenance](docs/COMMISSIONING_AND_MAINTENANCE.md)
- [Reproducibility](docs/REPRODUCIBILITY.md)
- [Privacy and data governance](docs/PRIVACY_AND_DATA_GOVERNANCE.md)
- [Limitations](docs/LIMITATIONS.md)

## Contact and official channels

- **Email:** [Lumosystem.team@gmail.com](mailto:Lumosystem.team@gmail.com)
- **Instagram:** [@lumos_optimization](https://www.instagram.com/lumos_optimization/)
- **LinkedIn:** [LUMOS Team](https://www.linkedin.com/in/lumos-team-7786b2425/)
- **GitHub:** [hgd-dev/lumos](https://github.com/hgd-dev/lumos)

Bug reports and feature requests can be submitted through [GitHub Issues](https://github.com/hgd-dev/lumos/issues). A structured feedback-form link will be added before the conference and outreach release.

## Attribution

**Full creation including ideation, website, code, and interface by Hudson Dong, Class of 2027, Stuyvesant High School, New York City.**

**The LUMOS Team**

## Citation

Recommended citation:

> Dong, Hudson. *LUMOS: Localized Unified Monitoring Optimization System.* Public software and methodology for socially constrained Bayesian environmental-monitoring design and operations, 2026.

Machine-readable citation metadata is available in [`CITATION.cff`](CITATION.cff).

## License

LUMOS is released under the [MIT License](LICENSE).
