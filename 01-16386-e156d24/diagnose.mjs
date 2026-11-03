import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("./dist/pr-split-single-await/", import.meta.url));
cpSync(new URL("./dist/pr-split/", import.meta.url), directory, { recursive: true });
const file = `${directory}/main.mjs`;
const source = readFileSync(file, "utf8");
const single = "__webpack_exports__ = await __webpack_exports__;";
if (!source.includes(single + single)) {
  throw new Error("Expected two consecutive awaits in the unmodified PR output");
}
writeFileSync(file, source.replace(single + single, single));
const run = spawnSync(process.execPath, [`${directory}/consumer.mjs`], {
  encoding: "utf8", timeout: 5000,
});
const result = {
  change: "Remove only the duplicate await from a copy of the PR output",
  exitCode: run.status,
  stdout: run.stdout.trim(),
  stderr: run.stderr.trim(),
};
writeFileSync(new URL("./results/diagnose.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (run.status !== 0 || result.stdout !== "value=42") process.exitCode = 1;
