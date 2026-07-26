# LUMOS Model Specification

## Stable public architecture

LUMOS is one shared environmental-monitoring design and operations framework with four scientific adapters: Heat, Air, Soil, and Water. The shared layers govern probabilistic reconstruction, uncertainty reduction, social-information constraints, portfolio optimization, intervention evaluation, budget allocation, operational feasibility, persistence, evidence export, and release auditing. Each adapter retains its own observations, units, covariance or transport structure, validation protocol, intervention roles, siting rules, and commissioning requirements.

The central research framing is:

**Socially Constrained Sequential Bayesian Environmental Monitoring Design**

LUMOS incorporates established sensor-placement, Gaussian-process, Bayesian experimental-design, fairness-aware placement, robust optimization, adaptive sampling, and BACI-style evaluation methods. The contribution is their explicit integration with group-level information quality, environmental risk and exposure, community and ecological priorities, heterogeneous monitoring systems, operational feasibility, sequential funding, field review, commissioning, and maintenance.

## Continuous environmental field

For domain \(d\), location \(s\), and time \(t\), the latent environmental state is

\[
Z_d(s,t) \mid \mathcal D \sim \mathcal P\left(\mu_d(s,t),\sigma_d^2(s,t)\right).
\]

The application separates evaluation points, feasible candidate locations, and the rendered visualization surface. Administrative polygons may supply covariates but are not treated as physically uniform cells.

The Gaussian posterior is evaluated using Cholesky factorization and triangular solves:

\[
\mu_*(s)=\mu_0(s)+K_{*O}(K_{OO}+\Sigma_\epsilon)^{-1}(y_O-\mu_O),
\]

\[
\sigma_*^2(s)=K_{**}-K_{*O}(K_{OO}+\Sigma_\epsilon)^{-1}K_{O*}.
\]

The principal information objective is weighted epistemic-variance reduction:

\[
I(S)=\int w(s,t)\left[\sigma_{0,\mathrm{ep}}^2(s,t)-\sigma_{S,\mathrm{ep}}^2(s,t)\right]ds\,dt.
\]

## Shared constrained objective

A generalized monitoring portfolio \(S\) is evaluated using

\[
J(S)=w_I I_{\mathrm{global}}+w_H I_{\mathrm{risk}}+w_E I_{\mathrm{exposure}}+w_Q I_{\mathrm{equity}}+w_C I_{\mathrm{community}}+w_G I_{\mathrm{ecology}}+w_Y R-w_R D-w_F G-w_K C.
\]

Here \(R\) is reliability, \(D\) is redundancy, \(G\) is the group-information disparity, and \(C\) is deployment and maintenance cost. Hard constraints include budget, candidate feasibility, spacing, existing-site exclusion, group information floors, reliability, calibration or collocation requirements, permissions, power, access, maintenance, safety, and domain-specific operational rules.

For group \(g\), the information-quality loss is

\[
L_g(S)=\frac{\int P_g(s,t)\sigma_{S,\mathrm{ep}}^2(s,t)\,ds\,dt}{\int P_g(s,t)\,ds\,dt}.
\]

LUMOS may enforce \(L_g(S)\leq\tau_g\), a minimum worst-group information gain, or a maximum disparity \(\max_g L_g-\min_g L_g\leq\epsilon\).

## Commissioning and maintenance operations

The operations layer evaluates each current assignment \(i\) using the latest append-only commissioning event available at analysis time \(T\). The event state includes procurement, permit, installation, calibration or chain-of-custody, operational status, uptime, data completeness, preventive maintenance, and ticket fields.

Let \(a_i(T)\) be the latest valid event for assignment \(i\). A commissioned assignment requires:

\[
\mathrm{Ready}_i(T)=F_i\,P_i\,I_i\,C_i\,O_i\,U_i\,D_i,
\]

where \(F_i\) is field-operational status, \(P_i\) is procurement and permit readiness, \(I_i\) is successful installation, \(C_i\) is the domain-specific calibration or chain-of-custody condition, \(O_i\) is an online operational state, \(U_i\) is the uptime-floor indicator, and \(D_i\) is the data-completeness-floor indicator.

Assignments meeting all requirements are commissioned. Assignments with valid prerequisites but a bounded quality exception are provisional. Critical permit, procurement, installation, calibration, chain-of-custody, or availability failures are offline or blocked.

For a failed assignment \(i\), replacement candidate \(r\) receives the transparent score

\[
S_{ir}=0.50R_r+0.40Q_r+0.08V_r-0.02\min(5,d_{ir}),
\]

where \(R_r\) is reliability, \(Q_r\) is domain suitability, \(V_r\) indicates verified review status, and \(d_{ir}\) is replacement distance in kilometers. Candidates must satisfy the domain replacement-reliability floor and remain verified or conditional. If no eligible reserve exists, the assignment remains unresolved.

First-year modeled operations cost is

\[
C_{\mathrm{year1}}=C_{\mathrm{commission}}+C_{\mathrm{maintenance}}+C_{\mathrm{replacement}}.
\]

These are editable planning assumptions, not procurement quotations or lifecycle-cost certifications.

## Evidence and public release audit

Every controlled evidence generator uses deterministic seeds or canonical ordering and emits a stable checksum. The internal release-quality audit verifies declared architecture, evidence artifacts, governance documents, accessibility features, static hosting, offline-shell packaging, license, credential boundaries, and scientific limitations and intended-use guidance. It does not certify environmental accuracy, cybersecurity, accessibility conformance, regulatory compliance, or field deployment.

## Limitations and intended use

LUMOS produces monitoring-design recommendations and planning diagnostics. It does not establish that a modeled field is an observation, that a host is deployable, that a power estimate proves causality, that a sampling plan establishes an exceedance, that imported records are authentic, or that any heuristic portfolio is globally optimal unless an exact reduced-instance result is explicitly identified.

---

## Detailed release lineage and domain specifications

The sections below preserve the detailed mathematical and implementation record developed through the v1 and v2 releases.

## v2.8 live field-campaign tracking layer

Let \(E=\{e_1,\ldots,e_m\}\) be an append-only sequence of imported inspection events. Each event identifies a host, phase, outcome, timestamp, reviewer metadata, operational review fields, and an optional superseded event. Events are ordered deterministically by phase, timestamp, and event identifier. A reproducibility chain is

\[
h_i = H(h_{i-1}, e_i), \qquad h_0=\texttt{00000000},
\]

where \(H\) is the stable non-cryptographic release checksum. The chain detects deterministic content changes but is not an identity, signature, or evidence-authentication mechanism.

For completed phase \(t\), the effective host state is the latest event for that host with phase at most \(t\). Accepted hosts remain active, conditional hosts remain provisional, rejected hosts trigger reserve selection, and scheduled hosts without a completed event become overdue. For rejected assignment \((h,d)\), LUMOS activates the highest-ranked unused reserve that remains admissible for domain \(d\), satisfies the live-outcome reliability floor, and is not rejected by a later event.

Conditional assignments receive domain-specific operational credit \(\gamma_d\in[0,1]\). The phase-level effective operational rate is

\[
R_t^{\mathrm{eff}}=\frac{N_t^{\mathrm{active}}+\sum_{a\in A_t^{\mathrm{conditional}}}\gamma_{d(a)}}{|A|}.
\]

Every phase snapshot reports active, provisional, replacement, pending, overdue, and unresolved assignments; activated reserve hosts; verified operational share; and the complete operational-site map. No failed assignment is silently dropped. See `docs/LIVE_CAMPAIGN_TRACKING.md`.

## v2.7 field-campaign operations layer

Let a selected reviewed deployment contain primary hosts \(P\), domain assignments \(A\), and a larger admissible host pool \(H\). For campaign profile \(k\), each host \(h\in P\) receives an inspection priority

\[
q_h^{(k)}=w_N^{(k)}N_h+w_S^{(k)}S_h+w_R^{(k)}(1-r_h)+w_D^{(k)}D_h+w_E^{(k)}E_h,
\]

where \(N_h\) is review need, \(S_h\) is shared-host importance, \(r_h\) is reliability, \(D_h\) is domain criticality, and \(E_h\) is equity representation. With per-phase capacity \(c\) and maximum phase count \(T\), at most \(cT\) ranked hosts are scheduled and phase assignment is deterministic.

For a primary assignment \((h,d)\), an eligible reserve \(b\in H\setminus P\) must satisfy the domain-specific spatial, suitability, access, power, reliability, host-category, and Water-connectivity constraints. Reserve score is

\[
u_{bd}^{(k)}=\alpha_q^{(k)}Q_{bd}+\alpha_r^{(k)}R_b+\alpha_v^{(k)}V_b+\alpha_p^{(k)}P_{bh}+\alpha_e^{(k)}E_b.
\]

The reserve quota for domain \(d\) is \(\lceil \rho n_d\rceil\), bounded by the number of primary assignments, where \(\rho\) is the displayed reserve ratio. A seeded response scenario produces deterministic planning outcomes for scheduled inspections. Rejected assignments activate unused domain-compatible reserves; uninspected or unrecoverable assignments remain explicit gaps.

Campaign evaluation reports inspection completion, reserve coverage, replacement recovery, unresolved assignments, operational resilience, mean reserve reliability, shared-host failure exposure, and modeled campaign cost

\[
C_{\mathrm{campaign}}=c_I N_{\mathrm{inspect}}+c_B N_{\mathrm{reserve}}.
\]

Balanced, Rapid Verification, Coverage Protection, and Resilience First are generated independently and receive Pareto labels only over the displayed campaign metrics. Inspection outcomes are scenario assumptions rather than authenticated field results. See `docs/FIELD_CAMPAIGN_OPERATIONS.md`.

## v2.6 field-feasibility layer

Let \(H\) be an imported candidate inventory and let \(r_h\in\{\text{verified},\text{conditional},\text{unresolved},\text{infeasible}\}\) denote the preserved operational review state of host \(h\). For a selected review policy \(\pi\), the admissible host set is

\[
H_\pi=\{h\in H:r_h\in A_\pi\},
\]

where \(A_\pi\) is the displayed set of accepted review states. Domain feasibility is then evaluated as

\[
F_d(h)=\mathbf 1[h\in H_\pi]\mathbf 1[d\in D_h]\mathbf 1[a_h\ge a_d]\mathbf 1[p_h\ge p_d]\mathbf 1[q_{hd}\ge q_d]\mathbf 1[c_h\notin X_d],
\]

with eligible domains \(D_h\), access \(a_h\), power \(p_h\), domain suitability \(q_{hd}\), and excluded host categories \(X_d\). Denied permission, access, safety, or maintenance makes the record infeasible; denied power additionally excludes Air. The coordinated spatial objective and co-location accounting are unchanged after this admissibility filter.

Missing operational evidence is never converted to verification. Imported records retain reviewer, date, agency, notes, and source provenance in the exported result.

## v2.5 spatially coupled cross-domain deployment

Let \(n_d\) be the funded number of units for domain \(d\), let \(H\) be the controlled host-proxy pool, and let \(x_{hd}\in\{0,1\}\) indicate assignment of domain \(d\) to host \(h\). The coordinated deployment layer satisfies

\[
\sum_{h\in H}x_{hd}=n_d\qquad\forall d,
\]

subject to domain-specific minimum spacing, host suitability, access, power, preferred-host, excluded-host, and maximum co-location constraints. Pairwise sharing is allowed only when the declared compatibility \(q_{de}\) exceeds the displayed threshold.

Independent deployment cost is

\[
C_0=\sum_d n_dc_d.
\]

Modeled shared-infrastructure savings are bounded by each adapter's shareable-cost fraction and the selected host compatibility:

\[
C=C_0-\sum_{h\in H}S_h.
\]

The portfolio objective combines host suitability, spatial coverage, worst-domain representation, equity, reliability, modeled savings, redundancy control, and correlated-failure risk. Five profiles—Coordinated, Maximum Savings, Coverage First, Equity First, and Resilient—are generated separately and filtered for nondominance over the displayed metrics.

The deterministic public example uses a seeded Halton host pool inside the active extent. These points are mathematical siting proxies only. They do not establish ownership, permission, access, power, safety, hydraulic connectivity, or deployment approval. Domain posterior inference and final site verification remain inside the corresponding Heat, Air, Soil, and Water workflows. See `docs/SPATIAL_DEPLOYMENT.md`.

## v2.4 trajectory uncertainty and robust policy selection

For trajectory policy \(p\) and seeded scenario member \(\omega\), LUMOS evaluates stressed multi-round outcomes under correlated evidence-response, cost, failure, and environmental-condition shocks. The scenario utility \(U_{p,\omega}\) combines discounted incremental information, terminal residual need, evidence strength, reliability, intervention readiness, worst-domain benefit, cross-domain balance, stressed cost, budget overrun, and completion. Utilities are normalized within each scenario member before policy comparison.

Scenario regret is

\[
R_{p,\omega}=\max_q U_{q,\omega}-U_{p,\omega}.
\]

The robust portfolio reports expected utility, the 10th percentile, a lower-tail CVaR-like mean, feasibility probability, expected regret, maximum regret, expected cost, and 90th-percentile cost. A risk-aversion parameter interpolates between expected performance and downside protection. Domain-specific cost, failure, and environmental sensitivities remain explicit registry assumptions. See `docs/ROBUST_POLICY_SELECTION.md` for the full algorithm and claim boundary.

## v2.3 multi-round adaptive program simulation

Let \(x_{d,r}\) denote additional units assigned to domain \(d\) in round \(r\), and let the evidence state be \(S_{d,r}=(E_{d,r},N_{d,r},Y_{d,r},R_{d,r},Q_{d,r},H_{d,r})\). The v2.2 sequential allocator is rerun at every round using the updated state and the current round budget.

Each domain registry contract now includes a simulation learning rate \(\ell_d\) and residual-response coefficient \(\rho_d\). With bounded unit response \(g(x_{d,r})\), incremental normalized signal \(G_{d,r}\), transition rate \(\tau\), and scenario multipliers \(s_E,s_N\), the primary transitions are

\[
E_{d,r+1}=E_{d,r}+(1-E_{d,r})\tau\ell_d s_E\left(0.35g(x_{d,r})+0.65G_{d,r}\right),
\]

\[
N_{d,r+1}=N_{d,r}\left[1-\operatorname{clip}\left(\tau\rho_d s_N\left(0.28g(x_{d,r})+0.72G_{d,r}\right),0,0.72\right)\right].
\]

Yield, reliability, equity need, and intervention readiness use bounded shrinkage toward the selected round's modeled state. Seven trajectories are compared: six fixed public profiles and one adaptive profile-selection rule. Trajectory evaluation combines discounted incremental normalized benefit, terminal residual need, evidence strength, reliability, intervention readiness, worst-domain benefit, balance, cost, and completion penalties. Pareto labels apply only to the generated trajectories under the displayed assumptions.

The transition model is deterministic and scenario-based. It does not forecast future observations or estimate causal intervention effects. See `docs/ADAPTIVE_PROGRAM_SIMULATION.md`.

## v2.2 evidence-calibrated sequential reallocation

Let \(n_d^{(0)}\) denote the existing program size in domain \(d\), and let \(a_d\) be the integer number of units purchased in the next round. The final program size is \(n_d^{(1)}=n_d^{(0)}+a_d\), subject to the next-round budget, reserve, domain bounds, and minimum-program requirements.

Each compatible saved workspace produces an evidence record containing observation support, validation support, spatial support, reliability, residual uncertainty, high-vulnerability uncertainty, ecological uncertainty, selected-network metrics when available, and intervention readiness. Multiple records are aggregated by evidence strength. Domains without compatible records retain registry priors.

The evidence-calibrated marginal multiplier is

\[
m_d=\operatorname{clip}\left(1+E_d\lambda\left[\left(0.66+0.94N_d\right)\left(0.72+0.42Y_d\right)-1\right],0.62,1.62\right),
\]

where \(E_d\) is evidence strength, \(N_d\) is residual need, \(Y_d\) is normalized realized yield, and \(\lambda\) is the learning rate. The multiplier changes the saturation scale of the normalized domain response; it does not change environmental measurements or imply causal benefit.

The objective combines final normalized dimensions, incremental normalized dimensions, worst-domain benefit, cross-domain balance, reliability, reserve, cost efficiency, and an exploration term proportional to the evidence gap. Hard floors may be imposed on normalized equity, reliability, intervention readiness, and minimum viable program completion. Exact enumeration is used for the displayed four-domain integer bounds. When every floor cannot be satisfied, LUMOS labels the nearest tested portfolio rather than declaring it feasible.

See `docs/SEQUENTIAL_REALLOCATION.md` for the complete evidence schema, limitations, and intended-use guidance.

## v2.1 cross-domain program-allocation layer

The unified decision stack now includes an integer program-allocation layer above the four scientific adapters. Let \(n_d\) denote the number of planning packages assigned to domain \(d\), \(c_d\) the editable unit cost, \(m_d\) and \(M_d\) the minimum and maximum program sizes, \(B\) the total budget, and \(\rho\) the protected reserve.

\[
\sum_d c_d n_d \le (1-\rho)B.
\]

With the minimum-program safeguard active, \(m_d\le n_d\le M_d\) for every enabled domain. Otherwise, zero is also allowed. The browser enumerates the complete feasible integer product for the displayed four-domain bounds; this is exact for that program-allocation instance, not for all possible procurement, staffing, or geographic siting decisions.

For dimension \(k\), domain response is a transparent normalized saturation curve

\[
r_{dk}(n_d)=q_d a_{dk}\left[1-\exp\left(-\frac{n_d}{s_d\lambda_{dk}}\right)\right],
\]

with declared readiness \(q_d\), potential \(a_{dk}\), saturation scale \(s_d\), and dimension scale \(\lambda_{dk}\). Priority-weighted aggregate dimensions, worst-domain benefit, and the cross-domain balance gap are combined under six profile-specific objectives. All results remain dimensionless planning indices. They do not compare raw temperature, concentration, soil-property, or water-quality units and do not replace domain-specific Bayesian placement.

The allocator, defaults, exports, and exact formulas are documented in `docs/CROSS_DOMAIN_BUDGET_ALLOCATION.md`.

## v2.0 unified architecture contract

LUMOS is one socially constrained sequential Bayesian environmental-monitoring design framework with four public domain adapters. The shared engine owns continuous-field evaluation, posterior epistemic-uncertainty reduction, the ten-term scientific/social objective, hard group-information and reliability constraints, portfolio generation, benchmarks, reduced exact comparison, persistence, and evidence export. Heat, Air, Soil, and Water retain independent source trends, covariance and transport assumptions, observation models, validation protocols, robustness experiments, intervention roles, domain-specific limitations, and intended-use guidance.

`js/config/domain-registry.js` is the machine-readable adapter contract. `js/release/domain-audit.js` verifies registry/model parity, complete objective vectors, public workflow capabilities, scenario types, case-study presets, onboarding, required-source health contracts, systematic fallbacks, intervention roles, and field/inference/transport declarations. The audit checksum is deterministic with respect to the architecture state and is exportable as JSON and tidy CSV. It is an architecture and release-consistency diagnostic, not a substitute for empirical domain validation.

The central novelty remains the integration described as **Socially Constrained Sequential Bayesian Environmental Monitoring Design**. Established placement, Gaussian-process, optimal-design, fairness, robust-optimization, adaptive-sampling, and BACI components must continue to be identified as prior methods rather than inventions of LUMOS.

## v1.9.1 interface and loader invariants

The scientific model is unchanged from v1.9.0. The desktop shell now allocates the viewport dynamically across the header, domain tabs, shared workspace, and a fixed 36 px footer. Both side panels occupy the full workspace row and use independent vertical scrolling; the map no longer imposes a minimum height that can force body-level scrolling. Shared weather acquisition accepts domain-specific progress and cache labels, preserving the Heat implementation while preventing Heat terminology from leaking into Air or Water workflows.

## v1.9 Water posterior inference, validation, and robustness

For a fitted Water extent, each evaluation point stores a screening prior \(m_0(s)\), flow position, approximate branch, connectivity, source pressure, downstream exposure, monitoring density, social vulnerability, and ecological importance. Compatible USGS observations are attached to their nearest evaluation context before inference.

The Water posterior is a source-trend plus residual Gaussian process:

\[
Z(s)=h(s)^\top\beta+\eta(s),
\qquad
\eta\sim\mathcal{GP}(0,K_{\mathrm{water}}).
\]

The trend basis includes the prior indicator, source pressure, downstream exposure, connectivity, monitoring density, flow position, and branch effects. Conductance, turbidity, and discharge are modeled on a \(\log(1+z)\) scale; temperature, dissolved oxygen, and pH remain on their native scales. Ridge regularization stabilizes browser-scale trend estimation.

The directional Matérn-3/2 residual covariance rotates spatial differences into along-flow and cross-flow coordinates:

\[
r_{ij}^2=
\left(\frac{d_{\parallel,ij}}{\ell\,a}\right)^2+
\left(\frac{d_{\perp,ij}}{\ell\,b}\right)^2,
\qquad a>b,
\]

and applies a branch penalty when approximate branch labels differ. The implementation calibrates correlation-length multiplier, measurement noise, and flow regime by spatial development cross-validation. Cholesky factorization and triangular solves are used instead of explicit matrix inversion.

At least three compatible observations are required to condition the Water posterior, six for calibration and robustness screening, and eight for a deterministic locked validation experiment. The locked set is branch- and space-stratified and excluded from calibration. Reconstruction comparisons include:

- LUMOS flow-aware GP;
- isotropic GP;
- unconditioned screening prior;
- source-aware trend only;
- inverse-distance interpolation;
- nearest-station prediction.

Reported diagnostics include MAE, RMSE, bias, \(R^2\), empirical 95% interval coverage, and vulnerability-by-exposure group errors. These metrics assess reconstruction behavior; they do not validate hydraulic routing, compliance, potability, or public-health safety.

The posterior updates Water risk and epistemic uncertainty while preserving the distinction between measured observations, modeled posterior values, derived covariates, and mapped proxies. Flow orientation is inferred from source-to-receptor geometry when possible. Because the current public adapter does not navigate an authoritative connected network, flow direction and branch labels remain transparent screening approximations.

The Water robustness suite reruns the model under multiple locked seeds, isotropic/moderate/strong flow regimes, direction offsets, deterministic station loss, reliability filtering, provisional-reading removal, increased observation noise, source-proxy neutralization, and branch-proxy removal. Every scenario preserves the shared LUMOS objective and social constraints.

Water intervention design allocates treatment, matched-control, branch-linked upstream, branch-linked downstream, and supplemental sites without exceeding the requested count or budget. Indicator-specific effect magnitudes are disclosed planning assumptions. Approximate power remains a BACI-style design diagnostic rather than causal evidence.

The four-case Water evidence suite freezes one protocol across Denver temperature, Houston turbidity, Pittsburgh conductance, and Portland discharge. Controlled benchmark observations are deterministic simulations over public spatial context. The suite evaluates computational reconstruction and decision behavior—not local water quality or regulatory status.

## v1.7 Soil public-release evidence and import-QA layer

Version 1.7 promotes Soil to a public sampling-design domain without changing the shared acquisition objective or feasibility constraints. The import layer now maps each raw record to one of three outcomes: accepted, accepted with warnings and adjusted reliability, or rejected. Checks cover analyte identity, unit compatibility, geographic validity, fitted-extent membership, selected-depth overlap, future or stale dates, duplicate identity/fingerprint, detection-limit treatment, QA flags, and broad plausibility ranges.

For a censored observation reported as a non-detect or less-than value with usable detection limit \(L_i\), LUMOS stores a transparent substituted value \(z_i=L_i/2\) and marks the record as censored. This is a modeling convention, not a claim about the true concentration. Reliability enters the diagonal observation-error matrix, so warnings increase effective noise rather than receiving the same weight as clean records.

The public evidence suite evaluates four fixed property/depth/geography cases under one monitor count, budget, fairness setting, portfolio family, and benchmark family. Controlled benchmark observations are generated deterministically from the public spatial context and held separate from field observations. The suite therefore evaluates reconstruction, uncertainty, decision feasibility, and information-equity tradeoffs under a reproducible protocol; it does not estimate real contamination.

For case \(c\), the export freezes

\[
\mathcal E_c=(X_c,O_c^{\mathrm{sim}},\Theta,S_c^*,B_c,Q_c),
\]

where \(X_c\) is the transformed public context, \(O_c^{\mathrm{sim}}\) is the controlled benchmark sample set, \(\Theta\) is the common protocol, \(S_c^*\) is the selected network, \(B_c\) is the benchmark table, and \(Q_c\) contains feasibility and equity diagnostics. Stable checksums identify the exact exported bundle.



## v1.3 Air robustness and experiment layer

Version 1.3 adds controlled sensitivity and publication experiments around the v1.2 Air posterior. The global design objective, hard fairness constraints, operational constraints, portfolio construction, and scientific benchmarks are unchanged.

For deterministic locked-test seeds \(q\in Q\), LUMOS records

\[
\operatorname{RMSE}_q,\quad \operatorname{MAE}_q,\quad
\widehat c_{95,q},\quad \operatorname{rank}_q(\mathrm{LUMOS}),
\]

so conclusions cannot rely on one favorable monitor split.

The covariance and transport screen evaluates

\[
(
ho,\ell,\sigma_\epsilon)\in
\{\text{isotropic},\text{moderate},\text{strong}\}
\times \mathcal L\times\mathcal N,
\]

where \(
ho\) controls along-wind and cross-wind scaling, \(\mathcal L\) contains correlation-length multipliers, and \(\mathcal N\) contains measurement-noise settings. Each combination is scored by reconstruction error and empirical interval coverage.

Reference-reading robustness evaluates the same inference under complete observations, reference-grade-only observations, removal of low-reliability readings, deterministic observation loss, and increased sensor noise. Candidate-role stress reruns the balanced design after removing each Air role class. The full information, exposure, group-equity, reliability, redundancy, cost, budget, and spacing terms remain active in every candidate-role experiment.

Fairness sensitivity varies the maximum group posterior-uncertainty gap \(\tau_F\) while reporting total information, worst-group information gain, achieved gap, cost, and feasibility. This reveals the information-equity frontier rather than treating one threshold as universally optimal.

Paper bundles freeze transformed inputs and outputs but exclude credentials. The national Air suite uses a controlled browser-scale field for each case while retaining the same Bayesian and social decision architecture.

## v1.1 Air-domain extension

The Air adapter preserves the shared LUMOS optimization problem and supplies a pollutant-specific continuous field, a wind-aware covariance model, source-oriented covariates, optional reference-monitor locations, and Air-specific intervention semantics.

For pollutant \(p\in\{PM_{2.5},PM_{10},NO_2,O_3\}\), each evaluation point stores modeled concentration \(C_p(s)\), pollutant-specific U.S. AQI \(A_p(s)\), exposure \(E(s)\), vulnerability \(V(s)\), traffic-source proximity \(T(s)\), and industrial-source proximity \(I(s)\). The screening risk field is

\[
R_p(s)=0.72\,\operatorname{clip}(A_p(s)/200)+0.18\,S(s)+0.10\,\widetilde C_p(s),
\]

where \(S(s)=0.58T(s)+0.42I(s)\) and \(\widetilde C_p\) is robustly normalized concentration. This is a placement-priority field, not a regulatory compliance classification.

The Air covariance uses the shared Matérn structure after rotating coordinate differences into along-wind and cross-wind axes:

\[
r^2=\left(\frac{d_{\parallel}}{\ell_{\parallel}}\right)^2+\left(\frac{d_{\perp}}{\ell_{\perp}}\right)^2,
\qquad \ell_{\parallel}>\ell_{\perp}.
\]

The prevailing transport angle is computed from the fitted field's wind directions. OpenAQ reference-monitor locations, when supplied through a user key, enter the existing-observation set \(O\) and reduce posterior covariance through the same conditional Gaussian-process equations used by every domain. v1.2 and later condition posterior concentration and uncertainty on compatible recent pollutant values; unavailable or incompatible readings leave the transparent atmospheric-model prior in place.

Air intervention planning defines a target-specific benefit field from traffic, industrial, clean-freight, or background-separation priorities. The evaluation designer then selects treatment, matched-control, boundary, spillover/downwind, and supplemental sites under the same budget and spacing constraints. Its power estimate is a planning diagnostic and not causal proof.

## Shared-model invariance

Air changes the domain adapter and scenario inputs, not the global optimizer. The Bayesian acquisition objectives, group-information constraints, five-profile portfolio, Pareto classification, A-optimality, D-optimality, target mutual information, pivoted Cholesky, exact reduced-instance oracle, and operational feasibility rules remain unchanged.


## v1.0 public-release invariance

Version 1.0 adds deployment, installability, offline-shell support, release metadata, and automated publication checks. These operate outside the scientific state. They do not modify Gaussian-process conditioning, acquisition criteria, social constraints, candidate feasibility, portfolio generation, scientific benchmarks, or intervention-network design.
**Localized Unified Monitoring Optimization System**

Version 1.0 defines the shared constrained decision layer used by the Core, Heat, Air, Soil, and Water modes. Heat now supports two distinct operational workspaces: a viewport-fitted nationwide workflow for any local United States extent and the reproducible New York City validation case study. Both use the same Bayesian design, social constraints, benchmark portfolio, and intervention-network architecture, while retaining explicit differences in data quality and validation status.


## v0.11 release-layer invariance

Version 0.11 adds onboarding, system-health diagnostics, accessibility preferences, preset map extents, and public documentation. These features operate outside the scientific decision state.

Let the complete optimization input be

\[
\mathcal X=(V,C,O,K,W,B,\Gamma),
\]

where \(V\) is the evaluation field, \(C\) the candidate set, \(O\) existing observations, \(K\) the covariance model, \(W\) scientific and social weights, \(B\) operational budgets, and \(\Gamma\) hard constraints. The release-layer settings are

\[
\mathcal U=(\text{tour step},\text{palette},\text{motion preference},\text{health status}).
\]

The optimizer satisfies

\[
S^*=\arg\max_S J(S\mid\mathcal X),
\qquad
\frac{\partial S^*}{\partial \mathcal U}=0.
\]

In particular, changing the visual palette or reduced-motion preference does not alter input values, posterior covariance, social groups, acquisition functions, feasible sets, or selected monitor networks. Preset locations define only a viewport and label; they invoke the same nationwide adapter and solver as a manually selected extent.

The system check is diagnostic. A failed optional check may trigger a documented lower-confidence proxy or visual fallback, but it cannot silently substitute synthetic findings. Required-source failures remain visible and prevent claims that a live nationwide workspace loaded successfully.


## v0.10 live-weather separation and paper-experiment contract

The live-weather layer is intentionally separated from the planning state. Let

\[
Z_i^{P}
\]

denote the environmental field frozen for a planning experiment and let

\[
Z_i^{L}(t)
\]

denote the most recently retrieved current or forecast weather value. Live refreshes update only `live*` display fields:

\[
Z_i^{L}(t_{new}) \leftarrow \operatorname{API}(s_i,t_{new}),
\qquad
Z_i^{P}\text{ unchanged}.
\]

Therefore, an existing selected network satisfies

\[
S^*=\arg\max_S J(S\mid Z^P),
\]

until the user explicitly starts a new planning experiment. LUMOS reports the live/planning discrepancy

\[
D_{mean}=\frac{1}{n}\sum_i\left|T_i^{L}-T_i^{P}\right|,
\qquad
D_{max}=\max_i\left|T_i^{L}-T_i^{P}\right|,
\]

and classifies the field change as minor, moderate, or meaningful. This warning is provenance information; it does not silently reoptimize the network.

### Forecast playback

Hourly frames are downloaded in one batched operation:

\[
\mathcal F=\{Z^L(t_0),Z^L(t_1),\ldots,Z^L(t_H)\}.
\]

The browser animation interpolates between adjacent downloaded frames,

\[
\widetilde Z_i(t;\alpha)=(1-\alpha)Z_i^L(t_h)+\alpha Z_i^L(t_{h+1}),
\qquad \alpha\in[0,1],
\]

for visual continuity only. The interpolated field is not added to the Bayesian training set and does not alter posterior covariance, social constraints, or monitor selection. Wind arrows use the downloaded 10 m wind direction and speed and are likewise a display layer.

### Live refresh cadence

Current conditions may be refreshed manually or on a 15, 30, or 60 minute schedule. The interface counts down to the next refresh and labels the weather timestamp used. Animation may update every second because it uses already downloaded frames; actual data retrieval does not occur every animation frame.

### Paper experiment runner

A paper bundle is

\[
P=(\mathcal C,\Theta,\mathcal R,\mathcal B,\mathcal F_s,H),
\]

where \(\mathcal C\) is the case-study set, \(\Theta\) is the model and constraint state, \(\mathcal R\) contains selected-network results, \(\mathcal B\) contains scientific benchmark results, \(\mathcal F_s\) contains optional fairness-threshold screens, and \(H\) is a deterministic checksum of scientific inputs and outputs.

The fixed national suite uses Phoenix, Denver, Atlanta, and New York. Each case uses the same 64-point evaluation target and systematic-candidate cap, but retains the complete Bayesian objective, hard social constraints, Pareto profiles, A-optimality, D-optimality, target mutual information, pivoted Cholesky, and exact reduced-pool comparison. The fixed resolution supports controlled cross-location comparison and does not imply that 64 points are sufficient for final municipal deployment.

Paper exports contain transformed public inputs, source metadata, settings, selected sites, metrics, constraint audits, benchmark results, and fairness-screen outputs. The checksum changes whenever a scientific input, setting, or result changes; display timestamps are not treated as evidence of independent validation.


## v0.9 nationwide Heat prior

For each viewport evaluation point \(i\), the national adapter receives current apparent temperature \(T_i\), a viewport-relative temperature rank, Census exposure and vulnerability attributes, and an optional Annual NLCD class. The categorical NLCD class is converted into transparent normalized screening covariates:

\[
I_i\in[0,1] \quad \text{impervious-surface tendency},
\]

\[
C_i\in[0,1] \quad \text{tree-canopy tendency},
\]

\[
V_i^{\mathrm{land}}\in[0,1] \quad \text{vegetation intensity},
\]

\[
D_i\in[0,1] \quad \text{developed intensity}.
\]

These are class-derived priors, not direct fractional canopy or impervious observations. The surface-amplification term is

\[
A_i=\operatorname{clip}\!\left(0.46 I_i+0.27(1-C_i)+0.17D_i+0.10E_i-0.10W_i\right),
\]

where \(E_i\) is normalized civilian exposure and \(W_i\) is proximity to sampled open-water or wetland classes. The national Heat-risk prior is

\[
R_i=\operatorname{clip}\!\left(0.58T_i^{\mathrm{abs}}+0.22T_i^{\mathrm{rel}}+0.20A_i-0.05W_i\right).
\]

The land-surface prior changes risk and intervention prioritization supplied to the shared optimizer. It does not replace the conditional Gaussian-process covariance, acquisition functions, fairness constraints, beam search, Pareto portfolio, or scientific benchmarks.

### Land-cover fallback

If Annual NLCD sampling fails or does not cover the fitted area, LUMOS constructs lower-confidence land-surface proxies from Census population exposure. Every affected cell records `landCoverObserved=false` and a lower `landCoverConfidence`; the provenance panel reports the fallback. Missing land cover also increases the prior uncertainty score.

### Intersectional information groups

National cells are assigned a vulnerability quartile \(q_i\in\{0,1,2,3\}\) and an exposure band \(e_i\in\{0,1\}\). The social information group is

\[
g_i=2q_i+e_i.
\]

This creates up to eight groups and allows the worst-group and parity constraints to distinguish, for example, higher-vulnerability lower-density regions from higher-vulnerability high-density regions. It does not assert individual identity; all components remain area-level ACS estimates.

### Domain-aware intervention surfaces

Tree-and-shade priority increases with low canopy, imperviousness, risk, and exposure. Cool-surface priority increases with imperviousness and exposure. Cooling-access priority remains driven by risk, vulnerability, and exposure. The resulting expected temperature contrast is a planning assumption used for monitoring design and power screening, not a causal estimate.

### Case-study export

The national case-study export records the active controls, source and layer provenance, social-group summaries, selected network, hard-constraint audit, benchmark table, and selected-site coordinates. It supports repeatable comparative studies across locations while preserving the distinction between operational national screening and the independently validated NYC inference case.

## v0.8.4 guardrail invariant

For every accepted nationwide run, the optimization model is unchanged. The workload tier may change only the numerical approximation supplied to the model: the number of environmental evaluation samples and the number of candidate sites. It does **not** remove or replace posterior-variance reduction, exposure weighting, vulnerability weighting, community-group information metrics, redundancy, reliability, budget, spacing, fairness constraints, Pareto alternatives, scientific benchmark selectors, or the intervention-evaluation designer.

Let \(q\in\{\text{standard},\text{large},\text{regional}\}\) denote a workload tier. The tier selects numerical sizes \(n_q=|V_q|\) and \(m_q=|C_q|\), while the optimization remains

\[
\max_{S\subseteq C_q} J(S)
\]

under the same social, operational, budget, and reliability constraints defined below. Therefore, a regional run is a coarser spatial approximation of the same decision problem, not a reduced-objective model.

### Candidate construction

A systematic candidate mesh \(C_{\mathrm{sys}}\) is generated across the complete fitted extent using offset rows that approximate hexagonal spacing. Every site is labeled as an unverified planning proxy. Optional mapped facilities \(C_{\mathrm{map}}\) are retrieved asynchronously. Hybrid mode forms

\[
C_{\mathrm{hybrid}}=\operatorname{cap}\!\left(C_{\mathrm{map}}\cup\left\{c\in C_{\mathrm{sys}}: d(c,C_{\mathrm{map}})\geq\delta\right\}\right),
\]

where mapped hosts replace nearby systematic proxies, and `cap` uses deterministic spatially stratified sampling rather than API order. The optimizer receives the resulting candidate set only after each candidate has been assigned local risk, uncertainty, exposure, vulnerability, cost, feasibility, and reliability attributes.

In Hybrid mode, \(C_{\mathrm{sys}}\) is available before the Overpass request begins. A timeout, cancellation, or source failure therefore changes deployment realism but does not prevent the full LUMOS optimization from running.

## Nationwide Heat workspace

For a fitted U.S. viewport \(\Omega_V\), LUMOS constructs a complete live optimization scenario rather than displaying a visual-only weather overlay.

### Geographic scope

Each browser run is bounded to approximately 40,000 km². This controls public-API volume and covariance-matrix size while allowing any local U.S. city, county, or rural region to be modeled. The limit applies to one fitted run, not to the geographic availability of the workspace.

### Evaluation field

The viewport is sampled at a browser-sized lattice of current weather-model locations. The active national Heat prior is the v0.9 multi-source formulation above, combining absolute and relative apparent heat with transparent land-surface amplification and water context.

The operational uncertainty-priority proxy combines local heat-gradient magnitude, viewport-edge priority, missing tract-level social data, and missing land-cover data. It is an acquisition-priority proxy, not a calibrated meteorological forecast variance.

### Social layers

Census tract geometry is queried from TIGERweb and joined to 2024 ACS five-year estimates. Exposure uses log-scaled population density. The area-level vulnerability composite combines normalized poverty, older-adult, young-child, and no-vehicle rates:

\[
v_i=0.45P_i+0.25A_i+0.15Y_i+0.15N_i.
\]

These values are used to evaluate monitoring information quality; they are not individual classifications or health diagnoses.

### Candidate hosts

OpenStreetMap public facilities are queried through Overpass and converted to candidate hosts with transparent type-specific cost, feasibility, and reliability priors. When the returned host inventory is sparse or unavailable, LUMOS augments it with visibly labeled unverified grid siting proxies. Every candidate still requires local permission, technical inspection, and field verification before deployment.

### National intervention proxies

The nationwide workflow supports general heat mitigation, tree/shade, cool-surface, and cooling-access planning targets. Each target defines a normalized intervention-priority field \(b_i\), converted into a planning-only expected effect:

\[
\Delta_i^{\mathrm{plan}}=0.45+2.55b_i\ \text{°F}.
\]

The post-intervention designer then applies the shared treatment/control/boundary/spillover allocation. These expected effects are scenario assumptions, not estimated causal effects.

### Active-extent behavior

A fitted nationwide scenario becomes the active LUMOS model: its cells, tract boundaries, candidate hosts, social layers, portfolio, benchmarks, and post-intervention network replace the prior scenario. User-initiated pan or zoom clears the fitted model so recommendations cannot remain visually attached to the wrong geography. Returning programmatically to the stored fitted extent does not invalidate it.

## NYC geometry and identifier normalization

Before constructing the NYC Heat evaluation field, LUMOS canonicalizes NTA and ZCTA identifiers by trimming, uppercasing, and removing non-alphanumeric separators. The adapter accepts official field-name variants such as `NTA2020`, `NTA_Code`, and `NTACode`. GeoJSON Polygon and MultiPolygon geometries are normalized before point-in-polygon evaluation, including detection of reversed latitude/longitude coordinate pairs within the NYC extent.

The citywide lattice is evaluated only against NTA polygons that successfully join to a heat record. A local interior search then adds a representative evaluation point for any matched narrow or coastal NTA missed by the global lattice. This safeguard preserves source-area representation without treating the administrative polygons themselves as optimization cells.

## 1. Spatial and decision objects

For environmental domain \(d\), the true condition is a latent field

\[
Z_d(s,t), \qquad s\in\Omega,\ t\in T.
\]

The executable keeps three spatial objects separate:

1. **Evaluation points** \(V=\{s_i\}_{i=1}^n\), a dense numerical approximation used for integration and performance measurement.
2. **Candidate sites** \(C=\{c_j\}_{j=1}^m\), locations at which installation is physically and socially feasible.
3. **Visualization surface**, a smooth map rendering that does not define the optimization resolution.

Each evaluation point stores normalized layers:

- \(r_i\): predicted environmental risk;
- \(u_i\): epistemic uncertainty scale;
- \(p_i\): human presence or exposure;
- \(v_i\): vulnerability priority;
- \(q_i\): community-designated priority;
- \(e_i\): ecological importance;
- \(g_i\): social or geographic group.

Each candidate site stores:

- installation cost \(c_j\);
- feasibility status and feasibility score \(f_j\);
- reliability \(\rho_j\);
- measurement-noise parameters;
- domain covariates used by the covariance adapter.

The binary decision variable is

\[
x_j=\begin{cases}
1,&\text{monitor installed at candidate }j,\\
0,&\text{otherwise.}
\end{cases}
\]

and the selected network is \(S=\{j:x_j=1\}\).

## 2. Gaussian-process field model

The latent field is represented as

\[
Z_d(s)\sim\mathcal{GP}\!\left(\mu_d(s),K_d(s,s')\right).
\]

The current executable focuses on posterior covariance because hypothetical future observations alter expected uncertainty before their values are known.

The covariance is

\[
K_d(a,b)=\sigma(a)\sigma(b)M_{3/2}\!\left(D_d(a,b)\right)S_d(a,b),
\]

where

\[
M_{3/2}(z)=(1+\sqrt{3}z)e^{-\sqrt{3}z},
\]

\(D_d\) is a domain-specific normalized distance, \(S_d\) is a contextual-similarity kernel, and

\[
\sigma(a)=0.16+0.84u(a).
\]

Current adapters use:

- **Core:** isotropic geographic distance;
- **Heat:** geographic distance with built-form similarity;
- **Air:** wind-axis anisotropy with longer correlation along transport;
- **Soil:** short-range distance with land-class similarity;
- **Water:** flow-axis anisotropy with a network-branch proxy.

These are interface-compatible demonstration kernels. Domain MVPs will replace them with calibrated, learned, graph-based, or physics-derived covariance and transport structures.

## 3. Existing observations and measurement noise

Let existing observations occur at \(O=\{o_l\}_{l=1}^h\). Their measurement covariance is

\[
K_{OO}^{y}=K_{OO}+\Sigma_{\epsilon,O}.
\]

The effective noise variance for site \(j\) is

\[
\sigma_{\epsilon,j}^2=
\frac{\sigma_{\mathrm{base}}^2+\sigma_{\mathrm{sensor},j}^2}
{\max(\rho_j f_j,\varepsilon)}.
\]

Before optimizing new locations, LUMOS conditions field and candidate covariances on existing observations:

\[
K_{AB\mid O}=K_{AB}-K_{AO}(K_{OO}^{y})^{-1}K_{OB}.
\]

The initial posterior variance at evaluation point \(i\) is

\[
\sigma_{i,0}^2=K_{ii\mid O}.
\]

## 4. Sequential Bayesian update

Suppose sites \(S\) have already been selected and candidate \(j\notin S\) is considered next. Its conditional measurement variance is

\[
v_{j\mid S}=K_{jj\mid O,S}+\sigma_{\epsilon,j}^2.
\]

The expected epistemic-variance reduction at evaluation point \(i\) is

\[
\Delta\sigma_{i,j\mid S}^2=
\frac{K_{ij\mid O,S}^2}{v_{j\mid S}}.
\]

After selecting \(j\),

\[
\sigma_{i,S\cup\{j\}}^2=
\sigma_{i,S}^2-\Delta\sigma_{i,j\mid S}^2.
\]

All candidate and evaluation-to-candidate covariances are updated through the corresponding rank-one Schur complement. This supports repeated conditional design in a static browser without recomputing a full matrix inverse at every step.

## 5. Information objectives

For nonnegative point weights \(w_i\), normalized integrated variance reduction is

\[
\mathcal I_w(S)=
\frac{\sum_i w_i\left(\sigma_{i,0}^2-\sigma_{i,S}^2\right)}
{\sum_i w_i\sigma_{i,0}^2}.
\]

LUMOS reports:

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

These objectives value improved inference, not geometric coverage alone.

## 6. Group-level information quality

For group \(g\), remaining normalized epistemic loss is

\[
L_g(S)=
\frac{\sum_{i:g_i=g}\omega_i\sigma_{i,S}^2}
{\sum_{i:g_i=g}\omega_i\sigma_{i,0}^2},
\]

where

\[
\omega_i=0.1+p_i(0.35+0.65v_i).
\]

Group information gain is

\[
B_g(S)=1-L_g(S).
\]

LUMOS uses two distinct social requirements:

### Information-disparity bound

\[
F_{\mathrm{gap}}(S)=\max_gL_g(S)-\min_gL_g(S)\leq\tau_F.
\]

### Worst-served-group information floor

\[
B_{\min}(S)=\min_gB_g(S)\geq\tau_B.
\]

The first limits inequality between groups. The second prevents a superficially equal network from leaving every group poorly measured.

## 7. Cost, reliability, and redundancy

Expected network reliability is

\[
Y(S)=\frac{1}{|S|}\sum_{j\in S}\rho_jf_j.
\]

Total cost is

\[
K_{\mathrm{raw}}(S)=\sum_{j\in S}c_j.
\]

The normalized cost term used in scalar ranking is

\[
K(S)=\frac{K_{\mathrm{raw}}(S)}{1.25|S|}.
\]

Mean squared pairwise latent correlation is

\[
R(S)=\frac{1}{\binom{|S|}{2}}
\sum_{j<k}
\left(
\frac{K_{jk\mid O}}
{\sqrt{K_{jj\mid O}K_{kk\mid O}}}
\right)^2.
\]

This explicitly reports duplication beyond the diminishing returns already present in posterior variance reduction.

## 8. Hard feasibility set

The v0.4 decision problem searches within

\[
\mathcal F=\left\{S\subseteq C:\begin{aligned}
&|S|\leq k,\\
&K_{\mathrm{raw}}(S)\leq B,\\
&F_{\mathrm{gap}}(S)\leq\tau_F,\\
&B_{\min}(S)\geq\tau_B,\\
&Y(S)\geq\tau_Y,\\
&d(c_j,c_l)\geq d_{\min}\quad\forall j\neq l,\\
&c_j\text{ is feasible}\quad\forall j\in S.
\end{aligned}\right\}.
\]

Budget, site feasibility, and minimum separation are enforced during construction. Social information and mean-reliability requirements are audited on complete candidate networks. The solver returns a network as **feasible** only when every enabled requirement is satisfied.

If the bounded search does not find a feasible network, LUMOS returns the tested network with the lowest normalized violation and labels it as infeasible. It does not silently convert a penalty into a guarantee.

For requirement \(r\), normalized violations take the form

\[
V_r(S)=\left(\frac{\max(0,a_r(S)-\tau_r)}{\tau_r}\right)^2
\]

for upper bounds and

\[
V_r(S)=\left(\frac{\max(0,\tau_r-a_r(S))}{\tau_r}\right)^2
\]

for lower bounds. The diagnostic violation is

\[
V(S)=\sum_rV_r(S).
\]

## 9. Preference-specific objective portfolio

A base scalar score is retained for within-profile ranking:

\[
\begin{aligned}
J_{\theta}(S)=
&\;\theta_I I(S)+\theta_HH(S)+\theta_EE(S)+\theta_QQ(S)\\
&+\theta_CC(S)+\theta_GG(S)+\theta_YY(S)\\
&-\theta_RR(S)-\theta_F\Phi(F_{\mathrm{gap}}(S),\tau_F)-\theta_KK(S).
\end{aligned}
\]

Version 0.4 does not present a single weight vector as the unique answer. It generates five documented preference profiles:

1. **Balanced** — shared scientific, social, operational, and cost priorities.
2. **Maximum information** — emphasizes total field reconstruction.
3. **Exposure protection** — emphasizes risk where people are present.
4. **Equity first** — emphasizes vulnerability, worst-group information, and parity.
5. **Cost efficient** — emphasizes lower cost, reliability, and low redundancy.

Each profile applies a multiplicative preference vector to the user's shared base weights.

## 10. Constrained beam search

Exact mixed-integer or nonlinear optimization is not yet practical for every browser instance. Version 0.4 uses deterministic constrained beam search.

At step \(t\), each retained partial network \(S_t\) is expanded by every candidate satisfying immediate budget, siting, and spacing rules. Candidate expansions are ranked by

\[
A_t(S)=J_{\theta}(S)-P_t(S),
\]

where \(P_t\) is a progressive feasibility-guidance penalty. Social thresholds are relaxed early and approach their exact final values as \(t/k\to1\). The best \(b\) distinct partial networks are retained, where \(b\) is the beam width.

At termination, complete networks are ordered lexicographically:

1. feasible before infeasible;
2. lower total violation among infeasible networks;
3. higher profile score.

This is a bounded heuristic, not a proof of global optimality. Later research versions will compare it against exact small-instance formulations and established Bayesian-design solvers.

## 11. Nondominance filtering

After all profiles are generated, solution \(A\) dominates \(B\) when it is no worse in all of the following and strictly better in at least one:

- global information, maximize;
- exposure-weighted information, maximize;
- worst-group information gain, maximize;
- reliability, maximize;
- group uncertainty gap, minimize;
- total cost, minimize.

The displayed Pareto portfolio is

\[
\mathcal P=\{S\in\mathcal S:\nexists S'\in\mathcal S\text{ that dominates }S\}.
\]

This is a nondominated subset of the generated preference portfolio, not a claim that the complete continuous Pareto frontier has been enumerated.

## 12. Full-scale scientific benchmarks

Every full-scale benchmark receives the same conditioned Gaussian-process design state and must obey the same:

- deployment budget;
- candidate feasibility;
- exclusion around existing observations;
- minimum-distance rule;
- requested maximum monitor count.

The methods optimize their own acquisition criteria. Their completed networks are then evaluated with the same LUMOS information, social, reliability, redundancy, cost, and feasibility metrics. This distinction prevents LUMOS from changing the benchmark objective while still allowing socially meaningful comparison.

### 12.1 A-optimality

The A-optimal benchmark greedily minimizes integrated posterior variance, equivalently maximizing

\[
A(S)=\sum_{i=1}^{n}\left(\sigma_{i,0}^2-\sigma_{i,S}^2\right).
\]

At each step it chooses the feasible candidate with the largest marginal trace reduction.

### 12.2 D-optimality

Let \(K_{SS\mid O}\) be the latent candidate covariance after conditioning on existing observations, and let \(\Sigma_{\epsilon,S}\) contain selected measurement-noise variances. LUMOS reports the normalized log-determinant criterion

\[
D(S)=\frac{1}{2}\log\det\left(
I+\Sigma_{\epsilon,S}^{-1/2}
K_{SS\mid O}
\Sigma_{\epsilon,S}^{-1/2}
\right).
\]

The greedy marginal gain for candidate \(j\) is

\[
\Delta D_j(S)=\frac{1}{2}\log\left(
1+\frac{K_{jj\mid O,S}}{\sigma_{\epsilon,j}^2}
\right).
\]

### 12.3 Target-field mutual information

A deterministic farthest-point procedure selects a representative target set \(T\subset V\). The benchmark maximizes the exact finite-dimensional Gaussian mutual information between selected noisy measurements \(Y_S\) and the target latent field \(Z_T\), conditional on existing observations:

\[
I(Y_S;Z_T\mid Y_O)
=
\frac{1}{2}
\left[
\log\det K_{Y_SY_S\mid O}
-
\log\det K_{Y_SY_S\mid O,Z_T}
\right].
\]

The conditional candidate covariance is

\[
K_{CC\mid O,T}
=
K_{CC\mid O}
-
K_{CT\mid O}
K_{TT\mid O}^{-1}
K_{TC\mid O}.
\]

This is a true mutual-information objective for the finite representative target set. It is not claimed to equal mutual information with an infinite continuous field.

### 12.4 Pivoted Cholesky

The pivoted-Cholesky benchmark begins from the conditioned candidate covariance residual

\[
R^{(0)}=K_{CC\mid O}.
\]

At step \(t\), it selects

\[
j_t=\arg\max_{j\in\mathcal F_t}R_{jj}^{(t)}
\]

and performs the rank-one residual update

\[
R^{(t+1)}
=
R^{(t)}-
\frac{R_{:j_t}^{(t)}R_{j_t:}^{(t)}}{R_{j_tj_t}^{(t)}}.
\]

This produces a fast low-rank covariance approximation baseline. Unlike D-optimality, the pivot criterion does not directly adjust for heterogeneous sensor noise.

### 12.5 Simple operational baselines

LUMOS also retains:

- seeded random feasible placement;
- uniform farthest-point placement;
- highest local prior risk;
- highest initial local uncertainty.

These are not state-of-the-art competitors, but they provide interpretable lower-complexity reference strategies.

### 12.6 Runtime reporting

The executable records wall-clock selection time separately from solution quality. Runtime includes each method's selection procedure but excludes shared scenario generation and most interface rendering. These values are useful for within-device comparisons only; they are not hardware-independent complexity measurements or publication-quality timing benchmarks.

## 13. Exact reduced-pool oracle

City-scale exact enumeration is combinatorial. Version 0.4 therefore constructs a deterministic reduced benchmark pool containing both high-priority and spatially diverse feasible candidates. The default micro-instance uses twelve candidates and selects four monitors.

For reduced pool \(P\) and selection size \(q\), the oracle enumerates every subset

\[
S\subseteq P,\qquad |S|=q,
\]

that satisfies budget, spacing, feasibility, and existing-monitor exclusion. Each subset is evaluated with the balanced LUMOS objective and final constraint audit. The oracle returns the best subset under the same lexicographic ordering used by LUMOS:

1. feasible before infeasible;
2. lowest normalized violation when no feasible subset exists;
3. highest balanced objective.

For heuristic method \(h\), the reported reduced-instance optimality gap is

\[
G_h=J_{\mathrm{oracle}}-J_h\geq0.
\]

The word **exact** applies only to this explicitly displayed reduced pool and selection size. It is not evidence that the full 169-candidate or future city-scale problem has been solved globally.

## 14. Shared-to-domain architecture

```text
Continuous latent field and standardized layers
                    |
Existing observations and sensor characteristics
                    |
Shared Bayesian posterior and social metrics
                    |
Shared hard constraints and preference portfolio
                    |
Nondominance filter and explainable decision audit
                    |
      +-------------+-------------+-------------+
      |             |             |             |
    Heat           Air           Soil          Water
 morphology     transport     local/depth    graph/flow
 covariance     covariance     covariance     covariance
```

All domains remain modes of one map application. Each domain supplies data, covariance, transport, feasible-site, sensor, and intervention adapters beneath the shared decision architecture.

## 15. Remaining mathematical upgrades

1. Separate epistemic, sensor, temporal, and irreducible variability more explicitly.
2. Add calibration, rural, geographic, sensor-mix, and uptime constraints.
3. Add robust optimization across source, weather, demand, and failure scenarios.
4. Add temporal covariance, staged budgets, active learning, and relocation.
5. Optimize statistical power for intervention, control, boundary, and spillover monitoring.
6. Add exact mixed-integer comparisons for larger but still tractable benchmark instances.
7. Compare alternative nonstationary, neural-process, and physics-informed field models.
8. Validate on independent years or monitoring campaigns where available.

## 16. Version 0.5 Heat data adapter

Version 0.5 instantiates the shared LUMOS architecture for a real New York City heat case study while leaving the optimization engine unchanged.

### 16.1 Source neighborhood heat surfaces

For each 2020 Neighborhood Tabulation Area \(n\), the NYC source provides:

\[
T_n^{\mathrm{base}},\qquad
T_n^{\mathrm{control}},\qquad
T_n^{\mathrm{planned}},
\]

representing an observed localized afternoon baseline, a modeled 2050s control scenario, and a modeled 2050s planned tree-action scenario.

The three surfaces are normalized on a **shared temperature scale** rather than independently:

\[
R_n^{(q)}
=
\operatorname{clip}
\left(
\frac{T_n^{(q)}-T_{0.03}}
{T_{0.97}-T_{0.03}},0,1
\right),
\]

where \(q\in\{\mathrm{base},\mathrm{control},\mathrm{planned}\}\), and the quantiles are calculated across all three source surfaces. Shared normalization preserves absolute differences between present and future scenarios.

The source-model intervention benefit is displayed as

\[
B_n^{\mathrm{tree}}
=
\max\left(0,T_n^{\mathrm{control}}-T_n^{\mathrm{planned}}\right).
\]

This is a source-provided planned-action contrast. It is not yet a LUMOS-estimated causal effect.

### 16.2 Fine-grid evaluation rather than administrative optimization cells

NTAs and ZCTAs are used to attach source attributes, but they are not treated as indivisible monitoring cells. LUMOS constructs a dense regular point lattice over the city bounding box and retains only points that fall inside an NTA polygon:

\[
V=\{s_i: s_i\in\Omega_{\mathrm{NYC}}\}.
\]

Each point inherits the source attributes of its containing NTA and ZCTA. This separates:

1. the resolution of the input evidence;
2. the numerical resolution of optimization and integration;
3. the discrete set of feasible installation candidates.

The fine lattice therefore avoids forcing the optimizer to place one abstract sensor per administrative polygon. It does **not**, by itself, create new measured sub-neighborhood information. Later releases must add fine-scale physical covariates and observations.

### 16.3 Social heat layers

For evaluation point \(i\), population exposure is estimated from ZCTA population density:

\[
P_i=\operatorname{norm}\left(\frac{\mathrm{POP100}_{z(i)}}{\mathrm{AREALAND}_{z(i)}}\right).
\]

Heat vulnerability uses the NYC HVI quintile:

\[
V_i=\frac{\mathrm{HVI}_{z(i)}-1}{4}.
\]

The HVI-defined quintile is also used as the current group label for socially disaggregated information-quality auditing where available. Missing HVI values fall back to a transparent exposure-based proxy and borough grouping.

Community priority is initialized as

\[
Q_i=
\operatorname{clip}
\left(
0.12+0.45V_i+0.28P_i+0.15R_i^{\mathrm{base}},0,1
\right).
\]

This composite is a configurable prioritization layer, not a clinical risk score.

### 16.4 Existing temperature observations and prior uncertainty

The official hyperlocal monitoring dataset contains approximately 475 street-level locations with hourly observations. Version 0.5 aggregates records by sensor location and deterministically spatially thins them to a browser-scale conditioning set.

Before GP conditioning, the prior epistemic scale includes an observation-density component:

\[
U_i=
\operatorname{clip}
\left(
0.18
+0.58D_i
+0.16|R_i^{\mathrm{control}}-R_i^{\mathrm{base}}|
+0.08V_i,
0,1
\right),
\]

where \(D_i\) is normalized distance to the nearest retained existing temperature sensor. The Bayesian core then conditions the covariance on those observations as described in Sections 4-6.

Observed temperature values are retained in the scenario metadata, but v0.5 does not yet estimate a posterior mean surface from those values. Existing sensors currently affect design through their locations, reliability, and noise.

### 16.5 Candidate host sites

Candidate sites are compiled from public schools, libraries, and cooling amenities. Each site receives a transparent host-type cost and reliability prior. A deterministic farthest-point procedure spatially thins the combined set to a tractable browser candidate pool while favoring intervention-ready cooling amenities.

These locations are **candidate-host proxies**, not statements that installation is permitted. The feasibility model must later incorporate:

- ownership and permission;
- power and network service;
- sensor height and shade requirements;
- worker access and maintenance;
- security and vandalism risk;
- calibration and collocation requirements.

### 16.6 Live versus reproducible data modes

The Heat tab currently supports:

- **Live official APIs:** browser requests load the latest source responses;
- **Controlled synthetic validation:** deterministic generated data test the optimization engine;
- **Automatic fallback:** required-source failure is reported and causes a synthetic Heat scenario to load.

Live mode supports exploration, but publication-grade experiments must use a versioned cached city package with retrieval timestamps and checksums. This is the next reproducibility upgrade.

## 17. Heat MVP validation boundary

Version 0.5 demonstrates that the shared LUMOS engine can ingest real geography, observations, social data, intervention surfaces, and feasible-site proxies in a static GitHub Pages application.

It does not yet establish that LUMOS predicts urban temperature better than existing models. A publishable Heat study must add held-out reconstruction evaluation, covariance calibration, posterior mean fitting, uncertainty calibration, and stronger fine-scale physical covariates before making performance claims.


## 18. Version 0.6 Heat posterior inference

Version 0.6 uses observed afternoon temperature values to estimate both posterior mean heat and predictive uncertainty. The Heat model is intentionally decomposed into an interpretable trend and a spatial residual process.

### 18.1 Regularized heat trend

For point \(s\), define a feature vector

\[
\phi(s)=\left[
1,
C(s)-0.25,
I(s)-0.60,
P(s)-0.50,
V(s)-0.50,
\left(I(s)-0.60\right)\left(1-C(s)\right)
\right]^\top,
\]

where \(C\) is tree-canopy share, \(I\) is impervious share, \(P\) is exposure, and \(V\) is vulnerability. The source neighborhood baseline is \(T_0(s)\). LUMOS estimates a ridge-regularized adjustment:

\[
\widehat T_{\mathrm{trend}}(s)=T_0(s)+\phi(s)^\top\widehat\beta,
\]

with

\[
\widehat\beta=
\arg\min_\beta
\sum_{l=1}^{h}
\rho_l
\left[
T_l-T_0(o_l)-\phi(o_l)^\top\beta
\right]^2
+\lambda\|D\beta\|_2^2.
\]

Observation reliability \(\rho_l\) weights the fit. The intercept receives weaker regularization than the remaining coefficients. This trend is not interpreted causally; it is a predictive adjustment that supplies an interpretable prior mean for the residual process.

### 18.2 Residual Gaussian process

Trend residuals are

\[
r_l=T_l-\widehat T_{\mathrm{trend}}(o_l).
\]

They are divided by their training root-mean-square scale \(s_r\) and modeled with the shared Heat covariance:

\[
\widetilde r(s)\sim\mathcal{GP}(0,K_{\mathrm{heat}}(s,s')).
\]

For observation covariance

\[
K_{OO}^{y}=K_{OO}+\Sigma_{\epsilon,O},
\]

posterior residual mean and variance at prediction location \(s_*\) are

\[
\mu_r(s_*)=k_{*O}\left(K_{OO}^{y}\right)^{-1}\widetilde r_O,
\]

\[
\sigma_r^2(s_*)=K(s_*,s_*)-k_{*O}\left(K_{OO}^{y}\right)^{-1}k_{O*}.
\]

The final temperature prediction is

\[
\widehat T(s_*)=
\widehat T_{\mathrm{trend}}(s_*)+s_r\mu_r(s_*),
\]

and predictive latent variance is

\[
\widehat\sigma_T^2(s_*)=s_r^2\sigma_r^2(s_*).
\]

The executable uses Cholesky factorization and triangular solves rather than explicit matrix inversion.

### 18.3 Land-cover covariates

The live adapter spatially joins block-group summaries of tree canopy and impervious surface to evaluation points and observations. These values improve sub-neighborhood differentiation relative to the NTA-only source surface, but they remain areal summaries rather than raw image pixels. Missing land-cover values receive transparent fallback estimates derived from the existing scenario layers.

### 18.4 Afternoon observation aggregation

Hyperlocal temperature records are grouped by sensor location for afternoon hours. For site \(l\), the current observation is

\[
T_l=\frac{1}{N_l}\sum_{t\in\mathcal A_l}T_{l,t},
\]

where \(\mathcal A_l\) contains available readings from the selected afternoon interval. Record count is retained for provenance. This aggregation supports a spatial MVP; a later temporal model must preserve date, hour, weather regime, and repeated-measure structure.

## 19. Spatial calibration and held-out validation

### 19.1 Spatial folds

Observations are assigned deterministically to spatial folds from their normalized coordinates. For fold \(f\), LUMOS trains on \(O\setminus O_f\) and predicts \(O_f\). This reduces the optimistic leakage that would result from randomly separating nearby sensors, although it is not a substitute for an independent campaign.

### 19.2 Calibration grid

The current calibration searches a documented finite grid over:

\[
\ell_{\mathrm{mult}}\in\{0.65,0.85,1.05,1.30,1.60\},
\]

\[
\sigma_{\epsilon}\in\{0.02,0.035,0.05,0.075,0.10\}.
\]

For configuration \(\theta\), the selection score is

\[
S(\theta)=
\operatorname{RMSE}_{\mathrm{CV}}(\theta)
+0.35\left|
\widehat c_{0.95}(\theta)-0.95
\right|,
\]

where \(\widehat c_{0.95}\) is empirical coverage of the nominal 95% interval. The selected configuration minimizes \(S\) over the tested grid. This is a transparent browser-scale calibration procedure, not a claim of continuous global hyperparameter optimization.

### 19.3 Reconstruction metrics

For held-out actual values \(y_i\), predictions \(\widehat y_i\), and errors \(e_i=\widehat y_i-y_i\), LUMOS reports

\[
\operatorname{MAE}=\frac{1}{n}\sum_i|e_i|,
\]

\[
\operatorname{RMSE}=\sqrt{\frac{1}{n}\sum_i e_i^2},
\]

\[
\operatorname{Bias}=\frac{1}{n}\sum_i e_i,
\]

\[
R^2=1-\frac{\sum_i e_i^2}{\sum_i(y_i-\overline y)^2}.
\]

The nominal 95% interval is

\[
\widehat y_i\pm1.96\widehat\sigma_i,
\]

with empirical coverage

\[
\widehat c_{0.95}=\frac{1}{n}\sum_i
\mathbf 1\left
y_i\in
[\widehat y_i-1.96\widehat\sigma_i,
 \widehat y_i+1.96\widehat\sigma_i]
\right).
\]

LUMOS also reports mean interval width. A source-only baseline uses the uncorrected neighborhood baseline temperature with a fixed comparison variance.

### 19.4 Socially disaggregated validation

Held-out observations are grouped by available HVI quintile. When HVI is unavailable, vulnerability tiers are used. For each group \(g\), LUMOS reports

\[
\operatorname{MAE}_g,
\qquad
\operatorname{RMSE}_g,
\qquad
\operatorname{Bias}_g.
\]

These diagnostics distinguish equitable *placement objectives* from equitable *predictive performance*. A network can satisfy information-allocation constraints while still producing systematically different errors across groups; both must be evaluated.

## 20. Version 0.6 interpretation boundary

Version 0.6 demonstrates browser-side posterior mean inference, spatial calibration, and group-disaggregated validation on a real-data Heat adapter. It does not yet establish causal canopy effects, temporal transferability, independent external validity, or superiority to specialized urban-heat models. Publication claims must be based on frozen data, preregistered or documented experiments, stronger external validation, and comparisons against appropriate heat-prediction baselines.


## 21. Locked development and test protocol

Version 0.7 separates model development from final held-out evaluation. Let the observed sensor set be

\[
O=O_{\mathrm{dev}}\cup O_{\mathrm{lock}},
\qquad
O_{\mathrm{dev}}\cap O_{\mathrm{lock}}=\varnothing.
\]

Sensors are deterministically stratified by a four-by-four spatial partition and three vulnerability bands. A documented hash rule selects approximately 22 percent of observations for \(O_{\mathrm{lock}}\). The random seed and exact sensor IDs are exported.

Covariance and noise settings are selected only by cross-validation within \(O_{\mathrm{dev}}\). The locked set is evaluated once after settings are fixed. This prevents the final reported test error from becoming another hyperparameter-selection statistic.

After locked evaluation, the public operational map may be refit using all observations. The experiment package records both the development/test protocol and the final fitted map state; paper results must use the locked metrics, not the refitted in-sample performance.

## 22. Locked reconstruction comparisons

Every method predicts the same locked observations.

### 22.1 Source surface

\[
\widehat T_{\mathrm{source}}(s)=T_{\mathrm{source}}(s).
\]

### 22.2 Covariate trend

\[
\widehat T_{\mathrm{trend}}(s)=T_{\mathrm{source}}(s)+x(s)^\top\widehat\beta.
\]

### 22.3 Inverse-distance weighting

\[
\widehat T_{\mathrm{IDW}}(s)=
\frac{\sum_{o\in O_{\mathrm{dev}}}d(s,o)^{-p}T(o)}
{\sum_{o\in O_{\mathrm{dev}}}d(s,o)^{-p}},
\qquad p=2.
\]

### 22.4 Nearest observation

\[
\widehat T_{\mathrm{NN}}(s)=T\left(\arg\min_{o\in O_{\mathrm{dev}}}d(s,o)\right).
\]

### 22.5 LUMOS trend plus residual GP

\[
\widehat T_{\mathrm{LUMOS}}(s)=
T_{\mathrm{source}}(s)+x(s)^\top\widehat\beta+
K_{sO}\left(K_{OO}+\Sigma_\epsilon\right)^{-1}r_O.
\]

The locked comparison reports MAE, RMSE, bias, \(R^2\), and, where available, predictive-interval coverage. LUMOS is not declared superior unless the locked results support that conclusion.

## 23. Reproducible experiment identity

A frozen experiment package contains the complete transformed inputs and research decisions required to reproduce the browser run. Let \(P\) be the canonicalized package after removing non-scientific retrieval and creation timestamps. The experiment checksum is

\[
h=\operatorname{FNV1a}(\operatorname{JSON}_{\mathrm{canonical}}(P)).
\]

The checksum is not a cryptographic security guarantee. Its purpose is change detection and experiment identity: identical transformed inputs and settings produce the same identifier, while a changed field, observation, candidate, split, or model setting changes the identifier.

The package stores:

- transformed evaluation points;
- candidate sites;
- observations and sensor noise;
- boundaries and source metadata;
- development and locked sensor IDs;
- calibration grid result;
- locked model comparisons;
- active model and decision settings.

## 24. Heat intervention evaluation design

For the current Heat case study, the source-provided planned-action contrast defines an expected cooling field

\[
\Delta_T(s)=\max\left(0,T_{\mathrm{control}}(s)-T_{\mathrm{planned}}(s)\right).
\]

LUMOS allocates candidate hosts among five roles.

1. Treatment sites emphasize high \(\Delta_T\), exposure, vulnerability, and uncertainty.
2. Control sites emphasize low \(\Delta_T\) and similarity to treatment baseline heat, exposure, and vulnerability.
3. Boundary sites emphasize transition regions in the modeled benefit field.
4. Spillover sites emphasize low-benefit locations near modeled treatment areas.
5. Supplemental sites fill remaining information and representation gaps.

For treatment feature centroid \(\bar x_T\), a control candidate receives the matching score

\[
M(c)=
\exp\left(-\frac{|T_c-\bar T_T|}{2.5}\right)
\exp\left(-\frac{|P_c-\bar P_T|}{0.25}\right)
\exp\left(-\frac{|V_c-\bar V_T|}{0.25}\right).
\]

The current approximate standard error for a treatment-control contrast is

\[
SE(\widehat\Delta)=
\sigma_r\sqrt{\frac{1}{n_Tm}+\frac{1}{n_Cm}},
\]

where \(n_T\) and \(n_C\) are selected treatment and control sites, \(m\) is the assumed number of repeated measurements per site, and \(\sigma_r\) is assumed residual standard deviation. Approximate two-sided power is calculated from the normal distribution using the expected treatment effect.

This design is BACI-inspired but not yet a complete BACI estimator. Valid causal evaluation still requires actual before and after observations, stable or modeled temporal covariance, defensible controls, intervention timing, and examination of parallel pre-intervention trends.

## 25. Version 0.7 interpretation boundary

Version 0.7 makes the Heat research workflow auditable and materially reduces validation leakage. It does not create an independent future campaign, prove that the source-planned action will cause the modeled cooling, or guarantee that observationally matched controls remove confounding. Claims must distinguish development cross-validation, locked spatial generalization, operational refitting, and causal intervention evaluation.


## 26. Heat sensitivity and robustness analysis

Version 0.8 separates four sources of research sensitivity that should not be hidden inside one preferred model run.

### 26.1 Locked-split sensitivity

For deterministic split seeds \(q\in Q\), LUMOS rebuilds the spatially and vulnerability-stratified development/test partition and evaluates the fixed calibrated model. The reported range

\[
\left[\min_{q\in Q}\operatorname{RMSE}_q,\;\max_{q\in Q}\operatorname{RMSE}_q\right]
\]

measures dependence on the particular locked sensor allocation. This is not a substitute for a temporally independent campaign, but it reveals whether one split produces an unusually favorable conclusion.

### 26.2 Covariance sensitivity

Let \(\ell_0\) and \(\sigma_{\epsilon,0}\) be the development-calibrated length multiplier and measurement-noise setting. LUMOS evaluates

\[
\ell\in\{0.75\ell_0,\ell_0,1.25\ell_0\},\qquad
\sigma_\epsilon\in\{0.75\sigma_{\epsilon,0},\sigma_{\epsilon,0},1.25\sigma_{\epsilon,0}\}.
\]

Every combination is evaluated on the same locked test split. The table reports RMSE, bias, nominal 95% coverage, and interval width. The calibrated setting is not automatically declared robust; its performance must be interpreted relative to neighboring assumptions.

### 26.3 Candidate-host stress

The host stress test constructs one deterministic reduced pool \(C_R\subset C\) and one reduced evaluation field \(V_R\subset V\). It then reoptimizes after applying host-availability scenario \(a\):

\[
C_R^{(a)}=\{c\in C_R:a(c)=1\}.
\]

Scenarios include all hosts, removal of each observed host class, and deterministic 25% and 50% site loss. Because every scenario begins with the same \(C_R\) and \(V_R\), observed changes reflect host availability rather than resampling. The stress test reports information gain, exposure-weighted gain, worst-group gain, equity gap, reliability, cost, score, and feasibility.

### 26.4 Fairness-threshold sensitivity

For maximum group uncertainty-gap thresholds \(\tau\) in a predefined sweep, LUMOS reoptimizes the balanced network on the same reduced field and pool. This produces an empirical tradeoff curve

\[
\tau\mapsto\left(I(S_\tau),\;I_{\min,g}(S_\tau),\;F_{\mathrm{gap}}(S_\tau),\;K(S_\tau)\right).
\]

A stricter threshold is not assumed to improve every social metric, because feasibility, candidate access, minimum group gain, reliability, and budget interact. The table therefore reports both the requested threshold and the actual resulting gap.

### 26.5 Reduced-field interpretation boundary

Host and fairness sweeps use at most 480 deterministic evaluation points and 72 candidate hosts for browser performance. These analyses are screening experiments. The full portfolio and scientific benchmarks continue to use the complete active scenario. Paper claims must label reduced-field results and should rerun important findings offline at full scale when computational resources permit.

## 27. Paper-ready export schema

The paper export is a tidy long-form table. Each row contains at least:

- `table` — analysis family;
- `scenario` — split seed, covariance pair, host-loss scenario, fairness limit, model, or social group;
- `metric` — reported statistic;
- `value` — numeric result;
- `units` — degrees Fahrenheit, proportion, rank, score, cost unit, or coefficient.

Additional columns contain sample sizes, model names, group names, candidate counts, monitor counts, and feasibility. The accompanying JSON bundle stores the complete sensitivity object plus the frozen experiment ID and checksum when available.

## 28. Version 0.8 interpretation boundary

Sensitivity analysis can reveal dependence on selected assumptions, but it cannot prove that untested assumptions are harmless. The split analysis remains spatial rather than temporal, covariance sensitivity is local to a finite grid, candidate-host stress depends on the currently available public host classes, and fairness results depend on the chosen group definition and information-quality metric. These limits must accompany any reported robustness claim.


## 29. Interactive geographic presentation layer

Version 0.8.1 changes the geographic presentation and navigation layer without changing the Bayesian inference, acquisition, fairness, benchmark, validation, intervention, or sensitivity equations. The map now separates three coordinate systems explicitly.

1. **Scientific coordinates:** every live evaluation point, observation, and candidate retains longitude and latitude in addition to normalized model coordinates.
2. **Viewport projection:** MapLibre projects geographic coordinates into screen pixels under the current pan, zoom, bearing, and pitch.
3. **Scientific rendering:** the LUMOS canvas redraws the continuous field, boundaries, observations, candidates, and selected sites at those projected pixels.

For a point with longitude-latitude coordinate $s=(\lambda,\phi)$ and current map camera $M$, the rendered screen point is

\[
p=M(s).
\]

This is only a visualization transform. It does not alter distances, covariance, posterior predictions, acquisition values, constraints, or selected networks. Synthetic scenarios without explicit geographic fields retain a bounded demonstration region and are projected from their normalized coordinates through the scenario bounds.

The basemap supplies contextual roads, buildings, water, land use, and labels from OpenStreetMap-derived vector tiles. These contextual features are not automatically treated as model covariates. A feature becomes part of a scientific domain model only after a domain adapter explicitly ingests, validates, versions, and documents it. This prevents the visual presence of a road, building, or river from being confused with its use in the optimization equations.

The national location system is similarly navigational. Searching or panning to another United States location does not transform the current NYC Heat case study into a national Heat model. The active dataset bounds and the **Fit data** control remain the authoritative geographic extent for the current scientific run.


## 18. National viewport Heat surface

The validated NYC Heat scenario and the rapid viewport Heat layer are separate data products. For a visible map extent

\[
B=(\lambda_W,\phi_S,\lambda_E,\phi_N),
\]

LUMOS generates a bounded browser-sized lattice of at most 72 requested coordinates and retrieves current model values

\[
T(s),\quad T_{app}(s),\quad RH(s),\quad W(s)
\]

from the Open-Meteo GFS/HRRR endpoint. The displayed default field is current apparent temperature \(T_{app}(s)\). Multiple coordinates are batched so the final static GitHub Pages application requires no server or secret key.

The viewport layer is a temporary geographic overlay, not an input to the NYC posterior model. It therefore does not inherit NYC vulnerability, exposure, candidate-host, calibration, or validation claims. Any map movement invalidates the fitted extent and removes the overlay. This prevents a stale weather surface from appearing attached to geography for which it was not requested.

## 19. Double-ended interface states

The executable exposes two planning states:

1. **Intervention planning**, which uses the constrained Bayesian portfolio to place monitors that improve risk, exposure, equity, and uncertainty information before or during intervention prioritization.
2. **Post-intervention evaluation**, which uses the BACI-inspired treatment/control/boundary/spillover designer and its repeated-measurement and residual-variation assumptions.

The right-side portfolio selector changes the displayed network without recomputing the portfolio. Post-intervention mode replaces that selector with the single active evaluation design while retaining validation and comparison evidence below.

## 20. Continuous-field visualization and loading-state contract

The display layer is intentionally separate from the scientific field and optimization model. For an active scalar field value $z_i$ at evaluation locations $s_i$, LUMOS first defines a robust visible range

\[
q_{0.05}=Q_{0.05}(\{z_i\}),\qquad q_{0.95}=Q_{0.95}(\{z_i\}).
\]

Values are clipped to this range and contrast-stretched only for color rendering:

\[
\widetilde z(s)=\operatorname{smoothstep}\left(
\operatorname{clip}\left(
\frac{1}{2}+c\left[
\frac{z(s)-q_{0.05}}{q_{0.95}-q_{0.05}}-\frac{1}{2}
\right],0,1
\right)
\right),
\]

where $c>1$ increases visual separation between low and high values. The displayed continuous surface is produced by inverse-distance interpolation over nearby evaluation points:

\[
\widehat z_{\mathrm{display}}(s)=
\frac{\sum_{i\in N_k(s)}w_i(s)z_i}{\sum_{i\in N_k(s)}w_i(s)},
\qquad
w_i(s)=\left(\lVert s-s_i\rVert^2+\epsilon\right)^{-p}.
\]

This interpolation is a visualization transform only. It does not replace the latent environmental field, posterior prediction, acquisition function, covariance model, social constraints, or candidate-selection calculations. The complete fitted rectangle is rendered so sparse weather samples do not appear as disconnected radial bulbs.

The interface also implements an explicit loading-state contract. Long operations must identify their active stage, expose visible progress, restore controls on completion, and report cancellation or failure rather than appearing frozen. National fitting connects its cancel control to the same `AbortController` used by weather and Census requests. Optional host enrichment remains nonblocking and is represented by a background status notice because Hybrid and Systematic modes already have a valid candidate network.


## 21. Persistence, cache, and reproducibility contract

Version 0.8.6 adds a storage layer around the existing scientific model. It does not alter the latent-field covariance, acquisition functions, objective terms, constraints, benchmark selectors, or intervention equations.

A saved workspace is represented by

\[
W=(S,\Theta,M,D),
\]

where \(S\) is the complete active scenario, \(\Theta\) is the user-visible model and constraint state, \(M\) is the map camera state, and \(D\) is non-scientific runtime diagnostic metadata. The serialized scenario contains evaluation points, observations, candidate sites, boundaries, group definitions, domain metadata, and the systematic candidate backup used for resilient host enrichment.

Restoration applies

\[
\operatorname{restore}(W)\rightarrow(S,\Theta,M)
\]

without rerunning public APIs or changing the original source timestamp. The user may then rerun optimization under exactly the restored inputs. Portfolio outputs are intentionally recomputed rather than treated as immutable evidence because the solver implementation may evolve across releases.

### API cache

For an HTTP request identity \(r\), LUMOS stores a response \(y_r\) with retrieval time \(t_r\) and source-specific time-to-live \(\tau_r\). A cached response is admissible only when

\[
t_{now}-t_r\leq\tau_r.
\]

The request identity includes the HTTP method, full URL, and request body, so two geographic extents or Overpass queries cannot collide. Expired cache entries are not used for modeling. Cache status is reported separately from scientific provenance; a cache hit indicates transport reuse, not a new independent observation.

### Diagnostic separation

Fit runtime, optimization runtime, memory estimates, serialized size, and cache counts are implementation diagnostics. They are excluded from the objective function:

\[
J(S)\not\ni \{t_{fit},t_{solve},m_{heap},b_{workspace},h_{cache}\}.
\]

Candidate enrichment diagnostics similarly report how many systematic and mapped candidates are active, while the optimizer continues to use the candidate attributes and constraints defined elsewhere in this specification.

## v1.1.1 runtime-resilience boundary

The hotfix changes data transport, domain-specific presentation, and cache behavior only. Optional source-feature and reference-monitor services may degrade to explicitly labeled proxies or no-reference conditioning. The conditional Gaussian-process updates, anisotropic Air covariance, social constraints, portfolio objectives, benchmarks, and intervention-design equations are unchanged.


## 22. Air reference-conditioned inference and validation

Version 1.2 extends the Air adapter from location-only conditioning to pollutant-value inference. The atmospheric-composition model remains the prior mean field, denoted by \(m_0(s)\). Compatible current reference observations are standardized to the domain unit and represented as

\[
D_A=\{(s_j,y_j,\sigma_{\epsilon,j}^2,t_j)\}_{j=1}^{n_A}.
\]

Observation reliability is reduced with age and incompatible or excessively stale values are excluded. For gases reported in parts per billion or parts per million, LUMOS applies a documented ideal-gas conversion at the standard reference condition used by the adapter; the source unit and conversion status remain attached to the observation.

### 22.1 Source-aware mean function

The mean model begins with the atmospheric prior and learns a regularized correction from source and social covariates:

\[
\widehat m(s)=m_0(s)+\beta^\top\phi(s),
\]

where \(\phi(s)\) includes traffic proximity, industrial proximity, combined source pressure, downwind source influence, exposure, vulnerability, and wind speed. Ridge regularization prevents unstable corrections when the number of reference measurements is limited.

### 22.2 Wind-aligned residual process

Residuals are standardized and modeled with the shared Matérn Gaussian process. Meteorological wind-from direction is converted into pollutant travel direction, then the residual covariance is stretched farther along transport than across transport.

\[
r^2(s,s')=\left(\frac{d_{\parallel}}{\ell_{\parallel}}\right)^2+\left(\frac{d_{\perp}}{\ell_{\perp}}\right)^2.
\]

The posterior concentration and variance are then

\[
\widehat Z_A(s)=\widehat m(s)+k_{sO}(K_{OO}+\Sigma_\epsilon)^{-1}(y_O-\widehat m_O),
\]

\[
\sigma_A^2(s)=k(s,s)-k_{sO}(K_{OO}+\Sigma_\epsilon)^{-1}k_{Os}.
\]

The posterior field updates the Air risk and epistemic-uncertainty inputs used by the unchanged shared optimizer.

### 22.3 Validation protocol

When at least eight compatible observations are available, LUMOS creates a deterministic spatial locked set. Covariance length, measurement noise, and one of three transport regimes are selected using only the development observations. The locked observations are evaluated once against:

- LUMOS source-aware trend plus residual GP;
- the uncorrected atmospheric-model prior;
- the source-aware trend without GP residuals;
- inverse-distance interpolation;
- nearest-monitor prediction.

Metrics include MAE, RMSE, bias, \(R^2\), empirical 95% interval coverage, and error stratified by vulnerability–exposure group. This is a diagnostic validation of the fitted local field, not a regulatory equivalence claim.

### 22.4 Wind-regime sensitivity

The Air validation panel compares isotropic, moderate-downwind, and strong-downwind covariance regimes under the selected length and noise settings. This prevents directional covariance from being accepted merely because it was hard-coded. The selected regime is the development setting with the best accuracy–calibration score.

### 22.5 Intervention extension

Air post-intervention designs use posterior concentration when available and prioritize downwind spillover locations in addition to treatment, matched-control, and boundary sites. Expected effect size remains scenario-based and must be replaced with intervention-specific prior evidence before operational deployment.


## Air v1.4 public evidence protocol

The Air public release does not modify the shared LUMOS objective, covariance update, social constraints, portfolio profiles, or benchmark definitions. It adds a standardized evidence protocol over four heterogeneous urban cases:

\[
\mathcal C = \{\text{Los Angeles PM}_{2.5},\;\text{Houston O}_3,\;\text{Chicago NO}_2,\;\text{New York PM}_{2.5}\}.
\]

For each case, LUMOS uses the same numerical limits, monitor count, budget, fairness threshold, minimum group-information requirement, reliability requirement, acquisition model, and benchmark family. The suite records:

- transformed spatial and social inputs;
- selected balanced network and feasibility audit;
- information gain, worst-group gain, equity gap, reliability, redundancy, cost, and runtime;
- A-optimal, D-optimal, target-mutual-information, pivoted-Cholesky, and simple baseline comparisons;
- reference-data status and a stable checksum.

The browser public suite omits the full sensitivity lab to keep a four-city run practical. The command-line `npm run paper:air` suite retains the more extensive Air robustness analyses. This is a runtime distinction, not a simplification of the optimization problem used for each selected network.

### Public-evidence boundary

When no OpenAQ key is supplied, results are explicitly categorized as atmospheric-model screening experiments. When compatible reference readings are available, they may condition the posterior and support held-out diagnostics. Neither pathway is represented as a regulatory compliance determination, emissions inventory, or causal health-effect estimate.

## Soil domain adapter (v1.5 survey foundation)

For each evaluation point, LUMOS resolves an SSURGO map-unit key through `SDA_Get_Mukey_from_intersection_with_WktWgs84`. Major soil components and horizons overlapping the selected depth interval are aggregated using component percentage and horizon-overlap thickness:

\[
\bar z_i = \frac{\sum_{c,h} z_{c,h}\,p_c\,\Delta d_h}{\sum_{c,h}p_c\,\Delta d_h}.
\]

The Soil adapter exposes pH, organic matter, clay, sand, silt, available water capacity, saturated hydraulic conductivity, electrical conductivity, and cation-exchange capacity when present. The shared Bayesian optimizer then selects sample locations under the same information, exposure, equity, ecology, reliability, redundancy, budget, and spacing objectives used by other domains.

The Soil-health composite is a transparent screening priority combining pH deviation, organic-matter deficit, low available water, salinity, and slow-drainage proxies. It is not a contamination probability.

## Soil laboratory-conditioned inference and validation (v1.6 preview)

Soil v1.6 preserves the SSURGO field as a survey prior and adds an optional local observation set

\[
O_A=\{(s_i,z_i,a_i,d_i,q_i,\rho_i)\}_{i=1}^{n},
\]

where \(s_i\) is location, \(z_i\) is the standardized observed value, \(a_i\) is analyte, \(d_i\) is depth support, \(q_i\) is QA metadata, and \(\rho_i\in(0,1]\) is observation reliability. Recognized source units are converted to the canonical unit of the active target before modeling. Samples outside the fitted extent or incompatible with the active analyte are excluded from conditioning but remain visible in import diagnostics.

### Soil mean and residual process

A regularized trend uses the available survey prior and site covariates:

\[
\widehat g(s)=\beta_0+\beta^\top\phi(s),
\]

where \(\phi(s)\) may include mapped property value, disturbance pressure, source proximity, population exposure, social vulnerability, ecological importance, and depth compatibility. For contaminant targets without a direct SSURGO concentration field, the pre-observation surface is labeled as screening priority rather than concentration.

Compatible observation residuals are modeled with the short-range Soil covariance. The posterior is

\[
\widehat z(s)=\widehat g(s)+k_{sO}(K_{OO}+\Sigma_\epsilon)^{-1}(z_O-\widehat g_O),
\]

\[
\sigma^2_z(s)=k(s,s)-k_{sO}(K_{OO}+\Sigma_\epsilon)^{-1}k_{Os}.
\]

The diagonal observation-error matrix incorporates calibrated noise and sample reliability. Posterior mean, predictive uncertainty, model residual, risk, and community-priority fields are then passed into the unchanged shared placement objective.

### Calibration and locked validation

At least three compatible observations are required for posterior conditioning, six for covariance calibration, and eight for a locked validation split. The deterministic spatial split separates development and locked observations. Length scale and observation noise are selected using development observations only. Locked samples are then compared against:

- LUMOS survey/source trend plus residual GP;
- survey/source trend alone;
- inverse-distance weighting;
- nearest-sample prediction.

The validation report includes MAE, RMSE, bias, \(R^2\), empirical 95% interval coverage, and interval width. Insufficient sample counts are reported explicitly and do not generate pseudo-validation metrics.

### Robustness analysis

The Soil robustness lab repeats the analysis across deterministic spatial split seeds, covariance-length and observation-noise settings, higher-reliability subsets, deterministic sample removal, and increased-noise scenarios. These tests evaluate dependence on sample availability and modeling assumptions without changing the network objective or candidate constraints.

### Soil paper bundle

The current-workspace export contains target and depth definitions, observation metadata, posterior and validation summaries, selected sites, portfolio metrics, scientific benchmarks, robustness rows, configuration, and a stable checksum. Imported laboratory values can therefore appear in explicitly saved workspaces and exports; they are otherwise processed locally in the browser.

### Interpretation boundary

Soil inference is a spatial planning and reconstruction model. It does not certify laboratory methods, establish regulatory compliance, prove an unsampled concentration, replace site access or excavation review, or demonstrate causal intervention effects. Method, sample support, depth, date, detection limits, and QA comparability must be audited before operational use.