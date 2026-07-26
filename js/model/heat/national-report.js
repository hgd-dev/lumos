function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mean(values) {
  const usable = values.map(finite).filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function quoteCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function nationalCaseStudyRows({ scenario, result, activeProfile = "balanced" }) {
  if (scenario?.scenarioType !== "live-national") throw new Error("A fitted nationwide Heat scenario is required.");
  const solution = result?.solutions?.find((entry) => entry.profileKey === activeProfile)
    ?? result?.solutions?.[0]
    ?? null;
  const rows = [];
  const add = (table, metric, value, units = "", extra = {}) => rows.push({ table, metric, value, units, ...extra });

  add("scenario", "evaluation_points", scenario.cells.length, "count");
  add("scenario", "candidate_sites", scenario.candidates.length, "count");
  add("scenario", "viewport_area", scenario.model?.viewportAreaKm2 ?? null, "km2");
  add("scenario", "mean_apparent_temperature", mean(scenario.cells.map((cell) => cell.apparentTemperature)), "degF");
  add("scenario", "mean_heat_risk", mean(scenario.cells.map((cell) => cell.risk)), "index");
  add("scenario", "mean_impervious_proxy", mean(scenario.cells.map((cell) => cell.impervious)), "proportion");
  add("scenario", "mean_tree_canopy_proxy", mean(scenario.cells.map((cell) => cell.treeCanopy)), "proportion");
  add("scenario", "mean_vulnerability", mean(scenario.cells.map((cell) => cell.vulnerability)), "index");
  add("scenario", "mean_exposure", mean(scenario.cells.map((cell) => cell.exposure)), "index");

  for (const group of scenario.groups ?? []) {
    const cells = scenario.cells.filter((cell) => cell.communityGroup === group);
    add("social_group", "cell_count", cells.length, "count", { group });
    add("social_group", "mean_heat_risk", mean(cells.map((cell) => cell.risk)), "index", { group });
    add("social_group", "mean_vulnerability", mean(cells.map((cell) => cell.vulnerability)), "index", { group });
    add("social_group", "mean_exposure", mean(cells.map((cell) => cell.exposure)), "index", { group });
  }

  if (solution) {
    for (const [metric, value] of Object.entries(solution.metrics ?? {})) {
      if (typeof value === "number") add("selected_network", metric, value, "", { profile: solution.profileKey });
    }
    solution.selected.forEach((site, index) => {
      rows.push({
        table: "selected_site",
        metric: "site",
        value: index + 1,
        units: "rank",
        profile: solution.profileKey,
        site_id: site.id,
        site_name: site.name ?? "",
        latitude: site.lat ?? "",
        longitude: site.lng ?? "",
        source_type: site.sourceType ?? "",
        host_type: site.hostType ?? "",
        cost: site.cost ?? "",
        reliability: site.reliability ?? "",
        community_group: site.communityGroup ?? ""
      });
    });
    for (const baseline of solution.baselines ?? []) {
      add("benchmark", "score", baseline.metrics?.score ?? null, "", { model: baseline.name });
      add("benchmark", "information", baseline.metrics?.information ?? null, "proportion", { model: baseline.name });
      add("benchmark", "fairness_gap", baseline.metrics?.fairnessGap ?? null, "proportion", { model: baseline.name });
      add("benchmark", "runtime", baseline.runtimeMs ?? null, "ms", { model: baseline.name });
    }
  }
  return rows;
}

export function rowsToNationalCaseStudyCsv(rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.map(quoteCsv).join(","),
    ...rows.map((row) => columns.map((column) => quoteCsv(row[column])).join(","))
  ].join("\n");
}

export function buildNationalCaseStudyPackage({ scenario, result, activeProfile = "balanced", controls = {} }) {
  const rows = nationalCaseStudyRows({ scenario, result, activeProfile });
  const solution = result?.solutions?.find((entry) => entry.profileKey === activeProfile)
    ?? result?.solutions?.[0]
    ?? null;
  return {
    format: "lumos-national-heat-case-study-v1",
    createdAt: new Date().toISOString(),
    scenario: {
      cityLabel: scenario.cityLabel,
      bounds: scenario.bounds,
      model: scenario.model,
      groups: scenario.groups,
      sources: scenario.sourceMetadata?.sources ?? [],
      layers: scenario.sourceMetadata?.layers ?? [],
      limitations: scenario.sourceMetadata?.limitations ?? []
    },
    controls,
    selectedProfile: solution?.profileKey ?? null,
    selectedNetwork: solution ? {
      metrics: solution.metrics,
      constraintStatus: solution.constraintStatus,
      selected: solution.selected
    } : null,
    benchmarks: solution?.baselines ?? [],
    rows
  };
}
