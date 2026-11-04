# PR #16418: a provided JSON property can become a method that needs its receiver

Confirmed with Node.js v22.16.0 on macOS arm64. Replacing an existing JSON
property with a function that reads a sibling property through `this` causes
the sibling's data to be removed by the PR's reference analysis.

| Build | `mangleExports` | Output | Emitted JSON |
| --- | --- | --- | --- |
| Native Node.js input | N/A | `value=42` | N/A |
| Base `8b100de` | `true` / `false` | `value=42` | `{"run":null,"kept":42}` |
| PR `bce5b8b` | `true` | **`value=undefined`** | `{"e":null}` |
| PR `bce5b8b` | `false` | **`value=undefined`** | `{"run":null}` |
| webpack 5.112.2 | `true` / `false` | `value=42` | `{"run":null,"kept":42}` |

All six builds complete without errors or warnings. All bundles exit with
code 0, so the regression silently changes the result. Disabling export
mangling does not avoid it.

## Run the saved reproduction

Actual, unmodified generated bundles are included in `dist/`. No dependency
installation is needed to verify the input, all six bundles, the removed JSON
field, and the saved build results:

```sh
node verify.mjs
```

Observe the failure and the base comparison directly:

```sh
node dist/pr-no-mangle/main.cjs
# value=undefined
node dist/base-no-mangle/main.cjs
# value=42
```

## Minimal input

```js
// data.json
{"run":null,"kept":42}

// entry.mjs
import data from "./data.json" with { type: "json" };

data.run = function () {
  return this.kept;
};

console.log("value=" + data.run());
```

`rspack.config.mjs` uses production mode. `minimize: false` and
`concatenateModules: false` keep the output easy to inspect. Each comparison
builds the same input with `mangleExports: true` and `false`.

## Why the receiver is required

The JSON's `run` export is statically `Provided`. The new
[`should_reference_call_receiver`](https://github.com/web-infra-dev/rspack/blob/bce5b8b4325389d68b4214715804f212ed79c5e1/crates/rspack_core/src/dependency/mod.rs#L324-L334)
therefore returns false for the call. Both the assignment and the call reference
only `run`; the function's `this.kept` access is not a static reference to the
imported JSON's `kept` export.

The PR's non-mangled bundle consequently contains:

```js
module.exports = {"run":null}
```

The assigned method still executes `return this.kept`, which now returns
`undefined`. The base's direct-JSON call special case retains the receiver,
including `kept:42`. A property being present in the original JSON does not
establish that a later method call is independent of its receiver.

## Build provenance

- PR JavaScript source: `bce5b8b4325389d68b4214715804f212ed79c5e1`.
- Base JavaScript source: `8b100de82f2f487bc97a7c934b856672e5eef7d0`.
- The required JavaScript artifacts were built locally at both exact revisions:
  dependencies were installed with `pnpm install --frozen-lockfile --ignore-scripts
  --offline --filter @rspack/core...`, then `@rspack/lite-tapable` was built,
  and `@rspack/core`'s `prepare` and `build` scripts were run.
- Native bindings came from the repository's CI:
  - PR run [41785771050](https://github.com/web-infra-dev/rspack/actions/runs/41785771050),
    artifact `13301352699` (`bindings-aarch64-apple-darwin`). Its checkout is
    merge commit `6755f66219cbd0a6c52afa879e258cac7e8fb1d7`, whose complete Git
    tree equals the PR head's tree: `9105210e81a0d2e673aec22605ee59f4b339a379`.
  - Base run [41777696018](https://github.com/web-infra-dev/rspack/actions/runs/41777696018),
    artifact `13297263645` (`bindings-aarch64-apple-darwin`), at
    `69956a35e77a98a1b522ae44f36496a6645da74f`. There is no CI binding at the exact
    base SHA. The only changes between this binding's source and `8b100de` are
    `website/docs/en/config/entry.mdx` and `website/docs/zh/config/entry.mdx`;
    all build code, dependencies, and configuration are identical.
- webpack 5.112.2 was installed from npm and built the same input and configuration.
- `results/{pr,base,webpack}.json` record the compiler version, source SHA,
  binding source SHA and SHA-256, configuration, emitted JSON, and runtime output.
- `results/verification.json` records assertions against the actual saved bundles.

## Regenerate the bundles

Use separate Rspack checkouts at the two source revisions above. Build the
required JavaScript artifacts before running `build.mjs`. Use the corresponding
CI binding described above, or build a native binding at that source revision
with `pnpm run build:binding:dev`.

```sh
RSPACK_SOURCE=/absolute/path/to/pr-checkout \
RSPACK_BINDING=/absolute/path/to/pr/rspack.darwin-arm64.node \
RSPACK_BINDING_SOURCE_SHA=6755f66219cbd0a6c52afa879e258cac7e8fb1d7 \
node build.mjs pr

RSPACK_SOURCE=/absolute/path/to/base-checkout \
RSPACK_BINDING=/absolute/path/to/base/rspack.darwin-arm64.node \
RSPACK_BINDING_SOURCE_SHA=69956a35e77a98a1b522ae44f36496a6645da74f \
node build.mjs base

WEBPACK_SOURCE=/absolute/path/to/tools/node_modules/webpack node build.mjs webpack
node verify.mjs
```

The script checks the Rspack source revisions and the webpack version. Use the
equivalent binding filename for your platform. When using a locally built binding,
omit `RSPACK_BINDING_SOURCE_SHA` so the source checkout's SHA is recorded instead.
