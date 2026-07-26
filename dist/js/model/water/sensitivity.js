import { predictWaterField, runWaterValidationExperiment } from "./inference.js";

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function subsetDeterministic(values, keepFraction, offset = 0) {
  return values.filter((_, index) => ((index * 37 + offset * 17) % 100) / 100 < keepFraction);
}

function validationRow(label, result) {
  const metrics = result?.available ? result.locked?.lumos : null;
  return {
    analysis: "validation_stability",
    condition: label,
    available: Boolean(result?.available),
    observationCount: result?.count ?? ((result?.split?.development?.length ?? 0) + (result?.split?.locked?.length ?? 0)),
    lockedCount: result?.split?.locked?.length ?? 0,
    rmse: metrics?.rmse ?? null,
    mae: metrics?.mae ?? null,
    bias: metrics?.bias ?? null,
    coverage95: metrics?.coverage95 ?? null
  };
}

function cloneWithoutSourceProxy(point) {
  return { ...point, upstreamSourcePressure: 0.5, downstreamExposure: 0.5 };
}

function cloneWithoutBranchProxy(point) {
  return { ...point, networkBranch: 0 };
}

export function runWaterSensitivityAnalysis({
  scenario,
  domain,
  calibrationSettings = {},
  splitSeeds = [1901, 2903, 4001, 6101]
} = {}) {
  const observations = (scenario?.observations ?? []).filter((entry) => Number.isFinite(entry.observedValue));
  const indicator = scenario?.model?.indicator ?? "temperature";
  if (observations.length < 6) {
    return {
      available: false,
      reason: "At least six compatible Water observations are required for the Water robustness lab.",
      observationCount: observations.length,
      rows: []
    };
  }
  const inference = scenario.model?.waterInference ?? {};
  const baseSettings = {
    indicator,
    lengthScaleMultiplier: calibrationSettings.lengthScaleMultiplier ?? inference.lengthScaleMultiplier ?? 1,
    measurementNoise: calibrationSettings.measurementNoise ?? inference.measurementNoise ?? 0.06,
    flowRegime: calibrationSettings.flowRegime ?? inference.flowRegime ?? "moderate",
    transportAngle: scenario.model?.transportAngle ?? domain.transportAngle ?? 0
  };
  const rows = [];
  for (const seed of splitSeeds) {
    rows.push(validationRow(`locked split ${seed}`, runWaterValidationExperiment(observations, domain, baseSettings, { seed })));
  }

  const angleOffsets = [-20, 0, 20];
  const regimes = ["isotropic", "moderate", "strong"];
  for (const flowRegime of regimes) {
    for (const offsetDegrees of angleOffsets) {
      const transportAngle = baseSettings.transportAngle + offsetDegrees * Math.PI / 180;
      const result = runWaterValidationExperiment(observations, domain, {
        ...baseSettings,
        flowRegime,
        transportAngle
      }, { seed: splitSeeds[0] });
      const metrics = result?.available ? result.locked?.lumos : null;
      rows.push({
        analysis: "flow_covariance_sensitivity",
        condition: `${flowRegime} · angle ${offsetDegrees >= 0 ? "+" : ""}${offsetDegrees}°`,
        available: Boolean(result?.available),
        flowRegime,
        offsetDegrees,
        rmse: metrics?.rmse ?? null,
        mae: metrics?.mae ?? null,
        coverage95: metrics?.coverage95 ?? null
      });
    }
  }

  const baselinePrediction = predictWaterField(scenario.cells, observations, domain, baseSettings);
  const baselineMean = mean([...baselinePrediction.means]);
  const scenarios = [
    { label: "all compatible observations", samples: observations, points: scenario.cells, settings: baseSettings },
    { label: "deterministic 25% station loss", samples: subsetDeterministic(observations, 0.75, 1), points: scenario.cells, settings: baseSettings },
    { label: "higher-reliability observations", samples: observations.filter((entry) => (entry.reliability ?? 0) >= 0.9), points: scenario.cells, settings: baseSettings },
    { label: "provisional observations removed", samples: observations.filter((entry) => !(entry.qualifiers ?? []).some((value) => /p|provisional/i.test(String(value)))), points: scenario.cells, settings: baseSettings },
    { label: "doubled measurement noise", samples: observations.map((entry) => ({ ...entry, sensorNoise: (entry.sensorNoise ?? 0.05) * 2 })), points: scenario.cells, settings: { ...baseSettings, measurementNoise: baseSettings.measurementNoise * 2 } },
    { label: "source proxy neutralized", samples: observations.map(cloneWithoutSourceProxy), points: scenario.cells.map(cloneWithoutSourceProxy), settings: baseSettings },
    { label: "branch proxy removed", samples: observations.map(cloneWithoutBranchProxy), points: scenario.cells.map(cloneWithoutBranchProxy), settings: { ...baseSettings, flowRegime: { key: "no-branch", label: "No branch penalty", along: inference.gpAlongScale ?? 2, across: inference.gpAcrossScale ?? 0.48, branchPenalty: 0 } } }
  ];
  for (const entry of scenarios) {
    if (entry.samples.length < 3) {
      rows.push({ analysis: "observation_robustness", condition: entry.label, available: false, observationCount: entry.samples.length });
      continue;
    }
    const prediction = predictWaterField(entry.points, entry.samples, domain, entry.settings);
    const posteriorMean = mean([...prediction.means]);
    rows.push({
      analysis: "observation_robustness",
      condition: entry.label,
      available: true,
      observationCount: entry.samples.length,
      meanPosterior: posteriorMean,
      meanPosteriorShift: Number.isFinite(baselineMean) && Number.isFinite(posteriorMean) ? posteriorMean - baselineMean : null,
      meanPredictiveSd: mean([...prediction.variances].map(Math.sqrt)),
      residualScale: prediction.trend.realResidualScale
    });
  }

  const validationRows = rows.filter((row) => row.analysis === "validation_stability" && Number.isFinite(row.rmse));
  const covarianceRows = rows.filter((row) => row.analysis === "flow_covariance_sensitivity" && Number.isFinite(row.rmse));
  return {
    available: true,
    indicator,
    observationCount: observations.length,
    generatedAt: new Date().toISOString(),
    summary: {
      meanLockedRmse: mean(validationRows.map((row) => row.rmse)),
      meanCoverage95: mean(validationRows.map((row) => row.coverage95)),
      bestFlowCondition: [...covarianceRows].sort((left, right) => left.rmse - right.rmse)[0]?.condition ?? null,
      splitCount: validationRows.length,
      covarianceRuns: covarianceRows.length,
      robustnessRuns: rows.filter((row) => row.analysis === "observation_robustness").length
    },
    rows
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToWaterSensitivityCsv(rows = []) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
