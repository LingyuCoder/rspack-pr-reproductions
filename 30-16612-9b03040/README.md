# A synchronous require loses its place when the entry imports the same external again

The entry imports a local CommonJS helper, re-exports `z` from an external, then
imports an external `x.cjs` for its side effects. The helper immediately calls
`require('./x.cjs')`. Node therefore evaluates `x` before `z`, which checks
that `x` has initialized. The final import of `x` does not execute it again.

| Consumer | Outcome |
| --- | --- |
| Source in Node | Initializes x, then z; the consumer reads z = 1 |
| Merge-base bundle | Same as Node |
| #16612 bundle | z runs first and throws `x has not initialized` |

In the base bundle the namespace import of `x.cjs` precedes the re-export of
`z.mjs`. The reviewed version reverses them. Its request walk skips the
helper's CommonJS edge and gives `x.cjs` the position of its *second*
request. Both externals have a position in the ordering, so the renderer
reorders them. This uses a single entry with no split chunks, no Rslib plugin,
and an ordinary CommonJS external; the example does not require Node to load
ESM via `require()`.

## Reproduce

Reviewed [PR #16612](https://github.com/web-infra-dev/rspack/pull/16612)
at [`9b03040`](https://github.com/web-infra-dev/rspack/commit/9b03040596345edd4b660a1efc89f9bf9ac4afe8)
against its merge base [`7b51466`](https://github.com/web-infra-dev/rspack/commit/7b514667945cd8e5ab5b0267f35fa00561402205).
The verifier builds the fixture with both the default and the Rspack runtime.
Each observation imports the source or bundle in a fresh Node process and
checks its result, exit status, and the order of the two emitted requests.

Point these variables to the JavaScript wrappers and native bindings for the
two revisions. The recorded run used Node 24.22.0 on macOS arm64.

```sh
export BASE_CORE=/path/to/base/packages/rspack/dist/index.js
export BASE_BINDING=/path/to/base/crates/node_binding/rspack.darwin-arm64.node
export HEAD_CORE=/path/to/head/packages/rspack/dist/index.js
export HEAD_BINDING=/path/to/head/crates/node_binding/rspack.darwin-arm64.node
node 30-16612-9b03040/verify.mjs
```

[Fixture](./fixtures/index.mjs) · [Captured comparison](./results/comparison.json) · [Emitted bundles](./results/bundles/) · [Build provenance](./provenance.json)
