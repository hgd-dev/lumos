# LUMOS Unified Architecture

## Complete public lifecycle

The shared architecture now extends from domain-specific environmental reconstruction through allocation, robust policy evaluation, coordinated siting, reviewed-host feasibility, field campaigns, live outcomes, commissioning, and maintenance. The commissioning contract is domain specific; the ledger, ticket, queue, replacement, export, and readiness-audit infrastructure is shared. This preserves one product without claiming identical physics or operations across Heat, Air, Soil, and Water.

The internal release-quality audit is a release-contract layer above the scientific architecture. It confirms declared completeness and reproducibility but does not certify field, regulatory, cybersecurity, or accessibility outcomes.

---

## v2.7 operational campaign layer

The shared architecture now includes `fieldCampaignPlanner`, positioned after host review and coordinated spatial deployment. Every adapter declares inspection priority, reserve reliability floor, and replacement criticality while retaining its original physics and siting constraints. The executable audit validates all four adapter contracts plus the shared planner/release contract.

## v2.6 operational host adapter

The unified layer now contains a host-inventory adapter between program allocation and spatial deployment. It preserves local review evidence while leaving scientific siting physics in the four domain adapters.

LUMOS v2.5 formalizes a single environmental-monitoring system with one shared decision engine and four scientific adapters. The architecture is not a claim that Heat, Air, Soil, and Water obey identical physics. It is a contract separating the methods that should remain shared from the assumptions that must remain domain-specific.

## Shared engine

Every public adapter uses the same high-level decision structure:

- continuous-field evaluation points distinct from candidate installation or sampling locations;
- posterior epistemic-uncertainty reduction;
- environmental-risk and exposure targeting;
- group-level information-quality and fairness constraints;
- community and ecological priorities;
- reliability, redundancy, budget, spacing, and feasibility constraints;
- five-profile Pareto portfolio generation;
- serious scientific placement baselines and a reduced exact oracle;
- pre-intervention diagnosis and post-intervention evaluation design;
- browser persistence, provenance, evidence export, and static GitHub Pages deployment.

## Domain adapters

Heat retains weather, land-surface, canopy, imperviousness, apparent-temperature, and heat-vulnerability structure. Air retains pollutant-specific atmospheric priors, meteorological transport, source roles, calibration, and collocation. Soil retains map-unit and horizon aggregation, depth, persistent short-range variation, laboratory QA, and contaminant observation limits. Water retains indicator-specific observations, flow direction, branch structure, source-to-receptor reasoning, and hydrologic or distribution-network limitations and intended-use guidance.

The registry in `js/config/domain-registry.js` records each adapter's public status, scenario contract, required services, inference and transport model, fallback, intervention roles, and scientific workflow capabilities. Model weights and kernel parameters remain in `js/config/domains.js`.

## Cross-domain consistency audit

The audit in `js/release/domain-audit.js` verifies:

1. shared model and kernel configuration;
2. the complete ten-term objective vector;
3. posterior inference, locked validation, robustness, intervention, evidence, persistence, provenance, and fallback capabilities;
4. domain scenario contracts;
5. public case-study presets;
6. domain-aware onboarding;
7. required-source health checks;
8. explicit fallback behavior;
9. treatment/control and domain-specific intervention roles;
10. field, inference, and transport limitations and intended-use guidance;
11. registry, model, and release-metadata parity.

The audit is deterministic apart from its retrieval timestamp. A checksum excludes that timestamp, allowing two equivalent architecture states to produce the same identifier. The browser exports JSON and tidy CSV. The command-line version writes frozen copies to `data/examples`:

```bash
npm run audit:domains
```

`npm run verify` runs this audit before the release check and deterministic static build.

## Claim boundary

LUMOS v2.0 does not claim to invent Gaussian-process placement, A- or D-optimal design, mutual information, adaptive sampling, equity-aware placement, robust optimization, or BACI evaluation. The contribution is their explicit integration into a socially constrained sequential Bayesian monitoring architecture that is shared where appropriate and domain-specific where scientifically necessary.

The v2.0 audit verifies architectural completeness and release consistency. It does not establish that every public dataset is available at runtime, that a proxy is an observation, that a recommended site is deployable, or that a generated network is globally optimal.

## v2.1 allocation layer

The domain registry now also supplies a cross-domain planning contract: editable package type and cost, minimum and maximum program sizes, readiness, unit reliability, and normalized diminishing-return parameters. The allocation layer uses these contracts to choose program sizes under one budget. It remains above, and scientifically separate from, the domain-specific spatial optimizers.

The architecture audit verifies that all four public adapters declare complete planning contracts. See `CROSS_DOMAIN_BUDGET_ALLOCATION.md` for the formal model and interpretation boundaries.

## v2.2 sequential evidence layer

The registry now also declares an observation-support target and prior residual-need value for each public adapter. Saved workspace evidence is summarized by a shared schema, but the underlying observations, field variables, validation protocols, and uncertainty meanings remain domain-specific. The sequential reallocator shrinks evidence toward each adapter prior, distinguishes existing from additional units, protects weak-evidence domains through exploration, and enforces cross-domain floors without merging physical units.


## v2.3 multi-round simulation layer

The registry now declares bounded domain-specific simulation-learning and residual-response assumptions. The adaptive simulator repeatedly invokes the v2.2 sequential allocator, updates normalized evidence state, and compares fixed-profile and adaptive trajectories. It does not merge domain physics or alter the domain-specific posterior fields. The architecture audit checks all four transition contracts and the release path of the shared simulator.

## v2.4 robust policy layer

The registry now declares positive cost, failure, and environmental sensitivity scales for each public domain. The shared robust evaluator runs the complete v2.3 model at three response anchors, constructs a seeded correlated uncertainty ensemble, and compares expected performance, downside performance, feasibility, and regret. It remains above the domain adapters and does not alter their posterior fields, validation protocols, or physical units. The architecture audit validates all four uncertainty contracts and the robust evaluator release path.

## v2.5 spatial deployment layer

The registry now includes a spatial-deployment contract for every public adapter. The shared planner can identify compatible infrastructure-sharing opportunities, but each assignment retains its domain-specific unit, spacing, observation, calibration, access, and maintenance requirements. A shared physical host does not merge environmental fields or observation models.

The architecture audit verifies the presence and validity of the spatial contract and release metadata. The controlled host pool is deterministic and bounded by the active extent. Production use should replace it with verified local candidate inventories. See `SPATIAL_DEPLOYMENT.md`.

## v2.8 live operational layer

The unified architecture now continues beyond planned field campaigns into imported inspection outcomes and phase-aware operational recomputation. The shared tracker preserves one event schema while applying domain-specific reliability floors and conditional operational credits from the adapter registry.