import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const { ResolverFactory } = createRequire(import.meta.url)(resolve(process.argv[2]));
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'pnp-clear-cache-')));
try {
  writeFileSync(join(cwd, '.yarnrc.yml'), 'nodeLinker: pnp\nenableTelemetry: false\n');
  for (const dir of ['v1', 'v2']) {
    mkdirSync(join(cwd, dir));
    writeFileSync(join(cwd, dir, 'package.json'), JSON.stringify({
      name: 'dep', version: dir === 'v1' ? '1.0.0' : '2.0.0', main: 'index.js',
    }));
    writeFileSync(join(cwd, dir, 'index.js'), 'module.exports = ' + JSON.stringify(dir));
  }
  function install(dir) {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({
      name: 'app', packageManager: 'yarn@4.3.1', dependencies: { dep: 'portal:./' + dir },
    }));
    execFileSync('corepack', ['yarn@4.3.1', 'install'], { cwd, stdio: ['ignore', 'pipe', 'inherit'] });
  }
  const makeResolver = () => new ResolverFactory({ enablePnp: true, extensions: ['.js'] });
  function lookup(resolver) {
    const result = resolver.sync(cwd, 'dep');
    if (result.error) throw Error(result.error);
    return relative(cwd, result.path).replaceAll('\\', '/');
  }
  install('v1');
  const resolver = makeResolver();
  const before = lookup(resolver);
  install('v2');
  resolver.clearCache();
  const afterClear = lookup(resolver);
  const yarnAfterInstall = execFileSync(process.execPath, [
    '-r', './.pnp.cjs', '-p', "require('node:path').relative(process.cwd(), require.resolve('dep'))",
  ], { cwd, encoding: 'utf8' }).trim().split('\\').join('/');
  const fresh = lookup(makeResolver());
  console.log(JSON.stringify({ before, afterClear, fresh, yarnAfterInstall }, null, 2));
} finally {
  rmSync(cwd, { force: true, recursive: true });
}
