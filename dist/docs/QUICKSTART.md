# LUMOS Quickstart

## Complete public workflow

1. Open **Unified** or a domain tab.
2. Fit a domain workspace and generate a monitoring portfolio.
3. Validate, stress test, and export evidence.
4. Allocate a shared program budget or run sequential/multi-round analyses.
5. Translate unit counts into coordinated sites.
6. Import reviewed hosts and plan field campaigns.
7. Import field outcomes and reconstruct the current operational network.
8. Import commissioning records, review tickets, and activate eligible replacement reserves.
9. Run the internal release-quality audit before publication or deployment review.

Use **Focus map** to collapse the header and both side panels. Press Escape to restore the previous layout. All imported operational records remain user-supplied evidence.

---

## v2.7 field campaign

1. Build or load a reviewed cross-domain deployment in Unified.
2. Open **Field campaign operations**.
3. Choose phase capacity, phase count, response scenario, reserve ratio, and costs.
4. Run the four campaign profiles and inspect unresolved assignments.
5. Export JSON or CSV before changing the underlying deployment.

Use the header chevron to collapse the masthead and expand the map vertically. The setting is remembered locally.

## Review local candidate hosts

In Unified mode, open the coordinated deployment section, download the host-inventory template, fill or import CSV/JSON records, select a review policy, and rerun the portfolio. Use the controlled reviewed example to inspect the workflow without claiming that its records represent real properties.

Serve the repository locally rather than opening `index.html` directly:

```bash
python -m http.server 5500
```

Open `http://localhost:5500`, choose Heat, Air, Soil, or Water, move or search the map, and select **Fit current area**.

## Coordinated spatial deployment

1. Open **Unified** and run or select an initial or sequential cross-domain allocation, or choose manual unit counts.
2. Open **Spatially coupled deployment**.
3. Review the unit source, shared-infrastructure discount, maximum domains per host, host-pool size, seed, and minimum compatibility.
4. Select **Generate coordinated sites**.
5. Compare Coordinated, Maximum Savings, Coverage First, Equity First, and Resilient plans.
6. Inspect physical-host count, shared-host count, modeled savings, coverage, equity, reliability, and correlated-failure risk.
7. Export JSON and CSV before changing assumptions.
8. Treat every point as an unverified host proxy and continue site-level review in the relevant domain workspace.

The public host pool is controlled and deterministic. It does not establish ownership, permission, power, network service, access, safety, hydraulic connectivity, or deployment approval.

## Sequential next-round planning

1. Save named Heat, Air, Soil, or Water workspaces after fitting and, preferably, generating a portfolio.
2. Open **Unified** and select **Load saved evidence**.
3. Review the evidence source, strength, residual need, existing units, unit costs, maximum totals, learning rate, exploration share, and hard floors.
4. Select **Allocate next round** and compare all six policy profiles.
5. Treat a **nearest tested plan** as infeasible under at least one displayed floor.
6. Export JSON and CSV before changing assumptions.

Use **Use controlled example** only for demonstrations and reproducibility checks; it is synthetic rather than observed deployment evidence.

## Unified shared-budget workflow

1. Open **Unified**.
2. Enter a total planning budget and protected reserve.
3. Review the illustrative unit cost, minimum program, maximum program, and priority for Heat, Air, Soil, and Water.
4. Keep the minimum-program safeguard enabled when every active domain must receive a viable starting program.
5. Select **Allocate shared budget**.
6. Compare Balanced, Maximum Information, Exposure Protection, Equity First, Reliability and Intervention, and Cost Efficient allocations.
7. Export JSON and CSV to preserve the assumptions, integer allocation, normalized metrics, and checksum.
8. Open each funded domain and run its separate geographic monitoring-design workflow.

The defaults are planning assumptions, not procurement quotes. Normalized benefit values are not comparable physical measurements or regulatory benefit-cost estimates.

## Soil public workflow

1. Choose a Soil property or contaminant and depth.
2. Use a Soil preset or search for a local U.S. area.
3. Fit the area and inspect source status and uncertainty.
4. Optionally download the laboratory template and import CSV or JSON observations.
5. Review the import-QA summary before using the posterior.
6. Recalibrate inference and inspect locked validation when available.
7. Generate the five sampling portfolios and compare information, equity, cost, redundancy, and feasibility.
8. Run the Soil robustness lab and, when relevant, post-intervention evaluation.
9. Export a current-workspace paper bundle or run the four-case Soil evidence suite.

The evidence suite’s benchmark observations are controlled simulations, not field measurements. Contaminant layers without compatible observations are screening priorities, not concentrations.

## Verification

```bash
npm run verify
npm run check:live
```

## Water public workflow

1. Choose **Water**, then select surface-water or distribution-proxy context and an indicator.
2. Use a Water preset or search for a local U.S. study area.
3. Select **Fit current area** and review USGS observation status, hydrologic-feature status, and flow confidence.
4. Inspect indicator, source-pressure, downstream-exposure, uncertainty, social, and ecological layers.
5. Generate the five-profile portfolio and compare feasibility, information, equity, cost, reliability, and benchmarks.
6. Switch to post-intervention evaluation for treatment, control, upstream, downstream, and supplemental sampling roles.
7. Treat all sites as planning recommendations requiring field verification.


## Multi-round adaptive simulation

1. Open **Unified** and load saved evidence or the controlled example.
2. Review the v2.2 sequential assumptions and existing units.
3. Choose two to eight future rounds, a budget per round, budget growth, a response scenario, transition rate, and future-round discount.
4. Select **Simulate trajectories**.
5. Compare the adaptive trajectory with the six fixed policy paths.
6. Inspect the profile selected in each round, cumulative cost, discounted increment, and terminal residual need.
7. Export JSON and CSV before changing assumptions.

Treat all trajectory results as deterministic planning scenarios rather than forecasts.

## Robust policy ensemble

1. Load or construct a cross-domain evidence bundle in **Unified**.
2. Review the v2.3 rounds, budget, transition, and discount assumptions.
3. Set ensemble size, seed, evidence-response uncertainty, cost uncertainty, expected failure rate, environmental uncertainty, and risk aversion.
4. Run **Robust ensemble**.
5. Compare the robust, expected-value, minimax-regret, and most-feasible recommendations.
6. Export JSON and CSV evidence.

Treat scenario frequencies as reproducible stress-test frequencies rather than forecasts or confidence intervals.

## v2.8 live campaign tracking

1. Generate a reviewed spatial deployment.
2. Plan a v2.7 field campaign.
3. Download the outcome template or load the controlled outcome example.
4. Import CSV/JSON records and choose the latest completed phase.
5. Recompute the operational network.
6. Review provisional assignments, reserve activations, overdue reviews, and residual gaps.
7. Export the ledger and phase-aware assignment records.