# PR #16386: duplicate await reproduction

Confirmed with Node.js v22.16.0 on macOS arm64.

| Case | Startup awaits of the exports variable | Result |
| --- | ---: | --- |
| Base `f8b4091`, split runtime | 1 | `value=42` |
| PR `e156d24`, split runtime | 2 | `Error: unexpected then`, exit 1 |
| PR, inline runtime | 1 | `value=42` |
| PR, split runtime, `topLevelAwait: false` | 1 | `value=42` |
| Copy of PR output with only the duplicate await removed | 1 | `value=42` |

## Run the saved reproduction

The actual generated bundles are included in `dist/`. No dependency installation
is needed to verify their runtime behavior:

```sh
node verify.mjs
```

To observe the failure directly:

```sh
node dist/pr-split/consumer.mjs
```

To observe the base behavior:

```sh
node dist/base-split/consumer.mjs
```

All consumers use a native **static import**, so the failure does not depend on
dynamic `import()` assimilating a module namespace's exported `then` function.

## Minimal input

`entry.js` exports an initially undefined `then` binding, waits once, and schedules
a microtask that changes `then` into a function that throws. The module's internal
Promise fulfills while `then` is still undefined. Waiting on that fulfilled native
Promise succeeds; subsequently waiting on the exports object calls the new `then`.

The relevant configuration is:

```js
{
  mode: "development",
  target: "node",
  devtool: false,
  entry: "./entry.js",
  output: {
    module: true,
    filename: "[name].mjs",
    library: { type: "module" },
    environment: { topLevelAwait: true }
  },
  optimization: { runtimeChunk: "single" }
}
```

The PR generates two consecutive statements in `dist/pr-split/main.mjs`:

```js
__webpack_exports__ = await __webpack_exports__;
__webpack_exports__ = await __webpack_exports__;
```

`diagnose.mjs` copies this output and removes only the second statement; the copied
bundle then succeeds. It does not alter the PR's source or the original output.

## Build provenance

- PR source: `e156d242f031897c4d1b35e696479d753ca68921`.
- Base source: `f8b4091e996943438b1e667d407d862bc08c2f8b`.
- Native bindings were built by the repository's CI, then downloaded from the
  `bindings-aarch64-apple-darwin` artifact:
  - PR run `41488264161`, artifact `13162149973`.
  - Base run `41446212302`, artifact `13143092610`.
- JavaScript packages were built locally with `pnpm run build:js` at each exact
  source revision before running `build.mjs`. Each used its corresponding binding.
- `results/pr.json` and `results/base.json` record source SHAs, binding filenames,
  emitted awaits, exit codes, stdout and stderr.
- `results/verification.json` records the final assertion results.

## Regenerate the bundles

The standalone configuration is in `rspack.config.mjs`. To regenerate the exact
comparison, use a separate checkout of `web-infra-dev/rspack` and set
`RSPACK_SOURCE` to its absolute directory. For each revision below, install its
dependencies and build its JavaScript packages with `pnpm run build:js`. Use the
matching CI binding listed above, or first build the binding locally with
`pnpm run build:binding:dev` as described in Rspack's development guide.

With the checkout at the PR SHA and its corresponding binding:

```sh
RSPACK_SOURCE=/absolute/path/to/rspack \
RSPACK_BINDING=/absolute/path/to/pr/rspack.darwin-arm64.node \
node build.mjs pr
node diagnose.mjs
```

Repeat at the base SHA with the base binding:

```sh
RSPACK_SOURCE=/absolute/path/to/rspack \
RSPACK_BINDING=/absolute/path/to/base/rspack.darwin-arm64.node \
node build.mjs base
node verify.mjs
```

Use the equivalent binding filename for your platform. The build script verifies
the checkout SHA before compiling. The base predates `topLevelAwait` and ignores
that extra environment field. Recorded stderr replaces the local reproduction
directory with `<repro>`; the emitted code and runtime outcomes are preserved.
