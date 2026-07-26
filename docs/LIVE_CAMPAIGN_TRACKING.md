# LUMOS Live Campaign Tracking and Adaptive Replacement

## Purpose

LUMOS v2.8 converts a planned v2.7 field campaign into a phase-aware operational record. It imports actual or controlled inspection outcomes, preserves the complete event history, updates the status of each primary host, activates reviewed reserve hosts after rejection, and reports assignment gaps without silently relaxing domain constraints.

## Outcome ledger

CSV and JSON records may contain:

- `event_id`
- `host_id`
- `phase`
- `outcome`
- `occurred_at`
- `reviewer`
- permission, access, power, safety, and maintenance status
- `supersedes_event_id`
- notes

Supported outcomes are `accepted`, `conditional`, `rejected`, and `pending`. Later records may supersede the current operational status of the same host, but earlier events remain in the export.

Events are ordered deterministically by phase, timestamp, and identifier. Each record stores the previous event hash and its own deterministic hash. This chain supports reproducibility and change detection. It is not a digital signature, identity check, secure timestamp, or evidence-authentication system.

## Phase snapshots

For completed phase `t`, LUMOS uses the latest event for each host with `phase <= t`.

- Accepted primary: active.
- Conditional primary: provisional.
- Rejected primary: reserve activation is attempted per domain assignment.
- Scheduled host with no completed record: overdue.
- Future scheduled host: pending.
- Verified host that was not queued: active.

Every snapshot retains the full assignment set and reports active, provisional, pending, overdue, replaced, and unresolved states.

## Adaptive replacement

A rejected primary assignment can move only to an unused reserve that:

- is assigned to the same environmental domain;
- is not rejected by a later event;
- remains verified or conditional under the imported review record;
- meets the domain-specific live-outcome reliability floor;
- was already admissible under the v2.7 reserve-planning constraints.

LUMOS does not silently lower suitability, access, power, reliability, host-category, spacing, or Water-connectivity requirements. If no eligible reserve remains, the assignment is marked as an unresolved gap.

## Conditional operational credit

Conditional assignments remain visible as provisional. Each adapter declares a bounded conditional operational credit used only in the displayed effective operational-rate diagnostic. This does not convert a conditional property into an approved or verified deployment.

## Reproducibility

Run:

```bash
npm run track:campaign
```

The command reads the controlled v2.7 reviewed deployment and field campaign, creates a deterministic v2.8 outcome ledger, and writes:

- `data/examples/live-campaign-outcomes.json`
- `data/examples/live-campaign-tracking.json`
- `data/examples/live-campaign-tracking.csv`

Generation time is excluded from the stable checksum.

## Limitations and intended use

Imported records are user-supplied evidence. LUMOS does not authenticate reviewer identity, ownership, permission, access, power, communications, structural or excavation safety, sampling rights, legal authority, regulatory compliance, or final deployment approval. Operational-network recomputation is a planning aid and does not replace local professional review.
