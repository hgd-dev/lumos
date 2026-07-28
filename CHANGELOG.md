# Changelog


## [3.1.2] - 2026-07-28

### Public information architecture
- Separated About Us into a permanent page beside Home.
- Split the former Information menu into Documentation and Research & Process dropdowns.
- Added permanent Documentation and Research & Process pages with stable section URLs.
- Added a paper and conference placeholder for manuscript, venue, author, preprint, supplement, and presentation status.
- Added a Contact & Feedback page with GitHub issue links and placeholder email, feedback-form, Instagram, and LinkedIn destinations.
- Preserved the shared model engine, domain workspaces, public creator credit, team attribution, system check, and social footer.

## 3.1.1 — Navigation and map-control refinement

- Corrected top-menu chevron alignment and raised dropdown stacking so menus remain visible above workspace content.
- Consolidated documentation links into an Information menu in the global header and simplified the footer to creator/team attribution plus social links.
- Redesigned the header-collapse handle as a more visible edge control.
- Added a toolbar control for showing or hiding the map-search panel.
- Made the map-search panel draggable within the map and preserved its visibility and position locally.
- Changed the default basemap from Dark to Positron.
- Separated the environmental-field legend from the MapLibre distance scale.

## v3.1.1 — Multi-page public architecture and dedicated workspaces

- Reorganized the public site into dedicated Home, About & Methodology, Unified, Heat, Air, Soil, and Water HTML entry pages.
- Added a persistent top navigation bar with direct Home and Unified links plus a dropdown for the four environmental workspaces.
- Kept one shared scientific application shell and one shared model engine so workspace pages do not duplicate or diverge in scientific behavior.
- Added page-specific product identities: LUMOS—Unified, LUMOS—Heat, LUMOS—Air, LUMOS—Soil, and LUMOS—Water.
- Moved Reset workspace and Generate/Allocate controls into each workspace page while retaining GitHub and System check in the global header.
- Replaced in-dialog documentation navigation with a permanent About & Methodology page containing Quickstart, Methodology, Data Sources, Limitations, Privacy, Release Notes, About Us, and Citation sections.
- Reset new workspace sessions to a clean full-United-States map rather than automatically reopening a previous or Colorado-centered validation session.
- Preserved manual saved-workspace loading while removing automatic last-workspace restoration across page entry points.
- Simplified visible mode labels by removing public-release and validation-status phrases from the workspace identity.
- Updated offline caching, static build packaging, release checks, onboarding targets, documentation, and regression tests for the multi-page architecture.

## v3.0.4 — Animated environmental design identity and social access

- Added a reduced-motion-aware typing and deleting loop after “Design environmental” across monitoring, intervention, planning, optimization, deployment, and evaluation.
- Restored standard capitalization throughout the Home experience while retaining the animated technical brand treatment.
- Adopted Tektur for display text, Orbitron for the LUMOS wordmark, and Inter for body text, with offline-capable local system fallbacks.
- Removed the masthead slogan and retained a cleaner mark-and-wordmark lockup.
- Added a direct GitHub repository icon to the masthead.
- Added the LUMOS mark to the installable-web-app card.
- Added footer icons for GitHub plus clearly marked placeholder Gmail, Instagram, and LinkedIn destinations for later replacement.
- Preserved the separate Hudson Dong full-creation attribution and “The LUMOS Team” line.

## v3.0.3 — Brand, Home hierarchy, and workspace navigation

- Added the LUMOS mark to the public masthead and removed the duplicated expanded-name line from the header.
- Replaced the domain badge with the product slogan “From uncertainty to action.”
- Split the Home hero into a primary “design environmental monitoring” statement and a secondary informative/equitable/operationally realistic line.
- Lowercased Home workspace names and environmental-domain prose for a cleaner editorial style.
- Moved installation into a dedicated Home card and aligned all five workspace cards in one desktop row.
- Added a local-first technical display font stack led by Bahnschrift, with Aptos, Segoe UI Variable, Inter, and system fallbacks.
- Separated Hudson Dong’s full-creation credit from “The LUMOS Team” in the footer, About Us, and citation views.

## v3.0.2 — Public language, About Us, and team attribution

- Removed the masthead disclaimer line and replaced “Scientific position” with “Based on professional research.”
- Centralized scientific scope and usage cautions in the Limitations documentation rather than repeating dedicated claim-boundary blocks throughout the interface.
- Removed the visitor-facing public-readiness audit and its documentation link while preserving internal release-quality verification.
- Added a complete in-application About Us page covering the project mission, research foundation, public commitment, Hudson Dong, and the LUMOS team.
- Updated the footer and citation page to credit Hudson Dong and the LUMOS team.
- Preserved the complete scientific, deployment, campaign, commissioning, maintenance, map-focus, and documentation workflows.

## v3.0.0 — Stable public professional release

- Completed the planning-to-operations lifecycle across Heat, Air, Soil, and Water.
- Added append-only commissioning and maintenance records covering procurement, permits, installation, calibration or chain of custody, operational status, uptime, data completeness, preventive maintenance, tickets, and replacement readiness.
- Added domain-specific commissioning contracts for continuous Heat monitors, calibrated Air stations, Soil sample programs, and Water stations or sampling programs.
- Added installation-phase queues, modeled commissioning and first-year maintenance costs, maintenance diagnostics, and reviewed reserve activation for offline or blocked assignments.
- Added a deterministic internal release-quality audit covering architecture, evidence, governance, accessibility declarations, static deployment, offline packaging, credential boundaries, licensing, and limitations and intended-use guidance.
- Added a one-action Focus map mode, skip navigation, stronger visible keyboard focus, and persistent header/side-panel restoration for a near-full-window map.
- Updated the application shell, metadata, documentation, citation, service-worker cache, reproducibility artifacts, and release checks for the stable public v3 release.
- Preserved all v2 planning, allocation, robustness, deployment, field-review, campaign, and live-tracking evidence workflows.

## v2.8.0 — Live campaign tracking and adaptive replacement

- Added CSV and JSON field-outcome ingestion with deterministic normalization, duplicate-event rejection, reviewer metadata, timestamps, notes, and preserved operational review fields.
- Added an append-only event ledger with supersession links and deterministic previous/event hashes for reproducibility and change detection.
- Added phase-aware operational-network recomputation across accepted, conditional, rejected, pending, overdue, replacement, and unresolved assignment states.
- Added adaptive activation of domain-compatible reviewed reserves after rejected primary-host inspections.
- Added domain-specific conditional operational credit and live-outcome reliability floors to the adapter registry and cross-domain audit.
- Added controlled outcome examples, a downloadable outcome template, operational map rendering, assignment and history tables, and JSON/CSV exports.
- Added deterministic `npm run track:campaign` evidence generation and integrated it into release verification.
- Expanded onboarding, service-worker coverage, release metadata, documentation, and regression tests for v2.8.


## v2.7.0 — Field-campaign operations and reserve-site planning

- Added deterministic phased field-inspection queues above reviewed cross-domain deployment plans.
- Added editable per-phase capacity, phase count, response scenario, reserve ratio, inspection cost, reserve-mobilization cost, and seed controls.
- Added four campaign profiles: Balanced, Rapid Verification, Coverage Protection, and Resilience First.
- Added domain-specific reserve-site eligibility, reliability floors, replacement criticality, and transparent unresolved-assignment reporting.
- Added rejection and replacement workflows that activate compatible reserve sites without silently relaxing operational constraints.
- Added campaign metrics for completion, reserve coverage, recovery, operational resilience, shared-failure exposure, and modeled cost.
- Added JSON/CSV campaign exports and deterministic `npm run campaign:field` evidence generation.
- Added a collapsible, persistent application header that removes the full masthead from layout and expands the vertical map workspace.
- Expanded the cross-domain audit, onboarding, service-worker shell, release metadata, documentation, and regression suite for v2.7.
- Expanded the automated suite from 119 to 123 tests.


## v2.6.0 — Verified-host ingestion and field-feasibility review

- Added CSV and JSON host-inventory ingestion with deterministic normalization, duplicate handling, coordinate validation, and reproducible checksums.
- Added permission, access, power, safety, maintenance, ownership, reviewer, date, and notes fields without promoting missing values to verified evidence.
- Added verified, conditional, unresolved, and infeasible operational classifications plus three explicit field-review policies.
- Added controlled, imported-only, and hybrid host-source modes for coordinated cross-domain deployment.
- Added domain-specific operational filtering, including Air power requirements and preservation of all existing spacing, suitability, access, host-category, water-connectivity, co-location, and failure-coupling constraints.
- Added host-inventory template, controlled reviewed example, review exports, field-feasibility evidence artifacts, UI summaries, and map/table status labels.
- Expanded release auditing, service-worker coverage, verification, tests, documentation, and static-build packaging for the field-review workflow.

## v2.5.0 — Spatially coupled cross-domain deployment

- Added a deterministic coordinated deployment layer that translates initial, sequential, or manual cross-domain unit allocations into physical host portfolios.
- Added versioned Heat, Air, Soil, and Water spatial-deployment contracts covering spacing, host suitability, access, power, preferred and excluded hosts, shareable infrastructure, and co-location failure coupling.
- Added five separately generated deployment profiles: Coordinated, Maximum Savings, Coverage First, Equity First, and Resilient.
- Added explicit shared-host compatibility, modeled co-location savings, worst-domain coverage, equity, reliability, and correlated-failure metrics.
- Added map rendering for multi-domain host assignments and public JSON/CSV exports with one row per host-domain assignment.
- Added controlled deterministic host-pool generation and `npm run deploy:spatial` reproducibility artifacts.
- Expanded the cross-domain architecture audit and regression suite for the spatial-deployment contract.
- Preserved explicit limitations and intended-use guidance: every host is a mathematical proxy requiring permission, access, power, safety, maintenance, hydraulic, and field verification.

## v2.4.0 — Trajectory uncertainty and robust policy selection

- Added a seeded scenario ensemble over evidence response, deployment cost, unit failure, and environmental conditions.
- Added conservative, central, and optimistic v2.3 trajectory anchors with bounded interpolation across response uncertainty.
- Added domain-specific cost, failure, and environmental uncertainty contracts to the public adapter registry.
- Added expected utility, 10th-percentile utility, lower-tail utility, feasibility probability, expected regret, maximum regret, expected cost, and P90 cost summaries.
- Added separate robust, expected-value, minimax-regret, and most-feasible policy recommendations.
- Added risk-aversion controls, policy Pareto labels, browser results, and reproducible JSON/CSV exports.
- Added explicit limitations and intended-use guidance distinguishing planning draws from forecasts, confidence intervals, stochastic-control optima, and regulatory recommendations.
- Expanded the executable architecture audit with four domain uncertainty contracts and one shared robust-evaluator release contract.
- Added command-line ensemble generation, public methodology, deployment, reproducibility, and release integration.
- Expanded the automated suite from 108 to 112 tests.

## v2.3.0 — Multi-round adaptive program simulation

- Added deterministic two-to-eight-round cross-domain program simulation above the v2.2 sequential allocator.
- Added seven complete trajectory policies: adaptive, balanced, information, exposure, equity, reliability/intervention, and cost-efficient.
- Added round-by-round evidence-strength, residual-need, yield, reliability, equity-need, and intervention-readiness transitions.
- Added conservative, central, and upper response scenarios, budget growth, future-round discounting, and an editable transition rate.
- Added domain-specific bounded simulation-learning and residual-response contracts to the public adapter registry.
- Added trajectory Pareto labels, cumulative funding, discounted benefit, terminal state metrics, and JSON/CSV exports.
- Added browser controls and results for complete funding-path comparison while preserving the v2.1 initial allocator and v2.2 next-round allocator.
- Expanded the executable architecture audit from 53 to 58 passing checks.
- Added command-line reproducibility artifacts and the public adaptive-program methodology document.
- Expanded the automated suite from 105 to 108 tests.

## v2.2.0 — Evidence-calibrated sequential reallocation

- Added saved-workspace evidence summaries for residual uncertainty, risk-weighted uncertainty, equity need, ecological need, validation support, reliability, and intervention readiness.
- Added backward-compatible workspace evidence storage with selected-network metrics when available.
- Added a deterministic next-round allocator that distinguishes existing and additional units and exhaustively evaluates the displayed four-domain integer bounds.
- Added evidence-strength shrinkage, realized-yield calibration, residual-need calibration, and explicit exploration support for weak-evidence domains.
- Added hard normalized floors for equity, reliability, intervention readiness, and minimum viable program completion.
- Added exact next-round minimum-program shortfall reporting and nearest-tested labeling when non-budget floors cannot all be satisfied.
- Added Saved Evidence, latest autosave, registry-prior, and explicitly synthetic controlled-example modes.
- Added six-profile next-round results, Pareto labels, JSON/CSV exports, command-line generation, and frozen example artifacts.
- Expanded the executable architecture audit with four domain evidence contracts and a shared sequential-reallocator release contract.
- Added public methodology, limitations, reproducibility, service-worker, release, and interface integration while preserving all domain-specific placement models.
- Expanded the automated suite from 99 to 105 tests.

## v2.1.0 — Cross-domain budget allocation

- Added a Unified program-level allocator for one shared Heat, Air, Soil, and Water budget.
- Added editable total budget, reserve, enabled domains, per-domain unit costs, minimum and maximum program sizes, and public priority controls.
- Added normalized diminishing-return contracts for information, exposure, equity, ecology, intervention readiness, reliability, and adapter readiness.
- Added six deterministic allocation profiles: Balanced, Maximum Information, Exposure Protection, Equity First, Reliability and Intervention, and Cost Efficient.
- Added exact feasible-integer enumeration for the displayed four-domain program bounds, explicit minimum-program infeasibility and shortfall reporting, and portfolio Pareto labeling.
- Added JSON and tidy CSV exports with stable checksums and a command-line frozen default portfolio.
- Added cross-domain budget contracts to the executable architecture audit.
- Added public documentation and limitations and intended-use guidance clarifying that normalized program benefit is not a shared physical unit, regulatory benefit-cost estimate, or geographic site recommendation.
- Preserved all Heat, Air, Soil, Water, persistence, validation, evidence, intervention, and static GitHub Pages workflows.


## v2.0.0 — Unified four-domain architecture

- Replaced the internal Core tab label with a public Unified workspace while preserving the shared synthetic optimizer benchmark.
- Added a formal registry for Heat, Air, Soil, and Water scenario contracts, scientific capabilities, required services, inference and transport assumptions, fallbacks, intervention roles, and release lineage.
- Added a reproducible cross-domain consistency audit with deterministic checksum, JSON export, tidy CSV export, browser results, and command-line generation.
- Added adapter-parity checks for the complete objective vector, inference, locked validation, robustness, intervention design, evidence, persistence, provenance, systematic fallback, presets, onboarding, health checks, and limitations and intended-use guidance.
- Added Unified onboarding and domain cards that explain the shared-engine/domain-adapter separation.
- Made Water weather context an explicit required health-check dependency.
- Corrected Soil and Water shared configuration status labels so public domains are no longer described as previews.
- Added the architecture audit to `npm run verify`, the service-worker application shell, release metadata, and deployment documentation.
- Added a deterministic two-stage test runner so the complete browser-mock and evidence suite exits reliably in Node release environments.

## v1.9.1 — Viewport layout and domain-loading hardening

- Made the desktop application a single viewport-height shell so the control and recommendation panels extend to the footer and scroll internally instead of ending above the map.
- Removed the map's desktop minimum-height overflow and reserved an explicit compact 36 px footer row.
- Prevented the footer from wrapping into an oversized blank region on desktop displays.
- Generalized the shared national weather-loader progress text so Air reports atmospheric context and Water reports watershed context instead of displaying Heat-specific loading messages.
- Replaced the shared invalid-extent error with domain-neutral environmental-workspace wording.
- Added regression coverage for viewport geometry and cross-domain loading labels.

## v1.9.0 — Water public inference, validation, and evidence

- Promoted Water from national planning preview to a public LUMOS domain.
- Added a source-aware trend plus flow-aligned residual Gaussian-process posterior for six Water indicators.
- Added indicator-aware transforms, reliability-aware observation noise, and Cholesky-based posterior prediction.
- Added spatial development cross-validation and deterministic branch-stratified locked validation.
- Added isotropic GP, screening-prior, trend-only, inverse-distance, and nearest-station reconstruction baselines.
- Added vulnerability-by-exposure group reconstruction diagnostics and predictive interval coverage.
- Added Water split, flow-direction, covariance, station-loss, reliability, provisional-reading, source-proxy, and branch-proxy robustness experiments.
- Added current-workspace Water paper bundles and tidy CSV exports.
- Added a controlled four-case Water public evidence suite and `npm run paper:water`.
- Strengthened intervention allocation with count-safe role budgets, branch-linked upstream/downstream sentinels, and indicator-specific effect assumptions.
- Corrected Overpass retry isolation, mapped treatment-role classification, and physical flow-axis projection.
- Added Water validation, robustness, and evidence panels and corrected Water onboarding selection.
- Updated release metadata, service-worker assets, documentation, and public limitations and intended-use guidance.
- Expanded the automated suite from 83 to 88 tests.

## v1.8.0 — Water national preview

- Added a nationwide Water workspace for surface-water screening and an explicitly labeled drinking-water distribution proxy.
- Added recent USGS instantaneous observations for water temperature, dissolved oxygen, pH, specific conductance, turbidity, and discharge.
- Added mapped waterway, treatment, waterworks, industrial, landfill, agricultural, and access proxies with systematic-candidate fallback.
- Added directional flow-axis and branch approximations, source-to-receptor pressure, downstream exposure, monitoring density, and Water-specific uncertainty.
- Added Water-specific map layers, legends, presets, onboarding, system checks, provenance, persistence, and service-worker assets.
- Added wastewater, stormwater, agricultural-runoff, and distribution-system intervention targets with treatment, control, upstream, downstream, and supplemental roles.
- Added explicit limitations distinguishing screening estimates from observations, regulatory determinations, hydraulic models, and utility pipe topology.
- Preserved the shared Bayesian objective, hard social-information constraints, five-profile portfolio, Pareto audit, scientific benchmarks, and workload guardrails.
- Expanded the automated suite from 77 to 83 tests.

## v1.7.0 — Soil public release, import QA, and four-case evidence

- Promoted Soil from an inference preview to a public LUMOS sampling-design domain.
- Added strict laboratory-import QA for analytes, units, coordinates, extent, depth overlap, dates, duplicates, detection limits, censored values, plausibility ranges, QA flags, and reliability.
- Added preserved import-QA summaries to the interface, workspaces, and Soil paper bundles.
- Added Soil-specific Fresno, Phoenix, Des Moines, and Atlanta quick-start presets.
- Added a standardized four-case Soil evidence suite with deterministic controlled benchmark observations and explicit non-field-data labeling.
- Added browser JSON/CSV evidence exports and `npm run paper:soil`.
- Added a Soil public-evidence results panel, progress cancellation, stable checksums, and versioned example case definitions.
- Strengthened the domain-aware system check with a functional USDA Soil Data Access POST probe.
- Added Soil public-release documentation, evidence boundaries, reproducibility guidance, and release-integrity requirements.
- Preserved the shared Bayesian objective, social-information constraints, five-profile portfolio, Pareto audit, benchmarks, and intervention design.
- Expanded the automated suite from 72 to 77 tests.

## v1.6.0 — Soil inference, validation, and paper exports

- Added browser-local CSV and JSON laboratory-sample import with analyte aliases, unit standardization, extent filtering, depth, date, detection-limit, QA, and reliability metadata.
- Added laboratory-conditioned targets for lead, arsenic, and cadmium alongside the existing survey-supported Soil properties.
- Added a regularized survey/source trend plus short-range residual Gaussian-process posterior for compatible observations.
- Added posterior Soil value, predictive uncertainty, and model-adjustment map layers.
- Added deterministic development and locked sample splitting with MAE, RMSE, bias, R², and empirical interval-coverage diagnostics.
- Added survey/source trend, inverse-distance, and nearest-sample reconstruction baselines.
- Added covariance/noise calibration and a Soil robustness lab covering split stability, sample quality, deterministic sample loss, and increased observation noise.
- Added a current-workspace Soil paper bundle with structured JSON, tidy result CSV, sensitivity CSV, and stable checksum.
- Added Soil-specific onboarding, provenance, privacy guidance, release checks, and offline-shell modules.
- Preserved the shared Bayesian placement objective, social-information constraints, portfolio profiles, Pareto audit, scientific benchmarks, and intervention design.
- Expanded the automated suite from 68 to 72 tests.

## v1.5.0 — Soil national preview

- Added a nationwide U.S. Soil workspace based on USDA-NRCS Soil Data Access and SSURGO survey properties.
- Added property and depth selection for a soil-health composite, pH, organic matter, clay, available water, and electrical conductivity.
- Added depth-weighted aggregation across major SSURGO components and horizons.
- Added socially constrained soil sampling portfolios, ecological representation, systematic sample meshes, and optional mapped land-use enrichment.
- Added soil-specific remediation, garden-safety, agricultural-amendment, and ecological-restoration intervention evaluation.
- Added explicit provenance and limitations distinguishing mapped survey estimates from laboratory samples and contamination measurements.
- Added Soil onboarding, system-health checks, map layers, persistence, and service-worker assets without changing the shared Bayesian optimizer.
- Added a USDA Soil Data Access probe to the live endpoint health check.
- Expanded the automated suite from 63 to 68 tests.

## v1.4.0 — Air public release and multi-city evidence

- Promoted Air from research preview to a public LUMOS domain.
- Added pollutant-specific Los Angeles, Houston, Chicago, and New York Air presets.
- Added a domain-aware guided Air walkthrough and dynamic quick-start panel.
- Added an Air-aware system-health check with required atmospheric-composition and weather services.
- Added an in-browser four-city Air evidence suite under a single frozen protocol.
- Added Air evidence JSON and tidy CSV exports with stable checksums.
- Added a dedicated Air evidence results panel and feasibility/equity summaries.
- Added Air public-release documentation and release-integrity requirements.
- Updated GitHub Pages, service-worker, citation, manifest, and release metadata to v1.4.0.
- Expanded automated release coverage for Air presets, health requirements, and public-interface labels.

## v1.3.0 — Air robustness and paper experiment release

- Added deterministic split-seed stability analysis for locked Air validation.
- Added joint wind-transport, covariance-length, and measurement-noise sensitivity.
- Added reference-reading robustness scenarios for monitor type, reliability loss, deterministic removal, and increased noise.
- Added candidate-role stress tests for roadside, source-oriented, calibration/collocation, and background siting roles.
- Added fairness-threshold sweeps using the unchanged socially constrained Bayesian objective.
- Added an Air robustness panel with paper-ready metrics and tables.
- Added current-workspace Air JSON and CSV paper exports with credential exclusion.
- Added a four-case national Air paper runner and `npm run paper:air` command.
- Added Air sensitivity and paper-runner modules to the versioned offline shell.
- Expanded the automated suite from 59 to 61 tests.

## v1.2.0 — Air pollutant inference and validation

- Added current OpenAQ measurement retrieval for compatible sensors after location discovery.
- Added canonical conversion from µg/m³, mg/m³, ppb, and ppm where pollutant molecular weight permits.
- Added freshness-aware observation reliability and transparent rejection of stale or incompatible readings.
- Corrected meteorological wind direction conversion to a mathematical downwind transport axis.
- Added downwind source-influence fields and map visualization.
- Added a source-aware concentration trend plus wind-aligned residual Gaussian-process posterior.
- Added spatial development cross-validation and a deterministic locked-monitor test.
- Added atmospheric-model, trend-only, inverse-distance, and nearest-monitor reconstruction baselines.
- Added socially disaggregated Air prediction error and wind-regime sensitivity tables.
- Added reference-conditioned concentration, predictive uncertainty, and model-adjustment map layers.
- Added Air inference recalibration controls and a dedicated validation panel.
- Strengthened post-intervention design with posterior concentrations and downwind spillover screening.
- Extended workspace restoration and autosave behavior to Air.
- Expanded the automated suite from 55 to 59 tests.

## v1.1.1 — Air runtime and domain-label hotfix

- Fixed an Air-fit failure where an optional OpenStreetMap source timeout could abort the complete workspace instead of degrading to transparent source proxies.
- Added retry handling for Open-Meteo Air Quality batches and bounded timeouts for optional OpenAQ reference-location loading.
- Reset the map legend whenever the active domain or fitted scenario changes, removing stale Heat labels from Air.
- Added Air-specific risk, AQI, intervention, uncertainty, and palette labels.
- Automatically rebuilds an already fitted Air workspace when the pollutant or OpenAQ conditioning setting changes.
- Updated the service worker to pre-cache Air modules and use network-first loading for version-sensitive scripts, styles, manifests, and JSON.
- Added regression tests for Air legend isolation and optional-source timeout degradation.

## v1.1 — National Air workspace preview

- Added nationwide viewport-fitted Air scenarios for PM2.5, PM10, nitrogen dioxide, and ozone.
- Added Open-Meteo pollutant concentrations, pollutant-specific U.S. AQI, and overall AQI layers.
- Added wind-aligned anisotropic covariance using the fitted area's prevailing transport direction.
- Added optional OpenAQ reference-monitor conditioning through a session-only user API key.
- Added major-road and industrial/source proximity layers with explicit proxy fallbacks.
- Added pollutant, AQI, source-pressure, traffic, industrial, wind, social, intervention, and uncertainty map views.
- Added Air-specific traffic, industrial, clean-freight, and background-separation intervention targets.
- Added an Air BACI-inspired treatment/control/boundary/spillover evaluation network.
- Preserved the full shared Bayesian, fairness, Pareto, benchmark, guardrail, persistence, and export architecture.
- Expanded the automated suite from 50 to 53 tests.

## v1.0 — Heat public release

- Promoted Heat from release candidate to the first public LUMOS domain release.
- Added an official GitHub Pages deployment workflow with test, release-check, and static-build gates.
- Added installable web-app metadata and same-origin application-shell caching.
- Added connection-state messaging, release metadata, a release checklist, and a security policy.
- Added deterministic static build and release-integrity scripts.
- Preserved the v0.11 scientific engine without objective, solver, fairness, benchmark, or intervention changes.

## v0.11 — Heat release hardening and guided onboarding

- Added a nine-step guided Heat walkthrough with highlighted interface targets and keyboard navigation.
- Added one-click Phoenix, Denver, Atlanta, and New York nationwide case-study presets.
- Added an in-app system check for network state, browser storage, canvas rendering, MapLibre, secure context, weather, Census, national land cover, and basemap services.
- Distinguished required source failures from optional-source warnings.
- Added a standard and color-vision-safe field palette without changing numerical field values.
- Added a reduced-motion setting that disables animated map travel and live wind animation.
- Strengthened keyboard focus visibility and small-screen layout behavior.
- Added public-preview, methodology, limitation, privacy, and non-emergency-use messaging.
- Added Quickstart, Methodology, Data Sources, Limitations, Reproducibility, Deployment, and Privacy/Data Governance documentation.
- Added an MIT license, `CONTRIBUTING.md`, and `CITATION.cff`.
- Preserved the complete Bayesian, fairness, Pareto, benchmark, intervention, and experiment architecture.

## v0.10 — Live Heat and paper experiment runner

- Added separate Heat experiences for risk/monitoring, live conditions, and forecast playback.
- Added current temperature, apparent temperature, humidity, wind, cloud cover, and precipitation display fields that do not overwrite the scientific planning field.
- Added manual and 15/30/60-minute live refresh controls with timestamp and countdown reporting.
- Added live-versus-planning field-change diagnostics and explicit stale-portfolio warnings instead of silent reoptimization.
- Added batched 24/48-hour Open-Meteo forecast loading, a timeline slider, local playback, smooth frame interpolation, and animated wind arrows.
- Added current-map PNG export with basemap inclusion when browser canvas permissions allow it.
- Added a current-workspace paper bundle and a fixed Phoenix/Denver/Atlanta/New York national suite.
- Added optional fairness-threshold screening, stable experiment checksums, JSON bundles, and tidy CSV exports.
- Added `npm run paper:national` for command-line paper-suite generation.
- Added forecast endpoint health checking.
- Preserved the complete Bayesian, fairness, Pareto, benchmark, intervention, and exact reduced-pool architecture.
- Expanded the automated suite from 40 to 44 tests.

## v0.9 — Nationwide land-surface and social modeling

- Added an optional Annual NLCD land-cover adapter using EPA EnviroAtlas raster sampling.
- Added categorical, explicitly labeled screening covariates for imperviousness, tree canopy, vegetation, developed intensity, water presence, and water proximity.
- Added a land-surface heat-amplification term to the nationwide Heat-risk prior without changing the Bayesian covariance or solver architecture.
- Added lower-confidence Census-density fallbacks when Annual NLCD is unavailable or outside product coverage.
- Replaced vulnerability-only quartiles in the national workspace with vulnerability-by-exposure intersectional information groups.
- Updated tree-shade and cool-surface intervention priorities to use the new land-surface covariates.
- Added nationwide map layers for surface amplification, imperviousness, tree canopy, vegetation, and water proximity.
- Added layer-level provenance with source, status, resolution, confidence, and interpretation.
- Added national case-study JSON and tidy CSV exports containing scenario, social-group, selected-site, metric, and benchmark tables.
- Added Annual NLCD caching and live-endpoint health checking.
- Preserved the complete Bayesian, hard-constraint, Pareto, benchmark, and intervention architecture.
- Expanded the automated suite from 38 to 40 tests.


## v0.8.6 — Persistent workspaces and public-data caching

- Added IndexedDB-backed workspace storage with an in-memory fallback for unsupported environments.
- Added automatic restoration of the most recent Heat workspace after refresh.
- Added named workspace save, load, delete, export, and import controls.
- Added a versioned `lumos-workspace-v1` file format containing the scenario, controls, systematic candidate backup, map camera, and diagnostics.
- Added persistent caching for Open-Meteo, Census TIGERweb, ACS, and OpenStreetMap responses with source-specific expiration periods.
- Added a public-data cache clear control that does not delete saved workspaces.
- Added fit runtime, optimization runtime, serialized workspace size, browser-memory, cache, candidate-count, and host-enrichment diagnostics.
- Preserved the full Bayesian design, fairness constraints, Pareto portfolio, scientific benchmarks, and intervention model without approximation changes.
- Expanded the automated suite from 35 to 38 tests with workspace serialization, JSON round-trip, and storage lifecycle coverage.

## v0.8.5 — Continuous heat fields and visible loading progress

- Replaced point-by-point radial glow rendering with a cached continuous inverse-distance raster for every active LUMOS field.
- Added fifth-to-ninety-fifth-percentile display scaling so isolated outliers do not flatten the visible spectrum.
- Added a darker, higher-contrast blue-to-red palette with clearer cool and hot extremes while preserving basemap context.
- Added full fitted-extent raster coverage and high-quality canvas smoothing so nationwide Heat views no longer appear as disconnected color bulbs.
- Added a dynamic legend showing the active field and its robust visible low/high range.
- Added a global loading dialog with spinner, staged progress bar, percentage, status messaging, and cancellation for national fits.
- Added nonblocking background-loading notices for optional OpenStreetMap candidate-host enrichment.
- Added visible loading states for domain/scenario loading, Bayesian portfolio generation, Heat recalibration, sensitivity analysis, and post-intervention design.
- Preserved the complete Bayesian, social, Pareto, benchmark, guardrail, and intervention model; all changes are visualization and user-feedback layers.
- Expanded the automated suite to thirty-five tests.

## v0.8.4 — Performance guardrails and nonblocking candidate enrichment

- Added a live workload meter with Standard, Large, Regional screening, and blocked viewport classes.
- Added pre-fit guardrails for geographic area, weather/evaluation samples, and candidate counts.
- Preserved the full Bayesian objective, hard social constraints, Pareto portfolio, scientific baselines, exact reduced-pool benchmark, and post-intervention designer at every allowed tier.
- Added deterministic field-wide systematic candidate meshes with explicit siting-proxy and field-verification metadata.
- Added Hybrid, Systematic coverage mesh, and Mapped public hosts only candidate strategies.
- Made OpenStreetMap/Overpass host loading asynchronous and optional in Hybrid mode so it cannot block a usable fitted scenario.
- Added request timeouts, alternate Overpass routing, cancellation, stale-response rejection, and graceful degradation to systematic candidates.
- Added spatially stratified candidate caps so large host inventories do not bias toward API return order.
- Added AbortController cancellation for active national weather, Census, and host requests when the map or workspace changes.
- Expanded the automated suite to thirty-four tests.

## v0.8.3 — Fully operational nationwide Heat workspace

- Replaced the temporary national weather overlay with a complete viewport-fitted LUMOS scenario for any local United States extent.
- Added two Heat workspaces: **Any U.S. map area** and the existing **NYC validated case study**.
- Added live current apparent temperature, air temperature, humidity, wind speed, and wind direction through a batched Open-Meteo adapter.
- Added current Census tract geometry through TIGERweb and 2024 ACS five-year population, poverty, age, and vehicle-access indicators.
- Added area-level exposure and social-vulnerability layers to nationwide portfolio and fairness calculations.
- Added OpenStreetMap/Overpass public-facility candidate hosts plus visibly labeled unverified grid proxies when host coverage is sparse.
- Added nationwide heat-mitigation targets for general mitigation, tree/shade, cool surfaces, and cooling access.
- Made nationwide cells, boundaries, candidates, portfolio alternatives, benchmarks, and post-intervention design the actual active model rather than an NYC-anchored overlay.
- Added a 40,000 km² per-run browser limit and automatic invalidation when the user pans or zooms away from the fitted extent.
- Preserved programmatic return to the stored fitted extent and retained NYC-only validation, frozen experiments, and sensitivity tools in the NYC workspace.
- Expanded live-endpoint checks and the automated suite to thirty-one tests.

## v0.8.2 — Viewport-fitted Heat and compact decision workflow

- Added a browser-only Open-Meteo GFS/HRRR adapter for current apparent temperature, air temperature, humidity, and wind across any map viewport.
- Repurposed **Fit heat data** as an on/off viewport overlay; moving the map cancels or clears the fitted surface so stale data never follows a new extent.
- Added **Model extent** to return to the active LUMOS case-study geometry without conflating it with the national viewport surface.
- Added viewport-specific map-view options and preserved the underlying NYC research scenario while the temporary surface is active.
- Added a left-side planning-stage selector separating intervention-planning parameters from post-intervention BACI evaluation parameters.
- Replaced the right-side portfolio cards with a top-positioned alternative-network dropdown and retained all metrics and comparison fields below it.
- Added an Open-Meteo endpoint to `npm run check:live`.
- Added deterministic viewport-grid and multi-location response regression tests, expanding the suite to twenty-eight tests.


## v0.8.1 — Interactive national map workspace

- Replaced the horizontal map-view button collection with one compact domain-aware dropdown.
- Added a MapLibre GL JS basemap backed by OpenFreeMap vector tiles, with roads, rail, buildings, rivers, water, parks, land use, labels, and place context.
- Added Dark, Liberty, and Positron basemap styles plus feature-level visibility toggles and LUMOS overlay opacity.
- Added zoom, compass, full-screen, scale, and browser-geolocation controls.
- Added United States overview, active-data fit, explicit coordinate navigation, and user-triggered United States place/address search.
- Added local search-result caching and a one-request-per-second search throttle; no autocomplete requests are issued.
- Added collapsible left model controls and right recommendation panels so the map can occupy the full workspace.
- Preserved geographic NYC boundary geometry so the scientific canvas overlay remains aligned while panning and zooming.
- Retained a canvas-only fallback when the external basemap library or tile service is unavailable.
- Expanded the automated suite to twenty-six tests.

## v0.8.0 — Heat Sensitivity Lab and paper exports

- Added deterministic split-seed sensitivity for locked spatial Heat validation.
- Added a three-by-three covariance sensitivity grid around calibrated length scale and measurement noise.
- Added candidate-host stress tests for host-class removal and deterministic 25%/50% site loss.
- Added fairness-threshold sensitivity under a fixed reduced field and candidate pool.
- Added a Heat Sensitivity Lab panel with summary metrics and four detailed result tables.
- Added tidy long-form CSV export for paper tables and a machine-readable sensitivity JSON bundle.
- Added `npm run sensitivity:nyc` for reproducible command-line generation of both exports.
- Included locked-test model comparisons, social-group errors, and calibration settings in paper exports.
- Documented the reduced-field sensitivity analyses as robustness screens rather than full-scale replacements.
- Added deterministic and export-contract regression tests, expanding the suite to twenty-four tests.


## v0.7.3 — Current NTA boundary source repair

- Replaced the mapped-view NTA endpoint with the current official tabular NTA GeoJSON endpoint (`9nt8-h7nd`).
- Added validation-aware fallback across current GeoJSON, current SODA rows, and the legacy mapped view.
- Added conversion of Socrata row geometry (`the_geom`) and ArcGIS-style `attributes` into standard GeoJSON features.
- Prevented a successful-but-propertyless boundary response from being accepted.
- Added regression tests for row-format and attribute-format NTA boundary payloads.

## v0.7.2 — NYC geometry and NTA-join hotfix

- Normalizes NTA and ZCTA identifiers before joining boundary, heat, and vulnerability sources.
- Accepts `NTA2020`, `NTA_Code`, and `NTACode` field variants from official NYC views.
- Normalizes GeoJSON geometry types and detects accidentally reversed NYC coordinate pairs.
- Builds the evaluation field only from NTA polygons successfully matched to heat records.
- Guarantees at least one interior evaluation point for narrow or coastal matched NTAs missed by the citywide lattice.
- Replaces the generic empty-grid error with actionable join diagnostics.
- Adds a regression test for normalized official-style area codes and geometry.

## v0.7.1 — Live NYC loader hotfix

- Retries required NYC Open Data requests after transient connection resets.
- Adds the official NYC Open Data export route as a fallback for the outdoor-heat forecast.
- Normalizes Socrata export payloads into the existing Heat adapter schema.
- Uses fresh network responses for live-data mode instead of force-cached API responses.
- Adds a regression test for Socrata export normalization.
- Suppresses the harmless missing-favicon request.

## v0.7.0 - Reproducible Heat Experiments and Intervention Design

- Added a deterministic spatially and vulnerability-stratified locked test set.
- Restricted covariance calibration and development cross-validation to non-locked observations.
- Added final locked-test comparison against source-only, trend-only, inverse-distance, and nearest-sensor baselines.
- Added locked MAE, RMSE, bias, R-squared, interval coverage, and group-disaggregated error reporting.
- Added canonical experiment serialization, stable checksums, and browser JSON export.
- Added `npm run freeze:nyc` for producing a repository-ready frozen Heat experiment package.
- Added a machine-readable NYC Heat experiment protocol.
- Added BACI-inspired treatment, matched-control, boundary, spillover, and supplemental site design.
- Added approximate effect-detectability power, control matching, role allocation, and cost diagnostics.
- Added role-specific intervention markers to the map.
- Expanded the automated suite to eighteen tests.

## v0.6.0 - Heat Inference and Validation

- Added generic Gaussian-process posterior mean and variance prediction using Cholesky solves.
- Added a regularized Heat trend over source baseline, tree canopy, impervious surface, exposure, vulnerability, and canopy-impervious interaction.
- Added residual Gaussian-process inference for posterior heat and predictive uncertainty.
- Added deterministic spatial k-fold validation against held-out temperature monitors.
- Added MAE, RMSE, bias, R-squared, nominal 95% interval coverage, and interval-width diagnostics.
- Added a source-only temperature baseline for out-of-sample comparison.
- Added HVI- and vulnerability-disaggregated reconstruction metrics.
- Added browser-scale grid-search calibration for covariance length scale and measurement noise.
- Added recent block-group tree-canopy and impervious-surface covariates.
- Updated hyperlocal temperature ingestion to aggregate afternoon readings by sensor.
- Added posterior heat, predictive uncertainty, tree-canopy, and impervious-surface map layers.
- Added a Heat validation panel and manual recalibration control.
- Expanded the automated suite to fourteen tests.

## v0.5.0 - New York City Heat MVP

- Added a live browser-side New York City Heat domain adapter.
- Added official NTA heat baseline, 2050 control, and planned tree-action surfaces.
- Added NTA and ZCTA polygon ingestion with point-in-polygon joining.
- Added HVI-based vulnerability and Census-population exposure layers.
- Added spatially thinned hyperlocal temperature observations for browser-scale GP conditioning.
- Added schools, libraries, and cooling amenities as public candidate-host proxies.
- Added a fine evaluation grid inside actual NYC geometry rather than optimizing on administrative polygons.
- Added baseline, future-control, planned-action, and cooling-benefit map layers.
- Added source provenance and limitation reporting.
- Added deterministic synthetic fallback when required APIs fail.
- Added a live-endpoint health-check script and scheduled GitHub Action.
- Expanded the automated suite to twelve tests with an official-style Heat-adapter fixture.

## v0.4.0 - Scientific Benchmarks

- Added A-optimal greedy selection based on integrated posterior variance reduction.
- Added D-optimal greedy selection using conditional log-determinant information gain.
- Added exact finite-target mutual-information selection against representative field targets.
- Added pivoted-Cholesky residual-covariance selection.
- Added shared scientific benchmark evaluation under identical budget, siting, existing-monitor exclusion, and spacing rules.
- Expanded the strategy table from five to nine full-scale methods.
- Added criterion diagnostics for A-optimality, D-optimality, and target mutual information.
- Added method-level runtime reporting separated from objective quality and feasibility.
- Added a deterministic reduced-pool exhaustive oracle with transparent optimality-gap reporting.
- Added an exact micro-benchmark panel to the interface.
- Added a preserved conditioned candidate-covariance snapshot to the Bayesian design state.
- Expanded the automated suite to eleven tests, including scientific-benchmark finiteness and exact-oracle upper-bound checks.

## v0.3.0 - Constrained Portfolio

- Added explicit deployment-budget enforcement during LUMOS and baseline construction.
- Added hard final audits for group uncertainty disparity, worst-group information gain, and mean network reliability.
- Added transparent infeasibility reporting and normalized requirement-violation diagnostics.
- Replaced single-path greedy selection with deterministic constrained beam search.
- Added Balanced, Maximum Information, Exposure Protection, Equity First, and Cost Efficient network profiles.
- Added nondominance filtering across information, exposure, worst-group gain, fairness gap, reliability, and total cost.
- Added an interactive portfolio that switches map networks without rerunning.
- Added a requirement-by-requirement constraint audit in the interface.
- Added total-cost and worst-group-information metrics.
- Updated every baseline to obey the same deployment budget.
- Expanded the test suite from five to eight tests, including budget enforcement and impossible-threshold reporting.

## v0.2.0 - Bayesian Core

- Replaced uncertainty-weighted geometric coverage with conditional Gaussian-process posterior variance reduction.
- Added domain-aware Matérn 3/2 covariance for Core, Heat, Air, Soil, and Water modes.
- Added conditioning on existing observations and reliability-adjusted measurement noise.
- Added sequential Schur-complement covariance updates for fast browser execution.
- Reframed social objectives as weighted information-quality gains.
- Added group-level remaining uncertainty, worst-group loss, and a configurable equity-gap target.
- Added existing-monitor visualization.
- Added standardized scenario validation.
- Updated all baselines to obey common feasibility and separation rules.
- Expanded automated tests across all domain adapters.
