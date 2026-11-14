# Splitting a named re-export runs an external before its initializer

The entry re-exports `x` from an external, then re-exports `z` through local
`d.mjs`. The latter re-exports external `z` before importing external `x`.
Only `d.mjs` is extracted into a named chunk. Both re-exports are named; no
Rslib plugin, async loading, circular source graph or incremental build is
needed. The guard in `z.mjs` checks that `x` has initialized.

| Consumer | Result |
| --- | --- |
| Native source | x, z; both exports available |
| Merge-base bundle | x, z; both exports available |
| #16545 comparison build | x, z; both exports available |
| #16612 bundle | z runs first; `Error: x is not initialized` |

The parent first requests the split chunk in both bundles. In that split
chunk the base emits a request for `x` before `z`; the reviewed revision
moves the re-export of `z` ahead of the request for `x`. The same external
request also appears in the parent, and ESM evaluates it only once. Ordering
the child in isolation changes that first evaluation for the entire entry.

The verifier checks the default and Rspack runtime modes. To also run the
optional #16545 control, set `ORIGINAL_CORE` and `ORIGINAL_BINDING` to the
matching build at `05d51be7b4b6f3732687e4602257796ade2e614a`.

## Reproduce

Reviewed [PR #16612](https://github.com/web-infra-dev/rspack/pull/16612) at
[`399de8f`](https://github.com/web-infra-dev/rspack/commit/399de8fdef30d8223288a6fa22d8db0a0c2bab1a); merge base
[`685744e`](https://github.com/web-infra-dev/rspack/commit/685744e6130c46618a919e4498b2c649c328f297).
Tested on macOS arm64, Node 24.22.0, using wrappers and native bindings built
from both exact checkouts. The consumer runs in a fresh Node process on each
observation, so its module cache and globals do not carry across builds.

Point the following variables to **absolute paths** in the respective built
checkouts (adjust the platform suffix outside macOS arm64):

```sh
export BASE_CORE=/path/to/base/packages/rspack/dist/index.js
export BASE_BINDING=/path/to/base/crates/node_binding/rspack.darwin-arm64.node
export HEAD_CORE=/path/to/head/packages/rspack/dist/index.js
export HEAD_BINDING=/path/to/head/crates/node_binding/rspack.darwin-arm64.node
node 29-16612-399de8f/verify.mjs
```

[Captured comparison](./results/comparison.json) · [Emitted bundles](./results/bundles/)
