import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import config from "./rspack.config.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || "pr";
const sourceDirectory = process.env.RSPACK_SOURCE;
const expectedSha = {
  pr: "e156d242f031897c4d1b35e696479d753ca68921",
  base: "f8b4091e996943438b1e667d407d862bc08c2f8b",
}[label];
if (!sourceDirectory || !expectedSha) {
  throw new Error("Set RSPACK_SOURCE to a built Rspack checkout and use label pr or base");
}
const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: sourceDirectory, encoding: "utf8",
}).stdout.trim();
if (sourceSha !== expectedSha) {
  throw new Error(`Expected ${expectedSha} for ${label}, received ${sourceSha}`);
}
const { rspack } = await import(pathToFileURL(path.join(
  sourceDirectory, "packages/rspack/dist/index.js",
)).href);
const results = [];
for (const [name, split, topLevelAwait] of [
  ["split", true, true],
  ["inline", false, true],
  ["split-no-tla", true, false],
]) {
  const directory = path.join(root, "dist", `${label}-${name}`);
  const compiler = rspack({
    ...config,
    output: {
      ...config.output,
      path: directory,
      environment: { topLevelAwait },
    },
    optimization: { runtimeChunk: split ? "single" : false },
  });
  const stats = await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error || closeError) reject(error || closeError);
        else if (stats.hasErrors()) reject(new Error(stats.toString()));
        else resolve(stats);
      });
    });
  });
  writeFileSync(path.join(directory, "consumer.mjs"),
    'import { value } from "./main.mjs";\nconsole.log("value=" + value);\n');
  const source = readFileSync(path.join(directory, "main.mjs"), "utf8");
  const awaitLines = [...source.matchAll(/\b((?:__webpack_exports__|__rspack_exports))\s*=\s*await\s+\1\s*;/g)].map(match => match[0]);
  const run = spawnSync(process.execPath, [path.join(directory, "consumer.mjs")], {
    encoding: "utf8", timeout: 5000,
  });
  const result = {
    case: `${label}-${name}`,
    sourceSha,
    bindingFile: process.env.RSPACK_BINDING ? path.basename(process.env.RSPACK_BINDING) : null,
    awaitLines,
    awaitCount: awaitLines.length,
    exitCode: run.status,
    stdout: run.stdout.trim(),
    stderr: run.stderr.trim().replaceAll(root, "<repro>"),
    buildErrors: stats.hasErrors(),
  };
  results.push(result);
  console.log(JSON.stringify(result, null, 2));
}
mkdirSync(path.join(root, "results"), { recursive: true });
writeFileSync(path.join(root, "results", `${label}.json`), JSON.stringify(results, null, 2) + "\n");
