# The warning fixture fails the configuration type check

The new `ignore-warnings/rspack.config.ts` fixture passes a warning with only
`{ readableIdentifier() }` as its `module` to a normalized warning filter. The
filter accepts `WebpackError`, whose optional `module` must be a complete `Module`.
TypeScript rejects the argument at line 20 with TS2345: the object is missing
`type`, `context`, `layer`, `useSourceMap`, and 12 more properties.

This blocks the existing `test:configs` step before the stats-output tests run.
The [Linux Node 22 job](https://github.com/web-infra-dev/rspack/actions/runs/44168688586/job/134348371624)
and [Windows Node 22 job](https://github.com/web-infra-dev/rspack/actions/runs/44168688586/job/134356167277)
report this exact diagnostic. CI tested merge
`797019a67026aea36df0a58fa3dd9a65a29d8445`, with parents
`90374d632fb7b73c7e3ba01eb96046df054ac0a0` (base) and
`2fa4acf9415d3ac948c323a6eee9d3a75997282e` (reviewed head).

## Run

With Node.js 22.16 or later:

```sh
npm ci --ignore-scripts --omit=optional
node verify.mjs
```

The verifier invokes the real TypeScript compiler on the unmodified base and head
configuration files, then compiles a third control that imports `Module` and
asserts the intentionally partial module object to that type. It checks the exit
codes and exact diagnostic; it does not replay saved output or execute the
fixture's runtime assertions.

| Input | Expected | Observed |
| --- | --- | --- |
| Base configuration | Compiles | Exit 0 |
| PR configuration | Compiles | Exit 2, TS2345 at `(20,27)` |
| PR with a typed module test double | Compiles | Exit 0 |

The fixtures are copied byte for byte from
[`90374d6`](https://github.com/web-infra-dev/rspack/blob/90374d632fb7b73c7e3ba01eb96046df054ac0a0/tests/rspack-test/statsOutputCases/ignore-warnings/rspack.config.ts)
and
[`2fa4acf`](https://github.com/web-infra-dev/rspack/blob/2fa4acf9415d3ac948c323a6eee9d3a75997282e/tests/rspack-test/statsOutputCases/ignore-warnings/rspack.config.ts).
Their SHA-256 digests and the captured comparison are in [observed.json](./observed.json).
To refresh the evidence, run `node verify.mjs --record`.

The standalone comparison uses the built declarations from published
`@rspack/core@2.3.2` and `@rspack/cli@2.3.2`, and TypeScript 6.0.3. The PR does not
change the `WebpackError`, `Module`, or normalized filter parameter types; the
independent CI jobs above confirm the same failure against the actual PR build.
No native binding is needed for this type-only reproduction.
