import { test } from "node:test";
import assert from "node:assert/strict";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
import { localInstant, nextDaily, NANBA_API } from "../src/nanba-companion.ts";
const sid = (n: number) => "SM" + n.toString(16).padStart(32, "0");
function fixture() {
  const db = new DB(":memory:");
  let now = Date.parse("2026-11-13T18:00:00Z");
  let response: any = null;
  const calls: { url: string; init?: RequestInit }[] = [];
  const env = {
    IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
    TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
    TWILIO_AUTH_TOKEN: "a".repeat(32),
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
    OPENAI_API_KEY: "test-key",
    TWILIO_AI_ENABLED: "true",
  };
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/responses"))
      return Response.json(
        response || {
          output: [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: "Bonne journée !" }],
            },
          ],
        },
      );
    if (String(url).endsWith("/Messages.json"))
      return Response.json({ sid: sid(1000 + calls.length), status: "queued" });
    if (String(url).includes("/news/top-stories"))
      return Response.json({
        items: [
          {
            title: "Ancien",
            url: "https://example.com/old",
            publishedAt: "2026-10-01",
          },
        ],
        fetchedAt: "2026-11-13",
      });
    if (String(url).includes("/news?"))
      return Response.json({
        items: [
          {
            title: "Information récente",
            url: "https://example.com/news",
            source: "Éditeur",
            publishedAt: "2026-11-13T12:00:00Z",
          },
          {
            title: "Malveillant",
            url: "javascript:alert(1)",
            publishedAt: "2026-11-13T12:00:00Z",
          },
        ],
        fetchedAt: "2026-11-13T17:00:00Z",
      });
    if (String(url).includes("/listings?"))
      return Response.json([
        {
          id: "housing-1",
          title: "Chambre",
          location: "Paris",
          price: 450,
          description: "20 m2",
        },
      ]);
    if (String(url).endsWith("/ApprovalRequests"))
      return Response.json({ whatsapp: { status: "approved" } });
    throw Error("unexpected_url:" + url);
  };
  const a = new TwilioAssistant(
    db,
    "https://nanba.test",
    env,
    fetcher,
    () => now,
  );
  const receive = (
    n = 1,
    body = "Bonjour",
    phone = "whatsapp:+33600000001",
  ) => {
    a.receive({
      MessageSid: sid(n),
      From: phone,
      To: env.TWILIO_WHATSAPP_FROM,
      Body: body,
      NumMedia: "0",
    });
    return db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid(n))!;
  };
  const action = async (args: any, n = 1) => {
    const j = db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid(n))!;
    db.run("UPDATE twilio_jobs SET state='generating' WHERE sid=?", j.sid);
    return a.companion.action(j, args);
  };
  return {
    db,
    a,
    calls,
    receive,
    action,
    time: (x: number) => (now = x),
    setResponse: (x: any) => (response = x),
    close: () => db.close(),
  };
}
test("Paris exact time, spring gap, autumn ambiguity and daily DST preservation", () => {
  assert.equal(
    localInstant("2026-11-14T09:00", "Europe/Paris"),
    Date.parse("2026-11-14T08:00Z"),
  );
  assert.throws(
    () => localInstant("2027-03-28T02:30", "Europe/Paris"),
    /inexistante/,
  );
  assert.throws(
    () => localInstant("2027-10-31T02:30", "Europe/Paris"),
    /ambigue/,
  );
  assert.equal(
    nextDaily(Date.parse("2027-03-27T08:01Z"), "09:00", "Europe/Paris"),
    Date.parse("2027-03-28T07:00Z"),
  );
  assert.equal(
    nextDaily(Date.parse("2026-11-13T18:00Z"), "08:00", "Europe/Paris", [1]),
    Date.parse("2026-11-16T07:00Z"),
  );
  assert.throws(() => localInstant("2027-02-30T10:00", "Europe/Paris"));
});
test("encrypted profiles isolated by number, editable, durable across cleanup; actions deduplicated", async () => {
  const f = fixture();
  try {
    const one = f.receive();
    f.receive(2, "Hello", "whatsapp:+33600000002");
    await f.action({
      action: "profile_update",
      profile: {
        name: "Anbu",
        age: 68,
        language: "ta",
        facts: ["Recherche logement Paris"],
      },
    });
    assert.equal(f.a.companion.profile(one.identity).age, 68);
    assert.equal(
      f.a.companion.profile(
        f.db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid(2))!.identity,
      ).age,
      undefined,
    );
    assert.ok(
      !f.db.get("SELECT data FROM nanba_profiles")!.data.includes("Anbu"),
    );
    f.time(Date.parse("2026-11-23T18:00Z"));
    f.a.cleanup();
    assert.equal(f.a.companion.profile(one.identity).name, "Anbu");
    assert.ok(
      f.db.get(
        "SELECT phone FROM twilio_contacts WHERE identity=?",
        one.identity,
      )!.phone,
    );
    await f.action({ action: "profile_update", profile: { age: null } });
    assert.equal(f.a.companion.profile(one.identity).age, undefined);
  } finally {
    f.close();
  }
});
test("one-off reminder is persistent and sent once, never to an injected recipient", async () => {
  const f = fixture();
  try {
    const job = f.receive();
    const args = {
      action: "task_create",
      kind: "reminder",
      text: "Dossier",
      at: "2026-11-13T19:01",
      recurrence: "once",
      recipient: "whatsapp:+33699999999",
    };
    const first = await f.action(args);
    const repeat = await f.action(args);
    assert.equal(first.reference, repeat.reference);
    f.db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", job.sid);
    f.time(Date.parse("2026-11-13T18:01Z"));
    await f.a.tick();
    await f.a.tick();
    const sends = f.calls.filter((x) => x.url.endsWith("/Messages.json"));
    assert.equal(sends.length, 1);
    const body = new URLSearchParams(sends[0].init!.body as string);
    assert.equal(body.get("To"), "whatsapp:+33600000001");
    assert.equal(body.get("Body"), "⏰ Dossier");
    assert.equal(f.db.get("SELECT state FROM nanba_tasks")!.state, "completed");
  } finally {
    f.close();
  }
});
test("outside 24 hours waits for real template approval, wakes without duplicate, callback tracks notification", async () => {
  const f = fixture();
  try {
    const job = f.receive();
    await f.action({
      action: "task_create",
      kind: "reminder",
      text: "Appeler",
      at: "2026-11-15T09:00",
      recurrence: "once",
    });
    f.db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", job.sid);
    f.time(Date.parse("2026-11-15T08:00Z"));
    await f.a.tick();
    assert.equal(
      f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
      0,
    );
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE sid LIKE 'NT%'")!.state,
      "waiting_template",
    );
    f.db.run(
      "INSERT INTO nanba_templates VALUES(?,?,?)",
      "reminder",
      "HX" + "a".repeat(32),
      "approved",
    );
    f.a.companion.templatesChecked = Date.parse("2026-11-15T08:00Z");
    await f.a.tick();
    const sent = f.calls.find((x) => x.url.endsWith("/Messages.json"))!;
    const body = new URLSearchParams(sent.init!.body as string);
    assert.ok(body.get("ContentSid"));
    assert.equal(body.has("Body"), false);
    const nt = f.db.get("SELECT * FROM twilio_jobs WHERE sid LIKE 'NT%'")!;
    f.a.callback(
      { MessageSid: nt.provider_id, MessageStatus: "delivered" },
      nt.sid,
    );
    assert.equal(
      f.db.get("SELECT delivery FROM twilio_jobs WHERE sid=?", nt.sid)!
        .delivery,
      "delivered",
    );
    await f.a.tick();
    assert.equal(
      f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
      1,
    );
  } finally {
    f.close();
  }
});
test("STOP cancels future notifications, START never resubscribes, OUBLIE removes long term memory", async () => {
  const f = fixture();
  try {
    const j = f.receive();
    await f.action({ action: "profile_update", profile: { name: "Test" } });
    await f.action({
      action: "task_create",
      kind: "morning",
      at: "08:00",
      recurrence: "daily",
    });
    f.receive(2, "STOP");
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
    f.receive(3, "START");
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
    f.receive(4, "OUBLIE");
    assert.deepEqual(f.a.companion.profile(j.identity), {});
    assert.equal(f.db.get("SELECT count(*) n FROM nanba_actions")!.n, 0);
  } finally {
    f.close();
  }
});
test("image tool uses original asset, hides spiritual styles unless selected, respects weekdays, sends actual MediaUrl", async () => {
  const f = fixture();
  try {
    const j = f.receive();
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const im = f.a.companion.upload(png, "image/png", {
      title: "Famille",
      style: "family",
      language: "fr",
      days: [],
    });
    const r = await f.action({ action: "image" });
    assert.equal(r.mediaUrl, im.url);
    f.db.run(
      "UPDATE twilio_jobs SET output=?,state=? WHERE sid=?",
      f.a.seal("Image du jour ".repeat(120)),
      "ready",
      j.sid,
    );
    await f.a.tick();
    assert.equal(
      new URLSearchParams(
        f.calls.find((x) => x.url.endsWith("/Messages.json"))!.init!
          .body as string,
      ).get("MediaUrl"),
      im.url,
    );
    assert.ok(
      new URLSearchParams(
        f.calls.find((x) => x.url.endsWith("/Messages.json"))!.init!
          .body as string,
      ).get("Body")!.length <= 1024,
    );
    f.a.companion.upload(Buffer.concat([png, Buffer.from([1])]), "image/png", {
      title: "Vendredi",
      style: "spiritual",
      days: [5],
    });
    assert.equal(f.a.companion.image(j.identity, "spiritual").available, true);
    f.time(Date.parse("2026-11-14T08:00Z"));
    assert.equal(f.a.companion.image(j.identity, "spiritual").available, false);
    assert.throws(() => f.a.companion.publicImage("../secret"));
  } finally {
    f.close();
  }
});
test("news uses actual Nanba endpoints, rejects stale digest and unsafe links; watches only report new matching listings", async () => {
  const f = fixture();
  try {
    const j = f.receive();
    const news = await f.action({ action: "news", region: "india" });
    assert.equal(news.items.length, 1);
    assert.equal(news.items[0].title, "Information récente");
    assert.ok(f.calls.filter((x) => x.url.startsWith(NANBA_API)).length === 2);
    await f.action({
      action: "task_create",
      kind: "watch",
      target: "housing",
      city: "Paris",
      budget: 500,
      at: "19:01",
      recurrence: "daily",
    });
    f.db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", j.sid);
    f.time(Date.parse("2026-11-13T18:01Z"));
    await f.a.tick();
    assert.equal(
      f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
      1,
    );
    f.time(Date.parse("2026-11-14T18:01Z"));
    await f.a.tick();
    assert.equal(
      f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
      1,
    );
  } finally {
    f.close();
  }
});
test("function call loop executes real tool before answer, passes isolated profile, checks budget per call", async () => {
  const f = fixture();
  try {
    const j = f.receive();
    f.setResponse({
      output: [
        {
          type: "function_call",
          name: "nanba",
          call_id: "call_1",
          arguments: JSON.stringify({
            action: "profile_update",
            profile: { language: "fr", age: 60 },
          }),
        },
      ],
    });
    const original = f.a.fetcher;
    let count = 0;
    f.a.fetcher = async (url, init) => {
      const result = await original(url, init);
      if (String(url).endsWith("/responses") && ++count === 1)
        f.setResponse(null);
      return result;
    };
    await f.a.tick();
    assert.equal(f.a.companion.profile(j.identity).age, 60);
    assert.equal(f.db.get("SELECT calls FROM twilio_usage")!.calls, 2);
    const second = JSON.parse(
      f.calls.filter((x) => x.url.endsWith("/responses"))[1].init!
        .body as string,
    );
    assert.ok(second.input.some((x: any) => x.type === "function_call_output"));
    assert.equal(f.db.get("SELECT state FROM twilio_jobs")!.state, "sent");
  } finally {
    f.close();
  }
});
test("mutual matching does not reveal numbers before acceptance and prevents cross-user acceptance", async () => {
  const f = fixture();
  try {
    const a = f.receive();
    const offer = await f.action({
      action: "community_publish",
      text: "Je peux aider pour traduire un courrier",
      city: "Paris",
    });
    const b = f.receive(2, "Recherche", "whatsapp:+33600000002");
    const results = await f.action({ action: "community_search" }, 2);
    assert.ok(!JSON.stringify(results).includes("+336"));
    const request = await f.action(
      { action: "community_request", reference: offer.reference },
      2,
    );
    assert.ok(!JSON.stringify(request).includes("+336"));
    await assert.rejects(() =>
      f.action({ action: "community_accept", reference: request.reference }, 2),
    );
    const accepted = await f.action({
      action: "community_accept",
      reference: request.reference,
    });
    assert.equal(accepted.phone, "+33600000002");
    assert.notEqual(a.identity, b.identity);
  } finally {
    f.close();
  }
});

test("a reminder awaiting approval remains visible and can be cancelled without later delivery", async () => {
  const f = fixture();
  try {
    const job = f.receive();
    const reminder = await f.action({
      action: "task_create",
      kind: "reminder",
      text: "Papier",
      at: "2026-11-15T09:00",
      recurrence: "once",
    });
    f.db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", job.sid);
    f.time(Date.parse("2026-11-15T08:00Z"));
    await f.a.tick();
    assert.equal(f.a.companion.tasks(job.identity).length, 1);
    f.receive(2, "Annule mon rappel");
    await f.action({ action: "task_cancel", reference: reminder.reference }, 2);
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE sid LIKE 'NT%'")!.state,
      "cancelled",
    );
    assert.equal(f.a.companion.tasks(job.identity).length, 0);
  } finally {
    f.close();
  }
});
