# Changelog

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
