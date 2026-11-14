import { test } from "node:test";
import assert from "node:assert/strict";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
import { Companion } from "../src/nanba-companion.ts";
import { quiet } from "../src/nanba-routines.ts";

function fixture() {
  const db = new DB(":memory:");
  let now = Date.parse("2026-11-14T06:00Z");
  const calls: string[] = [];
  let fail = false,
    wait: Promise<void> | undefined;
  const env = {
    IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
    TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
    TWILIO_AUTH_TOKEN: "a".repeat(32),
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
    OPENAI_API_KEY: "test",
    TWILIO_AI_ENABLED: "true",
  };
  const fetcher: typeof fetch = async (url, init) => {
    const u = String(url);
    calls.push(u);
    if (u.endsWith("/Messages.json"))
      return Response.json({ sid: "SM" + "f".repeat(32), status: "queued" });
    if (u.endsWith("/responses"))
      return Response.json({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Bonjour" }],
          },
        ],
      });
    if (wait) await wait;
    if (fail) return Response.json({}, { status: 503 });
    if (u.includes("/news"))
      return Response.json({
        fetchedAt: new Date(now).toISOString(),
        items: [
          {
            title: "Actualité utile",
            url: "https://example.com/news",
            publishedAt: "2026-11-14T05:00Z",
          },
        ],
      });
    if (u.includes("/cinema/streaming"))
      return Response.json({
        fetchedAt: new Date(now).toISOString(),
        country: "FR",
        items: [
          {
            id: "movie-1",
            title: "Film tamoul",
            overview: "Une histoire familiale",
            language: "Tamil",
            providers: [{ key: "netflix", name: "Netflix" }],
            watchUrl: "https://www.themoviedb.org/movie/1/watch?locale=FR",
          },
        ],
      });
    if (u.includes("/business/overview"))
      return Response.json({
        fx: {
          rates: [
            {
              quoteCurrency: "INR",
              value: 104,
              pair: "EUR/INR",
              asOf: "2026-11-13",
              source: { publisher: "ECB", url: "https://ecb.europa.eu/" },
            },
            { quoteCurrency: "INR", value: 90, asOf: "2025-01-01" },
          ],
        },
        gold: { price: 10000 },
      });
    if (u.includes("/travel/overview"))
      return Response.json({
        booking: { searchUrl: "https://www.google.com/travel/flights" },
      });
    if (u.includes("/employment/training-options"))
      return Response.json({
        examples: [{ title: "CAP cuisine", organization: "Organisme public" }],
        source: { url: "https://example.com/formations" },
      });
    if (u.includes("/kids/daily-game"))
      return Response.json({
        requiresLogin: true,
        quiz: {
          date: "2026-11-14",
          questions: [{ id: "q1", prompt: "4 + 5 ?", options: ["8", "9"] }],
        },
      });
    if (u.includes("/listings"))
      return Response.json([
        { id: "h1", title: "Chambre", location: "Paris", price: 400 },
      ]);
    if (u.includes("ApprovalRequests"))
      return Response.json({ whatsapp: { status: "approved" } });
    throw Error("unexpected_url:" + u);
  };
  const a = new TwilioAssistant(
    db,
    "https://nanba.test",
    env,
    fetcher,
    () => now,
  );
  function receive(n = 1, body = "Bonjour", phone = "whatsapp:+33600000001") {
    const sid = "SM" + n.toString(16).padStart(32, "0");
    a.receive({
      MessageSid: sid,
      From: phone,
      To: env.TWILIO_WHATSAPP_FROM,
      Body: body,
      NumMedia: "0",
    });
    return db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid)!;
  }
  const job = receive();
  db.run("UPDATE twilio_jobs SET state='sent'");
  const configure = (extra: any = {}) =>
    a.companion.routines.configure(job.identity, {
      consent: true,
      topics: ["news"],
      slots: [{ kind: "morning", at: "08:00" }],
      ...extra,
    });
  return {
    db,
    a,
    job,
    calls,
    receive,
    configure,
    time: (v: string) => (now = Date.parse(v)),
    fail: () => (fail = true),
    delay: (p: Promise<void>) => (wait = p),
    close: () => db.close(),
  };
}

test("routines require consent and themes; slot changes replace only that user's morning/evening plan", () => {
  const f = fixture();
  try {
    assert.throws(() => f.configure({ consent: false }), /accord/);
    assert.throws(() => f.configure({ topics: [] }), /themes/);
    assert.throws(
      () => f.configure({ slots: [{ kind: "morning", at: "03:00" }] }),
      /silence/,
    );
    const other = f.receive(2, "Bonjour", "whatsapp:+33600000002");
    f.a.companion.routines.configure(other.identity, {
      consent: true,
      topics: ["cinema"],
      slots: [{ kind: "evening", at: "20:00" }],
    });
    f.configure({
      slots: [
        { kind: "morning", at: "08:00", topics: ["news"] },
        { kind: "evening", at: "20:00", topics: ["cinema"] },
      ],
    });
    f.configure({
      slots: [{ kind: "evening", at: "19:00", topics: ["exchange"] }],
    });
    assert.equal(f.a.companion.tasks(f.job.identity).length, 1);
    assert.equal(f.a.companion.tasks(other.identity)[0].at, "20:00");
    assert.ok(
      !f.db
        .get(
          "SELECT data FROM nanba_tasks WHERE state='active' AND identity=?",
          f.job.identity,
        )!
        .data.includes("exchange"),
    );
  } finally {
    f.close();
  }
});
test("morning and evening have distinct interests, delivered once, source attribution and follow-up context", async () => {
  const f = fixture();
  try {
    f.configure({
      slots: [
        { kind: "morning", at: "08:00", topics: ["news"] },
        { kind: "evening", at: "20:00", topics: ["cinema"] },
      ],
    });
    f.time("2026-11-14T07:00Z");
    await f.a.tick();
    await f.a.tick();
    assert.equal(f.db.get("SELECT count(*) n FROM nanba_routine_runs")!.n, 1);
    assert.match(
      f.a.companion.routines.lastSelection(f.job.identity)!.text,
      /Actualité utile/,
    );
    f.time("2026-11-14T19:00Z");
    await f.a.tick();
    const text = f.a.companion.routines.lastSelection(f.job.identity)!.text;
    assert.match(text, /Bonsoir/);
    assert.match(text, /Film tamoul/);
    assert.match(text, /FR; JustWatch\/TMDB/);
    assert.ok(text.length <= 840);
    assert.equal(f.calls.filter((x) => x.endsWith("/responses")).length, 0);
    assert.equal(f.calls.filter((x) => x.endsWith("/Messages.json")).length, 2);
    assert.match(f.a.companion.context(f.job.identity), /Film tamoul/);
  } finally {
    f.close();
  }
});
test("novelty suppression survives a new service instance and avoids empty or failure notifications", async () => {
  const f = fixture();
  try {
    f.configure();
    f.time("2026-11-14T07:00Z");
    await f.a.tick();
    f.time("2026-11-15T07:00Z");
    const restarted = new Companion(f.a);
    await restarted.schedule();
    assert.equal(
      f.db.get(
        "SELECT outcome FROM nanba_routine_runs ORDER BY created_at DESC LIMIT 1",
      )!.outcome,
      "nothing_new",
    );
    f.fail();
    f.time("2026-11-16T07:00Z");
    await f.a.companion.schedule();
    assert.equal(
      f.db.get(
        "SELECT count(*) n FROM twilio_jobs WHERE schedule_id IS NOT NULL",
      )!.n,
      1,
    );
    assert.equal(f.calls.filter((x) => x.endsWith("/Messages.json")).length, 1);
  } finally {
    f.close();
  }
});
test("PAUSE cancels pending selections, preserves personal reminders, expires and is isolated by number", async () => {
  const f = fixture();
  try {
    f.configure();
    f.time("2026-11-14T07:00Z");
    await f.a.companion.schedule();
    f.db.run(
      "INSERT INTO nanba_tasks VALUES('reminder',?,'reminder',?,?,'active',?)",
      f.job.identity,
      f.a.seal(
        JSON.stringify({
          at: "18:00",
          timezone: "Europe/Paris",
          recurrence: "daily",
          days: [],
          text: "Mon dossier",
        }),
      ),
      Date.parse("2026-11-14T17:00Z"),
      Date.parse("2026-11-14T07:00Z"),
    );
    const r = f.a.companion.routines.command(f.job.identity, "PAUSE 7 JOURS");
    assert.match(r!, /pause/);
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE schedule_id IS NOT NULL")!
        .state,
      "cancelled",
    );
    f.time("2026-11-14T17:00Z");
    await f.a.tick();
    assert.equal(f.calls.filter((x) => x.endsWith("/Messages.json")).length, 1);
    assert.equal(
      f.db.get(
        "SELECT count(*) n FROM nanba_tasks WHERE id='reminder' AND state='active'",
      )!.n,
      1,
    );
    assert.equal(f.a.companion.routines.preferences("another").pausedUntil, 0);
    f.a.companion.routines.command(f.job.identity, "REPRENDRE");
    assert.equal(
      f.a.companion.routines.preferences(f.job.identity).pausedUntil,
      0,
    );
  } finally {
    f.close();
  }
});
test("daily cap, minimum gap, quiet time, inactivity and human support are checked before delivery", async () => {
  const f = fixture();
  try {
    f.configure({
      slots: [
        { kind: "morning", at: "08:00", topics: ["news"] },
        { kind: "evening", at: "20:00", topics: ["cinema"] },
      ],
    });
    f.time("2026-11-14T07:00Z");
    await f.a.tick();
    f.a.companion.routines.command(f.job.identity, "MOINS");
    f.time("2026-11-14T19:00Z");
    await f.a.companion.schedule();
    assert.equal(
      f.db.get(
        "SELECT outcome FROM nanba_routine_runs ORDER BY created_at DESC LIMIT 1",
      )!.outcome,
      "daily_cap",
    );
    f.time("2026-11-15T22:00Z");
    assert.equal(
      f.a.companion.routines.reason(f.job.identity, "Europe/Paris"),
      "quiet_hours",
    );
    f.time("2026-12-01T07:00Z");
    assert.equal(
      f.a.companion.routines.reason(f.job.identity, "Europe/Paris"),
      "inactive",
    );
    assert.ok(quiet("23:00"));
    assert.ok(quiet("06:59"));
    assert.ok(!quiet("07:00"));
    assert.ok(!quiet("21:59"));
    assert.ok(quiet("14:00", "12:00", "15:00"));
  } finally {
    f.close();
  }
});
test("pending Meta approval cannot release a stale morning digest in the afternoon", async () => {
  const f = fixture();
  try {
    f.configure();
    f.db.run(
      "UPDATE twilio_contacts SET last_at=?",
      Date.parse("2026-11-12T00:00Z"),
    );
    f.time("2026-11-14T07:00Z");
    await f.a.tick();
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE schedule_id IS NOT NULL")!
        .state,
      "waiting_template",
    );
    f.time("2026-11-14T10:01Z");
    f.db.run(
      "INSERT INTO nanba_templates VALUES('digest',?,'approved')",
      "HX" + "a".repeat(32),
    );
    f.a.companion.templatesChecked = Date.parse("2026-11-14T10:01Z");
    await f.a.tick();
    assert.equal(f.calls.filter((x) => x.endsWith("/Messages.json")).length, 0);
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE schedule_id IS NOT NULL")!
        .state,
      "cancelled",
    );
  } finally {
    f.close();
  }
});
test("forget while API content is being retrieved cannot recreate tasks, profile or notifications", async () => {
  const f = fixture();
  try {
    let release!: () => void;
    f.delay(new Promise<void>((resolve) => (release = resolve)));
    f.configure();
    f.time("2026-11-14T07:00Z");
    const work = f.a.companion.schedule();
    await new Promise((resolve) => setImmediate(resolve));
    f.a.companion.stop(f.job.identity, true);
    release();
    await work;
    assert.equal(f.db.get("SELECT count(*) n FROM nanba_routine_runs")!.n, 0);
    assert.equal(
      f.db.get("SELECT count(*) n FROM nanba_routine_preferences")!.n,
      0,
    );
    assert.equal(
      f.db.get(
        "SELECT count(*) n FROM twilio_jobs WHERE schedule_id IS NOT NULL",
      )!.n,
      0,
    );
  } finally {
    f.close();
  }
});
test("catalog normalizes actual API contracts, shares cache and never refreshes paid travel search", async () => {
  const f = fixture();
  try {
    const catalog = f.a.companion.services;
    const [one, two] = await Promise.all([
      catalog.read(f.job.identity, {
        service: "cinema",
        industry: "kollywood",
      }),
      catalog.read("another", { service: "cinema", industry: "kollywood" }),
    ]);
    assert.equal(one.items.length, 1);
    assert.equal(two.country, "FR");
    assert.equal(f.calls.filter((x) => x.includes("cinema")).length, 1);
    assert.match(f.calls[0], /country=FR/);
    const exchange = await catalog.read(f.job.identity, {
      service: "exchange",
    });
    assert.equal(exchange.items.length, 1);
    assert.ok(!JSON.stringify(exchange).includes("10000"));
    await catalog.read(f.job.identity, {
      service: "travel",
      destination: "MAA&refresh=true",
    });
    assert.ok(f.calls.every((x) => !x.includes("refresh=")));
    const training = await catalog.read(f.job.identity, {
      service: "training",
      careerKey: "cook",
    });
    assert.equal(training.items[0].title, "CAP cuisine");
    const kids = await catalog.read(f.job.identity, {
      service: "kids",
      grade: "ce2",
    });
    assert.match(kids.message, /aucun score/);
    await assert.rejects(
      catalog.read(f.job.identity, { service: "https://evil.test" }),
      /service_inconnu/,
    );
  } finally {
    f.close();
  }
});
test("routine preview never subscribes and interactive messages take precedence over due batches", async () => {
  const f = fixture();
  try {
    const preview = await f.a.companion.routines.compose(
      f.job.identity,
      "morning",
      { topics: ["news"] },
      true,
    );
    assert.match(preview.text, /Actualité/);
    assert.equal(f.db.get("SELECT count(*) n FROM nanba_tasks")!.n, 0);
    f.configure();
    f.time("2026-11-14T07:00Z");
    f.receive(2, "MON PROGRAMME");
    await f.a.tick();
    assert.equal(f.db.get("SELECT count(*) n FROM nanba_routine_runs")!.n, 0);
    assert.equal(f.calls.filter((x) => x.endsWith("/responses")).length, 0);
    await f.a.tick();
    assert.equal(f.db.get("SELECT count(*) n FROM nanba_routine_runs")!.n, 1);
  } finally {
    f.close();
  }
});
test("failed API access creates observable health without leaking raw errors or messaging members", async () => {
  const f = fixture();
  try {
    f.fail();
    f.configure();
    f.time("2026-11-14T07:00Z");
    await f.a.tick();
    assert.equal(
      f.db.get("SELECT status FROM nanba_api_health")!.status,
      "unavailable",
    );
    assert.equal(f.calls.filter((x) => x.endsWith("/Messages.json")).length, 0);
  } finally {
    f.close();
  }
});

test("partial Meta approval stays explicit and the delivery layer cannot omit the subscription notice", async () => {
  const f = fixture();
  try {
    f.db.run(
      "INSERT INTO nanba_templates VALUES('image',?,'approved')",
      "HX" + "a".repeat(32),
    );
    const result = f.configure({ topics: ["image", "news"] });
    assert.match(result.outside24h, /attente/);
    const job = f.receive(2, "Programme matin et soir");
    f.db.run(
      "INSERT INTO nanba_actions VALUES(?,?,?)",
      job.sid,
      "test-action",
      f.a.seal(JSON.stringify(result)),
    );
    assert.match(f.a.companion.routines.subscriptionNotice(job), /Meta/);
    assert.equal(
      f.a.companion.routines.subscriptionNotice({
        ...job,
        template_kind: "digest",
      }),
      "",
    );
    f.db.run(
      "INSERT INTO nanba_templates VALUES('digest',?,'approved')",
      "HX" + "b".repeat(32),
    );
    assert.match(
      f.configure({ topics: ["image", "news"] }).outside24h,
      /approuvés/,
    );
  } finally {
    f.close();
  }
});

test("legacy watch history suppresses already seen listings after upgrade", async () => {
  const f = fixture();
  try {
    const result = await f.a.companion.routines.compose(
      f.job.identity,
      "watch",
      { target: "housing", city: "Paris", seen: ["h1"] },
    );
    assert.equal(result.text, "");
  } finally {
    f.close();
  }
});
