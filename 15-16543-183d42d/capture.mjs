import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const { ResolverFactory } = createRequire(import.meta.url)(resolve(process.argv[2]));
const root = realpathSync(mkdtempSync(join(tmpdir(), 'pnp-nested-')));
const app = join(root, 'app');
const write = (dir, name, content) => writeFileSync(join(dir, name), content);
const manifest = (dir, data) => write(dir, 'package.json', JSON.stringify(data));
const install = cwd => execFileSync('corepack', ['yarn@4.3.1', 'install'], { cwd, stdio: 'pipe' });
const make = () => new ResolverFactory({ enablePnp: true, extensions: ['.js'] });
const normalize = path => relative(root, path).split('\\').join('/');
const lookup = resolver => {
  const result = resolver.sync(app, 'dep');
  if (result.error) throw Error(result.error);
  return normalize(result.path);
};

try {
  mkdirSync(app);
  write(root, '.yarnrc.yml', 'nodeLinker: pnp\nenableTelemetry: false\n');
  for (const [parent, version] of [[root, '1.0.0'], [app, '2.0.0']]) {
    const dep = join(parent, 'dep');
    mkdirSync(dep);
    manifest(dep, { name: 'dep', version, main: 'index.js' });
    write(dep, 'index.js', 'module.exports = ' + JSON.stringify(version));
  }
  const config = { packageManager: 'yarn@4.3.1', dependencies: { dep: 'portal:./dep' } };
  manifest(root, { name: 'root', ...config });
  install(root);
  const resolver = make();
  const before = lookup(resolver);
  // Make app a standalone Yarn project. Both manifests and package versions now exist.
  manifest(app, { name: 'app', ...config });
  write(app, 'yarn.lock', '');
  install(app);
  resolver.clearCache();
  const afterClear = lookup(resolver);
  const fresh = lookup(make());
  const yarn = normalize(execFileSync(process.execPath, ['-r', './.pnp.cjs', '-p', "require.resolve('dep')"], { cwd: app, encoding: 'utf8' }).trim());
  console.log(JSON.stringify({ before, afterClear, fresh, yarn }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
