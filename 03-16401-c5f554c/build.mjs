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
  pr: "c5f554cfa0615ef72d9c53be506c8f184c61d7bf",
  base: "f8b4091e996943438b1e667d407d862bc08c2f8b",
}[label];
if (!sourceDirectory || (!expectedSha && !isWebpack)) {
  throw new Error("Use pr/base with RSPACK_SOURCE, or webpack with WEBPACK_SOURCE");
}
const sourceSha = isWebpack ? null : spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: sourceDirectory, encoding: "utf8",
}).stdout.trim();
if (expectedSha && sourceSha !== expectedSha) throw new Error(`Expected ${expectedSha}, received ${sourceSha}`);
const version = JSON.parse(readFileSync(path.join(sourceDirectory,
  isWebpack ? "package.json" : "packages/rspack/package.json"), "utf8")).version;
if (isWebpack && version !== "5.112.2") throw new Error(`Expected webpack 5.112.2, received ${version}`);
const implementation = await import(pathToFileURL(path.join(sourceDirectory,
  isWebpack ? "lib/index.js" : "packages/rspack/dist/index.js")).href);
const bundle = isWebpack ? implementation.default : implementation.rspack;
const binary = isWebpack ? null : process.env.RSPACK_BINDING_BINARY || process.env.RSPACK_BINDING;
const results = [];
for (const variant of ["multi", "b-only"]) {
  const name = `${label}-${variant}`;
  const entry = variant === "multi" ? config.entry : { b: config.entry.b };
  const directory = path.join(root, "dist", name);
  const compiler = bundle({ ...config, entry, output: { ...config.output, path: directory } });
  const stats = await new Promise((resolve, reject) => {
    compiler.run((error, stats) => compiler.close(closeError => {
      if (error || closeError) reject(error || closeError);
      else if (stats.hasErrors()) reject(new Error(stats.toString()));
      else resolve(stats);
    }));
  });
  for (const entryName of Object.keys(entry)) {
    const filename = `${entryName}.cjs`;
    const file = path.join(directory, filename);
    const emitted = readFileSync(file, "utf8");
    const jsonLiteral = emitted.match(/module\.exports\s*=\s*(\[[0-9,\s]+\])/);
    if (!jsonLiteral) throw new Error(`Cannot locate emitted JSON array in ${file}`);
    const run = spawnSync(process.execPath, [file], { encoding: "utf8", timeout: 5000 });
    if (run.error) throw run.error;
    const result = {
      case: name, entry: entryName, sourceSha, version,
      bindingSourceSha: isWebpack ? null : process.env.RSPACK_BINDING_SOURCE_SHA || sourceSha,
      bindingFile: binary ? path.basename(binary) : null,
      bindingSha256: binary ? createHash("sha256").update(readFileSync(binary)).digest("hex") : null,
      buildErrors: stats.hasErrors(), emittedArray: JSON.parse(jsonLiteral[1]),
      bundleBytes: Buffer.byteLength(emitted), exitCode: run.status,
      stdout: run.stdout.trim(), stderr: run.stderr.trim().replaceAll(root, "<repro>/"),
    };
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }
}
mkdirSync(path.join(root, "results"), { recursive: true });
writeFileSync(path.join(root, "results", `${label}.json`), JSON.stringify(results, null, 2) + "\n");
