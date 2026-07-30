# LUMOS Stable Public Release Checklist

## Version and package

- [ ] `package.json`, `release.json`, `js/release/version.js`, service worker, citation metadata, release notes, and changelog identify `3.2.6`. The public masthead, browser title, footer, manifest name, README title, and model-specification title remain version-neutral.
- [ ] Release status is `stable-public-v3`.
- [ ] Service-worker cache is `lumos-v3.2.6` and contains every standard public entry page, the unlinked `home-3d.html` and `home-spiral.html` experiments, the shared workspace shell, all public domain modules, unified operations, and documentation scripts.
- [ ] No permanent credential is embedded in public assets.

## Automated verification

- [ ] `npm test` passes the complete suite.
- [ ] `npm run audit:domains` produces no failures.
- [ ] Every frozen unified evidence generator completes.
- [ ] `npm run commission:operations` produces protected replacement evidence with no unresolved controlled failures.
- [ ] `npm run audit:public` passes the internal release-quality contract.
- [ ] `npm run check:release` passes version, syntax, credential, file, and static-size checks.
- [ ] `npm run build` produces the deterministic Pages artifact.
- [ ] `npm run verify` completes, or every constituent stage is recorded independently when an aggregate shell limit is reached.

## Browser review

- [ ] Hard refresh twice after applying the release.
- [ ] Unified, Heat, Air, Soil, and Water switch without stale labels, layers, legends, evidence, or controls.
- [ ] Header and both side panels collapse and restore independently.
- [ ] Focus map creates a near-full-window map; Escape restores the prior layout.
- [ ] Skip navigation and keyboard focus are visible.
- [ ] Reduced-motion and color-vision controls behave as declared.
- [ ] Internal release-quality audit passes in the browser.
- [ ] Commissioning controlled example loads, runs, maps replacements, and exports JSON/CSV.
- [ ] Saved workspace persistence and import/export remain functional.
- [ ] Offline application shell loads after one successful online visit.
- [ ] `home-3d.html` remains absent from standard Home navigation, declares `noindex,nofollow`, preserves every Home content section, and falls back cleanly when WebGL or the pinned Three.js module is unavailable.
- [ ] `home-spiral.html` remains absent from standard Home and `home-3d.html` navigation, declares `noindex,nofollow`, rotates cards through a sticky native-scroll sequence, releases into conventional content, and becomes a linear card stack under reduced motion.

## Scientific and operational review

- [ ] Modeled, observed, derived, proxied, controlled, and fallback sources are distinguished.
- [ ] Candidate hosts remain labeled for field verification.
- [ ] Imported verification and commissioning records remain user supplied.
- [ ] Infeasible, incomplete, unresolved, and offline assignments are reported honestly.
- [ ] Cross-domain normalized values are not described as shared physical measurements.
- [ ] Robust and causal claims remain within documented boundaries.

## Publication

- [ ] Source ZIP, Pages ZIP, direct patch, checksums, verification record, launch audit, commissioning evidence, model specification, README, and changelog are packaged.
- [ ] The direct patch is tested against pristine v2.8 and locally regenerated evidence artifacts.
- [ ] Browser and endpoint review is complete before committing to `main`.

- [ ] Verify About Us, Documentation, Research & Process, paper/conference status, and Contact & Feedback pages.
