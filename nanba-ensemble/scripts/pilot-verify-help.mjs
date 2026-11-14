// Reconcile only the already-sent help response, without sending another message.
import { pathToFileURL } from 'node:url';
async function verifyHelp() {
  if(Date.now()>Date.parse('2026-11-13T18:00:00Z'))return;
  let db;
  try {
    const root=pathToFileURL(process.cwd()+'/src/').href;
    const [{ DB },{ WahaConnector },{ Domain }]=await Promise.all(['db.ts','whatsapp.ts','modules.ts'].map(f=>import(root+f)));
    db=new DB(process.env.DATABASE_PATH);
    const group=db.get("SELECT * FROM groups WHERE id='pilot-self' AND allowed=1 AND paused=0 AND json_extract(settings,'$.selfTest')=1");
    if(!group)return;
    const session=process.env.WAHA_SESSION;
    const connector=new WahaConnector({base:process.env.WAHA_URL,apiKey:process.env.WAHA_API_KEY,session,engine:'WEBJS',allowReal:process.env.ALLOW_REAL_SEND==='true',privateHostport:process.env.WAHA_PRIVATE_HOSTPORT,privateChatIds:()=>[group.chat_id]});
    const state=await connector.request('/api/sessions/'+encodeURIComponent(session));
    if(state.status!=='WORKING'||state.me?.id!==group.chat_id)return;
    const mapping=await connector.request('/api/'+encodeURIComponent(session)+'/lids/pn/'+encodeURIComponent(group.chat_id));
    if(mapping.pn!==group.chat_id)return;
    const messages=await connector.request('/api/'+encodeURIComponent(session)+'/chats/'+encodeURIComponent(group.chat_id)+'/messages?limit=5&downloadMedia=false');
    const jobs=db.all("SELECT o.id,o.updated_at,o.record_id,r.data FROM outbox o JOIN records r ON r.id=o.record_id WHERE o.group_id='pilot-self' AND o.status='uncertain' AND o.error='missing_provider_id' AND o.kind='assistant' ORDER BY o.created_at DESC LIMIT 5");
    for(const job of jobs){
      const data=JSON.parse(job.data);
      const original=db.get("SELECT payload FROM inbox WHERE context='pilot-self' AND event_key=?",data.replyTo);
      if(!original||JSON.parse(original.payload).recovery!=='self-lid-help-20261113')continue;
      const matches=messages.filter(m=>m.fromMe===true&&m.source==='api'&&(m.to===group.chat_id||m.to===mapping.lid)&&m.body===data.text&&Math.abs(m.timestamp*1000-job.updated_at)<120000&&typeof m.id==='string'&&m.ack>=1);
      if(matches.length!==1){console.log('NANBA_HELP_VERIFIED '+JSON.stringify({matched:false,candidates:matches.length}));continue;}
      const actual=matches[0];
      db.tx(()=>{
        db.run("UPDATE outbox SET status='confirmed',provider_id=?,error=NULL,updated_at=? WHERE id=? AND status='uncertain' AND error='missing_provider_id'",actual.id,Date.now(),job.id);
        new Domain(db,()=>Date.now(),'waha',session).audit({userId:'pilot-whatsapp-owner',groupId:'pilot-self'},'pilot.help_delivery_verified',job.record_id);
      });
      console.log('NANBA_HELP_VERIFIED '+JSON.stringify({matched:true,ack:actual.ack,status:'confirmed',resend:false}));
    }
  }catch(e){console.log('NANBA_HELP_VERIFIED '+JSON.stringify({error:e.name}));}
  finally{db?.close();}
}
setTimeout(verifyHelp,15000).unref();
