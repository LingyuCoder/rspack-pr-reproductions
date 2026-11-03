# PR #16401: JSON retention leaks across independent runtimes

Confirmed with Node.js v22.16.0 on macOS arm64, using Rspack's CI-built WASI
bindings and webpack 5.112.2. Two entries share a CommonJS JSON reexport:
entry A calls `.map()`, while entry B reads only index `0`.

| Compiler | Entries built together | JSON emitted in B | B bundle bytes |
| --- | --- | --- | ---: |
| Base `f8b4091` | A + B | `[11]` | 973 |
| Base `f8b4091` | B only | `[11]` | 973 |
| PR `c5f554c` | A + B | **`[11,22,33,44,55]`** | **985** |
| PR `c5f554c` | B only | `[11]` | 973 |
| webpack 5.112.2 | A + B | `[11]` | 1382 |
| webpack 5.112.2 | B only | `[11]` | 1382 |

B always prints the correct `first=11`; the regression is unnecessary data
retention in its bundle. In the PR build, adding the unrelated A entry causes B
to retain every array element. The 12-byte difference is the extra literal data
in this small fixture, not a build-time benchmark. Absolute bundle sizes across
different compilers should not be compared as a measure of this regression.

The base's A bundle emits `[0]` and prints `mapped=0`, reproducing the original
issue #16398. PR and webpack A bundles retain the full array and print
`mapped=22,44,66,88,110`. The controls above isolate the additional B regression
from the original correctness fix.

## Run the saved reproduction

Actual, unmodified generated bundles are included under `dist/`. No dependency
installation, binding download, or WASI support is needed to verify them:

```sh
node verify.mjs
```

The script checks all nine bundles' runtime output and emitted JSON arrays,
confirms B grows by 12 bytes in the PR, and confirms base/webpack B bundles are
byte-for-byte identical whether A is present or absent.

## Input and configuration

```js
// array.json
[11,22,33,44,55]

// bridge.cjs
module.exports = require("./array.json");

// a.cjs
console.log("mapped=" + require("./bridge.cjs").map(x => x * 2).join(","));

// b.cjs
console.log("first=" + require("./bridge.cjs")[0]);
```

`rspack.config.mjs` uses production mode with `usedExports: true`, independent
entry runtimes (`runtimeChunk: false`), and `splitChunks: false`. Concatenation,
minification, and mangling are disabled to isolate JSON retention. `JSONParse`
is disabled so the emitted array is easy to inspect. The B-only control changes
only the entry list, keeping B's input and every other option identical.

## Cause

In `preserve_json_exports`, `has_used_non_provided_export(data, info, None)` sees
A's use of `map` across all runtimes. `set_used_in_unknown_way(None)` then marks
the whole JSON value globally, including B's independent runtime. Its JSON
generator consequently keeps every element even though B uses only index `0`.

## Build provenance

- Reviewed PR head: `c5f554cfa0615ef72d9c53be506c8f184c61d7bf`.
- PR WASI binding source: `7c621a41e2708a0b8b80aebc32ccdba88a3de806`, from
  [CI run 41609574165](https://github.com/web-infra-dev/rspack/actions/runs/41609574165),
  artifact `13219773279` (`bindings-wasm32-wasip1-threads`).
- The only difference from that binding's source to the reviewed head is
  `[package.metadata.cargo-shear] ignored = ["tracing"]` in the JSON crate's
  Cargo.toml. There are no Rust or JavaScript source changes between them.
  The two SHAs are recorded separately rather than claiming the binding was built
  at the reviewed head.
- Base source and WASI binding: `f8b4091e996943438b1e667d407d862bc08c2f8b`, from
  [CI run 41446212302](https://github.com/web-infra-dev/rspack/actions/runs/41446212302),
  artifact `13145991655` (`bindings-wasm32-wasip1-threads`).
- JavaScript packages were built locally with `pnpm run build:js` at each
  reviewed source revision before generating its bundles.
- webpack 5.112.2 was installed from npm and used the same configuration.
- `results/pr.json`, `results/base.json`, and `results/webpack.json` record
  source revisions, binding SHA-256 hashes, emitted arrays, bundle bytes, and
  runtime results. `results/verification.json` records the standalone checks.

## Regenerate the bundles

Use a separate Rspack checkout at the PR or base SHA above. Install dependencies,
prepare its JavaScript dependencies, and run `pnpm run build:js`. Build a matching
native binding with `pnpm run build:binding:dev`, or download the corresponding
CI-built binding. Then run, at each respective source revision:

```sh
RSPACK_SOURCE=/absolute/path/to/rspack \
RSPACK_BINDING=/absolute/path/to/pr/rspack.darwin-arm64.node \
node build.mjs pr

RSPACK_SOURCE=/absolute/path/to/rspack \
RSPACK_BINDING=/absolute/path/to/base/rspack.darwin-arm64.node \
node build.mjs base
```

Use the equivalent native binding filename for your platform. For the saved WASI
comparison, place the downloaded `rspack.wasm32-wasi.wasm` beside the checkout's
`crates/node_binding/rspack.wasi.cjs` and point `RSPACK_BINDING` to that `.cjs`
file. Set `RSPACK_BINDING_BINARY` to the `.wasm` path to record its hash, and
`RSPACK_BINDING_SOURCE_SHA` to the binding's source SHA listed above.

For webpack, install version 5.112.2 outside this case:

```sh
npm install --prefix /absolute/path/to/tools webpack@5.112.2
WEBPACK_SOURCE=/absolute/path/to/tools/node_modules/webpack node build.mjs webpack
node verify.mjs
```
