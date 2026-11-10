# Lazy SRI loses a shared module’s hash on the initial entry path

Two independent entries share a module that imports a leaf. The page entry
imports the shared module synchronously. The other entry imports the same
module and the leaf asynchronously. The splitChunks cache group extracts
the shared module. Only the page entry is started in the browser.

On the base, page.js contains the correct leaf digest. On the PR, other.js
has it but is never loaded on this page, page.js initializes an empty table,
and shared.js contributes no leaf digest. The request assigns the string
"undefined" to the script's integrity property. The browser executes even a
modified response. The new shared-carrier test has only one entry and does
not exercise this independent initial path.

| Leaf response | Base | PR |
| --- | --- | --- |
| Original | Returns 42 with valid SHA-256 | Returns 42 without valid digest |
| Original plus a statement setting a global flag | ChunkLoadError; flag never set | Returns 42; flag is set |

Saved builds and Chrome observations: output-base/, output-head/, base.json,
head.json. Run `node verify.mjs` to verify these captures without dependencies.

## Live comparison

Tested on macOS arm64 with Node 22.16.0 and Google Chrome 149.0.7827.54.
Build the JS wrapper from the reviewed Rspack checkout at
`3f8137291e09b185d6dc146428f76f2cffb36e7e` with `pnpm install --frozen-lockfile` and
`pnpm run build:js`; the base has the identical JS sources. Use its absolute
path for RSPACK_CORE. Run the following from this case directory with Google
Chrome installed (or set CHROME_BIN to an installed Chromium executable):

```sh
export RSPACK_CORE=/path/to/rspack/packages/rspack/dist/index.js
npm install --prefix . --no-save --package-lock=false playwright-core@1.64.1
gh run download 42149372233 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/base
gh run download 42149596619 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D build/head
node capture.mjs build/base/rspack.darwin-arm64.node output-base > base.json
node capture.mjs build/head/rspack.darwin-arm64.node output-head > head.json
node verify.mjs
```

The harness serves the emitted files to headless Chrome via Playwright routing.
For each build it opens two fresh pages: first with the original leaf, then with
the extra statement appended to the leaf response. The entry scripts are
identical between these two runs. No real site is contacted.

- [Base CI artifact](https://github.com/web-infra-dev/rspack/actions/runs/42149372233/artifacts/13471039208): `9a6e6f16349fd8b397abe1df5c5bff63aa78b3c6`.
- [PR CI artifact](https://github.com/web-infra-dev/rspack/actions/runs/42149596619/artifacts/13471384305): merge `4fbf52f773794b9567832b674b850c02e11c8e5c`, first parent the base above, second parent the reviewed head. This merge's tree is identical to the reviewed head.
- If the artifacts have expired or you use a different platform, build the
  native bindings at the two listed revisions and pass their paths instead.
