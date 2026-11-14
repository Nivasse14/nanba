import { Collective } from "./collective.ts";
import {
  check,
  text,
  integer,
  date,
  list,
  oneOf,
  url,
  uid,
  json,
  parse,
  type Context,
  type Entity,
} from "./core.ts";
import type { Row } from "./db.ts";
import { Problem } from "./validation.ts";
export const kinds = [
  "request",
  "offer",
  "meetup",
  "housing",
  "housing_offer",
  "volunteer",
  "help",
  "radar",
  "cohort",
  "challenge",
  "story",
  "source",
  "document",
  "digest",
] as const;
export class Domain extends Collective {
  create(c: Context, kind: string, b: Row): Entity {
    return this.db.tx(() => {
      this.member(c);
      switch (kind) {
        case "request":
          return this.request(c, b);
        case "offer":
          return this.offer(c, b);
        case "meetup": {
          this.role(c, ["organizer", "group_admin"]);
          const startsAt = date(b.startsAt, "startsAt");
          check(startsAt > this.now(), "date_in_past");
          return this.createRecord(c, kind, "open", {
            title: text(b.title, "title", 160),
            description: text(b.description, "description"),
            activity: text(b.activity, "activity", 60),
            zone: text(b.zone, "zone", 120),
            place: text(b.place, "place", 200),
            language: oneOf(
              b.language,
              ["fr", "en", "ta", "tanglish"],
              "language",
            ),
            format: oneOf(
              b.format,
              ["solo", "couple", "family", "all"],
              "format",
            ),
            startsAt,
            timezone: "Europe/Paris",
            capacity: integer(b.capacity ?? 6, "capacity", 2, 30),
            coordination: text(b.coordination, "coordination", 500),
            organizer: this.user(c.userId).name,
          });
        }
        case "housing": {
          const sharedWith = list(b.sharedWith ?? [], "sharedWith");
          for (const id of sharedWith)
            check(
              this.db.get(
                "SELECT 1 FROM organizations o JOIN users u ON u.org_id=o.id JOIN memberships m ON m.user_id=u.id WHERE o.id=? AND o.active=1 AND m.group_id=? AND m.role='professional' AND m.active=1",
                id,
                c.groupId,
              ),
              "unknown_professional",
            );
          return this.createRecord(c, kind, "active", {
            title: text(b.title, "title", 160),
            zone: text(b.zone, "zone", 120),
            budget: integer(b.budget, "budget"),
            currency: "EUR",
            moveDate: date(b.moveDate, "moveDate"),
            duration: text(b.duration, "duration", 100),
            criteria: text(b.criteria, "criteria", 1500),
            sharedWith,
            consentAt: this.now(),
          });
        }
        case "housing_offer": {
          const u = this.professional(c),
            r = this.get(c, text(b.requestId, "requestId"), "housing");
          check(r.status === "active", "request_closed", 409);
          const confirmedAt = date(b.confirmedAt, "confirmedAt");
          check(confirmedAt <= this.now(), "confirmation_in_future");
          return this.createRecord(c, kind, "proposed", {
            title: text(b.title, "title", 160),
            requestId: r.id,
            listingRef: text(b.listingRef, "listingRef", 300),
            source: url(b.source),
            description: text(b.description, "description"),
            price: integer(b.price, "price"),
            currency: "EUR",
            confirmedAt,
            orgId: u.org_id,
            contactRequested: false,
            interested: false,
          });
        }
        case "volunteer": {
          check(
            !this.db.get(
              "SELECT 1 FROM records WHERE kind='volunteer' AND owner_id=? AND group_id=?",
              c.userId,
              c.groupId,
            ),
            "profile_exists",
            409,
          );
          const slots = this.validSlots(b.slots);
          return this.createRecord(c, kind, "active", {
            title: this.user(c.userId).name,
            skills: list(b.skills, "skills"),
            languages: list(b.languages, "languages"),
            maxDuration: integer(b.maxDuration ?? 20, "maxDuration", 5, 60),
            maxPerWeek: integer(b.maxPerWeek ?? 2, "maxPerWeek", 1, 10),
            slots,
            notifications: b.notifications === true,
          });
        }
        case "help": {
          const start = date(b.startsAt, "startsAt"),
            duration = integer(b.duration ?? 20, "duration", 5, 60);
          check(start > this.now(), "date_in_past");
          return this.createRecord(c, kind, "open", {
            title: text(b.title, "title", 160),
            theme: text(b.theme, "theme", 60),
            outcome: text(b.outcome, "outcome", 1000),
            language: text(b.language, "language", 20),
            startsAt: start,
            duration,
            endsAt: start + duration * 60000,
            volunteerId: null,
            volunteerAccepted: false,
            requesterAccepted: false,
            paid: false,
          });
        }
        case "radar": {
          const observedAt = date(b.observedAt, "observedAt");
          check(observedAt <= this.now(), "observation_in_future");
          const category = oneOf(
            b.category,
            ["product", "hours", "event", "other"],
            "category",
          );
          const ttl = { product: 24, hours: 72, event: 168, other: 48 }[
            category
          ];
          const title = text(b.title, "title", 160),
            place = text(b.place, "place", 200);
          const duplicate = this.db.get(
            "SELECT id FROM records WHERE group_id=? AND kind='radar' AND status IN('pending','published') AND lower(json_extract(data,'$.title'))=lower(?) AND lower(json_extract(data,'$.place'))=lower(?) AND json_extract(data,'$.expiresAt')>?",
            c.groupId,
            title,
            place,
            this.now(),
          );
          check(!duplicate, "duplicate_report", 409);
          return this.createRecord(c, kind, "pending", {
            title,
            description: text(b.description, "description"),
            category,
            place,
            zone: text(b.zone, "zone", 120),
            observedAt,
            collectedAt: this.now(),
            expiresAt: observedAt + ttl * 3600000,
            confirmation: "member",
            evidence: b.evidence ? url(b.evidence) : null,
            disputes: 0,
          });
        }
        case "cohort": {
          this.role(c, ["organizer", "group_admin"]);
          const steps = list(b.steps, "steps");
          check(steps.length > 0, "steps_required");
          const resources = this.validResources(b.resources ?? []);
          return this.createRecord(c, kind, "open", {
            title: text(b.title, "title", 160),
            zone: text(b.zone, "zone", 120),
            period: text(b.period, "period", 120),
            themes: list(b.themes, "themes"),
            steps,
            resources,
            capacity: integer(b.capacity ?? 30, "capacity", 1, 200),
            facilitator: this.user(c.userId).name,
          });
        }
        case "challenge": {
          this.admin(c);
          check(
            Array.isArray(b.questions) &&
              b.questions.length > 0 &&
              b.questions.length <= 20,
            "invalid_questions",
          );
          const questions = b.questions.map((q: Row) => {
            const options = list(q.options, "options", 10);
            check(options.length >= 2, "invalid_options");
            return {
              prompt: text(q.prompt, "prompt", 300),
              options,
              answer: integer(q.answer, "answer", 0, options.length - 1),
              points: integer(q.points ?? 1, "points", 1, 100),
            };
          });
          const deadline = date(b.deadline, "deadline");
          check(deadline > this.now(), "date_in_past");
          const teams = list(b.teams, "teams", 10);
          check(teams.length > 1, "teams_required");
          return this.createRecord(c, kind, "draft", {
            title: text(b.title, "title", 160),
            description: text(b.description, "description"),
            questions,
            teams,
            deadline,
            rulesVersion: 1,
            rule: "Somme des points / membres inscrits à l’ouverture. Une réponse par membre. Absence = 0.",
            denominators: {},
            sources: list(b.sources ?? [], "sources"),
            verified: false,
          });
        }
        case "story": {
          return this.createRecord(c, kind, "draft", {
            title: text(b.title, "title", 160),
            original: text(b.original, "original", 1500),
            translation: b.translation
              ? text(b.translation, "translation", 1500)
              : "",
            language: oneOf(
              b.language,
              ["fr", "en", "ta", "tanglish"],
              "language",
            ),
            translationLanguage: oneOf(
              b.translationLanguage ?? "en",
              ["fr", "en", "ta"],
              "translationLanguage",
            ),
            credit: text(b.credit, "credit", 100),
            storyType: oneOf(
              b.storyType ?? "personal",
              ["personal", "verified_history"],
              "storyType",
            ),
            audiences: [],
            translationUncertain: true,
            rightsConfirmed: false,
          });
        }
        case "source": {
          this.admin(c);
          const sourceUrl = url(b.url);
          return this.createRecord(c, kind, "active", {
            title: text(b.title, "title", 160),
            url: sourceUrl,
            publisher: text(b.publisher, "publisher", 160),
            format: oneOf(b.format, ["json", "rss"], "format"),
            category: oneOf(
              b.category,
              ["culture", "events", "administrative", "other"],
              "category",
            ),
            zone: text(b.zone, "zone", 120),
            language: oneOf(b.language, ["fr", "en", "ta"], "language"),
            frequencyHours: integer(
              b.frequencyHours ?? 24,
              "frequencyHours",
              1,
              720,
            ),
            freshnessHours: integer(
              b.freshnessHours ?? 168,
              "freshnessHours",
              1,
              8760,
            ),
            official: b.official === true,
            lastCollected: null,
            lastError: null,
          });
        }
        case "document": {
          this.admin(c);
          return this.createRecord(c, kind, "pending", this.documentData(b));
        }
        case "digest": {
          this.admin(c);
          const ids = list(b.documentIds, "documentIds", 10);
          check(ids.length > 0, "documents_required");
          for (const id of ids) {
            const d = this.get(c, id, "document");
            check(
              d.status === "verified" && d.data.expiresAt > this.now(),
              "document_not_current",
            );
          }
          return this.createRecord(c, kind, "draft", {
            title: text(b.title, "title", 160),
            documentIds: ids,
            dueAt: date(b.dueAt, "dueAt"),
          });
        }
        default:
          throw new Problem(400, "unknown_kind");
      }
    });
  }
  validSlots(value: unknown) {
    check(
      Array.isArray(value) && value.length > 0 && value.length <= 20,
      "invalid_slots",
    );
    return value.map((s: Row) => {
      const start = date(s.start, "start"),
        end = date(s.end, "end");
      check(end > start, "invalid_slot");
      return { start, end };
    });
  }
  validResources(value: unknown) {
    check(Array.isArray(value) && value.length <= 30, "invalid_resources");
    return value.map((r: Row) => ({
      title: text(r.title, "title", 160),
      url: url(r.url),
      verifiedAt: date(r.verifiedAt, "verifiedAt"),
    }));
  }
  documentData(b: Row) {
    const publishedAt = b.publishedAt
      ? date(b.publishedAt, "publishedAt")
      : null;
    return {
      title: text(b.title, "title", 200),
      url: url(b.url),
      publisher: text(b.publisher, "publisher", 160),
      excerpt: text(b.excerpt, "excerpt", 2500),
      zone: text(b.zone, "zone", 120),
      language: oneOf(b.language ?? "fr", ["fr", "en", "ta"], "language"),
      category: oneOf(
        b.category ?? "other",
        ["culture", "events", "administrative", "other"],
        "category",
      ),
      publishedAt,
      eventAt: b.eventAt ? date(b.eventAt, "eventAt") : null,
      collectedAt: this.now(),
      verifiedAt: null,
      expiresAt: date(b.expiresAt, "expiresAt"),
      official: b.official === true,
      sourceId: b.sourceId ?? null,
    };
  }
  action(c: Context, id: string, action: string, b: Row = {}): Row {
    return this.db.tx(() => {
      const r = this.get(c, id);
      if (action === "publish_whatsapp") {
        this.admin(c);
        check(
          ["meetup", "offer", "cohort", "radar", "challenge"].includes(r.kind),
          "not_publishable",
        );
        check(
          ["open", "confirmed", "published", "registration", "closed"].includes(
            r.status,
          ),
          "not_publishable",
        );
        check(
          (r.data.expiresAt ?? Infinity) > this.now(),
          "report_expired",
          409,
        );
        return this.enqueue(
          c,
          r,
          "activity",
          { version: r.version },
          "activity:" + r.id + ":" + r.version,
        );
      }
      if (action === "feedback") {
        check(
          this.db.get(
            "SELECT 1 FROM enrollments WHERE record_id=? AND user_id=? AND status='completed'",
            r.id,
            c.userId,
          ) ||
            (r.kind === "help" &&
              r.status === "completed" &&
              [r.owner_id, r.data.volunteerId].includes(c.userId)),
          "feedback_not_available",
          409,
        );
        this.db.run(
          "INSERT INTO feedback VALUES(?,?,?,?) ON CONFLICT(record_id,user_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment",
          r.id,
          c.userId,
          integer(b.rating, "rating", 1, 5),
          b.comment ? text(b.comment, "comment", 1000) : "",
        );
        return { saved: true };
      }
      if (action === "publish_link") {
        this.admin(c);
        check(
          ["meetup", "offer", "cohort"].includes(r.kind) &&
            ["open", "confirmed"].includes(r.status),
          "not_publishable",
        );
        return this.enqueue(
          c,
          r,
          "link",
          { title: r.data.title, path: "/#detail/" + r.id },
          "link:" + r.id + ":" + r.version,
        );
      }
      switch (r.kind) {
        case "request":
          if (action === "interest")
            return this.interest(c, r, b.active === true);
          if (action === "publish_poll") return this.publishPoll(c, r, b);
          if (action === "cancel") {
            check(
              r.owner_id === c.userId || this.member(c).role === "group_admin",
              "forbidden",
              403,
            );
            check(
              !this.db.get(
                "SELECT 1 FROM records WHERE kind='offer' AND json_extract(data,'$.requestId')=? AND status='confirmed'",
                r.id,
              ),
              "cancel_offers_first",
              409,
            );
            return this.save(c, r, r.data, "cancelled");
          }
          break;
        case "offer":
          return this.offerAction(c, r, action, b);
        case "meetup":
          if (action === "enroll") return this.enroll(c, r, b);
          if (action === "leave") return this.leave(c, r);
          if (action === "cancel" || action === "complete") {
            this.own(c, r);
            if (action === "complete")
              check(r.data.startsAt <= this.now(), "activity_not_started", 409);
            this.db.run(
              "UPDATE enrollments SET status=?,updated_at=? WHERE record_id=? AND status IN('confirmed','offered','waitlisted')",
              action === "cancel" ? "cancelled" : "completed",
              this.now(),
              r.id,
            );
            return this.save(
              c,
              r,
              r.data,
              action === "cancel" ? "cancelled" : "completed",
            );
          }
          break;
        case "housing":
          this.own(c, r);
          if (action === "consent") {
            const ids = list(b.sharedWith, "sharedWith");
            for (const org of ids)
              check(
                this.db.get(
                  "SELECT 1 FROM organizations WHERE id=? AND active=1",
                  org,
                ),
                "unknown_professional",
              );
            return this.save(c, r, {
              ...r.data,
              sharedWith: ids,
              consentAt: this.now(),
            });
          }
          if (["suspend", "satisfy", "resume"].includes(action))
            return this.save(
              c,
              r,
              r.data,
              { suspend: "suspended", satisfy: "satisfied", resume: "active" }[
                action
              ]!,
            );
          break;
        case "housing_offer": {
          const parent = this.get(c, r.data.requestId, "housing");
          if (action === "interest" || action === "contact") {
            this.own(c, parent);
            return this.save(c, r, {
              ...r.data,
              interested: true,
              contactRequested: action === "contact" || r.data.contactRequested,
            });
          }
          if (action === "reconfirm") {
            this.own(c, r);
            this.professional(c);
            return this.save(c, r, { ...r.data, confirmedAt: this.now() });
          }
          break;
        }
        case "volunteer":
          this.own(c, r);
          if (action === "pause" || action === "resume")
            return this.save(
              c,
              r,
              r.data,
              action === "pause" ? "paused" : "active",
            );
          if (action === "update")
            return this.save(c, r, {
              ...r.data,
              slots: this.validSlots(b.slots),
              notifications: b.notifications === true,
            });
          break;
        case "help":
          return this.helpAction(c, r, action, b);
        case "radar":
          if (action === "dispute") {
            this.db.run(
              "INSERT INTO reports VALUES(?,?,?,?,?,?,?)",
              uid(),
              c.groupId,
              c.userId,
              r.id,
              text(b.reason, "reason", 1000),
              "open",
              this.now(),
            );
            return this.save(
              c,
              r,
              { ...r.data, disputes: r.data.disputes + 1 },
              "disputed",
            );
          }
          this.admin(c);
          if (action === "publish") {
            check(r.data.expiresAt > this.now(), "report_expired", 409);
            return this.save(c, r, r.data, "published");
          }
          if (action === "confirm") {
            const evidence = url(b.evidence);
            const confirmation = oneOf(
              b.confirmation,
              ["organizer", "official"],
              "confirmation",
            );
            return this.save(
              c,
              r,
              {
                ...r.data,
                confirmation,
                evidence,
                verifiedAt: this.now(),
                expiresAt:
                  this.now() +
                  integer(b.hours ?? 48, "hours", 1, 720) * 3600000,
              },
              "published",
            );
          }
          if (action === "correct")
            return this.save(
              c,
              r,
              {
                ...r.data,
                description: text(b.description, "description"),
                confirmation: "member",
                verifiedAt: null,
              },
              "pending",
            );
          if (action === "remove") return this.save(c, r, r.data, "removed");
          break;
        case "cohort":
          if (action === "enroll") return this.enroll(c, r, b);
          if (action === "leave") return this.leave(c, r);
          if (action === "progress") {
            check(
              this.db.get(
                "SELECT 1 FROM enrollments WHERE record_id=? AND user_id=? AND status='confirmed'",
                r.id,
                c.userId,
              ),
              "join_required",
              403,
            );
            check(
              b.userId === undefined || b.userId === c.userId,
              "private_progress",
              403,
            );
            const completed = list(b.completed ?? [], "completed");
            const saved = list(b.saved ?? [], "saved");
            check(
              completed.every((s) => r.data.steps.includes(s)) &&
                saved.every((s) =>
                  r.data.resources.some((v: Row) => v.url === s),
                ),
              "invalid_progress",
            );
            const activities = list(b.activities ?? [], "activities");
            for (const activity of activities)
              check(
                this.db.get(
                  "SELECT 1 FROM enrollments e JOIN records r ON r.id=e.record_id WHERE e.user_id=? AND e.record_id=? AND r.group_id=? AND e.status IN('confirmed','completed')",
                  c.userId,
                  activity,
                  c.groupId,
                ),
                "activity_join_required",
              );
            const p = {
              completed,
              saved,
              activities,
              mentor: b.mentor === true,
              theme: b.theme ? text(b.theme, "theme", 120) : null,
            };
            this.db.run(
              "INSERT INTO progress VALUES(?,?,?) ON CONFLICT(cohort_id,user_id) DO UPDATE SET data=excluded.data",
              r.id,
              c.userId,
              json(p),
            );
            return p;
          }
          break;
        case "challenge":
          return this.challengeAction(c, r, action, b);
        case "story":
          return this.storyAction(c, r, action, b);
        case "source":
          this.admin(c);
          if (action === "pause" || action === "resume")
            return this.save(
              c,
              r,
              r.data,
              action === "pause" ? "paused" : "active",
            );
          break;
        case "document":
          this.admin(c);
          if (action === "verify") {
            check(r.data.expiresAt > this.now(), "document_expired");
            if (r.data.category === "administrative")
              check(
                r.data.official && this.isOfficial(r.data.url),
                "official_source_required",
              );
            return this.save(
              c,
              r,
              { ...r.data, verifiedAt: this.now() },
              "verified",
            );
          }
          if (action === "remove") return this.save(c, r, r.data, "removed");
          break;
        case "digest":
          this.admin(c);
          if (action === "publish") {
            check(
              ["draft", "approved"].includes(r.status),
              "invalid_state",
              409,
            );
            const docs = r.data.documentIds.map((id: string) =>
              this.get(c, id, "document"),
            );
            check(
              docs.every(
                (d: Entity) =>
                  d.status === "verified" &&
                  d.data.expiresAt > Math.max(this.now(), r.data.dueAt),
              ),
              "document_not_current",
            );
            const out = this.enqueue(
              c,
              r,
              "digest",
              { title: r.data.title, documentIds: r.data.documentIds },
              "digest:" + r.id,
              r.data.dueAt,
            );
            this.save(c, r, r.data, "approved");
            return out;
          }
          break;
      }
      throw new Problem(400, "unknown_action");
    });
  }
  isOfficial(value: string) {
    const h = new URL(value).hostname;
    return (
      h === "service-public.gouv.fr" ||
      h.endsWith(".gouv.fr") ||
      h === "eoiparis.gov.in" ||
      h === "www.eoiparis.gov.in"
    );
  }
  helpAction(c: Context, r: Entity, action: string, b: Row) {
    if (action === "volunteer") {
      check(
        r.owner_id !== c.userId &&
          r.status === "open" &&
          r.data.startsAt > this.now(),
        "help_unavailable",
        409,
      );
      const row = this.db.get(
        "SELECT id FROM records WHERE kind='volunteer' AND group_id=? AND owner_id=? AND status='active'",
        c.groupId,
        c.userId,
      );
      check(row, "volunteer_profile_required", 403);
      const p = this.raw(row.id);
      check(
        p.data.skills.includes(r.data.theme) &&
          p.data.languages.includes(r.data.language) &&
          p.data.maxDuration >= r.data.duration &&
          p.data.slots.some(
            (s: Row) => s.start <= r.data.startsAt && s.end >= r.data.endsAt,
          ),
        "incompatible_availability",
        409,
      );
      const weekDate = new Date(r.data.startsAt);
      weekDate.setUTCHours(0, 0, 0, 0);
      const weekStart =
        weekDate.getTime() - ((weekDate.getUTCDay() + 6) % 7) * 86400000;
      const count = this.db.get(
        "SELECT COUNT(*) n FROM records WHERE kind='help' AND json_extract(data,'$.volunteerId')=? AND status IN('proposed','accepted','completed') AND json_extract(data,'$.startsAt') BETWEEN ? AND ?",
        c.userId,
        weekStart,
        weekStart + 7 * 86400000 - 1,
      )!.n;
      check(count < p.data.maxPerWeek, "volunteer_limit", 429);
      const busy = this.db.get(
        "SELECT 1 FROM records WHERE kind='help' AND json_extract(data,'$.volunteerId')=? AND status IN('proposed','accepted') AND json_extract(data,'$.startsAt')<? AND json_extract(data,'$.endsAt')>?",
        c.userId,
        r.data.endsAt,
        r.data.startsAt,
      );
      check(!busy, "slot_unavailable", 409);
      return this.save(
        c,
        r,
        { ...r.data, volunteerId: c.userId, volunteerAccepted: true },
        "proposed",
      );
    }
    if (action === "accept") {
      this.own(c, r);
      check(
        r.status === "proposed" &&
          r.data.volunteerAccepted &&
          r.data.startsAt > this.now(),
        "volunteer_required",
        409,
      );
      return this.save(
        c,
        r,
        { ...r.data, requesterAccepted: true },
        "accepted",
      );
    }
    if (action === "decline") {
      this.own(c, r);
      check(r.status === "proposed", "invalid_state", 409);
      return this.save(
        c,
        r,
        {
          ...r.data,
          volunteerId: null,
          volunteerAccepted: false,
          requesterAccepted: false,
        },
        "open",
      );
    }
    if (action === "cancel" || action === "complete") {
      check(
        [r.owner_id, r.data.volunteerId].includes(c.userId),
        "forbidden",
        403,
      );
      if (action === "complete")
        check(
          r.status === "accepted" && r.data.endsAt <= this.now(),
          "session_not_finished",
          409,
        );
      return this.save(
        c,
        r,
        r.data,
        action === "cancel" ? "cancelled" : "completed",
      );
    }
    throw new Problem(400, "unknown_action");
  }
  challengeAction(c: Context, r: Entity, action: string, b: Row) {
    if (action === "join") {
      check(
        r.status === "registration" && this.now() < r.data.deadline,
        "registration_closed",
        409,
      );
      const team = oneOf(b.team, r.data.teams, "team");
      this.db.run(
        "INSERT INTO challenge_entries(challenge_id,user_id,team,visible) VALUES(?,?,?,?) ON CONFLICT(challenge_id,user_id) DO UPDATE SET team=excluded.team,visible=excluded.visible",
        r.id,
        c.userId,
        team,
        b.visible === true ? 1 : 0,
      );
      return { team };
    }
    if (action === "answer") {
      check(
        r.status === "open" && this.now() < r.data.deadline,
        "challenge_closed",
        409,
      );
      const entry = this.db.get(
        "SELECT * FROM challenge_entries WHERE challenge_id=? AND user_id=?",
        r.id,
        c.userId,
      );
      check(entry, "roster_frozen", 403);
      check(
        Array.isArray(b.answers) &&
          b.answers.length === r.data.questions.length,
        "invalid_answers",
      );
      const answers = b.answers.map((a: unknown, i: number) =>
        integer(a, "answer", 0, r.data.questions[i].options.length - 1),
      );
      if (entry.submitted_at) {
        check(entry.answers === json(answers), "already_answered", 409);
        return { submitted: true };
      }
      const points = this.score(r, answers);
      this.db.run(
        "UPDATE challenge_entries SET answers=?,points=?,submitted_at=? WHERE challenge_id=? AND user_id=?",
        json(answers),
        points,
        this.now(),
        r.id,
        c.userId,
      );
      return { submitted: true };
    }
    if (action === "dispute") {
      this.db.run(
        "INSERT INTO reports VALUES(?,?,?,?,?,?,?)",
        uid(),
        c.groupId,
        c.userId,
        r.id,
        text(b.reason, "reason", 1000),
        "open",
        this.now(),
      );
      return { recorded: true };
    }
    this.admin(c);
    if (action === "add_question") {
      check(
        r.status === "draft" && r.data.questions.length < 20,
        "challenge_not_editable",
        409,
      );
      const options = list(b.options, "options", 10);
      check(options.length >= 2, "invalid_options");
      return this.save(c, r, {
        ...r.data,
        questions: [
          ...r.data.questions,
          {
            prompt: text(b.prompt, "prompt", 300),
            options,
            answer: integer(b.answer, "answer", 0, options.length - 1),
            points: integer(b.points, "points", 1, 100),
          },
        ],
      });
    }
    if (action === "verify") {
      check(
        r.status === "draft" && b.verified === true,
        "verification_required",
      );
      check(r.data.sources.length > 0, "sources_required");
      r.data.sources.forEach((s: string) => url(s));
      return this.save(
        c,
        r,
        { ...r.data, verified: true, verifiedAt: this.now() },
        "registration",
      );
    }
    if (action === "open") {
      check(
        r.status === "registration" &&
          r.data.verified &&
          r.data.deadline > this.now(),
        "invalid_state",
        409,
      );
      const denominators = Object.fromEntries(
        r.data.teams.map((team: string) => [
          team,
          this.db.get(
            "SELECT COUNT(*) n FROM challenge_entries WHERE challenge_id=? AND team=?",
            r.id,
            team,
          )!.n,
        ]),
      );
      check(
        Object.values(denominators).some((n) => Number(n) > 0),
        "participants_required",
      );
      return this.save(c, r, { ...r.data, denominators }, "open");
    }
    if (action === "close") {
      check(
        r.status === "open" && this.now() >= r.data.deadline,
        "deadline_not_reached",
        409,
      );
      return this.save(c, r, r.data, "closed");
    }
    if (action === "correct") {
      check(r.status === "closed", "challenge_not_closed", 409);
      const index = integer(
          b.question,
          "question",
          0,
          r.data.questions.length - 1,
        ),
        answer = integer(
          b.answer,
          "answer",
          0,
          r.data.questions[index].options.length - 1,
        );
      const d = structuredClone(r.data);
      d.questions[index].answer = answer;
      d.rulesVersion++;
      d.correction = text(b.reason, "reason", 1000);
      const next = this.save(c, r, d);
      for (const e of this.db.all(
        "SELECT * FROM challenge_entries WHERE challenge_id=? AND answers IS NOT NULL",
        r.id,
      ))
        this.db.run(
          "UPDATE challenge_entries SET points=? WHERE challenge_id=? AND user_id=?",
          this.score(next, parse(e.answers)),
          r.id,
          e.user_id,
        );
      return next;
    }
    throw new Problem(400, "unknown_action");
  }
  score(r: Entity, answers: number[]) {
    return r.data.questions.reduce(
      (sum: number, q: Row, i: number) =>
        sum + (q.answer === answers[i] ? q.points : 0),
      0,
    );
  }
  leaderboard(c: Context, id: string) {
    const r = this.get(c, id, "challenge");
    check(r.status === "closed", "results_not_final", 409);
    return r.data.teams
      .map((team: string) => {
        const sum = this.db.get(
          "SELECT COALESCE(SUM(points),0) total FROM challenge_entries WHERE challenge_id=? AND team=?",
          r.id,
          team,
        )!.total;
        const n = r.data.denominators[team] ?? 0;
        return { team, points: sum, participants: n, score: n ? sum / n : 0 };
      })
      .sort(
        (a: Row, b: Row) => b.score - a.score || a.team.localeCompare(b.team),
      );
  }
  storyAction(c: Context, r: Entity, action: string, b: Row) {
    if (action === "publish") {
      this.admin(c);
      check(
        r.status === "approved" &&
          r.data.approvedVersion === r.version &&
          r.data.audiences.includes("nanba"),
        "author_approval_required",
        409,
      );
      return this.save(c, r, r.data, "published");
    }
    if (action === "share") {
      this.admin(c);
      check(
        r.status === "published" && r.data.audiences.includes("whatsapp"),
        "channel_consent_required",
        403,
      );
      return this.enqueue(
        c,
        r,
        "story",
        { title: r.data.title },
        "story:" + r.id + ":" + r.version,
      );
    }
    this.own(c, r);
    if (action === "edit") {
      check(r.status !== "withdrawn", "withdrawn", 409);
      this.db.run(
        "UPDATE outbox SET status='cancelled',updated_at=? WHERE record_id=? AND status IN('pending','prepared')",
        this.now(),
        r.id,
      );
      return this.save(
        c,
        r,
        {
          ...r.data,
          title: text(b.title, "title", 160),
          original: text(b.original, "original", 1500),
          translation: b.translation
            ? text(b.translation, "translation", 1500)
            : "",
          audiences: [],
          approvedVersion: null,
          rightsConfirmed: false,
          translationUncertain: true,
        },
        "draft",
      );
    }
    if (action === "approve") {
      check(r.status === "draft", "invalid_state", 409);
      check(
        b.rightsConfirmed === true && b.translationReviewed === true,
        "author_review_required",
      );
      const audiences = list(b.audiences, "audiences", 2);
      check(
        audiences.length > 0 &&
          audiences.every((x) => ["nanba", "whatsapp"].includes(x)) &&
          audiences.includes("nanba"),
        "invalid_audience",
      );
      check(r.data.translation, "translation_required");
      if (r.data.storyType === "verified_history")
        check(b.source && url(b.source), "history_source_required");
      return this.save(
        c,
        r,
        {
          ...r.data,
          audiences,
          rightsConfirmed: true,
          translationUncertain: false,
          approvedVersion: r.version + 1,
          approvedAt: this.now(),
          source: b.source ?? null,
        },
        "approved",
      );
    }
    if (action === "withdraw") {
      this.db.run(
        "UPDATE outbox SET status='cancelled',updated_at=? WHERE record_id=? AND status IN('pending','prepared')",
        this.now(),
        r.id,
      );
      return this.save(
        c,
        r,
        { ...r.data, audiences: [], withdrawnAt: this.now() },
        "withdrawn",
      );
    }
    throw new Problem(400, "unknown_action");
  }
  matches(c: Context, preferences: Row) {
    this.member(c);
    const zone = text(preferences.zone, "zone", 120),
      language = text(preferences.language, "language", 20),
      activity = text(preferences.activity, "activity", 60),
      format = oneOf(
        preferences.format,
        ["solo", "couple", "family", "all"],
        "format",
      );
    return this.list(c, "meetup")
      .filter(
        (r) =>
          r.status === "open" &&
          r.data.startsAt > this.now() &&
          (!preferences.after ||
            r.data.startsAt >= date(preferences.after, "after")) &&
          (!preferences.before ||
            r.data.startsAt <= date(preferences.before, "before")),
      )
      .map((r) => ({
        ...r,
        reasons: [
          ...(r.data.zone.toLowerCase() === zone.toLowerCase() ? ["zone"] : []),
          ...(r.data.language === language ? ["language"] : []),
          ...(r.data.activity === activity ? ["activity"] : []),
          ...([format, "all"].includes(r.data.format) ? ["format"] : []),
        ],
      }))
      .filter((r) => r.reasons.length >= 2)
      .sort((a, b) => b.reasons.length - a.reasons.length);
  }
  currentRadar(c: Context, zone?: string) {
    return this.list(c, "radar").filter(
      (r) =>
        r.status === "published" &&
        r.data.expiresAt > this.now() &&
        (!zone || r.data.zone.toLowerCase().includes(zone.toLowerCase())),
    );
  }
  housingAggregate(c: Context) {
    this.admin(c);
    const minimum = integer(
      parse(this.group(c).settings).aggregationMinimum ?? 5,
      "minimum",
      5,
      100,
    );
    const n = this.db.get(
      "SELECT COUNT(*) n FROM records WHERE kind='housing' AND group_id=? AND status='active'",
      c.groupId,
    )!.n;
    return { count: n >= minimum ? n : null, minimum, suppressed: n < minimum };
  }
}
