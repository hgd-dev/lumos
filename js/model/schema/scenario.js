const REQUIRED_CELL_FIELDS = [
  "id", "x", "y", "risk", "uncertainty", "exposure",
  "vulnerability", "communityPriority", "ecology", "communityGroup"
];

const REQUIRED_CANDIDATE_FIELDS = [
  "id", "x", "y", "cost", "feasibility", "reliability", "feasible"
];

function assertFinite(record, field, label) {
  if (!Number.isFinite(record[field])) {
    throw new TypeError(`${label}.${field} must be a finite number.`);
  }
}

export function validateScenario(scenario) {
  if (!scenario || typeof scenario !== "object") {
    throw new TypeError("A LUMOS scenario object is required.");
  }
  if (!Array.isArray(scenario.cells) || scenario.cells.length === 0) {
    throw new TypeError("scenario.cells must be a non-empty array.");
  }
  if (!Array.isArray(scenario.candidates) || scenario.candidates.length === 0) {
    throw new TypeError("scenario.candidates must be a non-empty array.");
  }

  scenario.cells.forEach((cell, index) => {
    for (const field of REQUIRED_CELL_FIELDS) {
      if (!(field in cell)) throw new TypeError(`cell[${index}] is missing ${field}.`);
    }
    for (const field of REQUIRED_CELL_FIELDS.filter((field) => field !== "id")) {
      assertFinite(cell, field, `cell[${index}]`);
    }
  });

  scenario.candidates.forEach((candidate, index) => {
    for (const field of REQUIRED_CANDIDATE_FIELDS) {
      if (!(field in candidate)) throw new TypeError(`candidate[${index}] is missing ${field}.`);
    }
    for (const field of REQUIRED_CANDIDATE_FIELDS.filter((field) => !["id", "feasible"].includes(field))) {
      assertFinite(candidate, field, `candidate[${index}]`);
    }
  });

  if (scenario.observations && !Array.isArray(scenario.observations)) {
    throw new TypeError("scenario.observations must be an array when provided.");
  }

  return scenario;
}

export function toLumosDataset(scenario) {
  validateScenario(scenario);
  return {
    metadata: {
      seed: scenario.seed,
      domainKey: scenario.domainKey,
      center: scenario.center,
      bounds: scenario.bounds,
      model: scenario.model ?? {}
    },
    evaluationPoints: scenario.cells,
    candidateSites: scenario.candidates,
    observations: scenario.observations ?? [],
    socialGroups: [...new Set(scenario.cells.map((cell) => cell.communityGroup))]
  };
}
