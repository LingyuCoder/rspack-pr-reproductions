import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const dir = fileURLToPath(new URL('./fixture/', import.meta.url));
const configFile = path.join(dir, 'tsconfig.json');
const request = '@/value';
const ts = require('typescript');
const config = ts.getParsedCommandLineOfConfigFile(configFile, {}, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic(d) { throw Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); }
});
const expected = ts.resolveModuleName(request, path.join(dir, 'entry.ts'), config.options, ts.sys).resolvedModule;
const binding = require(path.resolve(process.argv[2]));
const actual = new binding.ResolverFactory({ extensions: ['.ts'], tsconfig: { configFile } }).sync(dir, request);
console.log(JSON.stringify({
  typescriptVersion: ts.version, typescript: path.relative(dir, expected.resolvedFileName),
  rspack: actual.path ? path.relative(dir, actual.path) : actual.error
}, null, 2));
