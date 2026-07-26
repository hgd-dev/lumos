# Field-Campaign Operations and Reserve-Site Planning

LUMOS v2.7 converts a selected v2.6 reviewed-host deployment into an operational planning portfolio. It schedules inspections in phases, identifies domain-compatible reserve properties, applies deterministic response scenarios, and records replacement or unresolved outcomes.

## Inputs

The field-campaign layer requires an existing spatial-deployment result and its active profile. Public controls include:

- inspections available per phase;
- maximum number of phases;
- reserve-site ratio;
- optimistic, central, or conservative review-response scenario;
- deterministic seed;
- inspection cost per host;
- reserve mobilization cost.

The campaign preserves all active domain assignments and the reviewed host metadata inherited from v2.6.

## Inspection queue

For host \(h\) under campaign profile \(k\), LUMOS ranks

\[
q_h^{(k)}=w_N^{(k)}N_h+w_S^{(k)}S_h+w_R^{(k)}(1-r_h)+w_D^{(k)}D_h+w_E^{(k)}E_h.
\]

The terms represent review need, shared-host importance, reliability need, domain criticality, and equity representation. The highest-ranked hosts are assigned deterministically to phases subject to the displayed per-phase capacity and phase limit. A small configurable share of lower-reliability verified hosts can be included for quality-control auditing.

## Reserve sites

For each domain, the target number of reserves is the displayed reserve ratio multiplied by the number of primary assignments. Candidate reserves must be outside the selected primary set and must satisfy the relevant domain's minimum suitability, access, power, reliability, host-category, spacing context, and Water-connectivity requirements.

Each domain adapter declares an inspection priority, reserve reliability floor, and replacement criticality. Candidate reserve ranking combines suitability, reliability, review quality, geographic relationship to the primary, and equity representation.

## Response and replacement workflow

The public response scenarios scale bounded host-rejection probabilities. A seeded deterministic draw produces a reproducible planning scenario for each scheduled host. Accepted primary sites remain active. Rejected primary assignments seek unused compatible reserves in the same domain. Uninspected primaries and assignments without eligible reserves remain visible as unresolved gaps.

No failure is silently repaired by weakening a domain requirement.

## Campaign portfolios

LUMOS generates four alternatives:

- **Balanced campaign:** balances inspection urgency, reserve coverage, reliability, and shared-host importance.
- **Rapid verification:** inspects the highest-uncertainty and most heavily shared primary sites first.
- **Coverage protection:** emphasizes domain-complete backup coverage and useful replacement geography.
- **Resilience first:** favors reliable, less failure-coupled reserves.

Each profile reports:

- scheduled inspections and phases used;
- accepted, rejected, and uninspected hosts;
- reserve count and reserve coverage;
- replacement demand and recovered assignments;
- unresolved assignments;
- operational resilience;
- mean reserve reliability;
- shared-host failure exposure;
- modeled campaign cost.

Pareto labels apply only to these generated alternatives and displayed metrics.

## Controlled v2.7 evidence

Run:

```bash
npm run campaign:field
```

The frozen controlled example generates four profiles. The Balanced profile schedules 24 inspections over three phases, identifies 17 reserves, and reports no residual assignment gaps under the central response scenario. Its stable checksum is `9828a203`.

## Header-collapse behavior

The v2.7 application header has a persistent collapse control. Collapsing it sets the masthead's layout height to zero, moves the domain tabs upward, and gives the map approximately 92 additional vertical pixels. The header can be restored without reopening the page. Side-panel and header states remain independent.

## Limitations and intended use

Inspection outcomes and reserve activation are deterministic planning scenarios. LUMOS does not:

- authenticate imported field-review records;
- perform a site visit;
- grant permission or access;
- certify power, communications, structural safety, or excavation safety;
- establish regulatory or sampling authorization;
- guarantee that a reserve property is available or suitable at deployment time;
- replace domain professionals, property owners, utilities, agencies, or community review.

Every selected primary and reserve site remains subject to real-world verification and approval.
