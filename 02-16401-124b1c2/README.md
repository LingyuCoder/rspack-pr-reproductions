# PR #16401: JSON prototype bailout and export mangling

Confirmed with Node.js v22.16.0 on macOS arm64. A named CommonJS reexport
exposes a JSON object; the consumer reads one property and calls
`hasOwnProperty` on the same object.

| Build | `mangleExports` | Property read | `hasOwnProperty` |
| --- | --- | --- | --- |
| Native Node.js input | N/A | `42` | `true` |
| Base `f8b4091` | `true` | `42` | `false` |
| Base `f8b4091` | `false` | `42` | `true` |
| PR `124b1c2` | `true` | **`undefined`** | `true` |
| PR `124b1c2` | `false` | `42` | `true` |
| webpack 5.112.2 | `true` | `42` | `true` |
| webpack 5.112.2 | `false` | `42` | `true` |

The base's mangled build already gives the wrong `hasOwnProperty` result.
The PR fixes that result but introduces a regression in the ordinary property
read. All builds complete without errors and all bundles exit with code 0.

## Run the saved reproduction

The actual generated bundles are included in `dist/`. No dependency installation
is needed to verify their runtime behavior:

```sh
node verify.mjs
```

To observe the regression directly:

```sh
node dist/pr-mangle/main.cjs
# value=undefined
# owns=true
```

The unbundled input and webpack's output both print `value=42` and `owns=true`:

```sh
node entry.cjs
node dist/webpack-mangle/main.cjs
```

## Minimal input

```js
// data.json
{"longProperty":42}

// bridge.cjs
exports.data = require("./data.json");

// entry.cjs
console.log("value=" + require("./bridge.cjs").data.longProperty);
console.log("owns=" + require("./bridge.cjs").data.hasOwnProperty("longProperty"));
```

The configuration uses `mode: "production"` and `mangleExports: true`.
`minimize: false` keeps the emitted code readable. This is a named reexport,
unlike the whole `module.exports = require(...)` reexports in the PR's tests.

## Emitted mismatch

In `dist/pr-mangle/main.cjs`, the JSON generator retains the original key:

```js
module.exports = {"longProperty":42}
```

The named reexport is `exports.p`, while the consumer uses the mangled property
name `s`:

```js
console.log("value=" + (__webpack_require__(298)/* .data.longProperty */.p.s));
```

The JSON generator's new early return preserves the original data without
applying the export names already chosen for the consumer.

## Build provenance

- PR source: `124b1c221352ac221d8233d69e6c6685056b5185`.
- Base source: `f8b4091e996943438b1e667d407d862bc08c2f8b`.
- Native bindings were built by the repository's CI:
  - PR run [41497375158](https://github.com/web-infra-dev/rspack/actions/runs/41497375158),
    artifact `13200149035` (`bindings-aarch64-apple-darwin`). The tested merge
    commit `4d0e9f15cd8d3b27711585121f071fb5dc137f04` has the same tree as the PR head.
  - Base run [41446212302](https://github.com/web-infra-dev/rspack/actions/runs/41446212302),
    artifact `13143092610` (`bindings-aarch64-apple-darwin`).
- JavaScript packages were built locally with `pnpm run build:js` at both exact
  revisions. Each comparison uses its corresponding native binding.
- webpack 5.112.2 was installed from npm and built the identical input with the
  same configuration.
- `results/pr.json`, `results/base.json`, and `results/webpack.json` record
  compiler versions, source SHAs, configuration variants and runtime output.
- `results/verification.json` records assertions against the saved bundles and
  the unbundled input. Original emitted bundles are not modified.

## Regenerate the bundles

For each Rspack revision above, install dependencies in a separate Rspack
checkout, prepare its JavaScript dependencies, and run `pnpm run build:js`.
Use the corresponding CI binding above, or build it locally with
`pnpm run build:binding:dev` as described in Rspack's development guide.

At the PR revision, with the PR binding:

```sh
RSPACK_SOURCE=/absolute/path/to/rspack \
RSPACK_BINDING=/absolute/path/to/pr/rspack.darwin-arm64.node \
node build.mjs pr
```

At the base revision, with the base binding:

```sh
RSPACK_SOURCE=/absolute/path/to/rspack \
RSPACK_BINDING=/absolute/path/to/base/rspack.darwin-arm64.node \
node build.mjs base
```

Use the equivalent binding filename for your platform. The script checks the
source SHA before building.

For the webpack comparison, install webpack 5.112.2 outside this case and point
`WEBPACK_SOURCE` to its package directory:

```sh
npm install --prefix /absolute/path/to/tools webpack@5.112.2
WEBPACK_SOURCE=/absolute/path/to/tools/node_modules/webpack node build.mjs webpack
node verify.mjs
```
