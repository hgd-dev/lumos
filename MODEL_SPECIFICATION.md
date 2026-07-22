# LUMOS Core Model Specification v0.2

**Localized Unified Monitoring Optimization System**

Version 0.2 defines the first executable Bayesian core shared by the Heat, Air, Soil, and Water branches. It uses a continuous latent-field interpretation, dense numerical evaluation points, discrete feasible installation candidates, existing observations, domain-aware covariance, and socially weighted sequential Bayesian experimental design.

## 1. Spatial objects

For environmental domain \(d\), the true condition is a latent field

\[
Z_d(s,t), \qquad s\in\Omega,\ t\in T.
\]

The browser approximates the spatial domain using three separate objects:

1. **Evaluation points** \(V=\{s_i\}_{i=1}^n\), used for integration and performance measurement.
2. **Candidate sites** \(C=\{c_j\}_{j=1}^m\), where installation is physically feasible.
3. **Visualization surface**, a smooth map rendering that does not define the optimization resolution.

Each evaluation point stores normalized layers:

- \(r_i\): predicted environmental risk;
- \(u_i\): initial epistemic uncertainty scale;
- \(p_i\): human presence or exposure;
- \(v_i\): vulnerability priority;
- \(q_i\): community-designated priority;
- \(e_i\): ecological importance;
- \(g_i\): social or geographic group.

Each candidate site stores:

- cost \(c_j\);
- feasibility \(f_j\);
- reliability \(\rho_j\);
- measurement-noise parameters;
- domain covariates used by the covariance adapter.

## 2. Gaussian-process field model

The latent field is represented as

\[
Z_d(s)\sim\mathcal{GP}\!\left(\mu_d(s),K_d(s,s')\right).
\]

The current executable focuses on posterior covariance because hypothetical future measurements change expected uncertainty before their values are known.

The covariance is

\[
K_d(a,b)=\sigma(a)\sigma(b)\,M_{3/2}\!\left(D_d(a,b)\right)\,S_d(a,b),
\]

where

\[
M_{3/2}(z)=(1+\sqrt{3}z)e^{-\sqrt{3}z},
\]

\(D_d\) is a domain-specific normalized distance, \(S_d\) is a contextual-similarity kernel, and

\[
\sigma(a)=0.16+0.84u(a).
\]

Current domain adapters use:

- **Core:** isotropic geographic distance;
- **Heat:** geographic distance multiplied by built-form similarity;
- **Air:** symmetric wind-axis anisotropy with longer correlation along transport;
- **Soil:** short-range distance multiplied by land-class similarity;
- **Water:** flow-axis anisotropy plus a network-branch distance proxy.

These are shared-interface demonstration kernels. Later domain releases will replace them with calibrated or physics-derived structures.

## 3. Existing observations

Let existing observations occur at sites \(O=\{o_l\}_{l=1}^h\). Their measurement covariance is

\[
K_{OO}^{y}=K_{OO}+\Sigma_{\epsilon,O}.
\]

The effective noise variance for site \(j\) is

\[
\sigma_{\epsilon,j}^2=
\frac{\sigma_{\mathrm{base}}^2+\sigma_{\mathrm{sensor},j}^2}
{\max(\rho_j f_j,\varepsilon)}.
\]

Before optimizing new sites, LUMOS conditions all field and candidate covariances on existing observations:

\[
K_{AB\mid O}=K_{AB}-K_{AO}(K_{OO}^{y})^{-1}K_{OB}.
\]

The baseline posterior variance at evaluation point \(i\) is therefore

\[
\sigma_{i,0}^2=K_{ii\mid O}.
\]

## 4. Sequential posterior update

Suppose selected sites are \(S\), and candidate \(j\notin S\) is considered next. Its conditional measurement variance is

\[
v_{j\mid S}=K_{jj\mid O,S}+\sigma_{\epsilon,j}^2.
\]

The expected variance reduction at evaluation point \(i\) is

\[
\Delta\sigma_{i,j\mid S}^2=
\frac{K_{ij\mid O,S}^2}{v_{j\mid S}}.
\]

After selecting \(j\), LUMOS performs the rank-one update

\[
\sigma_{i,S\cup\{j\}}^2=
\sigma_{i,S}^2-
\Delta\sigma_{i,j\mid S}^2.
\]

All remaining candidate and evaluation-to-candidate covariances are updated with the same Schur-complement step. This gives an efficient browser implementation related to sequential GP conditioning and pivoted covariance factorization.

## 5. Socially weighted information objectives

For nonnegative weights \(w_i\), normalized integrated variance reduction is

\[
\mathcal I_w(S)=
\frac{\sum_i w_i\left(\sigma_{i,0}^2-\sigma_{i,S}^2\right)}
{\sum_i w_i\sigma_{i,0}^2}.
\]

Version 0.2 evaluates:

### Global information

\[
I(S)=\mathcal I_1(S).
\]

### Risk-weighted information

\[
H(S)=\mathcal I_{0.05+r_i}(S).
\]

### Exposure-weighted information

\[
E(S)=\mathcal I_{0.02+r_ip_i}(S).
\]

### Vulnerability-weighted information

\[
Q(S)=\mathcal I_{0.02+r_ip_i(0.2+v_i)}(S).
\]

### Community-priority information

\[
C(S)=\mathcal I_{0.05+q_i}(S).
\]

### Ecological information

\[
G(S)=\mathcal I_{0.05+e_i}(S).
\]

These terms value information gained in socially or environmentally consequential areas rather than equating value with geometric proximity alone.

## 6. Group information quality

For group \(g\), define its remaining normalized epistemic loss as

\[
L_g(S)=
\frac{\sum_{i:g_i=g}\omega_i\sigma_{i,S}^2}
{\sum_{i:g_i=g}\omega_i\sigma_{i,0}^2},
\]

where

\[
\omega_i=0.1+p_i(0.35+0.65v_i).
\]

The current disparity diagnostic is

\[
F_{\mathrm{gap}}(S)=\max_gL_g(S)-\min_gL_g(S),
\]

and worst-group information loss is

\[
F_{\mathrm{worst}}(S)=\max_gL_g(S).
\]

The interface accepts a target \(\tau_F\). Version 0.2 adds a sharply increasing penalty when

\[
F_{\mathrm{gap}}(S)>\tau_F.
\]

This is not yet a proof of hard feasibility. A later constrained solver will enforce group bounds directly and report infeasibility when no network under the budget can satisfy them.

## 7. Reliability, cost, and redundancy

Expected network reliability is

\[
Y(S)=\frac{1}{|S|}\sum_{j\in S}\rho_jf_j.
\]

Normalized cost is

\[
K(S)=\frac{\sum_{j\in S}c_j}{1.25|S|}.
\]

Because GP variance reduction already has diminishing returns for correlated measurements, redundancy is partly intrinsic. LUMOS additionally reports mean squared pairwise latent correlation:

\[
R(S)=\frac{1}{\binom{|S|}{2}}
\sum_{j<k}
\left(
\frac{K_{jk\mid O}}
{\sqrt{K_{jj\mid O}K_{kk\mid O}}}
\right)^2.
\]

## 8. Current acquisition objective

At each sequential step, candidate \(j\) is scored by the resulting network objective

\[
\begin{aligned}
J(S)=
&\;w_I I(S)+w_HH(S)+w_EE(S)+w_QQ(S)\\
&+w_CC(S)+w_GG(S)+w_YY(S)\\
&-w_RR(S)-w_F\Phi(F_{\mathrm{gap}}(S),\tau_F)-w_KK(S),
\end{aligned}
\]

where

\[
\Phi(F,\tau)=F+7.5\max(0,F-\tau)^2.
\]

The greedy rule is

\[
j^*=\arg\max_{j\in C\setminus S}J(S\cup\{j\}),
\]

subject to feasibility and optional minimum-separation requirements.

## 9. Baselines

Every run evaluates the same posterior-variance and social metrics for:

- LUMOS Bayesian sequential selection;
- random feasible placement;
- uniform farthest-point placement;
- highest local risk;
- highest initial local uncertainty.

The research version will add serious Bayesian-design baselines including A-optimality, D-optimality, mutual information, pivoted Cholesky, exact small-instance optimization, and equity-aware constrained placement.

## 10. Shared-to-domain architecture

```text
Continuous latent field and standardized layers
                    |
Existing observations and sensor characteristics
                    |
Shared Bayesian posterior and social metrics
                    |
Shared constrained / Pareto solver family
                    |
      +-------------+-------------+-------------+
      |             |             |             |
    Heat           Air           Soil          Water
 morphology     transport     local/depth    graph/flow
 covariance     covariance     covariance     covariance
```

All four domains remain visible as modes in one map application. Incremental MVP releases change the data and physical adapter beneath the shared core rather than creating separate products.

## 11. Next mathematical upgrades

1. Learn or validate kernel hyperparameters from held-out observations.
2. Separate epistemic and aleatoric uncertainty explicitly.
3. Add hard group, geographic, rural, calibration, and uptime constraints.
4. Generate Pareto-optimal networks instead of only a scalar solution.
5. Add robust optimization under source, weather, demand, and failure scenarios.
6. Add temporal covariance, staged budgets, and adaptive relocation.
7. Optimize statistical power for intervention, control, boundary, and spillover monitoring.
