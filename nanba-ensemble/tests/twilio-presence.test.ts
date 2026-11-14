import { test } from "node:test";
import assert from "node:assert/strict";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
function fixture() {
  const db = new DB(":memory:");
  let now = Date.now();
  const calls: { url: string; init?: RequestInit }[] = [];
  let provider: () => Promise<Response> = async () =>
    Response.json({ success: true });
  const a = new TwilioAssistant(
    db,
    "https://nanba.test",
    {
      IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
      TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
      TWILIO_AUTH_TOKEN: "a".repeat(32),
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
      TWILIO_AI_ENABLED: "true",
      OPENAI_API_KEY: "test",
      TWILIO_PRESENCE_ENABLED: "true",
    },
    async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/Indicators/")) return provider();
      if (String(url).endsWith("/responses"))
        return Response.json({
          output: [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: "Bonjour !" }],
            },
          ],
        });
      return Response.json({ sid: "SM" + "e".repeat(32), status: "queued" });
    },
    () => now,
  );
  const receive = (sid = "SM" + "1".repeat(32), body = "Bonjour") =>
    a.receive({
      MessageSid: sid,
      From: "whatsapp:+33600000001",
      To: a.config().from,
      Body: body,
      NumMedia: "0",
    });
  return {
    a,
    db,
    calls,
    receive,
    advance: () => (now += 21000),
    setProvider: (p: () => Promise<Response>) => (provider = p),
  };
}
test("accepted inbound gets read/typing via documented V3 JSON and dedupes retries", async () => {
  const f = fixture();
  const sid = "SM" + "1".repeat(32);
  f.receive();
  assert.equal(f.calls.length, 0);
  await f.a.presence.indicate(sid);
  assert.equal(f.calls.length, 1);
  assert.equal(
    f.calls[0].url,
    "https://messaging.twilio.com/v3/Indicators/Typing.json",
  );
  assert.deepEqual(JSON.parse(f.calls[0].init!.body as string), {
    channel: "WHATSAPP",
    messageId: sid,
  });
  assert.equal(f.a.presence.status().lastResult?.state, "accepted");
  f.receive();
  await f.a.presence.indicate(sid);
  assert.equal(f.calls.length, 1);
  f.advance();
  await f.a.presence.indicate(sid);
  assert.equal(f.calls.length, 2);
  f.db.close();
});
test("no indicator for unknown, stopped, cancelled, completed or synthetic jobs", async () => {
  const f = fixture(),
    sid = "SM" + "1".repeat(32);
  await f.a.presence.indicate(sid);
  await f.a.presence.indicate("NT" + "1".repeat(32));
  assert.equal(f.calls.length, 0);
  f.receive();
  f.receive("SM" + "2".repeat(32), "STOP");
  await f.a.presence.indicate(sid);
  await f.a.presence.indicate("SM" + "2".repeat(32));
  assert.equal(f.calls.length, 0);
  f.db.run("UPDATE twilio_contacts SET stopped=0");
  f.db.run("UPDATE twilio_jobs SET state='sent'");
  await f.a.presence.indicate(sid);
  assert.equal(f.calls.length, 0);
  f.db.close();
});
test("presence failure never fails the actual AI response", async () => {
  const f = fixture();
  f.setProvider(async () => new Response("", { status: 401 }));
  f.receive();
  await f.a.tick();
  assert.equal(f.db.get("SELECT state FROM twilio_jobs")!.state, "sent");
  assert.equal(f.a.presence.status().lastResult?.error, "presence_http_401");
  assert.equal(
    f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
    1,
  );
  f.db.close();
});
test("inflight dedupe, worker refresh stops after send, configuration can disable presence", async () => {
  const f = fixture(),
    sid = "MM" + "1".repeat(32);
  f.receive(sid);
  let finish!: (r: Response) => void;
  f.setProvider(() => new Promise((r) => (finish = r)));
  const first = f.a.presence.indicate(sid);
  await f.a.presence.indicate(sid);
  assert.equal(f.calls.length, 1);
  finish(Response.json({ success: true }));
  await first;
  f.db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", sid);
  f.advance();
  await f.a.presence.indicate(sid);
  assert.equal(f.calls.length, 1);
  f.a.env.TWILIO_PRESENCE_ENABLED = "false";
  f.receive("SM" + "2".repeat(32));
  await f.a.presence.indicate("SM" + "2".repeat(32));
  assert.equal(f.calls.length, 1);
  f.db.close();
});
