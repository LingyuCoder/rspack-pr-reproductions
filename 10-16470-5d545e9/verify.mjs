import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'edited-map-'));
const shas = { main: 'd30a883abf352d9bad4ee3809cce42eb049589b7', base: '580d3467e8e63a2860e7b6db4f657dbb8137a927', head: '5d545e903e7fc801de95d48129ddcb102d50c93e' };
const hash = (buf) => createHash('sha256').update(buf).digest('hex');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: work, ...opts });
try {
  const pkg = join(work, 'colorjs.tgz');
  run('curl', ['-fsSL', 'https://registry.npmjs.org/colorjs.io/-/colorjs.io-0.5.2.tgz', '-o', pkg]);
  assert.equal(hash(readFileSync(pkg)), '49f3ea5c4efd4648e8869d2c9434c495cbf41951323470e329c1161c4dc9a204');
  const map = run('tar', ['-xzOf', pkg, 'package/dist/color.legacy.js.map'], { maxBuffer: 1024*1024 });
  assert.equal(hash(map), '07038be44a34fc1e311f286ba6da3b9f3cdf12f16283aafed691fbf7f4f4ad25');
  writeFileSync(join(work, 'input.map'), map);
  const repo = process.env.RSPACK_REPO ? resolve(process.env.RSPACK_REPO) : join(work, 'repo');
  if (!process.env.RSPACK_REPO) {
    run('git', ['init', '-q', repo]);
    for (const sha of Object.values(shas)) run('git', ['-C', repo, 'fetch', '-q', '--depth=1', 'https://github.com/web-infra-dev/rspack.git', sha]);
  }
  const bins = {};
  for (const [name, sha] of Object.entries(shas)) {
    const checkout = join(work, name, 'rspack');
    const crate = join(work, name, 'probe');
    mkdirSync(checkout, { recursive:true });
    mkdirSync(join(crate, 'src'), { recursive:true });
    const archive = join(work, name+'.tar');
    run('git', ['-C', repo, 'archive', '--format=tar', '-o', archive, sha, 'Cargo.toml','Cargo.lock','crates','rust-toolchain.toml']);
    run('tar', ['-xf', archive, '-C', checkout]);
    copyFileSync(join(checkout, 'rust-toolchain.toml'), join(crate, 'rust-toolchain.toml'));
    copyFileSync(join(here,'bench.rs'), join(crate,'src/main.rs'));
    copyFileSync(join(here,'Cargo.lock'), join(crate,'Cargo.lock'));
    writeFileSync(join(crate,'Cargo.toml'), '[package]\nname="edited_map_probe"\nversion="0.1.0"\nedition="2024"\n[features]\nhead=[]\n[dependencies]\nrspack_sources={path="../rspack/crates/rspack_sources"}\n[profile.release]\nlto="fat"\ncodegen-units=1\npanic="abort"\n');
    const target = join(work, 'target');
    run('cargo', ['build', '--release','--locked','--quiet', ...(name === 'head' ? ['--features','head'] : [])], { cwd:crate, env:{...process.env, CARGO_TARGET_DIR:target}, stdio:'inherit' });
    bins[name] = join(work,name,'probe-bin');
    copyFileSync(join(target,'release','edited_map_probe'), bins[name]);
  }
  const bySide = {};
  for (const name of ['main','head','base','head','main']) {
    const row = JSON.parse(run(bins[name], [join(work,'input.map')], {encoding:'utf8'}));
    assert.equal(row.bytes, 471977);
    (bySide[name] ??= []).push(row);
    console.log(name, JSON.stringify(row));
  }
  const avg = (name,k) => bySide[name].reduce((a,x)=>a+x[k],0)/bySide[name].length;
  const mainRatio = avg('head','edited_ns') / avg('main','edited_ns');
  const baseRatio = avg('head','edited_ns') / avg('base','edited_ns');
  console.log('edited map buffer(): head/main =', mainRatio.toFixed(2), 'head/merge-base =', baseRatio.toFixed(2));
  assert.ok(Math.min(mainRatio, baseRatio) > 1.10, 'No >10% slowdown reproduced on this machine; timings are hardware-dependent.');
} finally { rmSync(work, {recursive:true, force:true}); }
