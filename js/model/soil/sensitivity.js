import { runSoilValidationExperiment, predictSoilField } from "./inference.js";

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
    sampleCount: result?.count ?? ((result?.developmentCount ?? 0) + (result?.lockedCount ?? 0)),
    lockedCount: result?.lockedCount ?? 0,
    rmse: metrics?.rmse ?? null,
    mae: metrics?.mae ?? null,
    bias: metrics?.bias ?? null,
    coverage95: metrics?.coverage95 ?? null
  };
}

export function runSoilSensitivityAnalysis({
  scenario,
  domain,
  calibrationSettings = {},
  splitSeeds = [1601, 2719, 4049, 6151]
} = {}) {
  const observations = (scenario?.observations ?? []).filter((entry) => Number.isFinite(entry.observedValue));
  const analyte = scenario?.model?.labAnalyte ?? scenario?.model?.property ?? "ph";
  if (observations.length < 6) {
    return {
      available: false,
      reason: "At least six compatible laboratory samples are required for the Soil robustness lab.",
      sampleCount: observations.length,
      rows: []
    };
  }
  const baseSettings = {
    analyte,
    lengthScaleMultiplier: calibrationSettings.lengthScaleMultiplier ?? scenario.model?.soilInference?.lengthScaleMultiplier ?? 1,
    measurementNoise: calibrationSettings.measurementNoise ?? scenario.model?.soilInference?.measurementNoise ?? 0.07
  };
  const rows = [];
  for (const seed of splitSeeds) {
    rows.push(validationRow(`locked split ${seed}`, runSoilValidationExperiment(observations, domain, baseSettings, { seed })));
  }

  const covarianceGrid = [0.65, 0.85, 1, 1.2, 1.45];
  const noiseGrid = [0.035, 0.07, 0.12];
  for (const lengthScaleMultiplier of covarianceGrid) {
    for (const measurementNoise of noiseGrid) {
      const result = runSoilValidationExperiment(observations, domain, {
        ...baseSettings,
        lengthScaleMultiplier,
        measurementNoise
      }, { seed: splitSeeds[0] });
      const metrics = result?.available ? result.locked?.lumos : null;
      rows.push({
        analysis: "covariance_sensitivity",
        condition: `length ${lengthScaleMultiplier.toFixed(2)} · noise ${measurementNoise.toFixed(3)}`,
        available: Boolean(result?.available),
        lengthScaleMultiplier,
        measurementNoise,
        rmse: metrics?.rmse ?? null,
        mae: metrics?.mae ?? null,
        coverage95: metrics?.coverage95 ?? null
      });
    }
  }

  const scenarios = [
    { label: "all compatible samples", samples: observations, noiseMultiplier: 1 },
    { label: "deterministic 25% sample loss", samples: subsetDeterministic(observations, 0.75, 1), noiseMultiplier: 1 },
    { label: "higher-reliability samples", samples: observations.filter((entry) => (entry.reliability ?? 0) >= 0.8), noiseMultiplier: 1 },
    { label: "doubled measurement noise", samples: observations, noiseMultiplier: 2 }
  ];
  for (const entry of scenarios) {
    if (entry.samples.length < 3) {
      rows.push({ analysis: "sample_robustness", condition: entry.label, available: false, sampleCount: entry.samples.length });
      continue;
    }
    const prediction = predictSoilField(scenario.cells, entry.samples.map((sample) => ({
      ...sample,
      sensorNoise: (sample.sensorNoise ?? 0) * entry.noiseMultiplier
    })), domain, {
      ...baseSettings,
      measurementNoise: baseSettings.measurementNoise * entry.noiseMultiplier
    });
    rows.push({
      analysis: "sample_robustness",
      condition: entry.label,
      available: true,
      sampleCount: entry.samples.length,
      meanPosterior: mean([...prediction.means]),
      meanPredictiveSd: mean([...prediction.variances].map(Math.sqrt)),
      residualScale: prediction.trend.residualScale
    });
  }

  const validationRows = rows.filter((row) => row.analysis === "validation_stability" && Number.isFinite(row.rmse));
  return {
    available: true,
    analyte,
    sampleCount: observations.length,
    generatedAt: new Date().toISOString(),
    summary: {
      meanLockedRmse: mean(validationRows.map((row) => row.rmse)),
      meanCoverage95: mean(validationRows.map((row) => row.coverage95)),
      splitCount: validationRows.length,
      covarianceRuns: rows.filter((row) => row.analysis === "covariance_sensitivity").length,
      robustnessRuns: rows.filter((row) => row.analysis === "sample_robustness").length
    },
    rows
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToSoilSensitivityCsv(rows = []) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}
