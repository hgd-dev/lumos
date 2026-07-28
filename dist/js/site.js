import { runReleaseHealthCheck } from "./release/health.js";
import { APP_NAME } from "./release/version.js";

const TYPE_WORDS = Object.freeze([
  "monitoring",
  "intervention",
  "planning",
  "optimization",
  "deployment",
  "evaluation"
]);
const TYPE_TIMING = Object.freeze({ type: 78, erase: 42, hold: 1250, empty: 240 });

let installPrompt = null;
let typeTimer = null;
let typeState = { wordIndex: 0, characterIndex: TYPE_WORDS[0].length, deleting: true };

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function scheduleTypewriter(delay) {
  window.clearTimeout(typeTimer);
  typeTimer = window.setTimeout(stepTypewriter, delay);
}

function stepTypewriter() {
  const target = document.querySelector("#heroTypeText");
  if (!target) return;
  if (prefersReducedMotion()) {
    target.textContent = TYPE_WORDS[0];
    return;
  }
  if (document.hidden) {
    scheduleTypewriter(500);
    return;
  }

  const word = TYPE_WORDS[typeState.wordIndex];
  if (typeState.deleting) {
    typeState.characterIndex = Math.max(0, typeState.characterIndex - 1);
    target.textContent = word.slice(0, typeState.characterIndex);
    if (typeState.characterIndex === 0) {
      typeState.wordIndex = (typeState.wordIndex + 1) % TYPE_WORDS.length;
      typeState.deleting = false;
      scheduleTypewriter(TYPE_TIMING.empty);
      return;
    }
    scheduleTypewriter(TYPE_TIMING.erase);
    return;
  }

  const nextWord = TYPE_WORDS[typeState.wordIndex];
  typeState.characterIndex = Math.min(nextWord.length, typeState.characterIndex + 1);
  target.textContent = nextWord.slice(0, typeState.characterIndex);
  if (typeState.characterIndex === nextWord.length) {
    typeState.deleting = true;
    scheduleTypewriter(TYPE_TIMING.hold);
    return;
  }
  scheduleTypewriter(TYPE_TIMING.type);
}

function initializeTypewriter() {
  const target = document.querySelector("#heroTypeText");
  if (!target) return;
  if (prefersReducedMotion()) {
    target.textContent = TYPE_WORDS[0];
    return;
  }
  scheduleTypewriter(TYPE_TIMING.hold);
}

function renderSystemChecks(checks = []) {
  const list = document.querySelector("#systemCheckList");
  if (!list) return;
  list.replaceChildren();
  for (const check of checks) {
    const item = document.createElement("li");
    item.className = `system-check-item ${check.status}`;
    item.innerHTML = `<span class="system-check-dot" aria-hidden="true"></span><span class="system-check-copy"><strong></strong><small></small></span><span class="system-check-state"></span>`;
    item.querySelector("strong").textContent = check.label;
    item.querySelector("small").textContent = check.detail;
    item.querySelector(".system-check-state").textContent = check.status;
    list.append(item);
  }
}

async function runSystemCheck() {
  const button = document.querySelector("#runSystemCheckButton");
  const summaryElement = document.querySelector("#systemCheckSummary");
  if (!button || !summaryElement) return;
  button.disabled = true;
  summaryElement.textContent = "Checking browser capabilities and public-data services…";
  renderSystemChecks([]);
  const summary = await runReleaseHealthCheck({
    domainKey: "core",
    onUpdate: (_check, checks) => renderSystemChecks(checks)
  });
  summaryElement.textContent = summary.ready
    ? `Application services ready · ${summary.counts.pass} passed${summary.counts.warn ? ` · ${summary.counts.warn} optional warning${summary.counts.warn === 1 ? "" : "s"}` : ""}.`
    : `Required service check failed · ${summary.counts.fail} failure${summary.counts.fail === 1 ? "" : "s"}. Saved and controlled workspaces remain available.`;
  button.disabled = false;
}

function initializeSystemCheck() {
  const openButton = document.querySelector("#systemCheckButton");
  const dialog = document.querySelector("#systemCheckDialog");
  const runButton = document.querySelector("#runSystemCheckButton");
  openButton?.addEventListener("click", () => {
    if (typeof dialog?.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
    void runSystemCheck();
  });
  runButton?.addEventListener("click", () => void runSystemCheck());
}

function initializeInstallPrompt() {
  const button = document.querySelector("#installAppButton");
  const status = document.querySelector("#homeInstallStatus");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (button) button.hidden = false;
    if (status) status.textContent = "Install LUMOS for standalone access and an offline application shell.";
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (button) button.hidden = true;
    if (status) status.textContent = `${APP_NAME} is installed and available as a standalone application.`;
  });
  button?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } finally {
      installPrompt = null;
      button.hidden = true;
    }
  });
}

function initializeConnectivity() {
  const banner = document.querySelector("#offlineBanner");
  const update = () => {
    const online = navigator.onLine !== false;
    if (banner) banner.hidden = online;
    document.body.classList.toggle("is-offline", !online);
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" });
    await registration.update();
  } catch (error) {
    console.warn("LUMOS service worker registration failed:", error);
  }
}

function initializeWorkspaceMenus() {
  const menus = [...document.querySelectorAll(".site-menu")];
  for (const menu of menus) {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      for (const other of menus) if (other !== menu) other.removeAttribute("open");
    });
  }
  document.addEventListener("click", (event) => {
    for (const menu of menus) if (menu.open && !menu.contains(event.target)) menu.removeAttribute("open");
  });
}

initializeConnectivity();
initializeTypewriter();
initializeSystemCheck();
initializeInstallPrompt();
initializeWorkspaceMenus();
void registerServiceWorker();
