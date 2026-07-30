export const DEFAULT_DOCUMENTATION_PAGE = "quickstart";

export const DOCUMENTATION_ORDER = Object.freeze([
  "quickstart",
  "methodology",
  "data-sources",
  "limitations",
  "privacy",
  "release-notes",
  "about",
  "citation"
]);

export const DOCUMENTATION_PAGES = Object.freeze({
  quickstart: Object.freeze({
    title: "Quickstart",
    kicker: "Begin with a defensible workflow",
    summary: "A practical path from area selection to an exportable monitoring plan.",
    html: `
      <p>LUMOS is a public planning system for environmental monitoring design. It combines probabilistic field reconstruction, uncertainty reduction, social-information constraints, domain-specific science, and operational deployment planning.</p>
      <ol>
        <li><strong>Choose a workspace.</strong> Open Unified for cross-domain budgeting and operations, or select Heat, Air, Soil, or Water for a domain-specific study.</li>
        <li><strong>Define the study area.</strong> Search for a place, use a preset, or move the map to a bounded U.S. extent. Review the workload estimate before fitting a national area.</li>
        <li><strong>Review the source labels.</strong> LUMOS distinguishes observed, modeled, derived, proxied, synthetic, and fallback inputs. Optional host data never replaces the systematic candidate mesh.</li>
        <li><strong>Fit the field.</strong> Load public observations and covariates, then inspect the posterior field, epistemic uncertainty, exposure, vulnerability, and domain-specific context.</li>
        <li><strong>Generate alternatives.</strong> Compare Balanced, Maximum Information, Exposure Protection, Equity First, and Cost Efficient monitoring portfolios rather than relying on one opaque recommendation.</li>
        <li><strong>Audit feasibility.</strong> Check budget, spacing, reliability, group-level information quality, field-verification requirements, and serious scientific baselines.</li>
        <li><strong>Plan intervention evaluation.</strong> Use treatment, control, boundary, spillover, upstream/downstream, or other domain-specific roles where appropriate.</li>
        <li><strong>Save and export.</strong> Preserve a browser workspace, export reproducible evidence, and keep the documented limitations and intended-use guidance with the result.</li>
      </ol>
      <div class="documentation-callout"><strong>Start conservatively.</strong> A LUMOS result is a monitoring-design recommendation. It is not a regulatory measurement, installation authorization, causal finding, or substitute for professional field review.</div>
    `
  }),
  methodology: Object.freeze({
    title: "Methodology",
    kicker: "Socially constrained Bayesian monitoring design",
    summary: "How the shared engine and four scientific adapters fit together.",
    html: `
      <p>LUMOS models an environmental field continuously in space and, where supported, time. Administrative polygons may supply attributes, but the scientific model does not assume that an entire tract, ZIP code, or neighborhood has one uniform environmental value.</p>
      <h3>Shared engine</h3>
      <p>The shared architecture conditions a probabilistic field on available observations, estimates reducible epistemic uncertainty, and evaluates candidate networks by their expected posterior-variance reduction. The optimizer also represents exposure, vulnerability, community priorities, ecological or background coverage, reliability, redundancy, budget, and operational feasibility.</p>
      <h3>Group-level information fairness</h3>
      <p>Equity is not reduced to a population-density weight. LUMOS evaluates information quality for defined social groups and can constrain worst-group information gain or the gap between best- and worst-served groups.</p>
      <h3>Domain-specific adapters</h3>
      <ul>
        <li>Reserved a permanent second-line layout for the animated monitoring, intervention, planning, optimization, deployment, and evaluation words.</li>
        <li>Added an illuminated introductory card around the LUMOS brand lockup, expanded system name, animated statement, supporting line, and project summary.</li>
        <li><strong>Heat:</strong> temperature and apparent-heat surfaces, canopy, imperviousness, land cover, dynamic exposure, and intervention benefit.</li>
        <li><strong>Air:</strong> pollutant-specific fields, wind-aware anisotropy, traffic and industrial source structure, background sites, and calibration roles.</li>
        <li><strong>Soil:</strong> persistent localized variation, survey properties, depth intervals, laboratory observations, contamination QA, and access constraints.</li>
        <li><strong>Water:</strong> indicator-specific fields, directional flow approximations, upstream/downstream reasoning, source-to-receptor structure, and network-aware intervention roles.</li>
      </ul>
      <h3>Decision lifecycle</h3>
      <p>The Unified workspace extends the same scientific contracts into cross-domain budgeting, sequential reallocation, multi-round simulation, robust policy comparison, shared-host deployment, field review, campaign operations, live outcome tracking, commissioning, and maintenance.</p>
      <p>LUMOS integrates established methods; it does not claim to have invented Gaussian-process sensor placement, mutual information, optimal design, adaptive sampling, equity-aware placement, robust optimization, or BACI evaluation.</p>
    `
  }),
  "data-sources": Object.freeze({
    title: "Data sources",
    kicker: "Observed, modeled, derived, and proxied inputs",
    summary: "What public information LUMOS may load and how it is labeled.",
    html: `
      <p>Public-data availability varies by location, domain, time, and third-party service status. Every source is labeled by evidentiary type and confidence.</p>
      <ul>
        <li><strong>Weather and atmospheric fields:</strong> Open-Meteo products support weather context, Heat screening, and Air composition priors. Modeled atmospheric products are not street-level regulatory measurements.</li>
        <li><strong>Reference air observations:</strong> OpenAQ data may be used when a user supplies a session-only API key. Keys are not saved, exported, or committed.</li>
        <li><strong>Population and social context:</strong> U.S. Census TIGERweb and ACS-derived indicators support geography, exposure, and group-level information analysis.</li>
        <li><strong>Mapped context and candidate hosts:</strong> OpenStreetMap and Overpass may provide roads, waterways, facilities, sources, and host proxies. A mapped feature does not imply permission or deployment feasibility.</li>
        <li><strong>Heat case study:</strong> official NYC Open Data sources support the validated New York Heat workflow.</li>
        <li><strong>Soil:</strong> USDA-NRCS Soil Data Access and SSURGO support survey properties. Imported laboratory observations are required for analyte-specific contamination inference.</li>
        <li><strong>Water:</strong> USGS instantaneous observations support Water screening and inference where compatible stations are available.</li>
      </ul>
      <h3>Fallback behavior</h3>
      <p>Optional source failure does not abort a study. LUMOS retains the systematic candidate mesh, raises uncertainty where appropriate, records the failure, and avoids presenting synthetic or proxied information as observed data.</p>
      <h3>Cache and privacy</h3>
      <p>Public responses may be cached locally to improve performance. Saved workspaces remain in the browser unless the user exports them. LUMOS does not require an account or permanent application backend.</p>
    `
  }),
  limitations: Object.freeze({
    title: "Limitations",
    kicker: "Use the system as planning evidence",
    summary: "What LUMOS does not establish or replace.",
    html: `
      <p>LUMOS is an uncertainty-aware monitoring-design and operations-planning system. It does not convert public screening data into regulatory truth.</p>
      <ul>
        <li>Posterior values are modeled estimates, not measurements at every mapped location.</li>
        <li>Nationwide priors and proxy layers may be too coarse for street-, parcel-, pipe-, or facility-level conclusions.</li>
        <li>Candidate hosts are mathematical siting proxies until ownership, permission, access, safety, power, communications, and maintenance conditions are verified.</li>
        <li>Water flow and distribution-network structure may be geometric or proxy-based unless an authoritative network is supplied.</li>
        <li>Soil survey properties do not establish contaminant concentrations.</li>
        <li>Intervention power values are planning diagnostics; they do not prove causality or treatment effectiveness.</li>
        <li>Robust ensembles compare explicit scenarios. Their frequencies are not forecast probabilities or confidence intervals.</li>
        <li>Cross-domain normalized benefits permit planning comparisons but do not make environmental units physically equivalent.</li>
        <li>Operational ledgers preserve imported records but do not authenticate whether an inspection, permit, calibration, or maintenance action occurred.</li>
      </ul>
      <div class="documentation-callout"><strong>Professional review remains necessary.</strong> Regulatory sampling, engineering design, utility work, excavation, environmental compliance, and health or emergency decisions require qualified local authorities and domain professionals.</div>
    `
  }),
  privacy: Object.freeze({
    title: "Privacy and data governance",
    kicker: "Local-first public application",
    summary: "What is stored, exported, and intentionally excluded.",
    html: `
      <p>LUMOS is a static public application. It does not require registration, a permanent backend, or a user account.</p>
      <h3>Browser storage</h3>
      <p>Named workspaces, the most recent autosave, cached public responses, interface preferences, and selected accessibility settings may be stored locally in the browser. Users can clear saved workspaces and the public-data cache from the interface.</p>
      <h3>Exports</h3>
      <p>Workspace, evidence, audit, inventory, campaign, and operations exports are created only when requested. Imported local inventories and operational records remain user-supplied evidence and may contain sensitive organizational details; review them before sharing.</p>
      <h3>Credentials</h3>
      <p>Permanent API credentials are not embedded in the application. An optional OpenAQ key is held only in session storage and is excluded from saved workspaces, exports, service-worker assets, and release metadata.</p>
      <h3>Public requests</h3>
      <p>When live sources are enabled, the browser contacts the named public services directly. The public shell also requests Tektur, Orbitron, and Inter styles from Google Fonts when available; local system fallbacks remain usable offline. Third-party privacy, logging, availability, and rate-limit policies apply.</p>
      <h3>Responsible governance</h3>
      <p>Organizations using LUMOS should define data ownership, reviewer authority, correction procedures, retention periods, access controls, and public-release rules for imported field and operations records.</p>
    `
  }),
  "release-notes": Object.freeze({
    title: "Release notes",
    kicker: "Current public release: 3.3.0",
    summary: "The cinematic editorial-motion experience is now the official LUMOS Home.",
    html: `
      <p><strong>LUMOS 3.3.0</strong> promotes the refined cinematic motion experience from an unlinked preview to the official public <code>index.html</code> Home.</p>
      <h3>Official cinematic Home</h3>
      <ul>
        <li>Opens with a brief load-safe black hold and an extruded, chromatically sliced three-dimensional LUMOS title assembly.</li>
        <li>Morphs directly into the first editorial scene rather than cutting between independent overlays.</li>
        <li>Preserves the six-scene Unified, Heat, Air, Water, and Soil sequence with faster motion, wider snap behavior, and hover-driven desktop navigation.</li>
        <li>Fades the axial geometry after the scene sequence while retaining the starfield and softened cosmic glow behind conventional Home content.</li>
        <li>Keeps <code>home-spiral.html</code> as a noindex compatibility preview and retains <code>home-3d.html</code> as the separate unlinked Three.js experiment.</li>
      </ul>
      <h3>Scientific scope</h3>
      <p>No model, objective, constraint, adapter, evidence generator, validation protocol, or public claim boundary changed.</p>
      <p>The complete release history remains in <code>CHANGELOG.md</code>.</p>
    `
  }),
  about: Object.freeze({
    title: "About Us",
    kicker: "The people and purpose behind LUMOS",
    summary: "A student-led public-interest project connecting environmental research, software, and community use.",
    html: `
      <p>LUMOS is a student-led environmental monitoring research and software project designed to make rigorous planning tools more accessible to cities, towns, schools, researchers, environmental initiatives, and community organizations.</p>
      <h3>Our mission</h3>
      <p>We aim to help organizations design monitoring programs that reduce uncertainty, represent communities fairly, support credible intervention evaluation, and remain practical to deploy and maintain.</p>
      <h3>Creation and team</h3>
      <p><strong>Full creation including ideation, website, code, and interface by Hudson Dong, Class of 2027, Stuyvesant High School, New York City.</strong></p>
      <p><strong>The LUMOS Team</strong></p>
      <p>The LUMOS team contributes to the project’s continued research, review, testing, communication, and public-impact work.</p>
      <h3>Research foundation</h3>
      <p>LUMOS builds on established work in Bayesian experimental design, environmental field reconstruction, sensor placement, adaptive sampling, fairness-aware optimization, robust planning, and intervention evaluation. Its contribution is the unified integration of these methods across environmental domains and the full monitoring-program lifecycle.</p>
      <h3>Public commitment</h3>
      <p>LUMOS is intended to remain free, transparent, reproducible, and usable without registration or a permanent application backend. Detailed methodology, data sources, limitations, privacy practices, citation metadata, and release history are available in this documentation center.</p>
    `
  }),
  citation: Object.freeze({
    title: "Citation and creator credit",
    kicker: "Credit the system and its creators",
    summary: "Recommended attribution for papers, presentations, and deployments.",
    html: `
      <p><strong>Full creation including ideation, website, code, and interface by Hudson Dong, Class of 2027, Stuyvesant High School, New York City.</strong></p>
      <p><strong>The LUMOS Team</strong></p>
      <h3>Recommended citation</h3>
      <p>Dong, Hudson. <em>LUMOS: Localized Unified Monitoring Optimization System.</em> Public software and methodology for socially constrained Bayesian environmental-monitoring design and operations, 2026.</p>
      <h3>Research framing</h3>
      <p>When discussing the scientific contribution, describe LUMOS as an integrated “Socially Constrained Sequential Bayesian Environmental Monitoring Design” framework. Do not claim that it invented Gaussian-process placement, mutual information, adaptive sampling, robust optimization, equity-aware placement, or BACI evaluation.</p>
      <p><a class="documentation-download" href="CITATION.cff" download>Download citation metadata</a></p>
    `
  })
});
