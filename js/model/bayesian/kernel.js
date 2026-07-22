const SQRT_THREE = Math.sqrt(3);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotate(dx, dy, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    parallel: dx * cosine + dy * sine,
    perpendicular: -dx * sine + dy * cosine
  };
}

function matern32(distance) {
  const scaled = SQRT_THREE * Math.max(0, distance);
  return (1 + scaled) * Math.exp(-scaled);
}

function epistemicScale(point) {
  const uncertainty = Number.isFinite(point.uncertainty)
    ? point.uncertainty
    : Number.isFinite(point.localUncertainty)
      ? point.localUncertainty
      : 0.5;
  return 0.16 + 0.84 * clamp(uncertainty, 0, 1);
}

function spatialDistance(a, b, domain, modelSettings = {}) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const baseLength = Math.max(0.012, domain.gpLengthScale ?? domain.kernelSigma ?? 0.1);
  const lengthScale = baseLength * (modelSettings.lengthScaleMultiplier ?? 1);

  if (domain.kernel === "air") {
    const angle = modelSettings.transportAngle
      ?? domain.transportAngle
      ?? Math.PI * 0.16;
    const rotated = rotate(dx, dy, angle);
    const along = lengthScale * (domain.gpAlongScale ?? 2.2);
    const across = lengthScale * (domain.gpAcrossScale ?? 0.58);
    return Math.hypot(rotated.parallel / along, rotated.perpendicular / across);
  }

  if (domain.kernel === "water") {
    const angle = modelSettings.transportAngle
      ?? domain.transportAngle
      ?? Math.PI * 0.3;
    const rotated = rotate(dx, dy, angle);
    const along = lengthScale * (domain.gpAlongScale ?? 2.0);
    const across = lengthScale * (domain.gpAcrossScale ?? 0.48);
    const branchDistance = Math.abs((a.networkBranch ?? 0) - (b.networkBranch ?? 0));
    return Math.hypot(rotated.parallel / along, rotated.perpendicular / across, branchDistance * 0.72);
  }

  return Math.hypot(dx, dy) / lengthScale;
}

function contextualSimilarity(a, b, domain) {
  if (domain.kernel === "soil") {
    const difference = ((a.landClass ?? 0.5) - (b.landClass ?? 0.5)) / 0.24;
    return Math.exp(-0.5 * difference * difference);
  }

  if (domain.kernel === "heat") {
    const difference = ((a.builtForm ?? 0.5) - (b.builtForm ?? 0.5)) / 0.32;
    return 0.55 + 0.45 * Math.exp(-0.5 * difference * difference);
  }

  return 1;
}

export function latentCovariance(a, b, domain, modelSettings = {}) {
  const distance = spatialDistance(a, b, domain, modelSettings);
  const correlation = matern32(distance) * contextualSimilarity(a, b, domain);
  return epistemicScale(a) * epistemicScale(b) * correlation;
}

export function latentVariance(point) {
  const scale = epistemicScale(point);
  return scale * scale;
}

export function measurementNoiseVariance(site, modelSettings = {}) {
  const baseNoise = Math.max(0.0025, modelSettings.measurementNoise ?? 0.06);
  const reliability = clamp(site.reliability ?? 0.9, 0.08, 1);
  const feasibility = clamp(site.feasibility ?? 1, 0.08, 1);
  const sensorNoise = Math.max(0, site.sensorNoise ?? 0);
  return (baseNoise * baseNoise + sensorNoise * sensorNoise) / (reliability * feasibility);
}
