# Adding an independent entry changes whether the second entry can load

Two ESM entries share `a.mjs` and `c.mjs`, extracted together into a `twin` chunk.
The external `z.mjs` initializes state that `c.mjs` needs. Both entries import
`z` before `c`: the first imports `z, a, c`, and the second imports `a, z, c`.
Both can be loaded independently as native ESM. No dynamic import, re-export,
custom plugin, or watch build is involved.

| Fresh process loading one entry | Native ESM | Merge base | PR head |
| --- | --- | --- | --- |
| Load the first entry | z, c | z, c | z, c |
| Load the second; `first` declared before `second` | z, c | z, c | throws: `setup must precede c` |
| Load the second; `second` declared before `first` | z, c | z, c | z, c |

The failing second entry imports `twin.mjs` before `z.mjs`, so `c` runs before
its initializer. Swapping the declaration order of two independent entries changes
the generated second entry, even though the consumer only loads that entry.
The merge base imports `z.mjs` ahead of the twin in both configurations. The
verifier independently builds and executes both entry orders in the default and
Rspack runtime modes.

## Reproduce

[PR #16612](https://github.com/web-infra-dev/rspack/pull/16612), head
[`9b03040`](https://github.com/web-infra-dev/rspack/commit/9b03040596345edd4b660a1efc89f9bf9ac4afe8),
merge base [`7b51466`](https://github.com/web-infra-dev/rspack/commit/7b514667945cd8e5ab5b0267f35fa00561402205).
Tested with Node 24.22.0 on macOS arm64, using the exact merge-base CI artifact
and a native binding built from the reviewed head. The JavaScript wrapper
sources are identical between these revisions.

Set absolute paths to matching core builds and native bindings for your platform:

```sh
export BASE_CORE=/path/to/base/packages/rspack/dist/index.js
export BASE_BINDING=/path/to/base/crates/node_binding/rspack.darwin-arm64.node
export HEAD_CORE=/path/to/head/packages/rspack/dist/index.js
export HEAD_BINDING=/path/to/head/crates/node_binding/rspack.darwin-arm64.node
node 31-16612-9b03040/verify.mjs
```

[Captured comparison](./results/comparison.json) · [Emitted bundles](./results/bundles/)
