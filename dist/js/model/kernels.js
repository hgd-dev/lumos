function rotate(dx, dy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    parallel: dx * cos + dy * sin,
    perpendicular: -dx * sin + dy * cos
  };
}

function gaussian(distanceSquared, sigma) {
  return Math.exp(-distanceSquared / (2 * sigma * sigma));
}

export function influence(candidate, cell, domain, influenceScale = 1) {
  const dx = cell.x - candidate.x;
  const dy = cell.y - candidate.y;
  const sigma = domain.kernelSigma * influenceScale;

  if (domain.kernel === "air") {
    const wind = rotate(dx, dy, candidate.windAngle ?? Math.PI / 6);
    const along = sigma * 1.9;
    const across = sigma * 0.62;
    const directionalDistance = (wind.parallel * wind.parallel) / (along * along)
      + (wind.perpendicular * wind.perpendicular) / (across * across);
    const downwindBoost = wind.parallel >= -0.025 ? 1 : 0.45;
    return Math.min(1, Math.exp(-0.5 * directionalDistance) * downwindBoost);
  }

  if (domain.kernel === "soil") {
    const distance = Math.hypot(dx, dy);
    const local = gaussian(distance * distance, sigma);
    const similarity = 1 - Math.min(1, Math.abs((candidate.landClass ?? 0.5) - (cell.landClass ?? 0.5)));
    return local * (0.45 + 0.55 * similarity);
  }

  if (domain.kernel === "water") {
    const flow = rotate(dx, dy, candidate.flowAngle ?? Math.PI / 2.8);
    const along = sigma * 1.8;
    const across = sigma * 0.42;
    const networkDistance = (flow.parallel * flow.parallel) / (along * along)
      + (flow.perpendicular * flow.perpendicular) / (across * across);
    const directionFactor = flow.parallel >= -0.015 ? 1 : 0.35;
    const sameBranch = 1 - Math.min(0.75, Math.abs((candidate.networkBranch ?? 0) - (cell.networkBranch ?? 0)) * 0.28);
    return Math.min(1, Math.exp(-0.5 * networkDistance) * directionFactor * sameBranch);
  }

  if (domain.kernel === "heat") {
    const distanceSquared = dx * dx + dy * dy;
    const morphologyFactor = 0.75 + 0.25 * (1 - Math.abs((candidate.builtForm ?? 0.5) - (cell.builtForm ?? 0.5)));
    return gaussian(distanceSquared, sigma) * morphologyFactor;
  }

  return gaussian(dx * dx + dy * dy, sigma);
}

export function candidateDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
