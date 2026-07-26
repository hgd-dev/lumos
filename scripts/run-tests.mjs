import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const testFile = new URL("../tests/model.test.js", import.meta.url);
const source = await readFile(testFile, "utf8");
const testNames = [...source.matchAll(/test\("([^"]+)"/g)].map((match) => match[1]);
const advancedStart = testNames.indexOf("GitHub Pages workflow gates deployment on tests, release checks, and build");
if (advancedStart <= 0) throw new Error("Unable to locate the advanced adapter test partition.");

const groups = [
  { label: "Shared engine, interface, Heat, and foundational adapter tests", names: testNames.slice(0, advancedStart) },
  { label: "Advanced Air, Soil, Water, workflow, and evidence tests", names: testNames.slice(advancedStart) }
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runGroup(group) {
  const pattern = `^(?:${group.names.map(escapeRegex).join("|")})$`;
  console.log(`\n${group.label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--test",
      "--test-force-exit",
      "--test-concurrency=1",
      "--test-reporter=spec",
      `--test-name-pattern=${pattern}`,
      "tests/model.test.js"
    ], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        console.log(`${group.names.length} tests passed.`);
        resolve();
        return;
      }
      reject(new Error(`${group.label} exited with ${signal ? `signal ${signal}` : `status ${code}`}.`));
    });
  });
}

await Promise.all(groups.map(runGroup));
console.log(`\nAll ${testNames.length} LUMOS tests passed.`);
