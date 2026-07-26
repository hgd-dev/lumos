# LUMOS Reproducibility

## Final public evidence chain

The release verifier regenerates domain audits, initial and sequential allocations, adaptive simulation, robust ensemble, spatial deployment, reviewed-host deployment, field campaign, live tracking, commissioning operations, and internal release quality. Controlled examples use canonical ordering, fixed seeds, or deterministic timestamps and emit stable checksums. Generated artifacts must remain labeled as controlled evidence rather than observations.

Run `npm run verify` or the constituent scripts listed in the README.

---

## Field-campaign artifact

```bash
npm run campaign:field
```

This regenerates `data/examples/field-campaign-operations.json` and `.csv` from the controlled reviewed inventory and coordinated deployment. The stable v2.7 checksum is `9828a203`. Generation time is excluded from the checksum.

Save `.lumos.json` workspaces to preserve transformed inputs, controls, provenance, observations, QA summaries, and camera state. Paper and evidence exports include stable checksums and tidy result rows.

Useful commands:

```bash
npm test
npm run check:release
npm run build
npm run check:live
npm run freeze:nyc
npm run sensitivity:nyc
npm run paper:national
npm run paper:air
npm run paper:soil
npm run paper:water
npm run audit:domains
npm run allocate:domains
```

For every reported result, record the LUMOS version, workspace or evidence checksum, retrieval timestamp, active domain and target, fitted extent, monitor count, budget, covariance settings, fairness thresholds, candidate strategy, source-status panel, and fallback status.

For a cross-domain allocation, additionally archive the exported JSON and record total budget, protected reserve, enabled domains, per-domain unit costs, minimum and maximum units, priority weights, active profile, evaluated allocation count, committed and uncommitted budget, worst-domain benefit, balance gap, and checksum. Default cost assumptions must be labeled illustrative.

## Soil v1.7

For laboratory-conditioned runs, archive the original import file and record canonical units, depth interval, detection-limit treatment, QA/reliability fields, import-QA summary, development/locked split, calibration settings, and compatible sample count. A fallback run must be reported as a fallback experiment. A contaminant run without compatible observations must be reported as screening-priority mapping rather than concentration inference.

The four-case Soil evidence suite uses deterministic simulated benchmark observations over public spatial context. Archive its JSON output to preserve exact case definitions, transformed inputs, selected networks, benchmark results, feasibility, and checksum. Do not describe those simulated observations as sampled field data.

For Water results, additionally record the indicator parameter code, system context, USGS observation count and timestamps, hydrologic-feature status, fitted transport angle, flow-direction confidence, candidate strategy, and whether the result used systematic or mapped candidates. A Water workspace without recent compatible readings must be reported as a low-confidence proxy screening run.


## Sequential reallocation

Run `npm run reallocate:domains` to regenerate the controlled evidence bundle and frozen next-round JSON/CSV outputs. Stable checksums exclude generation timestamps. Browser exports preserve the complete evidence records, configuration, tested-allocation counts, floor status, profile scores, and per-domain additions.


## Multi-round adaptive program artifact

```bash
npm run simulate:program
```

This writes deterministic JSON and CSV trajectory artifacts from the controlled evidence bundle. Generation time is excluded from the stable checksum. The release verifier runs this command before the release check and static build.

## Robust policy ensemble artifact

```bash
npm run robust:program
```

This runs the conservative, central, and optimistic trajectory anchors and writes deterministic JSON and tidy CSV summaries for the seeded uncertainty ensemble. Generation time is excluded from the stable checksum. `npm run verify` regenerates the artifact before release validation and static build.

## Spatial deployment artifact

```bash
npm run deploy:spatial
```

This writes deterministic JSON and tidy CSV host-assignment artifacts. Record the allocation source, unit counts, map bounds, host-pool size, seed, compatibility threshold, shared-infrastructure discount, maximum domains per host, active profile, domain-registry version, and stable checksum. Generation time is excluded from the checksum. The controlled host records must be labeled synthetic and field-verification-required.

## v2.8 live campaign tracking

Run `npm run track:campaign` to regenerate the controlled outcome ledger and phase-aware operational network. The ledger and network use deterministic ordering and checksums; `generatedAt` is excluded from checksum calculation.