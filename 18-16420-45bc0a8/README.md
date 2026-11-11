# An initially loaded member of an async cycle loses SRI coverage

This is a distinct remaining path after the independent-entry fix in #16420.
The page entry imports shared synchronously. Shared dynamically imports leaf;
leaf can dynamically import shared back. A second, independent entry imports
leaf directly. splitChunks extracts shared, and only page is started in Chrome.

The call-site graph has the strongly connected component {shared, leaf}.
The manifest discards intra-component edges and assumes an outside caller
provides the component's hashes. Other is such a caller, but page starts shared
as an initial chunk: it has no import() edge into the component and never loads
other. Neither page nor shared carries leaf's hash.

The per-group empty-parent intersection fix cannot help because the leaf was
excluded by the same-component check before that intersection runs. Previously,
the per-group carrier page held leaf's hash. The existing async-cycle test starts
the cycle through an import() caller; the independent-entry test has no cycle.

| Leaf response | Base | PR |
| --- | --- | --- |
| Original | Returns 42 with correct SHA-256 | Returns 42 with integrity "undefined" |
| Original plus a statement setting a global flag | ChunkLoadError; flag never set | Returns 42; flag set |

The return edge need not execute to cause the failure. Such cycles can arise
between lazy screens/routes with a common navigation module, loaded initially
on one page and asynchronously on another.

## Live comparison

Tested on macOS arm64, Node 22.16.0, Google Chrome 149.0.7827.54.
The actual output bundles and Chrome observations are saved in output-base/,
output-head/, base.json and head.json. Run `node verify.mjs` to verify these
captures without dependencies.

Use the JS wrapper built from CI merge
`383847aab1ae1f4b46d762c599cc5315bbaf1fa4`
with `pnpm install --frozen-lockfile` and `pnpm --filter @rspack/core build`.
Its JS wrapper sources are identical to the control parent. In this directory:

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
npm install --prefix . --no-save --package-lock=false playwright-core@1.64.1
gh run download 42795713722 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/base
gh run download 42800101224 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/head
node capture.mjs build/base/rspack.darwin-arm64.node output-base > base.json
node capture.mjs build/head/rspack.darwin-arm64.node output-head > head.json
node verify.mjs
```

Chrome must be installed, or set CHROME_BIN to a Chromium executable.
The harness serves emitted files via Playwright routing; no real site is
contacted. It tests both original and modified leaf responses on fresh pages,
keeping the original entry scripts and embedded hashes unchanged.

- Reviewed head: `45bc0a88b3537b18084386877c79484aa746e12c`.
- [PR artifact](https://github.com/web-infra-dev/rspack/actions/runs/42800101224/artifacts/13757830655):
  CI merge `383847aab1ae1f4b46d762c599cc5315bbaf1fa4`; parents
  `ec5f6bd360f11ae615f8ee5b7773021dff02fd48` and the reviewed head.
- [Control artifact](https://github.com/web-infra-dev/rspack/actions/runs/42795713722/artifacts/13753667160):
  the merge's first parent `ec5f6bd360f11ae615f8ee5b7773021dff02fd48`.
- The original PR base `9a6e6f16349fd8b397abe1df5c5bff63aa78b3c6` was also
  tested and blocks the modified response.
- If CI artifacts expire or a different platform is needed, build bindings at
  the recorded revisions and pass their paths instead.
