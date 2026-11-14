import type { Domain } from "./modules.ts";
import { json, parse, uid, type Row } from "./db.ts";
import { check, text, list, oneOf, integer } from "./validation.ts";
import type { Context } from "./core.ts";
import { passwordValid, hash } from "./auth.ts";
export class Administration {
  app: Domain;
  constructor(app: Domain) {
    this.app = app;
  }
  dashboard(c: Context) {
    const a = this.app;
    a.admin(c);
    a.audit(c, "admin.view");
    return {
      group: a.group(c),
      outbox: a.db.all(
        "SELECT id,kind,status,mode,provider_id,due_at,created_at,error FROM outbox WHERE group_id=? ORDER BY created_at DESC LIMIT 100",
        c.groupId,
      ),
      inbox: a.db.all(
        "SELECT id,status,attempts,error,created_at FROM inbox WHERE context=? ORDER BY created_at DESC LIMIT 50",
        c.groupId,
      ),
      audit: a.db.all(
        "SELECT action,target_id,at FROM audit WHERE group_id=? ORDER BY at DESC LIMIT 100",
        c.groupId,
      ),
      reports: a.db.all(
        "SELECT id,target_id,reason,status,created_at FROM reports WHERE group_id=? ORDER BY created_at DESC LIMIT 50",
        c.groupId,
      ),
      members: a.db.all(
        "SELECT u.id,u.name,m.role,m.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=?",
        c.groupId,
      ),
      partners: a.db.all(
        "SELECT DISTINCT o.* FROM organizations o JOIN users u ON u.org_id=o.id JOIN memberships m ON m.user_id=u.id WHERE m.group_id=?",
        c.groupId,
      ),
      drafts: a.db
        .all(
          "SELECT id FROM records WHERE group_id=? AND kind='command_draft' AND status='draft'",
          c.groupId,
        )
        .map((r) => a.raw(r.id)),
      metrics: {
        pending: a.db.get(
          "SELECT COUNT(*) n FROM outbox WHERE group_id=? AND status='pending'",
          c.groupId,
        )!.n,
        uncertain: a.db.get(
          "SELECT COUNT(*) n FROM outbox WHERE group_id=? AND status='uncertain'",
          c.groupId,
        )!.n,
        decryptFailures: a.db.get(
          "SELECT COUNT(*) n FROM audit WHERE group_id=? AND action='vote.decrypt_failed'",
          c.groupId,
        )!.n,
        oldestPendingAt: a.db.get(
          "SELECT MIN(created_at) n FROM inbox WHERE context=? AND status='pending'",
          c.groupId,
        )!.n,
        failedJobs: a.db.get(
          "SELECT COUNT(*) n FROM inbox WHERE context=? AND status='failed'",
          c.groupId,
        )!.n,
        ai: a.db.all(
          "SELECT day,SUM(calls) calls,SUM(tokens) tokens,SUM(failures) failures,SUM(latency_ms) latencyMs FROM ai_usage WHERE group_id=? GROUP BY day ORDER BY day DESC LIMIT 7",
          c.groupId,
        ),
        confirmedRegistrations: a.db.get(
          "SELECT COUNT(*) n FROM enrollments e JOIN records r ON r.id=e.record_id WHERE r.group_id=? AND e.status='confirmed'",
          c.groupId,
        )!.n,
        staleSources: a.db.get(
          "SELECT COUNT(*) n FROM records WHERE group_id=? AND kind='source' AND (json_extract(data,'$.lastCollected') IS NULL OR json_extract(data,'$.lastCollected') + json_extract(data,'$.freshnessHours') * 3600000 < ?)",
          c.groupId,
          a.now(),
        )!.n,
      },
      globalPaused:
        a.db.get("SELECT value FROM settings WHERE key='global_pause'")
          ?.value === "true",
      health: parse(
        a.db.get("SELECT value FROM settings WHERE key='transport_health'")
          ?.value ?? '{"status":"unknown"}',
      ),
    };
  }
  action(c: Context, action: string, b: Row) {
    const a = this.app;
    return a.db.tx(() => {
      const u = a.admin(c);
      if (action === "group") {
        const g = a.group(c);
        check(
          !parse(g.settings).privateChat && !parse(g.settings).selfTest,
          "private_route_immutable",
          403,
        );
        a.db.run(
          "UPDATE groups SET name=?,allowed=?,paused=?,chat_id=? WHERE id=?",
          b.name ? text(b.name, "name", 120) : g.name,
          b.allowed === undefined ? g.allowed : b.allowed ? 1 : 0,
          b.paused === undefined ? g.paused : b.paused ? 1 : 0,
          b.chatId ? this.chatId(b.chatId) : g.chat_id,
          c.groupId,
        );
        if (b.paused === true || b.allowed === false)
          a.db.run(
            "UPDATE outbox SET status='cancelled',error='group_paused_or_revoked',updated_at=? WHERE group_id=? AND status IN('pending','prepared')",
            a.now(),
            c.groupId,
          );
        a.audit(c, "group.updated");
        return a.group(c);
      }
      if (action === "global_pause") {
        check(u.platform_admin, "platform_admin_required", 403);
        a.db.run(
          "INSERT INTO settings VALUES('global_pause',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          b.paused ? "true" : "false",
        );
        if (b.paused)
          a.db.run(
            "UPDATE outbox SET status='cancelled',error='global_pause',updated_at=? WHERE status IN('pending','prepared')",
            a.now(),
          );
        a.audit(c, "global_pause.updated");
        return { paused: !!b.paused };
      }
      if (action === "member") {
        check(u.platform_admin, "platform_admin_required", 403);
        const userId = text(b.userId, "userId");
        a.user(userId);
        const role = oneOf(
          b.role,
          ["member", "organizer", "professional", "group_admin"],
          "role",
        );
        if (role === "professional")
          check(a.user(userId).org_id, "organization_required");
        check(userId !== c.userId || b.active !== false, "cannot_remove_self");
        a.db.run(
          "INSERT INTO memberships VALUES(?,?,?,?) ON CONFLICT(user_id,group_id) DO UPDATE SET role=excluded.role,active=excluded.active",
          userId,
          c.groupId,
          role,
          b.active === false ? 0 : 1,
        );
        a.audit(c, "membership.updated", userId);
        return { updated: true };
      }
      if (action === "new_group") {
        check(u.platform_admin, "platform_admin_required", 403);
        const id = uid();
        a.db.run(
          "INSERT INTO groups(id,community_id,name,zone,chat_id,allowed) VALUES(?,?,?,?,?,0)",
          id,
          a.group(c).community_id,
          text(b.name, "name", 120),
          text(b.zone, "zone", 120),
          this.chatId(b.chatId),
        );
        a.db.run(
          "INSERT INTO memberships VALUES(?,?,?,1)",
          c.userId,
          id,
          "group_admin",
        );
        return { id };
      }
      if (action === "partner") {
        check(u.platform_admin, "platform_admin_required", 403);
        const id = text(b.orgId, "orgId");
        check(
          a.db.get("SELECT 1 FROM organizations WHERE id=?", id),
          "not_found",
          404,
        );
        a.db.run(
          "UPDATE organizations SET active=? WHERE id=?",
          b.active ? 1 : 0,
          id,
        );
        a.audit(c, "partner.updated", id);
        return { updated: true };
      }
      if (action === "report_resolve") {
        const r = a.db.get(
          "SELECT * FROM reports WHERE id=? AND group_id=?",
          b.id,
          c.groupId,
        );
        check(r, "not_found", 404);
        a.db.run("UPDATE reports SET status='resolved' WHERE id=?", r.id);
        a.audit(c, "report.resolved", r.id);
        return { resolved: true };
      }
      if (action === "approve_command") {
        const r = a.get(c, b.id, "command_draft");
        check(r.status === "draft", "invalid_state", 409);
        const approved = a.save(c, r, r.data, "approved");
        return a.enqueue(c, approved, "command", {}, "command:" + r.id);
      }
      if (action === "cancel_job") {
        const row = a.db.get(
          "SELECT * FROM outbox WHERE id=? AND group_id=?",
          b.id,
          c.groupId,
        );
        check(row, "not_found", 404);
        check(
          ["pending", "prepared", "failed"].includes(row.status),
          "job_not_cancellable",
          409,
        );
        a.db.run(
          "UPDATE outbox SET status='cancelled',updated_at=? WHERE id=?",
          a.now(),
          row.id,
        );
        a.audit(c, "outbox.cancelled", row.id);
        return { cancelled: true };
      }
      if (action === "reconcile") {
        const row = a.db.get(
          "SELECT * FROM outbox WHERE id=? AND group_id=?",
          b.id,
          c.groupId,
        );
        check(row?.status === "uncertain", "not_uncertain", 409);
        const providerId = text(b.providerId, "providerId", 500),
          evidence = text(b.evidence, "evidence", 500);
        check(evidence.length >= 12, "reconciliation_evidence_required");
        check(
          row.mode === "simulated"
            ? providerId.startsWith("simulated:")
            : !providerId.startsWith("simulated:"),
          "mode_mismatch",
        );
        a.db.run(
          "UPDATE outbox SET status=?,provider_id=?,error=?,updated_at=? WHERE id=?",
          row.mode === "simulated" ? "simulated" : "confirmed",
          providerId,
          "manually_reconciled",
          a.now(),
          row.id,
        );
        if (row.kind === "poll") {
          a.db.run(
            "UPDATE polls SET message_id=? WHERE id=?",
            providerId,
            row.record_id,
          );
          const r = a.raw(row.record_id);
          a.save(
            c,
            r,
            r.data,
            row.mode === "simulated" ? "simulated" : "published",
          );
        }
        a.createRecord(c, "reconciliation", "recorded", {
          title: "Réconciliation de publication",
          outboxId: row.id,
          evidence,
          providerId,
        });
        a.audit(c, "outbox.manual_reconciliation", row.id);
        return { reconciled: true };
      }
      throw new Error("unknown_admin_action");
    });
  }
  chatId(value: unknown) {
    const s = text(value, "chatId", 150);
    check(/^[0-9-]+@g\.us$/.test(s), "invalid_group_id");
    return s;
  }
  preferences(c: Context, b: Row) {
    const a = this.app;
    a.member(c);
    const prefs = {
      language: oneOf(b.language, ["fr", "en", "ta", "tanglish"], "language"),
      zone: text(b.zone, "zone", 120),
      notifications: b.notifications === true,
      commercial: b.commercial === true,
      visibility: b.visibility === true,
      format: oneOf(b.format ?? "solo", ["solo", "couple", "family"], "format"),
    };
    a.db.run(
      "UPDATE users SET preferences=? WHERE id=?",
      json(prefs),
      c.userId,
    );
    a.audit(c, "consent.preferences_updated");
    return prefs;
  }
  export(c: Context) {
    const a = this.app;
    a.member(c);
    const u = a.user(c.userId);
    a.audit(c, "privacy.export");
    return {
      profile: {
        id: u.id,
        name: u.name,
        email: u.email,
        preferences: parse(u.preferences),
      },
      records: a.db
        .all("SELECT id FROM records WHERE owner_id=?", c.userId)
        .map((r) => a.raw(r.id)),
      enrollments: a.db.all(
        "SELECT * FROM enrollments WHERE user_id=?",
        c.userId,
      ),
      interests: a.db.all("SELECT * FROM interests WHERE user_id=?", c.userId),
      votes: a.db.all(
        "SELECT v.poll_id,v.choices,v.at,v.uncertain FROM votes v JOIN identities i USING(identity_hash) WHERE i.user_id=?",
        c.userId,
      ),
      progress: a.db.all("SELECT * FROM progress WHERE user_id=?", c.userId),
      challengeEntries: a.db.all(
        "SELECT * FROM challenge_entries WHERE user_id=?",
        c.userId,
      ),
      feedback: a.db.all("SELECT * FROM feedback WHERE user_id=?", c.userId),
    };
  }
  erase(c: Context, password: string) {
    const a = this.app;
    a.member(c);
    check(
      passwordValid(password, a.user(c.userId).password),
      "invalid_password",
      403,
    );
    return a.db.tx(() => {
      const affected = a.db.all(
        "SELECT record_id FROM enrollments WHERE user_id=? AND status IN('confirmed','offered','reconfirm')",
        c.userId,
      );
      a.db.run(
        "UPDATE enrollments SET status='cancelled',updated_at=? WHERE user_id=?",
        a.now(),
        c.userId,
      );
      affected.forEach((e) => a.promote(a.raw(e.record_id)));
      for (const r of a.db.all(
        "SELECT id FROM records WHERE owner_id=?",
        c.userId,
      )) {
        a.db.run(
          "UPDATE enrollments SET status='cancelled',updated_at=? WHERE record_id=?",
          a.now(),
          r.id,
        );
        a.db.run(
          "UPDATE payment_orders SET status='stale' WHERE enrollment_id IN(SELECT id FROM enrollments WHERE record_id=?) AND status NOT IN('paid','refunded')",
          r.id,
        );
        a.db.run(
          "UPDATE records SET data='{}',status='removed' WHERE id=?",
          r.id,
        );
        a.db.run(
          "UPDATE versions SET data='{}',actor_id='deleted' WHERE record_id=?",
          r.id,
        );
        a.db.run(
          "UPDATE outbox SET status='cancelled',payload='{}' WHERE record_id=? AND status IN('pending','prepared')",
          r.id,
        );
      }
      for (const h of a.db.all(
        "SELECT id FROM records WHERE kind='help' AND json_extract(data,'$.volunteerId')=? AND status IN('proposed','accepted')",
        c.userId,
      )) {
        const item = a.raw(h.id);
        a.save(
          { userId: item.owner_id, groupId: item.group_id },
          item,
          {
            ...item.data,
            volunteerId: null,
            volunteerAccepted: false,
            requesterAccepted: false,
          },
          item.data.startsAt > a.now() ? "open" : "cancelled",
        );
      }
      for (const identity of a.db.all(
        "SELECT identity_hash FROM identities WHERE user_id=?",
        c.userId,
      )) {
        a.db.run(
          "DELETE FROM votes WHERE identity_hash=?",
          identity.identity_hash,
        );
        a.db.run(
          "DELETE FROM inbox WHERE json_extract(payload,'$.identityHash')=?",
          identity.identity_hash,
        );
      }
      a.db.run("DELETE FROM identities WHERE user_id=?", c.userId);
      for (const table of [
        "sessions",
        "link_codes",
        "progress",
        "feedback",
        "interests",
        "ai_usage",
      ])
        a.db.run(`DELETE FROM ${table} WHERE user_id=?`, c.userId);
      a.db.run("UPDATE memberships SET active=0 WHERE user_id=?", c.userId);
      a.db.run(
        "UPDATE users SET name='Compte supprimé',email=?,password='',preferences='{}',org_id=NULL,platform_admin=0,deleted=1 WHERE id=?",
        "deleted-" + uid() + "@invalid.test",
        c.userId,
      );
      a.db.run("UPDATE audit SET actor_id=NULL WHERE actor_id=?", c.userId);
      a.db.run(
        "UPDATE reports SET reason='Contenu supprimé' WHERE user_id=?",
        c.userId,
      );
      a.db.run(
        "UPDATE challenge_entries SET visible=0,answers=NULL WHERE user_id=?",
        c.userId,
      );
      return {
        deleted: true,
        externalCopies:
          "Les copies déjà partagées hors de Nanba ne peuvent pas être garanties supprimées.",
      };
    });
  }
  retention() {
    const a = this.app;
    const cutoff =
      a.now() -
      integer(Number(process.env.RETENTION_DAYS ?? 90), "retention", 1, 3650) *
        86400000;
    a.db.run(
      "DELETE FROM inbox WHERE created_at<? AND status='processed'",
      cutoff,
    );
    a.db.run("DELETE FROM sessions WHERE expires_at<?", a.now());
    a.db.run("DELETE FROM link_codes WHERE expires_at<?", a.now());
    a.db.run("DELETE FROM rate_limits WHERE reset_at<?", a.now());
    a.db.run("DELETE FROM audit WHERE at<?", cutoff);
  }
}
