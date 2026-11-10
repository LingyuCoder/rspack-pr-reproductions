# PR #16543: clearCache() still resolves the previous PnP dependency

A long-lived native ResolverFactory resolves `dep` from the project root.
The harness changes the project's dependency from `portal:./v1` to
`portal:./v2`, runs a real Yarn install, and explicitly clears the resolver
cache. Both packages remain on disk. The next resolution should return the
same file as a newly constructed resolver. Keeping the old file is a silent
wrong result even when the issuer can discover the new manifest.

| macOS arm64, Node 22.16.0, Yarn 4.3.1 | Initial install | Second install + clearCache() | Fresh resolver |
| --- | --- | --- | --- |
| Base | v1/index.js | v2/index.js | v2/index.js |
| PR CI merge | v1/index.js | **v1/index.js** | v2/index.js |

## Rerun

`node verify.mjs` checks the saved captures without installing anything.
To rerun the live trigger with GitHub CLI, Node.js 22, Corepack, and macOS arm64:

```sh
gh run download 42627440816 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D /tmp/pnp-case-base
gh run download 42639196816 -R web-infra-dev/rspack -n bindings-aarch64-apple-darwin -D /tmp/pnp-case-pr
node capture.mjs "$(find /tmp/pnp-case-base -name '*.node' -print -quit)"
node capture.mjs "$(find /tmp/pnp-case-pr -name '*.node' -print -quit)"
```

The script creates and removes a temporary project with two local packages.
Yarn does not fetch packages for these portal dependencies; Corepack needs
access to Yarn 4.3.1 if it is not already cached. To test another platform or
after CI artifacts expire, pass the path to a matching native Rspack binding
built at the revisions below. This case exercises the explicit resolver API;
it does not start a dev server.

## Source revisions

- [PR #16543](https://github.com/web-infra-dev/rspack/pull/16543), head
  `2ccaed212ab6c25bc40d1b4096d1473aedd92724`.
- Control: `7130b9b9e43d4b3e95eff974a7e18152557de0ea`,
  [base CI](https://github.com/web-infra-dev/rspack/actions/runs/42627440816),
  artifact `13680050904`.
- PR binary: `fc7456017273632105fb8f998bcfe7a677fbc298`, a merge of the
  reviewed head into that exact control. The [checkout log](https://github.com/web-infra-dev/rspack/actions/runs/42639196816/job/129235708262)
  identifies the merge; artifact `13684672142`.

The freshly started Yarn PnP runtime resolves v2 on both sides. Native binary
SHA-256: base `1771e8d431bd09e4578252f566f02afc7c750f210ec9bc4b0ec0ee66930c3761`,
PR `b05b6a5173033aba4f46bd56b0cf43650f3594d352365076e37147a995abe6af`.
