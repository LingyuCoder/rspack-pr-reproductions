const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { rspack } = require(process.env.RSPACK_CORE || "@rspack/core");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "minified-devtool-retention-"));
process.env.RSPACK_MINIFIER_PROBE_DIR = dir;
fs.writeFileSync(
  path.join(dir, "entry.js"),
  "/*" + "dead comment payload ".repeat(400000) + "*/\nconsole.log('keep');\n",
);

let observed;
const compiler = rspack({
  mode: "production",
  devtool: "source-map",
  cache: false,
  context: dir,
  entry: "./entry.js",
  output: { path: path.join(dir, "out"), filename: "main.js" },
  plugins: [
    {
      apply(c) {
        c.hooks.afterEmit.tapPromise("Inspect", async () => {
          const map = JSON.parse(fs.readFileSync(path.join(dir, "out/main.js.map"), "utf8"));
          const code = fs.readFileSync(path.join(dir, "out/main.js"), "utf8");
          if (!code.includes("keep") || code.includes("dead comment payload") ||
              !map.sourcesContent.some(s => s?.includes("dead comment payload"))) {
            throw Error("unexpected fixture output");
          }

          fs.writeFileSync(path.join(dir, "after-emit"), "");
          const result = path.join(dir, "measured");
          let measurement;
          for (let i = 0; i < 3000; i++) {
            if (fs.existsSync(result)) {
              measurement = fs.readFileSync(result, "utf8").trim();
              if (/^(true|false) \d+ \d+ (true|false)$/.test(measurement)) break;
            }
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          if (!measurement) throw Error("missing native measurement: was the probe applied?");
          const [alive, inputBytes, minifiedBytes, onlyOwner] = measurement.split(" ");
          observed = {
            alive: alive === "true",
            inputBytes: Number(inputBytes),
            minifiedBytes: Number(minifiedBytes),
            probeIsOnlyInputOwner: onlyOwner === "true",
          };
          console.log(JSON.stringify(observed));
        });
      },
    },
  ],
});

compiler.run((error, stats) => compiler.close(closeError => {
  try {
    if (error || closeError) throw error || closeError;
    if (stats.hasErrors()) throw Error(stats.toString({ errors: true }));
    if (!observed) throw Error("missing measurement");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}));
