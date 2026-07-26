# LUMOS Security

Operational imports can contain sensitive infrastructure, personnel, permit, maintenance, or asset information. Keep confidential records out of public repositories and exports, minimize identifiers, and use locally approved storage and access controls. LUMOS does not authenticate imported records or provide encrypted multi-user storage. Permanent credentials must never be embedded in frontend code.

---

LUMOS is a static client-side application and does not require repository secrets. Do not commit API keys, tokens, personal mobility records, precise private-location data, or private monitoring locations.

The optional OpenAQ API key is stored only in `sessionStorage` for the active browser tab. It is not included in saved workspaces, JSON/CSV exports, release metadata, or the GitHub repository. Users should still treat exported geographic scenarios as potentially sensitive when they concern private facilities or planned deployments.

Report security issues privately through the repository's GitHub Security Advisories when available. Include the affected version, reproduction steps, and likely impact.