import { test } from "node:test";
import assert from "node:assert/strict";
import { DB, uid, json } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
import { Worker } from "../src/worker.ts";
import { normalizeWaha, WahaConnector } from "../src/whatsapp.ts";
import {
  Pilot,
  setupAvailable,
  setupOwner,
  authorizeSetup,
} from "../src/pilot.ts";
import { hash } from "../src/auth.ts";
import { fixture, admin } from "./helpers.ts";

const phone = "33600000001@c.us";
function personal(f: ReturnType<typeof fixture>) {
  f.db.run(
    "UPDATE groups SET chat_id=?,settings=? WHERE id='paris'",
    phone,
    json({ assistantEnabled: true, selfTest: true }),
  );
  const identity = f.a.identity("simulated", f.a.session, phone);
  f.db.run(
    "UPDATE identities SET user_id='admin',verified_at=? WHERE identity_hash=?",
    f.now(),
    identity,
  );
}
function event(f: ReturnType<typeof fixture>, body: string, extra: any = {}) {
  return {
    session: f.a.session,
    event: "message.any",
    me: { id: phone, lid: "123456@lid" },
    payload: {
      id: uid(),
      from: phone,
      to: phone,
      body,
      source: "app",
      fromMe: true,
      timestamp: Math.floor(f.now() / 1000),
      ...extra,
    },
  };
}
function accept(f: ReturnType<typeof fixture>, body: any) {
  const normalized = normalizeWaha(
    body,
    "simulated",
    f.a.session,
    (chat) => f.db.get("SELECT * FROM groups WHERE chat_id=?", chat),
    (id) => {
      const p = f.db.get("SELECT options FROM polls WHERE message_id=?", id);
      return p ? JSON.parse(p.options) : undefined;
    },
  );
  if (normalized) f.worker.app.db.tx(() => f.worker.accept(normalized));
  return normalized;
}
async function say(f: ReturnType<typeof fixture>, body: string) {
  const e = event(f, body);
  accept(f, e);
  await f.worker.tick();
  return e;
}

test("personal WhatsApp help responds immediately; replay and API echoes never duplicate it", async () => {
  const f = fixture();
  try {
    personal(f);
    const e = await say(f, "Nanba aide");
    assert.equal(f.connector.sent.length, 1);
    assert.match(f.connector.sent[0].text!, /Vanakkam/);
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM records WHERE kind='command_draft'")!.n,
      0,
    );
    accept(f, { ...e, id: "different-webhook-envelope" });
    await f.worker.tick();
    assert.equal(f.connector.sent.length, 1);
    assert.equal(accept(f, event(f, f.connector.sent[0].text!)), null);
    assert.equal(accept(f, event(f, "Nanba aide", { source: "api" })), null);
    assert.equal(accept(f, event(f, "Conversation ordinaire")), null);
    assert.equal(
      accept(f, event(f, "Nanba aide", { to: "33600000002@c.us" })),
      null,
    );
  } finally {
    f.close();
  }
});

test("missing own LID is resolved through WAHA without accepting other outgoing chats", async () => {
  const f = fixture();
  const urls: string[] = [];
  try {
    personal(f);
    const connector = new WahaConnector({
      base: "https://waha.example.invalid",
      apiKey: "a".repeat(32),
      session: f.a.session,
      engine: "WEBJS",
      allowReal: true,
      privateChatIds: () => [phone],
      fetcher: async (url) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ pn: phone, lid: "123456@lid" }));
      },
    });
    const own = {
      ...event(f, "Nanba aide", { to: "123456@lid" }),
      me: { id: phone },
    };
    assert.equal(accept(f, own), null);
    await connector.resolveSelfIdentity(own);
    assert.equal(accept(f, own)?.groupId, "paris");
    await f.worker.tick();
    assert.equal(f.connector.sent.length, 1);
    assert.equal(f.connector.sent[0].chatId, phone);
    for (const fields of [
      { to: "999999@lid" },
      { to: "123456@lid", source: "api" },
      { to: "123456@lid", fromMe: false },
      { to: "123456@lid", body: "ordinary text" },
    ]) {
      const ignored = { ...event(f, "Nanba aide", fields), me: { id: phone } };
      await connector.resolveSelfIdentity(ignored);
      assert.equal(accept(f, ignored), null);
    }
    assert.equal(urls.length, 1);
    assert.ok(urls[0].endsWith("/lids/pn/" + encodeURIComponent(phone)));
    const invalid = new WahaConnector({
      base: "https://waha.example.invalid",
      apiKey: "a".repeat(32),
      session: f.a.session,
      engine: "WEBJS",
      allowReal: true,
      privateChatIds: () => [phone],
      fetcher: async () =>
        new Response(
          JSON.stringify({ pn: "33600000009@c.us", lid: "123456@lid" }),
        ),
    });
    await assert.rejects(
      () =>
        invalid.resolveSelfIdentity({
          ...event(f, "Nanba aide", { to: "123456@lid" }),
          me: { id: phone },
        }),
      /invalid_self_identity_mapping/,
    );
  } finally {
    f.close();
  }
});

test("proposal wizard survives a new worker and finishes with real backend poll/results semantics", async () => {
  const f = fixture();
  let reopened: DB | undefined;
  try {
    personal(f);
    await say(f, "Nanba proposer sortie familiale");
    await say(f, "Nanba Paris");
    reopened = new DB(f.path);
    f.worker = new Worker(
      new Domain(reopened, f.now),
      f.connector,
      "https://nanba.invalid",
    );
    await say(f, "Nanba dimanche prochain");
    await say(f, "Nanba 1");
    assert.match(f.connector.sent.at(-1)!.text!, /2 et 500/);
    await say(f, "Nanba 3");
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM records WHERE json_extract(data,'$.title')='sortie familiale'",
      )!.n,
      0,
    );
    const confirmation = await say(f, "Nanba confirmer");
    const r = f.db.get(
      "SELECT * FROM records WHERE kind='request' AND json_extract(data,'$.title')='sortie familiale'",
    )!;
    assert.ok(r);
    assert.equal(JSON.parse(r.data).threshold, 3);
    accept(f, confirmation);
    await f.worker.tick();
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM records WHERE kind='request' AND json_extract(data,'$.title')='sortie familiale'",
      )!.n,
      1,
    );
    await say(f, "Nanba sondage " + r.id.slice(0, 8));
    const poll = f.db.get("SELECT * FROM polls WHERE request_id=?", r.id)!;
    assert.ok(poll.message_id);
    assert.equal(f.connector.sent.filter((s) => s.kind === "poll").length, 1);
    const vote = {
      session: f.a.session,
      event: "poll.vote",
      me: { id: phone },
      payload: {
        poll: { id: poll.message_id, to: phone },
        vote: {
          id: uid(),
          to: phone,
          from: phone,
          fromMe: true,
          selectedOptions: ["Je participe / Interested"],
          timestamp: f.now() / 1000,
        },
      },
    };
    accept(f, vote);
    await f.worker.tick();
    await say(f, "Nanba résultats " + r.id.slice(0, 8));
    assert.match(f.connector.sent.at(-1)!.text!, /1 intérêt\(s\), seuil 3/);
    assert.match(f.connector.sent.at(-1)!.text!, /Aucune réservation/);
  } finally {
    reopened?.close();
    f.close();
  }
});

test("group participation is explicit and cannot grant admin rights or revive a revoked membership", async () => {
  const f = fixture();
  try {
    f.db.run(
      "UPDATE groups SET settings=? WHERE id='paris'",
      json({ assistantEnabled: true }),
    );
    const incoming = (body: string) =>
      event(f, body, {
        from: "120363000001@g.us",
        to: phone,
        fromMe: false,
        participant: "new@lid",
      });
    accept(f, incoming("Nanba aide"));
    await f.worker.tick();
    assert.match(f.connector.sent.at(-1)!.text!, /rejoindre/);
    assert.equal(
      f.db.get("SELECT user_id FROM identities WHERE user_id IS NULL")?.user_id,
      null,
    );
    accept(f, incoming("Nanba rejoindre"));
    await f.worker.tick();
    const identity = f.a.identity("simulated", f.a.session, "new@lid"),
      user = f.db.get(
        "SELECT user_id FROM identities WHERE identity_hash=?",
        identity,
      )!.user_id;
    assert.equal(
      f.db.get("SELECT role FROM memberships WHERE user_id=?", user)!.role,
      "member",
    );
    assert.equal(
      f.db.get("SELECT platform_admin FROM users WHERE id=?", user)!
        .platform_admin,
      0,
    );
    accept(f, incoming("Nanba sondage 12345678"));
    await f.worker.tick();
    assert.match(
      f.connector.sent.at(-1)!.text!,
      /réservée à un administrateur/,
    );
    f.db.run("UPDATE memberships SET active=0 WHERE user_id=?", user);
    accept(f, incoming("Nanba rejoindre"));
    await f.worker.tick();
    assert.equal(
      f.db.get("SELECT active FROM memberships WHERE user_id=?", user)!.active,
      0,
    );
  } finally {
    f.close();
  }
});

test("automatic replies honor pause, scope, rate limits and revoked permissions at send time", async () => {
  const f = fixture();
  try {
    personal(f);
    const other = f.a.createRecord(
      { userId: "outsider", groupId: "lyon" },
      "request",
      "open",
      {
        title: "Secret autre groupe",
        threshold: 2,
        deadline: f.now() + 86400000,
      },
    );
    await say(f, "Nanba résultats " + other.id.slice(0, 8));
    assert.doesNotMatch(f.connector.sent.at(-1)!.text!, /Secret autre groupe/);
    f.connector.failure = "disconnected";
    await say(f, "Nanba aide");
    const pending = f.db.get("SELECT id FROM outbox WHERE status='pending'")!;
    assert.ok(pending);
    f.db.run("UPDATE groups SET settings='{}' WHERE id='paris'");
    f.connector.failure = "none";
    await f.worker.tick();
    assert.equal(
      f.db.get("SELECT status FROM outbox WHERE id=?", pending.id)!.status,
      "cancelled",
    );
    personal(f);
    await say(f, "Nanba stop");
    assert.equal(
      f.db.get("SELECT paused FROM groups WHERE id='paris'")!.paused,
      1,
    );
    const count = f.connector.sent.length;
    await say(f, "Nanba aide");
    assert.equal(f.connector.sent.length, count);
    f.db.run("UPDATE groups SET paused=0 WHERE id='paris'");
    f.advance(60001);
    for (let i = 0; i < 16; i++) await say(f, "Nanba aide");
    assert.equal(f.connector.sent.length, count + 15);
  } finally {
    f.close();
  }
});

test("bootstrap self-test authorizes only provider-confirmed owner chat and preserves web owner activation", async () => {
  const f = fixture();
  try {
    // Empty deployment, unlike the seeded fixture.
    const db = new DB(":memory:"),
      a = new Domain(db, f.now, "waha", "default");
    const connector = new WahaConnector({
      base: "http://localhost:3001",
      apiKey: "a".repeat(32),
      session: "default",
      engine: "WEBJS",
      allowReal: true,
      fetcher: async () =>
        Response.json({
          status: "WORKING",
          me: { id: phone },
          config: { secret: "private" },
        }),
    });
    const pilot = new Pilot(
      a,
      connector,
      "https://nanba.invalid",
      "h".repeat(32),
    );
    const key = "bootstrap-test";
    assert.throws(() => authorizeSetup(a, "bad", hash(key)));
    assert.deepEqual(await pilot.enableSelfTest(), {
      ready: true,
      instructions:
        "Dans WhatsApp, ouvre ta discussion avec toi-même et écris : Nanba aide",
    });
    assert.equal(
      a.db.get("SELECT chat_id FROM groups WHERE id='pilot-self'")!.chat_id,
      phone,
    );
    assert.equal(
      a.db.get("SELECT COUNT(*) n FROM groups WHERE allowed=1")!.n,
      1,
    );
    assert.equal(setupAvailable(a, hash(key)), true);
    assert.equal((await pilot.readStatus()).personalTestReady, true);
    assert.doesNotMatch(
      JSON.stringify(await pilot.readStatus()),
      /private|33600000001/,
    );
    const owner = setupOwner(
      a,
      {
        key,
        email: "owner@example.invalid",
        name: "Owner",
        password: "a-long-test-password",
      },
      hash(key),
    );
    assert.equal(setupAvailable(a, hash(key)), false);
    assert.equal(a.db.get("SELECT user_id FROM identities")!.user_id, owner.id);
    db.close();
  } finally {
    f.close();
  }
});

test("WAHA permits a personal reply only for explicitly authorized private chat IDs", async () => {
  const calls: any[] = [];
  const connector = new WahaConnector({
    base: "http://localhost:3001",
    apiKey: "a".repeat(32),
    session: "default",
    engine: "WEBJS",
    allowReal: true,
    privateChatIds: () => [phone],
    fetcher: async (u, o) => {
      calls.push(JSON.parse(String(o?.body)));
      return Response.json({ id: "provider-confirmed-id" });
    },
  });
  await assert.rejects(
    connector.send({ chatId: "33600000002@c.us", kind: "text", text: "test" }),
  );
  assert.equal(calls.length, 0);
  await connector.send({
    chatId: phone,
    kind: "text",
    text: "🤝 Nanba · test",
    replyTo: "incoming-id",
  });
  assert.equal(calls[0].reply_to, "incoming-id");
  assert.equal(calls[0].chatId, phone);
});
