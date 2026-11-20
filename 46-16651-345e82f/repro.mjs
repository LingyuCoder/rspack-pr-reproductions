import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rspack } from "@rspack/core";

const here = import.meta.dirname;
const revision = process.argv[2];
const record = process.argv.includes("--record");
const temporary = mkdtempSync(join(tmpdir(), "rspack-16651-"));
const variants = [];
try {
  for (const runtimeMode of ["webpack", "rspack"]) {
    for (const minimize of [false, true]) {
      const name = `${runtimeMode}-${minimize ? "min" : "plain"}`;
      const output = join(temporary, name);
      const compiler = rspack({
        context: join(here, "src"),
        entry: "./index.mjs",
        target: "node",
        mode: "production",
        devtool: false,
        experiments: { runtimeMode },
        externals: {
          "./setup.mjs": "module ./setup.mjs",
          "./consumer.mjs": "module ./consumer.mjs",
        },
        output: {
          path: output,
          filename: "index.mjs",
          module: true,
          library: { type: "modern-module" },
          chunkFormat: "module",
          bundlerInfo: { force: false },
        },
        optimization: { minimize, runtimeChunk: false },
      });
      let stats;
      try {
        stats = await new Promise((ok, fail) => compiler.run((error, result) => error ? fail(error) : ok(result)));
      } finally {
        await new Promise((ok, fail) => compiler.close(error => error ? fail(error) : ok()));
      }
      assert.equal(stats.hasErrors(), false, stats.toString());
      const files = readdirSync(output).sort();
      assert.deepEqual(files, ["index.mjs"], "This case must contain only one output chunk");
      for (const file of ["setup.mjs", "consumer.mjs"]) {
        copyFileSync(join(here, "src", file), join(output, file));
      }
      const bundle = readFileSync(join(output, "index.mjs"), "utf8");
      const execution = spawnSync(process.execPath, ["--input-type=module", "-e", `
        try {
          const module = await import(${JSON.stringify(pathToFileURL(join(output, "index.mjs")).href)});
          console.log(JSON.stringify({ order: globalThis.order, ready: module.ready }));
        } catch (error) {
          console.log(JSON.stringify({ order: globalThis.order, error: error.message }));
          process.exitCode = 1;
        }
      `], { encoding: "utf8", timeout: 10000 });
      if (execution.error) throw execution.error;
      assert.equal(execution.stderr, "");
      const imports = [...bundle.matchAll(/import\s*["']\.\/(setup|consumer)\.mjs["']/g)].map(match => match[1]);
      variants.push({ name, files, imports, status: execution.status, result: JSON.parse(execution.stdout) });
      if (record) {
        mkdirSync(join(here, "bundles"), { recursive: true });
        copyFileSync(join(output, "index.mjs"), join(here, "bundles", `${revision}-${name}.mjs`));
      }
    }
  }
  const nativePath = process.env.NAPI_RS_NATIVE_LIBRARY_PATH;
  assert.ok(Object.keys(createRequire(import.meta.url).cache).includes(nativePath), "The requested native binding must be loaded");
  console.log(JSON.stringify(variants));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
