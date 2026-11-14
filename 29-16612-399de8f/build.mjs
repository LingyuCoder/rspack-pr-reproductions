import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const [revision, mode] = process.argv.slice(2);
const key = revision.toUpperCase();
assert(process.env[key+'_CORE'] && process.env[key+'_BINDING'], 'see README.md for build paths');
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = path.resolve(process.env[key+'_BINDING']);
const {rspack} = await import(pathToFileURL(path.resolve(process.env[key+'_CORE'])).href);
const src = path.join(import.meta.dirname, 'fixtures');
const out = fs.mkdtempSync(path.join(os.tmpdir(),'rspack-duplicate-external-'));

function consume(file) {
  const probe = `globalThis.order = []; try {
    const m=await import(${JSON.stringify(pathToFileURL(file).href)});
    console.log(JSON.stringify({order:globalThis.order, value:[m.x,m.z]}));
  } catch (e) {console.log(JSON.stringify({order:globalThis.order,error:e.message}));process.exitCode=1;}`;
  const p=spawnSync(process.execPath,['--input-type=module','-e',probe],{encoding:'utf8'});
  if (!p.stdout) throw Error(p.stderr || 'missing consumer result');
  return {exit:p.status,...JSON.parse(p.stdout.trim())};
}
try {
  const external=['./x.mjs','./z.mjs'];
  for (const file of external) fs.copyFileSync(path.join(src,file),path.join(out,file));
  const c=rspack({
    context:src,entry:'./index.mjs',mode:'production',target:'node',devtool:false,
    experiments:mode === 'rspack' ? {runtimeMode:'rspack'} : {},
    externalsType:'module',externals:Object.fromEntries(external.map(x=>[x,x])),
    optimization:{minimize:false,runtimeChunk:false,splitChunks:{chunks:'all',cacheGroups:{
      named:{test:/[\\/]d\.mjs$/,name:'named',enforce:true}
    }}},
    output:{module:true,library:{type:'modern-module'},filename:'[name].mjs',chunkFilename:'[name].mjs',path:out}
  });
  const stats=await new Promise((res,rej)=>c.run((e,s)=>c.close(ce=>e||ce?rej(e||ce):res(s))));
  if (stats.hasErrors()) throw Error(stats.toString());
  const snapshot = {};
  for (const name of ['main.mjs','named.mjs']) {
    const code=fs.readFileSync(path.join(out,name),'utf8');
    snapshot[name]=code.split('\n').filter(l=>/^(?:import |export .* from )/.test(l));
    if (process.env.CAPTURE_DIR) {
      const d=path.join(process.env.CAPTURE_DIR,revision,mode);
      fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,name),code);
    }
  }
  console.log(JSON.stringify({native:consume(path.join(src,'index.mjs')),bundle:consume(path.join(out,'main.mjs')),snapshot}));
} finally {fs.rmSync(out,{recursive:true,force:true});}
