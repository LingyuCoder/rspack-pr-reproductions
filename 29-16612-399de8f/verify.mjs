import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const results={};
const revisions=['base','head'];
if (process.env.ORIGINAL_CORE && process.env.ORIGINAL_BINDING) revisions.push('original');
for(const rev of revisions) {
  results[rev]={};
  for(const runtime of ['default','rspack']) {
    const p=spawnSync(process.execPath,[path.join(import.meta.dirname,'build.mjs'),rev,runtime],{encoding:'utf8'});
    if(p.status!==0 || p.error)throw Error(p.stderr || p.error);
    const result=JSON.parse(p.stdout.trim().split('\n').at(-1));
    assert.deepEqual(result.native,{exit:0,order:['x','z'],value:[1,1]});
    if(rev==='head')assert.deepEqual(result.bundle,{exit:1,order:['z'],error:'x is not initialized'});
    else assert.deepEqual(result.bundle,result.native);
    results[rev][runtime]=result;
  }
}
if(process.env.RESULT_FILE) fs.writeFileSync(process.env.RESULT_FILE,JSON.stringify(results,null,2)+'\n');
console.log('Verified both runtime modes: native and merge base load in x,z order; the PR head evaluates z first and throws.');
