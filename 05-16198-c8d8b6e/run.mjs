import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const [label, apiFile] = process.argv.slice(2);
if (!["pr", "base", "webpack", "webpack-release"].includes(label) || !apiFile) throw Error("Usage: node run.mjs <label> <compiler entry file>");
const root = fileURLToPath(new URL(".", import.meta.url));
const workspace = await realpath(await mkdtemp(path.join(os.tmpdir(), "hmr-recover-")));
const fixture = path.join(workspace, "src");
await cp(path.join(root, "fixture"), fixture, { recursive: true });
const output = path.join(workspace, "dist");
const saved = path.join(root, "dist", label);
await rm(saved, { recursive: true, force: true });
await mkdir(saved, { recursive: true });
const api = await import(pathToFileURL(path.resolve(apiFile)));
const compile = api.rspack || api.default;
const compiler = compile({
  ...(label.startsWith("webpack") ? { cache: false, recordsPath: path.join(workspace, "records.json") } : {}),
  mode: "development", target: "node", context: fixture, entry: "./index.js", devtool: false,
  output: { path: output, filename: "bundle.cjs", library: { type: "commonjs2" } },
  plugins: [new compile.HotModuleReplacementPlugin()]
});
const dep = path.join(fixture, "dep.js");
const source = await readFile(dep, "utf8");
compiler.hooks.beforeRun.tap("Repro", () => { compiler.modifiedFiles = new Set([dep]); });
const observations = [];
try {
  let entry;
  for (let version = 0; version < 3; version++) {
    await writeFile(dep, source.replace("resolve(0)", "resolve(" + version + ")"));
    compiler.inputFileSystem.purge();
    const stats = await new Promise((resolve,reject) => compiler.run((e,s) => e ? reject(e) : resolve(s)));
    if (stats.hasErrors()) throw new Error(stats.toString({all:false,errors:true}));
    // The saved initial bundle must remain the one used for both real updates.
    await cp(output, saved, { recursive: true, force: false, errorOnExist: false });
    if (!version) {
      entry = await createRequire(import.meta.url)(path.join(output, "bundle.cjs"));
      observations.push({ initial: entry.current() });
    } else {
      let error = null;
      try { const ids = await entry.update(); if (ids === null) throw Error("No update available"); } catch (e) { error = e.message; }
      observations.push({ error, ...entry.state() });
    }
  }
  console.log(JSON.stringify(observations, null, 2));
} finally {
  await new Promise(resolve => compiler.close(resolve));
  await rm(workspace, { recursive: true, force: true });
}
