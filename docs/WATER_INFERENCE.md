# LUMOS-Water Inference and Validation v1.9

## Posterior model

Compatible recent USGS observations condition a source-aware trend and directional residual Gaussian process. The trend uses the screening prior, source pressure, downstream exposure, flow connectivity, monitoring density, flow position, and approximate branch. Conductance, turbidity, and discharge use a logarithmic transform; other indicators use native units.

The residual kernel is Matérn 3/2 with separate along-flow and cross-flow scales plus an approximate branch penalty. Flow orientation and branch labels are screening proxies derived from mapped geometry unless authoritative topology is supplied.

## Sample thresholds

- Three observations: posterior conditioning.
- Six observations: covariance calibration and robustness analysis.
- Eight observations: deterministic locked validation.

## Validation

Calibration uses spatial development cross-validation over correlation length, observation noise, and flow regime. The locked set is selected deterministically across branch and spatial strata and remains outside calibration.

LUMOS reports MAE, RMSE, bias, R², 95% interval coverage, and group errors. Comparators are isotropic GP, screening prior, source-aware trend, inverse-distance, and nearest station.

## Robustness

The Water robustness lab evaluates multiple locked seeds, flow regimes, direction offsets, station loss, reliability filtering, provisional-reading removal, doubled noise, source-proxy neutralization, and branch-proxy removal.

## Interpretation

Posterior values are modeled estimates, not measurements. Validation measures reconstruction within the available observation set; it does not validate a hydraulic model, connected network routing, potability, compliance, or public-health safety.
