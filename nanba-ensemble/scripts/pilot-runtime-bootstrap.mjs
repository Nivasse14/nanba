import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {brotliDecompressSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const count=Number(process.env.NANBA_RUNTIME_PARTS);if(!Number.isInteger(count)||count<1||count>40)throw Error('nanba_runtime_parts');
const packed=Array.from({length:count},(_,i)=>process.env['NANBA_RUNTIME_'+String(i).padStart(2,'0')]||'').join('');
if(createHash('sha256').update(packed).digest('hex')!==process.env.NANBA_RUNTIME_SHA256)throw Error('nanba_runtime_digest');
const patches=JSON.parse(brotliDecompressSync(Buffer.from(packed,'base64')));
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
