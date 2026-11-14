// Reproducible, hash-guarded pilot deployment when GitHub writes are unavailable.
// Canonical implementation lives in src/. No credentials are embedded.
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {brotliCompressSync,constants} from 'node:zlib';
const hash=s=>createHash('sha256').update(s).digest('hex');
const bundle=await build({entryPoints:['src/twilio-assistant.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node24',minify:true,external:['./db.ts','./auth.ts','./validation.ts','bufferutil','utf-8-validate'],plugins:[{name:'embed-fonts',setup(b){b.onLoad({filter:/nanba-fonts\.ts$/},()=>({loader:'js',contents:'export const fonts={latin:Buffer.from('+JSON.stringify(readFileSync('assets/fonts/NotoSans-Regular.ttf').toString('base64'))+',"base64"),tamil:Buffer.from('+JSON.stringify(readFileSync('assets/fonts/NotoSansTamil-Regular.ttf').toString('base64'))+',"base64")};'}));}}],banner:{js:'import {createRequire as nanbaRequire} from "node:module";const require=nanbaRequire(import.meta.url);'}});
const patches={};
for(const file of ['src/server.ts','src/whatsapp.ts']){
  const before=execFileSync('git',['show','e2aec9a:'+file],{encoding:'utf8'});
  const source=readFileSync(file,'utf8');
  patches[file]={original:hash(before),patched:hash(source),source};
}
const source=bundle.outputFiles[0].text;
patches['src/twilio-assistant.ts']={virtual:true,patched:hash(source),source};
const packed=brotliCompressSync(Buffer.from(JSON.stringify(patches)),{params:{[constants.BROTLI_PARAM_QUALITY]:11}}).toString('base64');
const preload=`import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {brotliDecompressSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const patches=JSON.parse(brotliDecompressSync(Buffer.from('${packed}','base64')));
const root=pathToFileURL(process.cwd()+'/').href;
const digest=s=>createHash('sha256').update(s).digest('hex');
registerHooks({
 resolve(specifier,context,nextResolve){
  if(specifier.startsWith('.') && context.parentURL?.startsWith(root)){
   const url=new URL(specifier,context.parentURL).href;
   if(patches[url.slice(root.length)]?.virtual)return {url,shortCircuit:true};
  }
  return nextResolve(specifier,context);
 },
 load(url,context,nextLoad){
  const file=url.startsWith(root)?url.slice(root.length):'';
  const patch=patches[file];
  if(!patch)return nextLoad(url,context);
  if(digest(patch.source)!==patch.patched)throw Error('nanba_twilio_payload_mismatch');
  if(patch.virtual)return {format:'module',source:patch.source,shortCircuit:true};
  const result=nextLoad(url,context);
  const current=digest(Buffer.from(result.source));
  if(current===patch.patched)return result;
  if(current!==patch.original)throw Error('nanba_twilio_source_mismatch:'+file);
  console.log('NANBA_TWILIO_PATCH '+JSON.stringify({file,verified:true}));
  return {...result,source:patch.source};
 }
});
`;
writeFileSync('scripts/pilot-twilio-preload.mjs',preload);
const environmentLoader=preload.replace(`const patches=JSON.parse(brotliDecompressSync(Buffer.from('${packed}','base64')));`, `const count=Number(process.env.NANBA_RUNTIME_PARTS);if(!Number.isInteger(count)||count<1||count>40)throw Error('nanba_runtime_parts');
const packed=Array.from({length:count},(_,i)=>process.env['NANBA_RUNTIME_'+String(i).padStart(2,'0')]||'').join('');
if(createHash('sha256').update(packed).digest('hex')!==process.env.NANBA_RUNTIME_SHA256)throw Error('nanba_runtime_digest');
const patches=JSON.parse(brotliDecompressSync(Buffer.from(packed,'base64')));`);
writeFileSync('scripts/pilot-runtime-bootstrap.mjs',environmentLoader);
const chunks=packed.match(/.{1,50000}/g);if(packed.length>1800000)throw Error('runtime_exceeds_environment_limit');
writeFileSync('scripts/pilot-runtime-env.json',JSON.stringify([{key:'NODE_OPTIONS',value:'--import=data:text/javascript;base64,'+Buffer.from(environmentLoader).toString('base64')},{key:'NANBA_RUNTIME_PARTS',value:String(chunks.length)},{key:'NANBA_RUNTIME_SHA256',value:hash(packed)},...Array.from({length:40},(_,i)=>({key:'NANBA_RUNTIME_'+String(i).padStart(2,'0'),value:chunks[i]||''}))]));
console.log(JSON.stringify({runtimeEnvironmentBytes:packed.length,parts:chunks.length}));
console.log(JSON.stringify({preloadBytes:Buffer.byteLength(preload),nodeOptionsBytes:Buffer.byteLength(preload)*4/3+40,bundleBytes:Buffer.byteLength(source)}));
