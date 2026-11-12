# An extracted earlier array entry is missing from the ordering guard

Configure an entry array with initialization before the library entry:

```js
entry: ['./setup.mjs', './entry.mjs']
```

`setup.mjs` initializes state required by an external. `entry.mjs` re-exports a
named constant from that external, then imports another external for side effects.
Extract `setup.mjs` with `splitChunks` while using the `modern-module` library type.
This models a bootstrap or polyfill placed before a library in an entry array.

The original source and exact merge base return 42. The reviewed head emits the
retained external import before the setup chunk, so loading the library throws
`Error: setup must run first`.

Base dependency declarations:

```js
import './side.mjs';
import './setup.mjs';
export { value } from './ext.mjs';
```

PR dependency declarations:

```js
import { value } from './ext.mjs';
import './side.mjs';
import './setup.mjs';
export { value };
```

The DFS at `crates/rspack_plugin_esm_library/src/link.rs:2971-2981` records chunks
encountered through module dependencies. It does not record a preceding root
entry's own chunk. An earlier array entry has no import edge from `entry.mjs`,
so `blocked_by_prior_chunk` misses setup and retains the external too early.
The scan also needs to include the ordered entry dependencies and their chunks.

This is another concrete variant of the prior-chunk problem, rather than a new
failure introduced by the latest follow-up commit alone. The existing regression
test has a direct `import './setup.mjs'` in the entry and does not cover an entry
array. Side's ordering difference already exists on base and is not the reported
regression; the new failure is that the external runs before its required setup.

## Verify

Run with Node.js 22.12 or newer, without installing dependencies:

```sh
node verify.mjs
```

The verifier runs native ESM with setup imported before the source entry and runs
the actual generated base and PR bundles in separate Node processes. It succeeds
when the regression is reproduced:

```text
source: 42
base: 42
pr: Error: setup must run first
```

`src/` contains the input; `build.mjs` contains the production configuration;
`dist/base/` and `dist/pr/` contain the actual generated entry/setup chunks and
external fixtures. `comparison.txt` records the live verification result.

## Build provenance and regeneration

- Reviewed head: [`3437f2f`](https://github.com/web-infra-dev/rspack/commit/3437f2ff751cd2b4cd7c6314b766745acfc11258).
- Exact merge base: [`cde8fcc`](https://github.com/web-infra-dev/rspack/commit/cde8fcc8fb83fafb4bbe42ba6d0967beb15ec98d).
- Both native bindings were built locally from clean source using
  `pnpm run build:binding:dev`, with Rust `nightly-2026-04-16`.
- Both runs used the same Rspack 2.3.2 JS wrapper built with `pnpm run build:js`
  at `227188f25f6f9af948d2a703fb93344c77dd077d`; its package and binding-wrapper
  sources are unchanged at both compared revisions.
- Verified on macOS arm64 with Node.js v22.16.0. See `provenance.json` for hashes.

To regenerate with the corresponding built wrapper and native bindings:

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/base/rspack.darwin-arm64.node node build.mjs base
NAPI_RS_NATIVE_LIBRARY_PATH=/path/to/pr/rspack.darwin-arm64.node node build.mjs pr
node verify.mjs
```

Use the equivalent native binding filename on other platforms. Executing the
saved generated bundles does not require a native binding or dependencies.
