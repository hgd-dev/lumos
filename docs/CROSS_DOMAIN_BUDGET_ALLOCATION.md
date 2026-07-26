# LUMOS v2.1 Cross-Domain Budget Allocation

LUMOS v2.1 adds a program-level allocator above the Heat, Air, Soil, and Water monitoring adapters. It answers a different question from the domain placement optimizers:

> Given one environmental-monitoring budget, how should planning capacity be distributed among the four domain programs before each domain runs its own scientific site-selection model?

The allocator does not merge temperature, pollutant concentration, soil properties, and water indicators into a common physical unit. It uses normalized within-domain response curves and exposes every cost, minimum-program, reliability, readiness, and priority assumption.

## Decision variables and constraints

For each enabled domain \(d\), let \(n_d\) be an integer number of planning packages. A package may represent a monitor, calibrated station, sample-plus-laboratory package, or station/sampling package depending on the adapter. Let \(c_d\) be the editable unit cost, \(m_d\) the minimum viable program, \(M_d\) the maximum program size, \(B\) the total budget, and \(\rho\) the protected reserve fraction.

The shared constraint is

\[
\sum_d c_d n_d \le (1-\rho)B.
\]

When the minimum-program safeguard is enabled,

\[
m_d \le n_d \le M_d
\]

for every enabled domain. When it is disabled, a domain may also receive zero units:

\[
n_d \in \{0\}\cup\{m_d,\ldots,M_d\}.
\]

Disabled domains are fixed at zero. If the protected budget cannot fund the required minima, LUMOS reports the exact shortfall rather than silently dropping a domain or violating the budget.

## Normalized domain response

For planning dimension \(k\) in domain \(d\), the declared diminishing-return response is

\[
r_{dk}(n_d)
=
q_d a_{dk}
\left[1-\exp\left(-\frac{n_d}{s_d\lambda_{dk}}\right)\right],
\]

where:

- \(q_d\) is a declared readiness factor;
- \(a_{dk}\) is the domain-specific normalized planning potential;
- \(s_d\) is a saturation scale;
- \(\lambda_{dk}\) controls how quickly that dimension saturates.

The dimensions are:

- normalized information value;
- exposure representation;
- equity-oriented information quality;
- ecological representation;
- intervention-evaluation readiness;
- expected program reliability.

These values are dimensionless planning indices. They are not posterior variance in a shared unit, avoided health burden, monetary benefit, regulatory compliance value, or causal intervention effect.

The priority-weighted aggregate for dimension \(k\) is

\[
R_k(\mathbf n)
=
\frac{\sum_d p_d r_{dk}(n_d)}{\sum_d p_d},
\]

where \(p_d\) is the editable public priority for domain \(d\).

LUMOS also reports:

\[
W(\mathbf n)=\min_d C_d(n_d)
\]

as the worst-domain normalized benefit, and

\[
\Delta(\mathbf n)=\max_d C_d(n_d)-\min_d C_d(n_d)
\]

as the cross-domain balance gap.

## Portfolio objectives

The browser evaluates every feasible integer allocation under the displayed bounds and chooses one allocation for each profile:

- Balanced;
- Maximum Information;
- Exposure Protection;
- Equity First;
- Reliability and Intervention;
- Cost Efficient.

A generic profile score is

\[
J_p(\mathbf n)
=
\sum_k \beta_{pk}R_k(\mathbf n)
+
\gamma_p W(\mathbf n)
-
\eta_p\Delta(\mathbf n)
+
\xi_p U(\mathbf n)
+
\omega_p E(\mathbf n),
\]

where \(U\) is the uncommitted-budget fraction and \(E\) is a bounded normalized value-per-budget term. Profile weights are fixed in the source and exported with the result.

The displayed Pareto marker is computed only among the generated profile portfolio. It considers normalized composite benefit, worst-domain benefit, reliability, and committed cost. It is not proof of global Pareto optimality over every possible environmental investment or implementation strategy.

## Default assumptions

The defaults are illustrative planning values and are editable in the Unified workspace:

- Heat: monitor package;
- Air: calibrated station package;
- Soil: sample plus laboratory package;
- Water: station or sampling package.

They are not bids, procurement estimates, lifecycle cost studies, or vendor quotations. A real deployment should replace them with local capital, laboratory, calibration, staffing, permitting, communications, maintenance, and replacement costs.

## Relationship to domain optimization

The v2.1 allocator chooses program sizes. It does not choose geographic sites. The intended sequence is:

1. define a shared budget and policy safeguards;
2. select a cross-domain allocation profile;
3. interpret the assigned units as domain-specific planning capacity;
4. open each domain adapter;
5. run its Bayesian placement, validation, robustness, and intervention workflow using locally appropriate costs and constraints;
6. revisit the shared allocation when empirical performance, costs, or priorities change.

LUMOS v2.2 adds a separate saved-workspace evidence and sequential reallocation layer. The v2.1 allocator remains the prior-only initial-program model; see `SEQUENTIAL_REALLOCATION.md` for the later-round evidence schema and limitations.

## Reproducibility

The default portfolio can be generated from the command line:

```bash
npm run allocate:domains
```

This writes:

- `data/examples/cross-domain-budget-allocation.json`;
- `data/examples/cross-domain-budget-allocation.csv`.

Browser exports use the same allocator and include a stable checksum that excludes only the generation timestamp.


LUMOS v2.3 adds a separate multi-round scenario layer above both the initial and next-round allocators. See `ADAPTIVE_PROGRAM_SIMULATION.md`; the v2.1 curves and v2.2 evidence calibration remain the per-round decision foundation.
