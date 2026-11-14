// One-time recovery of the user's requested, non-mutating help response.
// No other commands, chats, historical messages or uncertain sends are replayed.
import { pathToFileURL } from 'node:url';
const report = details => console.log('NANBA_HELP_RECOVERY ' + JSON.stringify(details));
async function recoverHelp() {
  if (Date.now() > Date.parse('2026-11-13T18:00:00Z')) return;
  let db;
  try {
    const root=pathToFileURL(process.cwd()+'/src/').href;
    const [{ DB }, { Domain }, { Worker }, { WahaConnector, normalizeWaha }] = await Promise.all(['db.ts','modules.ts','worker.ts','whatsapp.ts'].map(f=>import(root+f)));
    db=new DB(process.env.DATABASE_PATH);
    const repairKey='repair:self-lid-help:20261113';
    if(db.get('SELECT 1 FROM settings WHERE key=?',repairKey)) return report({status:'already_recovered'});
    const group=db.get("SELECT * FROM groups WHERE id='pilot-self' AND allowed=1 AND paused=0 AND json_extract(settings,'$.selfTest')=1");
    if(!group)return report({status:'self_test_inactive'});
    const session=process.env.WAHA_SESSION;
    const connector=new WahaConnector({base:process.env.WAHA_URL,apiKey:process.env.WAHA_API_KEY,session,engine:'WEBJS',allowReal:process.env.ALLOW_REAL_SEND==='true',privateHostport:process.env.WAHA_PRIVATE_HOSTPORT,privateChatIds:()=>[group.chat_id]});
    const state=await connector.request('/api/sessions/'+encodeURIComponent(session));
    if(state.status!=='WORKING'||state.me?.id!==group.chat_id) return report({status:'self_identity_unconfirmed'});
    const messages=await connector.request('/api/'+encodeURIComponent(session)+'/chats/'+encodeURIComponent(group.chat_id)+'/messages?limit=5&downloadMedia=false');
    const help=messages.find(m=>m.fromMe===true&&m.source==='app'&&/^nanba\s+aide\s*$/i.test(m.body||'')&&Date.now()-m.timestamp*1000<3600000&&m.timestamp*1000<Date.parse('2026-11-13T17:00:00Z'));
    if(!help)return report({status:'original_help_not_found'});
    const envelope={session,event:'message.any',me:state.me,payload:help};
    await connector.resolveSelfIdentity(envelope);
    const event=normalizeWaha(envelope,'waha',session,id=>db.get('SELECT * FROM groups WHERE chat_id=?',id),()=>undefined);
    if(event?.groupId!=='pilot-self'||event.type!=='command')return report({status:'normalization_failed'});
    const app=new Domain(db,()=>Date.now(),'waha',session);
    const worker=new Worker(app,connector,process.env.APP_ORIGIN);
    // The user has requested this response again during troubleshooting. Record
    // its original time and an explicit recovery time; do not forge a webhook.
    const originalAt=event.at;
    event.originalAt=originalAt;
    event.at=Date.now();
    event.recovery='self-lid-help-20261113';
    const accepted=db.tx(()=>{
      if(db.get('SELECT 1 FROM settings WHERE key=?',repairKey))return {duplicate:true};
      const result=worker.accept(event);
      db.run('INSERT INTO settings(key,value) VALUES(?,?)',repairKey,JSON.stringify({recoveredAt:event.at,originalAt}));
      app.audit({userId:'pilot-whatsapp-owner',groupId:'pilot-self'},'pilot.help_recovered_after_identity_fix');
      return result;
    });
    report({status:'queued',duplicate:!!accepted.duplicate});
  } catch(e) {report({status:'failed',name:e.name,code:/^[a-z0-9_:-]{1,100}$/i.test(e.message)?e.message:'runtime_error'});}
  finally {db?.close();}
}
setTimeout(recoverHelp,15000).unref();
