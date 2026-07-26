# LUMOS Commissioning and Maintenance Operations

## Purpose

The commissioning layer begins after field review and campaign tracking have produced a current operational host network. It records whether equipment or sampling programs were procured, permitted, installed, calibrated, commissioned, maintained, and kept operational. When a current asset becomes blocked or offline, LUMOS can identify a reviewed reserve that still satisfies the domain’s operational contract.

This layer is a planning and record-organization tool. It does not authenticate procurement, permits, installation quality, calibration certificates, chain of custody, technicians, uptime telemetry, maintenance completion, or deployment approval.

## Input records

CSV and JSON records may contain:

- event, assignment, host, domain, role, and asset identifiers;
- event timestamp and optional superseded event;
- procurement status;
- permit status;
- installation status;
- calibration status;
- chain-of-custody status;
- operational state;
- uptime and data completeness;
- maintenance state and due dates;
- ticket severity and status;
- technician and notes.

Events are normalized, sorted deterministically, and linked through previous-event and event hashes. The hashes support reproducibility and change detection. They are not cryptographic signatures or proof that an event occurred.

## Domain contracts

Heat uses a continuous-monitor contract with permitting, calibration, uptime, completeness, and preventive-maintenance requirements. Air uses a stricter calibrated-station contract with higher uptime, completeness, and replacement-reliability floors. Soil uses a sample-program contract emphasizing chain of custody and data completeness rather than continuous uptime. Water uses a station-or-sampling-program contract with calibration, uptime, completeness, and reviewed replacement requirements.

All values in the default registry are transparent planning assumptions. Operational deployments should replace them with locally approved equipment, laboratory, permit, calibration, maintenance, staffing, and replacement requirements.

## Assignment state

For each current field assignment, LUMOS selects the latest valid event at the displayed analysis time. It classifies the assignment as:

- **Commissioned:** prerequisites, operational state, uptime, completeness, and quality floors are satisfied.
- **Provisional:** core prerequisites are satisfied but a bounded quality or maintenance condition remains.
- **Commissioning:** an event exists but commissioning is incomplete.
- **Awaiting record:** no commissioning event has been imported.
- **Offline or blocked:** a critical procurement, permit, installation, calibration, chain-of-custody, or availability failure exists.
- **Field not operational:** the upstream live campaign does not currently provide an operational host.

No assignment is removed from the output because it fails commissioning.

## Tickets

Tickets are generated transparently for missing records, denied permits, unavailable equipment, installation or calibration failure, chain-of-custody exceptions, offline or degraded operation, low uptime, incomplete data, due calibration, due maintenance, and imported open tickets. Imported ticket fields remain user supplied.

## Replacement planning

For each offline or blocked assignment, LUMOS searches unused reviewed reserves from the selected field-campaign plan. A replacement must:

- match the domain;
- meet the domain replacement-reliability floor;
- remain verified or conditional;
- not already be used as a current or replacement host.

Candidates are ranked using reliability, domain suitability, verified-review credit, and distance. A replacement is labeled **replacement ready**, not commissioned. It must still complete renewed field review, procurement, installation, calibration or chain of custody, and operational acceptance.

## Costs

LUMOS reports modeled commissioning cost, annual maintenance cost, replacement-mobilization cost, and first-year operations cost. These figures come from the public domain registry and are not vendor quotes, budget authorizations, lifecycle-cost certifications, or procurement recommendations.

## Reproducibility

Generate the frozen controlled example with:

```bash
npm run commission:operations
```

The command writes event, assignment, ticket, replacement, and summary evidence under `data/examples`. The controlled records are synthetic and are not field observations.
