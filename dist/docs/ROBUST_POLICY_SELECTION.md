# LUMOS v2.4 Trajectory Uncertainty and Robust Policy Selection

LUMOS v2.4 evaluates the seven v2.3 multi-round funding trajectories under a reproducible ensemble of uncertain evidence response, deployment cost, unit failure, and environmental conditions. The layer is above the domain-specific placement and posterior models. It does not replace Heat, Air, Soil, or Water physics and does not reinterpret their raw units as interchangeable.

## Purpose

A deterministic trajectory can appear strongest under one central assumption while becoming fragile under cost escalation, failures, slower learning, or changing environmental conditions. The v2.4 ensemble therefore reports four distinct decision views:

- risk-adjusted robust recommendation;
- highest expected utility;
- minimum maximum regret;
- highest feasibility probability.

These labels may identify the same policy or different policies.

## Three response anchors

For the active evidence bundle and multi-round configuration, LUMOS first runs the complete v2.3 simulator under conservative, central, and optimistic evidence-response assumptions. Every ensemble member receives a seeded response position and interpolates between the adjacent anchors. This preserves the actual v2.3 allocation and evidence-transition behavior at the anchor points.

## Scenario ensemble

For ensemble member \(\omega\) and domain \(d\), LUMOS draws correlated standard-normal shocks and constructs:

\[
C_{d,\omega}=\exp\left(-\frac{\sigma_d^2}{2}+\sigma_d z^{C}_{d,\omega}\right),
\]

where \(C_{d,\omega}\) is a multiplicative deployment-cost factor and \(\sigma_d\) combines the displayed cost uncertainty with the domain registry's cost scale.

The effective failure fraction is

\[
F_{d,\omega}=\operatorname{clip}\left(f_0 a_d\exp(0.45z^{F}_{d,\omega}),0,0.65\right),
\]

where \(f_0\) is the displayed expected failure rate and \(a_d\) is the domain-specific failure sensitivity.

Environmental-condition stress is

\[
E_{d,\omega}=\operatorname{clip}\left(1+\sigma_E b_d z^{E}_{d,\omega},0.45,1.90\right),
\]

where \(b_d\) is the domain-specific environmental sensitivity. The displayed cross-domain correlation controls the mixture of shared and domain-specific shocks.

The default registry values are planning assumptions. They are not universal empirical constants.

## Stressed outcomes

For each trajectory, LUMOS applies the member's domain cost multipliers to its round-by-domain unit program. Failure stress reduces realized information, reliability, intervention readiness, and worst-domain benefit. Environmental stress increases residual need and can increase the cross-domain balance gap. A trajectory is scenario-feasible only when its anchor path is complete and stressed deployment cost remains within the protected allocatable budget.

Each policy receives a raw scenario utility from discounted information benefit, terminal residual need, evidence strength, reliability, intervention readiness, worst-domain benefit, balance, cost, overrun, and completion. Utilities are normalized within each member so policy comparisons do not depend on an arbitrary global scale.

## Robust summaries

For policy \(p\), LUMOS reports:

- expected normalized utility \(\mathbb{E}[U_p]\);
- median utility;
- 10th-percentile utility \(Q_{0.10}(U_p)\);
- lower-tail conditional mean (CVaR-like 10% summary);
- worst ensemble utility;
- feasibility probability;
- expected and maximum regret;
- expected and 90th-percentile cost;
- expected residual need, reliability, and failure rate.

Scenario regret is

\[
R_{p,\omega}=\max_q U_{q,\omega}-U_{p,\omega}.
\]

The displayed robust score combines expected utility and downside summaries using the displayed risk-aversion value. It also penalizes expected regret. The risk-aversion control changes decision preference, not the underlying ensemble members.

## Important algorithm boundary

The ensemble reruns the complete v2.3 simulator at the three response anchors. Within each anchor interval, it evaluates cost, failure, and environmental outcome stress without re-solving every decision after every random draw. Therefore it is a robust policy-evaluation layer, not a proof of an optimal stochastic-control policy.

## Reproducibility

The default release uses:

- 64 ensemble members;
- seed 240401;
- 24% evidence-response uncertainty;
- 15% deployment-cost uncertainty;
- 8% expected unit-failure rate;
- 18% environmental-condition uncertainty;
- 40% cross-domain shock correlation;
- 0.60 risk aversion.

`npm run robust:program` writes:

- `data/examples/robust-policy-ensemble.json`;
- `data/examples/robust-policy-ensemble.csv`.

The stable checksum excludes generation time.

## Claim boundary

Ensemble frequencies are reproducible planning draws, not calibrated forecast probabilities, statistical confidence intervals, causal estimates, vendor quotations, regulatory recommendations, or guarantees of future monitoring performance. Operational use requires local cost distributions, failure histories, environmental scenarios, and evidence-response calibration.

## v2.5 downstream spatial translation

A selected robust funding trajectory can inform domain unit counts, but it does not determine physical sites. The v2.5 spatial planner is a separate downstream layer that tests coordinated host assignments and shared-infrastructure tradeoffs under domain-specific constraints. Robust trajectory labels do not transfer automatically to a spatial portfolio, and spatial savings do not retroactively change the robust ensemble unless a new funding analysis is run.
