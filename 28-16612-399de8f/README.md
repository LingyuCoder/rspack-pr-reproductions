# A shared chunk can change request order without invalidating its hash

Only the entry is edited; the two modules in the shared chunk are unchanged.
The original entry re-exports `child`. The edited entry first imports `inner`
and then re-exports `child`. External A initializes a flag. B captures that
flag in its export `b`. Native ESM captures `false` before the edit and
`true` afterwards. The watch verifier checks the new public `edited` export
before it accepts a callback, then loads that build in a fresh process.

| Edited input | Order | b |
| --- | --- | --- |
| Native source | A, B | true |
| Merge base, fresh build or real watch rebuild | A, B | true |
| PR head, fresh build | A, B | true |
| PR head, real watch rebuild | B, A | **false** |

Both of these configurations reproduce:

- Production defaults with `[chunkhash]` filenames: the head's two separate
  cold builds emit **different declarations under the same shared filename**.
  Only the parent entry changed.
- Production with `cache: true, incremental: true` and `[contenthash]`
  filenames: the head watch rebuild likewise retains the old rendered order.

The merge base already evaluated A before B on the *initial* input. The
regression here is the *edited* input: the merge-base watch result matches
native ESM, but the PR head returns a different public value from a clean
build of that same source. The ordinary production `[contenthash]` case
without the explicit incremental options was not observed to fail.

The effective order or fallback for a shared chunk now depends on its incoming
edges, which can change outside that chunk. Its render cache and chunk hash
need to distinguish the resulting declaration orders.

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
node 28-16612-399de8f/verify.mjs
```

[Captured comparison](./results/comparison.json) · [Emitted bundles](./results/bundles/)
