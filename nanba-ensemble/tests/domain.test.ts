import { test } from "node:test";
import assert from "node:assert/strict";
import { DB, parse, uid } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
import { Payments, storyCard } from "../src/integrations.ts";
import { DEMO_PASSWORD } from "../src/seed.ts";
import {
  fixture,
  admin,
  member,
  member2,
  member3,
  organizer,
  pro,
  otherpro,
  outsider,
  request,
  offer,
  poll,
  sendVote,
} from "./helpers.ts";

test("1 · full collective flow persists poll, votes, confirmed offer and accepted terms after reopening", async () => {
  const f = fixture();
  try {
    const r = request(f.a);
    const p = await poll(f, r);
    sendVote(f, p);
    f.a.action(member, r.id, "interest", { active: true });
    assert.equal(f.a.counts(r.id).total, 2);
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM transitions WHERE record_id=?", r.id)!.n,
      1,
    );
    const o = offer(f.a, r.id);
    const e = f.a.action(member, o.id, "enroll", {
      accept: true,
      version: o.version,
      seats: 1,
    });
    assert.equal(e.status, "confirmed");
    const reopened = new DB(f.path);
    const app = new Domain(reopened, f.now);
    assert.equal(app.counts(r.id).total, 2);
    assert.equal(
      reopened.get("SELECT message_id FROM polls WHERE id=?", p.id)!.message_id,
      p.message_id,
    );
    assert.equal(
      reopened.get("SELECT accepted_version FROM enrollments WHERE id=?", e.id)!
        .accepted_version,
      o.version,
    );
    reopened.close();
  } finally {
    f.close();
  }
});

test("permissions separate groups, private housing and professional organizations", () => {
  const f = fixture();
  try {
    const housing = f.a.list(member, "housing")[0];
    assert.throws(() => f.a.get(otherpro, housing.id), /not_found/);
    assert.throws(() => f.a.get(admin, housing.id), /not_found/);
    assert.equal(f.a.get(pro, housing.id).owner_id, "member");
    assert.throws(() => f.a.get(outsider, housing.id), /not_found/);
    const r = request(f.a);
    assert.throws(() => f.a.action(member, r.id, "publish_poll"), /forbidden/);
    assert.throws(
      () => f.administration.action(member, "group", { paused: true }),
      /forbidden/,
    );
    assert.throws(
      () => f.a.offer(member, { requestId: r.id }),
      /professional_required/,
    );
  } finally {
    f.close();
  }
});

test("verified identity linking reconciles app and WhatsApp without arbitrary reassignment", async () => {
  const f = fixture();
  try {
    const r = request(f.a);
    const p = await poll(f, r);
    f.a.action(member, r.id, "interest", { active: true });
    sendVote(f, p, { voter: "abc@lid" });
    assert.equal(f.a.counts(r.id).total, 2);
    const code = f.a.linkCode(member);
    f.db.tx(() =>
      f.a.consumeLink(
        "simulated",
        "nanba-pilot",
        "abc@lid",
        code.code,
        "paris",
      ),
    );
    assert.deepEqual(f.a.counts(r.id), {
      verified: 1,
      provisional: 0,
      total: 1,
      uncertain: 0,
    });
    const other = f.a.linkCode(member2);
    assert.throws(
      () =>
        f.db.tx(() =>
          f.a.consumeLink(
            "simulated",
            "nanba-pilot",
            "abc@lid",
            other.code,
            "paris",
          ),
        ),
      /identity_already_linked/,
    );
    assert.throws(
      () =>
        f.a.consumeLink(
          "simulated",
          "nanba-pilot",
          "abc@lid",
          "INVALID",
          "paris",
        ),
      /invalid_link_code/,
    );
  } finally {
    f.close();
  }
});

test("poll changes, withdrawals, duplicate and out-of-order events; decrypt failure never withdraws", async () => {
  const f = fixture();
  try {
    const r = request(f.a),
      p = await poll(f, r);
    const first = sendVote(f, p);
    sendVote(f, p, { id: first.event.id });
    assert.equal(f.a.counts(r.id).total, 1);
    f.advance(1000);
    sendVote(f, p, { choices: ["no"] });
    assert.equal(f.a.counts(r.id).total, 0);
    sendVote(f, p, { at: f.now() - 2000 });
    assert.equal(f.a.counts(r.id).total, 0);
    f.advance(1000);
    sendVote(f, p);
    sendVote(f, p, { failed: true, choices: [], at: f.now() + 1000 });
    assert.equal(f.a.counts(r.id).total, 1);
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM audit WHERE action='vote.decrypt_failed'",
      )!.n,
      1,
    );
    f.advance(2000);
    sendVote(f, p, { choices: [] });
    assert.equal(f.a.counts(r.id).total, 0);
  } finally {
    f.close();
  }
});

test("unorderable votes become uncertain; multi-choice snapshot and deadline are enforced", async () => {
  const f = fixture();
  try {
    const r = request(f.a),
      p = await poll(f, r);
    sendVote(f, p);
    sendVote(f, p, { choices: ["no"] });
    assert.equal(f.a.counts(r.id).uncertain, 1);
    assert.equal(f.a.counts(r.id).total, 0);
    f.advance(1000);
    sendVote(f, p);
    assert.equal(f.a.counts(r.id).uncertain, 0);
    f.db.run("UPDATE polls SET multiple=1 WHERE id=?", p.id);
    f.advance(1000);
    sendVote(f, p, { choices: ["yes", "no"] });
    assert.equal(f.a.counts(r.id).total, 1);
    f.advance(86400000);
    sendVote(f, p, { choices: [] });
    assert.equal(f.a.counts(r.id).total, 1);
  } finally {
    f.close();
  }
});

test("threshold notification is idempotent even after withdrawal and recrossing", () => {
  const f = fixture();
  try {
    const r = request(f.a);
    f.a.action(member, r.id, "interest", { active: true });
    f.a.action(member2, r.id, "interest", { active: true });
    f.a.action(member2, r.id, "interest", { active: false });
    f.a.action(member2, r.id, "interest", { active: true });
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM transitions WHERE record_id=?", r.id)!.n,
      1,
    );
    assert.equal(f.a.raw(r.id).status, "proposed");
  } finally {
    f.close();
  }
});

test("offer requires author confirmation and explicit current terms; material change forces reconfirmation", () => {
  const f = fixture();
  try {
    const r = request(f.a),
      o = offer(f.a, r.id);
    assert.throws(
      () => f.a.action(member, o.id, "enroll", { version: o.version }),
      /explicit_acceptance/,
    );
    assert.throws(
      () => f.a.action(member, o.id, "enroll", { accept: true, version: 1 }),
      /terms_changed/,
    );
    f.a.action(member, o.id, "enroll", { accept: true, version: o.version });
    const next = f.a.action(pro, o.id, "revise", {
      price: 3000,
      startsAt: f.now() + 86400000,
      terms: "Nouvelles conditions",
    });
    assert.equal(
      f.db.get("SELECT status FROM enrollments WHERE record_id=?", o.id)!
        .status,
      "reconfirm",
    );
    assert.throws(
      () =>
        f.a.action(member, o.id, "enroll", {
          accept: true,
          version: o.version,
        }),
      /enrollment_closed/,
    );
    const confirmed = f.a.action(pro, o.id, "confirm");
    f.a.action(member, o.id, "enroll", {
      accept: true,
      version: confirmed.version,
    });
    assert.equal(
      f.db.get(
        "SELECT accepted_version FROM enrollments WHERE record_id=?",
        o.id,
      )!.accepted_version,
      confirmed.version,
    );
  } finally {
    f.close();
  }
});

test("capacity is bounded and a released place is offered, not silently confirmed", () => {
  const f = fixture();
  try {
    const r = request(f.a),
      o = offer(f.a, r.id, { capacity: 1 });
    assert.equal(
      f.a.action(member, o.id, "enroll", { accept: true, version: o.version })
        .status,
      "confirmed",
    );
    assert.equal(
      f.a.action(member2, o.id, "enroll", { accept: true, version: o.version })
        .status,
      "waitlisted",
    );
    f.a.action(member, o.id, "leave");
    assert.equal(
      f.db.get(
        "SELECT status FROM enrollments WHERE record_id=? AND user_id=?",
        o.id,
        "member2",
      )!.status,
      "offered",
    );
    const enrollment = f.a.action(member2, o.id, "enroll", {
      accept: true,
      version: o.version,
    });
    assert.equal(enrollment.status, "confirmed");
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM enrollments WHERE record_id=? AND status='confirmed'",
        o.id,
      )!.n,
      1,
    );
  } finally {
    f.close();
  }
});

test("2 · meeting acceptance protects coordination; cancellation offers seat, expired offer advances queue", () => {
  const f = fixture();
  try {
    const r = f.a.create(organizer, "meetup", {
      title: "Café",
      description: "Rencontre",
      activity: "Café",
      zone: "Paris",
      place: "Quartier",
      coordination: "Adresse privée",
      language: "fr",
      format: "solo",
      startsAt: f.now() + 4 * 86400000,
      capacity: 2,
    });
    assert.equal(f.a.present(member, r).data.coordination, undefined);
    f.a.action(member, r.id, "enroll", {
      accept: true,
      version: r.version,
      seats: 2,
    });
    assert.equal(f.a.present(member, r).data.coordination, "Adresse privée");
    f.a.action(member2, r.id, "enroll", { accept: true, version: r.version });
    f.a.action(member3, r.id, "enroll", { accept: true, version: r.version });
    f.a.action(member, r.id, "leave");
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM enrollments WHERE record_id=? AND status='offered'",
        r.id,
      )!.n,
      2,
    );
    f.advance(86400001);
    f.a.expire();
    assert.equal(f.a.present(member, r).data.remaining, 2);
  } finally {
    f.close();
  }
});

test("3 · housing availability is stale and revoking consent immediately hides proposals from partner", () => {
  const f = fixture();
  try {
    const h = f.a.list(member, "housing")[0],
      proposal = f.a.list(member, "housing_offer")[0];
    assert.equal(proposal.data.stale, true);
    f.a.action(pro, proposal.id, "reconfirm");
    assert.equal(
      f.a.present(member, f.a.get(member, proposal.id)).data.stale,
      false,
    );
    f.a.action(member, proposal.id, "contact");
    assert.equal(f.a.raw(proposal.id).data.contactRequested, true);
    f.a.action(member, h.id, "consent", { sharedWith: [] });
    assert.throws(() => f.a.get(pro, h.id), /not_found/);
    assert.throws(() => f.a.get(pro, proposal.id), /not_found/);
    assert.equal(f.a.get(member, proposal.id).id, proposal.id);
    assert.equal(f.a.housingAggregate(admin).count, null);
  } finally {
    f.close();
  }
});

test("4 · volunteer slot is held after proposal, requires both acceptances, cancellation releases it", () => {
  const f = fixture();
  try {
    const help = f.a.list(member, "help")[0];
    f.a.action(organizer, help.id, "volunteer");
    assert.equal(f.a.raw(help.id).status, "proposed");
    const other = f.a.create(member2, "help", {
      title: "CV aussi",
      theme: "CV",
      outcome: "Relire",
      language: "fr",
      duration: 20,
      startsAt: help.data.startsAt,
    });
    assert.throws(
      () => f.a.action(organizer, other.id, "volunteer"),
      /slot_unavailable/,
    );
    f.a.action(member, help.id, "accept");
    assert.equal(f.a.raw(help.id).status, "accepted");
    f.a.action(member, help.id, "cancel");
    f.a.action(organizer, other.id, "volunteer");
    assert.equal(f.a.raw(other.id).data.volunteerAccepted, true);
    const privateHelp = f.a.raw(other.id);
    assert.throws(() => f.a.get(member3, privateHelp.id), /not_found/);
  } finally {
    f.close();
  }
});

test("volunteer limits and pause are enforced without public reputation penalties", () => {
  const f = fixture();
  try {
    const profile = f.a.list(organizer, "volunteer")[0];
    f.a.action(organizer, profile.id, "pause");
    const help = f.a.list(member, "help")[0];
    assert.throws(
      () => f.a.action(organizer, help.id, "volunteer"),
      /volunteer_profile_required/,
    );
    f.a.action(organizer, profile.id, "resume");
    f.a.action(organizer, help.id, "volunteer");
    f.a.action(member, help.id, "decline");
    assert.equal(f.a.raw(help.id).status, "open");
    assert.equal(f.a.raw(profile.id).data.reputation, undefined);
  } finally {
    f.close();
  }
});

test("5 · radar expires under a controlled clock, disappears from current results, reconfirms with traceable version", () => {
  const f = fixture();
  try {
    const r = f.a.currentRadar(member)[0];
    const version = r.version;
    f.advance(86400000);
    assert.equal(f.a.currentRadar(member).length, 0);
    f.a.action(admin, r.id, "confirm", {
      confirmation: "organizer",
      evidence: "https://example.com/confirmation",
      hours: 48,
    });
    assert.equal(f.a.currentRadar(member).length, 1);
    assert.equal(f.a.raw(r.id).version, version + 1);
    assert.equal(f.a.raw(r.id).data.confirmation, "organizer");
    assert.throws(
      () =>
        f.a.action(member, r.id, "confirm", {
          confirmation: "official",
          evidence: "https://example.com",
        }),
      /forbidden/,
    );
    f.a.action(member, r.id, "dispute", { reason: "Horaires différents" });
    assert.equal(f.a.currentRadar(member).length, 0);
  } finally {
    f.close();
  }
});

test("6 · cohort enrollment, resource and progress persist privately, activity must be enrolled", () => {
  const f = fixture();
  try {
    const cohort = f.a.list(member, "cohort")[0],
      meet = f.a.list(member, "meetup")[0];
    f.a.action(member, cohort.id, "enroll", {
      accept: true,
      version: cohort.version,
    });
    f.a.action(member, meet.id, "enroll", {
      accept: true,
      version: meet.version,
    });
    f.a.action(member, cohort.id, "progress", {
      completed: [cohort.data.steps[0]],
      saved: [cohort.data.resources[0].url],
      activities: [meet.id],
      mentor: true,
    });
    assert.equal(
      f.a.present(member, f.a.raw(cohort.id)).data.progress.completed.length,
      1,
    );
    assert.deepEqual(
      f.a.present(member2, f.a.raw(cohort.id)).data.progress,
      {},
    );
    assert.throws(
      () =>
        f.a.action(member, cohort.id, "progress", {
          userId: "member2",
          completed: [],
        }),
      /private_progress/,
    );
    const reopened = new DB(f.path);
    assert.equal(
      parse(
        reopened.get("SELECT data FROM progress WHERE user_id=?", "member")!
          .data,
      ).mentor,
      true,
    );
    reopened.close();
  } finally {
    f.close();
  }
});

test("7 · challenge freezes denominator, scores deterministically, rejects duplicates and late submissions", () => {
  const f = fixture();
  try {
    const r = f.a.list(member, "challenge")[0];
    assert.equal(r.data.questions[0].answer, undefined);
    f.a.action(member, r.id, "join", { team: "Paris" });
    f.a.action(member2, r.id, "join", { team: "Paris" });
    f.a.action(member3, r.id, "join", { team: "Lyon" });
    f.a.action(admin, r.id, "open");
    assert.throws(
      () => f.a.action(organizer, r.id, "join", { team: "Paris" }),
      /registration_closed/,
    );
    f.a.action(member, r.id, "answer", { answers: [0] });
    f.a.action(member, r.id, "answer", { answers: [0] });
    assert.throws(
      () => f.a.action(member, r.id, "answer", { answers: [1] }),
      /already_answered/,
    );
    f.a.action(member3, r.id, "answer", { answers: [0] });
    f.advance(6 * 86400000);
    assert.throws(
      () => f.a.action(member2, r.id, "answer", { answers: [0] }),
      /challenge_closed/,
    );
    f.a.action(admin, r.id, "close");
    const scores = f.a.leaderboard(member, r.id);
    assert.deepEqual(
      scores.map((s: any) => [s.team, s.score]),
      [
        ["Lyon", 1],
        ["Paris", 0.5],
      ],
    );
    f.a.action(admin, r.id, "correct", {
      question: 0,
      answer: 1,
      reason: "Correction tracée",
    });
    assert.equal(f.a.leaderboard(member, r.id)[0].points, 0);
    assert.equal(f.a.raw(r.id).data.rulesVersion, 2);
  } finally {
    f.close();
  }
});

test("8 · author validates bilingual version and channels; withdrawal invalidates public surfaces and queued sends", async () => {
  const f = fixture();
  try {
    const r = f.a.create(member, "story", {
      title: "Notre recette",
      original: "Une recette <script> dangereuse",
      translation: "Our recipe",
      language: "fr",
      translationLanguage: "en",
      credit: "Auteur",
      storyType: "personal",
    });
    assert.throws(() => f.a.get(member2, r.id), /not_found/);
    assert.throws(() => f.a.get(admin, r.id), /not_found/);
    f.a.action(member, r.id, "approve", {
      rightsConfirmed: true,
      translationReviewed: true,
      audiences: ["nanba", "whatsapp"],
    });
    f.a.action(admin, r.id, "publish");
    f.a.action(admin, r.id, "share");
    assert.match(storyCard(f.a.raw(r.id)), /&lt;script&gt;/);
    f.a.action(member, r.id, "withdraw");
    await f.worker.tick();
    assert.throws(() => f.a.get(member2, r.id), /not_found/);
    assert.equal(
      f.db.get("SELECT status FROM outbox WHERE record_id=?", r.id)!.status,
      "cancelled",
    );
    assert.equal(f.connector.sent.length, 0);
  } finally {
    f.close();
  }
});

test("story edits invalidate author approval and cannot authorize another publishing channel", () => {
  const f = fixture();
  try {
    const r = f.a.list(member, "story")[0];
    f.a.action(member, r.id, "edit", {
      title: "Révision",
      original: "Nouveau texte",
      translation: "New text",
    });
    assert.equal(f.a.raw(r.id).status, "draft");
    assert.throws(
      () =>
        f.a.action(member, r.id, "approve", {
          rightsConfirmed: true,
          translationReviewed: true,
          audiences: ["nanba", "tiktok"],
        }),
      /invalid_audience/,
    );
    assert.throws(() => f.a.get(member2, r.id), /not_found/);
  } finally {
    f.close();
  }
});

test("payment cannot be marked paid by browser; authentic but mismatched events do not validate another order", () => {
  const f = fixture();
  try {
    const r = request(f.a),
      o = offer(f.a, r.id);
    const e = f.a.action(member, o.id, "enroll", {
      accept: true,
      version: o.version,
    });
    const payments = new Payments(f.a);
    const order = payments.prepare(member, e.id);
    assert.equal(order.status, "unconfigured");
    f.db.run(
      "UPDATE payment_orders SET status='pending',provider_order='provider-1' WHERE id=?",
      order.id,
    );
    const event = {
      provider: "test",
      eventId: "evt-1",
      orderId: order.id,
      providerOrder: "provider-1",
      amount: o.data.price,
      currency: "EUR",
      beneficiary: "atelier",
      offerVersion: o.version,
      enrollmentId: e.id,
      type: "paid" as const,
    };
    for (const change of [
      { amount: 1 },
      { currency: "USD" },
      { beneficiary: "other-org" },
      { enrollmentId: "wrong" },
      { providerOrder: "wrong" },
      { offerVersion: 1 },
    ])
      assert.throws(
        () => payments.applyVerified({ ...event, ...change }),
        /payment_mismatch/,
      );
    assert.equal(
      f.db.get("SELECT status FROM payment_orders WHERE id=?", order.id)!
        .status,
      "pending",
    );
    assert.equal(payments.applyVerified(event).status, "paid");
    assert.equal(payments.applyVerified(event).duplicate, true);
    assert.equal(f.db.get("SELECT COUNT(*) n FROM payment_events")!.n, 1);
  } finally {
    f.close();
  }
});

test("privacy export is scoped and erasure removes linked votes, private content and sessions", async () => {
  const f = fixture();
  try {
    const r = request(f.a),
      p = await poll(f, r);
    sendVote(f, p);
    const code = f.a.linkCode(member);
    f.a.consumeLink(
      "simulated",
      "nanba-pilot",
      "33600000099@c.us",
      code.code,
      "paris",
    );
    const exported = f.administration.export(member);
    assert.ok(exported.records.every((r) => r.owner_id === "member"));
    assert.ok(!("password" in exported.profile));
    f.administration.erase(member, DEMO_PASSWORD);
    assert.equal(f.db.get("SELECT COUNT(*) n FROM votes")!.n, 0);
    assert.equal(
      f.db.get("SELECT deleted FROM users WHERE id=?", "member")!.deleted,
      1,
    );
    assert.equal(f.a.list(member2, "story").length, 0);
  } finally {
    f.close();
  }
});

test("waitlist replay preserves FIFO position and a closed activity never promotes anyone", () => {
  const f = fixture();
  try {
    const r = request(f.a),
      o = offer(f.a, r.id, { capacity: 1 });
    f.a.action(member, o.id, "enroll", { accept: true, version: o.version });
    const first = f.a.action(member2, o.id, "enroll", {
      accept: true,
      version: o.version,
    });
    f.advance(1000);
    f.a.action(member3, o.id, "enroll", { accept: true, version: o.version });
    f.advance(1000);
    const repeated = f.a.action(member2, o.id, "enroll", {
      accept: true,
      version: o.version,
    });
    assert.equal(first.created_at, repeated.created_at);
    f.a.action(member, o.id, "leave");
    assert.equal(
      f.db.get(
        "SELECT status FROM enrollments WHERE record_id=? AND user_id=?",
        o.id,
        "member2",
      )!.status,
      "offered",
    );
    f.a.action(pro, o.id, "cancel");
    f.a.action(member2, o.id, "leave");
    assert.equal(
      f.db.get(
        "SELECT COUNT(*) n FROM enrollments WHERE record_id=? AND status='offered'",
        o.id,
      )!.n,
      0,
    );
  } finally {
    f.close();
  }
});

test("erasing an organizer cancels owned registrations and frees volunteer commitments", () => {
  const f = fixture();
  try {
    const meetup = f.a.list(member, "meetup")[0];
    f.a.action(member, meetup.id, "enroll", {
      accept: true,
      version: meetup.version,
    });
    const help = f.a.list(member, "help")[0];
    f.a.action(organizer, help.id, "volunteer");
    f.administration.erase(organizer, DEMO_PASSWORD);
    assert.equal(
      f.db.get("SELECT status FROM enrollments WHERE record_id=?", meetup.id)!
        .status,
      "cancelled",
    );
    assert.equal(f.a.raw(help.id).status, "open");
    assert.equal(f.a.raw(help.id).data.volunteerId, null);
  } finally {
    f.close();
  }
});
