# LUMOS Master Handoff — v4.0.0

**Release date:** 2026-07-31
**Repository:** `hgd-dev/lumos`
**Public architecture:** static HTML, CSS, and ES modules for GitHub Pages
**Authoritative code baseline:** `LUMOS_v4.0.0_COMPLETE_REPO.zip`

## 1. Continuation rule

Continue all future LUMOS work from v4.0.0. The repository snapshot is the exact code source of truth. This handoff is the source of truth for intent, architecture, scientific positioning, release state, and workflow.

Do not revert to v3.4.0 or earlier. Preserve the completed cinematic desktop Home unless Hudson explicitly requests a change. Keep future modifications narrow, versioned, and verified.

## 2. Project identity and scientific position

LUMOS means **Localized Unified Monitoring Optimization System**. It is a public environmental monitoring-design and operations platform covering Heat, Air, Soil, and Water.

The central research position remains a **Socially Constrained Sequential Bayesian Environmental Monitoring Design** framework integrating established methods:

- continuous probabilistic field reconstruction;
- Gaussian-process and related spatial inference;
- Bayesian experimental design and uncertainty reduction;
- sensor and sampling-site placement;
- group-level information-quality and equity constraints;
- dynamic exposure and community priorities;
- heterogeneous and calibrated monitoring networks;
- budget, access, power, safety, and operational feasibility;
- robustness to uncertain sources, missing data, and sensor failure;
- adaptive and sequential deployment;
- BACI-style and related intervention-evaluation design.

LUMOS does **not** claim to invent those individual components. Its contribution is their transparent, modular integration across domains and across the planning-to-operations lifecycle.

LUMOS does not provide regulatory determinations, certification, emergency guidance, causal proof, guaranteed deployment feasibility, or substitutes for field verification and professional review.

## 3. v4.0.0 release summary

v4.0.0 expands LUMOSLab from a nine-view scenario studio into a nineteen-view local-first environmental program system. The finished Home and the four dedicated domain engines remain preserved.

### Existing decision workflow retained

1. Guided plan builder
2. Analysis and recommendation explanation
3. Scenario comparison
4. Data and provenance review
5. Intervention planner
6. Robustness center
7. Equity–information tradeoff explorer
8. Sequential deployment timeline
9. Reproducible export

### New operational and research system

10. Command center
11. Geography and map editor
12. Feasibility and lifecycle-cost studio
13. Observation and sensor-health loop
14. Validation, simulation, and statistical-power studio
15. Unified four-domain program allocator
16. Recommendation-stability and sensitivity studio
17. Governance, review, and stakeholder briefs
18. Research studio with ablations, batch grids, synthetic cities, and model cards
19. Story mode and project-grounded assistant

## 4. LUMOSLab architecture

### Entry points

- `lumos-lab.html` — comprehensive user interface
- `css/lumos-lab.css` — responsive Lab presentation and accessibility modes
- `js/lumos-lab.js` — core plans, analysis previews, comparisons, intervention, robustness, tradeoffs, timelines, and exports
- `js/lumos-lab-advanced.js` — project-keyed advanced studios, local state, geographic editing, operations, monitoring, validation, unified allocation, intelligence, governance, research, story, and archive functions
- `docs/LUMOSLAB.md` — public feature and boundary documentation

### State model

- Core plan storage remains browser-local.
- Advanced state is stored per project under `lumoslab-advanced-v1`.
- Display preferences use separate browser-local storage.
- Core project changes dispatch `lumoslab:project-change`.
- View changes dispatch `lumoslab:view-change`.
- `window.LUMOSLabCore` exposes a deliberately limited integration API.
- Complete archive export combines core and advanced project records.

### Scientific boundary

LUMOSLab is the orchestration, planning-preview, simulation, operational, governance, and communication layer. Dedicated Heat, Air, Soil, Water, and Unified workspaces remain authoritative for full posterior inference, optimization, observation conditioning, locked validation, mapped evidence, site-level scientific records, and formal scientific exports.

## 5. New v4 capabilities

### Geographic project construction

- schematic study-boundary drawing;
- priority and exclusion zones;
- draggable, removable, and lockable candidate sites;
- site roles, cost adjustments, and feasibility states;
- GeoJSON import and CRS84 GeoJSON export;
- manual overrides with explicit project persistence.

This is a browser-local planning editor, not a cadastral or surveyed GIS replacement.

### Operational feasibility and network design

- domain-aware sensor or sampling catalog;
- fixed, temporary, mobile, and shared-host planning concepts;
- capital, installation, recurring, staffing, site-adjustment, and contingency costs;
- lifecycle cost summaries;
- access, power, connectivity, safety, permission, and maintenance readiness;
- infeasibility and constraint-conflict explanations.

### Observation and health loop

- CSV and JSON observation import;
- controlled synthetic observation generation;
- completeness, duplication, range, and outlier checks;
- drift, calibration, missingness, and maintenance diagnostics;
- adaptive planning-update preview after evidence intake.

### Validation and intervention power

- model-comparison diagnostics;
- spatial and repeated-simulation preview settings;
- interval coverage and residual summaries;
- treatment/control design support;
- detection probability and minimum detectable-effect estimates.

These are transparent local previews unless a dedicated scientific workspace produces the formal result.

### Unified program planning

- one-budget allocation across Heat, Air, Soil, and Water;
- manual and optimized allocation profiles;
- distinct compound-risk, uncertainty, monitoring-gap, social-vulnerability, and community-priority dimensions;
- shared-infrastructure opportunities;
- schematic mobile-monitoring route preview.

### Decision intelligence

- repeated-seed stability analysis;
- weight, budget, and candidate-loss perturbations;
- site selection frequencies;
- core, frequent, configuration-dependent, and fragile recommendation classes;
- parameter sensitivity summaries.

### Governance and communication

- assumption register;
- append-only decision log;
- project stages and approval checks;
- executive, technical, operations, and community briefs;
- guided story mode;
- rule-based assistant grounded only in the active project record.

### Research studio

- component ablation controls;
- batch experiment grids;
- synthetic-city generator;
- model-card generator and export;
- reproducibility metadata.

### Accessibility and portability

- high-contrast mode;
- user-controlled reduced-motion mode;
- Spanish navigation localization;
- accessible SVG labels and status regions;
- autosave status;
- complete local archive import/export;
- expanded offline service-worker shell.

## 6. Release metadata

- Package version: `4.0.0`
- Release status: `stable-public-v4`
- Service-worker cache: `lumos-v4.0.0-protocol-2`
- LUMOSLab advanced build identifier: `lab-2`
- Public views: 19
- Primary official Home: `index.html`
- Unlinked experiments retained: `home-3d.html`, `lumos-lab-protocol.html`
- Retired compatibility route remains absent: `home-spiral.html`

## 7. Verification state

The v4.0.0 source passed:

- 136/136 automated tests;
- 86 cross-domain architecture checks, 0 warnings, 0 failures;
- 20 internal release-quality checks, 0 warnings, 0 failures;
- release integrity check over 102 JavaScript modules;
- deterministic static GitHub Pages build;
- complete uninterrupted `npm run verify` after moving file-scanning/build operations before the resource-intensive parallel simulation ensemble;
- JavaScript syntax checks for both Lab controllers;
- `git diff --check`;
- static interface contract validation:
  - 217 total HTML IDs, all unique;
  - 19 unique navigation views and 19 corresponding panels;
  - no view-panel mismatch;
  - no missing static JavaScript selector targets.

Automated screenshot QA could not be completed in this container because the installed Chromium process did not terminate reliably, even with headless and timeout flags. Do not claim browser screenshot verification for this release. Perform a short manual desktop/mobile browser pass after applying the patch, especially geographic drag interactions, file imports, print output, and narrow-screen navigation.

## 8. Required workflow for future changes

Prefer direct downloadable patches and exact Git Bash commands. Use repository-relative paths. Do not include `dist/` in normal source patches; regenerate it with the build command.

For every substantive change:

```bash
npm test
npm run check:release
npm run build
```

For major releases:

```bash
npm run audit:public
npm run verify
```

Also perform a manual browser pass for desktop and mobile when UI behavior changes.

## 9. Preservation requirements

- Preserve the scientific model and conservative claim boundaries.
- Preserve domain-specific units, provenance, and validation contracts.
- Do not silently turn illustrative Lab previews into authoritative scientific outputs.
- Keep community priorities distinct from social vulnerability, observed exposure, modeled risk, uncertainty, and formal fairness constraints.
- Preserve field-verification language for candidate and host feasibility.
- Keep the application local-first and static unless Hudson explicitly approves backend architecture.
- Preserve deterministic seeds and reproducibility metadata in research workflows.
- Preserve the completed desktop Home unless explicitly authorized.

## 10. Recommended next work

The feature surface is now broad. Prioritize depth and validation rather than adding more studios:

1. Manual cross-browser QA and interaction polish.
2. Replace schematic geography with an optional real map adapter while retaining offline fallback.
3. Connect selected Lab records to dedicated workspace import contracts.
4. Add formal schema validation and migration for core and advanced project archives.
5. Add automated browser tests when a reliable browser runner is available.
6. Validate power, lifecycle-cost, and sensor-health assumptions with domain experts and documented datasets.
7. Build paper experiments around stability, ablation, calibration, and unified-allocation results.

## 11. Convergence Protocol secret-page experiment

The updated v4.0.0 package includes a new unlinked `lumos-lab-protocol.html` experiment. It is a complete copy of the current LUMOSLab workspace with a separate fullscreen intro overlay; the live `lumos-lab.html` is unchanged and contains no protocol code.

### Experiment files

- `lumos-lab-protocol.html` — secret full Lab route with `noindex,nofollow`;
- `css/lumos-lab-protocol.css` — protocol grid, edge circuitry, core, network, scenario, responsive, and reduced-motion presentation;
- `js/lumos-lab-protocol.js` — deterministic circuit generation, pulse animation, timing, Skip, Replay, canvas particles, and interface handoff.

### Visual sequence

1. dark local-system boot grid and diagnostic framing;
2. color-coded orthogonal circuit traces and junction pulses extending directly from every edge toward the center;
3. LUMOS-lime unified decision core with uncertainty, equity, feasibility, and robustness annotations;
4. geographic boundary, mesh, candidate nodes, and selected monitoring network;
5. efficiency, equity, and resilience scenario branching;
6. `LUMOSLab — Build plans. Test assumptions. Make decisions.`;
7. seamless reveal of the complete functional Lab.

### Experiment behavior and boundaries

- Autoplays on the secret route for iteration and testing.
- Skip is available immediately and Escape also exits.
- Replay is available in the experiment header after reveal.
- Narrow screens use a shorter sequence; reduced-motion users receive a compressed fallback.
- Rendering is native SVG, CSS, canvas, and JavaScript with no new external runtime.
- The route is packaged by the deterministic build and service worker but is absent from all public navigation.
- No model, data adapter, workspace, storage contract, plan output, evidence definition, or public claim changed.

### Updated release contract

- Package version remains `4.0.0`.
- Service-worker cache is `lumos-v4.0.0-protocol-2`.
- Protocol asset identifier is `protocol-2`.
- Experimental entry points are `home-3d.html` and `lumos-lab-protocol.html`.
- Automated test count is 136.
- Release integrity covers 102 JavaScript modules.

### Protocol verification

- 136/136 automated tests passed.
- Release integrity passed.
- Deterministic static build passed.
- Cross-domain audit passed 86 checks with 0 warnings and 0 failures.
- Internal release-quality audit passed 20 checks with 0 warnings and 0 failures.
- Every operations/science stage invoked by `npm run verify` passed when executed within the container execution limit.
- The one-command `npm run verify` wrapper exceeded this environment's single-call execution ceiling after completing its early stages; do not describe that wrapper as freshly uninterrupted in this experiment chat.
- Fresh automated screenshot QA for the circuit-only revision was not completed because the installed Chromium process did not terminate reliably in this environment. Static interface validation, syntax checks, and the full automated product checks passed; perform a brief manual desktop/mobile visual pass before public promotion.
- The experiment contains 234 unique HTML IDs, 19 unique Lab panels, and no view-panel mismatch.

The current secret-route revision intentionally omits all four corner-domain systems; the established domain colors remain in the edge circuit traces. Continue visual iteration on the secret route only. Merge the protocol into `lumos-lab.html` only after Hudson explicitly approves the final animation and timing.
