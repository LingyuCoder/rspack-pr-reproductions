import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const [label, apiFile] = process.argv.slice(2);
const root = fileURLToPath(new URL(".", import.meta.url));
const workspace = await realpath(await mkdtemp(path.join(os.tmpdir(), "hmr-lazy-")));
const fixture = path.join(workspace, "src");
await cp(path.join(root, "fixture"), fixture, { recursive: true });
const output = path.join(workspace, "dist");
const saved = path.join(root, "dist", label);
await rm(saved, { recursive: true, force: true });
await mkdir(saved, { recursive: true });
const { rspack } = await import(pathToFileURL(path.resolve(apiFile)));
const compiler = rspack({ mode: "development", target: "node", context: fixture, entry: "./index.js", devtool: false, output: { path: output, filename: "bundle.cjs", chunkFilename: "[name].cjs", chunkLoadTimeout: 500, library: { type: "commonjs2" } }, plugins: [new rspack.HotModuleReplacementPlugin()] });
let modified;
compiler.hooks.beforeRun.tap("Repro", () => { compiler.modifiedFiles = new Set([modified]); });
try {
  let entry;
  for (let i=0;i<3;i++) {
    modified = path.join(fixture,i===2 ? "lazy.js" : "dep.js");
    if (i) await writeFile(modified, i===2 ? "export default 2;" : "module.exports = 1;");
    compiler.inputFileSystem.purge();
    const stats = await new Promise((resolve,reject)=>compiler.run((e,s)=>e ? reject(e) : resolve(s)));
    if (stats.hasErrors()) throw new Error(stats.toString());
    if (!i) { entry = createRequire(import.meta.url)(path.join(output, "bundle.cjs")); await cp(path.join(output,"bundle.cjs"),path.join(saved,"bundle.cjs")); }
  }
  await cp(output, saved, {recursive:true, force:false,errorOnExist:false});
  try { console.log("apply:",await entry.update()); } catch(e) { console.log("apply:",e.message); }
  try { console.log("lazy:",await entry.getLazy()); } catch(e) { console.log("lazy:",e.message); }
  console.log("status:",entry.status());
} finally {
  await new Promise(resolve=>compiler.close(resolve));
  await rm(workspace,{recursive:true,force:true});
}
