import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const file of ['merge-base.json', 'base.json', 'pr.json']) {
  const observed = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  assert.deepEqual(observed, {
    typescriptVersion: '5.9.3',
    typescript: 'src/value.ts',
    rspack: file === 'pr.json' ? "Cannot find module '@/value'" : 'src/value.ts'
  }, file);
}
console.log('Verified: both base bindings and TypeScript resolve the alias; the PR binding cannot.');
