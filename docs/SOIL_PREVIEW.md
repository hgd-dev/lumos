# LUMOS Soil Public Release v1.7

LUMOS Soil extends the shared monitoring-design engine to local soil sampling across the United States.

## Live source

The primary source is USDA-NRCS Soil Data Access (SDA), which exposes official SSURGO map units and component/horizon properties. The browser resolves the SSURGO map unit at each evaluation point, retrieves major-component horizon data, and aggregates values over the selected depth interval.

## Supported targets

Survey-supported targets:

- Soil-health composite
- pH
- Organic matter
- Clay content
- Available water capacity
- Electrical conductivity / salinity screening

Laboratory-dependent contaminant targets:

- Lead
- Arsenic
- Cadmium

## Scientific boundary

SSURGO values represent mapped soil survey units that can contain multiple soil components and substantial within-unit variability. They are not laboratory measurements at each displayed coordinate. Soil v1.7 can condition supported targets on compatible user-imported observations, fit a survey/source trend plus localized residual GP, and evaluate a deterministic locked sample set. Contaminant targets without compatible observations remain screening-priority layers, not inferred concentrations. Posterior values are not regulatory determinations.

## Candidate sites

The guaranteed candidate network is a systematic sampling mesh. Optional OpenStreetMap enrichment adds mapped parks, schools, community spaces, agriculture, brownfields, landfills, and industrial sites as sampling proxies. Every site requires access, permission, safety review, and field verification.

## Intervention modes

- Disturbed-site remediation
- Community garden and schoolyard safety
- Agricultural soil amendment
- Ecological soil restoration

The post-intervention design selects treatment, matched-control, boundary, spillover, and supplemental sample locations. Its power estimate is a planning diagnostic, not causal proof.


## Laboratory import and validation

The downloadable template accepts coordinates, analyte, value, units, depth, date, detection limit, QA flag, and reliability. With enough compatible observations, LUMOS reports locked MAE, RMSE, bias, R², and interval coverage, compares simple reconstruction baselines, and supports a robustness lab and paper bundle. Imported data remain browser-local unless the user explicitly saves or exports them.
