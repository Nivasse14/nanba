import type { Domain } from "./modules.ts";
import { uid, json, parse, type Row } from "./db.ts";
import { check, Problem } from "./validation.ts";
import {
  TransportFailure,
  type WhatsAppConnector,
  type Message,
} from "./whatsapp.ts";
import { hash } from "./auth.ts";
import { Conversation } from "./conversation.ts";
import { publicActivity } from "./conversation-view.ts";
export class Worker {
  app: Domain;
  connector: WhatsAppConnector;
  busy = false;
  owner = uid();
  origin: string;
  constructor(app: Domain, connector: WhatsAppConnector, origin: string) {
    this.app = app;
    this.connector = connector;
    this.origin = origin;
  }
  recover() {
    this.app.db.run(
      "UPDATE outbox SET status='uncertain',error='interrupted_after_claim',updated_at=? WHERE status='sending'",
      this.app.now(),
    );
  }
  accept(event: Row) {
    const id = uid();
    const existing = this.app.db.get(
      "SELECT id FROM inbox WHERE provider=? AND session=? AND context=? AND event_key=?",
      event.provider,
      event.session,
      event.groupId,
      event.id,
    );
    if (existing) return { accepted: true, duplicate: true, id: existing.id };
    // Keep only normalized fields, never provider metadata or raw conversations.
    const stored = { ...event };
    if (stored.voter) {
      stored.identityHash = this.app.identity(
        stored.provider,
        stored.session,
        stored.voter,
      );
      delete stored.voter;
    }
    if (stored.sender) {
      stored.identityHash = this.app.identity(
        stored.provider,
        stored.session,
        stored.sender,
      );
      delete stored.sender;
    }
    this.app.db.run(
      "INSERT INTO inbox(id,provider,session,context,event_key,payload,created_at) VALUES(?,?,?,?,?,?,?)",
      id,
      event.provider,
      event.session,
      event.groupId,
      event.id,
      json(stored),
      this.app.now(),
    );
    return { accepted: true, duplicate: false, id };
  }
  processInbox() {
    const a = this.app;
    for (const e of a.db.all(
      "SELECT * FROM inbox WHERE status='pending' AND attempts<3 ORDER BY created_at LIMIT 30",
    )) {
      try {
        a.db.tx(() => {
          const p = parse(e.payload);
          if (p.type === "session") {
            a.db.run(
              "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
              "connector_status",
              p.status,
            );
          } else {
            const group = a.db.get(
              "SELECT * FROM groups WHERE id=? AND allowed=1",
              p.groupId,
            );
            check(group, "group_not_allowed", 403);
            if (p.type === "vote") this.applyStoredVote(p);
            else if (p.type === "command") this.command(p);
          }
          a.db.run(
            "UPDATE inbox SET status='processed',attempts=attempts+1,error=NULL WHERE id=?",
            e.id,
          );
        });
      } catch (error) {
        a.db.run(
          "UPDATE inbox SET attempts=attempts+1,status=CASE WHEN attempts>=2 THEN 'failed' ELSE 'pending' END,error=? WHERE id=?",
          error instanceof Problem ? error.code : "processing_failed",
          e.id,
        );
      }
    }
  }
  applyStoredVote(p: Row) {
    // Identities are already validated and pseudonymized at ingress; reuse original vote logic without recovering numbers.
    const a = this.app;
    const poll = a.db.get(
      "SELECT p.*,r.group_id FROM polls p JOIN records r ON r.id=p.id WHERE provider=? AND session=? AND message_id=?",
      p.provider,
      p.session,
      p.messageId,
    );
    check(poll && poll.group_id === p.groupId, "untracked_poll", 404);
    if (p.failed) {
      a.audit(
        { userId: a.raw(poll.id).owner_id, groupId: p.groupId },
        "vote.decrypt_failed",
        poll.id,
      );
      return;
    }
    check(p.at <= a.now() + 60000, "future_event");
    if (p.at > poll.deadline || a.now() > poll.deadline + 172800000) {
      a.audit(
        { userId: a.raw(poll.id).owner_id, groupId: p.groupId },
        "vote.late_ignored",
        poll.id,
      );
      return;
    }
    const valid = parse<Row[]>(poll.options);
    check(
      Array.isArray(p.choices) &&
        p.choices.every((x: string) => valid.some((o) => o.id === x)) &&
        (poll.multiple || p.choices.length <= 1),
      "invalid_choices",
    );
    const prev = a.db.get(
      "SELECT * FROM votes WHERE poll_id=? AND identity_hash=?",
      poll.id,
      p.identityHash,
    );
    if (prev && p.at < prev.at) return;
    if (prev && p.at === prev.at) {
      if (
        json([...p.choices].sort()) !==
        json(parse<string[]>(prev.choices).sort())
      )
        a.db.run(
          "UPDATE votes SET uncertain=1 WHERE poll_id=? AND identity_hash=?",
          poll.id,
          p.identityHash,
        );
      return;
    }
    a.db.run(
      "INSERT INTO votes VALUES(?,?,?,?,?,0) ON CONFLICT(poll_id,identity_hash) DO UPDATE SET choices=excluded.choices,at=excluded.at,event_id=excluded.event_id,uncertain=0",
      poll.id,
      p.identityHash,
      json(p.choices),
      p.at,
      p.id,
    );
    a.threshold(a.raw(poll.request_id));
  }
  command(p: Row) {
    const a = this.app;
    if (Math.abs(a.now() - p.at) > 600000) return;
    const identity = a.db.get(
      "SELECT * FROM identities WHERE identity_hash=?",
      p.identityHash,
    )!;
    const match = /^\/lier\s+([A-F0-9]{16})$/i.exec(p.body.trim());
    if (match) {
      const code = a.db.get(
        "SELECT * FROM link_codes WHERE code_hash=? AND group_id=? AND used_at IS NULL AND expires_at>?",
        hash(match[1].toUpperCase()),
        p.groupId,
        a.now(),
      );
      check(code, "invalid_link_code");
      a.member({ userId: code.user_id, groupId: p.groupId });
      check(
        !identity.user_id || identity.user_id === code.user_id,
        "identity_already_linked",
        409,
      );
      check(
        !a.db.get(
          "SELECT 1 FROM identities WHERE provider=? AND session=? AND user_id=? AND identity_hash!=?",
          p.provider,
          p.session,
          code.user_id,
          p.identityHash,
        ),
        "account_already_linked",
        409,
      );
      a.db.run(
        "UPDATE identities SET user_id=?,verified_at=? WHERE identity_hash=?",
        code.user_id,
        a.now(),
        p.identityHash,
      );
      a.db.run(
        "UPDATE link_codes SET used_at=? WHERE code_hash=?",
        a.now(),
        hash(match[1].toUpperCase()),
      );
      a.audit(
        { userId: code.user_id, groupId: p.groupId },
        "identity.verified",
      );
      return;
    }
    if (new Conversation(a).handle(p)) return;
    if (!identity.user_id) return;
    const c = { userId: identity.user_id, groupId: p.groupId };
    a.member(c);
    if (/^\/pause\b/.test(p.body)) {
      a.admin(c);
      a.db.run("UPDATE groups SET paused=1 WHERE id=?", p.groupId);
      a.db.run(
        "UPDATE outbox SET status='cancelled',error='group_paused',updated_at=? WHERE group_id=? AND status IN('pending','prepared')",
        a.now(),
        p.groupId,
      );
      a.audit(c, "group.paused");
      return;
    }
    // Command replies are editorial drafts. Publication still needs a group administrator.
    const reply = /^\/(aide|help)/i.test(p.body)
      ? "Nanba aide à proposer, voter et se rencontrer. Seuls les messages adressés au bot sont traités. Les votes ne sont pas anonymes pour Nanba. Les données privées restent dans votre espace. /proposer /événements /résultats /signaler."
      : /^\/proposer/i.test(p.body)
        ? "Proposez une activité dans Nanba : " + this.origin + "/#request"
        : /^\/(événements|evenements)/i.test(p.body)
          ? "Rencontres et inscriptions : " + this.origin + "/#meetup"
          : /^\/(résultats|resultats)/i.test(p.body)
            ? "Résultats calculés dans Nanba : " + this.origin + "/#challenge"
            : /^\/signaler/i.test(p.body)
              ? "Soumettez une information avec sa provenance : " +
                this.origin +
                "/#radar"
              : "Votre demande peut être préparée dans Nanba : " +
                this.origin +
                "/#assistant";
    const r = a.createRecord(c, "command_draft", "draft", {
      title: "Réponse à une commande",
      text: reply,
      replyTo: p.id,
    });
    a.audit(c, "command.draft_prepared", r.id);
  }
  validJob(job: Row) {
    const a = this.app,
      c = { userId: job.actor_id, groupId: job.group_id };
    a.admin(c);
    const group = a.group(c);
    check(group.allowed && !group.paused, "group_paused", 409);
    check(
      a.db.get("SELECT value FROM settings WHERE key='global_pause'")?.value !==
        "true",
      "global_pause",
      409,
    );
    check(job.mode === this.connector.mode, "mode_mismatch");
    const r = a.raw(job.record_id);
    check(r.group_id === job.group_id, "scope_mismatch");
    if (job.kind === "poll") {
      const request = a.raw(r.data.requestId);
      check(
        !["cancelled", "completed"].includes(request.status) &&
          request.data.deadline > a.now(),
        "poll_expired",
        409,
      );
    }
    if (job.kind === "story")
      check(
        r.status === "published" && r.data.audiences.includes("whatsapp"),
        "consent_revoked",
        403,
      );
    if (job.kind === "link")
      check(["open", "confirmed"].includes(r.status), "activity_closed", 409);
    if (job.kind === "activity") {
      check(
        ["meetup", "offer", "cohort", "radar", "challenge"].includes(r.kind) &&
          ["open", "confirmed", "published", "registration", "closed"].includes(
            r.status,
          ) &&
          r.version === parse(job.payload).version &&
          (r.data.expiresAt ?? Infinity) > a.now(),
        "activity_changed",
        409,
      );
    }
    if (job.kind === "digest") {
      check(r.status === "approved", "digest_unapproved", 403);
      for (const id of r.data.documentIds) {
        const d = a.get(c, id, "document");
        check(
          d.status === "verified" && d.data.expiresAt > a.now(),
          "source_expired",
          409,
        );
      }
    }
    if (job.kind === "command")
      check(r.status === "approved", "command_unapproved", 403);
    if (job.kind === "assistant") {
      if (r.data.replyChatId)
        check(
          group.chat_id === r.data.replyChatId,
          "reply_destination_changed",
          403,
        );
      check(new Conversation(a).enabled(group), "assistant_disabled", 403);
      check(
        r.kind === "assistant_reply" &&
          r.status === "approved" &&
          r.data.automatic,
        "assistant_unapproved",
        403,
      );
      if (r.data.identityHash) {
        const identity = a.db.get(
          "SELECT user_id FROM identities WHERE identity_hash=?",
          r.data.identityHash,
        );
        check(identity, "identity_removed", 403);
        if (identity.user_id)
          a.member({ userId: identity.user_id, groupId: job.group_id });
        if (r.data.scopeGroupId && identity.user_id) {
          const scope = {
            userId: identity.user_id,
            groupId: r.data.scopeGroupId,
          };
          a.member(scope);
          check(a.group(scope).allowed, "scope_not_allowed", 403);
          for (const ref of r.data.recordRefs ?? []) {
            const current = a.get(scope, ref.id);
            check(
              current.version === ref.version,
              "reply_content_changed",
              409,
            );
            if (ref.projectionHash)
              check(
                hash(json(a.present(scope, current))) === ref.projectionHash,
                "reply_access_changed",
                403,
              );
            if (
              current.kind === "story" &&
              current.owner_id !== identity.user_id
            )
              check(
                current.data.audiences.includes("whatsapp"),
                "channel_consent_required",
                403,
              );
          }
        }
        if (r.data.privateResponse) {
          const settings = parse(group.settings);
          if (settings.privateChat && r.data.scopeGroupId)
            check(
              settings.scopeGroupId === r.data.scopeGroupId,
              "reply_scope_changed",
              403,
            );
          check(
            settings.selfTest ||
              (settings.privateChat &&
                settings.privateIdentity === r.data.identityHash &&
                settings.privateUser === identity.user_id),
            "private_recipient_changed",
            403,
          );
        }
      }
    }
    return { group, r };
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    const a = this.app;
    try {
      const acquired = a.db.tx(() => {
        const lease = a.db.get(
          "SELECT value FROM settings WHERE key='worker_lease'",
        );
        if (lease) {
          const l = parse(lease.value);
          if (l.until > a.now() && l.owner !== this.owner) return false;
        }
        a.db.run(
          "INSERT INTO settings VALUES('worker_lease',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          json({ owner: this.owner, until: a.now() + 60000 }),
        );
        return true;
      });
      if (!acquired) return;
      this.processInbox();
      a.expire();
      const health = await this.connector.health();
      a.db.run(
        "INSERT INTO settings VALUES('transport_health',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        json({ ...health, checkedAt: a.now() }),
      );
      if (!["connected", "simulated"].includes(health.status)) return;
      for (let i = 0; i < 4; i++) {
        const job = a.db.tx(() => {
          const j = a.db.get(
            "SELECT * FROM outbox WHERE status='pending' AND due_at<=? ORDER BY due_at,created_at LIMIT 1",
            a.now(),
          );
          if (!j) return null;
          try {
            this.validJob(j);
          } catch (e) {
            a.db.run(
              "UPDATE outbox SET status='cancelled',error=?,updated_at=? WHERE id=?",
              e instanceof Problem ? e.code : "authorization_failed",
              a.now(),
              j.id,
            );
            return null;
          }
          a.db.run(
            "UPDATE outbox SET status='sending',updated_at=? WHERE id=?",
            a.now(),
            j.id,
          );
          return j;
        });
        if (!job) break;
        try {
          const { group, r } = this.validJob(job);
          const p = parse(job.payload);
          let message: Message;
          if (job.kind === "poll")
            message = {
              chatId: group.chat_id,
              kind: "poll",
              question: p.question,
              options: p.options,
              multiple: p.multiple,
            };
          else {
            let content: string;
            if (job.kind === "activity") content = publicActivity(a, r);
            else if (job.kind === "story")
              content =
                r.data.title +
                "\n" +
                r.data.original +
                "\n\n" +
                r.data.translation +
                "\n— " +
                r.data.credit;
            else if (job.kind === "digest")
              content =
                p.title +
                "\n" +
                r.data.documentIds
                  .map((id: string) => {
                    const d = a.raw(id);
                    return d.data.title + " — " + d.data.url;
                  })
                  .join("\n");
            else if (["command", "assistant"].includes(job.kind))
              content = r.data.text;
            else content = p.title + "\n" + this.origin + p.path;
            message = {
              chatId: group.chat_id,
              kind: "text",
              text: content,
              replyTo: ["command", "assistant"].includes(job.kind)
                ? r.data.replyTo
                : undefined,
            };
          }
          const result = await this.connector.send(message);
          check(
            result.simulated === (job.mode === "simulated"),
            "transport_mode_violation",
            502,
          );
          a.db.tx(() => {
            a.db.run(
              "UPDATE outbox SET status=?,provider_id=?,updated_at=?,error=NULL WHERE id=?",
              result.simulated ? "simulated" : "confirmed",
              result.id,
              a.now(),
              job.id,
            );
            if (job.kind === "poll") {
              a.db.run(
                "UPDATE polls SET message_id=? WHERE id=?",
                result.id,
                job.record_id,
              );
              a.save(
                { userId: job.actor_id, groupId: job.group_id },
                r,
                r.data,
                result.simulated ? "simulated" : "published",
              );
            }
          });
        } catch (e) {
          const uncertain =
            e instanceof TransportFailure
              ? e.uncertain
              : !(e instanceof Problem);
          a.db.run(
            "UPDATE outbox SET status=?,error=?,updated_at=? WHERE id=?",
            uncertain ? "uncertain" : "failed",
            e instanceof TransportFailure
              ? e.message
              : e instanceof Problem
                ? e.code
                : "send_failed",
            a.now(),
            job.id,
          );
        }
      }
    } finally {
      a.db.run(
        "DELETE FROM settings WHERE key='worker_lease' AND json_extract(value,'$.owner')=?",
        this.owner,
      );
      this.busy = false;
    }
  }
}
