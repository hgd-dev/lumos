function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  return value;
}

function checksumObject(value) {
  const text = JSON.stringify(stableObject(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function selectedSolution(result, activeProfile) {
  return result?.solutions?.find((entry) => entry.profileKey === activeProfile) ?? result?.solutions?.[0] ?? null;
}

function scenarioSummary(scenario) {
  return {
    label: scenario?.cityLabel ?? "Soil workspace",
    property: scenario?.model?.property ?? null,
    propertyLabel: scenario?.model?.propertyLabel ?? null,
    propertyUnit: scenario?.model?.propertyUnit ?? null,
    depth: scenario?.model?.depth ?? null,
    depthLabel: scenario?.model?.depthLabel ?? null,
    bounds: scenario?.geoBounds ?? null,
    evaluationPoints: scenario?.cells?.length ?? 0,
    candidates: scenario?.candidates?.length ?? 0,
    laboratorySamples: scenario?.observations?.length ?? 0,
    soilSurveyCoverage: scenario?.model?.soilCoverageRate ?? null,
    analyte: scenario?.model?.labAnalyte ?? null,
    inference: scenario?.model?.soilInference ?? null,
    validation: scenario?.model?.soilValidation ?? null,
    importQa: scenario?.model?.soilImportQa ?? null
  };
}

function solutionSummary(solution) {
  if (!solution) return null;
  return {
    profileKey: solution.profileKey,
    profileLabel: solution.profileLabel ?? solution.profile?.label ?? solution.profileKey,
    paretoOptimal: Boolean(solution.paretoOptimal),
    feasible: solution.constraintStatus?.feasible ?? null,
    metrics: solution.metrics ?? null,
    constraintStatus: solution.constraintStatus ?? null,
    selected: (solution.selected ?? []).map((site) => ({
      id: site.id,
      name: site.name,
      lat: site.lat,
      lng: site.lng,
      x: site.x,
      y: site.y,
      cost: site.cost,
      reliability: site.reliability,
      hostType: site.hostType,
      sourceType: site.sourceType
    }))
  };
}

function benchmarkSummary(result) {
  return (result?.baselines ?? []).map((baseline) => ({
    name: baseline.name,
    criterion: baseline.criterion,
    runtimeMs: baseline.runtimeMs ?? null,
    feasible: baseline.constraintStatus?.feasible ?? null,
    metrics: baseline.metrics ?? null
  }));
}

export function buildCurrentSoilPaperBundle({
  scenario,
  result,
  activeProfile = "balanced",
  sensitivity = null,
  settings = {}
} = {}) {
  if (!scenario?.cells?.length || scenario.domainKey !== "soil") throw new Error("Fit a Soil workspace before building the paper bundle.");
  if (!result) throw new Error("Generate a Soil monitoring portfolio before building the paper bundle.");
  const scientificInputs = {
    scenario: scenarioSummary(scenario),
    selectedNetwork: solutionSummary(selectedSolution(result, activeProfile)),
    benchmarks: benchmarkSummary(result),
    sensitivity,
    settings
  };
  return {
    format: "lumos-soil-paper-bundle-v1",
    version: "1.9.1",
    generatedAt: new Date().toISOString(),
    checksum: checksumObject(scientificInputs),
    methodology: {
      coreModel: "Full LUMOS Bayesian information, social constraints, Pareto portfolio, and scientific benchmark architecture.",
      inferenceBoundary: "Imported laboratory observations condition the posterior only for the selected compatible analyte. No regulatory determination is made.",
      credentialBoundary: "The Soil workflow requires no private API credentials. Imported sample rows are included only in locally generated workspace and paper files."
    },
    settings,
    scenario: scientificInputs.scenario,
    selectedNetwork: scientificInputs.selectedNetwork,
    benchmarks: scientificInputs.benchmarks,
    sensitivity
  };
}

export function soilPaperRows(bundle) {
  const rows = [];
  const base = {
    case_label: bundle?.scenario?.label ?? "Soil workspace",
    analyte: bundle?.scenario?.analyte ?? bundle?.scenario?.property ?? null
  };
  for (const [metric, value] of Object.entries(bundle?.scenario ?? {})) {
    if (value && typeof value === "object") continue;
    rows.push({ table: "scenario", ...base, method: "LUMOS", metric, value });
  }
  for (const [metric, value] of Object.entries(bundle?.selectedNetwork?.metrics ?? {})) {
    if (value && typeof value === "object") continue;
    rows.push({ table: "selected_network", ...base, method: bundle.selectedNetwork.profileLabel, metric, value });
  }
  for (const benchmark of bundle?.benchmarks ?? []) {
    for (const [metric, value] of Object.entries(benchmark.metrics ?? {})) {
      if (value && typeof value === "object") continue;
      rows.push({ table: "benchmark", ...base, method: benchmark.name, metric, value });
    }
  }
  const validation = bundle?.scenario?.validation;
  if (validation?.available) {
    for (const [method, metrics] of Object.entries(validation.locked ?? {})) {
      for (const [metric, value] of Object.entries(metrics ?? {})) {
        if (value && typeof value === "object") continue;
        rows.push({ table: "locked_validation", ...base, method, metric, value });
      }
    }
  }
  for (const row of bundle?.sensitivity?.rows ?? []) {
    rows.push({ table: "sensitivity", ...base, method: row.condition ?? row.analysis, metric: row.analysis, value: JSON.stringify(row) });
  }
  return rows;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToSoilPaperCsv(rows = []) {
  const columns = ["table", "case_label", "analyte", "method", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
