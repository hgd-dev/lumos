const CACHE_NAME = "lumos-v3.2.6";
const LIBRARY_ASSETS = [
  "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css",
  "https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.185.1/three.module.min.js"
];
const APP_SHELL = [
  "./",
  "./index.html",
  "./home-3d.html",
  "./home-spiral.html",
  "./about.html",
  "./documentation.html",
  "./research.html",
  "./contact.html",
  "./unified.html",
  "./heat.html",
  "./air.html",
  "./soil.html",
  "./water.html",
  "./workspace-shell.html",
  "./css/styles.css",
  "./css/home-3d.css",
  "./css/home-spiral.css",
  "./manifest.webmanifest",
  "./assets/lumos-mark.svg",
  "./js/app.js",
  "./js/site.js",
  "./js/home-3d.js",
  "./js/home-spiral.js",
  "./js/info-page.js",
  "./js/content-page.js",
  "./js/workspace-bootstrap.js",
  "./js/config/domains.js",
  "./js/config/domain-registry.js",
  "./js/data/heat/live.js",
  "./js/data/heat/national.js",
  "./js/data/heat/nlcd.js",
  "./js/data/heat/nyc.js",
  "./js/data/air/national.js",
  "./js/data/soil/national.js",
  "./js/data/water/national.js",
  "./js/data/scenarios.js",
  "./js/data/synthetic.js",
  "./js/map.js",
  "./js/map/location.js",
  "./js/model/bayesian/design.js",
  "./js/model/bayesian/kernel.js",
  "./js/model/bayesian/linalg.js",
  "./js/model/bayesian/metrics.js",
  "./js/model/bayesian/prediction.js",
  "./js/model/benchmarks/criteria.js",
  "./js/model/benchmarks/exact.js",
  "./js/model/benchmarks/index.js",
  "./js/model/benchmarks/matrix.js",
  "./js/model/benchmarks/selectors.js",
  "./js/model/heat/experiments.js",
  "./js/model/heat/inference.js",
  "./js/model/heat/intervention.js",
  "./js/model/heat/national-report.js",
  "./js/model/heat/paper-runner.js",
  "./js/model/heat/sensitivity.js",
  "./js/model/air/intervention.js",
  "./js/model/air/inference.js",
  "./js/model/air/sensitivity.js",
  "./js/model/air/paper-runner.js",
  "./js/model/soil/intervention.js",
  "./js/model/soil/inference.js",
  "./js/model/soil/sensitivity.js",
  "./js/model/soil/paper-runner.js",
  "./js/model/soil/evidence-runner.js",
  "./js/model/water/intervention.js",
  "./js/model/water/inference.js",
  "./js/model/water/sensitivity.js",
  "./js/model/water/paper-runner.js",
  "./js/model/water/evidence-runner.js",
  "./js/model/unified/budget-allocation.js",
  "./js/model/unified/sequential-reallocation.js",
  "./js/model/unified/adaptive-program-simulation.js",
  "./js/model/unified/robust-policy-ensemble.js",
  "./js/model/unified/spatial-deployment.js",
  "./js/model/unified/host-inventory.js",
  "./js/model/unified/field-campaign.js",
  "./js/model/unified/campaign-tracking.js",
  "./js/model/unified/commissioning-operations.js",
  "./js/model/kernels.js",
  "./js/model/objective.js",
  "./js/model/optimization/constraints.js",
  "./js/model/optimization/pareto.js",
  "./js/model/optimization/profiles.js",
  "./js/model/optimizer.js",
  "./js/model/schema/scenario.js",
  "./js/release/health.js",
  "./js/release/domain-audit.js",
  "./js/release/documentation.js",
  "./js/release/onboarding.js",
  "./js/release/version.js",
  "./js/storage/browser-store.js",
  "./js/storage/cache.js",
  "./js/workspace/persistence.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await Promise.allSettled(LIBRARY_ASSETS.map((asset) => cache.add(asset)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    const isMapLibreAsset = url.hostname === "unpkg.com" && url.pathname.includes("/maplibre-gl@5.6.0/");
    const isThreeAsset = url.hostname === "cdnjs.cloudflare.com" && url.pathname === "/ajax/libs/three.js/0.185.1/three.module.min.js";
    if (isMapLibreAsset || isThreeAsset) {
      event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    }
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("./index.html"))
    );
    return;
  }

  const updateSensitive = ["script", "style", "worker", "manifest"].includes(request.destination)
    || /\.(?:js|css|json|webmanifest)$/.test(url.pathname);

  if (updateSensitive) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
