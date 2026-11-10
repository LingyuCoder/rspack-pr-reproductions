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
```

Each case includes its input or live harness and captured comparison results.
Bundler cases also include their build configuration and actual generated bundles.
The watcher case checks saved event captures; its README explains how to rerun
the live comparison with matching native bindings and Watchpack.
