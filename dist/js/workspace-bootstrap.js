const DOMAIN_PAGE_CONFIG = Object.freeze({
  core: {
    label: "Unified",
    kicker: "Cross-domain workspace",
    description: "Coordinate environmental budgets, evidence, deployment, field campaigns, commissioning, and maintenance across Heat, Air, Soil, and Water."
  },
  heat: {
    label: "Heat",
    kicker: "Environmental science workspace",
    description: "Reconstruct Heat fields, design equitable monitoring networks, compare interventions, and plan field operations."
  },
  air: {
    label: "Air",
    kicker: "Environmental science workspace",
    description: "Build pollutant-specific, wind-aware monitoring networks with source, calibration, equity, and intervention roles."
  },
  soil: {
    label: "Soil",
    kicker: "Environmental science workspace",
    description: "Combine soil surveys and laboratory evidence for sampling, remediation evaluation, and deployable field design."
  },
  water: {
    label: "Water",
    kicker: "Environmental science workspace",
    description: "Design indicator-specific, flow-aware monitoring with upstream, downstream, intervention, and operational roles."
  }
});

const mount = document.querySelector("#workspaceMount");
const domain = document.body.dataset.lumosDomain || "core";
const config = DOMAIN_PAGE_CONFIG[domain] ?? DOMAIN_PAGE_CONFIG.core;

try {
  const response = await fetch("./workspace-shell.html", { cache: "no-store" });
  if (!response.ok) throw new Error(`Workspace shell returned ${response.status}`);
  mount.innerHTML = await response.text();
  document.querySelector("#workspaceProductTitle").textContent = `LUMOS—${config.label}`;
  document.querySelector("#workspaceProductKicker").textContent = config.kicker;
  document.querySelector("#workspacePageDescription").textContent = config.description;
  const status = document.querySelector("#domainStatus");
  if (status) status.hidden = true;
  await import("./app.js?build=multi-page-2");
} catch (error) {
  console.error(error);
  mount.innerHTML = `<section class="workspace-load-error"><p class="section-kicker">Workspace unavailable</p><h1>LUMOS—${config.label}</h1><p>The shared workspace interface could not be loaded. Serve the repository over HTTP and refresh the page.</p><a class="secondary-button button-link" href="index.html">Return Home</a></section>`;
}
