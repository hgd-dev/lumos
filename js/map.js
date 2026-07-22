const COLOR_STOPS = [
  [0.0, [38, 59, 115]],
  [0.35, [52, 182, 165]],
  [0.68, [217, 241, 109]],
  [1.0, [255, 129, 95]]
];

function interpolateColor(value, alpha = 1) {
  const normalized = Math.max(0, Math.min(1, value));
  for (let index = 1; index < COLOR_STOPS.length; index += 1) {
    const [rightValue, rightColor] = COLOR_STOPS[index];
    const [leftValue, leftColor] = COLOR_STOPS[index - 1];
    if (normalized <= rightValue) {
      const ratio = (normalized - leftValue) / Math.max(1e-9, rightValue - leftValue);
      const color = leftColor.map((channel, i) => Math.round(channel + ratio * (rightColor[i] - channel)));
      return `rgba(${color.join(",")},${alpha})`;
    }
  }
  return `rgba(255,129,95,${alpha})`;
}

export class LumosMap {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    this.canvas = this.container.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    this.scenario = null;
    this.currentLayer = "risk";
    this.metrics = null;
    this.selected = [];
    this.showCandidates = false;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.render();
  }

  setScenario(scenario) {
    this.scenario = scenario;
    this.metrics = null;
    this.selected = [];
    this.render();
  }

  setLayer(layer) {
    this.currentLayer = layer;
    this.render();
  }

  setCandidatesVisible(visible) {
    this.showCandidates = visible;
    this.render();
  }

  setResult(result) {
    this.metrics = result?.metrics ?? null;
    this.selected = result?.selected ?? [];
    this.render();
  }

  valueForCell(cell, index) {
    if (this.currentLayer === "remaining" && this.metrics?.coverage) {
      return cell.uncertainty * (1 - this.metrics.coverage[index]);
    }
    return cell[this.currentLayer] ?? cell.risk;
  }

  point(x, y) {
    const padding = 28;
    return {
      x: padding + x * (this.width - padding * 2),
      y: this.height - padding - y * (this.height - padding * 2)
    };
  }

  drawBackground() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
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

    const roads = [
      [[0.02, 0.22], [0.25, 0.42], [0.48, 0.52], [0.72, 0.68], [0.98, 0.81]],
      [[0.08, 0.88], [0.28, 0.72], [0.49, 0.59], [0.73, 0.36], [0.95, 0.16]],
      [[0.18, 0.02], [0.25, 0.26], [0.31, 0.5], [0.39, 0.74], [0.46, 0.98]],
      [[0.67, 0.02], [0.64, 0.28], [0.67, 0.52], [0.78, 0.73], [0.83, 0.98]]
    ];
    ctx.strokeStyle = "rgba(212,232,225,0.12)";
    ctx.lineWidth = 2;
    for (const road of roads) {
      ctx.beginPath();
      road.forEach(([x, y], index) => {
        const point = this.point(x, y);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }

  drawField() {
    if (!this.scenario) return;
    const ctx = this.context;
    const values = this.scenario.cells.map((cell, index) => this.valueForCell(cell, index));
    const max = Math.max(...values, 1e-9);
    const min = Math.min(...values);
    const span = Math.max(1e-9, max - min);
    const radius = Math.max(8, Math.min(this.width, this.height) / 48);

    ctx.globalCompositeOperation = "screen";
    this.scenario.cells.forEach((cell, index) => {
      const point = this.point(cell.x, cell.y);
      const normalized = (values[index] - min) / span;
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 1.9);
      gradient.addColorStop(0, interpolateColor(normalized, 0.6));
      gradient.addColorStop(0.55, interpolateColor(normalized, 0.22));
      gradient.addColorStop(1, interpolateColor(normalized, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 1.9, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
  }

  drawCandidates() {
    if (!this.scenario || !this.showCandidates) return;
    const ctx = this.context;
    for (const candidate of this.scenario.candidates) {
      const point = this.point(candidate.x, candidate.y);
      ctx.beginPath();
      ctx.arc(point.x, point.y, candidate.feasible ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fillStyle = candidate.feasible ? "rgba(220,236,230,0.62)" : "rgba(255,157,143,0.45)";
      ctx.fill();
    }
  }

  drawSensors() {
    const ctx = this.context;
    this.selected.forEach((candidate, index) => {
      const point = this.point(candidate.x, candidate.y);
      ctx.shadowColor = "rgba(189,252,107,0.38)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#bdfc6b";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#07100f";
      ctx.stroke();
      ctx.fillStyle = "#10220f";
      ctx.font = "700 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), point.x, point.y + 0.5);
    });
  }

  drawLabels() {
    const ctx = this.context;
    ctx.fillStyle = "rgba(219,240,233,0.45)";
    ctx.font = "600 10px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Synthetic continuous-field evaluation surface", 30, 26);
    ctx.textAlign = "right";
    ctx.fillText(`${this.scenario?.cells.length ?? 0} evaluation points`, this.width - 30, 26);
  }

  render() {
    if (!this.context) return;
    this.drawBackground();
    this.drawField();
    this.drawCandidates();
    this.drawSensors();
    this.drawLabels();
  }
}
