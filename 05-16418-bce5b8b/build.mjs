import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import config from "./rspack.config.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const label = process.argv[2] || "pr";
const isWebpack = label === "webpack";
const sourceDirectory = isWebpack ? process.env.WEBPACK_SOURCE : process.env.RSPACK_SOURCE;
const expectedSha = {
  pr: "bce5b8b4325389d68b4214715804f212ed79c5e1",
  base: "8b100de82f2f487bc97a7c934b856672e5eef7d0",
}[label];
if (!sourceDirectory || (!expectedSha && !isWebpack)) {
  throw new Error("Use pr/base with RSPACK_SOURCE, or webpack with WEBPACK_SOURCE");
}
const sourceRevision = isWebpack ? null : spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: sourceDirectory, encoding: "utf8",
});
if (sourceRevision?.status !== undefined && sourceRevision.status !== 0) {
  throw new Error(sourceRevision.stderr);
}
const sourceSha = sourceRevision?.stdout.trim() ?? null;
if (expectedSha && sourceSha !== expectedSha) throw new Error(`Expected ${expectedSha}, received ${sourceSha}`);
const version = JSON.parse(readFileSync(path.join(sourceDirectory,
  isWebpack ? "package.json" : "packages/rspack/package.json"), "utf8")).version;
if (isWebpack && version !== "5.112.2") throw new Error(`Expected webpack 5.112.2, received ${version}`);
const implementation = await import(pathToFileURL(path.join(sourceDirectory,
  isWebpack ? "lib/index.js" : "packages/rspack/dist/index.js")).href);
const bundle = isWebpack ? implementation.default : implementation.rspack;
const binary = isWebpack ? null : process.env.RSPACK_BINDING_BINARY || process.env.RSPACK_BINDING;
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
      else if (!stats || stats.hasErrors()) reject(new Error(stats?.toString() || "Missing stats"));
      else resolve(stats);
    }));
  });
  const file = path.join(directory, "main.cjs");
  const emitted = readFileSync(file, "utf8");
  // This fixture contains no escaped quotes or backslashes in its JSON values.
  const jsonLiteral = emitted.match(/module\.exports\s*=\s*(?:\/\*.*?\*\/\s*)?(?:JSON\.parse\('([^']+)'\)|(\{[^\n;]+\}))/);
  if (!jsonLiteral) throw new Error(`Cannot locate emitted JSON object in ${file}`);
  const run = spawnSync(process.execPath, [file], { encoding: "utf8", timeout: 5000 });
  if (run.error) throw run.error;
  const result = {
    case: name, sourceSha, version, mangleExports,
    bindingSourceSha: isWebpack ? null : process.env.RSPACK_BINDING_SOURCE_SHA || sourceSha,
    bindingFile: binary ? path.basename(binary) : null,
    bindingSha256: binary ? createHash("sha256").update(readFileSync(binary)).digest("hex") : null,
    buildErrors: stats.hasErrors(), buildWarnings: stats.hasWarnings(),
    emittedJson: JSON.parse(jsonLiteral[1] || jsonLiteral[2]), bundleBytes: Buffer.byteLength(emitted),
    exitCode: run.status, stdout: run.stdout.trim(), stderr: run.stderr.trim().replaceAll(root, "<repro>/"),
  };
  results.push(result);
  console.log(JSON.stringify(result, null, 2));
}
mkdirSync(path.join(root, "results"), { recursive: true });
writeFileSync(path.join(root, "results", `${label}.json`), JSON.stringify(results, null, 2) + "\n");
