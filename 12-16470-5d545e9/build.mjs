import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { rspack } = await import(process.env.RSPACK_CORE ? pathToFileURL(resolve(process.env.RSPACK_CORE)).href : "@rspack/core");
const algorithms = process.argv.slice(2);
const payload = readFileSync(process.env.TYPESCRIPT_JS);
assert.equal(createHash("sha256").update(payload).digest("hex"), "569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39");
const context = mkdtempSync(join(tmpdir(), "rspack-sri-case-"));
writeFileSync(join(context, "index.js"), 'module.exports = require("./payload.ts-text");\n');
writeFileSync(join(context, "payload.ts-text"), payload);
const path = join(context, "out");
mkdirSync(path);
try {
  for (let i = 0; i < 7; i++) {
    let start, end, seen;
    const t0 = process.hrtime.bigint();
    const compiler = rspack({
      context, mode: "production", target: "web", entry: "./index.js", devtool: false,
      module: { rules: [{ test: /\.ts-text$/, type: "asset/source" }] },
      optimization: { minimize: false, realContentHash: false },
      output: { path, crossOriginLoading: "anonymous" },
      plugins: [
        new rspack.SubresourceIntegrityPlugin({ hashFuncNames: algorithms }),
        { apply(c) {
          c.hooks.thisCompilation.tap("measure", compilation => {
            compilation.hooks.processAssets.tap({ name: "before-sri", stage: 698 }, () => { start = process.hrtime.bigint(); });
            compilation.hooks.processAssets.tap({ name: "after-sri", stage: 700 }, () => {
              end = process.hrtime.bigint();
              seen = [].concat(compilation.getAsset("main.js").info.contenthash);
            });
          });
        } },
      ],
    });
    await new Promise((ok, bad) => compiler.run((err, stats) => compiler.close(closeErr => {
      if (err || closeErr || stats.hasErrors()) bad(err || closeErr || new Error(stats.toString()));
      else ok();
    })));
    const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const output = readFileSync(join(path, "main.js"));
    assert.ok(seen.includes(algorithms.map(a => a + "-" + createHash(a).update(output).digest("base64")).join(" ")));
    console.log(JSON.stringify({ warmup: i === 0, sriMs: Number(end - start) / 1e6, totalMs, emittedBytes: output.length }));
  }
} finally { rmSync(context, { recursive: true, force: true }); }
