# LUMOS Methodology

## Planning-to-operations integration

LUMOS connects the existing probabilistic, social, optimization, funding, spatial, and field-campaign models to domain-aware commissioning and maintenance. The latest event for each operational assignment is evaluated against procurement, permit, installation, calibration or chain-of-custody, uptime, completeness, and maintenance contracts. Critical failures remain explicit and may activate unused reviewed reserves without relaxing domain constraints. A separate launch audit verifies declared software and evidence contracts without claiming regulatory, environmental, or accessibility certification.

See `COMMISSIONING_AND_MAINTENANCE.md` and `PUBLIC_LAUNCH_READINESS.md`.

---

## v2.7 phased inspections and reserves

After a reviewed deployment is selected, LUMOS ranks primary hosts using review need, shared-host importance, reliability need, domain criticality, and equity representation. Capacity-limited phases are assigned deterministically. Reserve candidates are filtered by the active domain constraints and ranked by suitability, reliability, review evidence, geographic relationship, and equity. Seeded response scenarios produce transparent replacement and unresolved-assignment records.

## Verified-host ingestion and field feasibility (v2.6)

The importer normalizes host identifiers, coordinates, categories, eligible domains, operational statuses, and optional scientific scores. It classifies field readiness without imputing verification, applies the chosen review policy before domain feasibility, and then invokes the unchanged coordinated deployment portfolio.

LUMOS is a socially constrained sequential Bayesian environmental-monitoring design framework. It treats environmental conditions as a continuous latent field evaluated through a dense numerical mesh. Feasible candidate installation locations are separate from evaluation points and from the rendered gradient.

The Heat mode combines environmental-risk, epistemic-uncertainty, exposure, vulnerability, community-priority, reliability, redundancy, cost, and group-level information-quality terms. Budget, spacing, siting feasibility, reliability, and social-information thresholds are audited explicitly.

The decision portfolio includes balanced, maximum-information, exposure-protection, equity-first, and cost-efficient profiles. Scientific comparisons include A-optimality, D-optimality, target mutual information, pivoted Cholesky, and simpler random, uniform, hotspot, and uncertainty baselines. Small reduced instances are compared with an exact enumerated oracle.

Nationwide runs use the same decision model at workload-adaptive numerical resolution. Guardrails change mesh density and candidate count, not the mathematical objectives or fairness constraints.

See `MODEL_SPECIFICATION.md` for equations, assumptions, acquisition criteria, intervention design, and experiment protocols.

## Cross-domain program allocation (v2.1)

The Unified allocator operates above the geographic optimizers. It enumerates feasible integer program sizes under one total budget, protected reserve, enabled-domain set, per-domain unit costs, minimum and maximum program sizes, and public priority weights. Diminishing-return curves are normalized within each environmental adapter for information, exposure, equity, ecology, intervention readiness, and reliability.

Balanced, information, exposure, equity, resilience, and cost-efficient profile scores combine those normalized dimensions with worst-domain benefit and the cross-domain balance gap. The cost-efficient profile also values uncommitted funds and bounded normalized value per budget. The model reports exact feasibility for the displayed four-domain bounds, not global optimality across every possible environmental investment.

See `CROSS_DOMAIN_BUDGET_ALLOCATION.md` for the equations and limitations and intended-use guidance.

## Air reference-conditioned inference (v1.2)

When a user supplies an OpenAQ API key, LUMOS retrieves compatible current reference measurements, converts supported units to the active pollutant's canonical µg/m³ field, and records source units, timestamps, and freshness. The atmospheric-model concentration is used as the prior mean. A regularized source-aware trend and wind-aligned residual Gaussian process update that prior. Calibration and locked-monitor validation are shown separately from the monitoring-placement objective.

Meteorological wind direction is converted to the downwind mathematical transport axis before anisotropic covariance is applied. Isotropic, moderate-downwind, and strong-downwind regimes are compared rather than assuming one directional structure is always correct.

## Air public evidence suite

The v1.4 browser suite applies one fixed monitor count, budget, fairness requirement, reliability requirement, numerical resolution, and benchmark family to four pollutant-location cases. It records a stable checksum and reports feasible networks separately from nearest tested infeasible alternatives. The command-line Air paper suite may additionally run the full sensitivity lab.

## Soil-domain methodology (v1.6 inference preview)

For each evaluation point, LUMOS resolves an SSURGO map-unit key and retrieves major components and horizons intersecting the requested depth interval. A property is aggregated with component percentage and horizon-overlap thickness as weights. The resulting continuous display is a numerical interpolation of map-unit estimates; it does not create finer observational resolution than the source survey.

The Soil adapter supplies the unchanged shared optimizer with a soil-property risk priority, epistemic uncertainty, human exposure, social vulnerability, ecological importance, deployment cost, reliability, and candidate feasibility. Systematic sample locations are always available; mapped land uses can enrich but never block the candidate network. Intervention evaluation selects treatment, matched-control, boundary, spillover, and supplemental sample sites under the same budget and spacing rules used by other domains.


### Soil laboratory-conditioned inference

Compatible local samples are standardized to the target unit and combined with a regularized survey/source trend. A short-range residual Gaussian process updates posterior mean and predictive uncertainty. Calibration uses development observations only; a deterministic locked sample set is evaluated afterward against trend-only, inverse-distance, and nearest-sample baselines. The robustness lab repeats the analysis across split seeds, covariance/noise settings, sample-quality filters, deterministic sample loss, and increased-noise scenarios.

For lead, arsenic, and cadmium, SSURGO does not provide a concentration prior. Before compatible laboratory observations are loaded, the displayed layer is a screening-priority proxy. After conditioning, it is a local statistical reconstruction and still not a regulatory determination.


## Soil v1.7 import QA and public evidence

Before posterior fitting, imported records pass analyte, unit, coordinate, extent, depth, date, duplicate, detection-limit, plausibility, QA, and reliability checks. Accepted warnings reduce observation reliability and therefore increase effective measurement noise. Rejected records never enter calibration or validation. The four-case public evidence suite uses deterministic simulated observations under a frozen cross-case protocol; it is a model/decision benchmark, not a field study.

## Water observation-informed flow screening

Water starts from the shared adaptive evaluation mesh and systematic candidate set. Recent compatible USGS readings are projected into the fitted extent, and a screening indicator field is formed between stations. Mapped waterway geometry supplies a principal directional axis and approximate branches; mapped treatment, industrial, landfill, and agricultural features supply source-pressure proxies. Downstream human exposure, social vulnerability, ecological importance, and monitoring scarcity are combined with indicator-specific risk.

The active Water domain passes its fitted transport angle into the same anisotropic covariance and constrained acquisition engine used elsewhere in LUMOS. This preserves Bayesian uncertainty reduction, hard group-information constraints, portfolio alternatives, Pareto auditing, and scientific benchmarks. The flow approximation remains explicitly replaceable: authoritative NLDI/NHDPlus navigation or a utility network should supersede it before operational deployment.

## Evidence-calibrated sequential reallocation (v2.2)

The next-round layer reads compatible saved workspaces, constructs domain evidence records, aggregates them by evidence strength, and calibrates normalized diminishing-return curves with shrinkage. Evidence inputs include remaining uncertainty, risk-weighted uncertainty, vulnerability-group uncertainty, ecological uncertainty, observation support, validation quality, reliability, and selected-network metrics when available. The allocator exhaustively enumerates the displayed integer additions, applies reserve and program bounds, enforces minimum normalized equity, reliability, intervention, and minimum-program floors, and adds an exploration term for weak-evidence domains. See `SEQUENTIAL_REALLOCATION.md`.


## Multi-round adaptive program simulation (v2.3)

LUMOS repeats the sequential allocation step over a user-selected horizon. After each round, bounded domain-specific transition functions update evidence strength, residual need, normalized yield, reliability, equity need, and intervention readiness. Six trajectories apply a fixed public profile; a seventh adaptively reselects the profile after each update. Future incremental benefits are discounted for trajectory comparison. These transitions are controlled scenario assumptions and are not learned causal dynamics.

## Trajectory uncertainty and robust policy selection (v2.4)

LUMOS runs the v2.3 simulator at conservative, central, and optimistic evidence-response anchors. A seeded ensemble then interpolates between those anchors and applies correlated domain-specific cost, failure, and environmental-condition shocks. Policies are compared on expected normalized utility, 10th-percentile utility, lower-tail utility, feasibility, regret, and stressed cost. The robust score blends expected and downside performance according to the displayed risk-aversion setting. This is robust scenario evaluation rather than probability forecasting or a solved stochastic-control problem.

## Spatially coupled cross-domain deployment (v2.5)

The v2.5 layer converts funded domain unit counts into host-domain assignments while preserving adapter-specific siting constraints. It searches a deterministic controlled host pool, tests pairwise co-location compatibility, estimates only the shareable portion of infrastructure cost, and penalizes spatial concentration and correlated failure. Five policy profiles are generated independently and compared over cost, coverage, worst-domain representation, equity, reliability, savings, and failure coupling. The layer is a planning model above the domain-specific posterior and site-validation workflows; it does not certify candidate properties or merge physical measurements across domains.

## v2.8 live campaign tracking

For each completed phase, LUMOS resolves the latest imported event for every inspected host, recomputes primary and replacement assignment states, and activates only unused domain-compatible reserves that remain admissible. Conditional assignments receive a domain-specific fractional operational credit; rejected assignments without eligible reserves remain explicit gaps. The event history is append-only in exports.