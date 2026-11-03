import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import config from "./rspack.config.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const label = process.argv[2] || "pr";
const sourceDirectory = label === "webpack" ? process.env.WEBPACK_SOURCE : process.env.RSPACK_SOURCE;
const expectedSha = {
  pr: "124b1c221352ac221d8233d69e6c6685056b5185",
  base: "f8b4091e996943438b1e667d407d862bc08c2f8b",
}[label];
if (!sourceDirectory || (!expectedSha && label !== "webpack")) {
  throw new Error("Use pr/base with RSPACK_SOURCE, or webpack with WEBPACK_SOURCE");
}
const sourceSha = label === "webpack" ? null : spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: sourceDirectory, encoding: "utf8",
}).stdout.trim();
if (expectedSha && sourceSha !== expectedSha) throw new Error(`Expected ${expectedSha}, received ${sourceSha}`);
const version = JSON.parse(readFileSync(path.join(sourceDirectory,
  label === "webpack" ? "package.json" : "packages/rspack/package.json"), "utf8")).version;
if (label === "webpack" && version !== "5.112.2") throw new Error(`Expected webpack 5.112.2, received ${version}`);
const implementation = await import(pathToFileURL(path.join(sourceDirectory,
  label === "webpack" ? "lib/index.js" : "packages/rspack/dist/index.js")).href);
const bundle = label === "webpack" ? implementation.default : implementation.rspack;
const results = [];
for (const mangleExports of [true, false]) {
  const name = `${label}-${mangleExports ? "mangle" : "no-mangle"}`;
  const directory = path.join(root, "dist", name);
  const compiler = bundle({
    ...config,
    output: { ...config.output, path: directory },
    optimization: { ...config.optimization, mangleExports },
  });
  const stats = await new Promise((resolve, reject) => {
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError) reject(error || closeError);
      else if (stats.hasErrors()) reject(new Error(stats.toString()));
      else resolve(stats);
    }));
  });
  const run = spawnSync(process.execPath, [path.join(directory, "main.cjs")], {
    encoding: "utf8", timeout: 5000,
  });
  const result = {
    case: name, sourceSha, version, mangleExports,
    bindingFile: label !== "webpack" && process.env.RSPACK_BINDING ? path.basename(process.env.RSPACK_BINDING) : null,
    buildErrors: stats.hasErrors(), exitCode: run.status,
    stdout: run.stdout.trim(), stderr: run.stderr.trim().replaceAll(root, "<repro>/"),
  };
  results.push(result);
  console.log(JSON.stringify(result, null, 2));
}
mkdirSync(path.join(root, "results"), { recursive: true });
writeFileSync(path.join(root, "results", `${label}.json`), JSON.stringify(results, null, 2) + "\n");
