# LUMOS Internal Release Quality Assurance

## Scope

This repository-only quality-assurance process verifies the packaged software and its declared release contracts. It is not exposed as a visitor-facing LUMOS workspace. It checks that the stable public release identifies the four public domains, complete unified workflow, commissioning layer, frozen evidence, governance documents, accessibility declarations, static deployment, offline application shell, credential boundary, license, and scientific limitations and intended-use guidance.

It does not certify environmental accuracy, regulatory compliance, cybersecurity, accessibility conformance, legal authority, field deployment, laboratory quality, hydraulic validity, or institutional approval.

## Audit categories

- **Release:** version and stable public status.
- **Architecture:** Heat, Air, Soil, Water, and all required unified workspaces.
- **Science:** clean cross-domain audit and commissioning evidence.
- **Reproducibility:** frozen evidence manifest and stable checksums.
- **Operations:** commissioned/provisional/offline assignments, replacement protection, and unresolved failures.
- **Accessibility:** keyboard navigation, visible focus, reduced motion, color-vision-safe palette, skip navigation, collapsible layout, and map-focus mode.
- **Governance:** limitations, privacy, security, citation, license, and centralized limitations and intended-use guidance.
- **Deployment:** static GitHub Pages hosting, versioned service worker, and no embedded permanent credentials.

## Interpretation

A passing audit means the release package contains the declared modules, metadata, evidence, and public safeguards. It does not mean every optional external API is currently available or that a real deployment is scientifically, legally, or operationally approved.

## Reproducibility

Generate the launch audit with:

```bash
npm run audit:public
```

The command writes JSON and CSV evidence under `data/examples`. It consumes the current release metadata, cross-domain audit, and commissioning evidence.
