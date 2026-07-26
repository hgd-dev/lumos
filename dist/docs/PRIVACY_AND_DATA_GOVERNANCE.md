# LUMOS Privacy and Data Governance

## Operational records

Host inventories, field outcomes, commissioning events, asset identifiers, technicians, permits, maintenance notes, and tickets may contain sensitive operational or personal information. LUMOS processes these records locally in the browser by default. Users are responsible for authorization, minimization, redaction, retention, export handling, and repository publication. Do not place confidential infrastructure, credentials, personal data, or protected agency records in the public source tree.

The application does not authenticate imported identities or evidence and does not transmit permanent API credentials.

---

LUMOS does not require an account. Workspaces, API cache entries, and settings are stored locally in the user's browser unless the user explicitly exports a file.

Browser location is requested only after the user selects **My location**. The application uses the resulting coordinates to center the map; it does not upload or retain an individual movement history.

Social indicators are aggregated geographic estimates. LUMOS must not infer, display, or claim individual demographic or health attributes. Community-priority and vulnerability layers should be documented independently from measured environmental conditions.

Exported workspace and experiment files may contain geographic areas, selected candidate sites, and source metadata. Users should review files before public release when candidate sites involve sensitive facilities or locally supplied data.


## Locally imported Soil samples

Soil laboratory files are parsed and modeled in the browser and are not sent to a LUMOS server. They may contain precise coordinates, site identifiers, dates, analytical values, and QA information. Saved workspaces and Soil paper bundles can include these observations. Users must remove confidential identifiers, verify sharing authority, and review exports before publication or collaboration.

## Water data

Water v1.9 uses public USGS and OpenStreetMap requests and stores fitted scenarios only through the same browser-local workspace mechanisms used by other domains. The public adapter does not request utility credentials or private pipe-network data. A future user-supplied utility-network adapter must define ownership, access control, export redaction, and infrastructure-security handling before sensitive operational data are supported.