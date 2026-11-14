import { test } from "node:test";
import assert from "node:assert/strict";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
import { createLetter, pcmToMp3, requestsVoice } from "../src/nanba-files.ts";
import { PDFDocument } from "pdf-lib";
const sid = (n: number) => "SM" + n.toString(16).padStart(32, "0");
function fixture() {
  const db = new DB(":memory:");
  let now = Date.parse("2026-11-13T20:00:00Z"),
    seq = 0;
  const sent: URLSearchParams[] = [];
  let fail = false,
    aiCalls = 0;
  const a = new TwilioAssistant(
    db,
    "https://nanba.test",
    {
      IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
      TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
      TWILIO_AUTH_TOKEN: "a".repeat(32),
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
      OPENAI_API_KEY: "test",
      TWILIO_AI_ENABLED: "true",
    },
    async (url, init) => {
      if (String(url).endsWith("/Messages.json")) {
        sent.push(new URLSearchParams(init?.body as string));
        return fail
          ? new Response("", { status: 400 })
          : Response.json({ sid: sid(1000 + sent.length), status: "queued" });
      }
      if (String(url).endsWith("/responses")) {
        aiCalls++;
        return Response.json({
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: "Bonjour, comment puis-je aider ?",
                },
              ],
            },
          ],
        });
      }
      throw Error("unexpected_network");
    },
    () => now,
  );
  a.deliverables.speech = async () =>
    Buffer.from([0xff, 0xf3, 0x84, 0, 1, 2, 3, 4]);
  const receive = (body = "Bonjour", phone = "whatsapp:+33600000001") => {
    a.receive({
      MessageSid: sid(++seq),
      From: phone,
      To: a.config().from,
      Body: body,
      NumMedia: "0",
    });
    return db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid(seq))!;
  };
  const active = (body = "Bonjour", phone?: string) => {
    const job = receive(body, phone);
    db.run("UPDATE twilio_jobs SET state='generating' WHERE sid=?", job.sid);
    return job;
  };
  const admin = () => {
    const job = active("ADMIN DEMANDES", "whatsapp:+33600000002");
    db.run(
      "INSERT INTO nanba_support_admins(identity,source) VALUES(?,'private-link')",
      job.identity,
    );
    db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", job.sid);
    return job;
  };
  return {
    a,
    db,
    sent,
    receive,
    active,
    admin,
    setTime: (n: number) => (now = n),
    getTime: () => now,
    setFail: () => (fail = true),
    aiCalls: () => aiCalls,
  };
}

test("PDF French and Tamil shape, paginate, reject empty or truncated oversized content", async () => {
  const ta = await createLetter({
    title: "கடிதம்",
    text: "வணக்கம், உங்கள் உதவிக்கு நன்றி.\nஅன்புடன், அருண்",
  });
  assert.equal((await PDFDocument.load(ta.bytes)).getPageCount(), 1);
  const fr = await createLetter({
    text: "Une lettre avec accents éàè ç, à relire.\n\n".repeat(100),
  });
  assert.ok(fr.pages > 1);
  await assert.rejects(createLetter({ text: "" }));
  await assert.rejects(createLetter({ text: "a".repeat(20001) }));
});
test("MP3 encoder produces binary frames from PCM, bounds length", () => {
  const pcm = Buffer.alloc(48000);
  for (let i = 0; i < 24000; i++)
    pcm.writeInt16LE(Math.round(Math.sin(i * 0.1) * 5000), i * 2);
  const bytes = pcmToMp3(pcm);
  assert.ok(bytes.length > 5000);
  assert.equal(bytes[0], 255);
  assert.throws(() => pcmToMp3(Buffer.alloc(1)));
});
test("explicit audio choice persists, produces audio-only without caption, both adds separate attachment", async () => {
  const { a, db, receive, sent, aiCalls } = fixture();
  const j = receive("MODE AUDIO");
  await a.tick();
  assert.equal(a.companion.profile(j.identity).replyMode, "audio");
  assert.equal(aiCalls(), 0);
  assert.ok(sent[0].get("MediaUrl")?.endsWith(".mp3"));
  assert.equal(sent[0].get("Body"), null);
  receive("MODE LES DEUX");
  await a.tick();
  await a.tick();
  assert.ok(sent[1].get("Body"));
  assert.ok(sent[2].get("MediaUrl"));
  assert.equal(sent[2].get("Body"), null);
  assert.equal(
    db.get("SELECT count(*) n FROM twilio_jobs WHERE parent_sid IS NOT NULL")!
      .n,
    1,
  );
  db.close();
});
test("voice failure falls back to text, auto voice only for inbound audio and stop during generation sends nothing", async () => {
  const { a, db, receive, active, sent } = fixture();
  const j = active();
  await a.companion.action(j, {
    action: "profile_update",
    profile: { replyMode: "auto" },
  });
  db.run("UPDATE twilio_jobs SET state='queued' WHERE sid=?", j.sid);
  await a.tick();
  assert.ok(sent[0].get("Body"));
  const k = receive();
  db.run("UPDATE twilio_jobs SET inbound_audio=1 WHERE sid=?", k.sid);
  a.deliverables.speech = async () => {
    throw Error("test");
  };
  await a.tick();
  assert.match(sent[1].get("Body")!, /vocal est indisponible/);
  receive("MODE AUDIO");
  a.deliverables.speech = async () => {
    receive("STOP");
    return Buffer.from("fake");
  };
  await a.tick();
  assert.equal(sent.length, 2);
  assert.equal(db.get("SELECT count(*) n FROM nanba_files")!.n, 0);
  db.close();
});
test("documents and revisions are owner-scoped; files encrypted, URL expires, forget revokes it", async () => {
  const { a, db, active, receive, setTime, getTime } = fixture();
  const j = active();
  const doc = await a.deliverables.document(j, {
    document: { text: "Courrier confidentiel à relire.", title: "Ma lettre" },
  });
  assert.equal(
    a.deliverables.read(j.identity, doc.reference).document.text,
    "Courrier confidentiel à relire.",
  );
  const other = active("Bonjour", "whatsapp:+33600000003");
  assert.throws(() => a.deliverables.read(other.identity, doc.reference));
  await assert.rejects(
    a.deliverables.document(other, {
      reference: doc.reference,
      document: { text: "Autre" },
    }),
  );
  const f = db.get("SELECT * FROM nanba_files")!;
  assert.ok(!f.bytes.includes("%PDF"));
  const token = a.deliverables.url(doc.reference).split("/").at(-2)!;
  assert.match(
    a.deliverables.download(token).bytes.toString("ascii", 0, 5),
    /%PDF/,
  );
  setTime(getTime() + 73 * 3600000);
  assert.throws(() => a.deliverables.download(token));
  receive("OUBLIE");
  assert.equal(db.get("SELECT count(*) n FROM nanba_files")!.n, 0);
  db.close();
});
test("PDF gets separate message only after successful text; failed parent never delivers attachment", async () => {
  for (const fail of [false, true]) {
    const { a, db, active, sent, setFail } = fixture();
    const j = active();
    await a.deliverables.document(j, {
      document: { text: "Bonjour Madame, Monsieur." },
    });
    db.run(
      "UPDATE twilio_jobs SET output=? WHERE sid=?",
      a.seal("Voici le PDF."),
      j.sid,
    );
    db.run("UPDATE twilio_jobs SET state='ready' WHERE sid=?", j.sid);
    if (fail) setFail();
    await a.tick();
    await a.tick();
    assert.equal(sent.length, fail ? 1 : 2);
    assert.equal(sent[0].get("MediaUrl"), null);
    if (!fail) {
      assert.match(sent[1].get("MediaUrl")!, /\.pdf$/);
      assert.equal(sent[1].get("Body"), null);
    }
    db.close();
  }
});
test("admin linking requires private single-use expiring code, self-claimed role denied", () => {
  const { a, db, active, setTime, getTime } = fixture();
  const j = active("ADMIN DEMANDES");
  assert.match(a.support.command(j, "ADMIN DEMANDES")!, /réservée/);
  const link = a.support.linkCode();
  assert.match(a.support.command(j, link.command)!, /associé/);
  assert.equal(a.support.isAdmin(j.identity), true);
  const other = active("Bonjour", "whatsapp:+33600000003");
  assert.match(a.support.command(other, link.command)!, /invalide/);
  const expired = a.support.linkCode();
  setTime(getTime() + 601000);
  assert.match(a.support.command(other, expired.command)!, /expiré/);
  db.close();
});
test("human handoff shares only selected summary, pauses AI, admin claims/replies, user resumes", async () => {
  const { a, db, admin, active, receive, aiCalls } = fixture();
  const staff = admin(),
    user = active("Je veux parler à un humain");
  const opened = a.support.open(user.identity, {
    text: "SECRET HISTORY",
    shareSummary: false,
  });
  assert.ok(
    !a
      .unseal(db.get("SELECT summary FROM nanba_support_tickets")!.summary)
      .includes("SECRET"),
  );
  db.run("UPDATE twilio_jobs SET state='sent' WHERE sid=?", user.sid);
  assert.match(
    a.support.command(staff, "ADMIN PRENDRE " + opened.reference)!,
    /prise en charge/,
  );
  receive("Voici mon problème");
  for (let i = 0; i < 5; i++) await a.tick();
  assert.equal(aiCalls(), 0);
  assert.match(
    a.support.command(staff, "ADMIN LIRE " + opened.reference)!,
    /Voici mon problème/,
  );
  assert.match(
    a.support.command(
      staff,
      "ADMIN REPONDRE " + opened.reference + " Bonjour, nous pouvons aider.",
    )!,
    /file/,
  );
  assert.match(a.support.resume(user.identity), /nouveau/);
  assert.equal(a.support.active(user.identity), undefined);
  db.close();
});
test("forget revokes tickets, shared image files and queued notifications across admins", async () => {
  const { a, db, admin, active, receive } = fixture();
  admin();
  const j = active();
  const t = a.support.open(j.identity, {});
  await a.support.incoming(j, {
    history: "Voici ma photo",
    content: [
      { type: "input_image", image_url: "data:image/png;base64,iVBORw0KGgo=" },
    ],
  });
  assert.equal(db.get("SELECT count(*) n FROM nanba_files")!.n, 1);
  receive("OUBLIE");
  assert.equal(db.get("SELECT count(*) n FROM nanba_support_tickets")!.n, 0);
  assert.equal(db.get("SELECT count(*) n FROM nanba_files")!.n, 0);
  assert.equal(
    db.get(
      "SELECT count(*) n FROM twilio_jobs WHERE support_ticket=? AND state IN('ready','queued')",
      t.reference,
    )!.n,
    0,
  );
  db.close();
});
test("support does not bootstrap unknown callers, and revoked admins cannot send queued support messages", async () => {
  const { a, db, admin, active } = fixture();
  const j = active();
  assert.equal(a.support.admins().length, 0);
  assert.throws(() => a.support.open(j.identity, {}));
  const staff = admin();
  const t = a.support.open(j.identity, {});
  const queued = db.get(
    "SELECT * FROM twilio_jobs WHERE support_ticket=?",
    t.reference,
  )!;
  db.run(
    "UPDATE nanba_support_admins SET enabled=0 WHERE identity=?",
    staff.identity,
  );
  assert.equal(a.support.allowed(queued), false);
  db.close();
});

test("one-off natural voice requests deliver audio without changing the saved format", async () => {
  const { a, db, receive, sent } = fixture();
  const j = receive("Tu peux m’envoyer un audio en tamoul ?");
  await a.tick();
  assert.equal(
    db.get("SELECT voice_requested FROM twilio_jobs WHERE sid=?", j.sid)!
      .voice_requested,
    1,
  );
  assert.ok(sent[0].get("MediaUrl")?.endsWith(".mp3"));
  assert.equal(sent[0].get("Body"), null);
  assert.equal(a.companion.profile(j.identity).replyMode, undefined);
  receive("Merci, quelle est ta fonction ?");
  await a.tick();
  assert.ok(sent[1].get("Body"));
  assert.equal(sent[1].get("MediaUrl"), null);
  db.close();
});
test("voice format matcher leaves negative, quoted and translation requests alone", () => {
  for (const s of [
    "Envoie-moi un audio",
    "Réponds-moi en vocal",
    "Peux-tu faire un audio ?",
    "Un vocal stp",
    "Please reply with a voice message",
  ])
    assert.equal(requestsVoice(s), true, s);
  for (const s of [
    "Ne réponds pas en audio",
    "Sans vocal merci",
    "Traduis : envoie-moi un audio",
    "Il a écrit « envoie-moi un audio »",
    "Do not reply in audio",
    "Bonjour",
  ])
    assert.equal(requestsVoice(s), false, s);
});
test("scoped voice tool works once, is deduplicated, and refuses cancelled conversations", async () => {
  const { a, db, active, sent } = fixture();
  const j = active("Lis ta réponse à voix haute");
  const args = { action: "reply_audio" };
  await a.companion.action(j, args);
  await a.companion.action(j, args);
  assert.equal(db.get("SELECT count(*) n FROM nanba_actions")!.n, 1);
  db.run(
    "UPDATE twilio_jobs SET state='ready',output=? WHERE sid=?",
    a.seal("Bonjour !"),
    j.sid,
  );
  await a.tick();
  assert.ok(sent[0].get("MediaUrl"));
  db.run("UPDATE twilio_jobs SET state='cancelled' WHERE sid=?", j.sid);
  await assert.rejects(a.companion.action(j, args));
  db.close();
});
