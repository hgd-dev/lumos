const track = document.querySelector("#spiralSequence");
const viewport = document.querySelector("#spiralViewport");
const orbit = document.querySelector("#spiralOrbit");
const cards = Array.from(document.querySelectorAll(".spiral-item"));
const ghostItems = Array.from(document.querySelectorAll("#motionGhostOrbit > span"));
const ghostLabel = document.querySelector("#motionGhostLabel");
const typingWord = document.querySelector("#motionTypingWord");
const particleCanvas = document.querySelector("#spiralParticleCanvas");
const counter = document.querySelector("#spiralCounter");
const activeIndex = document.querySelector("#spiralActiveIndex");
const activeTitle = document.querySelector("#spiralActiveTitle");
const sceneCode = document.querySelector("#motionSceneCode");
const progressControl = document.querySelector("#spiralProgress");
const status = document.querySelector("#spiralStatus");
const rootStyle = document.documentElement.style;
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia?.("(pointer: coarse)");

const SCENE_CENTERS = [0, 0.16, 0.32, 0.48, 0.64, 0.8];
const SCENE_INNER_RADIUS = 0.019;
const SCENE_OUTER_RADIUS = 0.051;
const SCENE_INTERVAL = 0.16;
const SNAP_RADIUS = 0.03;
const SNAP_DELAY = 145;
const STAGE_BLACK_START = 0.92;
const STAGE_BLACK_END = 0.945;
const STAGE_FADE_START = 0.95;
const STAGE_FADE_END = 0.972;
const CONTENT_REVEAL_START = 0.975;
const CONTENT_REVEAL_END = 0.998;
const TYPING_WORDS = ["monitoring", "intervention", "planning", "optimization", "deployment", "evaluation"];

let activeCard = -1;
let reduced = false;
let stageIntersecting = true;
let frameRequested = false;
let snapTimer = 0;
let snappingUntil = 0;
let resizeFrame = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let pointerX = 0;
let pointerY = 0;
let lastProgress = -1;
let typingTimer = 0;
let typingWordIndex = 0;
let typingCharacterIndex = TYPING_WORDS[0].length;
let typingPhase = "hold";

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function scrollMetrics() {
  if (!track) return { start: 0, range: 1 };
  const start = track.offsetTop;
  return { start, range: Math.max(1, track.offsetHeight - window.innerHeight) };
}

function scrollProgress() {
  const { start, range } = scrollMetrics();
  return clamp((window.scrollY - start) / range);
}

function sceneCenter(index) {
  if (SCENE_CENTERS[index] != null) return SCENE_CENTERS[index];
  return SCENE_CENTERS[0] + index * SCENE_INTERVAL;
}

function nearestScene(progress) {
  let nearest = 0;
  let distance = Infinity;
  cards.forEach((_, index) => {
    const nextDistance = Math.abs(progress - sceneCenter(index));
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  });
  return { index: nearest, distance };
}

function scrollToScene(index, behavior = "smooth") {
  const { start, range } = scrollMetrics();
  window.scrollTo({ top: start + sceneCenter(index) * range, behavior });
}

function createProgressControls() {
  if (!progressControl || progressControl.children.length) return;
  cards.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Go to ${card.dataset.spiralTitle || `scene ${index + 1}`}`);
    button.addEventListener("click", () => scrollToScene(index));
    progressControl.append(button);
  });
}

function setInteractiveState(card, enabled) {
  card.querySelectorAll("a, button, input, select, textarea").forEach((element) => {
    if (enabled) element.removeAttribute("tabindex");
    else element.setAttribute("tabindex", "-1");
  });
}

function setActiveCard(index) {
  if (index === activeCard || index < 0 || index >= cards.length) return;
  activeCard = index;
  const card = cards[index];
  cards.forEach((item, itemIndex) => {
    const selected = itemIndex === index;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-hidden", selected ? "false" : "true");
    setInteractiveState(item, selected || reduced);
  });
  Array.from(progressControl?.children || []).forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
    if (buttonIndex === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  if (counter) counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
  if (activeIndex) activeIndex.textContent = String(index).padStart(2, "0");
  if (activeTitle) activeTitle.textContent = card.dataset.spiralTitle || `Scene ${index + 1}`;
  if (sceneCode) sceneCode.textContent = card.dataset.sceneCode || "LUMOS / SYSTEM";
  if (status) status.textContent = `Motion scene ${index + 1} of ${cards.length}: ${card.dataset.spiralTitle || "LUMOS"}.`;
  rootStyle.setProperty("--motion-accent", card.dataset.accent || "#bdfc6b");
  rootStyle.setProperty("--motion-accent-rgb", card.dataset.accentRgb || "189,252,107");
}

function cardOpacity(distance) {
  const absolute = Math.abs(distance);
  return 1 - smoothstep((absolute - SCENE_INNER_RADIUS) / (SCENE_OUTER_RADIUS - SCENE_INNER_RADIUS));
}

function renderGhostOrbit(progress, gapIntensity) {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  ghostItems.forEach((ghost, index) => {
    const center = sceneCenter(index);
    const offset = (progress - center) / SCENE_INTERVAL;
    const absolute = Math.abs(offset);
    const angle = offset * 1.06 + index * 0.38 + progress * 1.35;
    const x = Math.sin(angle) * width * 0.38 + offset * width * -0.08;
    const y = Math.cos(angle * 0.84) * height * 0.23 + offset * height * -0.17;
    const z = -260 - absolute * 300;
    const proximity = clamp(1 - absolute * 0.5, 0, 1);
    const opacity = (0.012 + gapIntensity * 0.17) * proximity;
    ghost.style.opacity = opacity.toFixed(3);
    ghost.style.visibility = opacity > 0.004 ? "visible" : "hidden";
    ghost.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), ${z.toFixed(1)}px) rotateY(${(offset * -28).toFixed(2)}deg) rotateZ(${(angle * 12).toFixed(2)}deg)`;
  });
}

function renderMotion(force = false) {
  frameRequested = false;
  if (reduced || !track || !viewport || !orbit) return;

  const progress = scrollProgress();
  const pointerEase = force ? 1 : 0.34;
  pointerX = mix(pointerX, targetPointerX, pointerEase);
  pointerY = mix(pointerY, targetPointerY, pointerEase);
  rootStyle.setProperty("--motion-pointer-x", pointerX.toFixed(4));
  rootStyle.setProperty("--motion-pointer-y", pointerY.toFixed(4));
  rootStyle.setProperty("--motion-progress", progress.toFixed(5));

  let maximumOpacity = 0;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);

  cards.forEach((card, index) => {
    const distance = progress - sceneCenter(index);
    const normalized = distance / SCENE_INTERVAL;
    const absoluteNormalized = Math.abs(normalized);
    const opacity = cardOpacity(distance);
    maximumOpacity = Math.max(maximumOpacity, opacity);

    const travel = Math.tanh(normalized * 1.48);
    const x = travel * width * -0.48;
    const y = travel * height * -0.59;
    const z = -absoluteNormalized * 760;
    const rotateX = travel * -4.2;
    const rotateY = travel * 9.5;
    const rotateZ = travel * -7.5;
    const scale = clamp(1 - absoluteNormalized * 0.12, 0.76, 1);
    const visible = opacity > 0.002 && Math.abs(distance) < SCENE_OUTER_RADIUS + 0.016;

    card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    card.style.opacity = opacity.toFixed(3);
    card.style.visibility = visible ? "visible" : "hidden";
    card.style.zIndex = String(50 - Math.round(absoluteNormalized * 10));
    card.style.setProperty("--scene-copy-x", `${(travel * width * 0.025).toFixed(1)}px`);
    card.style.setProperty("--scene-copy-y", `${(travel * height * 0.018).toFixed(1)}px`);
    card.style.setProperty("--scene-plane-x", `${(travel * width * -0.055).toFixed(1)}px`);
    card.style.setProperty("--scene-plane-y", `${(travel * height * -0.035).toFixed(1)}px`);
  });

  const gapIntensity = clamp(1 - maximumOpacity);
  const { index: nearest } = nearestScene(progress);
  setActiveCard(nearest);
  renderGhostOrbit(progress, gapIntensity);
  if (ghostLabel) {
    let leftIndex = nearest;
    let rightIndex = nearest;
    for (let index = 0; index < cards.length - 1; index += 1) {
      if (progress >= sceneCenter(index) && progress <= sceneCenter(index + 1)) {
        leftIndex = index;
        rightIndex = index + 1;
        break;
      }
    }
    ghostLabel.textContent = leftIndex === rightIndex
      ? (cards[nearest]?.dataset.spiralTitle || "LUMOS")
      : `${cards[leftIndex]?.dataset.spiralTitle || "LUMOS"} / ${cards[rightIndex]?.dataset.spiralTitle || "LUMOS"}`;
    ghostLabel.style.opacity = (gapIntensity * 0.28).toFixed(3);
    ghostLabel.style.transform = `translate3d(-50%, -50%, -180px) rotateZ(${(-8 + progress * 13).toFixed(2)}deg) scale(${(0.9 + gapIntensity * 0.08).toFixed(3)})`;
  }

  const blackOverlay = smoothstep((progress - STAGE_BLACK_START) / (STAGE_BLACK_END - STAGE_BLACK_START));
  const stageFade = 1 - smoothstep((progress - STAGE_FADE_START) / (STAGE_FADE_END - STAGE_FADE_START));
  const contentReveal = smoothstep((progress - CONTENT_REVEAL_START) / (CONTENT_REVEAL_END - CONTENT_REVEAL_START));
  const headerOpacity = progress < STAGE_BLACK_START
    ? 1
    : progress < CONTENT_REVEAL_START
      ? 1 - blackOverlay
      : contentReveal;
  rootStyle.setProperty("--motion-gap", gapIntensity.toFixed(4));
  rootStyle.setProperty("--motion-foreground-opacity", (1 - blackOverlay).toFixed(4));
  rootStyle.setProperty("--motion-stage-opacity", stageFade.toFixed(4));
  rootStyle.setProperty("--motion-content-opacity", contentReveal.toFixed(4));
  rootStyle.setProperty("--motion-content-shift", `${((1 - contentReveal) * 80).toFixed(1)}px`);
  rootStyle.setProperty("--motion-header-opacity", headerOpacity.toFixed(4));
  rootStyle.setProperty("--motion-core-rotation", `${(progress * 390 - 18).toFixed(2)}deg`);

  document.body.classList.toggle("spiral-between-scenes", gapIntensity > 0.48 && progress < STAGE_BLACK_START);
  document.body.classList.toggle("spiral-handoff-active", progress >= STAGE_BLACK_START);
  document.body.classList.toggle("spiral-handoff-ready", contentReveal > 0.82);

  lastProgress = progress;
  if (
    Math.abs(pointerX - targetPointerX) > 0.012 ||
    Math.abs(pointerY - targetPointerY) > 0.012
  ) requestFrame();
}

function requestFrame() {
  if (frameRequested || reduced) return;
  frameRequested = true;
  window.requestAnimationFrame(() => renderMotion(false));
}

function maybeSnapToScene() {
  if (reduced || !stageIntersecting || Date.now() < snappingUntil) return;
  const progress = scrollProgress();
  if (progress < SCENE_CENTERS[0] - SNAP_RADIUS || progress > SCENE_CENTERS.at(-1) + SNAP_RADIUS) return;
  const { index, distance } = nearestScene(progress);
  if (distance > 0.0015 && distance <= SNAP_RADIUS) {
    snappingUntil = Date.now() + 620;
    scrollToScene(index, "smooth");
  }
}

function scheduleSceneSnap() {
  window.clearTimeout(snapTimer);
  snapTimer = window.setTimeout(maybeSnapToScene, SNAP_DELAY);
}

function updateFromScroll() {
  if (reduced) return;
  scheduleSceneSnap();
  requestFrame();
}

function scheduleTyping(delay) {
  window.clearTimeout(typingTimer);
  typingTimer = window.setTimeout(runTypingStep, delay);
}

function runTypingStep() {
  if (!typingWord) return;
  if (reduced) {
    typingWord.textContent = TYPING_WORDS[0];
    return;
  }
  if (document.hidden || !stageIntersecting || activeCard !== 0) {
    scheduleTyping(260);
    return;
  }

  const current = TYPING_WORDS[typingWordIndex];
  if (typingPhase === "hold") {
    typingPhase = "delete";
    scheduleTyping(1150);
    return;
  }
  if (typingPhase === "delete") {
    typingCharacterIndex = Math.max(0, typingCharacterIndex - 1);
    typingWord.textContent = current.slice(0, typingCharacterIndex);
    if (typingCharacterIndex === 0) {
      typingWordIndex = (typingWordIndex + 1) % TYPING_WORDS.length;
      typingPhase = "type";
      scheduleTyping(230);
    } else {
      scheduleTyping(42);
    }
    return;
  }

  const next = TYPING_WORDS[typingWordIndex];
  typingCharacterIndex = Math.min(next.length, typingCharacterIndex + 1);
  typingWord.textContent = next.slice(0, typingCharacterIndex);
  if (typingCharacterIndex === next.length) {
    typingPhase = "hold";
    scheduleTyping(80);
  } else {
    scheduleTyping(66);
  }
}

function initializeTypingIdentity() {
  if (!typingWord) return;
  typingWord.textContent = TYPING_WORDS[0];
  scheduleTyping(1300);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function drawParticleField() {
  if (!particleCanvas) return;
  const context = particleCanvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;
  const rect = particleCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.15);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  particleCanvas.width = Math.round(width * ratio);
  particleCanvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const random = seededRandom(0x4c554d4f);
  const count = width < 760 ? 108 : 196;
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const bright = random() > 0.885;
    const size = bright ? 1.15 + random() * 1.7 : 0.22 + random() * 0.82;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fillStyle = bright ? "rgba(241,250,247,.88)" : "rgba(204,228,220,.48)";
    context.fill();
    if (bright) {
      context.globalAlpha = 0.2;
      context.strokeStyle = "rgba(238,248,244,.75)";
      context.lineWidth = 0.5;
      context.beginPath();
      context.moveTo(x - size * 4, y);
      context.lineTo(x + size * 4, y);
      context.moveTo(x, y - size * 4);
      context.lineTo(x, y + size * 4);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  const nebulae = [
    [width * .18, height * .22, Math.min(width, height) * .26, "rgba(86,116,255,.12)"],
    [width * .76, height * .34, Math.min(width, height) * .22, "rgba(189,252,107,.09)"],
    [width * .66, height * .78, Math.min(width, height) * .28, "rgba(66,214,190,.09)"],
    [width * .42, height * .62, Math.min(width, height) * .2, "rgba(255,255,255,.04)"]
  ];
  nebulae.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });
}

function updateStageVisibility() {
  document.body.classList.toggle("spiral-stage-visible", stageIntersecting && !document.hidden && !reduced);
}

function initializeStageVisibility() {
  if (!track || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    stageIntersecting = entries[0]?.isIntersecting === true;
    updateStageVisibility();
  }, { rootMargin: "120px 0px", threshold: 0.001 });
  observer.observe(track);
  document.addEventListener("visibilitychange", updateStageVisibility);
}

function clearMotionStyles() {
  cards.forEach((card) => {
    ["transform", "opacity", "filter", "visibility", "z-index", "--scene-copy-x", "--scene-copy-y", "--scene-plane-x", "--scene-plane-y"].forEach((property) => card.style.removeProperty(property));
    card.setAttribute("aria-hidden", "false");
    setInteractiveState(card, true);
  });
  ghostItems.forEach((ghost) => {
    ghost.style.removeProperty("transform");
    ghost.style.removeProperty("opacity");
    ghost.style.removeProperty("visibility");
  });
  if (ghostLabel) {
    ghostLabel.style.removeProperty("transform");
    ghostLabel.style.removeProperty("opacity");
  }
}

function updateReducedState() {
  reduced = reducedMotionQuery?.matches === true || !CSS.supports?.("transform-style", "preserve-3d");
  document.body.classList.toggle("spiral-reduced", reducedMotionQuery?.matches === true);
  document.body.classList.toggle("spiral-fallback", !CSS.supports?.("transform-style", "preserve-3d"));
  updateStageVisibility();
  if (reduced) {
    clearMotionStyles();
    rootStyle.setProperty("--motion-stage-opacity", "1");
    rootStyle.setProperty("--motion-foreground-opacity", "1");
    rootStyle.setProperty("--motion-content-opacity", "1");
    rootStyle.setProperty("--motion-content-shift", "0px");
    rootStyle.setProperty("--motion-header-opacity", "1");
    document.body.classList.add("spiral-handoff-ready");
    setActiveCard(0);
  } else {
    renderMotion(true);
  }
}

function initializePointerTilt() {
  window.addEventListener("pointermove", (event) => {
    if (reduced || coarsePointerQuery?.matches || !stageIntersecting) return;
    targetPointerX = clamp((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
    targetPointerY = clamp((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
    requestFrame();
  }, { passive: true });
  window.addEventListener("pointerleave", () => {
    targetPointerX = 0;
    targetPointerY = 0;
    requestFrame();
  }, { passive: true });
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;
    drawParticleField();
    renderMotion(true);
  });
}

window.addEventListener("scroll", updateFromScroll, { passive: true });
window.addEventListener("resize", scheduleResize, { passive: true });
reducedMotionQuery?.addEventListener?.("change", updateReducedState);

createProgressControls();
initializeTypingIdentity();
drawParticleField();
initializePointerTilt();
initializeStageVisibility();
updateReducedState();
renderMotion(true);
