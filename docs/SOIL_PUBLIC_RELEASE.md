# LUMOS Soil v1.7 Public Release

LUMOS Soil v1.7 promotes Soil from an inference preview to a public sampling-design domain. It combines nationwide USDA-NRCS SSURGO context, optional browser-local laboratory observations, Bayesian field reconstruction, socially constrained sample placement, intervention evaluation, and reproducible evidence exports.

## Public workflow

1. Select a Soil property or supported contaminant and a depth interval.
2. Fit a local U.S. study area.
3. Review SSURGO coverage, fallback status, and layer provenance.
4. Optionally import laboratory observations and inspect the import QA report.
5. Recalibrate the posterior and inspect locked validation when sample counts permit.
6. Generate and compare the five sampling portfolios.
7. Run the robustness lab and intervention-evaluation design.
8. Export the current-workspace paper bundle or the standardized four-case Soil evidence suite.

## Import quality assurance

The v1.7 importer audits analyte identity, units, coordinates, study-area membership, depth compatibility, dates, duplicates, detection limits, QA flags, reliability, and broad plausibility ranges. Non-detect strings and less-than values are retained only when a usable detection limit is available and are represented transparently as censored observations. Warnings reduce reliability rather than silently treating all records as equivalent.

The QA report records accepted, rejected, warning, duplicate, censored, stale, and depth-mismatch counts. It is preserved in workspaces and paper bundles.

## Four-case public evidence suite

The standardized suite includes:

- Fresno, California — organic matter, 0–15 cm;
- Phoenix, Arizona — electrical conductivity/salinity screening, 0–15 cm;
- Des Moines, Iowa — available water capacity, 15–30 cm;
- Atlanta, Georgia — soil pH, 0–15 cm.

Each case uses the same monitor count, budget, fairness settings, optimizer, portfolio family, and scientific benchmark family. The benchmark observations are deterministic controlled simulations layered on the public spatial context. They are not field measurements, contamination findings, or regulatory evidence.

Run the suite in the browser or with:

```bash
npm run paper:soil
```

## Scientific boundary

SSURGO values are survey estimates for mapped soil units and may not represent fine-scale conditions. Imported laboratory results can differ in collection support, depth, method, digestion, detection limit, date, and QA. Posterior predictions are model estimates, not certified measurements at unsampled locations.

Lead, arsenic, and cadmium maps are concentration estimates only when enough compatible observations are imported. Otherwise they remain explicitly labeled screening-priority proxies. LUMOS does not establish regulatory exceedance, property access, excavation safety, causal intervention effects, or deployment authorization.
