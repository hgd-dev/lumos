function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function bump(x, y, cx, cy, radius, amplitude = 1) {
  const distanceSquared = (x - cx) ** 2 + (y - cy) ** 2;
  return amplitude * Math.exp(-distanceSquared / (2 * radius * radius));
}

function ridge(x, y, slope, intercept, width, amplitude = 1) {
  const distance = Math.abs(y - (slope * x + intercept)) / Math.sqrt(slope * slope + 1);
  return amplitude * Math.exp(-(distance * distance) / (2 * width * width));
}

function domainFields(domainKey, x, y, random) {
  const basePopulation = clamp(
    0.1
    + bump(x, y, 0.32, 0.63, 0.18, 1.0)
    + bump(x, y, 0.71, 0.39, 0.15, 0.85)
    + ridge(x, y, -0.35, 0.76, 0.05, 0.35)
  );
  const vulnerability = clamp(
    0.08
    + bump(x, y, 0.22, 0.76, 0.17, 0.85)
    + bump(x, y, 0.76, 0.29, 0.18, 0.55)
  );
  const communityPriority = clamp(
    0.04
    + bump(x, y, 0.18, 0.55, 0.09, 1.0)
    + bump(x, y, 0.81, 0.71, 0.11, 0.75)
  );
  const ecology = clamp(
    0.05
    + bump(x, y, 0.57, 0.82, 0.18, 0.85)
    + ridge(x, y, 0.12, 0.08, 0.08, 0.45)
  );

  if (domainKey === "heat") {
    const risk = clamp(0.12 + bump(x, y, 0.38, 0.55, 0.17, 0.9) + bump(x, y, 0.76, 0.34, 0.15, 0.75) - ecology * 0.28);
    const uncertainty = clamp(0.12 + bump(x, y, 0.64, 0.68, 0.2, 0.75) + random() * 0.08);
    return { risk, uncertainty, exposure: basePopulation, vulnerability, communityPriority, ecology };
  }

  if (domainKey === "air") {
    const road = ridge(x, y, -0.42, 0.83, 0.035, 0.85);
    const industry = bump(x, y, 0.78, 0.62, 0.09, 1.0);
    const plume = ridge(x, y, -0.18, 0.76, 0.1, 0.55) * Math.max(0, x - 0.38);
    const risk = clamp(0.08 + road + industry + plume);
    const uncertainty = clamp(0.1 + bump(x, y, 0.5, 0.45, 0.23, 0.7) + random() * 0.1);
    return { risk, uncertainty, exposure: clamp(basePopulation + road * 0.2), vulnerability, communityPriority, ecology };
  }

  if (domainKey === "soil") {
    const industrialLegacy = bump(x, y, 0.73, 0.66, 0.08, 1.0) + bump(x, y, 0.24, 0.33, 0.07, 0.75);
    const risk = clamp(0.05 + industrialLegacy + random() * 0.04);
    const uncertainty = clamp(0.16 + bump(x, y, 0.47, 0.48, 0.3, 0.7) + random() * 0.12);
    return { risk, uncertainty, exposure: clamp(basePopulation * 0.85), vulnerability, communityPriority, ecology };
  }

  if (domainKey === "water") {
    const channel = ridge(x, y, 0.18, 0.2, 0.055, 0.85);
    const upstream = bump(x, y, 0.25, 0.27, 0.1, 0.85);
    const risk = clamp(0.06 + channel * 0.45 + upstream);
    const uncertainty = clamp(0.12 + bump(x, y, 0.68, 0.58, 0.25, 0.72) + random() * 0.08);
    return { risk, uncertainty, exposure: clamp(basePopulation * 0.9), vulnerability, communityPriority, ecology: clamp(ecology + channel * 0.25) };
  }

  const risk = clamp(0.08 + bump(x, y, 0.73, 0.63, 0.13, 0.9) + ridge(x, y, -0.32, 0.74, 0.04, 0.55));
  const uncertainty = clamp(0.1 + bump(x, y, 0.48, 0.46, 0.28, 0.75) + random() * 0.08);
  return { risk, uncertainty, exposure: basePopulation, vulnerability, communityPriority, ecology };
}

export function generateScenario(domainKey, seed = 20260721) {
  const random = mulberry32(seed + domainKey.length * 173);
  const gridSize = 29;
  const cells = [];
  const center = { lat: 39.7392, lng: -104.9903 };
  const latSpan = 0.17;
  const lngSpan = 0.22;

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const x = column / (gridSize - 1);
      const y = row / (gridSize - 1);
      const fields = domainFields(domainKey, x, y, random);
      const communityGroup = x < 0.5 ? (y < 0.5 ? 0 : 1) : (y < 0.5 ? 2 : 3);
      cells.push({
        id: `cell-${row}-${column}`,
        x,
        y,
        lat: center.lat + (y - 0.5) * latSpan,
        lng: center.lng + (x - 0.5) * lngSpan,
        communityGroup,
        landClass: clamp(0.25 + 0.5 * x + 0.2 * Math.sin(y * Math.PI * 3)),
        builtForm: clamp(0.2 + fields.exposure * 0.7),
        networkBranch: Math.min(3, Math.floor((x + y * 0.35) * 3)),
        ...fields
      });
    }
  }

  const candidates = [];
  const candidateSize = 13;
  for (let row = 0; row < candidateSize; row += 1) {
    for (let column = 0; column < candidateSize; column += 1) {
      const x = (column + 0.35 + random() * 0.3) / candidateSize;
      const y = (row + 0.35 + random() * 0.3) / candidateSize;
      const nearest = cells.reduce((best, cell) => {
        const distance = (cell.x - x) ** 2 + (cell.y - y) ** 2;
        return distance < best.distance ? { cell, distance } : best;
      }, { cell: cells[0], distance: Infinity }).cell;
      const accessPenalty = nearest.ecology > 0.78 && random() < 0.38;
      candidates.push({
        id: `candidate-${row}-${column}`,
        x,
        y,
        lat: center.lat + (y - 0.5) * latSpan,
        lng: center.lng + (x - 0.5) * lngSpan,
        cost: clamp(0.55 + random() * 0.7, 0.3, 1.3),
        feasibility: accessPenalty ? 0.25 : clamp(0.74 + random() * 0.25),
        feasible: !accessPenalty,
        reliability: clamp(0.75 + random() * 0.23),
        localRisk: nearest.risk,
        localUncertainty: nearest.uncertainty,
        landClass: nearest.landClass,
        builtForm: nearest.builtForm,
        networkBranch: nearest.networkBranch,
        windAngle: Math.PI * (0.12 + random() * 0.18),
        flowAngle: Math.PI * (0.24 + random() * 0.12)
      });
    }
  }

  const observationIndices = [8, 34, 72, 96, 132, 158]
    .filter((index) => index < candidates.length);
  const observations = observationIndices.map((index, observationIndex) => {
    const site = candidates[index];
    const nearest = cells.reduce((best, cell) => {
      const distance = (cell.x - site.x) ** 2 + (cell.y - site.y) ** 2;
      return distance < best.distance ? { cell, distance } : best;
    }, { cell: cells[0], distance: Infinity }).cell;
    return {
      ...site,
      id: `existing-${observationIndex + 1}`,
      existing: true,
      observedValue: clamp(nearest.risk + (random() - 0.5) * 0.08),
      sensorNoise: 0.025 + random() * 0.02,
      reliability: clamp(0.88 + random() * 0.1),
      feasibility: 1
    };
  });

  return {
    seed,
    domainKey,
    center,
    bounds: [
      [center.lat - latSpan / 2, center.lng - lngSpan / 2],
      [center.lat + latSpan / 2, center.lng + lngSpan / 2]
    ],
    model: {
      transportAngle: domainKey === "air" ? Math.PI * 0.16 : domainKey === "water" ? Math.PI * 0.3 : 0
    },
    cells,
    candidates,
    observations
  };
}
