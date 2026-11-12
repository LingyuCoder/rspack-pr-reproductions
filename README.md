# Rspack PR reproductions

Small, independently runnable reproductions of issues found while reviewing Rspack
pull requests. Case directories use `NN-PR_ID-SHORT_COMMIT_ID`.

| Case | Pull request | Reviewed commit | Problem |
| --- | --- | --- | --- |
| [01-16386-e156d24](./01-16386-e156d24/) | [#16386](https://github.com/web-infra-dev/rspack/pull/16386) | [`e156d24`](https://github.com/web-infra-dev/rspack/commit/e156d242f031897c4d1b35e696479d753ca68921) | Duplicate startup `await` can call a library's exported `then` |
| [02-16401-124b1c2](./02-16401-124b1c2/) | [#16401](https://github.com/web-infra-dev/rspack/pull/16401) | [`124b1c2`](https://github.com/web-infra-dev/rspack/commit/124b1c221352ac221d8233d69e6c6685056b5185) | Retaining original JSON keys conflicts with mangled property reads through a named CommonJS reexport |
| [03-16401-c5f554c](./03-16401-c5f554c/) | [#16401](https://github.com/web-infra-dev/rspack/pull/16401) | [`c5f554c`](https://github.com/web-infra-dev/rspack/commit/c5f554cfa0615ef72d9c53be506c8f184c61d7bf) | A prototype method call in one entry disables JSON tree shaking in another independent runtime |
| [04-16411-5672f91](./04-16411-5672f91/) | [#16411](https://github.com/web-infra-dev/rspack/pull/16411) | [`5672f91`](https://github.com/web-infra-dev/rspack/commit/5672f91b41f78c9d3118035838dbfb12b4d7c733) | An initially missing nested context loses its immediate removal and aggregate removal |
| [05-16543-2ccaed2](./05-16543-2ccaed2/) | [#16543](https://github.com/web-infra-dev/rspack/pull/16543) | [`2ccaed2`](https://github.com/web-infra-dev/rspack/commit/2ccaed212ab6c25bc40d1b4096d1473aedd92724) | Clearing a resolver after a Yarn install still returns the previous dependency |
| [06-16198-c8d8b6e](./06-16198-c8d8b6e/) | [#16198](https://github.com/web-infra-dev/rspack/pull/16198) | [`c8d8b6e`](https://github.com/web-infra-dev/rspack/commit/c8d8b6e3eeceefb740a8941da1f6f51cb21b0296) | A handled synchronous accept error stops further updates to an async ESM dependency |
| [07-16198-c8d8b6e](./07-16198-c8d8b6e/) | [#16198](https://github.com/web-infra-dev/rspack/pull/16198) | [`c8d8b6e`](https://github.com/web-infra-dev/rspack/commit/c8d8b6e3eeceefb740a8941da1f6f51cb21b0296) | Returning a dynamic import from an accept callback prevents chunk-version catch-up |
| [08-16545-3e1d7cd](./08-16545-3e1d7cd/) | [#16545](https://github.com/web-infra-dev/rspack/pull/16545) | [`3e1d7cd`](https://github.com/web-infra-dev/rspack/commit/3e1d7cd0cde668971934a5ac7e9fb20fc49bf8ad) | Keeping a quoted re-export emits invalid ESM |
| [09-16545-3e1d7cd](./09-16545-3e1d7cd/) | [#16545](https://github.com/web-infra-dev/rspack/pull/16545) | [`3e1d7cd`](https://github.com/web-infra-dev/rspack/commit/3e1d7cd0cde668971934a5ac7e9fb20fc49bf8ad) | A retained external moves ahead of its prerequisite split chunk |
| [10-16470-5d545e9](./10-16470-5d545e9/) | [#16470](https://github.com/web-infra-dev/rspack/pull/16470) | [`5d545e9`](https://github.com/web-infra-dev/rspack/commit/5d545e903e7fc801de95d48129ddcb102d50c93e) | Materializing external map JSON after a content-hash edit takes longer |
| [11-16470-5d545e9](./11-16470-5d545e9/) | [#16470](https://github.com/web-infra-dev/rspack/pull/16470) | [`5d545e9`](https://github.com/web-infra-dev/rspack/commit/5d545e903e7fc801de95d48129ddcb102d50c93e) | DevTool retains the minimizer's intermediate source map and unminified input after emit |
| [12-16470-5d545e9](./12-16470-5d545e9/) | [#16470](https://github.com/web-infra-dev/rspack/pull/16470) | [`5d545e9`](https://github.com/web-infra-dev/rspack/commit/5d545e903e7fc801de95d48129ddcb102d50c93e) | Computing several SRI algorithms for one large asset no longer runs them in parallel |
| [13-16470-c6ec478](./13-16470-c6ec478/) | [#16470](https://github.com/web-infra-dev/rspack/pull/16470) | [`c6ec478`](https://github.com/web-infra-dev/rspack/commit/c6ec478e89492da3a7fba80a36481b4c1f724096) | An inline source map keeps the plugin-provided input map alive after emit |
| [14-16470-ca5d312](./14-16470-ca5d312/) | [#16470](https://github.com/web-infra-dev/rspack/pull/16470) | [`ca5d312`](https://github.com/web-infra-dev/rspack/commit/ca5d3122ab09991916b7bb2d8a7f52523b4ce331) | External no-sources maps keep discarded original source content alive through the emitted JavaScript |
| [15-16543-183d42d](./15-16543-183d42d/) | [#16543](https://github.com/web-infra-dev/rspack/pull/16543) | [`183d42d`](https://github.com/web-infra-dev/rspack/commit/183d42dba1777e74379b80032f51a981be402bf5) | Clearing a PnP resolver ignores a newly installed, closer manifest |
| [16-16554-94c8e84](./16-16554-94c8e84/) | [#16554](https://github.com/web-infra-dev/rspack/pull/16554) | [`94c8e84`](https://github.com/web-infra-dev/rspack/commit/94c8e84581dafc28d13c6691f6216df07bd2439c) | Aliases declared in a later tsconfig lose the earlier baseUrl |
| [17-16420-3f81372](./17-16420-3f81372/) | [#16420](https://github.com/web-infra-dev/rspack/pull/16420) | [`3f81372`](https://github.com/web-infra-dev/rspack/commit/3f8137291e09b185d6dc146428f76f2cffb36e7e) | Lazy SRI allows a modified async script to execute on an independent entry path |
| [18-16420-45bc0a8](./18-16420-45bc0a8/) | [#16420](https://github.com/web-infra-dev/rspack/pull/16420) | [`45bc0a8`](https://github.com/web-infra-dev/rspack/commit/45bc0a88b3537b18084386877c79484aa746e12c) | An initially loaded member of an async cycle loses SRI coverage |
| [19-16545-227188f](./19-16545-227188f/) | [#16545](https://github.com/web-infra-dev/rspack/pull/16545) | [`227188f`](https://github.com/web-infra-dev/rspack/commit/227188f25f6f9af948d2a703fb93344c77dd077d) | Unicode local re-export still produces invalid ESM |
| [20-16545-227188f](./20-16545-227188f/) | [#16545](https://github.com/web-infra-dev/rspack/pull/16545) | [`227188f`](https://github.com/web-infra-dev/rspack/commit/227188f25f6f9af948d2a703fb93344c77dd077d) | An intermediate module bypasses the prior-chunk ordering guard |
| [21-16580-30ca66e](./21-16580-30ca66e/) | [#16580](https://github.com/web-infra-dev/rspack/pull/16580) | [`30ca66e`](https://github.com/web-infra-dev/rspack/commit/30ca66e8cccd15b7c145f0da6994ace75010448b) | A failed build removes the executor while another async loader can still import |
| [22-16580-30ca66e](./22-16580-30ca66e/) | [#16580](https://github.com/web-infra-dev/rspack/pull/16580) | [`30ca66e`](https://github.com/web-infra-dev/rspack/commit/30ca66e8cccd15b7c145f0da6994ace75010448b) | A local CSS watch edit rebuilds all producers of an unchanged shared stylesheet |
| [23-16545-3437f2f](./23-16545-3437f2f/) | [#16545](https://github.com/web-infra-dev/rspack/pull/16545) | [`3437f2f`](https://github.com/web-infra-dev/rspack/commit/3437f2ff751cd2b4cd7c6314b766745acfc11258) | Retaining an external import breaks a default re-export's live binding |
| [24-16545-3437f2f](./24-16545-3437f2f/) | [#16545](https://github.com/web-infra-dev/rspack/pull/16545) | [`3437f2f`](https://github.com/web-infra-dev/rspack/commit/3437f2ff751cd2b4cd7c6314b766745acfc11258) | An extracted earlier array entry is missing from the ordering guard |

Check each case's saved evidence with Node.js 22 or newer, without installing dependencies:

```sh
node 01-16386-e156d24/verify.mjs
node 02-16401-124b1c2/verify.mjs
node 03-16401-c5f554c/verify.mjs
node 04-16411-5672f91/verify.mjs
node 05-16543-2ccaed2/verify.mjs
node 06-16198-c8d8b6e/verify.mjs
node 07-16198-c8d8b6e/verify.mjs
node 08-16545-3e1d7cd/verify.mjs
node 09-16545-3e1d7cd/verify.mjs
node 15-16543-183d42d/verify.mjs
node 16-16554-94c8e84/verify.mjs
node 17-16420-3f81372/verify.mjs
node 18-16420-45bc0a8/verify.mjs
node 23-16545-3437f2f/verify.mjs
node 24-16545-3437f2f/verify.mjs
```

For #16470, see each case's README for the toolchain or binding prerequisites:

```sh
node 10-16470-5d545e9/verify.mjs
node 11-16470-5d545e9/verify.mjs
node 12-16470-5d545e9/verify.mjs
node 13-16470-c6ec478/verify.mjs
node 14-16470-ca5d312/verify.mjs
node 19-16545-227188f/verify.mjs
node 20-16545-227188f/verify.mjs
```

Each case includes its input or live harness and captured comparison results.
Bundler cases also include their build configuration and actual generated bundles.
The watcher case checks saved event captures; its README explains how to rerun
the live comparison with matching native bindings and Watchpack.

For #16580, the verifiers execute live builds with matching wrappers/bindings; see the case READMEs for `BASE_CORE`, `BASE_BINDING`, `HEAD_CORE`, and `HEAD_BINDING`:

```sh
node 21-16580-30ca66e/verify.mjs
node 22-16580-30ca66e/verify.mjs
```
