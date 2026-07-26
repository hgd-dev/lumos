# LUMOS-Water v1.9 Public Release

Water is a public LUMOS monitoring-design domain for water temperature, dissolved oxygen, pH, specific conductance, turbidity, and stream discharge.

## Public capabilities

- nationwide viewport fitting;
- compatible recent USGS observations;
- flow-aware posterior inference and predictive uncertainty;
- locked station validation and serious reconstruction baselines;
- socially constrained five-profile monitoring portfolios;
- Water robustness analysis;
- treatment, control, upstream, downstream, and supplemental intervention sampling;
- current-workspace paper exports;
- a reproducible Denver/Houston/Pittsburgh/Portland evidence suite;
- provenance, persistence, and static GitHub Pages deployment.

## Limitations and intended use

Surface-water flow and branch structure are geometric proxies until an authoritative connected network is supplied. Distribution mode is a planning proxy and does not represent utility pipe topology, pressure zones, water age, asset condition, or operations. Candidate hosts require permission, safety review, sampling protocols, chain of custody, laboratory methods, and field verification.

No LUMOS output establishes drinking-water safety, regulatory compliance, contamination, causal intervention effects, or deployment authorization.

## Reproducibility

Run:

```bash
npm run verify
npm run paper:water
```

The evidence runner writes JSON and tidy CSV outputs with a stable checksum over scientific inputs. Controlled benchmark station values are simulations, not observations.
