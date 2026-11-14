# A shared async chunk breaks one of its two loaders

Two functions return dynamic imports with the same `webpackChunkName`. One
lives in a CommonJS helper, the other in the ESM entry. The helper's
`loadA()` enables strict initialization and loads a module that imports
`setup.mjs` before using external `x.mjs`. The ESM entry's `loadB()`
needs no setup and may initialize `x.mjs` first. Each observation starts a
fresh Node process and calls only one loader.

| First call | Native source | Merge base | PR head |
| --- | --- | --- | --- |
| `loadA()`, same chunk name | resolves, value 1 | resolves, value 1 | rejects: `setup must run before x` |
| `loadB()`, same chunk name | resolves, value 2 | resolves, value 2 | resolves, value 2 |
| Either call, distinct chunk names | resolves | resolves | resolves |

The merge base emits a request for `setup.mjs` before `x.mjs` in the shared
chunk. The PR moves `x.mjs` ahead of `setup.mjs` for **both** callers. Its
unique-target check uses the set collected from scope-hoisted importers, so
it sees the ESM caller but misses the CommonJS caller. The two source
modules disagree on the order; a single shared native chunk cannot satisfy
both orders. Both public calls nevertheless worked on the base, and only
one now rejects. The control changes just the ESM caller's chunk name.

## Reproduce

Tested on macOS arm64, Node 24.22.0, at [PR #16612](https://github.com/web-infra-dev/rspack/pull/16612)
commit [9b03040](https://github.com/web-infra-dev/rspack/commit/9b03040596345edd4b660a1efc89f9bf9ac4afe8)
against [7b51466](https://github.com/web-infra-dev/rspack/commit/7b514667945cd8e5ab5b0267f35fa00561402205).
The comparison uses the merge base's [CI native binding](https://github.com/web-infra-dev/rspack/actions/runs/43580704397/artifacts/14107928294)
and a local native build of the PR. The JavaScript wrapper source is identical.
Supply the absolute paths to your own built wrappers and bindings:

```sh
export BASE_CORE=/path/to/base/packages/rspack/dist/index.js
export BASE_BINDING=/path/to/base/crates/node_binding/rspack.darwin-arm64.node
export HEAD_CORE=/path/to/head/packages/rspack/dist/index.js
export HEAD_BINDING=/path/to/head/crates/node_binding/rspack.darwin-arm64.node
node 32-16612-9b03040/verify.mjs
```

[Captured return values, errors, evaluation traces and emitted imports](./results/comparison.json).
