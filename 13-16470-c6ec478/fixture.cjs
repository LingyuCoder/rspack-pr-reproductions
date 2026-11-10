const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {rspack}=require(process.env.RSPACK_CORE || '@rspack/core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inline-map-asset-'));
process.env.RSPACK_OBSERVE_MAP=dir;
fs.writeFileSync(path.join(dir,'entry.js'),'');
const c=rspack({mode:'none',cache:false,devtool:'inline-source-map',context:dir,entry:'./entry.js',output:{path:path.join(dir,'out')},plugins:[{apply(c){
 c.hooks.thisCompilation.tap('EmitVendor',compilation=>compilation.hooks.processAssets.tap({name:'EmitVendor',stage:rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS},()=>{
    const vendor=process.env.VENDOR_JS;
    const value=vendor ? fs.readFileSync(vendor,'utf8') : 'console.log(1);';
    const map=vendor ? JSON.parse(fs.readFileSync(vendor+'.map','utf8')) : {
      version:3,sources:['vendor.ts'],names:[],mappings:'AAAA',
      sourcesContent:['/*'+'untranspiled '.repeat(650000)+'*/\nconsole.log(1);']
    };
    const source=new rspack.sources.SourceMapSource(value,'vendor.js',map);
    compilation.emitAsset('vendor.js',source);
 }));
 c.hooks.afterEmit.tapPromise('Observe', async()=>{
    const js=fs.readFileSync(path.join(dir,'out','vendor.js'),'utf8');
    const result=JSON.parse(Buffer.from(js.split('base64,')[1],'base64').toString());
    if(!result.sourcesContent.some(s=>s?.length > (process.env.VENDOR_JS ? 9000 : 8000000)))throw Error('missing inline-map original content');
    fs.writeFileSync(path.join(dir,'observe'),'');
    for(let i=0;i<1000&&!fs.existsSync(path.join(dir,'observed'));i++)await new Promise(r=>setTimeout(r,10));
    const [count,inputBytes,allocationBytes,state]=fs.readFileSync(path.join(dir,'observed'),'utf8').split(' ');
    console.log(JSON.stringify({liveStrongReferences:Number(count),inputBytes:Number(inputBytes),allocationBytes:Number(allocationBytes),allocationState:state,sha256:crypto.createHash('sha256').update(js).digest('hex')}));

 });
}}]}); c.run((e,s)=>{ if(e||s.hasErrors()){ console.error(e||s.toString()); process.exitCode=1;}c.close(()=>fs.rmSync(dir,{recursive:true,force:true}));});
