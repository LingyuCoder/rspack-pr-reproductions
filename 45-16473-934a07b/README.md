# Replacing a shared fallback before stage 2501 breaks compilation

Use shared tree shaking with the default `1.0.0/share-entry.js` filename. The
fixture uses a downstream plugin that adds a banner after minification at
`PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1` (401). It replaces the asset by calling
`deleteAsset` and then `emitAsset` under the same name, with its original metadata.
The output file remains available under the same path. `deleteAsset` removes
the path from `chunk.files`, and `emitAsset` does not reattach it.

The merge base validates the shared chunk at stage 0 and builds successfully.
Its generated fallback can be loaded and returns `fallback-runtime-ok`. PR
[#16473](https://github.com/web-infra-dev/rspack/pull/16473) moves that validation
to stage 2501, where the file still exists as an asset but the chunk no longer
lists it. The assertion then aborts the parent compilation.

| Input | Observed |
| --- | --- |
| Merge base, replace at 401 | Builds and loads the replacement |
| PR head, replace at 401 | `no files found for shared compat-shared chunk` |
| PR head, replace at 3000 | Builds and loads the replacement |
| PR head, `updateAsset` at 401 | Builds and loads the updated asset |

The PR's test uses delete and re-emit at stage 3000, after the new validation.
That test therefore passes even though replacing the asset earlier has become
a build error. The test here uses no hash placeholders and exercises the public
`sharing.TreeShakingSharedPlugin` with real Rspack builds.

## Run live

Build the JavaScript wrappers from merge base
`9b175f33eb5bde07bb7620c3a0fac0d4e1f8aaaf` and reviewed head
`934a07b0b2ec49bec78ce459a9ae88d215efdc0d`. Install locked dependencies and run
`pnpm --filter @rspack/core run build` in each checkout. Use a matching binding
file, such as the macOS arm64 artifact from
[CI run 44303951423](https://github.com/web-infra-dev/rspack/actions/runs/44303951423):

```sh
gh run download 44303951423 --repo web-infra-dev/rspack \
  --name bindings-aarch64-apple-darwin --dir /absolute/path/to/binding

export BASE_CORE=/absolute/path/to/base/packages/rspack/dist/index.js
export HEAD_CORE=/absolute/path/to/head/packages/rspack/dist/index.js
export BINDING=/absolute/path/to/binding/rspack.darwin-arm64.node
node verify.mjs
```

The artifact was built at merge `ffbef8ff1e6c8e11c2a19e75ee064fa05f5b1e6a`,
whose two parents were the base above and
`1c7b3dfa41cd6ae7a5318e4c55d9e6891cf88043`. No native source or binding interface
differs between the three revisions used here. `provenance.json` records the
artifact and wrapper hashes. `observed.json` records Node 22.16.0 on macOS
arm64. The verifier rebuilds the fixture and loads its output on every run.
