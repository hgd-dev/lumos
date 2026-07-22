# LUMOS Core Model Specification v0.1

**LUMOS** stands for **Localized Unified Monitoring Optimization System**.

This file defines the domain-independent layer shared by the future Heat, Air, Soil, and Water adapters. Version 0.1 is an executable structural prototype. It uses nonlinear measurement influence and multi-objective network scoring; the next scientific milestone replaces its information proxy with posterior epistemic-variance reduction from a probabilistic field model.

## 1. Continuous environmental field

For domain \(d\), environmental condition is a latent field

\[
Z_d(s,t), \qquad s \in \Omega,\; t \in T.
\]

The model is conceptually continuous. Numerical evaluation uses a dense or adaptive point set \(V=\{s_i\}\), while installation is restricted to feasible candidate sites \(C=\{c_j\}\). The visualization gradient is separate from both.

Each evaluation point contains standardized layers:

- \(r_i\): predicted environmental risk;
- \(u_i\): reducible epistemic uncertainty;
- \(p_i\): dynamic human presence or exposure;
- \(v_i\): vulnerability priority;
- \(q_i\): community-designated priority;
- \(e_i\): ecological importance;
- \(g_i\): social or geographic group membership.

Each candidate site contains:

- installation cost \(c_j\);
- feasibility probability \(f_j\);
- operational reliability \(\rho_j\);
- sensor type and calibration properties in later versions.

## 2. Domain adapter

The global engine receives a domain-specific influence function

\[
a^{(d)}_{ij,t}=K_d(s_i,c_j,t;\theta_d) \in [0,1].
\]

The adapters ultimately use:

- **Heat:** surface covariance, canopy, imperviousness, urban morphology, time of day;
- **Air:** pollutant-specific atmospheric transport, wind, source geometry, street canyons, calibration;
- **Soil:** local covariance, land-use history, contamination pathways, depth and soil similarity;
- **Water:** pipe, watershed, service-zone, hydraulic, and upstream/downstream connectivity.

Version 0.1 demonstrates radial, morphology-aware, anisotropic, local-similarity, and flow-oriented proxy kernels.

## 3. Expected effective observation

For selected network \(S\), the expected observation of point \(i\) is

\[
P_i(S)=1-\prod_{j\in S}\left(1-a_{ij}f_j\rho_j\right).
\]

This nonlinear saturation means additional nearby monitors yield declining benefit rather than unlimited geometric coverage.

## 4. Shared objective components

Version 0.1 calculates normalized terms:

\[
I(S)=\frac{\sum_i u_iP_i(S)}{\sum_i u_i}
\]

\[
H(S)=\frac{\sum_i r_iP_i(S)}{\sum_i r_i}
\]

\[
E(S)=\frac{\sum_i r_ip_iP_i(S)}{\sum_i r_ip_i}
\]

\[
Q(S)=\frac{\sum_i r_ip_i(0.2+v_i)P_i(S)}{\sum_i r_ip_i(0.2+v_i)}
\]

\[
C(S)=\frac{\sum_i (0.05+q_i)P_i(S)}{\sum_i(0.05+q_i)}
\]

\[
G(S)=\frac{\sum_i (0.05+e_i)P_i(S)}{\sum_i(0.05+e_i)}.
\]

The current information term \(I(S)\) is an uncertainty-weighted observation proxy. The planned Bayesian version is integrated epistemic variance reduction:

\[
I_{\mathrm{Bayes}}(S)=
\int_T\int_\Omega w(s,t)
\left[\sigma_{0,\mathrm{ep}}^2(s,t)-\sigma_{S,\mathrm{ep}}^2(s,t)\right]dsdt.
\]

## 5. Social information fairness

For group \(g\), remaining weighted uncertainty is

\[
L_g(S)=
\frac{\sum_{i:g_i=g}u_i\left(1-P_i(S)\right)\omega_i}
{\sum_{i:g_i=g}\omega_i},
\]

where \(\omega_i\) includes exposure and vulnerability.

The v0.1 disparity measure is

\[
F_{\mathrm{gap}}(S)=\max_g L_g(S)-\min_g L_g(S).
\]

Later releases will support hard requirements \(L_g(S)\leq \tau_g\), worst-group minimization, rural representation, and Pareto-front reporting.

## 6. Redundancy, cost, and reliability

Let

\[
M_i(S)=\sum_{j\in S}a_{ij}f_j\rho_j.
\]

Then redundancy is

\[
R(S)=\frac{1}{|V|}\sum_i\max(0,M_i(S)-1)^2.
\]

Expected network reliability is

\[
Y(S)=\frac{1}{|S|}\sum_{j\in S}f_j\rho_j.
\]

Normalized cost is

\[
K(S)=\frac{\sum_{j\in S}c_j}{|S|c_{\mathrm{reference}}}.
\]

## 7. Current scalar objective

The executable prototype solves

\[
\max_S J(S)=
 w_I I(S)+w_HH(S)+w_EE(S)+w_QQ(S)+w_CC(S)+w_GG(S)+w_YY(S)
 -w_RR(S)-w_FF_{\mathrm{gap}}(S)-w_KK(S).
\]

subject to monitor count and optional minimum-separation constraints.

The final framework will prefer goal constraints and Pareto solutions over relying exclusively on a scalar weighted sum.

## 8. Solver v0.1

1. Greedy marginal-gain construction.
2. Minimum-distance feasibility filtering.
3. Single-swap local improvement until convergence or pass limit.
4. Comparison against random, space-filling, hotspot, and uncertainty baselines.

Future benchmark solvers:

- Gaussian-process mutual-information greedy;
- A-optimal and D-optimal design;
- pivoted Cholesky and Nystrom approximations;
- exact mixed-integer formulations on small cases;
- continuous sparse-GP placement;
- NSGA-II or comparable Pareto optimization;
- robust scenario and sequential active-learning policies.

## 9. Planned branch structure

The shared model remains above four domain branches:

```text
Continuous latent environmental field
        + shared social layers
        + shared operational layers
                    |
            LUMOS Core Engine
                    |
        +-----------+-----------+-----------+
        |           |           |           |
      Heat         Air         Soil        Water
  surface model  transport   local field  flow network
```

Each mode remains a tab in one map-based LUMOS application, rather than becoming a separate product.
