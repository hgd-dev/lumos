const THREE_MODULE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.185.1/three.module.min.js";
const DOMAIN_COLORS = [0xffad5e, 0x82d8ff, 0xd4b86f, 0x729fff];
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia?.("(pointer: coarse)");

const canvas = document.querySelector("#lumos3dCanvas");
const status = document.querySelector("#home3dStatus");
const motionButton = document.querySelector("#home3dMotionButton");
const qualityButton = document.querySelector("#home3dQualityButton");
const progressLinks = [...document.querySelectorAll(".home-3d-progress a")];
const sceneSections = [...document.querySelectorAll("[data-scene]")];

let renderState = null;
let motionPaused = reducedMotionQuery?.matches === true;
let lowDetail = coarsePointerQuery?.matches === true || window.innerWidth < 720;

function setStatus(message) {
  if (status) status.textContent = message;
}

function updateControlLabels() {
  if (motionButton) {
    motionButton.textContent = motionPaused ? "Resume motion" : "Pause motion";
    motionButton.setAttribute("aria-pressed", String(motionPaused));
  }
  if (qualityButton) {
    qualityButton.textContent = lowDetail ? "Higher detail" : "Lower detail";
    qualityButton.setAttribute("aria-pressed", String(lowDetail));
  }
}

function markFailure(message) {
  document.body.classList.remove("home-3d-ready");
  document.body.classList.add("home-3d-failed");
  setStatus(message);
  if (motionButton) motionButton.hidden = true;
  if (qualityButton) qualityButton.hidden = true;
}

function buildPointTunnel(THREE, group, detailScale) {
  const ringCount = Math.round(92 * detailScale);
  const pointsPerRing = Math.round(62 * detailScale);
  const positions = [];
  const colors = [];
  const color = new THREE.Color();

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const progress = ringIndex / Math.max(1, ringCount - 1);
    const z = 8 - progress * 78;
    const baseRadius = 5.4 + progress * 2.7 + Math.sin(progress * Math.PI * 8) * .38;
    const twist = progress * Math.PI * 7.5;
    for (let pointIndex = 0; pointIndex < pointsPerRing; pointIndex += 1) {
      const theta = (pointIndex / pointsPerRing) * Math.PI * 2 + twist;
      const ripple = Math.sin(theta * 4 + progress * Math.PI * 14) * .27;
      const radius = baseRadius + ripple;
      positions.push(Math.cos(theta) * radius, Math.sin(theta) * radius * .76, z);
      const domain = Math.floor((pointIndex / pointsPerRing) * 4) % 4;
      color.setHex(DOMAIN_COLORS[domain]).multiplyScalar(.88 + Math.sin(progress * Math.PI) * .12);
      colors.push(color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: lowDetail ? .075 : .09,
    sizeAttenuation: true,
    transparent: true,
    opacity: .68,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.name = "tunnel-points";
  group.add(points);
  return points;
}

function buildSpiralStrands(THREE, group, detailScale) {
  const strandGroup = new THREE.Group();
  const segments = Math.round(460 * detailScale);
  for (let domain = 0; domain < 4; domain += 1) {
    const pathPoints = [];
    const phase = domain * Math.PI * .5;
    for (let index = 0; index < segments; index += 1) {
      const progress = index / Math.max(1, segments - 1);
      const theta = progress * Math.PI * 18 + phase;
      const radius = 3.15 + progress * 2.25 + Math.sin(progress * Math.PI * 5 + phase) * .28;
      pathPoints.push(new THREE.Vector3(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius * .76,
        8 - progress * 78
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const geometry = new THREE.TubeGeometry(curve, Math.round(segments * .8), lowDetail ? .055 : .075, 5, false);
    const material = new THREE.MeshBasicMaterial({
      color: DOMAIN_COLORS[domain],
      transparent: true,
      opacity: domain === 0 ? .62 : .48,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geometry, material);
    strandGroup.add(mesh);
  }
  group.add(strandGroup);
  return strandGroup;
}

function buildRingWireframe(THREE, group, detailScale) {
  const ringCount = Math.round(50 * detailScale);
  const ringSegments = Math.round(54 * detailScale);
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const progress = ringIndex / Math.max(1, ringCount - 1);
    const z = 7 - progress * 77;
    const twist = progress * Math.PI * 7.5;
    const radius = 5.45 + progress * 2.72;
    for (let segment = 0; segment < ringSegments; segment += 1) {
      const a = (segment / ringSegments) * Math.PI * 2 + twist;
      const b = ((segment + 1) / ringSegments) * Math.PI * 2 + twist;
      positions.push(
        Math.cos(a) * radius, Math.sin(a) * radius * .76, z,
        Math.cos(b) * radius, Math.sin(b) * radius * .76, z
      );
      color.setHex(DOMAIN_COLORS[Math.floor(segment / Math.max(1, ringSegments / 4)) % 4]);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: .075,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const lines = new THREE.LineSegments(geometry, material);
  group.add(lines);
  return lines;
}

function buildDust(THREE, scene, detailScale) {
  const count = Math.round(1100 * detailScale);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 8 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    positions[index * 3] = Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.sin(theta) * radius * .7;
    positions[index * 3 + 2] = 12 - Math.random() * 95;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xdfffea, size: lowDetail ? .035 : .052, transparent: true, opacity: .25, depthWrite: false });
  const dust = new THREE.Points(geometry, material);
  scene.add(dust);
  return dust;
}

function createScene(THREE) {
  if (!canvas) throw new Error("The 3D canvas is unavailable.");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowDetail, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x020706, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020706, .026);
  const camera = new THREE.PerspectiveCamera(54, 1, .1, 180);
  camera.position.set(0, 0, 12);

  const tunnelGroup = new THREE.Group();
  tunnelGroup.rotation.z = -.38;
  tunnelGroup.rotation.x = .08;
  scene.add(tunnelGroup);

  const detailScale = lowDetail ? .56 : 1;
  const tunnelPoints = buildPointTunnel(THREE, tunnelGroup, detailScale);
  const strands = buildSpiralStrands(THREE, tunnelGroup, detailScale);
  const rings = buildRingWireframe(THREE, tunnelGroup, detailScale);
  const dust = buildDust(THREE, scene, detailScale);

  const state = { THREE, renderer, scene, camera, tunnelGroup, tunnelPoints, strands, rings, dust };
  applyQuality(state);
  return state;
}

function resizeScene(state) {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const pixelRatioCap = lowDetail ? 1 : 1.65;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.fov = width < 720 ? 66 : 54;
  state.camera.updateProjectionMatrix();
}

function applyQuality(state) {
  if (!state) return;
  state.rings.visible = !lowDetail;
  state.tunnelPoints.material.size = lowDetail ? .07 : .09;
  state.dust.material.size = lowDetail ? .032 : .052;
  for (const strand of state.strands.children) strand.material.opacity = lowDetail ? .36 : (strand === state.strands.children[0] ? .62 : .48);
  resizeScene(state);
}

function documentProgress() {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(1, Math.max(0, window.scrollY / max));
}

function initializeSectionProgress() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const id = visible.target.id;
    progressLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${id}`));
  }, { threshold: [.28, .52, .72] });
  sceneSections.forEach((section) => observer.observe(section));
}

async function initialize3D() {
  if (!canvas) return;
  try {
    const THREE = await import(THREE_MODULE_URL);
    renderState = createScene(THREE);
    resizeScene(renderState);
    document.body.classList.add("home-3d-ready");
    setStatus("The experimental three-dimensional LUMOS environmental field is ready.");

    const pointer = { x: 0, y: 0 };
    const targetPointer = { x: 0, y: 0 };
    let lastTime = performance.now();

    window.addEventListener("pointermove", (event) => {
      if (coarsePointerQuery?.matches) return;
      targetPointer.x = (event.clientX / Math.max(1, window.innerWidth) - .5) * 2;
      targetPointer.y = (event.clientY / Math.max(1, window.innerHeight) - .5) * 2;
    }, { passive: true });

    function frame(time) {
      if (!renderState) return;
      const delta = Math.min(.05, Math.max(0, (time - lastTime) / 1000));
      lastTime = time;
      pointer.x += (targetPointer.x - pointer.x) * Math.min(1, delta * 3.6);
      pointer.y += (targetPointer.y - pointer.y) * Math.min(1, delta * 3.6);
      const scroll = documentProgress();
      const state = renderState;

      const targetZ = 12 - scroll * 53;
      state.camera.position.z += (targetZ - state.camera.position.z) * Math.min(1, delta * 2.6);
      state.camera.position.x += ((pointer.x * 1.35 + Math.sin(scroll * Math.PI * 2) * .55) - state.camera.position.x) * Math.min(1, delta * 2.3);
      state.camera.position.y += ((-pointer.y * .8 + Math.cos(scroll * Math.PI * 1.5) * .35) - state.camera.position.y) * Math.min(1, delta * 2.3);
      state.camera.rotation.z += ((-.05 + scroll * .78 + pointer.x * .025) - state.camera.rotation.z) * Math.min(1, delta * 1.8);
      state.camera.rotation.x += ((pointer.y * .035) - state.camera.rotation.x) * Math.min(1, delta * 2.1);

      if (!motionPaused && document.hidden === false) {
        state.tunnelGroup.rotation.z += delta * (.075 + scroll * .065);
        state.tunnelGroup.rotation.y += delta * .012;
        state.dust.rotation.z -= delta * .006;
      }
      state.renderer.render(state.scene, state.camera);
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  } catch (error) {
    console.warn("LUMOS experimental 3D scene could not start:", error);
    markFailure("The three-dimensional renderer could not start. A static visual fallback is active and all navigation remains available.");
  }
}

motionButton?.addEventListener("click", () => {
  motionPaused = !motionPaused;
  updateControlLabels();
});

qualityButton?.addEventListener("click", () => {
  lowDetail = !lowDetail;
  updateControlLabels();
  applyQuality(renderState);
});

window.addEventListener("resize", () => {
  if (renderState) resizeScene(renderState);
}, { passive: true });

reducedMotionQuery?.addEventListener?.("change", (event) => {
  motionPaused = event.matches;
  updateControlLabels();
});

updateControlLabels();
initializeSectionProgress();
void initialize3D();
