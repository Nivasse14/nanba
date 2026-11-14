import { test } from "node:test";
import assert from "node:assert/strict";
import { getExpectedTwilioSignature } from "twilio/lib/webhooks/webhooks.js";
import { DB } from "../src/db.ts";
import {
  TwilioAssistant,
  DEFAULT_MODEL,
  TWILIO_PATH,
} from "../src/twilio-assistant.ts";
import { createApplication } from "../src/server.ts";
import { hash } from "../src/auth.ts";
import { Script } from "node:vm";
import { twilioAssets } from "../src/twilio-assistant.ts";
import {
  attachmentsFromForm,
  downloadAttachment,
  MEDIA_LIMITS,
  TRANSCRIPTION_MODEL,
} from "../src/twilio-media.ts";

test("setup browser script is valid JavaScript", () => {
  assert.doesNotThrow(() => new Script(twilioAssets["/twilio.js"].body));
});

const account = "AC" + "1".repeat(32),
  auth = "test-auth-token-".repeat(3),
  sender = "whatsapp:+14155550100";
const owner = "whatsapp:+33600000001",
  other = "whatsapp:+33600000002";
const origin = "https://nanba.example.invalid";
const sid = (n: number) => "SM" + n.toString(16).padStart(32, "0");
function fixture() {
  const db = new DB(":memory:");
  let time = Date.parse("2026-11-13T18:00:00Z");
  const calls: { url: string; init?: RequestInit }[] = [];
  const env = {
    IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
    TWILIO_ACCOUNT_SID: account,
    TWILIO_AUTH_TOKEN: auth,
    TWILIO_WHATSAPP_FROM: sender,
    OPENAI_API_KEY: "test-openai-key-".repeat(3),
    TWILIO_AI_ENABLED: "true",
  };
  let sendCount = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/responses"))
      return Response.json({
        output: [
          {
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "Bien sûr, comment puis-je t’aider ?",
              },
            ],
          },
        ],
        usage: { total_tokens: 100 },
      });
    if (String(url).endsWith("/Messages.json"))
      return Response.json(
        { sid: sid(1000 + ++sendCount), status: "queued" },
        { status: 201 },
      );
    if (String(url).includes("/Accounts/"))
      return Response.json({ sid: account, status: "active" });
    return Response.json({ id: DEFAULT_MODEL });
  };
  const assistant = new TwilioAssistant(db, origin, env, fetcher, () => time);
  const form = (n: number, body = "Bonjour", from = owner) => ({
    AccountSid: account,
    MessageSid: sid(n),
    From: from,
    To: sender,
    Body: body,
    NumMedia: "0",
  });
  return {
    db,
    env,
    assistant,
    calls,
    form,
    advance: (ms: number) => (time += ms),
  };
}

test("Twilio SDK signature matches official vector and rejects altered URL, form, account and recipient", () => {
  assert.equal(
    getExpectedTwilioSignature(
      "12345",
      "https://example.com/myapp.php?foo=1&bar=2",
      {
        CallSid: "CA1234567890ABCDE",
        Caller: "+14158675310",
        Digits: "1234",
        From: "+14158675310",
        To: "+18005551212",
      },
    ),
    "L/OH5YylLD5NRKLltdqwSvS0BnU=",
  );
  const f = fixture();
  try {
    const params = f.form(1, " Bonjour & வணக்கம் "),
      raw = Buffer.from(new URLSearchParams(params).toString());
    const signature = getExpectedTwilioSignature(
      auth,
      origin + TWILIO_PATH,
      params,
    );
    assert.equal(
      f.assistant.parseAndVerify(raw, signature, TWILIO_PATH).Body,
      params.Body,
    );
    assert.throws(
      () => f.assistant.parseAndVerify(raw, signature, TWILIO_PATH + "?x=1"),
      /invalid_twilio_signature/,
    );
    assert.throws(
      () =>
        f.assistant.parseAndVerify(
          Buffer.from(
            new URLSearchParams({ ...params, Body: "Changed" }).toString(),
          ),
          signature,
          TWILIO_PATH,
        ),
      /invalid_twilio_signature/,
    );
    assert.throws(
      () =>
        f.assistant.parseAndVerify(
          Buffer.concat([raw, Buffer.from("&Body=again")]),
          signature,
          TWILIO_PATH,
        ),
      /duplicate_form_parameter/,
    );
    const wrong = { ...params, AccountSid: "AC" + "2".repeat(32) };
    assert.throws(
      () =>
        f.assistant.parseAndVerify(
          Buffer.from(new URLSearchParams(wrong).toString()),
          getExpectedTwilioSignature(auth, origin + TWILIO_PATH, wrong),
          TWILIO_PATH,
        ),
      /wrong_twilio_account/,
    );
    assert.throws(
      () => f.assistant.receive({ ...params, To: other }),
      /invalid_whatsapp_route/,
    );
  } finally {
    f.db.close();
  }
});

test("durable webhook acknowledges immediately, deduplicates, then invokes AI and replies only to sender", async () => {
  const f = fixture();
  try {
    assert.match(
      f.assistant.receive(f.form(1, "Aide-moi à écrire un message")),
      /<Response>/,
    );
    f.assistant.receive(f.form(1, "Aide-moi à écrire un message"));
    assert.equal(f.calls.length, 0);
    assert.equal(f.db.get("SELECT COUNT(*) n FROM twilio_jobs")!.n, 1);
    await f.assistant.tick();
    await f.assistant.tick();
    assert.equal(f.calls.length, 2);
    const ai = JSON.parse(f.calls[0].init!.body as string);
    assert.equal(ai.store, false);
    assert.equal(ai.model, DEFAULT_MODEL);
    assert.equal(ai.input.at(-1).content, "Aide-moi à écrire un message");
    assert.doesNotMatch(
      JSON.stringify(ai),
      /33600000001|test-auth-token|test-openai/,
    );
    const reply = new URLSearchParams(f.calls[1].init!.body as URLSearchParams);
    assert.equal(reply.get("To"), owner);
    assert.equal(reply.get("From"), sender);
    assert.ok(reply.get("StatusCallback")!.includes("/status?job=" + sid(1)));
    assert.equal(f.db.get("SELECT state FROM twilio_jobs")!.state, "sent");
    const stored =
      JSON.stringify(f.db.all("SELECT * FROM twilio_jobs")) +
      JSON.stringify(f.db.all("SELECT * FROM twilio_history")) +
      JSON.stringify(f.db.all("SELECT * FROM twilio_contacts"));
    assert.doesNotMatch(stored, /Aide-moi|33600000001|Bien sûr/);
  } finally {
    f.db.close();
  }
});

test("memory is scoped per person and OUBLIE clears it before the next model call", async () => {
  const f = fixture();
  try {
    f.assistant.receive(f.form(1, "J’habite à Sevran."));
    await f.assistant.tick();
    f.assistant.receive(f.form(2, "Dans quelle ville ?"));
    await f.assistant.tick();
    assert.ok(
      JSON.parse(f.calls[2].init!.body as string).input.some((x: any) =>
        x.content.includes("Sevran"),
      ),
    );
    f.assistant.receive(f.form(3, "Bonjour", other));
    await f.assistant.tick();
    assert.equal(JSON.parse(f.calls[4].init!.body as string).input.length, 1);
    f.assistant.receive(f.form(4, "OUBLIE"));
    await f.assistant.tick();
    f.assistant.receive(f.form(5, "Tu sais où je vis ?"));
    await f.assistant.tick();
    const last = f.calls.filter((x) => x.url.endsWith("/responses")).at(-1)!;
    assert.doesNotMatch(
      JSON.stringify(JSON.parse(last.init!.body as string).input),
      /Sevran/,
    );
  } finally {
    f.db.close();
  }
});

test("STOP cancels pending replies, START resumes, unsupported media is handled without fetching it", async () => {
  const f = fixture();
  try {
    f.assistant.receive(f.form(1, "Bonjour"));
    f.assistant.receive(f.form(2, "STOP"));
    await f.assistant.tick();
    assert.equal(f.calls.filter((x) => x.url.endsWith("/responses")).length, 0);
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE sid=?", sid(1))!.state,
      "cancelled",
    );
    f.assistant.receive(f.form(3, "Bonjour encore"));
    await f.assistant.tick();
    assert.equal(f.calls.length, 1);
    f.assistant.receive(f.form(4, "START"));
    await f.assistant.tick();
    f.assistant.receive({
      ...f.form(5, ""),
      NumMedia: "1",
      MediaUrl0: "https://example.invalid/private",
    });
    await f.assistant.tick();
    assert.equal(f.calls.length, 3);
    assert.ok(f.calls.every((x) => x.url.endsWith("/Messages.json")));
  } finally {
    f.db.close();
  }
});

test("reset arriving during generation prevents stale reply and history restoration", async () => {
  const f = fixture();
  try {
    let release!: (r: Response) => void;
    let started!: () => void;
    const generating = new Promise<void>((resolve) => {
      started = resolve;
    });
    f.assistant.fetcher = async () =>
      new Promise((resolve) => {
        release = resolve;
        started();
      });
    f.assistant.receive(f.form(1, "Secret to forget"));
    const processing = f.assistant.tick();
    await generating;
    f.assistant.receive(f.form(2, "OUBLIE"));
    release(
      Response.json({
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Old answer" }],
          },
        ],
      }),
    );
    await processing;
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE sid=?", sid(1))!.state,
      "cancelled",
    );
    assert.equal(f.db.get("SELECT COUNT(*) n FROM twilio_history")!.n, 0);
  } finally {
    f.db.close();
  }
});

test("ambiguous sends never retry, signed delivery can reconcile and never downgrades read", async () => {
  const f = fixture();
  try {
    const fetcher = f.assistant.fetcher;
    f.assistant.fetcher = async (url, init) => {
      if (String(url).endsWith("/Messages.json")) throw Error("network");
      return fetcher(url, init);
    };
    f.assistant.receive(f.form(1));
    await f.assistant.tick();
    assert.equal(f.db.get("SELECT state FROM twilio_jobs")!.state, "uncertain");
    await f.assistant.tick();
    assert.equal(f.calls.length, 1);
    f.assistant.callback(
      { AccountSid: account, MessageSid: sid(1001), MessageStatus: "read" },
      sid(1),
    );
    f.assistant.callback(
      { AccountSid: account, MessageSid: sid(1001), MessageStatus: "queued" },
      sid(1),
    );
    assert.equal(
      f.db.get("SELECT delivery FROM twilio_jobs")!.delivery,
      "read",
    );
    assert.throws(
      () =>
        f.assistant.callback(
          { MessageSid: sid(222), MessageStatus: "delivered" },
          sid(1),
        ),
      /wrong_outbound_message/,
    );
  } finally {
    f.db.close();
  }
});

test("expired reply window, daily limits, unavailable AI and retention remain explicit", async () => {
  const f = fixture();
  try {
    f.assistant.receive(f.form(1));
    f.advance(24 * 3600000);
    await f.assistant.tick();
    assert.equal(f.db.get("SELECT state FROM twilio_jobs")!.state, "expired");
    assert.equal(f.calls.length, 0);
    assert.equal(
      f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
      0,
    );
    const fetcher = f.assistant.fetcher;
    f.assistant.fetcher = async (url, init) =>
      String(url).endsWith("/responses")
        ? new Response("", { status: 503 })
        : fetcher(url, init);
    f.assistant.receive(f.form(2));
    await f.assistant.tick();
    assert.match(
      new URLSearchParams(f.calls.at(-1)!.init!.body as URLSearchParams).get(
        "Body",
      )!,
      /indisponible/,
    );
    const identity = f.db.get(
      "SELECT identity FROM twilio_jobs WHERE sid=?",
      sid(2),
    )!.identity;
    f.db.run("UPDATE twilio_usage SET calls=20 WHERE identity=?", identity);
    f.assistant.receive(f.form(3));
    await f.assistant.tick();
    f.assistant.callback(
      {
        MessageSid: f.db.get(
          "SELECT provider_id FROM twilio_jobs WHERE sid=?",
          sid(3),
        )!.provider_id,
        MessageStatus: "delivered",
      },
      sid(3),
    );
    f.assistant.receive(f.form(4));
    await f.assistant.tick();
    assert.equal(
      f.db.get("SELECT state FROM twilio_jobs WHERE sid=?", sid(4))!.state,
      "ignored",
    );
    f.advance(8 * 86400000);
    f.assistant.cleanup();
    assert.equal(f.db.get("SELECT COUNT(*) n FROM twilio_history")!.n, 0);
    assert.equal(f.db.get("SELECT phone FROM twilio_contacts")!.phone, "");
    for (const row of f.db.all("SELECT input FROM twilio_jobs"))
      assert.equal(f.assistant.unseal(row.input), "");
  } finally {
    f.db.close();
  }
});

test("setup verifies real provider contracts, encrypts keys and exposes only redacted status", async () => {
  const f = fixture();
  try {
    const result = await f.assistant.configure({
      accountSid: account,
      authToken: auth,
      from: sender,
      openaiKey: f.env.OPENAI_API_KEY,
      enabled: true,
      dailyLimit: 30,
    });
    assert.equal(result.ready, true);
    assert.equal(result.dailyLimit, 30);
    assert.doesNotMatch(JSON.stringify(result), /test-auth|test-openai/);
    assert.doesNotMatch(
      f.db.get("SELECT value FROM settings WHERE key='twilio_ai_config_v1'")!
        .value,
      /test-auth|test-openai/,
    );
    assert.equal(f.assistant.config().authToken, auth);
    const before = f.assistant.config();
    f.assistant.fetcher = async () => new Response("", { status: 401 });
    await assert.rejects(
      () => f.assistant.configure({ enabled: true }),
      /twilio_credentials_rejected/,
    );
    assert.deepEqual(f.assistant.config(), before);
  } finally {
    f.db.close();
  }
});

test("HTTP Twilio route accepts signed form before JSON middleware and keeps setup private", async () => {
  const f = fixture();
  const previous = { ...process.env };
  let app: ReturnType<typeof createApplication> | undefined;
  try {
    Object.assign(process.env, f.env, {
      NODE_ENV: "test",
      WHATSAPP_MODE: "simulated",
      PILOT_SETUP_HASH: hash("private-test-key"),
    });
    app = createApplication({
      database: ":memory:",
      production: false,
      origin,
    });
    app.twilio.fetcher = f.assistant.fetcher;
    await new Promise<void>((resolve) =>
      app!.server.listen(0, "127.0.0.1", resolve),
    );
    const port = (app.server.address() as any).port,
      url = "http://127.0.0.1:" + port;
    const params = f.form(1),
      signature = getExpectedTwilioSignature(
        auth,
        origin + TWILIO_PATH,
        params,
      );
    const response = await fetch(url + TWILIO_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signature,
      },
      body: new URLSearchParams(params),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<Response>/);
    assert.equal(f.calls.length, 0);
    assert.equal((await fetch(url + "/api/twilio/setup")).status, 401);
    assert.equal(
      (
        await fetch(url + "/api/twilio/setup", {
          headers: { "X-Nanba-Setup-Key": "wrong" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/api/twilio/setup", {
          headers: { "X-Nanba-Setup-Key": "private-test-key" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(url + "/api/twilio/admin-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
    const linked = await fetch(url + "/api/twilio/admin-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nanba-Setup-Key": "private-test-key",
      },
      body: "{}",
    });
    assert.equal(linked.status, 201);
    assert.match(
      ((await linked.json()) as any).command,
      /^ADMIN ASSOCIER [A-F0-9]{16}$/,
    );
    const file = app.twilio.deliverables.put(
      "test-identity",
      "test-job",
      "document",
      "test.pdf",
      "application/pdf",
      Buffer.from("%PDF-1.7 test"),
    );
    const path = new URL(app.twilio.deliverables.url(file)).pathname;
    const download = await fetch(url + path);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("Content-Type"), "application/pdf");
    assert.match(download.headers.get("Content-Disposition")!, /test.pdf/);
    assert.equal(await download.text(), "%PDF-1.7 test");
    const head = await fetch(url + path, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("Content-Length"), "13");
    assert.equal(await head.text(), "");
    assert.equal(
      (
        await fetch(
          url +
            path.replace(
              /files\/([a-f0-9])/,
              (_, c) => "files/" + (c === "0" ? "1" : "0"),
            ),
        )
      ).status,
      404,
    );
    app.twilio.deliverables.erase("test-identity");
    assert.equal((await fetch(url + path)).status, 404);
    assert.match(
      await (await fetch(url + "/twilio")).text(),
      /Un assistant à qui parler/,
    );
    assert.equal(
      (
        await fetch(url + TWILIO_PATH, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Twilio-Signature": "bad",
          },
          body: new URLSearchParams(params),
        })
      ).status,
      403,
    );
  } finally {
    if (app) {
      await new Promise<void>((r) => app!.server.close(() => r()));
      app.db.close();
    }
    process.env = previous;
    f.db.close();
  }
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  "base64",
);
const ogg = Buffer.from("OggS-test-audio-fixture");
const mediaId = "ME" + "5".repeat(32);
const mediaUrl = (message: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages/${message}/Media/${mediaId}`;
function mediaFixture(mime: string, caption = "") {
  const f = fixture(),
    base = f.assistant.fetcher;
  const form = {
    ...f.form(1, caption),
    NumMedia: "1",
    MediaUrl0: mediaUrl(sid(1)),
    MediaContentType0: mime,
  };
  f.assistant.fetcher = async (url, init) => {
    if (String(url).includes("/Media/")) {
      f.calls.push({ url: String(url), init });
      return new Response(mime.startsWith("image/") ? png : ogg, {
        headers: { "Content-Type": mime },
      });
    }
    if (String(url).endsWith("/audio/transcriptions")) {
      f.calls.push({ url: String(url), init });
      return Response.json({ text: "Peux-tu traduire bonjour en tamoul ?" });
    }
    return base(url, init);
  };
  return { ...f, mediaForm: form };
}

test("signed image is acknowledged before download, encrypted, analyzed with caption, and not retained as bytes", async () => {
  const f = mediaFixture("image/png", "Lis le texte visible");
  try {
    const raw = Buffer.from(new URLSearchParams(f.mediaForm).toString());
    const form = f.assistant.parseAndVerify(
      raw,
      getExpectedTwilioSignature(auth, origin + TWILIO_PATH, f.mediaForm),
      TWILIO_PATH,
    );
    f.assistant.receive(form);
    f.assistant.receive(form);
    assert.equal(f.calls.length, 0);
    assert.doesNotMatch(
      f.db.get("SELECT media FROM twilio_jobs")!.media,
      /api.twilio|image\/png/,
    );
    await f.assistant.tick();
    const request = JSON.parse(
      f.calls.find((x) => x.url.endsWith("/responses"))!.init!.body as string,
    );
    assert.equal(request.input[0].content[0].text, "Lis le texte visible");
    assert.equal(
      request.input[0].content[1].image_url,
      "data:image/png;base64," + png.toString("base64"),
    );
    const download = f.calls[0];
    assert.equal(
      new Headers(download.init!.headers).get("Authorization"),
      "Basic " + Buffer.from(account + ":" + auth).toString("base64"),
    );
    const history = f.db
      .all("SELECT content FROM twilio_history")
      .map((x) => f.assistant.unseal(x.content))
      .join("\n");
    assert.match(history, /Lis le texte visible/);
    assert.doesNotMatch(history, /base64|api.twilio/);
    assert.equal(f.db.get("SELECT media FROM twilio_jobs")!.media, null);
    assert.equal(
      f.calls.filter((x) => x.url.endsWith("/Messages.json")).length,
      1,
    );
  } finally {
    f.db.close();
  }
});

test("OGG voice uses transcription plus conversation, reserves both calls and retains only encrypted transcript", async () => {
  const f = mediaFixture("audio/ogg; codecs=opus");
  try {
    f.assistant.receive(f.mediaForm);
    await f.assistant.tick();
    const request = f.calls.find((x) =>
      x.url.endsWith("/audio/transcriptions"),
    )!;
    const form = request.init!.body as FormData;
    assert.equal(form.get("model"), TRANSCRIPTION_MODEL);
    assert.equal((form.get("file") as File).name, "vocal.ogg");
    assert.equal((form.get("file") as File).type, "audio/ogg");
    assert.equal(new Headers(request.init!.headers).has("Content-Type"), false);
    const responseInput = JSON.parse(
      f.calls.find((x) => x.url.endsWith("/responses"))!.init!.body as string,
    ).input;
    assert.match(
      responseInput[0].content[0].text,
      /traduire bonjour en tamoul/,
    );
    assert.equal(f.db.get("SELECT calls FROM twilio_usage")!.calls, 2);
    assert.doesNotMatch(
      f.db.get("SELECT input FROM twilio_jobs")!.input,
      /traduire/,
    );
    assert.match(
      f.assistant.unseal(f.db.get("SELECT input FROM twilio_jobs")!.input),
      /traduire/,
    );
    f.assistant.receive(f.form(2, "Et en anglais ?"));
    await f.assistant.tick();
    const next = JSON.parse(
      f.calls.filter((x) => x.url.endsWith("/responses")).at(-1)!.init!
        .body as string,
    ).input;
    assert.match(JSON.stringify(next), /traduire bonjour en tamoul/);
    assert.doesNotMatch(JSON.stringify(next), /OggS|api.twilio/);
  } finally {
    f.db.close();
  }
});

test("image without caption gets a useful default and media MessageSid supports MM", async () => {
  const f = mediaFixture("image/png");
  try {
    const mm = "MM" + "a".repeat(32);
    f.assistant.receive({
      ...f.mediaForm,
      MessageSid: mm,
      MediaUrl0: mediaUrl(mm),
    });
    await f.assistant.tick();
    const input = JSON.parse(
      f.calls.find((x) => x.url.endsWith("/responses"))!.init!.body as string,
    ).input;
    assert.match(input[0].content[0].text, /Décris brièvement/);
    assert.equal(f.db.get("SELECT state FROM twilio_jobs")!.state, "sent");
  } finally {
    f.db.close();
  }
});

test("media URL is bound to exact Twilio account/message and never fetches arbitrary URLs", async () => {
  for (const url of [
    "https://127.0.0.1/private",
    "https://api.twilio.com.attacker.invalid/x",
    mediaUrl(sid(2)),
    mediaUrl(sid(1)) + "?secret=x",
    mediaUrl(sid(1)).replace(account, "AC" + "2".repeat(32)),
  ]) {
    const f = mediaFixture("image/png");
    try {
      f.assistant.receive({ ...f.mediaForm, MediaUrl0: url });
      await f.assistant.tick();
      assert.ok(f.calls.every((x) => x.url.endsWith("/Messages.json")));
      assert.match(
        new URLSearchParams(f.calls[0].init!.body as URLSearchParams).get(
          "Body",
        )!,
        /récupérer/,
      );
    } finally {
      f.db.close();
    }
  }
  assert.throws(
    () => attachmentsFromForm({ NumMedia: "5" }, account),
    /media_too_many/,
  );
  assert.throws(
    () => attachmentsFromForm({ NumMedia: "NaN" }, account),
    /media_invalid/,
  );
});

test("authenticated media download strips credentials on trusted CDN redirects and blocks foreign redirects", async () => {
  const a = attachmentsFromForm(
    {
      NumMedia: "1",
      MessageSid: sid(1),
      MediaContentType0: "image/png",
      MediaUrl0: mediaUrl(sid(1)),
    },
    account,
  )[0];
  const seen: RequestInit[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    seen.push(init!);
    return String(url).includes("api.twilio.com")
      ? new Response(null, {
          status: 307,
          headers: {
            location: "https://media.twiliocdn.com/test.png?signature=fixture",
          },
        })
      : new Response(png, { headers: { "Content-Type": "image/png" } });
  };
  assert.deepEqual(
    await downloadAttachment(a, account, sid(1), "Basic PRIVATE", fetcher),
    png,
  );
  assert.equal(
    new Headers(seen[0].headers).get("Authorization"),
    "Basic PRIVATE",
  );
  assert.equal(new Headers(seen[1].headers).has("Authorization"), false);
  for (const location of [
    "http://media.twiliocdn.com/x",
    "https://localhost/x",
    "https://media.twiliocdn.com.attacker.invalid/x",
    "https://user:pass@media.twiliocdn.com/x",
  ]) {
    let calls = 0;
    await assert.rejects(
      downloadAttachment(a, account, sid(1), "Basic PRIVATE", async () => {
        calls++;
        return new Response(null, { status: 302, headers: { location } });
      }),
      /media_invalid/,
    );
    assert.equal(calls, 1);
  }
});

test("media enforces MIME, magic bytes, advertised and streamed size bounds", async () => {
  const a = attachmentsFromForm(
    {
      NumMedia: "1",
      MessageSid: sid(1),
      MediaContentType0: "image/png",
      MediaUrl0: mediaUrl(sid(1)),
    },
    account,
  )[0];
  for (const response of [
    new Response("not a png", { headers: { "Content-Type": "image/png" } }),
    new Response(png, { headers: { "Content-Type": "text/html" } }),
  ])
    await assert.rejects(
      downloadAttachment(
        a,
        account,
        sid(1),
        "Basic test",
        async () => response,
      ),
      /media_invalid/,
    );
  await assert.rejects(
    downloadAttachment(
      a,
      account,
      sid(1),
      "Basic test",
      async () =>
        new Response(png, {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(MEDIA_LIMITS.image + 1),
          },
        }),
    ),
    /media_too_large/,
  );
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MEDIA_LIMITS.image + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    downloadAttachment(
      a,
      account,
      sid(1),
      "Basic test",
      async () =>
        new Response(stream, { headers: { "Content-Type": "image/png" } }),
    ),
    /media_too_large/,
  );
  assert.equal(cancelled, true);
});

test("OUBLIE while downloading audio cancels transcription and reply without restoring cleared data", async () => {
  const f = mediaFixture("audio/ogg"),
    fetcher = f.assistant.fetcher;
  try {
    f.assistant.fetcher = async (url, init) => {
      if (String(url).includes("/Media/"))
        f.assistant.receive(f.form(2, "OUBLIE"));
      return fetcher(url, init);
    };
    f.assistant.receive(f.mediaForm);
    await f.assistant.tick();
    assert.ok(f.calls.every((x) => x.url.includes("/Media/")));
    const job = f.db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid(1))!;
    assert.equal(job.state, "cancelled");
    assert.equal(job.media, null);
    assert.equal(f.assistant.unseal(job.input), "");
    assert.equal(f.db.get("SELECT COUNT(*) n FROM twilio_history")!.n, 0);
  } finally {
    f.db.close();
  }
});

test("audio reserves full AI budget before downloading and transcription failures stay explicit after delivery", async () => {
  const f = mediaFixture("audio/ogg"),
    fetcher = f.assistant.fetcher;
  try {
    f.assistant.receive(f.mediaForm);
    const identity = f.db.get("SELECT identity FROM twilio_jobs")!.identity;
    f.db.run(
      "INSERT INTO twilio_usage(day,identity,calls) VALUES(?,?,?)",
      "2026-11-13",
      identity,
      19,
    );
    await f.assistant.tick();
    assert.equal(f.calls.length, 1);
    assert.ok(f.calls[0].url.endsWith("/Messages.json"));
    f.db.run("DELETE FROM twilio_usage");
    f.assistant.fetcher = async (url, init) =>
      String(url).endsWith("/audio/transcriptions")
        ? new Response("{}", { status: 503 })
        : fetcher(url, init);
    f.assistant.receive({
      ...f.mediaForm,
      MessageSid: sid(2),
      MediaUrl0: mediaUrl(sid(2)),
    });
    await f.assistant.tick();
    assert.equal(f.calls.filter((x) => x.url.endsWith("/responses")).length, 0);
    const job = f.db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid(2))!;
    assert.equal(job.error, "audio_unavailable");
    assert.equal(job.media, null);
    f.assistant.callback(
      { MessageSid: job.provider_id, MessageStatus: "delivered" },
      sid(2),
    );
    assert.equal(
      f.db.get("SELECT error FROM twilio_jobs WHERE sid=?", sid(2))!.error,
      "audio_unavailable",
    );
  } finally {
    f.db.close();
  }
});
