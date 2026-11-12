# A failed build removes the executor while another loader is still active

Two modules build in parallel. The `succeedModule` tap for `a.js` throws, while `b.js` has an active async loader started with `this.async()`. Its later `this.importModule()` call occurs before that loader calls its completion callback.

The new failure path in `BuildModuleGraphPhasePass::run_pass` takes `compilation.module_executor`, aborts it, and leaves `None`. The graph task loop returns on the first fatal error without waiting for all background loaders, so the remaining import reaches the binding's `expect("should have module executor")` and aborts the process. The run callback has already delivered the ordinary plugin error by then.

This work is still inside the asynchronous loader's supported execution window. The reproduction does not retain a module or compilation after a completed hook.

| Variant | Observed result |
| --- | --- |
| Merge-base | Reports the hook error, finishes the pending import, exits 0 |
| PR head | Reports the hook error, then SIGABRT (`should have module executor`) |
| Head with no hook failure | Exits 0 |
| Head with import completed before the hook failure | Exits 0 |

Anchor: `crates/rspack_core/src/compilation/build_module_graph/pass.rs:53`.

## Live verification

Use Node.js 24 and build the JavaScript wrapper and native binding for each revision. Set these absolute paths:

```sh
export BASE_CORE=/path/to/base/packages/rspack/dist/index.js
export BASE_BINDING=/path/to/base/rspack.darwin-arm64.node
export HEAD_CORE=/path/to/head/packages/rspack/dist/index.js
export HEAD_BINDING=/path/to/head/rspack.darwin-arm64.node
```

The verified revisions are PR head `30ca66e8cccd15b7c145f0da6994ace75010448b` and merge-base `66478d2824205bc8c90768dd68feb7f85fb03c2c`. `provenance.json` records the exact native sources and hashes. The head native source is unchanged by the final benchmark/snapshot-only commit. The base uses the matching macOS arm64 CI artifact and a wrapper built from the base source.

`verify.mjs` runs the live cases in separate processes; it does not replay the captured output. `comparison.json` contains the verification recorded during review. Set `RECORD=1` to update that capture after a live run.

No npm dependencies are needed in this case directory when the supplied Rspack packages are built.

```sh
node verify.mjs
```

To run a single revision:

```sh
RSPACK_CORE="$HEAD_CORE" NAPI_RS_NATIVE_LIBRARY_PATH="$HEAD_BINDING" node repro.cjs
```

The expected invariant is that an ordinary hook failure must not become a later process abort. Retaining a closed executor alone should also be considered together with cancellation or isolation of remaining work, so old loader requests cannot enter a subsequent compilation.
