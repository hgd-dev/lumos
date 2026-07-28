import "./site.js";
import { DOCUMENTATION_PAGES } from "./release/documentation.js";

const CONTENT = Object.freeze({
  documentation: Object.freeze([
    Object.freeze({ key: "quickstart", ...DOCUMENTATION_PAGES.quickstart }),
    Object.freeze({
      key: "user-guide",
      title: "User guide",
      kicker: "Complete public workflow",
      summary: "How to move from a question and study area to a defensible monitoring recommendation.",
      html: `
        <ol>
          <li><strong>Select the decision scale.</strong> Use Unified for cross-domain budgeting and operations or choose Heat, Air, Soil, or Water for field reconstruction and site-level design.</li>
          <li><strong>Set the study extent.</strong> Search a location, use a preset, or move the map. New workspaces begin from the full United States and fit only the bounded area you choose.</li>
          <li><strong>Review data provenance.</strong> Inspect observed, modeled, derived, proxied, synthetic, and fallback labels before interpreting a field.</li>
          <li><strong>Fit and validate.</strong> Load the relevant public observations, inspect uncertainty, and run the available validation or sensitivity tools.</li>
          <li><strong>Generate alternatives.</strong> Compare multiple portfolios and benchmark strategies rather than accepting one opaque network.</li>
          <li><strong>Audit feasibility.</strong> Check budget, spacing, reliability, group-level information, field review, and operational requirements.</li>
          <li><strong>Save and export.</strong> Preserve a named workspace and export the evidence needed to reproduce or review the recommendation.</li>
        </ol>
      `
    }),
    Object.freeze({
      key: "interface-guide",
      title: "Interface guide",
      kicker: "Navigation and controls",
      summary: "How the multi-page site, workspace controls, map, and saved state work together.",
      html: `
        <h3>Top navigation</h3><p>Home, About Us, Unified, the four Workspaces, Documentation, Research &amp; Process, and Contact each have stable public URLs.</p>
        <h3>Workspace pages</h3><p>Each model page has domain-specific identity and controls while loading the same shared scientific application shell.</p>
        <h3>Map controls</h3><p>The map toolbar controls basemap, overlays, accessibility settings, and the toggleable map-search panel. Side panels and the top header can be collapsed independently.</p>
        <h3>Saved workspaces</h3><p>Saved workspaces remain local to the browser until exported. New page visits do not automatically restore an old city or saved location.</p>
      `
    }),
    Object.freeze({ key: "limitations", ...DOCUMENTATION_PAGES.limitations }),
    Object.freeze({ key: "privacy", ...DOCUMENTATION_PAGES.privacy }),
    Object.freeze({ key: "release-notes", ...DOCUMENTATION_PAGES["release-notes"] }),
    Object.freeze({
      key: "changelog",
      title: "Changelog",
      kicker: "Complete release history",
      summary: "Every public and internal LUMOS release is recorded in the repository.",
      html: `<p>The complete version-by-version history is maintained in <a href="CHANGELOG.md">CHANGELOG.md</a>. It records the progression from early Heat prototypes through the unified four-domain scientific and operational platform.</p>`
    })
  ]),
  research: Object.freeze([
    Object.freeze({ key: "methodology", ...DOCUMENTATION_PAGES.methodology }),
    Object.freeze({
      key: "architecture",
      title: "Model architecture",
      kicker: "One engine, four scientific adapters",
      summary: "The shared mathematical contracts and the domain-specific science that specializes them.",
      html: `
        <p>LUMOS uses a shared socially constrained sequential Bayesian environmental-monitoring design engine. Heat, Air, Soil, and Water adapters specialize observations, covariance, transport or persistence, intervention roles, validation, candidate-site rules, and commissioning requirements.</p>
        <h3>Shared layers</h3><ul><li>continuous probabilistic field reconstruction</li><li>epistemic-uncertainty reduction</li><li>information, exposure, equity, reliability, redundancy, cost, and feasibility objectives</li><li>portfolio generation, serious baselines, persistence, evidence export, and operations planning</li></ul>
        <p><a href="MODEL_SPECIFICATION.md">Read the repository model specification</a> or open the <a href="unified.html">Unified workspace</a>.</p>
      `
    }),
    Object.freeze({ key: "data-sources", ...DOCUMENTATION_PAGES["data-sources"] }),
    Object.freeze({
      key: "validation",
      title: "Validation & benchmarking",
      kicker: "Evidence before recommendation",
      summary: "How LUMOS tests reconstruction, optimization, robustness, and operational consistency.",
      html: `
        <p>Domain workflows compare posterior reconstruction against held-out or locked observations where compatible data exist. Controlled evidence suites provide deterministic regression and comparative evaluation when direct local validation is unavailable.</p>
        <h3>Comparator families</h3><p>Benchmarks include random and uniform selection, hotspot and exposure heuristics, A- and D-optimal design, mutual information, pivoted Cholesky or Nyström-style low-rank selection, and exact micro-instance enumeration.</p>
        <h3>Robustness</h3><p>Sensitivity screens vary covariance, observations, candidate roles, fairness thresholds, costs, failures, environmental response, and future evidence transitions.</p>
      `
    }),
    Object.freeze({
      key: "reproducibility",
      title: "Reproducibility",
      kicker: "Frozen evidence and deterministic checks",
      summary: "How model runs, release contracts, and public evidence are preserved.",
      html: `
        <p>LUMOS exports model settings, source metadata, candidate pools, observations, split identities, selected networks, metrics, constraint audits, and checksums. Controlled evidence generators use fixed seeds and release-tracked assumptions.</p>
        <pre><code>npm test
npm run audit:domains
npm run check:release
npm run build</code></pre>
        <p>Additional domain and operations commands are documented in <a href="README.md">README.md</a> and <a href="docs/REPRODUCIBILITY.md">docs/REPRODUCIBILITY.md</a>.</p>
      `
    }),
    Object.freeze({
      key: "lifecycle",
      title: "Monitoring lifecycle",
      kicker: "From inference to maintained operations",
      summary: "The sequential process represented by the complete LUMOS platform.",
      html: `<ol><li><strong>Reconstruct:</strong> estimate environmental fields and epistemic uncertainty.</li><li><strong>Optimize:</strong> compare portfolios under scientific, social, financial, and operational constraints.</li><li><strong>Evaluate:</strong> design treatment, control, boundary, spillover, upstream, downstream, and longitudinal measurement roles.</li><li><strong>Deploy:</strong> coordinate hosts, review permissions and infrastructure, inspect sites, and stage reserves.</li><li><strong>Operate:</strong> commission assets, track calibration and uptime, manage maintenance, and protect failures with reviewed replacements.</li></ol>`
    }),
    Object.freeze({
      key: "paper",
      title: "Paper & conference",
      kicker: "Manuscript in preparation",
      summary: "A permanent placeholder for the LUMOS paper, conference submission, and presentation materials.",
      html: `
        <div class="paper-status-grid">
          <article><span>Status</span><strong>Manuscript in preparation</strong><small>Update before submission</small></article>
          <article><span>Working title</span><strong>LUMOS: Socially Constrained Sequential Bayesian Environmental Monitoring Design</strong><small>Provisional title</small></article>
          <article><span>Target venue</span><strong>To be announced</strong><small>Conference selection in progress</small></article>
          <article><span>Authors</span><strong>Hudson Dong and the LUMOS Team</strong><small>Final author order forthcoming</small></article>
        </div>
        <h3>Planned materials</h3>
        <div class="placeholder-resource-grid">
          <span data-placeholder="replace-with-paper-url"><strong>Manuscript / preprint</strong><small>Link coming soon</small></span>
          <span data-placeholder="replace-with-supplement-url"><strong>Supplementary methods</strong><small>Link coming soon</small></span>
          <span data-placeholder="replace-with-conference-url"><strong>Conference submission</strong><small>Venue and status coming soon</small></span>
          <span data-placeholder="replace-with-presentation-url"><strong>Poster or presentation</strong><small>Link coming soon</small></span>
        </div>
        <p>The paper will document the literature review, model formulation, novelty, validation, cross-domain adapters, deployment and operations layers, limitations, and reproducibility evidence.</p>
      `
    }),
    Object.freeze({ key: "citation", ...DOCUMENTATION_PAGES.citation })
  ])
});

const group = document.body.dataset.contentGroup;
const pages = CONTENT[group] || CONTENT.documentation;
const navigation = document.querySelector("#infoNavigation");
const content = document.querySelector("#infoContent");

for (const page of pages) {
  const link = document.createElement("a");
  link.href = `#${page.key}`;
  link.textContent = page.title;
  navigation?.append(link);

  const section = document.createElement("section");
  section.id = page.key;
  section.className = "info-document-section";
  section.innerHTML = `<p class="section-kicker"></p><h2></h2><p class="info-section-summary"></p><div class="info-section-body"></div>`;
  section.querySelector(".section-kicker").textContent = page.kicker;
  section.querySelector("h2").textContent = page.title;
  section.querySelector(".info-section-summary").textContent = page.summary;
  section.querySelector(".info-section-body").innerHTML = page.html;
  content?.append(section);
}

const links = [...document.querySelectorAll("#infoNavigation a")];
const updateActive = () => {
  const hash = location.hash.slice(1) || pages[0]?.key;
  links.forEach((link) => link.classList.toggle("active", link.hash === `#${hash}`));
};
window.addEventListener("hashchange", updateActive);
updateActive();
if (location.hash) window.setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ block: "start" }), 0);
