import { test } from "node:test";
import assert from "node:assert/strict";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
import { onboardingTemplate } from "../src/nanba-onboarding.ts";
import { buttonKinds } from "../src/nanba-onboarding-buttons.ts";
import { getExpectedTwilioSignature } from "twilio/lib/webhooks/webhooks.js";
const sid = (n: number) => "SM" + n.toString(16).padStart(32, "0");
function fixture() {
  const db = new DB(":memory:");
  let clock = Date.parse("2026-11-15T12:00:00Z"),
    seq = 0,
    sends = 0;
  const sent: URLSearchParams[] = [],
    requests: Row[] = [];
  const env = {
    IDENTITY_ENCRYPTION_KEY: "b".repeat(64),
    TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
    TWILIO_AUTH_TOKEN: "test-token-long-enough",
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
    OPENAI_API_KEY: "test-key",
    TWILIO_AI_ENABLED: "true",
  };
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/Messages.json")) {
      sent.push(new URLSearchParams(String(init?.body)));
      return Response.json({ sid: sid(1000 + ++sends) });
    }
    if (String(url).endsWith("/responses"))
      return Response.json({
        output: [
          {
            type: "message",
            role: "assistant",
            content: [
              { type: "output_text", text: "Je réponds à ta question." },
            ],
          },
        ],
      });
    throw Error("Unexpected request " + url);
  };
  const a = new TwilioAssistant(
    db,
    "https://nanba.example.invalid",
    env,
    fetcher,
    () => clock,
  );
  const form = (
    text: string,
    phone = "whatsapp:+33600000001",
    extra: Row = {},
  ): Record<string, string> => ({
    AccountSid: env.TWILIO_ACCOUNT_SID,
    MessageSid: sid(++seq),
    From: phone,
    To: env.TWILIO_WHATSAPP_FROM,
    Body: text,
    NumMedia: "0",
    ...extra,
  });
  const send = async (
    text: string,
    phone?: string,
    extra: Row = {},
  ): Promise<Row> => {
    const f = form(text, phone, extra);
    a.receive(f);
    await a.tick();
    const j = db.get("SELECT * FROM twilio_jobs WHERE sid=?", f.MessageSid)!;
    return { ...j, text: j.output ? a.unseal(j.output) : "", form: f };
  };
  return {
    db,
    a,
    env,
    sent,
    requests,
    send,
    form,
    advance: (n: number) => (clock += n),
  };
}
type Row = Record<string, any>;
function enableButtons(f: ReturnType<typeof fixture>) {
  let n = 20;
  for (const locale of ["fr", "en", "ta"])
    for (const kind of buttonKinds)
      f.db.run(
        "INSERT INTO nanba_onboarding_templates VALUES(?,?,?,'in_session',NULL)",
        kind,
        locale,
        "HX" + (++n).toString(16).padStart(32, "0"),
      );
}
async function tapChoice(
  f: ReturnType<typeof fixture>,
  identity: string,
  op: string,
  value?: string,
) {
  const c = f.a.onboarding.state(identity)!.controls;
  assert.ok(c, "question offers native choices");
  const i = c.options.findIndex(
    (o: Row) => o.op === op && (value === undefined || o.value === value),
  );
  assert.ok(i >= 0, `missing choice ${op}:${value}`);
  const form = f.sent.at(-1)!;
  assert.ok(form.get("ContentSid"));
  const variables = JSON.parse(form.get("ContentVariables")!);
  const token = variables[String(3 + i * 2)];
  assert.equal(token, `nbq:${c.nonce}:${i}`);
  // Both quick-reply payload and list-row ID returned as Body are accepted.
  return c.options.length === 3
    ? f.send("untrusted title", undefined, { ButtonPayload: token })
    : f.send(token);
}

test("tappable questionnaire handles single and multiple choices and saves only the exact confirmed review", async () => {
  const f = fixture();
  try {
    enableButtons(f);
    const j = await f.send("PERSONNALISER");
    await tapChoice(f, j.identity, "select", "fr");
    await tapChoice(f, j.identity, "select", "audio");
    await tapChoice(f, j.identity, "toggle", "housing");
    await tapChoice(f, j.identity, "toggle", "jobs");
    await tapChoice(f, j.identity, "toggle", "housing");
    await tapChoice(f, j.identity, "done");
    await tapChoice(f, j.identity, "skip");
    await tapChoice(f, j.identity, "select", "direct");
    await tapChoice(f, j.identity, "select", "short");
    const review = await tapChoice(f, j.identity, "select", "none");
    assert.match(review.text, /Confirmer/);
    assert.deepEqual(f.a.companion.profile(j.identity), {});
    const oldReview = JSON.parse(f.sent.at(-1)!.get("ContentVariables")!)["3"];
    const confirmed = await tapChoice(f, j.identity, "confirm");
    assert.equal(confirmed.state, "sent");
    assert.deepEqual(f.a.companion.profile(j.identity), {
      language: "fr",
      replyMode: "audio",
      interests: ["jobs"],
      tone: "direct",
      answerLength: "short",
    });
    const replay = await f.send("Confirmer", undefined, {
      ButtonPayload: oldReview,
    });
    assert.match(replay.text, /ancien/);
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
    assert.equal(
      f.requests.filter((r) => r.url.endsWith("/responses")).length,
      0,
    );
  } finally {
    f.db.close();
  }
});
test("daily opt-in can be completed entirely by taps and is not subscribed before confirmation", async () => {
  const f = fixture();
  try {
    enableButtons(f);
    const j = await f.send("PERSONNALISER");
    for (const [op, value] of [
      ["select", "fr"],
      ["select", "text"],
      ["done"],
      ["skip"],
      ["select", "warm"],
      ["select", "short"],
      ["select", "morning"],
      ["toggle", "news"],
      ["done"],
      ["select", "08:30"],
      ["select", "Europe/Paris"],
    ])
      await tapChoice(f, j.identity, op!, value);
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
    await tapChoice(f, j.identity, "confirm");
    const tasks = f.a.companion.tasks(j.identity);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].at, "08:30");
    assert.equal(tasks[0].timezone, "Europe/Paris");
    assert.deepEqual(tasks[0].topics, ["news"]);
  } finally {
    f.db.close();
  }
});
test("old, cross-number, expired and stopped buttons cannot advance or confirm a draft", async () => {
  const f = fixture();
  try {
    enableButtons(f);
    const j = await f.send("PERSONNALISER");
    const oldToken = JSON.parse(f.sent.at(-1)!.get("ContentVariables")!)["3"];
    const other = await f.send(oldToken, "whatsapp:+33600000002");
    assert.match(other.text, /ancien/);
    assert.equal(f.a.onboarding.state(other.identity), null);
    const first = await f.send("language", undefined, { ListId: oldToken });
    assert.match(first.text, /Format/);
    assert.match((await f.send(oldToken)).text, /ancien/);
    assert.equal(f.a.onboarding.context(j.identity)?.currentField, "replyMode");
    const c = f.a.onboarding.state(j.identity)!.controls;
    const next = `nbq:${c.nonce}:0`;
    await f.send("STOP");
    await f.send("START");
    assert.match((await f.send(next)).text, /ancien/);
    await f.send("QUESTIONS ICI");
    const exp = f.a.onboarding.state(j.identity)!.controls;
    f.advance(24 * 3600000);
    assert.match((await f.send(`nbq:${exp.nonce}:0`)).text, /ancien/);
    assert.deepEqual(f.a.companion.profile(j.identity), {});
  } finally {
    f.db.close();
  }
});
test("all interactive templates respect channel counts and labels and are never submitted for approval", () => {
  for (const locale of ["fr", "en", "ta"])
    for (const kind of buttonKinds) {
      const t = onboardingTemplate(locale, kind) as Row;
      const quick = t.types["twilio/quick-reply"],
        list = t.types["twilio/list-picker"];
      assert.ok(quick ? quick.actions.length === 3 : list.items.length <= 10);
      assert.ok(!JSON.stringify(t).includes("birth"));
      if (list)
        for (const item of list.items) assert.ok(item.description.length <= 72);
    }
});

test("welcome is optional, button payload is routed and no AI call is charged", async () => {
  const f = fixture();
  try {
    const j = await f.send("Bonjour");
    assert.match(j.text, /PERSONNALISER/);
    assert.equal(
      f.requests.filter((x) => x.url.endsWith("/responses")).length,
      0,
    );
    const q = await f.send("untrusted button label", undefined, {
      ButtonPayload: "nanba:onboarding:chat",
    });
    assert.match(q.text, /1\/7/);
    assert.deepEqual(f.a.companion.profile(j.identity), {});
    assert.match((await f.send("PLUS TARD")).text, /mis de côté/);
    assert.match((await f.send("Explique-moi Nanba")).text, /réponds/);
    assert.match((await f.send("QUESTIONS ICI")).text, /1\/7/);
  } finally {
    f.db.close();
  }
});
test("draft is encrypted, survives re-open, is isolated, and commits only after written confirmation", async () => {
  const f = fixture();
  try {
    const first = await f.send("QUESTIONS ICI");
    await f.send("2");
    await f.send("1");
    await f.send("1, 2");
    await f.send("Sevran");
    await f.send("2");
    await f.send("1");
    const review = await f.send("1");
    assert.match(review.text, /CONFIRM/);
    assert.deepEqual(f.a.companion.profile(first.identity), {});
    assert.ok(
      !JSON.stringify(f.db.all("SELECT * FROM nanba_onboarding")).includes(
        "Sevran",
      ),
    );
    const other = await f.send("CONFIRM", "whatsapp:+33600000002");
    assert.match(other.text, /Aucun questionnaire/);
    assert.deepEqual(f.a.companion.profile(other.identity), {});
    const reopened = new TwilioAssistant(
      f.db,
      f.a.origin,
      f.env,
      f.a.fetcher,
      f.a.now,
    );
    assert.equal(reopened.onboarding.state(first.identity)?.mode, "review");
    const result = await f.send("CONFIRM");
    assert.match(result.text, /Preferences saved/);
    assert.deepEqual(f.a.companion.profile(first.identity), {
      language: "en",
      replyMode: "text",
      interests: ["housing", "jobs"],
      city: "Sevran",
      tone: "direct",
      answerLength: "short",
    });
    assert.equal(f.a.companion.tasks(first.identity).length, 0);
    f.a.receive(result.form);
    await f.a.tick();
    assert.equal(
      f.db.get("SELECT count(*) n FROM twilio_jobs WHERE sid=?", result.sid)?.n,
      1,
    );
  } finally {
    f.db.close();
  }
});
test("first concrete request is answered, invitation is once, controls do not swallow normal help", async () => {
  const f = fixture();
  try {
    assert.match(
      (await f.send("Aide-moi à écrire une lettre")).text,
      /réponds[\s\S]*PERSONNALISER/,
    );
    assert.doesNotMatch(
      (await f.send("Une autre question")).text,
      /PERSONNALISER/,
    );
    await f.send("QUESTIONS ICI");
    await f.send("PASSER");
    await f.send("PASSER");
    await f.send("PASSER");
    const j = await f.send("Aide-moi à trouver un logement");
    assert.match(j.text, /réponds/);
    assert.equal(f.a.onboarding.context(j.identity)?.currentField, "city");
  } finally {
    f.db.close();
  }
});
test("schedule requires specific time, topics and confirmation; unrelated reminders survive no-selection", async () => {
  const f = fixture();
  try {
    const first = await f.send("QUESTIONS ICI");
    for (let i = 0; i < 6; i++) await f.send("PASSER");
    await f.send("2");
    await f.send("1, 5");
    await f.send("08:30");
    const review = await f.send("France");
    assert.match(review.text, /Europe\/Paris/);
    assert.equal(f.a.companion.tasks(first.identity).length, 0);
    f.advance(61000);
    const done = await f.send("CONFIRMER");
    assert.match(done.text, /enregistrées/);
    assert.equal(f.a.companion.tasks(first.identity).length, 1);
    const task = f.a.companion.tasks(first.identity)[0];
    assert.deepEqual(task.topics, ["news", "image"]);
    assert.equal(task.at, "08:30");
    f.db.run(
      "INSERT INTO nanba_tasks(id,identity,kind,data,next_at,created_at) VALUES(?,?,?,?,?,?)",
      "personal",
      first.identity,
      "reminder",
      f.a.seal(JSON.stringify({ text: "Mon rappel" })),
      f.a.now() + 86400000,
      f.a.now(),
    );
    await f.send("QUESTIONS ICI");
    for (let i = 0; i < 6; i++) await f.send("PASSER");
    await f.send("1");
    f.advance(61000);
    await f.send("CONFIRMER");
    assert.deepEqual(
      f.a.companion.tasks(first.identity).map((x) => x.kind),
      ["reminder"],
    );
  } finally {
    f.db.close();
  }
});
test("invalid schedule rolls back profile and asks for correction", async () => {
  const f = fixture();
  try {
    const j = await f.send("QUESTIONS ICI");
    await f.send("2");
    for (let i = 0; i < 5; i++) await f.send("PASSER");
    await f.send("2");
    await f.send("1");
    await f.send("23:30");
    await f.send("France");
    const r = await f.send("CONFIRM");
    assert.match(r.text, /HH:MM/);
    assert.deepEqual(f.a.companion.profile(j.identity), {});
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
  } finally {
    f.db.close();
  }
});
test("native form is verified, bounded and draft-only; stale replays cannot subscribe", async () => {
  const f = fixture();
  try {
    f.db.run(
      "INSERT INTO nanba_onboarding_templates VALUES('flow','fr',?,'approved',NULL)",
      "HX" + "a".repeat(32),
    );
    const j = await f.send("FORMULAIRE");
    assert.equal(f.sent.at(-1)?.get("ContentSid"), "HX" + "a".repeat(32));
    const params = f.form("", undefined, {
      InteractiveData: JSON.stringify({
        language: "ta",
        replyMode: "text",
        city: "Paris",
        notifications: "none",
        identity: "other-user",
        admin: true,
      }),
    });
    const raw = Buffer.from(new URLSearchParams(params).toString());
    const sig = getExpectedTwilioSignature(
      f.env.TWILIO_AUTH_TOKEN,
      f.a.origin + "/api/webhooks/twilio",
      params,
    );
    f.a.receive(f.a.parseAndVerify(raw, sig, "/api/webhooks/twilio"));
    await f.a.tick();
    assert.deepEqual(f.a.companion.profile(j.identity), {});
    assert.match(
      f.a.onboarding.review(j.identity, f.a.onboarding.state(j.identity)!),
      /CONFIRM/,
    );
    await f.send("CONFIRM");
    assert.deepEqual(f.a.companion.profile(j.identity), {
      language: "ta",
      replyMode: "text",
      city: "Paris",
    });
    const replay = await f.send("", undefined, {
      InteractiveData: params.InteractiveData,
    });
    assert.match(replay.text, /பழையது/);
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
  } finally {
    f.db.close();
  }
});
test("STOP invalidates form, START never subscribes, OUBLIE erases drafts and payloads", async () => {
  const f = fixture();
  try {
    const j = await f.send("QUESTIONS ICI");
    await f.send("1");
    await f.send("STOP");
    assert.equal(f.a.onboarding.state(j.identity)?.mode, "paused");
    assert.equal((await f.send("2")).state, "ignored");
    await f.send("START");
    assert.equal(f.a.companion.tasks(j.identity).length, 0);
    await f.send("OUBLIE");
    assert.equal(f.a.onboarding.state(j.identity), null);
    assert.deepEqual(f.a.companion.profile(j.identity), {});
  } finally {
    f.db.close();
  }
});
test("unrecognised or expired flow payload never reaches AI or mutates profile", async () => {
  const f = fixture();
  try {
    const j = await f.send("", undefined, {
      InteractiveData: '{"city":"Paris"}',
    });
    assert.match(j.text, /ancien/);
    assert.equal(
      f.requests.filter((x) => x.url.endsWith("/responses")).length,
      0,
    );
    assert.deepEqual(f.a.companion.profile(j.identity), {});
    assert.throws(
      () =>
        f.a.receive(
          f.form("", undefined, { InteractiveData: "a".repeat(12001) }),
        ),
      /flow_too_large/,
    );
    await f.send("QUESTIONS ICI");
    f.advance(8 * 86400000);
    assert.equal(f.a.onboarding.state(j.identity), null);
  } finally {
    f.db.close();
  }
});
test("AI answer tool follows the current step, rejects invented fields and cannot confirm", async () => {
  const f = fixture();
  try {
    const j = await f.send("QUESTIONS ICI");
    const job = { ...j, sid: sid(900) };
    f.db.run(
      "INSERT INTO twilio_jobs(sid,identity,input,state,epoch,created_at,updated_at) VALUES(?,?,?,'generating',?,?,?)",
      job.sid,
      j.identity,
      f.a.seal("English please"),
      0,
      f.a.now(),
      f.a.now(),
    );
    assert.throws(
      () =>
        f.a.onboarding.action(job, {
          action: "onboarding_answer",
          onboardingField: "city",
          onboardingValue: "Paris",
        }),
      /question_changed/,
    );
    assert.match(
      f.a.onboarding.action(job, {
        action: "onboarding_answer",
        onboardingField: "language",
        onboardingValue: "en",
      }).message,
      /reply format/,
    );
    assert.throws(
      () =>
        f.a.onboarding.action(job, {
          action: "onboarding_answer",
          onboardingField: "replyMode",
          onboardingValue: "admin",
        }),
      /invalid_choice/,
    );
  } finally {
    f.db.close();
  }
});
test("Twilio content provisioning creates three locale forms, preserves pending status and never sends messages", async () => {
  const f = fixture();
  try {
    f.a.env.NANBA_ONBOARDING_PROVISION = "true";
    let n = 0;
    const posted: Row[] = [];
    f.a.fetcher = async (url, init) => {
      assert.ok(String(url).startsWith("https://content.twilio.com/"));
      if (String(url).endsWith("/ApprovalRequests/whatsapp")) {
        assert.equal(JSON.parse(String(init?.body)).category, "MARKETING");
        return Response.json({ status: "pending" });
      }
      if (String(url).endsWith("/ApprovalRequests"))
        return Response.json({ whatsapp: { status: "pending" } });
      const body = JSON.parse(String(init?.body));
      posted.push(body);
      return Response.json({
        sid: "HX" + (++n).toString(16).padStart(32, "0"),
      });
    };
    await f.a.onboarding.syncTemplates();
    await f.a.onboarding.syncTemplates();
    assert.equal(posted.length, 18);
    assert.equal(
      f.a.onboarding.status().templates.filter((x) => x.status === "pending")
        .length,
      3,
    );
    for (const locale of ["fr", "en", "ta"]) {
      const t = onboardingTemplate(locale, "flow") as Row;
      assert.equal(t.types["twilio/flows"].pages.length, 3);
      assert.ok(!JSON.stringify(t).includes("birthDate"));
      assert.ok(t.types["twilio/flows"].subtitle.length <= 60);
      for (const page of t.types["twilio/flows"].pages) {
        assert.ok(page.title.length <= 30);
        for (const field of page.layout) {
          assert.ok(
            !field.text || field.text.length <= 60,
            `${locale} helper: ${field.text}`,
          );
          assert.ok(
            !field.label || field.label.length <= 20,
            `${locale} label: ${field.label}`,
          );
        }
      }
    }
    assert.equal(f.sent.length, 0);
  } finally {
    f.db.close();
  }
});

test("voice answers can advance a question but cannot apply a confirmation", async () => {
  const f = fixture();
  try {
    const j = await f.send("QUESTIONS ICI");
    assert.match(
      f.a.onboarding.command(
        { ...j, inbound_audio: 1 },
        "Transcription du vocal 1 :\nEnglish",
      )!,
      /reply format/,
    );
    const state = f.a.onboarding.state(j.identity)!;
    state.mode = "review";
    f.a.onboarding.save(j.identity, state);
    assert.match(
      f.a.onboarding.command(
        { ...j, inbound_audio: 1 },
        "Transcription du vocal 1 :\nCONFIRM",
      )!,
      /Write CONFIRM/,
    );
    assert.deepEqual(f.a.companion.profile(j.identity), {});
  } finally {
    f.db.close();
  }
});
test("schema correction retries known rejected creates once, preserves uncertain creates and keeps diagnostics private", async () => {
  const f = fixture();
  try {
    f.a.env.NANBA_ONBOARDING_PROVISION = "true";
    f.db.run(
      "INSERT INTO nanba_onboarding_templates VALUES('flow','fr',NULL,'rejected','v2_http_400_code_21658|subtitle cannot exceed 60 characters')",
    );
    f.db.run(
      "INSERT INTO nanba_onboarding_templates VALUES('flow','en',NULL,'uncertain','create_response_unknown')",
    );
    let frenchCreates = 0,
      englishCreates = 0;
    f.a.fetcher = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.types["twilio/flows"]) {
        if (body.language === "fr") frenchCreates++;
        if (body.language === "en") englishCreates++;
        assert.ok(JSON.stringify(body).includes("MULTIPLE_SELECT"));
      }
      return Response.json(
        { code: 1005, message: "Invalid field in AC" + "a".repeat(32) },
        { status: 400 },
      );
    };
    await f.a.onboarding.syncTemplates();
    await f.a.onboarding.syncTemplates();
    assert.equal(frenchCreates, 1);
    assert.equal(englishCreates, 0);
    assert.ok(
      !JSON.stringify(f.a.onboarding.status()).includes("Invalid field"),
    );
    const diagnostics = JSON.stringify(f.a.onboarding.status(true));
    assert.ok(diagnostics.includes("Invalid field"));
    assert.ok(!diagnostics.includes("a".repeat(32)));
    assert.equal(f.sent.length, 0);
  } finally {
    f.db.close();
  }
});
test("normal questionnaire with welcome fits rate limit and native approval failures leave chat available", async () => {
  const f = fixture();
  try {
    await f.send("Bonjour");
    const j = await f.send("PERSONNALISER");
    for (let i = 0; i < 6; i++) await f.send("PASSER");
    await f.send("2");
    await f.send("1");
    await f.send("08:30");
    await f.send("France");
    const done = await f.send("CONFIRMER");
    assert.equal(done.state, "sent");
    assert.equal(f.a.companion.tasks(j.identity).length, 1);
    f.a.env.NANBA_ONBOARDING_PROVISION = "true";
    f.a.fetcher = async () => Response.json({ code: 12345 }, { status: 400 });
    await f.a.onboarding.syncTemplates();
    assert.equal(f.a.onboarding.status().templates.length, 18);
    assert.ok(
      f.a.onboarding.status().templates.every((x) => x.status === "rejected"),
    );
  } finally {
    f.db.close();
  }
});
