# LUMOS v2.3 Multi-Round Adaptive Program Simulation

LUMOS v2.3 extends the v2.2 next-round allocator into a deterministic multi-round scenario model. It compares complete funding trajectories across Heat, Air, Soil, and Water while retaining the domain-specific placement, inference, validation, and intervention models beneath the unified program layer.

The simulator is a planning experiment. It does not forecast future measurements, estimate causal intervention effects, or convert normalized monitoring information into health or monetary benefit.

## State and rounds

For domain \(d\) at round \(r\), the program state contains:

- deployed units \(n_{d,r}\);
- evidence strength \(E_{d,r}\);
- residual normalized need \(N_{d,r}\);
- normalized realized yield \(Y_{d,r}\);
- reliability \(R_{d,r}\);
- equity need \(Q_{d,r}\);
- intervention readiness \(H_{d,r}\).

At each round, LUMOS reruns the v2.2 sequential allocator using the current state and the displayed budget, reserve, exploration share, learning rate, program bounds, and hard floors. A trajectory either applies one fixed public profile every round or uses the adaptive policy to reselect among the six profiles after every update.

## Evidence-transition assumptions

Each adapter declares two bounded planning parameters in the domain registry:

- a simulation learning rate \(\ell_d\);
- a residual-response coefficient \(\rho_d\).

Let \(u_{d,r}\) be the number of added units, \(G_{d,r}\) a normalized incremental-information composite, \(\tau\) the user-selected transition rate, and \(s_E,s_N\) scenario multipliers. The evidence-strength transition has the form

\[
E_{d,r+1}=E_{d,r}+(1-E_{d,r})\,\tau\ell_d s_E\left(0.35g(u_{d,r})+0.65G_{d,r}\right),
\]

where \(g(\cdot)\) is a bounded diminishing-return response. Residual need evolves as

\[
N_{d,r+1}=N_{d,r}\left[1-\operatorname{clip}\left(\tau\rho_d s_N\left(0.28g(u_{d,r})+0.72G_{d,r}\right),0,0.72\right)\right].
\]

Reliability, normalized yield, equity need, and intervention readiness are updated with bounded shrinkage toward the selected round's modeled program state. No stochastic noise is added; the result is reproducible for a fixed configuration and evidence bundle.

## Response scenarios

Three transparent transition scenarios are available:

- Conservative learning;
- Central planning response;
- Upper planning response.

These scenarios alter only the assumed rate of evidence and residual-need change. They do not alter observed environmental data or the domain-specific posterior field.

## Trajectories

The simulator compares seven paths:

- Adaptive policy;
- Balanced trajectory;
- Maximum Information trajectory;
- Exposure Protection trajectory;
- Equity First trajectory;
- Reliability and Intervention trajectory;
- Cost Efficient trajectory.

The adaptive path scores the six available next-round portfolios using current uncertainty, equity pressure, reliability pressure, intervention pressure, exploration value, worst-domain benefit, balance, and incremental benefit. It may therefore change profile between rounds.

## Trajectory comparison

Each trajectory reports:

- selected profile by round;
- round budget, added cost, units, and uncommitted funds;
- incremental normalized benefit;
- terminal residual need;
- terminal evidence strength;
- terminal reliability and intervention readiness;
- discounted cumulative incremental benefit;
- cumulative cost;
- worst-domain benefit and balance gap;
- Pareto status among the generated trajectories.

The trajectory score is a transparent scenario-comparison index. It is not a welfare function, regulatory priority, or proof that one policy is objectively best.

## Reproducibility

Run:

```bash
npm run simulate:program
```

The command writes:

- `data/examples/adaptive-program-simulation.json`;
- `data/examples/adaptive-program-simulation.csv`.

The default controlled evidence is synthetic and remains explicitly labeled. The exported checksum excludes generation time.

## Limitations and intended use

Operational use requires locally validated costs, independent evidence, domain-expert review, community participation, procurement and maintenance analysis, and repeated comparison with observed outcomes. The simulator does not establish:

- future sensor performance;
- causal environmental improvement;
- avoided health burden;
- comparable physical units across domains;
- regulatory compliance;
- global optimality outside the displayed discrete bounds;
- an approved municipal funding recommendation.

## v2.4 uncertainty extension

The v2.4 robust evaluator uses the conservative, central, and optimistic simulations in this document as response anchors. It then applies seeded cost, failure, and environmental-condition stress to the resulting trajectories and reports expected, downside, feasibility, and regret summaries. The v2.3 transition equations and per-round allocators remain unchanged. See `ROBUST_POLICY_SELECTION.md`.
