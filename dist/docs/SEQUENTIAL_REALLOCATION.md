# LUMOS v2.2 Evidence-Calibrated Sequential Reallocation

LUMOS v2.2 adds a second-stage program decision above the v2.1 cross-domain budget allocator. The v2.1 allocator answers how an initial shared budget could be divided among Heat, Air, Soil, and Water under transparent normalized planning assumptions. The v2.2 sequential layer asks how the **next** funding round should change after domain workspaces have produced evidence about remaining uncertainty, observed support, validation quality, reliability, equity need, and intervention readiness.

This is a program-level planning model. It does not replace the domain-specific geographic placement optimizer and does not convert environmental measurements into a single physical unit.

## Evidence records

A saved LUMOS workspace can be summarized as a domain evidence record containing:

- domain and workspace identity;
- declared or selected monitoring units;
- number of evaluation points and compatible observations;
- average and risk-weighted remaining uncertainty;
- uncertainty among high-vulnerability locations;
- ecological uncertainty;
- reliability and provisional-reading share;
- locked or development validation support when available;
- selected-network information, fairness, reliability, and feasibility metrics when saved by v2.2;
- intervention readiness when an intervention design exists.

Older workspaces remain compatible. When exact selected-network metrics are absent, LUMOS derives a conservative screening summary from the stored field and observation metadata.

For workspace record \(r\) in domain \(d\), the residual-need index is

\[
N_{dr}=0.36U^{risk}_{dr}+0.24U^{global}_{dr}+0.22U^{equity}_{dr}+0.18U^{ecology}_{dr}.
\]

The evidence-strength index combines observation support, validation support, spatial support, and observation quality:

\[
E_{dr}=0.34E^{obs}_{dr}+0.26E^{val}_{dr}+0.22E^{space}_{dr}+0.18E^{quality}_{dr}.
\]

Both are normalized planning diagnostics. They are not probabilities of harm or regulatory confidence levels.

## Domain aggregation

Multiple saved records for one domain are combined using evidence-strength weights. Evidence strength accumulates sublinearly so that repeated weak workspaces do not become equivalent to one high-quality validation program. Existing units are taken from the most recent compatible workspace and remain editable in the interface.

If a domain has no compatible evidence, LUMOS uses its registry prior. The interface labels this condition **registry prior only** rather than implying that evidence was observed.

## Calibrated marginal response

Each domain has an existing network \(n_d^{(0)}\) and receives additional units \(a_d\) in the next round. The final program size is

\[
n_d^{(1)}=n_d^{(0)}+a_d.
\]

Evidence modifies the rate at which additional units are expected to reduce normalized residual need. A shrinkage multiplier is used:

\[
m_d=\operatorname{clip}\left(1+E_d\lambda\left[\left(0.66+0.94N_d\right)\left(0.72+0.42Y_d\right)-1\right],0.62,1.62\right),
\]

where:

- \(E_d\) is aggregated evidence strength;
- \(N_d\) is residual need;
- \(Y_d\) is normalized realized information yield;
- \(\lambda\) is the user-selected evidence learning rate.

When evidence is weak, \(m_d\) remains close to one and the registry prior dominates. Strong evidence can move the marginal curve, but the clipping and shrinkage prevent one workspace from producing an extreme cross-domain conclusion.

## Exploration

The user may reserve an exploration share \(\rho\). Domains with weak evidence receive an exploration bonus proportional to \(1-E_d\), subject to budget and program bounds. This protects the sequential design from repeatedly funding only domains that already have the strongest evidence infrastructure.

## Hard floors

The sequential allocator can enforce:

- minimum viable program completion;
- a minimum normalized equity-information level;
- a minimum normalized reliability level;
- a minimum normalized intervention-readiness level;
- per-domain maximum total units;
- a protected financial reserve;
- enabled-domain and priority settings.

If no allocation satisfies every floor, the interface reports the nearest tested portfolio and labels it as such. If the budget cannot complete required minimum programs from the declared existing network, LUMOS reports the exact shortfall.

## Portfolio generation

For the displayed four-domain bounds, LUMOS exhaustively enumerates feasible integer additions. It returns the same six public policy profiles used in v2.1:

- Balanced;
- Maximum Information;
- Exposure Protection;
- Equity First;
- Reliability and Intervention;
- Cost Efficient.

Each profile reports existing units, added units, final units, evidence strength, residual need, calibrated marginal multiplier, added cost, incremental normalized benefit, worst-domain benefit, balance gap, reserve, and uncommitted funds.

Pareto labels apply only to the generated six-profile portfolio and the displayed objective vector. They do not establish global optimality outside the enumerated bounds and assumptions.

## Reproducibility

Generate the controlled evidence and default next-round portfolio with:

```bash
npm run reallocate:domains
```

The command writes:

- `data/examples/sequential-evidence-example.json`;
- `data/examples/sequential-reallocation.json`;
- `data/examples/sequential-reallocation.csv`.

The controlled evidence is synthetic and is explicitly labeled as such. It exists for interface testing, methods review, and reproducibility—not as a claim about a real deployment.

## Limitations and intended use

The sequential layer does not claim:

- online causal learning;
- a regulatory funding recommendation;
- that normalized Heat, Air, Soil, and Water values share physical units;
- avoided disease, mortality, or monetary benefit;
- that a saved model workspace is field evidence of intervention success;
- that a domain with a higher normalized marginal signal is intrinsically more important;
- that program allocation replaces local procurement, staffing, permissions, maintenance, or community governance.

Operational use requires locally validated costs, multiple rounds of observed data, domain-expert review, community participation, field verification, and separate domain-specific placement optimization.


## v2.3 trajectory extension

The v2.3 simulator repeatedly invokes this next-round allocator after bounded deterministic evidence-state updates. The next-round equations and hard floors remain unchanged. See `ADAPTIVE_PROGRAM_SIMULATION.md` for the transition model and trajectory comparison.
