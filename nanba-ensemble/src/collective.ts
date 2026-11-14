import {
  Core,
  check,
  text,
  integer,
  date,
  list,
  oneOf,
  uid,
  json,
  parse,
  type Context,
  type Entity,
} from "./core.ts";
import type { Row } from "./db.ts";
import { hash, secret, encryptRef } from "./auth.ts";
import { createHmac } from "node:crypto";
export class Collective extends Core {
  request(c: Context, b: Row) {
    this.member(c);
    const deadline = date(b.deadline, "deadline");
    check(deadline > this.now(), "deadline_in_past");
    return this.createRecord(c, "request", "proposed", {
      title: text(b.title, "title", 160),
      description: text(b.description, "description"),
      category: text(b.category, "category", 60),
      zone: text(b.zone, "zone", 120),
      language: oneOf(b.language, ["fr", "en", "ta", "tanglish"], "language"),
      slots: text(b.slots, "slots", 300),
      budget: b.budget == null ? null : integer(b.budget, "budget"),
      currency: "EUR",
      threshold: integer(b.threshold, "threshold", 2, 500),
      deadline,
    });
  }
  counts(id: string) {
    const states = new Map<
      string,
      { active: boolean; at: number; verified: boolean }
    >();
    for (const r of this.db.all(
      "SELECT i.* FROM interests i JOIN users u ON u.id=i.user_id WHERE i.request_id=? AND u.deleted=0",
      id,
    ))
      states.set("u:" + r.user_id, {
        active: !!r.active,
        at: r.at,
        verified: true,
      });
    for (const r of this.db.all(
      "SELECT v.*,i.user_id FROM votes v JOIN identities i USING(identity_hash) JOIN polls p ON p.id=v.poll_id WHERE p.request_id=? AND v.uncertain=0",
      id,
    )) {
      const key = r.user_id ? "u:" + r.user_id : "w:" + r.identity_hash;
      const prior = states.get(key);
      const active = parse<string[]>(r.choices).includes("yes");
      if (!prior || r.at > prior.at)
        states.set(key, { active, at: r.at, verified: !!r.user_id });
    }
    const active = [...states.values()].filter((x) => x.active);
    return {
      verified: active.filter((x) => x.verified).length,
      provisional: active.filter((x) => !x.verified).length,
      total: active.length,
      uncertain: this.db.get(
        "SELECT COUNT(*) n FROM votes v JOIN polls p ON p.id=v.poll_id WHERE p.request_id=? AND uncertain=1",
        id,
      )!.n,
    };
  }
  threshold(r: Entity) {
    const counts = this.counts(r.id);
    if (counts.total >= r.data.threshold) {
      const result = this.db.run(
        "INSERT OR IGNORE INTO transitions VALUES(?,?,?)",
        r.id,
        "threshold_reached",
        this.now(),
      );
      if (result.changes)
        this.audit(
          { userId: r.owner_id, groupId: r.group_id },
          "request.offer_preparation_required",
          r.id,
        );
    }
    return counts;
  }
  interest(c: Context, r: Entity, active: boolean) {
    check(
      ["proposed", "open"].includes(r.status) && this.now() < r.data.deadline,
      "interest_closed",
      409,
    );
    this.db.run(
      "INSERT INTO interests VALUES(?,?,?,?) ON CONFLICT(request_id,user_id) DO UPDATE SET active=excluded.active,at=excluded.at",
      r.id,
      c.userId,
      active ? 1 : 0,
      this.now(),
    );
    return this.threshold(r);
  }
  publishPoll(c: Context, r: Entity, b: Row) {
    this.admin(c);
    check(
      r.data.deadline > this.now() &&
        !["cancelled", "completed"].includes(r.status),
      "interest_closed",
      409,
    );
    const existing = this.db.get(
      "SELECT id FROM polls WHERE request_id=?",
      r.id,
    );
    if (existing) return this.raw(existing.id);
    const options = [
      { id: "yes", label: "Je participe / Interested" },
      { id: "no", label: "Pas cette fois / Not this time" },
    ];
    const poll = this.createRecord(c, "poll", "pending", {
      title: b.question ? text(b.question, "question", 200) : r.data.title,
      requestId: r.id,
    });
    this.db.run(
      "INSERT INTO polls(id,request_id,provider,session,options,multiple,deadline) VALUES(?,?,?,?,?,?,?)",
      poll.id,
      r.id,
      this.mode,
      this.session,
      json(options),
      b.multiple === true ? 1 : 0,
      r.data.deadline,
    );
    this.enqueue(
      c,
      poll,
      "poll",
      { question: poll.data.title, options, multiple: b.multiple === true },
      "poll:" + poll.id,
    );
    this.save(c, r, r.data, "open");
    return poll;
  }
  offer(c: Context, b: Row) {
    const u = this.professional(c);
    const request = this.get(c, text(b.requestId, "requestId"), "request");
    check(
      !["cancelled", "completed"].includes(request.status),
      "request_closed",
      409,
    );
    const startsAt = date(b.startsAt, "startsAt"),
      deadline = date(b.deadline, "deadline");
    check(
      startsAt > this.now() && deadline > this.now() && deadline <= startsAt,
      "invalid_offer_dates",
    );
    return this.createRecord(c, "offer", "draft", {
      title: text(b.title, "title", 160),
      requestId: request.id,
      description: text(b.description, "description"),
      provider: text(b.provider, "provider", 160),
      place: text(b.place, "place", 300),
      startsAt,
      timezone: "Europe/Paris",
      price: integer(b.price, "price"),
      currency: "EUR",
      capacity: integer(b.capacity, "capacity", 1, 500),
      terms: text(b.terms, "terms"),
      deadline,
      orgId: u.org_id,
      sponsored: b.sponsored === true,
    });
  }
  offerAction(c: Context, r: Entity, action: string, b: Row) {
    if (action === "enroll") return this.enroll(c, r, b);
    if (action === "leave") return this.leave(c, r);
    this.professional(c);
    this.own(c, r);
    if (action === "confirm") {
      check(r.status === "draft", "invalid_state", 409);
      return this.save(c, r, r.data, "confirmed");
    }
    if (action === "revise") {
      check(["draft", "confirmed"].includes(r.status), "invalid_state", 409);
      const d = {
        ...r.data,
        price: integer(b.price, "price"),
        startsAt: date(b.startsAt, "startsAt"),
        terms: text(b.terms, "terms"),
      };
      check(d.startsAt > this.now(), "date_in_past");
      const next = this.save(c, r, d, "draft");
      this.db.run(
        "UPDATE enrollments SET status='reconfirm',offered_until=NULL,updated_at=? WHERE record_id=? AND status IN('confirmed','offered')",
        this.now(),
        r.id,
      );
      this.db.run(
        "UPDATE payment_orders SET status='stale' WHERE enrollment_id IN(SELECT id FROM enrollments WHERE record_id=?) AND status!='paid'",
        r.id,
      );
      return next;
    }
    if (action === "cancel") {
      this.db.run(
        "UPDATE enrollments SET status='cancelled',updated_at=? WHERE record_id=?",
        this.now(),
        r.id,
      );
      return this.save(c, r, r.data, "cancelled");
    }
    if (action === "complete") {
      check(
        r.status === "confirmed" && r.data.startsAt <= this.now(),
        "activity_not_started",
        409,
      );
      this.db.run(
        "UPDATE enrollments SET status='completed',updated_at=? WHERE record_id=? AND status='confirmed'",
        this.now(),
        r.id,
      );
      return this.save(c, r, r.data, "completed");
    }
    throw new Error("unknown_action");
  }
  present(c: Context, r: Entity): Row {
    const out = super.present(c, r);
    if (r.kind === "request") {
      out.data.counts = this.counts(r.id);
      out.data.interested = !!this.db.get(
        "SELECT active FROM interests WHERE request_id=? AND user_id=?",
        r.id,
        c.userId,
      )?.active;
      out.data.thresholdReached = out.data.counts.total >= r.data.threshold;
      out.data.thresholdEverReached = !!this.db.get(
        "SELECT 1 FROM transitions WHERE record_id=? AND name='threshold_reached'",
        r.id,
      );
      out.data.poll =
        this.db.get(
          "SELECT p.id,r.status,p.deadline FROM polls p JOIN records r ON r.id=p.id WHERE p.request_id=?",
          r.id,
        ) ?? null;
      out.data.offers = this.db
        .all(
          "SELECT id FROM records WHERE kind='offer' AND group_id=? AND json_extract(data,'$.requestId')=?",
          c.groupId,
          r.id,
        )
        .map((x) => this.raw(x.id))
        .filter((x) => this.canRead(c, x))
        .map((x) => super.present(c, x));
    }
    return out;
  }
  identity(provider: string, session: string, ref: string) {
    check(
      /^[A-Za-z0-9_.:-]+@(c\.us|s\.whatsapp\.net|lid)$/.test(ref),
      "invalid_identity",
    );
    const key = process.env.IDENTITY_ENCRYPTION_KEY;
    const material = provider + "|" + session + "|" + ref;
    const digest = key
      ? createHmac("sha256", Buffer.from(key, "hex"))
          .update(material)
          .digest("hex")
      : hash(material);
    const encrypted = key ? encryptRef(ref, key) : null;
    this.db.run(
      "INSERT OR IGNORE INTO identities(identity_hash,provider,session,encrypted_ref) VALUES(?,?,?,?)",
      digest,
      provider,
      session,
      encrypted,
    );
    return digest;
  }
  linkCode(c: Context) {
    this.member(c);
    const code = secret().slice(0, 16).toUpperCase();
    this.db.run("DELETE FROM link_codes WHERE user_id=?", c.userId);
    this.db.run(
      "INSERT INTO link_codes VALUES(?,?,?,?,NULL)",
      hash(code),
      c.userId,
      c.groupId,
      this.now() + 600000,
    );
    return {
      code,
      expiresAt: this.now() + 600000,
      instruction: "/lier " + code,
    };
  }
  consumeLink(
    provider: string,
    session: string,
    ref: string,
    code: string,
    groupId: string,
  ) {
    const record = this.db.get(
      "SELECT * FROM link_codes WHERE code_hash=? AND group_id=? AND used_at IS NULL AND expires_at>?",
      hash(code.toUpperCase()),
      groupId,
      this.now(),
    );
    check(record, "invalid_link_code");
    this.member({ userId: record.user_id, groupId });
    const id = this.identity(provider, session, ref);
    const old = this.db.get(
      "SELECT user_id FROM identities WHERE identity_hash=?",
      id,
    );
    check(
      !old?.user_id || old.user_id === record.user_id,
      "identity_already_linked",
      409,
    );
    check(
      !this.db.get(
        "SELECT 1 FROM identities WHERE provider=? AND session=? AND user_id=? AND identity_hash!=?",
        provider,
        session,
        record.user_id,
        id,
      ),
      "account_already_linked",
      409,
    );
    this.db.run(
      "UPDATE identities SET user_id=?,verified_at=? WHERE identity_hash=?",
      record.user_id,
      this.now(),
      id,
    );
    this.db.run(
      "UPDATE link_codes SET used_at=? WHERE code_hash=?",
      this.now(),
      hash(code.toUpperCase()),
    );
    for (const p of this.db.all(
      "SELECT DISTINCT p.request_id FROM polls p JOIN votes v ON v.poll_id=p.id WHERE v.identity_hash=?",
      id,
    ))
      this.threshold(this.raw(p.request_id));
    this.audit({ userId: record.user_id, groupId }, "identity.verified");
    return { linked: true };
  }
}
