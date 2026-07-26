# LUMOS

**Localized Unified Monitoring Optimization System**

LUMOS is a free, static, map-centered application for designing and operating environmental monitoring programs across **Heat, Air, Soil, and Water**. It combines domain-specific environmental models with one shared framework for Bayesian field reconstruction, uncertainty-aware placement, social-information constraints, intervention evaluation, cross-domain budgeting, field feasibility, commissioning, and maintenance.

> LUMOS is a scientific planning and research tool. It is not an emergency service, regulatory determination, medical recommendation, certified laboratory report, hydraulic model, permit, procurement quote, or deployment authorization.

## Public release

LUMOS closes the planning-to-operations loop. A program can move through:

1. environmental field reconstruction and validation;
2. monitor or sample placement;
3. equity, reliability, cost, and intervention constraints;
4. cross-domain budget allocation and sequential reallocation;
5. multi-round and robust policy comparison;
6. coordinated physical-host planning;
7. verified-host import and field review;
8. phased inspection campaigns and reserve planning;
9. live outcome tracking and adaptive replacement;
10. procurement, permitting, installation, calibration, commissioning, uptime, maintenance, and replacement planning.

## Scientific contribution

LUMOS does not claim to invent Gaussian-process sensor placement, A- or D-optimal design, mutual information, adaptive sampling, equity-aware placement, robust optimization, or BACI evaluation. Its contribution is the formal integration of these established methods into a:

**Socially Constrained Sequential Bayesian Environmental Monitoring Design** framework.

The shared engine combines probabilistic field reconstruction, epistemic-uncertainty reduction, environmental risk, dynamic exposure, group-level information quality, community and ecological priorities, heterogeneous monitoring networks, operational feasibility, reliability, adaptive deployment, and pre/post-intervention evaluation. Heat, Air, Soil, and Water retain separate observation models, covariance assumptions, transport behavior, units, validation protocols, and intervention roles.

## Domain adapters

- **Heat:** weather, apparent heat, canopy, imperviousness, exposure, vulnerability, forecast playback, and heat-intervention monitoring.
- **Air:** PM2.5, PM10, NO₂, and ozone with meteorological transport, traffic/source context, optional reference observations, and calibration/collocation roles.
- **Soil:** SSURGO-informed property fields, depth-aware laboratory imports, contaminant QA, localized covariance, and sample-program design.
- **Water:** USGS observation-informed indicators, directional flow and branch approximations, source-to-receptor screening, and upstream/downstream intervention sentinels.

## Unified decision and operations layers

The public application includes:

- five domain-level monitoring portfolios;
- serious reconstruction and placement baselines;
- exact reduced-instance benchmark oracles;
- intervention planning and BACI-inspired evaluation networks;
- cross-domain budget allocation;
- evidence-calibrated sequential reallocation;
- multi-round adaptive program simulation;
- robust trajectory evaluation under response, cost, failure, and environmental uncertainty;
- coordinated cross-domain host assignment and co-location tradeoffs;
- imported host inventories and explicit field-review policies;
- phased field campaigns with reserve sites;
- append-only field-outcome and commissioning ledgers;
- installation queues, calibration checks, uptime/data-completeness diagnostics, maintenance tickets, and replacement-ready reserves.

Generated sites remain **planning proxies unless independently reviewed**. Imported “verified” records remain user-supplied evidence; LUMOS does not authenticate ownership, permission, safety, infrastructure, permits, calibration certificates, technicians, or legal authority.

## Interface

The application opens on a dedicated Home page with direct entry points for Unified, Heat, Air, Soil, and Water. The operational interface is one MapLibre-based workspace with domain tabs and a Unified mode. The Home page contains the guided tour, install action, scientific overview, lifecycle summary, and an in-application documentation center. The header and both side panels are independently collapsible. **Focus map** collapses all three at once for a near-full-window map and can be restored with Escape or the visible controls. The layout includes keyboard focus indicators, a skip link, reduced-motion support, a color-vision-safe palette, responsive panels, browser-local workspaces, offline application-shell caching, and JSON/CSV evidence exports.

## Run locally

```bash
python -m http.server 5500
```

Open `http://localhost:5500`. After a release or service-worker update, use `Ctrl+Shift+R` twice.

No permanent backend is required. The deployed application remains compatible with GitHub Pages.

## Verify the release

```bash
npm run verify
```

The verifier runs the automated tests, cross-domain architecture audit, all frozen unified evidence generators, commissioning evidence, internal release-quality checks, release consistency and credential checks, and the deterministic static build.

Individual stages are available when a combined run exceeds the local shell’s time limit:

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
npm run audit:public
npm run check:release
npm run build
```

## Repository structure

```text
index.html                     public application shell
css/styles.css                 responsive and accessible interface styling
js/app.js                      application orchestration
js/config/domain-registry.js   shared and domain-specific contracts
js/model/                      Bayesian, optimization, domain, and unified models
js/data/                       public-data adapters and controlled scenarios
js/release/                    version, health, architecture, and readiness audits
js/workspace/                  browser-local persistence
scripts/                       tests, evidence generators, release checks, static build
data/examples/                 frozen reproducibility artifacts
docs/                          methodology, operations, limitations, and governance
```

## Documentation

Public users can read Quickstart, Methodology, Data Sources, Limitations, Privacy, Release Notes, About Us, and Citation pages without leaving the application. Repository documentation remains available below.

- [Model specification](MODEL_SPECIFICATION.md)
- [Public release](docs/PUBLIC_RELEASE.md)
- [Commissioning and maintenance](docs/COMMISSIONING_AND_MAINTENANCE.md)
- [Unified architecture](docs/UNIFIED_ARCHITECTURE.md)
- [Methodology](docs/METHODOLOGY.md)
- [Data sources](docs/DATA_SOURCES.md)
- [Limitations](docs/LIMITATIONS.md)
- [Privacy and data governance](docs/PRIVACY_AND_DATA_GOVERNANCE.md)
- [Reproducibility](docs/REPRODUCIBILITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)

## Creator credit

Full creation including ideation, website, code, and interface by Hudson Dong, Class of 2027, Stuyvesant High School, New York City, and the LUMOS team.

## Citation and license

Citation metadata is provided in [`CITATION.cff`](CITATION.cff). LUMOS is released under the MIT License.
