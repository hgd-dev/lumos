# LUMOS v2.6 Host Inventory and Field-Feasibility Review

LUMOS v2.6 adds an operational bridge between mathematical cross-domain placement and locally reviewed candidate properties. A user may import a CSV or JSON host inventory, preserve the supplied review state, filter the network by a declared field-review policy, and rerun the same coordinated Heat, Air, Soil, and Water deployment portfolio.

## Inventory contract

Each accepted record requires a host identifier or label and valid latitude/longitude. The recommended template also records:

- host category and eligible environmental domains;
- permission, access, power, safety, and maintenance status;
- reliability and social or environmental priority scores;
- optional domain-specific suitability scores;
- owner or agency, reviewer, verification date, and notes.

Review states are normalized to `verified`, `pending`, `unverified`, `not-required`, or `denied`. LUMOS never converts a missing review into a verified value.

## Operational classification

A host is classified as:

- **Verified** when permission, access, safety, and maintenance are verified or not required.
- **Conditional** when no critical review is denied and at least one critical review remains pending.
- **Unresolved** when critical reviews remain unverified.
- **Infeasible** when permission, access, safety, or maintenance is denied.

Air deployments additionally reject hosts with denied power. Domain-specific spacing, suitability, access, power, host-category, and water-connectivity constraints continue to apply after field-review filtering.

## Review policies

The planner exposes three explicit policies:

1. Verified only.
2. Verified plus conditional.
3. All non-denied records, including unresolved proxies.

The selected policy is stored in the result and exported with every host-domain assignment. If the available reviewed network cannot satisfy the requested unit counts, LUMOS returns an incomplete plan rather than silently relaxing the policy.

## Host-source modes

- **Controlled proxy pool** reproduces the v2.5 deterministic mathematical host network.
- **Imported inventory only** uses only user-supplied records within the active map extent.
- **Hybrid** combines imported records with controlled fallback proxies.

Controlled proxies remain explicitly unresolved and require the permissive `all-not-denied` policy. They are never described as verified properties.

## Evidence and claim boundary

The importer validates structure, coordinates, enumerated statuses, duplicate identifiers, and basic numeric ranges. It does not independently verify ownership, permission, access, power, communications, structural capacity, excavation safety, sampling rights, hydraulic connectivity, environmental compliance, or professional approval. Imported status fields remain user-supplied evidence and should be traceable to local records and reviewers.
