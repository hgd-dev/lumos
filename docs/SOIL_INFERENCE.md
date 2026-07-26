# LUMOS Soil Inference and Validation v1.7

LUMOS Soil v1.7 combines the national SSURGO survey prior with optional local laboratory observations. It is designed for sampling strategy, field reconstruction, uncertainty auditing, and intervention-monitoring design.

## Laboratory import

CSV and JSON imports may provide:

- `sample_id`;
- `latitude` and `longitude`;
- `analyte`;
- `value` and `unit`;
- `depth_top_cm` and `depth_bottom_cm`;
- `sample_date`;
- `detection_limit`;
- `qa_flag`;
- `reliability`.

The included template demonstrates the accepted schema. LUMOS standardizes recognized units, filters observations outside the fitted extent, retains QA and reliability metadata, and uses only observations compatible with the active target.

Imported data are processed in the browser. LUMOS does not transmit them to a LUMOS server. They can, however, be included in a workspace or paper bundle when the user explicitly saves or exports that file.

## Inference model

For a target analyte, the posterior mean is represented as a survey/source trend plus a localized residual Gaussian process:

\[
\widehat z(s)=\widehat g(s)+k_{sO}(K_{OO}+\Sigma_\epsilon)^{-1}(z_O-\widehat g_O).
\]

The trend may use the mapped survey prior, disturbance pressure, exposure, vulnerability, ecological priority, and related site features. Observation reliability and calibrated measurement noise contribute to \(\Sigma_\epsilon\). The same covariance framework also updates posterior epistemic uncertainty for the monitor-placement objective.

Contaminant targets have no SSURGO concentration prior. Before compatible samples are imported, their map is explicitly a screening-priority proxy rather than an inferred concentration field.

## Validation

With sufficient compatible samples, LUMOS creates deterministic spatial development and locked sets. The development set is used for calibration. The locked set is evaluated afterward against:

- the LUMOS trend plus residual GP;
- the survey/source trend alone;
- inverse-distance weighting;
- nearest-sample reconstruction.

Reported diagnostics include MAE, RMSE, bias, R², empirical 95% interval coverage, and predictive interval width. Fewer than eight compatible observations are reported as insufficient for locked validation rather than being treated as evidence.

## Robustness lab

The Soil robustness lab evaluates:

- deterministic split-seed stability;
- covariance-length and measurement-noise assumptions;
- use of all versus higher-reliability observations;
- deterministic sample loss;
- increased observation noise.

The current-workspace paper bundle includes the fitted target, validation results, selected sampling network, scientific benchmarks, sensitivity rows, configuration, and stable checksum.

## Interpretation limits

Results are not regulatory compliance determinations. Laboratory methods, digestion procedures, reporting limits, sample support, depth, collection date, and QA protocols can materially affect comparability. The model does not establish causality, certify property access or sampling safety, or replace laboratory analysis at unsampled locations.
