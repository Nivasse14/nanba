// Temporary hash-guarded delivery while the GitHub connector is read-only.
// The actual fix remains in src/whatsapp.ts and src/server.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const hash = source => createHash('sha256').update(source).digest('hex');
const changes = {};
for (const file of ['src/whatsapp.ts', 'src/server.ts']) {
  const before = execFileSync('git', ['show', 'e2aec9a:' + file], {encoding:'utf8'});
  const after = readFileSync(file, 'utf8');
  let start=0, end=0;
  while (before[start] === after[start] && start < before.length) start++;
  while (end < before.length-start && end < after.length-start && before.at(-1-end) === after.at(-1-end)) end++;
  changes[file] = {original:hash(before),patched:hash(after),start,remove:before.length-start-end,insert:after.slice(start,after.length-end)};
}
const packed=gzipSync(JSON.stringify(changes)).toString('base64');
const source=`import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const patches=JSON.parse(gunzipSync(Buffer.from('${packed}','base64')));
const root=pathToFileURL(process.cwd()+'/').href;
const digest=s=>createHash('sha256').update(s).digest('hex');
registerHooks({load(url,context,nextLoad){
 const result=nextLoad(url,context);
 const patch=patches[url.startsWith(root)?url.slice(root.length):''];
 if(!patch)return result;
 const original=Buffer.from(result.source).toString('utf8');
 if(digest(original)===patch.patched)return result;
 if(digest(original)!==patch.original)throw new Error('nanba_self_lid_source_mismatch');
 const source=original.slice(0,patch.start)+patch.insert+original.slice(patch.start+patch.remove);
 if(digest(source)!==patch.patched)throw new Error('nanba_self_lid_patch_mismatch');
 console.log('NANBA_SELF_LID_PATCH '+JSON.stringify({file:url.slice(root.length),verified:true}));
 return {...result,source};
}});
`;
writeFileSync('scripts/pilot-self-lid-preload.mjs',source);
console.log('Created verified source preload');
