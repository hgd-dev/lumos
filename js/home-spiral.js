const track = document.querySelector("#spiralSequence");
const viewport = document.querySelector("#spiralViewport");
const orbit = document.querySelector("#spiralOrbit");
const cards = Array.from(document.querySelectorAll(".spiral-item"));
const typingWord = document.querySelector("#motionTypingWord");
const particleCanvas = document.querySelector("#spiralParticleCanvas");
const persistentCanvas = document.querySelector("#spiralPersistentCanvas");
const titleIntro = document.querySelector("#spiralIntro");
const counter = document.querySelector("#spiralCounter");
const activeIndex = document.querySelector("#spiralActiveIndex");
const activeTitle = document.querySelector("#spiralActiveTitle");
const sceneCode = document.querySelector("#motionSceneCode");
const progressControl = document.querySelector("#spiralProgress");
const status = document.querySelector("#spiralStatus");
const rootStyle = document.documentElement.style;
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia?.("(pointer: coarse)");

const SCENE_CENTERS = [0, 0.145, 0.29, 0.435, 0.58, 0.725];
const SCENE_INNER_RADIUS = 0.019;
const SCENE_OUTER_RADIUS = 0.048;
const SCENE_INTERVAL = 0.145;
const SNAP_RADIUS = 0.052;
const SNAP_INNER_LOCK = 0.011;
const SNAP_VISUAL_STRENGTH = 0.94;
const SNAP_SETTLE_DELAY = 34;
const SNAP_DURATION = 230;
const GEOMETRY_FADE_START = 0.81;
const GEOMETRY_FADE_END = 0.905;
const CONTENT_REVEAL_START = 0.865;
const CONTENT_REVEAL_END = 0.965;
const TYPING_WORDS = ["monitoring", "intervention", "planning", "optimization", "deployment", "evaluation"];
const TITLE_INTRO_DELAY = 150;
const TITLE_INTRO_HANDOFF = 2030;
const TITLE_INTRO_DURATION = 2480;

let activeCard = -1;
let reduced = false;
let stageIntersecting = true;
let frameRequested = false;
let snapTimer = 0;
let snapFrame = 0;
let snapAnimating = false;
let snapTargetIndex = -1;
let resizeFrame = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let pointerX = 0;
let pointerY = 0;
let scrollStart = 0;
let scrollRange = 1;
let viewportWidth = Math.max(1, window.innerWidth);
let viewportHeight = Math.max(1, window.innerHeight);
const rootPropertyCache = new Map();
const cardCssCache = cards.map(() => "");
const bodyClassCache = new Map();
let renderedCardIndex = -1;
let persistentDrawScheduled = false;
let typingTimer = 0;
let titleIntroTimer = 0;
let titleIntroHandoffTimer = 0;
let titleIntroDelayTimer = 0;
let typingWordIndex = 0;
let typingCharacterIndex = TYPING_WORDS[0].length;
let typingPhase = "hold";

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function setRootProperty(name, value) {
  if (rootPropertyCache.get(name) === value) return;
  rootPropertyCache.set(name, value);
  rootStyle.setProperty(name, value);
}

function setCardCss(index, cssText) {
  if (index < 0 || index >= cards.length || cardCssCache[index] === cssText) return;
  cardCssCache[index] = cssText;
  cards[index].style.cssText = cssText;
}

function toggleBodyClass(name, enabled) {
  if (bodyClassCache.get(name) === enabled) return;
  bodyClassCache.set(name, enabled);
  document.body.classList.toggle(name, enabled);
}

function refreshScrollMetrics() {
  if (!track) {
    scrollStart = 0;
    scrollRange = 1;
    return;
  }
  viewportWidth = Math.max(1, window.innerWidth);
  viewportHeight = Math.max(1, window.innerHeight);
  scrollStart = track.offsetTop;
  scrollRange = Math.max(1, track.offsetHeight - viewportHeight);
}

function scrollProgress() {
  return clamp((window.scrollY - scrollStart) / scrollRange);
}

function sceneCenter(index) {
  if (SCENE_CENTERS[index] != null) return SCENE_CENTERS[index];
  return SCENE_CENTERS[0] + index * SCENE_INTERVAL;
}

function nearestScene(progress) {
  let nearest = 0;
  let distance = Math.abs(progress - SCENE_CENTERS[0]);
  for (let index = 1; index < SCENE_CENTERS.length; index += 1) {
    const nextDistance = Math.abs(progress - SCENE_CENTERS[index]);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  }
  return { index: nearest, distance };
}

function magnetizedProgress(progress) {
  const nearest = nearestScene(progress);
  if (nearest.distance > SNAP_RADIUS) return { ...nearest, progress };
  const center = sceneCenter(nearest.index);
  if (nearest.distance <= SNAP_INNER_LOCK) return { ...nearest, progress: center };
  const capture = 1 - smoothstep((nearest.distance - SNAP_INNER_LOCK) / (SNAP_RADIUS - SNAP_INNER_LOCK));
  const strength = clamp(capture * SNAP_VISUAL_STRENGTH);
  return { ...nearest, progress: mix(progress, center, strength) };
}

function scrollToScene(index, behavior = "smooth") {
  window.scrollTo({ top: scrollStart + sceneCenter(index) * scrollRange, behavior });
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
  setRootProperty("--motion-accent", card.dataset.accent || "#bdfc6b");
  setRootProperty("--motion-accent-rgb", card.dataset.accentRgb || "189,252,107");
}

function cardOpacity(distance) {
  const absolute = Math.abs(distance);
  return 1 - smoothstep((absolute - SCENE_INNER_RADIUS) / (SCENE_OUTER_RADIUS - SCENE_INNER_RADIUS));
}

function renderMotion(force = false) {
  frameRequested = false;
  if (reduced || !track || !viewport || !orbit || (!force && !stageIntersecting)) return;

  const rawProgress = scrollProgress();
  const magnetic = magnetizedProgress(rawProgress);
  const progress = magnetic.progress;
  const pointerEase = force ? 1 : 0.42;
  pointerX = mix(pointerX, targetPointerX, pointerEase);
  pointerY = mix(pointerY, targetPointerY, pointerEase);
  setRootProperty("--motion-pointer-x", pointerX.toFixed(4));
  setRootProperty("--motion-pointer-y", pointerY.toFixed(4));
  setRootProperty("--motion-progress", progress.toFixed(5));

  const index = magnetic.index;
  const distance = progress - SCENE_CENTERS[index];
  const normalized = distance / SCENE_INTERVAL;
  const absoluteNormalized = Math.abs(normalized);
  const opacity = cardOpacity(distance);
  const visible = opacity > 0.002 && Math.abs(distance) < SCENE_OUTER_RADIUS + 0.014;

  if (renderedCardIndex !== index && renderedCardIndex >= 0) {
    setCardCss(renderedCardIndex, "opacity:0;visibility:hidden;");
  }

  if (visible) {
    const travel = Math.tanh(normalized * 1.48);
    const x = travel * viewportWidth * -0.48;
    const y = travel * viewportHeight * -0.59;
    const z = -absoluteNormalized * 760;
    const scale = clamp(1 - absoluteNormalized * 0.12, 0.76, 1);
    const cssText = [
      `transform:translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${(travel * -4.2).toFixed(2)}deg) rotateY(${(travel * 9.5).toFixed(2)}deg) rotateZ(${(travel * -7.5).toFixed(2)}deg) scale(${scale.toFixed(4)})`,
      `opacity:${opacity.toFixed(3)}`,
      "visibility:visible",
      `--scene-copy-x:${(travel * viewportWidth * 0.022).toFixed(1)}px`,
      `--scene-copy-y:${(travel * viewportHeight * 0.015).toFixed(1)}px`,
      `--scene-plane-x:${(travel * viewportWidth * -0.048).toFixed(1)}px`,
      `--scene-plane-y:${(travel * viewportHeight * -0.03).toFixed(1)}px`
    ].join(";") + ";";
    setCardCss(index, cssText);
    renderedCardIndex = index;
  } else {
    setCardCss(index, "opacity:0;visibility:hidden;");
    renderedCardIndex = -1;
  }

  const gapIntensity = clamp(1 - opacity);
  setActiveCard(index);
  const geometryFade = smoothstep((rawProgress - GEOMETRY_FADE_START) / (GEOMETRY_FADE_END - GEOMETRY_FADE_START));
  const geometryOpacity = 1 - geometryFade;
  const contentReveal = smoothstep((rawProgress - CONTENT_REVEAL_START) / (CONTENT_REVEAL_END - CONTENT_REVEAL_START));
  setRootProperty("--motion-gap", gapIntensity.toFixed(4));
  setRootProperty("--motion-geometry-opacity", geometryOpacity.toFixed(4));
  setRootProperty("--motion-grid-opacity", mix(0.9, 0.26, geometryFade).toFixed(4));
  setRootProperty("--motion-glow-opacity", mix(0.34, 0.16, geometryFade).toFixed(4));
  setRootProperty("--motion-interface-opacity", geometryOpacity.toFixed(4));
  setRootProperty("--motion-content-opacity", contentReveal.toFixed(4));
  setRootProperty("--motion-content-shift", `${((1 - contentReveal) * 62).toFixed(1)}px`);
  setRootProperty("--motion-core-rotation", `${(progress * 390 - 18).toFixed(2)}deg`);

  toggleBodyClass("spiral-between-scenes", gapIntensity > 0.48 && rawProgress < GEOMETRY_FADE_START);
  toggleBodyClass("spiral-handoff-active", rawProgress >= GEOMETRY_FADE_START);
  toggleBodyClass("spiral-handoff-ready", contentReveal > 0.82);

  if (
    Math.abs(pointerX - targetPointerX) > 0.02 ||
    Math.abs(pointerY - targetPointerY) > 0.02
  ) requestFrame();
}

function requestFrame() {
  if (frameRequested || reduced) return;
  frameRequested = true;
  window.requestAnimationFrame(() => renderMotion(false));
}

function cancelSceneSnap() {
  window.clearTimeout(snapTimer);
  window.cancelAnimationFrame(snapFrame);
  snapTimer = 0;
  snapFrame = 0;
  snapAnimating = false;
  snapTargetIndex = -1;
}

function animateSceneSnap(index) {
  window.cancelAnimationFrame(snapFrame);
  const startY = window.scrollY;
  const targetY = scrollStart + sceneCenter(index) * scrollRange;
  const distanceY = targetY - startY;
  if (Math.abs(distanceY) < 0.6) {
    window.scrollTo(0, targetY);
    snapAnimating = false;
    snapTargetIndex = -1;
    requestFrame();
    return;
  }

  snapAnimating = true;
  snapTargetIndex = index;
  const startedAt = performance.now();
  const step = (now) => {
    if (!snapAnimating || snapTargetIndex !== index) return;
    const time = clamp((now - startedAt) / SNAP_DURATION);
    const eased = 1 - Math.pow(1 - time, 4);
    window.scrollTo(0, startY + distanceY * eased);
    requestFrame();
    if (time < 1) {
      snapFrame = window.requestAnimationFrame(step);
    } else {
      window.scrollTo(0, targetY);
      snapFrame = 0;
      snapAnimating = false;
      snapTargetIndex = -1;
      requestFrame();
    }
  };
  snapFrame = window.requestAnimationFrame(step);
}

function settleSceneSnap() {
  snapTimer = 0;
  if (reduced || !stageIntersecting || snapAnimating) return;
  const progress = scrollProgress();
  const nearest = nearestScene(progress);
  if (nearest.distance <= 0.00045 || nearest.distance > SNAP_RADIUS) return;
  animateSceneSnap(nearest.index);
}

function scheduleSceneSnap() {
  window.clearTimeout(snapTimer);
  if (snapAnimating) return;
  const progress = scrollProgress();
  const nearest = nearestScene(progress);
  if (nearest.distance > SNAP_RADIUS) {
    snapTargetIndex = -1;
    return;
  }
  snapTargetIndex = nearest.index;
  snapTimer = window.setTimeout(settleSceneSnap, SNAP_SETTLE_DELAY);
}

function updateFromScroll() {
  if (reduced || !stageIntersecting) return;
  if (!snapAnimating) scheduleSceneSnap();
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

function drawParticleCanvas(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.15);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
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

function completeTitleIntro(immediate = false) {
  window.clearTimeout(titleIntroTimer);
  window.clearTimeout(titleIntroHandoffTimer);
  window.clearTimeout(titleIntroDelayTimer);
  document.body.classList.remove("spiral-title-intro-pending", "spiral-title-intro-active", "spiral-title-intro-handoff");
  document.body.classList.add("spiral-title-intro-complete");
  if (titleIntro) titleIntro.setAttribute("aria-hidden", "true");
  if (!immediate) renderMotion(true);
}

async function initializeTitleIntro() {
  if (!titleIntro) return;
  if (window.scrollY > 10 || reducedMotionQuery?.matches === true) {
    completeTitleIntro(true);
    return;
  }

  document.body.classList.remove("spiral-title-intro-complete");
  document.body.classList.add("spiral-title-intro-pending");
  const fontReady = document.fonts?.ready ?? Promise.resolve();
  await Promise.race([
    fontReady,
    new Promise((resolve) => window.setTimeout(resolve, 420))
  ]);

  titleIntroDelayTimer = window.setTimeout(() => {
    if (window.scrollY > 10 || reducedMotionQuery?.matches === true) {
      completeTitleIntro(true);
      return;
    }
    titleIntro.setAttribute("aria-hidden", "false");
    document.body.classList.remove("spiral-title-intro-pending");
    document.body.classList.add("spiral-title-intro-active");
    titleIntroHandoffTimer = window.setTimeout(() => {
      document.body.classList.add("spiral-title-intro-handoff");
    }, TITLE_INTRO_HANDOFF);
    titleIntroTimer = window.setTimeout(() => completeTitleIntro(), TITLE_INTRO_DURATION);
  }, TITLE_INTRO_DELAY);
}

function drawPersistentField() {
  persistentDrawScheduled = false;
  drawParticleCanvas(persistentCanvas);
}

function schedulePersistentField() {
  if (persistentDrawScheduled || !persistentCanvas) return;
  persistentDrawScheduled = true;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(drawPersistentField, { timeout: 900 });
  } else {
    window.setTimeout(drawPersistentField, 120);
  }
}

function drawParticleField() {
  drawParticleCanvas(particleCanvas);
  schedulePersistentField();
}

function updateStageVisibility() {
  const visible = stageIntersecting && !document.hidden && !reduced;
  toggleBodyClass("spiral-stage-visible", visible);
  if (!visible) cancelSceneSnap();
  else requestFrame();
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
  cards.forEach((card, index) => {
    ["transform", "opacity", "filter", "visibility", "z-index", "--scene-copy-x", "--scene-copy-y", "--scene-plane-x", "--scene-plane-y"].forEach((property) => card.style.removeProperty(property));
    cardCssCache[index] = "";
    card.setAttribute("aria-hidden", "false");
    setInteractiveState(card, true);
  });
  renderedCardIndex = -1;
}

function updateReducedState() {
  reduced = reducedMotionQuery?.matches === true || !CSS.supports?.("transform-style", "preserve-3d");
  document.body.classList.toggle("spiral-reduced", reducedMotionQuery?.matches === true);
  document.body.classList.toggle("spiral-fallback", !CSS.supports?.("transform-style", "preserve-3d"));
  updateStageVisibility();
  if (reduced) {
    cancelSceneSnap();
    clearMotionStyles();
    setRootProperty("--motion-stage-opacity", "1");
    setRootProperty("--motion-foreground-opacity", "1");
    setRootProperty("--motion-content-opacity", "1");
    setRootProperty("--motion-content-shift", "0px");
    setRootProperty("--motion-header-opacity", "1");
    setRootProperty("--motion-geometry-opacity", "0");
    setRootProperty("--motion-grid-opacity", ".26");
    setRootProperty("--motion-glow-opacity", ".16");
    setRootProperty("--motion-interface-opacity", "0");
    document.body.classList.add("spiral-handoff-ready");
    completeTitleIntro(true);
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
    refreshScrollMetrics();
    persistentDrawScheduled = false;
    drawParticleField();
    renderMotion(true);
  });
}

window.addEventListener("wheel", () => {
  if (snapAnimating) cancelSceneSnap();
}, { passive: true });
window.addEventListener("touchstart", () => {
  if (snapAnimating) cancelSceneSnap();
}, { passive: true });
window.addEventListener("scroll", updateFromScroll, { passive: true });
window.addEventListener("scrollend", settleSceneSnap, { passive: true });
window.addEventListener("resize", scheduleResize, { passive: true });
reducedMotionQuery?.addEventListener?.("change", updateReducedState);

refreshScrollMetrics();
createProgressControls();
void initializeTitleIntro();
initializeTypingIdentity();
drawParticleField();
initializePointerTilt();
initializeStageVisibility();
updateReducedState();
renderMotion(true);
