// Temporary read-only diagnostics: no messages sent and no account identifiers logged.
import { DatabaseSync } from 'node:sqlite';
import { Server } from 'node:http';

const log = (stage, data) => console.log('NANBA_MESSAGE_DIAGNOSTIC ' + JSON.stringify({ stage, ...data }));
const code = (value) => typeof value === 'string' && /^[a-z0-9_:-]{1,100}$/i.test(value) ? value : value ? 'other' : null;
const originalEmit = Server.prototype.emit;
Server.prototype.emit = function(event, ...args) {
  if (event === 'request' && args[0]?.url?.split('?')[0] === '/api/webhooks/waha') {
    const [req, res] = args;
    const started = Date.now();
    res.once('finish', () => log('webhook', { method: req.method, status: res.statusCode, elapsedMs: Date.now() - started }));
  }
  return originalEmit.call(this, event, ...args);
};

async function inspect() {
  let expectedReply;
  try {
    const db = new DatabaseSync(process.env.DATABASE_PATH || '/app/data/pilot.db', { readOnly: true });
    const group = db.prepare('SELECT allowed, paused, settings FROM groups WHERE id=?').get('pilot-self');
    log('database', {
      selfGroup: group ? { allowed: group.allowed, paused: group.paused, selfTest: JSON.parse(group.settings).selfTest === true } : null,
      inbox: db.prepare('SELECT status, count(*) AS count FROM inbox GROUP BY status').all(),
      selfInbox: db.prepare('SELECT status, attempts, error FROM inbox WHERE context=? ORDER BY created_at DESC LIMIT 5').all('pilot-self').map(x => ({...x, error: code(x.error)})),
      selfOutbox: db.prepare('SELECT status, mode, error FROM outbox WHERE group_id=? ORDER BY created_at DESC LIMIT 5').all('pilot-self').map(x => ({...x, error: code(x.error)})),
    });
    expectedReply = db.prepare("SELECT provider_id FROM outbox WHERE group_id='pilot-self' AND status='confirmed' ORDER BY created_at DESC LIMIT 1").get()?.provider_id;
    db.close();
  } catch(e) { log('database_error', {name: e.name, code: code(e.code)}); }
  try {
    const host = process.env.WAHA_PRIVATE_HOSTPORT;
    if (!host || !/^[a-z0-9][a-z0-9-]*:\d{2,5}$/.test(host)) return log('provider', { error: 'private_host_missing' });
    const base = 'http://' + host;
    const get = async path => {
      const response = await fetch(base + path, { headers: { 'X-Api-Key': process.env.WAHA_API_KEY }, signal: AbortSignal.timeout(15000), redirect: 'error' });
      return { status: response.status, body: await response.json() };
    };
    const sessionName = process.env.WAHA_SESSION || 'default';
    const state = await get('/api/sessions/' + encodeURIComponent(sessionName));
    const data = state.body;
    const expectedUrl = (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL)?.replace(/\/$/, '') + '/api/webhooks/waha';
    log('provider', {
      http: state.status, status: data.status, selfAvailable: !!data.me?.id, meKeys: Object.keys(data.me || {}),
      webhooks: (data.config?.webhooks || []).map(h => ({ urlMatches: h.url === expectedUrl, messageAny: h.events?.includes('message.any'), hmacPresent: !!h.hmac?.key, hmacMatches: h.hmac?.key === process.env.WAHA_WEBHOOK_SECRET })),
    });
    if (state.status === 200 && data.status === 'WORKING' && /^\d+@c\.us$/.test(data.me?.id || '')) {
      const mapping = await get('/api/' + encodeURIComponent(sessionName) + '/lids/pn/' + encodeURIComponent(data.me.id));
      log('self_mapping', { http: mapping.status, phoneMatches: mapping.body.pn === data.me.id, lidPresent: typeof mapping.body.lid === 'string', sessionLidMatches: mapping.body.lid === data.me.lid });
      const messages = await get('/api/' + encodeURIComponent(sessionName) + '/chats/' + encodeURIComponent(data.me.id) + '/messages?limit=5&downloadMedia=false');
      log('self_messages', { http: messages.status, items: Array.isArray(messages.body) ? messages.body.map(m => ({fromMe: m.fromMe, matchesSentReply: !!expectedReply && m.id === expectedReply, ack: m.ack, source: code(m.source), toType: typeof m.to, toSuffix: typeof m.to === 'string' ? m.to.split('@').at(-1) : null, toDeviceQualified: typeof m.to === 'string' && /:\d+@/.test(m.to), toMappedSelf: !!mapping.body.lid && m.to === mapping.body.lid, rawToMatches: m._data?.to === data.me.id, remoteSelf: m._data?.id?.remote === data.me.id || m._data?.id?.remote === data.me.lid, remoteMappedSelf: !!mapping.body.lid && m._data?.id?.remote === mapping.body.lid, isHelp: /^nanba\s+aide\s*$/i.test(m.body || ''), fromSelf: m.from === data.me.id || m.from === data.me.lid, toSelf: m.to === data.me.id || m.to === data.me.lid, ageSeconds: Math.round(Date.now()/1000 - m.timestamp)})) : undefined, error: Array.isArray(messages.body) ? undefined : { statusCode: messages.body.statusCode, error: code(messages.body.error), evaluationFailed: /Evaluation failed|Cannot read properties|is not a function/.test(JSON.stringify(messages.body)), methods: [...new Set((JSON.stringify(messages.body).match(/(?:getChat|getChats|getMessage|getMessages|fetchMessages|WWebJS|Store|isReady|Chat)/g) || []))] } });
    }
  } catch(e) { log('provider_error', {name: e.name, code: code(e.code)}); }
}
setTimeout(inspect, 35000).unref();
setTimeout(inspect, 90000).unref();
