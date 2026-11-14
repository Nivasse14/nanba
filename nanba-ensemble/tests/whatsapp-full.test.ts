import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, admin, member, pro } from "./helpers.ts";
import { preparePrivateChat } from "../src/private-chat.ts";
import { normalizeWaha } from "../src/whatsapp.ts";
import { json, uid, DB } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
import { Worker } from "../src/worker.ts";
import { parisDate } from "../src/conversation-format.ts";

function setup() {
  const f = fixture();
  f.db.run(
    "UPDATE groups SET settings=? WHERE id IN('paris','lyon')",
    json({ assistantEnabled: true }),
  );
  const phones: Record<string, string> = {
    admin: "33600000001@c.us",
    member: "33600000002@c.us",
    member2: "33600000003@c.us",
    member3: "33600000004@c.us",
    organizer: "33600000005@c.us",
    pro: "33600000006@c.us",
    otherpro: "33600000007@c.us",
    outsider: "33600000008@c.us",
  };
  for (const [user, phone] of Object.entries(phones)) {
    const id = f.a.identity("simulated", f.a.session, phone);
    f.db.run(
      "UPDATE identities SET user_id=?,verified_at=? WHERE identity_hash=?",
      user,
      f.now(),
      id,
    );
  }
  const envelope = (user: string, body: string, group = false) => ({
    session: f.a.session,
    event: "message.any",
    me: { id: "33900000000@c.us" },
    payload: {
      id: uid(),
      from: group ? "120363000001@g.us" : phones[user],
      to: "33900000000@c.us",
      participant: group ? phones[user] : undefined,
      fromMe: false,
      source: "app",
      body: "Nanba " + body,
      timestamp: Math.floor(f.now() / 1000),
    },
  });
  const accept = (event: any) => {
    preparePrivateChat(f.a, event);
    const e = normalizeWaha(
      event,
      "simulated",
      f.a.session,
      (chat) => f.db.get("SELECT * FROM groups WHERE chat_id=?", chat),
      (id) => {
        const p = f.db.get("SELECT options FROM polls WHERE message_id=?", id);
        return p ? JSON.parse(p.options) : undefined;
      },
    );
    if (e) f.db.tx(() => f.worker.accept(e));
    return e;
  };
  const say = async (user: string, body: string, group = false) => {
    f.advance(5000);
    const start = f.connector.sent.length;
    accept(envelope(user, body, group));
    await f.worker.tick();
    const msgs = f.connector.sent.slice(start);
    return msgs
      .filter(
        (m) =>
          m.kind === "text" &&
          m.chatId === (group ? "120363000001@g.us" : phones[user]),
      )
      .map((m) => m.text)
      .join("\n");
  };
  const wizard = async (user: string, command: string, answers: string[]) => {
    let reply = await say(user, command);
    assert.doesNotMatch(
      reply,
      /Action non enregistrée|réservée à|doit se faire en privé/,
    );
    for (const answer of answers) {
      reply = await say(user, answer);
      assert.doesNotMatch(
        reply,
        /Action non enregistrée|date précise|Corrige ta réponse/,
      );
    }
    assert.match(reply, /confirmer/);
    return say(user, "confirmer");
  };
  const record = (title: string) => {
    const r = f.db.get(
      "SELECT id FROM records WHERE json_extract(data,'$.title')=?",
      title,
    );
    assert.ok(r, `missing ${title}`);
    return f.a.raw(r.id);
  };
  return Object.assign(f, { phones, envelope, accept, say, wizard, record });
}
const short = (r: any) => r.id.slice(0, 8);

test("WhatsApp complete collective: proposal, group poll, professional offer, terms acceptance and withdrawal", async () => {
  const f = setup();
  try {
    await f.say("member", "proposer Sortie complète");
    for (const s of ["Paris", "20 décembre", "2", "confirmer"])
      await f.say("member", s);
    const r = f.record("Sortie complète");
    await f.say("admin", "sondage " + short(r));
    assert.equal(f.connector.sent.filter((m) => m.kind === "poll").length, 1);
    assert.equal(
      f.connector.sent.find((m) => m.kind === "poll")!.chatId,
      "120363000001@g.us",
    );
    await f.say("member", "intérêt " + short(r));
    assert.equal(f.a.counts(r.id).total, 1);
    assert.match(
      await f.wizard("pro", "offre créer " + short(r), [
        "Offre complète",
        "Visite en groupe",
        "Partenaire",
        "Paris",
        "20/12/2026 14:00",
        "12,50",
        "2",
        "Annulation libre",
        "19/12/2026 12:00",
        "non",
      ]),
      /enregistré/,
    );
    let o = f.record("Offre complète");
    await f.wizard("pro", "offre confirmer " + short(o), []);
    o = f.a.raw(o.id);
    assert.match(
      await f.wizard("member", "inscrire " + short(o), ["1"]),
      /confirmée/,
    );
    assert.equal(
      f.db.get(
        "SELECT accepted_version FROM enrollments WHERE record_id=? AND user_id=?",
        o.id,
        "member",
      )!.accepted_version,
      o.version,
    );
    assert.match(await f.say("member", "voir " + short(o)), /12,50/);
    await f.wizard("member", "quitter " + short(o), []);
    assert.equal(
      f.db.get(
        "SELECT status FROM enrollments WHERE record_id=? AND user_id=?",
        o.id,
        "member",
      )!.status,
      "cancelled",
    );
  } finally {
    f.close();
  }
});

test("WhatsApp meetings: create, matching, waitlist, protected coordination and accepting released seat", async () => {
  const f = setup();
  try {
    await f.wizard("organizer", "rencontre créer", [
      "Café complet",
      "Rencontre amicale",
      "café",
      "Paris",
      "Parc",
      "fr",
      "all",
      "20/12/2026 14:00",
      "2",
      "PORTE SECRÈTE",
    ]);
    const r = f.record("Café complet");
    assert.doesNotMatch(
      await f.say("member", "voir " + short(r)),
      /PORTE SECRÈTE/,
    );
    await f.wizard("member", "inscrire " + short(r), ["2"]);
    assert.match(await f.say("member", "voir " + short(r)), /PORTE SECRÈTE/);
    assert.match(
      await f.wizard("member2", "inscrire " + short(r), ["1"]),
      /liste d’attente/,
    );
    await f.wizard("member", "quitter " + short(r), []);
    assert.match(await f.say("member2", "inscriptions"), /offered/);
    assert.doesNotMatch(
      await f.say("member2", "voir " + short(r)),
      /PORTE SECRÈTE/,
    );
    await f.wizard("member2", "inscrire " + short(r), ["1"]);
    assert.match(await f.say("member2", "voir " + short(r)), /PORTE SECRÈTE/);
    assert.match(
      await f.wizard("member3", "chercher rencontre", [
        "Paris",
        "fr",
        "café",
        "all",
      ]),
      /Café complet/,
    );
  } finally {
    f.close();
  }
});

test("WhatsApp housing: private creation, scoped professional consent, proposal, contact, immediate revocation", async () => {
  const f = setup();
  try {
    assert.match(await f.say("member", "logement créer", true), /en privé/);
    assert.equal(f.db.get("SELECT COUNT(*) n FROM conversations")!.n, 0);
    await f.wizard("member", "logement créer", [
      "Mon studio",
      "Paris",
      "900",
      "20/12/2026",
      "12 mois",
      "CRITÈRE PRIVÉ",
    ]);
    const r = f.record("Mon studio");
    assert.doesNotMatch(await f.say("pro", "logements"), /Mon studio/);
    await f.wizard("member", "logement partager " + short(r), ["atelier"]);
    assert.match(await f.say("pro", "voir " + short(r)), /CRITÈRE PRIVÉ/);
    assert.doesNotMatch(
      await f.say("otherpro", "voir " + short(r)),
      /CRITÈRE PRIVÉ/,
    );
    await f.wizard("pro", "logement proposer " + short(r), [
      "Studio proposé",
      "REF1",
      "https://example.org/logement",
      "Description du studio",
      "850",
      "maintenant",
    ]);
    const o = f.record("Studio proposé");
    await f.wizard("member", "logement contact " + short(o), []);
    assert.equal(f.a.raw(o.id).data.contactRequested, true);
    await f.wizard("member", "logement partager " + short(r), ["passer"]);
    assert.doesNotMatch(await f.say("pro", "voir " + short(o)), /REF1/);
    await f.wizard("member", "logement suspendre " + short(r), []);
    assert.equal(f.a.raw(r.id).status, "suspended");
    assert.equal(
      f.connector.sent.some(
        (m) => m.chatId.endsWith("@g.us") && /CRITÈRE PRIVÉ/.test(m.text ?? ""),
      ),
      false,
    );
  } finally {
    f.close();
  }
});

test("WhatsApp help: volunteer registration, availability, dual acceptance, completion and feedback", async () => {
  const f = setup();
  try {
    await f.wizard("member2", "bénévole créer", [
      "informatique",
      "fr",
      "20",
      "2",
      "20/12/2026 10:00 | 20/12/2026 12:00",
      "oui",
    ]);
    await f.wizard("member", "entraide créer", [
      "Aide informatique",
      "informatique",
      "Installer une appli",
      "fr",
      "20/12/2026 10:00",
      "20",
    ]);
    const r = f.record("Aide informatique");
    await f.wizard("member2", "aider " + short(r), []);
    assert.equal(f.a.raw(r.id).status, "proposed");
    await f.wizard("member", "accepter " + short(r), []);
    assert.equal(f.a.raw(r.id).status, "accepted");
    f.advance(parisDate("20/12/2026 11:00") - f.now());
    await f.wizard("member", "terminer " + short(r), []);
    assert.equal(f.a.raw(r.id).status, "completed");
    await f.wizard("member", "avis " + short(r), ["5", "Merci"]);
    assert.equal(
      f.db.get("SELECT rating FROM feedback WHERE record_id=?", r.id)!.rating,
      5,
    );
  } finally {
    f.close();
  }
});

test("WhatsApp radar: provenance, moderation, expiry, reconfirmation and dispute", async () => {
  const f = setup();
  try {
    await f.wizard("member", "radar signaler", [
      "Produit disponible",
      "Produit observé",
      "product",
      "Épicerie",
      "Paris",
      "maintenant",
      "https://example.org/source",
    ]);
    const r = f.record("Produit disponible");
    assert.equal(r.status, "pending");
    await f.wizard("admin", "radar publier " + short(r), []);
    assert.match(await f.say("member2", "radar liste"), /Produit disponible/);
    f.advance(25 * 3600000);
    assert.doesNotMatch(
      await f.say("member2", "radar liste"),
      /Produit disponible/,
    );
    await f.wizard("admin", "radar confirmer " + short(r), [
      "https://example.org/confirmation",
      "organizer",
      "48",
    ]);
    await f.wizard("member2", "contester " + short(r), ["Stock épuisé"]);
    assert.equal(f.a.raw(r.id).status, "disputed");
  } finally {
    f.close();
  }
});

test("WhatsApp newcomer journey: enrollment, private steps, resources, activity, mentor and persistence", async () => {
  const f = setup();
  try {
    await f.wizard("organizer", "parcours créer", [
      "Arrivée complète",
      "Paris",
      "Décembre",
      "transport;français",
      "Acheter un pass;Trouver un cours",
      "Guide | https://example.org/guide",
      "10",
    ]);
    const r = f.record("Arrivée complète");
    await f.wizard("member", "inscrire " + short(r), ["1"]);
    await f.wizard("member", "étape " + short(r), ["1"]);
    await f.wizard("member", "ressource " + short(r), ["1"]);
    await f.wizard("member", "mentor " + short(r), ["oui", "français"]);
    assert.match(
      await f.say("member", "progression " + short(r)),
      /Acheter un pass/,
    );
    assert.doesNotMatch(
      await f.say("member2", "progression " + short(r)),
      /Étapes terminées : Acheter/,
    );
    const p = JSON.parse(
      f.db.get(
        "SELECT data FROM progress WHERE cohort_id=? AND user_id=?",
        r.id,
        "member",
      )!.data,
    );
    assert.deepEqual(p.completed, ["Acheter un pass"]);
    assert.equal(p.mentor, true);
    const db = new DB(f.path);
    assert.ok(db.get("SELECT data FROM progress WHERE cohort_id=?", r.id));
    db.close();
  } finally {
    f.close();
  }
});

test("WhatsApp challenges: authoring, extra question, teams, secret answers, final results", async () => {
  const f = setup();
  try {
    await f.wizard("admin", "défi créer", [
      "Défi complet",
      "Quiz culturel",
      "Paris;Lyon",
      "20/12/2026 14:00",
      "https://example.org/source",
      "Capitale de la France ?",
      "Paris;Lyon",
      "1",
      "1",
    ]);
    const r = f.record("Défi complet");
    await f.wizard("admin", "défi question " + short(r), [
      "2 + 2 ?",
      "3;4",
      "2",
      "1",
    ]);
    await f.wizard("admin", "défi valider " + short(r), []);
    await f.wizard("member", "défi rejoindre " + short(r), ["Paris", "non"]);
    await f.wizard("member2", "défi rejoindre " + short(r), ["Lyon", "non"]);
    await f.wizard("admin", "défi ouvrir " + short(r), []);
    assert.match(await f.say("member", "défis liste"), /Défi complet/);
    assert.match(
      await f.wizard("member", "défi répondre " + short(r), ["1", "2"]),
      /réponses sont enregistrées/,
    );
    await f.wizard("member2", "défi répondre " + short(r), ["2", "2"]);
    assert.match(
      await f.say("member", "résultats " + short(r)),
      /pas encore clôturé/,
    );
    f.advance(parisDate("20/12/2026 14:01") - f.now());
    await f.wizard("admin", "défi clôturer " + short(r), []);
    assert.match(
      await f.say("member", "résultats " + short(r)),
      /Paris · 2.00/,
    );
  } finally {
    f.close();
  }
});

test("WhatsApp stories: private draft, edited translation, author approval, moderation, sharing and withdrawal", async () => {
  const f = setup();
  try {
    await f.wizard("member", "histoire créer", [
      "Histoire complète",
      "ORIGINAL PRIVÉ",
      "fr",
      "en",
      "PRIVATE TRANSLATION",
      "Auteur",
      "personal",
    ]);
    let r = f.record("Histoire complète");
    assert.doesNotMatch(
      await f.say("admin", "voir " + short(r)),
      /ORIGINAL PRIVÉ/,
    );
    await f.wizard("member", "histoire approuver " + short(r), [
      "oui",
      "oui",
      "2",
      "passer",
    ]);
    assert.match(await f.say("admin", "admin modération"), /Histoire complète/);
    await f.wizard("admin", "histoire publier " + short(r), []);
    assert.match(
      await f.wizard("admin", "histoire partager " + short(r), []),
      /file d’envoi/,
    );
    assert.ok(
      f.connector.sent.some(
        (m) =>
          m.chatId === "120363000001@g.us" &&
          m.text?.includes("ORIGINAL PRIVÉ"),
      ),
    );
    await f.wizard("member", "histoire retirer " + short(r), []);
    assert.equal(f.a.raw(r.id).status, "withdrawn");
    assert.doesNotMatch(
      await f.say("member2", "histoires liste"),
      /Histoire complète/,
    );
  } finally {
    f.close();
  }
});

test("WhatsApp security: no private data in group, source role unchanged, replay safe, stale acceptance rejected", async () => {
  const f = setup();
  try {
    await f.say("member", "aide");
    const privateGroup = f.db.get(
      "SELECT * FROM groups WHERE chat_id=?",
      f.phones.member,
    )!;
    assert.equal(
      f.db.get(
        "SELECT role FROM memberships WHERE user_id='member' AND group_id='paris'",
      )!.role,
      "member",
    );
    assert.match(await f.say("member", "rencontre créer"), /réservée/);
    const r = f.a.list(member, "meetup")[0];
    await f.say("member", "inscrire " + short(r));
    await f.say("member", "1");
    f.a.save({ userId: "organizer", groupId: "paris" }, f.a.raw(r.id), {
      ...r.data,
      capacity: 3,
    });
    assert.match(await f.say("member", "confirmer"), /conditions ont changé/);
    assert.equal(
      f.db.get(
        "SELECT 1 FROM enrollments WHERE user_id='member' AND record_id=?",
        r.id,
      ),
      undefined,
    );
    await f.say("member", "annuler");
    await f.say("member", "profil");
    await f.say("member", "Nouveau nom");
    const e = f.envelope("member", "confirmer");
    f.accept(e);
    f.accept(e);
    await f.worker.tick();
    assert.equal(
      f.db.get("SELECT name FROM users WHERE id='member'")!.name,
      "Nouveau nom",
    );
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM inbox WHERE event_key=?", e.payload.id)!
        .n,
      1,
    );
    f.db.run(
      "UPDATE memberships SET active=0 WHERE user_id='member' AND group_id='paris'",
    );
    const before = f.connector.sent.length;
    await f.say("member", "mes dossiers");
    assert.equal(f.connector.sent.length, before);
    assert.equal(JSON.parse(privateGroup.settings).scopeGroupId, "paris");
  } finally {
    f.close();
  }
});

test("nested transaction rollback preserves outer inbox transaction and Paris date validation rejects invalid or ambiguous hours", () => {
  const f = setup();
  try {
    f.db.tx(() => {
      f.db.run("INSERT INTO settings VALUES('outer-test','yes')");
      assert.throws(() =>
        f.db.tx(() => {
          f.db.run("INSERT INTO settings VALUES('inner-test','yes')");
          throw new Error("rollback");
        }),
      );
    });
    assert.ok(f.db.get("SELECT 1 FROM settings WHERE key='outer-test'"));
    assert.equal(
      f.db.get("SELECT 1 FROM settings WHERE key='inner-test'"),
      undefined,
    );
    assert.equal(
      new Date(parisDate("20/12/2026 14:00")).toISOString(),
      "2026-12-20T13:00:00.000Z",
    );
    assert.throws(() => parisDate("31/02/2027 14:00"));
    assert.throws(() => parisDate("25/10/2026 02:30"));
  } finally {
    f.close();
  }
});

test("private reply rechecks housing consent and meeting enrollment at send time, not just record version", async () => {
  const f = setup();
  try {
    const housing = f.a.create(member, "housing", {
      title: "Secret dossier",
      zone: "Paris",
      budget: 100000,
      moveDate: f.now() + 86400000,
      duration: "un an",
      criteria: "SECRET-CONFIDENTIEL",
      sharedWith: ["atelier"],
    });
    f.connector.failure = "disconnected";
    f.accept(f.envelope("pro", "voir " + short(housing)));
    f.worker.processInbox();
    f.a.action(member, housing.id, "consent", { sharedWith: [] });
    f.connector.failure = "none";
    await f.worker.tick();
    assert.equal(
      f.connector.sent.some((m) => m.text?.includes("SECRET-CONFIDENTIEL")),
      false,
    );
    const meeting = f.a.list(member, "meetup")[0];
    f.a.action(member, meeting.id, "enroll", {
      accept: true,
      version: meeting.version,
      seats: 1,
    });
    f.connector.failure = "disconnected";
    f.accept(f.envelope("member", "voir " + short(meeting)));
    f.worker.processInbox();
    const sentBefore = f.connector.sent.length;
    f.a.action(member, meeting.id, "leave");
    f.connector.failure = "none";
    await f.worker.tick();
    assert.equal(f.connector.sent.length, sentBefore);
    assert.ok(
      f.db.get("SELECT id FROM outbox WHERE error='reply_access_changed'"),
    );
  } finally {
    f.close();
  }
});

test("private community selection cannot grant another group membership or switch mid-confirmation", async () => {
  const f = setup();
  try {
    f.db.run("INSERT INTO memberships VALUES('member','lyon','member',1)");
    assert.match(await f.say("member", "aide"), /Tes communautés/);
    assert.match(await f.say("member", "groupe 2"), /Paris/);
    await f.say("member", "profil");
    await f.say("member", "Nom privé");
    assert.match(await f.say("member", "groupe 1"), /Lyon/);
    assert.doesNotMatch(await f.say("member", "confirmer"), /enregistré/);
    assert.equal(f.a.user("member").name, "Anjali");
    assert.match(await f.say("member", "groupe 9"), /options/);
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM memberships WHERE user_id='member' AND group_id IN('paris','lyon')",
      )!.n,
      2,
    );
  } finally {
    f.close();
  }
});

test("WhatsApp administration manages members, verified partners, knowledge and programmed digests without web forms", async () => {
  const f = setup();
  try {
    await f.wizard("admin", "admin rôle", ["member3", "organizer"]);
    assert.equal(
      f.db.get(
        "SELECT role FROM memberships WHERE group_id='paris' AND user_id='member3'",
      )!.role,
      "organizer",
    );
    await f.wizard("admin", "admin partenaire", [
      "member2",
      "Partenaire validé",
    ]);
    assert.equal(
      f.db.get(
        "SELECT role FROM memberships WHERE group_id='paris' AND user_id='member2'",
      )!.role,
      "professional",
    );
    await f.wizard("admin", "document créer", [
      "Connaissance test",
      "https://example.org/culture",
      "Éditeur test",
      "Résumé vérifié",
      "Paris",
      "fr",
      "culture",
      "20/12/2026 12:00",
      "non",
    ]);
    const doc = f.record("Connaissance test");
    await f.wizard("admin", "document vérifier " + short(doc), []);
    assert.equal(f.a.raw(doc.id).status, "verified");
    assert.match(
      await f.say("member", "rechercher Connaissance"),
      /https:\/\/example.org\/culture/,
    );
    await f.wizard("admin", "digest créer", [
      "Digest complet",
      short(doc),
      "19/12/2026 12:00",
    ]);
    const digest = f.record("Digest complet");
    await f.wizard("admin", "digest publier " + short(digest), []);
    assert.ok(
      f.db.get(
        "SELECT id FROM outbox WHERE kind='digest' AND record_id=? AND status='pending'",
        digest.id,
      ),
    );
    await f.wizard("admin", "admin retirer membre", ["member3"]);
    assert.equal(
      f.db.get(
        "SELECT active FROM memberships WHERE group_id='paris' AND user_id='member3'",
      )!.active,
      0,
    );
  } finally {
    f.close();
  }
});

test("linked owner can explicitly enable the actual WhatsApp group, ordinary members and API echoes cannot", () => {
  const f = setup();
  try {
    f.db.run(
      "INSERT INTO groups(id,community_id,name,zone,chat_id,allowed,settings) VALUES('self','india-france','Essai','France',?,1,?)",
      f.phones.admin,
      json({ selfTest: true, assistantEnabled: true }),
    );
    f.db.run("INSERT INTO memberships VALUES('admin','self','group_admin',1)");
    const e = {
      ...f.envelope("admin", "activer groupe Nouveau groupe"),
      me: { id: f.phones.admin },
      payload: {
        ...f.envelope("admin", "activer groupe Nouveau groupe").payload,
        from: f.phones.admin,
        to: "120363999999@g.us",
        fromMe: true,
      },
    };
    preparePrivateChat(f.a, { ...e, payload: { ...e.payload, source: "api" } });
    assert.equal(
      f.db.get("SELECT 1 FROM groups WHERE chat_id='120363999999@g.us'"),
      undefined,
    );
    preparePrivateChat(f.a, { ...e, payload: { ...e.payload, fromMe: false } });
    assert.equal(
      f.db.get("SELECT 1 FROM groups WHERE chat_id='120363999999@g.us'"),
      undefined,
    );
    preparePrivateChat(f.a, e);
    const g = f.db.get(
      "SELECT * FROM groups WHERE chat_id='120363999999@g.us'",
    )!;
    assert.equal(g.allowed, 1);
    assert.equal(g.name, "Nouveau groupe");
    assert.equal(
      f.db.get("SELECT role FROM memberships WHERE group_id=?", g.id)!.role,
      "group_admin",
    );
  } finally {
    f.close();
  }
});

test("private route cannot be rebound through administration and a pending reply cannot change destination", async () => {
  const f = setup();
  try {
    await f.say("member", "aide");
    const g = f.db.get(
      "SELECT * FROM groups WHERE chat_id=?",
      f.phones.member,
    )!;
    assert.throws(
      () =>
        f.administration.action({ userId: "member", groupId: g.id }, "group", {
          chatId: "120363888888@g.us",
        }),
      /private_route_immutable/,
    );
    f.connector.failure = "disconnected";
    f.accept(f.envelope("member", "mes dossiers"));
    f.worker.processInbox();
    f.db.run(
      "UPDATE groups SET chat_id=? WHERE id=?",
      "120363888888@g.us",
      g.id,
    );
    f.connector.failure = "none";
    await f.worker.tick();
    assert.equal(
      f.connector.sent.some((m) => m.chatId === "120363888888@g.us"),
      false,
    );
  } finally {
    f.close();
  }
});

test("group publication contains WhatsApp actions and never includes participant-only coordination", async () => {
  const f = setup();
  try {
    const r = f.a.list(member, "meetup")[0];
    await f.wizard("admin", "partager " + short(r), []);
    const publication = f.connector.sent.find(
      (m) =>
        m.chatId === "120363000001@g.us" && m.text?.includes("Nanba inscrire"),
    );
    assert.ok(publication);
    assert.equal(
      publication.text!.includes(f.a.raw(r.id).data.coordination),
      false,
    );
    assert.doesNotMatch(publication.text!, /https:\/\/nanba.invalid/);
  } finally {
    f.close();
  }
});

test("signed WAHA HTTP ingress creates only the sender private route and emits the correct private response", async () => {
  const { createApplication } = await import("../src/server.ts");
  const { WahaConnector } = await import("../src/whatsapp.ts");
  const { seed } = await import("../src/seed.ts");
  const { createHmac } = await import("node:crypto");
  const f = fixture();
  const sent: any[] = [];
  const secret = "test-webhook-only-".repeat(3);
  const previous = process.env.WAHA_WEBHOOK_SECRET;
  process.env.WAHA_WEBHOOK_SECRET = secret;
  const connector = new WahaConnector({
    base: "http://localhost:3001",
    apiKey: "test-provider-key-only",
    session: "nanba-pilot",
    engine: "WEBJS",
    allowReal: true,
    privateChatIds: () => ["33600000111@c.us"],
    fetcher: async (u, o) => {
      if (String(u).endsWith("/sendText")) {
        sent.push(JSON.parse(String(o?.body)));
        return Response.json({ id: "mock-provider-" + uid() });
      }
      return Response.json({ status: "WORKING" });
    },
  });
  const app = createApplication({
    database: f.dir + "/http-wa.db",
    now: f.now,
    production: false,
    connector,
    seed: false,
  });
  seed(app.app);
  app.db.run(
    "UPDATE groups SET settings=? WHERE id='paris'",
    json({ assistantEnabled: true }),
  );
  const identity = app.app.identity(
    "waha",
    app.app.session,
    "33600000111@c.us",
  );
  app.db.run(
    "UPDATE identities SET user_id='member',verified_at=? WHERE identity_hash=?",
    f.now(),
    identity,
  );
  await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + (app.server.address() as any).port;
  const body = JSON.stringify({
    session: app.app.session,
    event: "message.any",
    me: { id: "33900000000@c.us" },
    payload: {
      id: uid(),
      from: "33600000111@c.us",
      to: "33900000000@c.us",
      fromMe: false,
      source: "app",
      body: "Nanba logement créer",
      timestamp: Math.floor(f.now() / 1000),
    },
  });
  const post = (hmac: string) =>
    fetch(base + "/api/webhooks/waha", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-hmac-algorithm": "sha512",
        "x-webhook-hmac": hmac,
      },
      body,
    });
  try {
    assert.equal((await post("wrong")).status, 401);
    assert.equal(
      app.db.get(
        "SELECT 1 FROM groups WHERE json_extract(settings,'$.privateChat')=1",
      ),
      undefined,
    );
    assert.equal(
      (await post(createHmac("sha512", secret).update(body).digest("hex")))
        .status,
      202,
    );
    await app.worker.tick();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].chatId, "33600000111@c.us");
    assert.match(sent[0].text, /Recherche privée/);
    assert.equal(
      (await post(createHmac("sha512", secret).update(body).digest("hex")))
        .status,
      202,
    );
    await app.worker.tick();
    assert.equal(sent.length, 1);
  } finally {
    await new Promise<void>((r) => app.server.close(() => r()));
    app.db.close();
    if (previous === undefined) delete process.env.WAHA_WEBHOOK_SECRET;
    else process.env.WAHA_WEBHOOK_SECRET = previous;
    f.close();
  }
});
