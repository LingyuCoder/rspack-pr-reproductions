# Paths in a later tsconfig lose the earlier baseUrl

The root extends `[base.json, aliases.json]`. The first config sets only
`baseUrl: "./src"`; the second sets only `paths: { "@/*": ["./*"] }`.
The import in `fixture/entry.ts` should resolve to `src/value.ts` because
the two compiler options do not conflict.

| Native binding | TypeScript 5.9.3 | Rspack |
| --- | --- | --- |
| PR branch's merge base | src/value.ts | src/value.ts |
| Main before the merge (same native sources) | src/value.ts | src/value.ts |
| PR CI merge | src/value.ts | Cannot find module '@/value' |

PR [#16554](https://github.com/web-infra-dev/rspack/pull/16554) at
`94c8e84581dafc28d13c6691f6216df07bd2439c`. Tested on macOS arm64, Node
22.16.0. `node verify.mjs` checks the saved outputs without dependencies.

To run the live comparison from this directory (use equivalent native artifacts
for your own platform, or build the same revisions if artifacts have expired):

```sh
npm install --no-save --package-lock=false --prefix . typescript@5.9.3
gh run download 42769589391 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/merge-base
gh run download 42782589247 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/base
gh run download 42784728826 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/pr
node capture.mjs ./build/merge-base/rspack.darwin-arm64.node
node capture.mjs ./build/base/rspack.darwin-arm64.node
node capture.mjs ./build/pr/rspack.darwin-arm64.node
```

- [PR build](https://github.com/web-infra-dev/rspack/actions/runs/42784728826/job/129723526578):
  artifact 13749506882, built from merge `fcb6bc714585034addb3377fe99f4e3ec0f4a582`
  (first parent `c6cf76ddea8074787dac62ec652440f0b3d19989`, second parent the reviewed head).
- [Main build](https://github.com/web-infra-dev/rspack/actions/runs/42782589247):
  artifact 13746492742, `c82729830ee9f59d99f48e64998ede6ed8c2ea3a`.
  The [only intervening commit](https://github.com/web-infra-dev/rspack/commit/c6cf76ddea8074787dac62ec652440f0b3d19989)
  before the PR merge changes only website files.
- [Branch merge-base build](https://github.com/web-infra-dev/rspack/actions/runs/42769589391):
  artifact 13741457138, `d30a883abf352d9bad4ee3809cce42eb049589b7`.
