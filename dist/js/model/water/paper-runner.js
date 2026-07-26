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
    scenarioId: scenario?.scenarioId ?? scenario?.id ?? null,
    label: scenario?.cityLabel ?? "Water workspace",
    indicator: scenario?.model?.indicator ?? null,
    indicatorLabel: scenario?.model?.indicatorLabel ?? null,
    indicatorUnit: scenario?.model?.indicatorUnit ?? null,
    systemType: scenario?.model?.systemType ?? null,
    systemLabel: scenario?.model?.systemLabel ?? null,
    bounds: scenario?.geoBounds ?? null,
    evaluationPoints: scenario?.cells?.length ?? 0,
    candidates: scenario?.candidates?.length ?? 0,
    observations: scenario?.observations?.length ?? 0,
    groups: scenario?.groups?.length ?? 0,
    inference: scenario?.model?.waterInference ?? null,
    validation: scenario?.model?.waterValidation ?? null,
    flowDirectionConfidence: scenario?.model?.flowDirectionConfidence ?? null,
    waterFeatureStatus: scenario?.model?.waterFeatureStatus ?? null,
    sourceProxyCount: scenario?.model?.sourceProxyCount ?? 0,
    waterwayPointCount: scenario?.model?.waterwayPointCount ?? 0
  };
}

function solutionSummary(solution) {
  if (!solution) return null;
  return {
    profileKey: solution.profileKey,
    profileLabel: solution.profileLabel ?? solution.profile?.label ?? solution.profileKey,
    paretoOptimal: Boolean(solution.paretoOptimal ?? solution.pareto),
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
      waterRole: site.waterRole ?? null,
      networkBranch: site.networkBranch ?? null,
      sourceType: site.sourceType ?? null
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

export function buildCurrentWaterPaperBundle({
  scenario,
  result,
  activeProfile = "balanced",
  sensitivity = null,
  intervention = null,
  settings = {}
} = {}) {
  if (!scenario?.cells?.length || scenario.domainKey !== "water") throw new Error("Fit a Water workspace before building the paper bundle.");
  if (!result) throw new Error("Generate a Water monitoring portfolio before building the paper bundle.");
  const scientificInputs = {
    scenario: scenarioSummary(scenario),
    selectedNetwork: solutionSummary(selectedSolution(result, activeProfile)),
    benchmarks: benchmarkSummary(result),
    sensitivity,
    intervention,
    settings
  };
  return {
    format: "lumos-water-paper-bundle-v1",
    version: "1.9.1",
    generatedAt: new Date().toISOString(),
    checksum: checksumObject(scientificInputs),
    methodology: {
      coreModel: "Full LUMOS Bayesian information, social constraints, Pareto portfolio, and scientific benchmark architecture.",
      inferenceBoundary: "Compatible recent USGS observations condition a screening trend and flow-aware residual Gaussian process. Flow and branch structure remain proxies unless an authoritative network is supplied.",
      validationBoundary: "Locked station holdouts compare LUMOS against isotropic GP, screening, trend, nearest-site, and inverse-distance baselines when at least eight compatible observations are available.",
      decisionBoundary: "Outputs prioritize monitoring and intervention evaluation; they are not regulatory, compliance, hydraulic, or drinking-water safety determinations."
    },
    settings,
    scenario: scientificInputs.scenario,
    selectedNetwork: scientificInputs.selectedNetwork,
    benchmarks: scientificInputs.benchmarks,
    sensitivity,
    intervention
  };
}

export function waterPaperRows(bundle) {
  const rows = [];
  const base = {
    case_label: bundle?.scenario?.label ?? "Water workspace",
    indicator: bundle?.scenario?.indicator ?? null,
    system_type: bundle?.scenario?.systemType ?? null
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
      if (!metrics || Array.isArray(metrics) || typeof metrics !== "object") continue;
      for (const [metric, value] of Object.entries(metrics)) {
        if (value && typeof value === "object") continue;
        rows.push({ table: "locked_validation", ...base, method, metric, value });
      }
    }
  }
  for (const row of bundle?.sensitivity?.rows ?? []) {
    rows.push({ table: "sensitivity", ...base, method: row.condition ?? row.analysis, metric: row.analysis, value: JSON.stringify(row) });
  }
  for (const [metric, value] of Object.entries(bundle?.intervention ?? {})) {
    if (value && typeof value === "object") continue;
    rows.push({ table: "intervention", ...base, method: "BACI planning diagnostic", metric, value });
  }
  return rows;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToWaterPaperCsv(rows = []) {
  const columns = ["table", "case_label", "indicator", "system_type", "method", "metric", "value"];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
