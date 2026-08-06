const intro = document.querySelector("#protocolIntro");
const circuitLayer = document.querySelector("#protocolCircuitLayer");
const canvas = document.querySelector("#protocolParticleCanvas");
const skipButton = document.querySelector("#protocolSkipButton");
const statusIndex = document.querySelector("#protocolStatusIndex");
const statusLabel = document.querySelector("#protocolStatusLabel");
const statusDetail = document.querySelector("#protocolStatusDetail");
const progressBar = document.querySelector("#protocolProgressBar");
const protocolClock = document.querySelector("#protocolClock");

if (!intro || !circuitLayer || !canvas) {
  throw new Error("LUMOSLab intro could not initialize: required interface elements are missing.");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const compactViewport = window.matchMedia("(max-width: 700px)");
const NS = "http://www.w3.org/2000/svg";
const CENTER = { x: 800, y: 450 };
const DOMAIN_COLORS = {
  heat: "#ffb45f",
  air: "#8fd7ff",
  soil: "#d8bf75",
  water: "#78a9ff"
};
const DOMAIN_ENDPOINTS = {
  heat: { x: 758, y: 414 },
  air: { x: 842, y: 414 },
  soil: { x: 758, y: 486 },
  water: { x: 842, y: 486 }
};

let timers = [];
let runStartedAt = 0;
let clockFrame = 0;
let particleFrame = 0;
let pulses = [];
let particleState = null;
let running = false;

const stages = [
  { className: "is-booted", label: "INITIALIZING LOCAL SYSTEM", detail: "Preparing edge-to-core convergence routing" },
  { className: "is-circuits", label: "ROUTING CONVERGENCE PATHS", detail: "Circuit branches are resolving toward the unified core" },
  { className: "is-core", label: "UNIFIED DECISION CORE ACTIVE", detail: "Uncertainty, equity, feasibility, cost, and robustness aligned" },
  { className: "is-network", label: "ASSEMBLING GEOGRAPHIC NETWORK", detail: "Candidate sites evaluated and deployment nodes selected" },
  { className: "is-scenarios", label: "BRANCHING DECISION SPACE", detail: "Efficiency, equity, and resilience alternatives generated" },
  { className: "is-title", label: "LUMOSLAB READY", detail: "Build plans. Test assumptions. Make decisions." }
];

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function element(name, attributes = {}) {
  const node = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function orthogonalPath(points) {
  return points.map((point, index) => `${index ? "L" : "M"}${Math.round(point.x)} ${Math.round(point.y)}`).join(" ");
}

function createTrace({ domain, points, delay, duration, width = 1.5, branch = false }) {
  const path = element("path", {
    d: orthogonalPath(points),
    pathLength: 1,
    class: `protocol-trace${branch ? " trace-branch" : ""}`,
    "data-domain": domain
  });
  path.style.setProperty("--trace-color", DOMAIN_COLORS[domain]);
  path.style.setProperty("--trace-delay", `${delay}ms`);
  path.style.setProperty("--trace-duration", `${duration}ms`);
  path.style.setProperty("--trace-width", width);
  circuitLayer.append(path);
  return path;
}

function createJunction(domain, point, delay, radius = 3) {
  const junction = element("circle", {
    cx: point.x,
    cy: point.y,
    r: radius,
    class: "protocol-junction"
  });
  junction.style.setProperty("--trace-color", DOMAIN_COLORS[domain]);
  junction.style.setProperty("--junction-delay", `${delay}ms`);
  circuitLayer.append(junction);
}

function buildCircuitNetwork() {
  circuitLayer.replaceChildren();
  pulses = [];
  const random = seededRandom(4000);
  const definitions = [
    { domain: "heat", edge: "left", min: 120, max: 340 },
    { domain: "air", edge: "right", min: 110, max: 340 },
    { domain: "soil", edge: "left", min: 565, max: 790 },
    { domain: "water", edge: "right", min: 560, max: 790 }
  ];

  definitions.forEach((definition, domainIndex) => {
    const endpoint = DOMAIN_ENDPOINTS[definition.domain];
    const direction = definition.edge === "left" ? 1 : -1;
    for (let index = 0; index < 6; index += 1) {
      const startY = definition.min + (definition.max - definition.min) * ((index + .5) / 6) + (random() - .5) * 24;
      const startX = definition.edge === "left" ? -20 : 1620;
      const firstX = definition.edge === "left" ? 175 + random() * 90 : 1425 - random() * 90;
      const secondX = definition.edge === "left" ? 410 + random() * 100 : 1190 - random() * 100;
      const thirdX = definition.edge === "left" ? 610 + random() * 70 : 990 - random() * 70;
      const bendY = startY + (endpoint.y - startY) * (.34 + random() * .12);
      const innerY = endpoint.y + (random() - .5) * 42;
      const points = [
        { x: startX, y: startY },
        { x: firstX, y: startY },
        { x: firstX, y: bendY },
        { x: secondX, y: bendY },
        { x: secondX, y: innerY },
        { x: thirdX, y: innerY },
        { x: thirdX, y: endpoint.y },
        endpoint
      ];
      const delay = domainIndex * 80 + index * 65;
      const duration = 1160 + random() * 520;
      const path = createTrace({ domain: definition.domain, points, delay, duration, width: index % 3 === 0 ? 2.1 : 1.2 });
      createJunction(definition.domain, points[2], delay + duration * .32, index % 3 === 0 ? 4 : 2.5);
      createJunction(definition.domain, points[4], delay + duration * .64, 2.5);
      createJunction(definition.domain, points[6], delay + duration * .84, 3);

      if (index % 2 === 0) {
        const branchDirection = index % 4 === 0 ? -1 : 1;
        const branchStart = points[4];
        const branchEndX = branchStart.x + direction * (72 + random() * 55);
        const branchEndY = branchStart.y + branchDirection * (42 + random() * 36);
        createTrace({
          domain: definition.domain,
          points: [branchStart, { x: branchEndX, y: branchStart.y }, { x: branchEndX, y: branchEndY }],
          delay: delay + 420,
          duration: 520 + random() * 260,
          width: 1,
          branch: true
        });
        createJunction(definition.domain, { x: branchEndX, y: branchEndY }, delay + 920, 2);
      }

      if (index === 1 || index === 4) {
        const pulse = element("circle", { r: index === 1 ? 4.5 : 3.5, class: "protocol-pulse" });
        pulse.style.fill = DOMAIN_COLORS[definition.domain];
        circuitLayer.append(pulse);
        pulses.push({ path, pulse, delay: 180 + domainIndex * 110 + index * 85, speed: 980 + random() * 500 });
      }
    }
  });

  Object.entries(DOMAIN_ENDPOINTS).forEach(([domain, endpoint]) => {
    const path = createTrace({
      domain,
      points: [endpoint, { x: CENTER.x, y: endpoint.y }, CENTER],
      delay: 980,
      duration: 560,
      width: 2.5
    });
    const pulse = element("circle", { r: 5, class: "protocol-pulse" });
    pulse.style.fill = DOMAIN_COLORS[domain];
    circuitLayer.append(pulse);
    pulses.push({ path, pulse, delay: 1100, speed: 760 });
  });
}

function updatePulsePositions(elapsed) {
  if (!running || !intro.classList.contains("is-circuits")) return;
  pulses.forEach(({ path, pulse, delay, speed }) => {
    const length = path.getTotalLength();
    const phase = Math.max(0, elapsed - delay);
    const progress = (phase % speed) / speed;
    const point = path.getPointAtLength(length * progress);
    pulse.setAttribute("cx", point.x);
    pulse.setAttribute("cy", point.y);
    pulse.style.opacity = phase > 0 ? String(.35 + Math.sin(progress * Math.PI) * .62) : "0";
  });
}

function sizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  particleState = createParticles(canvas.width, canvas.height, ratio);
}

function createParticles(width, height, ratio) {
  const random = seededRandom(4040);
  const count = compactViewport.matches ? 48 : 92;
  return Array.from({ length: count }, (_, index) => ({
    x: random() * width,
    y: random() * height,
    radius: (.35 + random() * 1.1) * ratio,
    alpha: .08 + random() * .36,
    speed: (.06 + random() * .18) * ratio,
    drift: (random() - .5) * .08 * ratio,
    color: ["#bdfc6b", "#69c3b0", "#8fd7ff", "#78a9ff"][index % 4]
  }));
}

function drawParticles() {
  const context = canvas.getContext("2d");
  if (!context || !particleState) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  particleState.forEach((particle) => {
    particle.y -= particle.speed;
    particle.x += particle.drift;
    if (particle.y < -4) particle.y = canvas.height + 4;
    if (particle.x < -4) particle.x = canvas.width + 4;
    if (particle.x > canvas.width + 4) particle.x = -4;
    context.globalAlpha = particle.alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
}

function animationFrame(now) {
  if (!running) return;
  const elapsed = now - runStartedAt;
  if (protocolClock) protocolClock.textContent = `T+${(elapsed / 1000).toFixed(1).padStart(4, "0")}`;
  updatePulsePositions(elapsed);
  drawParticles();
  clockFrame = requestAnimationFrame(animationFrame);
}

function clearTimers() {
  timers.forEach(window.clearTimeout);
  timers = [];
  cancelAnimationFrame(clockFrame);
  cancelAnimationFrame(particleFrame);
}

function setStatus(index) {
  const stage = stages[index];
  if (!stage) return;
  statusIndex.textContent = String(index + 1).padStart(2, "0");
  statusLabel.textContent = stage.label;
  statusDetail.textContent = stage.detail;
}

function finishProtocol({ immediate = false } = {}) {
  if (!running && intro.classList.contains("is-complete")) return;
  running = false;
  clearTimers();
  progressBar.style.width = "100%";
  intro.classList.add("is-complete");
  document.body.classList.remove("lab-intro-running");
  document.documentElement.style.removeProperty("overflow");
  window.setTimeout(() => {
    intro.setAttribute("aria-hidden", "true");
    if (!immediate) document.querySelector("#labTitle")?.focus?.({ preventScroll: true });
  }, immediate ? 0 : 850);
}

function resetProtocol() {
  clearTimers();
  stages.forEach((stage) => intro.classList.remove(stage.className));
  intro.classList.remove("is-complete");
  intro.removeAttribute("aria-hidden");
  document.body.classList.add("lab-intro-running");
  document.documentElement.style.overflow = "hidden";
  progressBar.style.width = "0%";
  protocolClock.textContent = "T+00.0";
  setStatus(0);
  pulses.forEach(({ pulse }) => { pulse.style.opacity = "0"; });
}

function playProtocol() {
  resetProtocol();
  running = true;
  runStartedAt = performance.now();
  requestAnimationFrame(animationFrame);

  const reduce = reducedMotion.matches;
  const compact = compactViewport.matches;
  const timing = reduce
    ? [30, 120, 220, 310, 390, 470, 900]
    : compact
      ? [120, 760, 2100, 3000, 3950, 4700, 5900]
      : [160, 900, 2600, 3650, 4750, 5700, 7000];
  const total = timing[timing.length - 1];

  stages.forEach((stage, index) => {
    timers.push(window.setTimeout(() => {
      intro.classList.add(stage.className);
      setStatus(index);
    }, timing[index]));
  });

  const progressStart = performance.now();
  const updateProgress = (now) => {
    if (!running) return;
    const ratio = Math.min(1, (now - progressStart) / total);
    progressBar.style.width = `${ratio * 100}%`;
    if (ratio < 1) particleFrame = requestAnimationFrame(updateProgress);
  };
  particleFrame = requestAnimationFrame(updateProgress);
  timers.push(window.setTimeout(() => finishProtocol(), total));
}

skipButton?.addEventListener("click", () => finishProtocol({ immediate: false }));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && running) finishProtocol({ immediate: false });
});
window.addEventListener("resize", sizeCanvas, { passive: true });
reducedMotion.addEventListener?.("change", () => {
  if (running) playProtocol();
});

buildCircuitNetwork();
sizeCanvas();

const params = new URLSearchParams(window.location.search);
if (params.get("skip") === "1") finishProtocol({ immediate: true });
else playProtocol();
