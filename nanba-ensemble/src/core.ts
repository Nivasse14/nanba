import { DB, uid, json, parse, type Row } from "./db.ts";
import { check, text, integer, date, list, oneOf, url } from "./validation.ts";
export type Context = { userId: string; groupId: string };
export type Entity = {
  id: string;
  kind: string;
  group_id: string;
  owner_id: string;
  status: string;
  version: number;
  data: Row;
  created_at: number;
  updated_at: number;
};
export class Core {
  db: DB;
  now: () => number;
  mode: "simulated" | "waha";
  session: string;
  constructor(
    db: DB,
    now = () => Date.now(),
    mode: "simulated" | "waha" = "simulated",
    session = "nanba-pilot",
  ) {
    this.db = db;
    this.now = now;
    this.mode = mode;
    this.session = session;
  }
  user(id: string) {
    const u = this.db.get("SELECT * FROM users WHERE id=? AND deleted=0", id);
    check(u, "unauthenticated", 401);
    return u;
  }
  member(c: Context): Row {
    const u = this.user(c.userId);
    const m = this.db.get(
      "SELECT * FROM memberships WHERE user_id=? AND group_id=? AND active=1",
      c.userId,
      c.groupId,
    );
    check(m, "group_forbidden", 403);
    return { ...u, role: m.role };
  }
  role(c: Context, roles: string[]) {
    const u = this.member(c);
    check(u.platform_admin || roles.includes(u.role), "forbidden", 403);
    return u;
  }
  admin(c: Context) {
    return this.role(c, ["group_admin"]);
  }
  professional(c: Context) {
    const u = this.member(c);
    check(
      u.role === "professional" &&
        u.org_id &&
        this.db.get(
          "SELECT 1 FROM organizations WHERE id=? AND active=1",
          u.org_id,
        ),
      "professional_required",
      403,
    );
    return u;
  }
  group(c: Context) {
    this.member(c);
    return this.db.get("SELECT * FROM groups WHERE id=?", c.groupId)!;
  }
  audit(c: Context, action: string, target?: string) {
    this.db.run(
      "INSERT INTO audit VALUES(?,?,?,?,?,?)",
      uid(),
      c.userId,
      c.groupId,
      action,
      target ?? null,
      this.now(),
    );
  }
  raw(id: string): Entity {
    const r = this.db.get("SELECT * FROM records WHERE id=?", id);
    check(r, "not_found", 404);
    return { ...r, data: parse(r.data) } as Entity;
  }
  own(c: Context, r: Entity) {
    check(r.owner_id === c.userId, "owner_required", 403);
  }
  canRead(c: Context, r: Entity): boolean {
    const u = this.member(c);
    if (r.group_id !== c.groupId || r.status === "removed") return false;
    if (r.kind === "reconciliation")
      return u.role === "group_admin" || !!u.platform_admin;
    if (r.kind === "command_draft")
      return (
        r.owner_id === c.userId ||
        u.role === "group_admin" ||
        !!u.platform_admin
      );
    if (r.kind === "housing")
      return (
        r.owner_id === c.userId ||
        (u.role === "professional" &&
          r.status === "active" &&
          r.data.sharedWith.includes(u.org_id) &&
          !!this.db.get(
            "SELECT 1 FROM organizations WHERE id=? AND active=1",
            u.org_id,
          ))
      );
    if (r.kind === "housing_offer") {
      const parent = this.raw(r.data.requestId);
      return (
        this.canRead(c, parent) &&
        (r.owner_id === c.userId || parent.owner_id === c.userId)
      );
    }
    if (r.kind === "story")
      return (
        r.owner_id === c.userId ||
        (r.status === "published" && r.data.audiences.includes("nanba")) ||
        (r.status === "approved" &&
          (u.role === "group_admin" || u.platform_admin))
      );
    if (r.kind === "help")
      return (
        r.owner_id === c.userId ||
        r.data.volunteerId === c.userId ||
        r.status === "open"
      );
    if (r.kind === "volunteer")
      return r.owner_id === c.userId || r.status === "active";
    if (r.kind === "offer" && r.status === "draft")
      return (
        r.owner_id === c.userId ||
        !!this.db.get(
          "SELECT 1 FROM enrollments WHERE record_id=? AND user_id=?",
          r.id,
          c.userId,
        )
      );
    if (["source", "digest"].includes(r.kind))
      return u.role === "group_admin" || !!u.platform_admin;
    if (r.kind === "document")
      return (
        r.status === "verified" ||
        u.role === "group_admin" ||
        !!u.platform_admin
      );
    if (r.kind === "radar")
      return (
        r.status === "published" ||
        r.owner_id === c.userId ||
        u.role === "group_admin" ||
        !!u.platform_admin
      );
    if (r.kind === "challenge" && r.status === "draft")
      return (
        r.owner_id === c.userId ||
        u.role === "group_admin" ||
        !!u.platform_admin
      );
    return true;
  }
  get(c: Context, id: string, kind?: string) {
    this.member(c);
    const r = this.raw(id);
    check(
      r.group_id === c.groupId &&
        (!kind || r.kind === kind) &&
        this.canRead(c, r),
      "not_found",
      404,
    );
    return r;
  }
  createRecord(c: Context, kind: string, status: string, data: Row) {
    const id = uid(),
      n = this.now();
    this.db.run(
      "INSERT INTO records VALUES(?,?,?,?,?,1,?,?,?)",
      id,
      kind,
      c.groupId,
      c.userId,
      status,
      json(data),
      n,
      n,
    );
    const r = this.raw(id);
    this.snapshot(c, r);
    this.audit(c, kind + ".created", id);
    return r;
  }
  snapshot(c: Context, r: Entity) {
    this.db.run(
      "INSERT INTO versions VALUES(?,?,?,?,?,?)",
      r.id,
      r.version,
      c.userId,
      r.status,
      json(r.data),
      this.now(),
    );
  }
  save(c: Context, r: Entity, data = r.data, status = r.status) {
    this.db.run(
      "UPDATE records SET data=?,status=?,version=version+1,updated_at=? WHERE id=?",
      json(data),
      status,
      this.now(),
      r.id,
    );
    const next = this.raw(r.id);
    this.snapshot(c, next);
    this.audit(c, r.kind + "." + status, r.id);
    return next;
  }
  list(c: Context, kind: string) {
    this.member(c);
    return this.db
      .all(
        "SELECT id FROM records WHERE group_id=? AND kind=? ORDER BY created_at DESC",
        c.groupId,
        kind,
      )
      .map((r) => this.raw(r.id))
      .filter((r) => this.canRead(c, r))
      .map((r) => this.present(c, r));
  }
  present(c: Context, r: Entity): Row {
    const out = structuredClone(r);
    const mine = this.db.get(
      "SELECT * FROM enrollments WHERE record_id=? AND user_id=?",
      r.id,
      c.userId,
    );
    if (["meetup", "offer", "cohort"].includes(r.kind)) {
      const used = this.db.get(
        "SELECT COALESCE(SUM(seats),0) n FROM enrollments WHERE record_id=? AND status IN('confirmed','offered','reconfirm')",
        r.id,
      )!.n;
      out.data.remaining = Math.max(0, (r.data.capacity ?? 100) - used);
      out.data.enrollment = mine ?? null;
    }
    if (
      r.kind === "meetup" &&
      r.owner_id !== c.userId &&
      mine?.status !== "confirmed"
    )
      delete out.data.coordination;
    if (r.kind === "challenge" && r.status !== "closed") {
      out.data.questions = out.data.questions.map((q: Row) => ({
        prompt: q.prompt,
        options: q.options,
        points: q.points,
      }));
    }
    if (r.kind === "challenge")
      out.data.entry =
        this.db.get(
          "SELECT team,answers,points,submitted_at,visible FROM challenge_entries WHERE challenge_id=? AND user_id=?",
          r.id,
          c.userId,
        ) ?? null;
    if (r.kind === "housing_offer")
      out.data.stale = this.now() - r.data.confirmedAt > 7 * 86400000;
    if (r.kind === "radar") out.data.expired = r.data.expiresAt <= this.now();
    if (r.kind === "cohort")
      out.data.progress = parse(
        this.db.get(
          "SELECT data FROM progress WHERE cohort_id=? AND user_id=?",
          r.id,
          c.userId,
        )?.data ?? "{}",
      );
    return out;
  }
  enqueue(
    c: Context,
    r: Entity,
    kind: string,
    payload: Row,
    key: string,
    due = this.now(),
  ) {
    this.admin(c);
    const g = this.group(c);
    check(g.allowed && !g.paused, "group_publications_paused", 409);
    check(
      this.db.get("SELECT value FROM settings WHERE key='global_pause'")
        ?.value !== "true",
      "global_pause",
      409,
    );
    const existing = this.db.get(
      "SELECT * FROM outbox WHERE idempotency_key=?",
      key,
    );
    if (existing) return existing;
    const id = uid();
    this.db.run(
      "INSERT INTO outbox(id,group_id,actor_id,record_id,kind,payload,status,mode,idempotency_key,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      c.groupId,
      c.userId,
      r.id,
      kind,
      json(payload),
      "pending",
      this.mode,
      key,
      due,
      this.now(),
      this.now(),
    );
    return this.db.get("SELECT * FROM outbox WHERE id=?", id)!;
  }
  promote(r: Entity) {
    if (
      !["open", "confirmed"].includes(r.status) ||
      (r.data.deadline ?? r.data.startsAt ?? Infinity) <= this.now()
    )
      return;
    const used = this.db.get(
      "SELECT COALESCE(SUM(seats),0) n FROM enrollments WHERE record_id=? AND status IN('confirmed','offered','reconfirm')",
      r.id,
    )!.n;
    let remaining = r.data.capacity - used;
    for (const e of this.db.all(
      "SELECT * FROM enrollments WHERE record_id=? AND status='waitlisted' ORDER BY created_at,id",
      r.id,
    )) {
      if (e.seats > remaining) break;
      this.db.run(
        "UPDATE enrollments SET status='offered',offered_until=?,updated_at=? WHERE id=?",
        this.now() + 86400000,
        this.now(),
        e.id,
      );
      remaining -= e.seats;
    }
  }
  enroll(c: Context, r: Entity, input: Row) {
    check(["open", "confirmed"].includes(r.status), "enrollment_closed", 409);
    check(input.accept === true, "explicit_acceptance_required");
    check(input.version === r.version, "terms_changed", 409);
    check(
      (r.data.deadline ?? r.data.startsAt ?? Infinity) > this.now(),
      "enrollment_closed",
      409,
    );
    const seats = integer(input.seats ?? 1, "seats", 1, 6);
    const prev = this.db.get(
      "SELECT * FROM enrollments WHERE record_id=? AND user_id=?",
      r.id,
      c.userId,
    );
    if (prev?.status === "confirmed" && prev.accepted_version === r.version)
      return prev;
    if (prev && ["offered", "reconfirm"].includes(prev.status)) {
      check(prev.seats === seats, "seats_changed");
      check(
        !prev.offered_until || prev.offered_until > this.now(),
        "offer_expired",
        409,
      );
      this.db.run(
        "UPDATE enrollments SET status='confirmed',accepted_version=?,offered_until=NULL,updated_at=? WHERE id=?",
        r.version,
        this.now(),
        prev.id,
      );
      return this.db.get("SELECT * FROM enrollments WHERE id=?", prev.id)!;
    }
    if (prev?.status === "waitlisted") {
      check(prev.seats === seats, "seats_changed");
      this.db.run(
        "UPDATE enrollments SET accepted_version=?,updated_at=? WHERE id=?",
        r.version,
        this.now(),
        prev.id,
      );
      this.promote(r);
      return this.db.get("SELECT * FROM enrollments WHERE id=?", prev.id)!;
    }
    this.promote(r);
    const used = this.db.get(
      "SELECT COALESCE(SUM(seats),0) n FROM enrollments WHERE record_id=? AND status IN('confirmed','offered','reconfirm')",
      r.id,
    )!.n;
    const status = used + seats <= r.data.capacity ? "confirmed" : "waitlisted";
    this.db.run(
      "INSERT INTO enrollments(id,record_id,user_id,status,accepted_version,seats,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(record_id,user_id) DO UPDATE SET status=excluded.status,accepted_version=excluded.accepted_version,seats=excluded.seats,created_at=excluded.created_at,updated_at=excluded.updated_at",
      prev?.id ?? uid(),
      r.id,
      c.userId,
      status,
      r.version,
      seats,
      this.now(),
      this.now(),
    );
    this.audit(c, "enrollment." + status, r.id);
    return this.db.get(
      "SELECT * FROM enrollments WHERE record_id=? AND user_id=?",
      r.id,
      c.userId,
    )!;
  }
  leave(c: Context, r: Entity) {
    this.db.run(
      "UPDATE enrollments SET status='cancelled',offered_until=NULL,updated_at=? WHERE record_id=? AND user_id=?",
      this.now(),
      r.id,
      c.userId,
    );
    this.promote(r);
    this.audit(c, "enrollment.cancelled", r.id);
    return { status: "cancelled" };
  }
  expire() {
    this.db.tx(() => {
      for (const e of this.db.all(
        "SELECT * FROM enrollments WHERE status='offered' AND offered_until<=?",
        this.now(),
      )) {
        this.db.run(
          "UPDATE enrollments SET status='cancelled',updated_at=? WHERE id=?",
          this.now(),
          e.id,
        );
        this.promote(this.raw(e.record_id));
      }
      for (const r of this.db.all(
        "SELECT id FROM records WHERE kind='request' AND status='open' AND json_extract(data,'$.deadline')<=?",
        this.now(),
      )) {
        const item = this.raw(r.id);
        this.save(
          { userId: item.owner_id, groupId: item.group_id },
          item,
          item.data,
          "interest_closed",
        );
      }
    });
  }
}
export { check, text, integer, date, list, oneOf, url, uid, json, parse };
