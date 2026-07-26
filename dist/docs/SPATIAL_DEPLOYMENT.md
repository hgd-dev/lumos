# LUMOS v2.6 Spatially Coupled Cross-Domain Deployment

## Field-reviewed host sources

The v2.6 planner can use controlled proxies, imported local records, or a hybrid pool. Operational review is an admissibility layer; it does not replace the domain-specific suitability, spacing, access, power, water-connectivity, co-location, or failure-coupling rules documented below.

LUMOS v2.5 translates a unified Heat, Air, Soil, and Water program allocation into a coordinated portfolio of physical host proxies. The layer sits between cross-domain funding and the four domain-specific siting optimizers. It identifies where infrastructure could potentially be shared while preserving each domain's separate spacing, access, power, host-type, reliability, and field-verification requirements.

It does not replace the Heat, Air, Soil, or Water posterior models. It also does not claim that a generated host is owned, accessible, powered, safe, permitted, hydraulically connected, or otherwise deployable.

## Decision objects

For domain \(d\), let \(n_d\) be the funded number of monitoring or sampling units. Let \(H\) be a controlled pool of host proxies and let \(x_{hd}\in\{0,1\}\) indicate that domain \(d\) is assigned to host \(h\).

The planner enforces

\[
\sum_{h\in H}x_{hd}=n_d
\]

for every enabled domain. A physical host may support more than one domain only when the pairwise compatibility threshold, maximum-domain count, host suitability, and domain-specific feasibility requirements are satisfied.

The public controlled example builds a deterministic Halton host pool inside the selected map extent. Host categories include municipal facilities, schools, parks, transit locations, community facilities, utilities, treatment facilities, industrial-edge locations, watershed-access points, and background proxies. These are mathematical planning objects, not a statement that corresponding real properties are available.

## Domain-specific siting contracts

Each adapter declares a spatial-deployment contract in `js/config/domain-registry.js`:

- minimum spacing;
- minimum host suitability;
- minimum access confidence;
- minimum power confidence;
- preferred and excluded host categories;
- maximum plausible shared-infrastructure fraction;
- co-location failure-correlation assumption.

Heat favors broad exposure, public-space, and community hosts. Air preserves background, roadside/source, calibration, and power-sensitive roles. Soil requires localized access and avoids treating transit infrastructure as a default sampling host. Water favors watershed, treatment, utility, and background roles and does not treat geometric proximity as authoritative hydraulic connectivity.

These contracts are versioned defaults. Local agencies should replace them with verified property, access, power, safety, maintenance, hydraulic, and sampling constraints.

## Co-location compatibility

For domains \(d\) and \(e\), the planner uses an explicit compatibility value \(q_{de}\in[0,1]\). A shared assignment is considered only when

\[
q_{de}\ge q_{\min}.
\]

Compatibility represents planning-level infrastructure compatibility, not scientific interchangeability. Two instruments at one host still retain separate observation models, calibration requirements, sampling procedures, and quality-assurance rules.

The planner penalizes over-concentration and correlated failure. If several domains share one host, a single loss of permission, power, communications, access, or physical infrastructure may affect all co-located units. The reported correlated-failure metric therefore rises with the number of jointly exposed domain assignments and their registry sensitivity.

## Cost accounting

Let \(c_d\) be the domain-specific unit cost. The independent deployment cost is

\[
C_0=\sum_d n_dc_d.
\]

For a shared host \(h\), only the infrastructure-share portion of compatible secondary assignments is eligible for the displayed co-location discount. A simplified savings term is

\[
S_h=\delta\sum_{d\in D_h\setminus\{d_h^*\}}c_d\,r_d\,\phi_h,
\]

where \(\delta\) is the user-selected shared-infrastructure discount, \(r_d\) is the domain's shareable-infrastructure fraction, \(\phi_h\) is a bounded host-compatibility factor, and \(d_h^*\) is the anchor assignment at the host. Total modeled deployment cost is

\[
C=C_0-\sum_h S_h.
\]

The savings estimate is illustrative. It excludes procurement quotes, engineering design, trenching, utility work, laboratory processing, permits, labor agreements, land acquisition, replacement schedules, and many maintenance costs.

## Portfolio profiles

LUMOS separately generates five coordinated site plans:

- **Coordinated** balances host suitability, domain coverage, equity, reliability, and savings.
- **Maximum Savings** gives greater preference to compatible shared infrastructure while retaining hard domain constraints.
- **Coverage First** prioritizes spatial spread and worst-domain representation.
- **Equity First** emphasizes high-vulnerability and community-priority host proxies.
- **Resilient** penalizes co-location concentration and correlated failure more strongly.

Pareto labels apply only to the generated portfolio and displayed planning metrics. They do not prove global optimality over every possible property or network.

## Allocation sources

The browser can derive unit counts from:

1. the active v2.1 initial cross-domain allocation;
2. the active v2.2 sequential allocation; or
3. manual domain counts.

Funding allocation and spatial deployment remain separate decisions. The spatial layer does not revise the domain budget, and a lower modeled site cost does not automatically release funds for another purpose.

## Outputs

Each plan reports:

- domain assignments;
- physical host count;
- shared-host count;
- base and modeled final cost;
- modeled co-location savings;
- mean and worst-domain spatial coverage;
- equity representation;
- reliability;
- correlated-failure risk;
- field-verification flags;
- deterministic checksum.

JSON exports preserve the complete configuration, host pool, assignments, metrics, assumptions, warnings, and claim boundary. Tidy CSV exports provide one row per host-domain assignment.

## Reproducibility

Run:

```bash
npm run deploy:spatial
```

This writes:

- `data/examples/spatial-deployment.json`;
- `data/examples/spatial-deployment.csv`.

The controlled host pool and selected plans are deterministic for the same extent, seed, unit counts, domain registry, and configuration. Generation time is excluded from the stable checksum.

## Claim boundary

Every generated location is a mathematical host proxy requiring field verification. LUMOS does not establish ownership, permission, accessibility, power, network service, sampling rights, excavation safety, structural suitability, hydraulic connectivity, environmental compliance, or deployment approval. Co-location savings and failure coupling are transparent planning assumptions, not quotations or measured operational probabilities. Operational use requires verified candidate inventories, local engineering review, domain specialists, community consultation, and site-specific approval.
