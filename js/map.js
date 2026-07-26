const COLOR_PALETTES = Object.freeze({
  standard: [
    [0.0, [16, 39, 92]],
    [0.20, [0, 89, 126]],
    [0.42, [0, 139, 119]],
    [0.62, [127, 166, 65]],
    [0.80, [210, 128, 45]],
    [1.0, [184, 54, 43]]
  ],
  colorblind: [
    [0.0, [29, 68, 136]],
    [0.22, [73, 119, 178]],
    [0.44, [104, 168, 165]],
    [0.64, [231, 201, 102]],
    [0.82, [224, 136, 64]],
    [1.0, [166, 54, 94]]
  ]
});

const BASEMAP_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  positron: "https://tiles.openfreemap.org/styles/positron"
};

const US_BOUNDS = [[-170.0, 18.0], [-65.0, 72.0]];

const FEATURE_MATCHERS = {
  buildings: /building/i,
  roads: /road|street|highway|transportation|railway|rail|bridge|tunnel/i,
  water: /water|waterway|river|stream|lake|ocean|marine/i,
  landuse: /landuse|landcover|park|wood|forest|grass|green/i,
  labels: /label|place|poi|housenumber|airport|transit/i
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function colorArray(value, stops = COLOR_PALETTES.standard) {
  const normalized = clamp(value, 0, 1);
  for (let index = 1; index < stops.length; index += 1) {
    const [rightValue, rightColor] = stops[index];
    const [leftValue, leftColor] = stops[index - 1];
    if (normalized <= rightValue) {
      const ratio = (normalized - leftValue) / Math.max(1e-9, rightValue - leftValue);
      return leftColor.map((channel, i) => Math.round(channel + ratio * (rightColor[i] - channel)));
    }
  }
  return [...stops.at(-1)[1]];
}

function interpolateColor(value, alpha = 1, stops = COLOR_PALETTES.standard) {
  return `rgba(${colorArray(value, stops).join(",")},${alpha})`;
}

export function quantile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const position = clamp(probability, 0, 1) * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const ratio = position - low;
  return sorted[low] + ratio * (sorted[high] - sorted[low]);
}

export function displayRange(values, lowProbability = 0.05, highProbability = 0.95) {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return { low: 0, high: 1 };
  let low = quantile(finiteValues, lowProbability);
  let high = quantile(finiteValues, highProbability);
  if (Math.abs(high - low) < 1e-9) {
    low = Math.min(...finiteValues);
    high = Math.max(...finiteValues);
  }
  if (Math.abs(high - low) < 1e-9) high = low + 1;
  return { low, high };
}

export function normalizeDisplayValue(value, range, contrast = 1.22) {
  const linear = clamp((Number(value) - range.low) / Math.max(1e-9, range.high - range.low), 0, 1);
  const stretched = clamp(0.5 + (linear - 0.5) * contrast, 0, 1);
  return stretched * stretched * (3 - 2 * stretched);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function describeMapLegend(layer, range, scenario = null, domainKey = "core") {
  const activeDomain = scenario?.domainKey ?? domainKey;
  const descriptors = {
    apparentTemperature: ["Apparent heat", "°F"],
    temperature: ["Air temperature", "°F"],
    humidity: ["Humidity", "%"],
    windSpeed: ["Wind speed", "mph"],
    liveApparentTemperature: ["Live apparent heat", "°F"],
    liveTemperature: ["Live air temperature", "°F"],
    liveHumidity: ["Live humidity", "%"],
    liveWindSpeed: ["Live wind speed", "mph"],
    liveWindDirection: ["Live wind direction", "°"],
    liveCloudCover: ["Live cloud cover", "%"],
    livePrecipitation: ["Live precipitation", " in"],
    posteriorHeat: ["Posterior heat index", ""],
    futureRisk: ["2050 heat index", ""],
    plannedRisk: ["Tree-action heat index", ""],
    treeCanopy: ["Tree canopy", "%"],
    impervious: ["Impervious surface proxy", "%"],
    vegetation: ["Vegetation intensity", "%"],
    waterProximity: ["Water proximity", "%"],
    surfaceHeatAmplification: ["Surface heat amplification", "%"],
    risk: [activeDomain === "heat"
      ? "Heat risk"
      : activeDomain === "air"
        ? `${scenario?.model?.pollutantLabel ?? "Air-quality"} risk`
        : activeDomain === "soil"
          ? "Soil-health risk"
          : activeDomain === "water"
            ? "Water-quality risk"
            : "Environmental risk", ""],
    uncertainty: [activeDomain === "air" ? "Air-model uncertainty" : activeDomain === "water" ? "Water-model uncertainty" : "Uncertainty", ""],
    predictiveUncertainty: ["Predictive uncertainty", ""],
    posteriorPollutant: [scenario?.model?.pollutantLabel ? `${scenario.model.pollutantLabel} reference-conditioned concentration` : "Reference-conditioned concentration", scenario?.model?.pollutantUnit ?? "µg/m³"],
    predictiveAirUncertainty: ["Predictive concentration uncertainty", ""],
    modelResidual: ["Monitor-informed model adjustment", scenario?.model?.pollutantUnit ?? "µg/m³"],
    remaining: ["Remaining posterior uncertainty", ""],
    exposure: ["Exposure", ""],
    vulnerability: ["Vulnerability", ""],
    interventionBenefit: [activeDomain === "air" ? "Air intervention priority" : activeDomain === "soil" ? "Soil intervention priority" : activeDomain === "water" ? "Water intervention priority" : "Intervention priority", ""],
    soilComposite: ["Soil-health composite", ""],
    soilPh: ["Soil pH", " pH"],
    posteriorSoilValue: [scenario?.model?.labAnalyteLabel ? `${scenario.model.labAnalyteLabel} laboratory-conditioned field` : "Laboratory-conditioned Soil field", scenario?.model?.labAnalyteUnit ? ` ${scenario.model.labAnalyteUnit}` : ""],
    predictiveSoilUncertainty: ["Predictive Soil uncertainty", scenario?.model?.labAnalyteUnit ? ` ${scenario.model.labAnalyteUnit}` : ""],
    soilModelResidual: ["Laboratory-informed model adjustment", scenario?.model?.labAnalyteUnit ? ` ${scenario.model.labAnalyteUnit}` : ""],
    organicMatter: ["Organic matter", "%"],
    clayPercent: ["Clay content", "%"],
    availableWater: ["Available water capacity", " cm/cm"],
    electricalConductivity: ["Electrical conductivity", " dS/m"],
    saturatedConductivity: ["Saturated hydraulic conductivity", " µm/s"],
    disturbancePressure: ["Mapped disturbance pressure", "%"],
    pollutantValue: [scenario?.model?.pollutantLabel ? `${scenario.model.pollutantLabel} concentration` : "Pollutant concentration", scenario?.model?.pollutantUnit ?? "µg/m³"],
    pollutantAqi: [scenario?.model?.pollutantLabel ? `${scenario.model.pollutantLabel} U.S. AQI` : "Pollutant-specific U.S. AQI", ""],
    usAqi: ["Overall U.S. Air Quality Index", ""],
    trafficIntensity: ["Traffic-source proximity", "%"],
    industrialProximity: ["Industrial-source proximity", "%"],
    sourceRisk: ["Combined source pressure", "%"],
    downwindSourceRisk: ["Downwind source influence", "%"],
    windDirection: ["Wind direction", "°"],
    waterIndicatorValue: [scenario?.model?.indicatorLabel ?? "Water-quality indicator", scenario?.model?.indicatorUnit ? ` ${scenario.model.indicatorUnit}` : ""],
    priorWaterIndicatorValue: [scenario?.model?.indicatorLabel ? `${scenario.model.indicatorLabel} screening prior` : "Water screening prior", scenario?.model?.indicatorUnit ? ` ${scenario.model.indicatorUnit}` : ""],
    posteriorWaterValue: [scenario?.model?.indicatorLabel ? `${scenario.model.indicatorLabel} flow-aware posterior` : "Flow-aware Water posterior", scenario?.model?.indicatorUnit ? ` ${scenario.model.indicatorUnit}` : ""],
    waterModelResidual: ["Observation-informed Water model adjustment", scenario?.model?.indicatorUnit ? ` ${scenario.model.indicatorUnit}` : ""],
    predictiveWaterUncertainty: ["Predictive Water uncertainty", scenario?.model?.indicatorUnit ? ` ${scenario.model.indicatorUnit}` : ""],
    flowConnectivity: ["Flow-network connectivity", "%"],
    waterwayProximity: ["Mapped waterway proximity", "%"],
    monitoringDensity: ["Existing monitoring density", "%"],
    upstreamSourcePressure: ["Upstream source pressure", "%"],
    downstreamExposure: ["Downstream receptor exposure", "%"]
  };
  const [label, unit] = descriptors[layer] ?? [activeDomain === "air" ? "Air-quality field" : activeDomain === "soil" ? "Soil field" : "Environmental field", ""];
  const format = (value) => {
    if (!Number.isFinite(value)) return "--";
    if (unit === "%" && Math.abs(value) <= 1.25) return `${Math.round(value * 100)}%`;
    if (unit) return `${value.toFixed(Math.abs(value) >= 100 ? 0 : 1)}${unit}`;
    return value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
  };
  return { label, low: format(range.low), high: format(range.high) };
}

export class LumosMap {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    this.canvas = this.container.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    this.scenario = null;
    this.viewportOverlay = null;
    this.currentLayer = "risk";
    this.domainKey = "core";
    this.fieldRasterCache = null;
    this.result = null;
    this.selected = [];
    this.showCandidates = false;
    this.overlayOpacity = 0.78;
    this.paletteName = "standard";
    this.colorStops = COLOR_PALETTES.standard;
    this.reducedMotion = false;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.baseMap = null;
    this.locationMarker = null;
    this.coordinateListener = null;
    this.viewportChangeListener = null;
    this.featureVisibility = {
      roads: true,
      buildings: true,
      water: true,
      landuse: true,
      labels: true
    };
    this.originalLayerVisibility = new Map();
    this.liveAnimationEnabled = false;
    this.liveAnimationFrame = null;
    this.liveAnimationPhase = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.initializeBaseMap();
    this.resize();
  }

  initializeBaseMap() {
    if (!window.maplibregl || !this.container.querySelector("#baseMap")) return;
    try {
      this.baseMap = new window.maplibregl.Map({
        container: "baseMap",
        style: BASEMAP_STYLES.dark,
        center: [-98.6, 39.5],
        zoom: 3.15,
        minZoom: 1.5,
        maxZoom: 19,
        attributionControl: true,
        preserveDrawingBuffer: true,
        hash: false
      });
      this.baseMap.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      this.baseMap.addControl(new window.maplibregl.FullscreenControl({ container: this.container }), "bottom-right");
      this.baseMap.addControl(new window.maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserHeading: true,
        fitBoundsOptions: { maxZoom: 14 }
      }), "bottom-right");
      this.baseMap.addControl(new window.maplibregl.ScaleControl({ maxWidth: 120, unit: "imperial" }), "bottom-left");

      this.baseMap.on("load", () => {
        this.captureOriginalLayerVisibility();
        this.applyAllFeatureVisibility();
        this.render();
      });
      this.baseMap.on("style.load", () => {
        this.captureOriginalLayerVisibility();
        this.applyAllFeatureVisibility();
        this.render();
      });
      for (const event of ["move", "zoom", "rotate", "pitch", "resize"]) {
        this.baseMap.on(event, () => this.render());
      }
      this.baseMap.on("moveend", (event) => {
        this.viewportChangeListener?.({
          bounds: this.getViewportBounds(),
          userInitiated: Boolean(event?.originalEvent)
        });
      });
      this.baseMap.on("mousemove", (event) => {
        this.coordinateListener?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
      });
      this.baseMap.on("click", (event) => this.placeLocationMarker(event.lngLat.lng, event.lngLat.lat, "Selected map point"));
    } catch (error) {
      console.warn("LUMOS basemap could not initialize; retaining canvas-only map.", error);
      this.baseMap = null;
    }
  }

  onCoordinateChange(listener) {
    this.coordinateListener = listener;
  }

  onViewportChange(listener) {
    this.viewportChangeListener = listener;
  }

  getViewportBounds() {
    if (!this.baseMap) return null;
    const bounds = this.baseMap.getBounds();
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    };
  }

  getViewState() {
    if (!this.baseMap) return null;
    const center = this.baseMap.getCenter();
    return {
      center: [center.lng, center.lat],
      zoom: this.baseMap.getZoom(),
      bearing: this.baseMap.getBearing(),
      pitch: this.baseMap.getPitch()
    };
  }

  restoreViewState(view, { animate = false } = {}) {
    if (!this.baseMap || !Array.isArray(view?.center)) return false;
    const options = {
      center: view.center,
      zoom: Number.isFinite(view.zoom) ? view.zoom : this.baseMap.getZoom(),
      bearing: Number.isFinite(view.bearing) ? view.bearing : 0,
      pitch: Number.isFinite(view.pitch) ? view.pitch : 0
    };
    if (animate) this.baseMap.easeTo({ ...options, duration: 700 });
    else this.baseMap.jumpTo(options);
    return true;
  }

  displayScenario() {
    return this.viewportOverlay ?? this.scenario;
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.baseMap?.resize();
    this.fieldRasterCache = null;
    this.render();
  }

  setDomainKey(domainKey = "core") {
    this.domainKey = domainKey;
    this.fieldRasterCache = null;
    const scenario = this.displayScenario();
    if (!scenario?.cells?.length) this.resetLegend();
    else this.render();
  }

  resetLegend() {
    const title = document.querySelector("#legendTitle");
    const low = document.querySelector("#legendLow");
    const high = document.querySelector("#legendHigh");
    const domainLabels = {
      heat: "Heat risk",
      air: "Air-quality risk",
      soil: "Soil-health risk",
      water: "Water-quality risk",
      core: "Environmental field"
    };
    if (title) title.textContent = domainLabels[this.domainKey] ?? "Environmental field";
    if (low) low.textContent = "Lower";
    if (high) high.textContent = "Higher";
  }

  setScenario(scenario, { fit = true } = {}) {
    this.scenario = scenario;
    this.viewportOverlay = null;
    this.result = null;
    this.selected = [];
    this.fieldRasterCache = null;
    if (scenario?.domainKey) this.domainKey = scenario.domainKey;
    if (fit) this.fitScenario({ animate: false });
    if (!scenario?.cells?.length) this.resetLegend();
    this.render();
  }

  setViewportOverlay(scenario) {
    this.viewportOverlay = scenario ?? null;
    this.fieldRasterCache = null;
    this.render();
  }

  clearViewportOverlay() {
    this.viewportOverlay = null;
    this.fieldRasterCache = null;
    this.render();
  }

  hasViewportOverlay() {
    return Boolean(this.viewportOverlay);
  }

  setLayer(layer) {
    if (this.currentLayer !== layer) this.fieldRasterCache = null;
    this.currentLayer = layer;
    if (!this.displayScenario()?.cells?.length) this.resetLegend();
    this.render();
  }

  setCandidatesVisible(visible) {
    this.showCandidates = visible;
    this.render();
  }

  setResult(result) {
    this.result = result ?? null;
    this.selected = result?.selected ?? [];
    this.fieldRasterCache = null;
    this.render();
  }

  setOverlayOpacity(value) {
    this.overlayOpacity = clamp(Number(value) || 0.78, 0.15, 1);
    this.render();
  }

  setBasemapStyle(styleKey) {
    if (!this.baseMap) return;
    const style = BASEMAP_STYLES[styleKey] ?? BASEMAP_STYLES.dark;
    this.originalLayerVisibility.clear();
    this.baseMap.setStyle(style);
  }

  setFeatureVisible(feature, visible) {
    if (!(feature in this.featureVisibility)) return;
    this.featureVisibility[feature] = Boolean(visible);
    this.applyAllFeatureVisibility();
  }

  captureOriginalLayerVisibility() {
    if (!this.baseMap?.isStyleLoaded()) return;
    for (const layer of this.baseMap.getStyle()?.layers ?? []) {
      if (!this.originalLayerVisibility.has(layer.id)) {
        this.originalLayerVisibility.set(layer.id, layer.layout?.visibility ?? "visible");
      }
    }
  }

  layerMatchesFeature(layer, feature) {
    const searchable = `${layer.id} ${layer["source-layer"] ?? ""}`;
    return FEATURE_MATCHERS[feature].test(searchable);
  }

  applyAllFeatureVisibility() {
    if (!this.baseMap?.isStyleLoaded()) return;
    for (const layer of this.baseMap.getStyle()?.layers ?? []) {
      const matchingFeatures = Object.keys(this.featureVisibility)
        .filter((feature) => this.layerMatchesFeature(layer, feature));
      if (!matchingFeatures.length) continue;
      const visible = matchingFeatures.every((feature) => this.featureVisibility[feature]);
      try {
        const original = this.originalLayerVisibility.get(layer.id) ?? "visible";
        this.baseMap.setLayoutProperty(layer.id, "visibility", visible ? original : "none");
      } catch {
        // Some style layers can disappear while styles are being replaced.
      }
    }
  }

  setPalette(name = "standard") {
    this.paletteName = Object.hasOwn(COLOR_PALETTES, name) ? name : "standard";
    this.colorStops = COLOR_PALETTES[this.paletteName];
    this.fieldRasterCache = null;
    this.render();
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
    if (this.reducedMotion) this.setLiveAnimation(false);
  }

  showUnitedStates() {
    if (!this.baseMap) return;
    this.baseMap.fitBounds(US_BOUNDS, { padding: 35, duration: this.reducedMotion ? 0 : 850 });
  }

  scenarioLngLat(item, scenario = this.displayScenario()) {
    const lng = finite(item?.lng ?? item?.longitude);
    const lat = finite(item?.lat ?? item?.latitude);
    if (lng !== null && lat !== null) return { lng, lat };
    const bounds = scenario?.bounds;
    if (!Array.isArray(bounds) || bounds.length < 2) return null;
    const south = finite(bounds[0]?.[0]);
    const west = finite(bounds[0]?.[1]);
    const north = finite(bounds[1]?.[0]);
    const east = finite(bounds[1]?.[1]);
    if ([south, west, north, east].some((value) => value === null)) return null;
    return {
      lng: west + clamp(finite(item?.x) ?? 0.5, 0, 1) * (east - west),
      lat: south + clamp(finite(item?.y) ?? 0.5, 0, 1) * (north - south)
    };
  }

  scenarioMapBounds(scenario = this.displayScenario()) {
    const geo = scenario?.geoBounds;
    if (geo && [geo.minLng, geo.minLat, geo.maxLng, geo.maxLat].every(Number.isFinite)) {
      return [[geo.minLng, geo.minLat], [geo.maxLng, geo.maxLat]];
    }
    const bounds = scenario?.bounds;
    if (Array.isArray(bounds) && bounds.length >= 2) {
      return [[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[1][0]]];
    }
    return null;
  }

  fitScenario({ animate = true } = {}) {
    if (!this.baseMap || !this.scenario) return;
    const bounds = this.scenarioMapBounds(this.scenario);
    if (!bounds) return;
    this.baseMap.fitBounds(bounds, {
      padding: { top: 95, right: 55, bottom: 55, left: 55 },
      duration: animate && !this.reducedMotion ? 850 : 0,
      maxZoom: ["live-city", "live-national"].includes(this.scenario.scenarioType) ? 11.6 : 8.5
    });
  }

  flyToLocation(location) {
    if (!this.baseMap || !location) return;
    const box = location.boundingBox;
    if (box && [box.west, box.south, box.east, box.north].every(Number.isFinite)) {
      this.baseMap.fitBounds([[box.west, box.south], [box.east, box.north]], {
        padding: { top: 110, right: 55, bottom: 55, left: 55 },
        duration: this.reducedMotion ? 0 : 900,
        maxZoom: 16
      });
    } else {
      const zoom = location.type === "coordinate" ? 14 : 12;
      this.baseMap.flyTo({ center: [location.lng, location.lat], zoom, duration: this.reducedMotion ? 0 : 900 });
    }
    this.placeLocationMarker(location.lng, location.lat, location.label ?? "Selected location");
  }

  placeLocationMarker(lng, lat, label = "Selected location") {
    if (!this.baseMap || !window.maplibregl) return;
    this.locationMarker?.remove();
    const popup = new window.maplibregl.Popup({ offset: 18 }).setHTML(
      `<strong>${String(label).replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</strong><br><small>${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`
    );
    this.locationMarker = new window.maplibregl.Marker({ color: "#bdfc6b" })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(this.baseMap);
  }

  requestUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Browser geolocation is unavailable."));
        return;
      }
      navigator.geolocation.getCurrentPosition((position) => {
        const location = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          label: "Your location",
          type: "coordinate",
          boundingBox: null
        };
        this.flyToLocation(location);
        resolve(location);
      }, (error) => reject(new Error(error.message || "Location access was denied.")), {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      });
    });
  }

  invalidateField() {
    this.fieldRasterCache = null;
    this.render();
  }

  setLiveAnimation(enabled) {
    this.liveAnimationEnabled = Boolean(enabled);
    if (!this.liveAnimationEnabled && this.liveAnimationFrame) {
      cancelAnimationFrame(this.liveAnimationFrame);
      this.liveAnimationFrame = null;
      this.liveAnimationPhase = 0;
      this.render();
      return;
    }
    if (this.liveAnimationEnabled && !this.liveAnimationFrame) {
      let previous = performance.now();
      const animate = (timestamp) => {
        if (!this.liveAnimationEnabled) {
          this.liveAnimationFrame = null;
          return;
        }
        if (timestamp - previous >= 90) {
          previous = timestamp;
          this.liveAnimationPhase = (this.liveAnimationPhase + 0.035) % 1;
          this.render();
        }
        this.liveAnimationFrame = requestAnimationFrame(animate);
      };
      this.liveAnimationFrame = requestAnimationFrame(animate);
    }
  }

  exportPng({ includeBasemap = true } = {}) {
    const output = document.createElement("canvas");
    output.width = this.canvas.width;
    output.height = this.canvas.height;
    const context = output.getContext("2d");
    if (includeBasemap && this.baseMap?.getCanvas) {
      try {
        context.drawImage(this.baseMap.getCanvas(), 0, 0, output.width, output.height);
      } catch (error) {
        console.warn("Basemap could not be included in the export; exporting the LUMOS overlay only.", error);
      }
    }
    context.drawImage(this.canvas, 0, 0, output.width, output.height);
    return output.toDataURL("image/png");
  }

  valueForCell(cell, index) {
    if (this.currentLayer === "remaining" && this.result?.posteriorVariance) {
      return this.result.posteriorVariance[index];
    }
    return cell[this.currentLayer] ?? cell.risk;
  }

  pointForItem(item) {
    const lngLat = this.scenarioLngLat(item, this.displayScenario());
    if (this.baseMap && lngLat) {
      const point = this.baseMap.project([lngLat.lng, lngLat.lat]);
      return { x: point.x, y: point.y };
    }
    const padding = 28;
    return {
      x: padding + clamp(item?.x ?? 0.5, 0, 1) * (this.width - padding * 2),
      y: this.height - padding - clamp(item?.y ?? 0.5, 0, 1) * (this.height - padding * 2)
    };
  }

  drawBackground() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.baseMap) return;
    const background = ctx.createLinearGradient(0, 0, this.width, this.height);
    background.addColorStop(0, "#07120f");
    background.addColorStop(1, "#0a1715");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(214,241,231,0.045)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i += 1) {
      const x = 24 + (this.width - 48) * (i / 12);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i += 1) {
      const y = 24 + (this.height - 48) * (i / 8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  legendDescriptor(range, scenario) {
    return describeMapLegend(this.currentLayer, range, scenario, this.domainKey);
  }

  updateLegend(range, scenario) {
    const descriptor = this.legendDescriptor(range, scenario);
    const title = document.querySelector("#legendTitle");
    const low = document.querySelector("#legendLow");
    const high = document.querySelector("#legendHigh");
    if (title) title.textContent = descriptor.label;
    if (low) low.textContent = descriptor.low;
    if (high) high.textContent = descriptor.high;
  }

  normalizedCellPoint(cell, scenario) {
    const x = finite(cell?.x);
    const y = finite(cell?.y);
    if (x !== null && y !== null) return { x: clamp(x, 0, 1), y: 1 - clamp(y, 0, 1) };
    const bounds = scenario?.geoBounds;
    const lng = finite(cell?.lng ?? cell?.longitude);
    const lat = finite(cell?.lat ?? cell?.latitude);
    if (!bounds || lng === null || lat === null) return null;
    return {
      x: clamp((lng - bounds.minLng) / Math.max(1e-9, bounds.maxLng - bounds.minLng), 0, 1),
      y: 1 - clamp((lat - bounds.minLat) / Math.max(1e-9, bounds.maxLat - bounds.minLat), 0, 1)
    };
  }

  buildFieldRaster(scenario, values, range) {
    const width = clamp(Math.round(this.width / 4), 120, 300);
    const height = clamp(Math.round(this.height / 4), 90, 220);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    const image = context.createImageData(width, height);
    const points = scenario.cells.map((cell, index) => {
      const point = this.normalizedCellPoint(cell, scenario);
      const value = values[index];
      return point && Number.isFinite(value) ? { ...point, value } : null;
    }).filter(Boolean);
    if (!points.length) return canvas;

    const nearestCount = Math.min(10, points.length);
    for (let row = 0; row < height; row += 1) {
      const y = row / Math.max(1, height - 1);
      for (let column = 0; column < width; column += 1) {
        const x = column / Math.max(1, width - 1);
        const nearest = [];
        for (const point of points) {
          const distanceSquared = (point.x - x) ** 2 + (point.y - y) ** 2;
          if (nearest.length < nearestCount) {
            nearest.push({ distanceSquared, value: point.value });
            if (nearest.length === nearestCount) nearest.sort((left, right) => left.distanceSquared - right.distanceSquared);
          } else if (distanceSquared < nearest[nearestCount - 1].distanceSquared) {
            nearest[nearestCount - 1] = { distanceSquared, value: point.value };
            nearest.sort((left, right) => left.distanceSquared - right.distanceSquared);
          }
        }
        let estimate = nearest[0].value;
        if (nearest[0].distanceSquared > 1e-10) {
          let weighted = 0;
          let totalWeight = 0;
          for (const neighbor of nearest) {
            const weight = 1 / ((neighbor.distanceSquared + 0.00005) ** 1.12);
            weighted += weight * neighbor.value;
            totalWeight += weight;
          }
          estimate = weighted / Math.max(1e-12, totalWeight);
        }
        const normalized = normalizeDisplayValue(estimate, range);
        const color = colorArray(normalized, this.colorStops);
        const index = (row * width + column) * 4;
        image.data[index] = color[0];
        image.data[index + 1] = color[1];
        image.data[index + 2] = color[2];
        image.data[index + 3] = 242;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  fieldScreenBounds(scenario) {
    const bounds = this.scenarioMapBounds(scenario);
    if (!this.baseMap || !bounds) return { x: 0, y: 0, width: this.width, height: this.height };
    const northwest = this.baseMap.project([bounds[0][0], bounds[1][1]]);
    const southeast = this.baseMap.project([bounds[1][0], bounds[0][1]]);
    return {
      x: northwest.x,
      y: northwest.y,
      width: southeast.x - northwest.x,
      height: southeast.y - northwest.y
    };
  }

  drawField() {
    const scenario = this.displayScenario();
    if (!scenario?.cells?.length) {
      this.resetLegend();
      return;
    }
    const ctx = this.context;
    const values = scenario.cells.map((cell, index) => this.valueForCell(cell, index));
    const range = displayRange(values, 0.05, 0.95);
    const resultReference = this.currentLayer === "remaining" ? this.result?.posteriorVariance : null;
    const cacheValid = this.fieldRasterCache
      && this.fieldRasterCache.scenario === scenario
      && this.fieldRasterCache.layer === this.currentLayer
      && this.fieldRasterCache.resultReference === resultReference
      && this.fieldRasterCache.widthBucket === Math.round(this.width / 40)
      && this.fieldRasterCache.heightBucket === Math.round(this.height / 40);
    if (!cacheValid) {
      this.fieldRasterCache = {
        scenario,
        layer: this.currentLayer,
        resultReference,
        widthBucket: Math.round(this.width / 40),
        heightBucket: Math.round(this.height / 40),
        range,
        raster: this.buildFieldRaster(scenario, values, range)
      };
    }
    const screen = this.fieldScreenBounds(scenario);
    if (!Number.isFinite(screen.width) || !Number.isFinite(screen.height) || Math.abs(screen.width) < 1 || Math.abs(screen.height) < 1) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(2, 8, 11, ${0.24 * this.overlayOpacity})`;
    ctx.fillRect(screen.x, screen.y, screen.width, screen.height);
    ctx.globalAlpha = this.overlayOpacity;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = "saturate(1.16) contrast(1.08)";
    ctx.drawImage(this.fieldRasterCache.raster, screen.x, screen.y, screen.width, screen.height);
    ctx.restore();
    this.updateLegend(this.fieldRasterCache.range, scenario);
  }

  traceNormalizedRing(ring) {
    ring.forEach(([x, y], index) => {
      const point = this.pointForItem({ x, y });
      if (index === 0) this.context.moveTo(point.x, point.y);
      else this.context.lineTo(point.x, point.y);
    });
    this.context.closePath();
  }

  traceGeoRing(ring) {
    ring.forEach(([lng, lat], index) => {
      const point = this.pointForItem({ lng, lat });
      if (index === 0) this.context.moveTo(point.x, point.y);
      else this.context.lineTo(point.x, point.y);
    });
    this.context.closePath();
  }

  drawLiveWind() {
    if (!this.liveAnimationEnabled) return;
    const scenario = this.displayScenario();
    if (!scenario?.cells?.length) return;
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = "rgba(236, 249, 245, 0.62)";
    ctx.fillStyle = "rgba(236, 249, 245, 0.72)";
    ctx.lineWidth = 1.15;
    const stride = Math.max(1, Math.round(Math.sqrt(scenario.cells.length) / 4));
    for (let index = 0; index < scenario.cells.length; index += stride) {
      const cell = scenario.cells[index];
      const direction = finite(cell.liveWindDirection ?? cell.windDirection);
      const speed = finite(cell.liveWindSpeed ?? cell.windSpeed);
      if (direction === null || speed === null) continue;
      const origin = this.pointForItem(cell);
      const radians = (direction - 90) * Math.PI / 180;
      const length = 8 + Math.min(17, Math.max(0, speed) * 0.34);
      const travel = (this.liveAnimationPhase - 0.5) * Math.min(8, length * 0.35);
      const startX = origin.x + Math.cos(radians) * travel;
      const startY = origin.y + Math.sin(radians) * travel;
      const endX = startX + Math.cos(radians) * length;
      const endY = startY + Math.sin(radians) * length;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const head = 3.5;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - Math.cos(radians - 0.55) * head, endY - Math.sin(radians - 0.55) * head);
      ctx.lineTo(endX - Math.cos(radians + 0.55) * head, endY - Math.sin(radians + 0.55) * head);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawBoundaries() {
    const scenario = this.displayScenario();
    if (!scenario?.boundaries?.length) return;
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = "rgba(218,241,234,0.48)";
    ctx.fillStyle = "rgba(6,16,14,0.03)";
    ctx.lineWidth = 0.9;
    for (const boundary of scenario.boundaries) {
      const geometry = boundary.geoGeometry ?? boundary.geometry;
      if (!geometry) continue;
      const geo = Boolean(boundary.geoGeometry);
      const trace = geo ? (ring) => this.traceGeoRing(ring) : (ring) => this.traceNormalizedRing(ring);
      ctx.beginPath();
      if (geometry.type === "Polygon") {
        geometry.coordinates.forEach(trace);
      } else if (geometry.type === "MultiPolygon") {
        geometry.coordinates.forEach((polygon) => polygon.forEach(trace));
      }
      ctx.fill("evenodd");
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCandidates() {
    if (this.viewportOverlay || !this.scenario || !this.showCandidates) return;
    const ctx = this.context;
    for (const candidate of this.scenario.candidates) {
      const point = this.pointForItem(candidate);
      if (point.x < -5 || point.x > this.width + 5 || point.y < -5 || point.y > this.height + 5) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, candidate.feasible ? 2.8 : 2.1, 0, Math.PI * 2);
      ctx.fillStyle = candidate.feasible ? "rgba(239,248,245,0.72)" : "rgba(255,157,143,0.50)";
      ctx.fill();
    }
  }

  drawExistingObservations() {
    if (this.viewportOverlay || !this.scenario?.observations) return;
    const ctx = this.context;
    for (const observation of this.scenario.observations) {
      const point = this.pointForItem(observation);
      if (point.x < -10 || point.x > this.width + 10 || point.y < -10 || point.y > this.height + 10) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(7,16,15,0.92)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(137,221,255,0.95)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(137,221,255,0.95)";
      ctx.fill();
    }
  }

  drawSensors() {
    const ctx = this.context;
    const roleStyles = {
      treatment: { fill: "#ff815f", text: "#2b0c05", shadow: "rgba(255,129,95,0.42)" },
      control: { fill: "#89ddff", text: "#061a23", shadow: "rgba(137,221,255,0.42)" },
      boundary: { fill: "#ffd88a", text: "#2b2108", shadow: "rgba(255,216,138,0.42)" },
      spillover: { fill: "#d7a6ff", text: "#21102f", shadow: "rgba(215,166,255,0.42)" },
      supplemental: { fill: "#bdfc6b", text: "#10220f", shadow: "rgba(189,252,107,0.38)" }
    };
    if (this.viewportOverlay) return;
    this.selected.forEach((candidate, index) => {
      const point = this.pointForItem(candidate);
      if (point.x < -15 || point.x > this.width + 15 || point.y < -15 || point.y > this.height + 15) return;
      const style = roleStyles[candidate.interventionRole] ?? roleStyles.supplemental;
      ctx.shadowColor = style.shadow;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = style.fill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#07100f";
      ctx.stroke();
      ctx.fillStyle = style.text;
      ctx.font = "700 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = Array.isArray(candidate.domainKeys) && candidate.domainKeys.length
        ? (candidate.domainKeys.length > 1 ? String(candidate.domainKeys.length) : candidate.domainKeys[0][0].toUpperCase())
        : candidate.interventionRole
          ? candidate.interventionRole[0].toUpperCase()
          : String(index + 1);
      ctx.fillText(label, point.x, point.y + 0.5);
    });
  }

  drawLabels() {
    if (this.baseMap) return;
    const scenario = this.displayScenario();
    const ctx = this.context;
    ctx.fillStyle = "rgba(219,240,233,0.45)";
    ctx.font = "600 10px Inter, sans-serif";
    ctx.textAlign = "left";
    const label = scenario?.scenarioType === "live-national-air"
      ? `${scenario.cityLabel} · ${scenario.model?.pollutantLabel ?? "air-quality"} monitoring field`
      : scenario?.scenarioType === "live-viewport"
        ? "Open-Meteo current viewport heat surface"
        : scenario?.scenarioType === "live-city"
          ? `${scenario.cityLabel} · official-source adaptive heat field`
          : "Synthetic continuous-field evaluation surface";
    ctx.fillText(label, 30, 26);
    ctx.textAlign = "right";
    const existing = scenario?.observations?.length ?? 0;
    ctx.fillText(`${(scenario?.cells.length ?? 0).toLocaleString()} evaluation points · ${existing} conditioned observations`, this.width - 30, 26);
  }

  render() {
    if (!this.context) return;
    this.drawBackground();
    this.drawField();
    this.drawLiveWind();
    this.drawBoundaries();
    this.drawCandidates();
    this.drawExistingObservations();
    this.drawSensors();
    this.drawLabels();
  }
}
