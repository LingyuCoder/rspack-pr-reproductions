import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const core=process.env.RSPACK_CORE || '@rspack/core';
const {rspack, CssExtractRspackPlugin}=await import(path.isAbsolute(core)?pathToFileURL(core).href:core);
const req=createRequire(import.meta.url);
const n=Number(process.argv[2]||100), shared=process.argv[3]!=='separate';
const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'rspack-16580-css-watch-')));
const context=path.join(dir,`watch-${n}-${shared?'shared':'separate'}`);
await fs.mkdir(context,{recursive:true});
const source=(i,color='red')=>`${shared?'@import "./shared.css";':''}.root${i}{color:${color}}`;
await fs.writeFile(path.join(context,'shared.css'),'.shared { color: green; }');
await fs.writeFile(path.join(context,'entry.js'),Array.from({length:n},(_,i)=>`import './root${i}.css';`).join('\n'));
await Promise.all(Array.from({length:n},(_,i)=>fs.writeFile(path.join(context,`root${i}.css`),source(i))));
let inRebuild=false,built=[],observations=[];
const compiler=rspack({context,mode:'development',cache:true,incremental:true,devtool:false,entry:'./entry.js',output:{path:path.join(context,'dist'),filename:'main.js'},module:{rules:[{test:/\.css$/,type:'javascript/auto',use:[CssExtractRspackPlugin.loader,req.resolve(process.env.CSS_LOADER || 'css-loader')]}]},plugins:[new CssExtractRspackPlugin({filename:'main.css'}),{apply(compiler){compiler.hooks.thisCompilation.tap('Probe',comp=>comp.hooks.buildModule.tap('Probe',mod=>{if(inRebuild)built.push({id:mod.identifier(),type:mod.type,resource:mod.resource});}));}}]});
try {
const stats=await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):resolve(stats)));
if(stats.hasErrors())throw new Error(stats.toString({all:false,errors:true}));
const css=[...stats.compilation.modules].filter(m=>m.type==='css/mini-extract');
const degrees=css.map(m=>stats.compilation.moduleGraph.getIncomingConnections(m).length);
for(let round=0;round<3;round++){
 const color=round%2===0?'blue':'red';const target=path.join(context,'root0.css');
 await fs.writeFile(target,source(0,color));built=[];inRebuild=true;
 await new Promise((resolve,reject)=>compiler.__internal__rebuild(new Set([target]),new Set(),error=>error?reject(error):resolve()));
 inRebuild=false;const comp=compiler._lastCompilation;
 if(comp.errors.length)throw new Error(comp.errors.map(e=>e.message).join('\n'));
 const cssText=comp.getAsset('main.css').source.source().toString();
 const actual=cssText.match(/\.root0\s*\{\s*color:\s*([^;}]+)/)?.[1]?.trim();
 const normalRoots=new Set(built.filter(m=>m.type==='javascript/auto'&&/root\d+\.css$/.test(m.resource||'')).map(m=>m.resource));
 observations.push({round,built:built.length,normalRoots:normalRoots.size,cssModules:css.length,maxCSSInDegree:Math.max(...degrees),expected:color,actual});
}
console.log(JSON.stringify({n,shared,observations}));
}finally{await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));}
