# PR #16545: non-evaluating dependencies bypass the chunk-order guard

Reviewed head: `05d51be7b4b6f3732687e4602257796ade2e614a`.
Exact merge base: `cde8fcc8fb83fafb4bbe42ba6d0967beb15ec98d`.

The new DFS in `crates/rspack_plugin_esm_library/src/link.rs:2889` treats every
active dependency as part of eager evaluation order. Activity alone does not
mean a dependency evaluates its target: a function-scoped `require()`, a
`require.resolve()`, and a not-yet-called eager dynamic import all remain
active graph dependencies without executing their targets at that point.

For example, the entry imports a CommonJS helper, imports setup, re-exports an
external value, and imports another external:

```js
import './helper.cjs';
import './setup.mjs';
export { value } from './ext.mjs';
import './side.mjs';
```

The helper only defines `exports.load = () => require('./ext.mjs')`. That
function is never called. `setup.mjs` initializes a global needed by the
external; `splitChunks` extracts setup into a separate chunk. The DFS visits
the lazy require before setup and deduplicates the later, eager reference to
the same external request. It consequently keeps a raw external import ahead
of setup. Loading the resulting library throws `setup must run first`.

The native source and merge-base bundle both load successfully and export 42.
This is a remaining runtime regression in the original PR implementation; the
latest test-only commits did not introduce it.

## Variants included

All three inputs are minimal variants of the same missing evaluation-order
distinction, not separate findings:

| Fixture | Earlier dependency that does not evaluate the external |
| --- | --- |
| `lazy-require` | `exports.load = () => require('./ext.mjs')` |
| `require-resolve` | `exports.id = require.resolve('./ext.mjs')` |
| `eager-dynamic` | An uncalled function doing `import(/* webpackMode: 'eager' */ './bridge.mjs')`; the bridge imports the external |

The verifier checks both runtime modes (`default` and `rspack`) with minification
on and off: 12 base/head comparisons, plus three native-source controls. Every
base/native control succeeds; every PR bundle fails during initial loading.
A separate ordinary dynamic-import control was also checked during review and
does not have this regression.

## Reproduce live

Build isolated Rspack checkouts at the two exact revisions above with the
repository's development toolchain and commands:

```sh
pnpm install
pnpm run build:cli:dev
```

Run from this reproduction repository, pointing to the matching JavaScript
wrappers and platform-native bindings:

```sh
BASE_CORE=/path/to/base/packages/rspack/dist/index.js \
BASE_BINDING=/path/to/base/crates/node_binding/rspack.darwin-arm64.node \
HEAD_CORE=/path/to/head/packages/rspack/dist/index.js \
HEAD_BINDING=/path/to/head/crates/node_binding/rspack.darwin-arm64.node \
node 27-16545-05d51be/verify.mjs
```

Use the appropriate binding filename on other platforms. This does not need
additional npm dependencies in the case directory. The verifier builds every
bundle again and executes it in a fresh Node process; saved results are not
replayed as evidence. The readable default-runtime bundles are retained under
`dist/`; additional matrix outputs are generated under ignored `.work/`.

Observed with Node.js v22.16.0, Rspack 2.3.2, macOS arm64, and the project's
`nightly-2026-04-16` Rust toolchain. `provenance.json` records source SHAs and
artifact hashes. The head native artifact was built at `3c7a8bd`: all Rust,
binding and Cargo sources are identical at the reviewed `05d51be` head; only
the test tools and tests changed. JavaScript packages were rebuilt at
`05d51be` before the latest verification.
