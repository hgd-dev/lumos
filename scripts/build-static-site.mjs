import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const entries = [
  "index.html", "home-3d.html", "about.html", "documentation.html", "research.html", "contact.html", "unified.html", "heat.html", "air.html", "soil.html", "water.html", "workspace-shell.html",
  "404.html", "manifest.webmanifest", "service-worker.js", "robots.txt", ".nojekyll",
  "release.json", "LICENSE", "CITATION.cff", "README.md", "MODEL_SPECIFICATION.md",
  "assets", "css", "js", "docs", "data"
];
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of entries) {
  const source = path.join(root, entry);
  if (!existsSync(source)) throw new Error(`Missing deployment entry: ${entry}`);
  await cp(source, path.join(dist, entry), { recursive: true });
}
console.log(`Built static GitHub Pages artifact at ${dist}`);
