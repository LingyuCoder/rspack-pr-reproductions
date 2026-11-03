# Rspack PR reproductions

Small, independently runnable reproductions of issues found while reviewing Rspack
pull requests. Case directories use `NN-PR_ID-SHORT_COMMIT_ID`.

| Case | Pull request | Reviewed commit | Problem |
| --- | --- | --- | --- |
| [01-16386-e156d24](./01-16386-e156d24/) | [#16386](https://github.com/web-infra-dev/rspack/pull/16386) | [`e156d24`](https://github.com/web-infra-dev/rspack/commit/e156d242f031897c4d1b35e696479d753ca68921) | Duplicate startup `await` can call a library's exported `then` |
| [02-16401-124b1c2](./02-16401-124b1c2/) | [#16401](https://github.com/web-infra-dev/rspack/pull/16401) | [`124b1c2`](https://github.com/web-infra-dev/rspack/commit/124b1c221352ac221d8233d69e6c6685056b5185) | Retaining original JSON keys conflicts with mangled property reads through a named CommonJS reexport |
| [03-16401-c5f554c](./03-16401-c5f554c/) | [#16401](https://github.com/web-infra-dev/rspack/pull/16401) | [`c5f554c`](https://github.com/web-infra-dev/rspack/commit/c5f554cfa0615ef72d9c53be506c8f184c61d7bf) | A prototype method call in one entry disables JSON tree shaking in another independent runtime |

Run each case with Node.js 22 or newer, without installing dependencies:

```sh
node 01-16386-e156d24/verify.mjs
node 02-16401-124b1c2/verify.mjs
node 03-16401-c5f554c/verify.mjs
```

Each case includes its input, build configuration, actual generated bundles, and
the results of comparing the reviewed commit against its base.
