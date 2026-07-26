# LUMOS Deployment

## Static public architecture

LUMOS deploys as a deterministic static GitHub Pages artifact. No permanent backend or embedded credential is required. The versioned service worker caches the application shell while live public-data calls remain network dependent. Commissioning and operational imports stay in the browser unless the user explicitly exports them. Sensitive infrastructure or personal operational records should not be published in a public repository.

Before deployment, run `npm run verify`, inspect `dist`, test the service-worker update with two hard refreshes, and complete the browser checklist in `RELEASE_CHECKLIST.md`.

---

## v2.7 field-campaign assets

The application shell must include `js/model/unified/field-campaign.js`. The deterministic build publishes the field-campaign JSON/CSV example under `data/examples`. The header-collapse control is browser-local and requires no backend. Increment the service-worker cache whenever campaign logic, campaign controls, or header-layout behavior changes.

LUMOS is a static HTML, CSS, and JavaScript application. The Bayesian optimization model runs in the visitor's browser. Public APIs supply selected data, while browser storage and exported workspace files support caching and reproducibility.

A simple GitHub Pages deployment can publish the repository root from `main`. Test locally first:

```bash
python -m http.server 5500
```

Open `http://localhost:5500`, run `npm run verify`, and use the in-app System Check. The verification pipeline also regenerates the cross-domain architecture audit and frozen default budget-allocation examples. API keys must never be embedded in client-side JavaScript. Sources requiring secrets should be refreshed through GitHub Actions and published as versioned static packages.


The v2.2 application shell must include `js/model/unified/sequential-reallocation.js`. The deterministic build also publishes the versioned sequential evidence and reallocation examples under `data/examples`. No backend or credential is required for browser-local workspace evidence.


The v2.4 application shell must include `js/model/unified/adaptive-program-simulation.js` and `js/model/unified/robust-policy-ensemble.js`. The deterministic build publishes adaptive-simulation and robust-policy-ensemble JSON/CSV evidence under `data/examples`. The simulator remains fully browser-local and requires no backend or credential.

## v2.5 spatial-deployment assets

The application shell must include `js/model/unified/spatial-deployment.js`. The deterministic build publishes `data/examples/spatial-deployment.json` and `data/examples/spatial-deployment.csv`. The planner remains browser-local and requires no backend or credential. Increment the service-worker cache whenever the spatial module, registry contract, UI controls, or generated release examples change.

## v2.8 live campaign assets

The application shell includes `js/model/unified/campaign-tracking.js` and the controlled live-campaign evidence under `data/examples`. The workflow remains fully static and runs entirely in the browser or Node release scripts.