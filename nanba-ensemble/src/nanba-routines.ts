import { randomBytes } from "node:crypto";
import type { Row } from "./db.ts";
import { type Companion, nextDaily, wallTime } from "./nanba-companion.ts";
import { fingerprint, services, tidy } from "./nanba-services.ts";
import { check } from "./validation.ts";

const hour = (x: unknown) =>
  typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const topics = [...services, "image", "horoscope"];
export function quiet(clock: string, start = "22:00", end = "07:00") {
  return start === end
    ? false
    : start < end
      ? clock >= start && clock < end
      : clock >= start || clock < end;
}
const words: Record<string, Row> = {
  fr: {
    morning: "☀️ Bonjour",
    evening: "🌙 Bonsoir",
    digest: "✨ Ta sélection Nanba",
    footer: "MOINS · PAUSE 7 JOURS · MON PROGRAMME",
    image: "Ton image du jour",
    symbolic: "Lecture symbolique, pour le plaisir",
    reflection: "Prends un moment pour ce qui compte pour toi aujourd’hui.",
  },
  en: {
    morning: "☀️ Good morning",
    evening: "🌙 Good evening",
    digest: "✨ Your Nanba selection",
    footer: "LESS · PAUSE 7 DAYS · MY SCHEDULE",
    image: "Your picture of the day",
    symbolic: "Symbolic reading, for entertainment",
    reflection: "Take a moment for what matters to you today.",
  },
  ta: {
    morning: "☀️ காலை வணக்கம்",
    evening: "🌙 மாலை வணக்கம்",
    digest: "✨ உங்கள் நண்பா தொகுப்பு",
    footer: "LESS · PAUSE 7 DAYS · MY SCHEDULE",
    image: "இன்றைய வாழ்த்துப் படம்",
    symbolic: "பொழுதுபோக்குக்கான குறியீட்டு வாசிப்பு",
    reflection:
      "இன்று உங்களுக்கு முக்கியமானவற்றுக்காக சிறிது நேரம் ஒதுக்குங்கள்.",
  },
};
export class Routines {
  companion: Companion;
  constructor(c: Companion) {
    this.companion = c;
    c.db.raw
      .exec(`CREATE TABLE IF NOT EXISTS nanba_routine_preferences(identity TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS nanba_routine_runs(sid TEXT PRIMARY KEY,identity TEXT NOT NULL,task TEXT NOT NULL,day TEXT NOT NULL,created_at INTEGER NOT NULL,outcome TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS nanba_routine_by_user ON nanba_routine_runs(identity,created_at);
      CREATE TABLE IF NOT EXISTS nanba_routine_content(identity TEXT NOT NULL,key TEXT NOT NULL,sid TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(identity,key,sid));`);
  }
  get c() {
    return this.companion;
  }
  preferences(identity: string) {
    const row = this.c.db.get(
      "SELECT data FROM nanba_routine_preferences WHERE identity=?",
      identity,
    );
    return {
      maxPerDay: 2,
      quietStart: "22:00",
      quietEnd: "07:00",
      pausedUntil: 0,
      excludedTopics: [],
      ...(row ? JSON.parse(this.c.host.unseal(row.data)) : {}),
    };
  }
  save(identity: string, prefs: Row) {
    this.c.db.run(
      "INSERT INTO nanba_routine_preferences VALUES(?,?) ON CONFLICT(identity) DO UPDATE SET data=excluded.data",
      identity,
      this.c.host.seal(JSON.stringify(prefs)),
    );
  }
  status(identity: string) {
    return {
      preferences: this.preferences(identity),
      lastSelection: this.lastSelection(identity),
      tasks: this.c.tasks(identity),
      policy:
        "Choix explicite, 2 sélections maximum par jour, 4 h minimum entre sélections. Rappels personnels distincts. Pause automatique après 14 jours sans message. Aucun abonnement lors de START.",
    };
  }
  lastSelection(identity: string) {
    const row = this.c.db.get(
      "SELECT j.output,r.created_at FROM nanba_routine_runs r JOIN twilio_jobs j ON j.sid=r.sid WHERE r.identity=? AND j.state='sent' AND j.output IS NOT NULL AND r.created_at>? ORDER BY r.created_at DESC LIMIT 1",
      identity,
      this.c.now - 2 * 86400000,
    );
    return row
      ? {
          text: this.c.host.unseal(row.output),
          at: new Date(row.created_at).toISOString(),
        }
      : null;
  }
  cancelPending(identity: string) {
    this.c.db.run(
      "UPDATE twilio_jobs SET state='cancelled',outbound_media=NULL WHERE identity=? AND schedule_id IN(SELECT id FROM nanba_tasks WHERE kind<>'reminder') AND state IN('ready','waiting_template','queued','generating')",
      identity,
    );
  }
  change(identity: string, a: Row) {
    const p = this.preferences(identity);
    if (a.action === "routine_pause") {
      const days = Number(a.pauseDays || 0);
      check(
        Number.isInteger(days) && days >= 0 && days <= 365,
        "pause_0_a_365_jours",
      );
      p.pausedUntil = days ? this.c.now + days * 86400000 : -1;
      this.cancelPending(identity);
    } else if (a.action === "routine_resume") p.pausedUntil = 0;
    else if (a.action === "routine_preferences") {
      if (a.maxPerDay !== undefined) {
        check([1, 2].includes(a.maxPerDay), "maximum_1_ou_2");
        p.maxPerDay = a.maxPerDay;
      }
      for (const k of ["quietStart", "quietEnd"])
        if (a[k] !== undefined) {
          check(hour(a[k]), "horaire_silence_invalide");
          p[k] = a[k];
        }
      if (a.excludedTopics !== undefined) {
        check(
          Array.isArray(a.excludedTopics) &&
            a.excludedTopics.every((s: string) => topics.includes(s)),
          "themes_invalides",
        );
        p.excludedTopics = [...new Set(a.excludedTopics)];
      }
      this.cancelPending(identity);
    }
    this.save(identity, p);
    return this.status(identity);
  }
  configure(identity: string, a: Row) {
    check(a.consent === true, "accord_explicite_requis");
    const slots = Array.isArray(a.slots) ? a.slots : [];
    check(slots.length > 0 && slots.length <= 2, "choisir_matinee_ou_soiree");
    check(
      new Set(slots.map((x: Row) => x.kind)).size === slots.length,
      "creneau_duplique",
    );
    const profile = this.c.profile(identity),
      prefs = this.preferences(identity);
    const zone = tidy(a.timezone || profile.timezone || "Europe/Paris", 80);
    wallTime(this.c.now, zone);
    const selected = Array.isArray(a.topics)
      ? [...new Set<string>(a.topics)]
      : [];
    const days: number[] = a.days || [];
    check(
      Array.isArray(days) &&
        days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      "jours_invalides",
    );
    const planned = slots.map((s: Row) => {
      const slotTopics = Array.isArray(s.topics)
        ? [...new Set<string>(s.topics)]
        : selected;
      check(
        slotTopics.length > 0 &&
          slotTopics.length <= 4 &&
          slotTopics.every((t) => topics.includes(t)),
        "choisir_1_a_4_themes",
      );
      if (slotTopics.includes("horoscope"))
        check(
          profile.rasi ||
            (profile.birth?.date &&
              profile.birth?.place &&
              profile.birth?.time),
          "demander_date_ville_et_heure_de_naissance_si_connue",
        );

      check(
        ["morning", "evening"].includes(s.kind) && hour(s.at),
        "creneau_invalide",
      );
      check(
        !quiet(s.at, prefs.quietStart, prefs.quietEnd),
        "horaire_dans_plage_silence_modifier_horaire_ou_silence",
      );
      return {
        kind: s.kind,
        topics: slotTopics,
        at: s.at,
        next: nextDaily(this.c.now, s.at, zone, days),
      };
    });
    // These are complete replacements of the two daily slots, never cumulative subscriptions.
    this.c.db.tx(() => {
      this.c.db.run(
        "UPDATE twilio_jobs SET state='cancelled',outbound_media=NULL WHERE identity=? AND schedule_id IN(SELECT id FROM nanba_tasks WHERE kind IN('morning','evening')) AND state IN('ready','waiting_template','queued','generating')",
        identity,
      );
      this.c.db.run(
        "UPDATE nanba_tasks SET state='cancelled' WHERE identity=? AND kind IN('morning','evening')",
        identity,
      );
      check(
        this.c.tasks(identity).length + planned.length <= 20,
        "maximum_20_rappels",
      );
      for (const s of planned) {
        const data = {
          at: s.at,
          timezone: zone,
          days,
          recurrence: "daily",
          topics: s.topics,
          region: a.region || profile.newsRegion || "india",
          imageStyle: a.imageStyle || profile.imageStyle || "family",
          city: profile.city || "",
          query: tidy(a.query, 100),
          consentAt: this.c.now,
        };
        this.c.db.run(
          "INSERT INTO nanba_tasks(id,identity,kind,data,next_at,created_at) VALUES(?,?,?,?,?,?)",
          randomBytes(12).toString("hex"),
          identity,
          s.kind,
          this.c.host.seal(JSON.stringify(data)),
          s.next,
          this.c.now,
        );
      }
      prefs.pausedUntil = 0;
      // A new explicit choice may re-enable a previously excluded topic.
      prefs.excludedTopics = prefs.excludedTopics.filter(
        (t: string) => !planned.some((s) => s.topics.includes(t)),
      );
      this.save(identity, prefs);
    });
    return {
      ...this.status(identity),
      message:
        "Programme enregistré. Aucun message si rien de nouveau ou si le contenu est indisponible.",
      outside24h: [
        "digest",
        ...(planned.some((s) => s.topics.includes("image")) ? ["image"] : []),
      ].every(
        (kind) =>
          this.c.db.get(
            "SELECT status FROM nanba_templates WHERE kind=?",
            this.c.templateKey(identity, kind),
          )?.status === "approved",
      )
        ? "Modèles WhatsApp approuvés"
        : "En dehors d’une conversation récente, attente de l’approbation Meta du modèle WhatsApp.",
    };
  }
  reason(identity: string, zone: string, excludeSid = "") {
    const c = this.c,
      p = this.preferences(identity),
      contact = c.db.get(
        "SELECT * FROM twilio_contacts WHERE identity=?",
        identity,
      );
    if (!contact || contact.stopped) return "stopped";
    if (p.pausedUntil === -1 || p.pausedUntil > c.now) return "paused";
    if (c.now - contact.last_at >= 14 * 86400000) return "inactive";
    if (c.host.support?.active(identity)) return "human_support";
    if (quiet(wallTime(c.now, zone).slice(11), p.quietStart, p.quietEnd))
      return "quiet_hours";
    const day = wallTime(c.now, zone).slice(0, 10);
    const recent = c.db.all(
      "SELECT r.* FROM nanba_routine_runs r JOIN twilio_jobs j ON j.sid=r.sid WHERE r.identity=? AND r.sid<>? AND j.state IN('ready','waiting_template','sending','sent','uncertain') AND r.created_at>? ORDER BY r.created_at DESC",
      identity,
      excludeSid,
      c.now - 26 * 3600000,
    );
    if (recent.filter((r) => r.day === day).length >= p.maxPerDay)
      return "daily_cap";
    if (recent.some((r) => c.now - r.created_at < 4 * 3600000))
      return "minimum_gap";
    return "";
  }
  deliveryAllowed(job: Row) {
    if (job.schedule_id?.startsWith("catalogue:"))
      return this.c.catalogue.allowed(job);
    if (!job.schedule_id) return true;
    const task = this.c.db.get(
      "SELECT * FROM nanba_tasks WHERE id=?",
      job.schedule_id,
    );
    if (!task || task.kind === "reminder") return true;
    if (task.state === "cancelled" || this.c.now - job.created_at > 2 * 3600000)
      return false;
    const data = JSON.parse(this.c.host.unseal(task.data));
    return !this.reason(
      job.identity,
      data.timezone || "Europe/Paris",
      job.parent_sid || job.sid,
    );
  }
  seen(identity: string) {
    return new Set(
      this.c.db
        .all(
          "SELECT DISTINCT n.key FROM nanba_routine_content n JOIN twilio_jobs j ON j.sid=n.sid WHERE n.identity=? AND n.created_at>? AND j.state IN('ready','waiting_template','sending','sent','uncertain')",
          identity,
          this.c.now - 14 * 86400000,
        )
        .map((x) => x.key),
    );
  }
  async compose(identity: string, kind: string, data: Row, preview = false) {
    const c = this.c,
      p = c.profile(identity),
      prefs = this.preferences(identity);
    const w = words[p.language] || words.fr;
    const seen = preview ? new Set<string>() : this.seen(identity);
    let selected: string[] =
      kind === "watch"
        ? [data.target || "housing"]
        : ["morning", "evening"].includes(kind)
          ? data.topics || p.interests || ["news"]
          : [kind];
    selected = selected
      .filter((s) => topics.includes(s) && !prefs.excludedTopics.includes(s))
      .slice(0, 4);
    const results = await Promise.allSettled(
      selected.map(async (service) => {
        if (service === "image") {
          const im = c.image(identity, data.imageStyle);
          return {
            items: im.mediaUrl
              ? [
                  {
                    id: im.mediaUrl,
                    key: fingerprint(im.mediaUrl),
                    title: w.image,
                    mediaUrl: im.mediaUrl,
                  },
                ]
              : [],
          };
        }
        if (service === "horoscope") {
          if (!(p.rasi || (p.birth?.date && p.birth?.place && p.birth?.time)))
            return { items: [] };
          const daily = c.horoscopes.daily(identity);
          return {
            items: [
              {
                key: fingerprint("horoscope:" + daily.date + ":" + daily.model),
                title: daily.title,
                summary: daily.summary,
              },
            ],
          };
        }
        return c.services.read(identity, { ...data, service });
      }),
    );
    const picked: Row[] = [];
    // Round-robin: one new item per selected interest, capped at three concise sections.
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const item = result.value.items?.find(
        (x: Row) =>
          !seen.has(x.key) &&
          (preview || !x.suggestionOnly) &&
          !(
            kind === "watch" &&
            Array.isArray(data.seen) &&
            data.seen.includes(x.id)
          ),
      );
      if (item) {
        picked.push(item);
        seen.add(item.key);
      }
      if (picked.length >= 3) break;
    }
    if (!picked.length)
      return { text: "", keys: [], mediaUrl: null, reason: "nothing_new" };
    const date = wallTime(
      c.now,
      data.timezone || p.timezone || "Europe/Paris",
    ).slice(0, 10);
    let text = `${w[kind] || w.digest}${p.name ? ", " + tidy(p.name, 30) : ""} · ${date}`;
    const included: Row[] = [];
    for (const item of picked) {
      const platforms = item.platforms?.length
        ? " · " +
          item.platforms.join(", ") +
          " (" +
          (p.country || "FR") +
          "; JustWatch/TMDB)"
        : "";
      // Never truncate a source URL. Keep the digest within template variable limits.
      const section =
        "\n\n" +
        tidy(item.title, 150) +
        platforms +
        (item.summary && !item.platforms
          ? "\n" + tidy(item.summary, 100)
          : "") +
        (item.url ? "\n" + item.url : "");
      if (text.length + section.length + w.footer.length + 3 > 840) continue;
      text += section;
      included.push(item);
    }
    if (!included.length)
      return { text: "", keys: [], mediaUrl: null, reason: "content_too_long" };
    return {
      text: text + "\n\n" + w.footer,
      keys: included.map((x) => x.key),
      mediaUrl: included.find((x) => x.mediaUrl)?.mediaUrl || null,
      reason: "ready",
    };
  }
  async schedule(task: Row, data: Row, sid: string) {
    const c = this.c;
    const preferencesBefore = JSON.stringify({
      prefs: this.preferences(task.identity),
      profile: c.profile(task.identity),
    });
    let reason = this.reason(task.identity, data.timezone);
    if (c.now - task.next_at >= 2 * 3600000) reason = "missed_window";
    const content = reason
      ? { text: "", keys: [], mediaUrl: null, reason }
      : await this.compose(task.identity, task.kind, data);
    c.db.tx(() => {
      const live = c.db.get(
        "SELECT t.* FROM nanba_tasks t JOIN twilio_contacts u ON u.identity=t.identity WHERE t.id=? AND t.state='active' AND u.stopped=0",
        task.id,
      );
      if (
        !live ||
        live.next_at !== task.next_at ||
        c.db.get("SELECT 1 FROM nanba_routine_runs WHERE sid=?", sid)
      )
        return;
      reason = reason || this.reason(task.identity, data.timezone);
      if (
        preferencesBefore !==
        JSON.stringify({
          prefs: this.preferences(task.identity),
          profile: c.profile(task.identity),
        })
      )
        reason = reason || "preferences_changed";
      const outcome = reason || content.reason;
      c.db.run(
        "INSERT INTO nanba_routine_runs VALUES(?,?,?,?,?,?)",
        sid,
        task.identity,
        task.id,
        wallTime(c.now, data.timezone).slice(0, 10),
        c.now,
        outcome,
      );
      if (!reason && content.text) {
        c.enqueue(
          task.identity,
          content.text,
          content.mediaUrl ? "image" : "digest",
          content.mediaUrl,
          task.id,
          sid,
        );
        for (const key of content.keys)
          c.db.run(
            "INSERT OR IGNORE INTO nanba_routine_content VALUES(?,?,?,?)",
            task.identity,
            key,
            sid,
            c.now,
          );
      }
      if (data.recurrence === "daily")
        c.db.run(
          "UPDATE nanba_tasks SET next_at=? WHERE id=?",
          nextDaily(c.now, data.at, data.timezone, data.days),
          task.id,
        );
      else
        c.db.run(
          "UPDATE nanba_tasks SET state='completed' WHERE id=?",
          task.id,
        );
    });
  }
  subscriptionNotice(job: Row) {
    if (
      job.template_kind ||
      job.parent_sid ||
      !this.c.tasks(job.identity).length
    )
      return "";
    const pending = this.c.db
      .all("SELECT result FROM nanba_actions WHERE job=?", job.sid)
      .some((row) =>
        /attente/.test(
          JSON.parse(this.c.host.unseal(row.result)).outside24h || "",
        ),
      );
    if (!pending) return "";
    const language = this.c.profile(job.identity).language;
    return language === "en"
      ? "ℹ️ Outside a recent WhatsApp conversation, scheduled messages must wait for Meta’s template approval."
      : language === "ta"
        ? "ℹ️ சமீபத்திய WhatsApp உரையாடலுக்கு வெளியே திட்டமிட்ட செய்திகள் அனுப்ப Meta வார்ப்புரு ஒப்புதல் தேவை; தற்போது காத்திருக்கிறோம்."
        : "ℹ️ Hors conversation WhatsApp récente, les envois programmés attendent encore l’approbation des modèles par Meta.";
  }
  command(identity: string, value: string): string | null {
    const text = value.trim().toUpperCase();
    const en = this.c.profile(identity).language === "en";
    const pause =
      /^(?:PAUSE|SILENCE)(?:\s+(\d{1,3})(?:\s+(?:JOURS?|DAYS?))?)?$/.exec(text);
    if (["MENU", "NANBA AIDE", "AIDE", "HELP"].includes(text))
      return this.c.profile(identity).language === "ta"
        ? "நண்பா: பிரான்சில் குடியேறுதல், வீடு அல்லது வேலை தேடுதல், குடும்ப உதவி — உங்கள் முன்னேற்றத்தைத் தொடர்ந்து பார்க்கலாம். பிரெஞ்சில் உரையாடிப் பயிற்சி செய்யலாம்; தமிழில் விளக்கம் கேட்கலாம். கடிதத்தின் படத்தை அனுப்புங்கள்; புரிந்துகொள்ளவும் பதில் எழுதவும் உதவுகிறேன். குரல் பதில், PDF, செய்திகள், திரைப்படங்கள், சமையல், விளையாட்டுகளும் உள்ளன. நினைவூட்டல் அல்லது அறிவிப்புகள் உங்கள் விருப்பத்துடன் மட்டுமே. மனித உதவிக்கு Nanba குழுவைக் கேளுங்கள். PAUSE · STOP · OUBLIE."
        : en
          ? "Nanba: ask for a private plan for settling in France, housing, work or family life. Practise French for a landlord, interview or school meeting, with explanations in your language. Send a letter photo for a plain-language explanation and help drafting a reply. Voice replies, PDFs, news, films, cooking and games are also available. Reminders and alerts require your choice. MY SCHEDULE · PAUSE · STOP · OUBLIE. Ask for the Nanba team to speak to a person."
          : "Nanba : demande un parcours pour t’installer en France, trouver un logement, un emploi ou accompagner ta famille. Entraîne-toi en français pour une visite, un entretien ou un échange avec l’école, avec explications dans ta langue. Envoie la photo d’un courrier pour le comprendre et préparer une réponse. Audio, PDF, actualités, films, cuisine et jeux sont aussi disponibles. Rappels et alertes uniquement selon tes choix. MON PROGRAMME · PAUSE · STOP · OUBLIE. Demande l’équipe Nanba pour parler à un humain.";
    if (pause && Number(pause[1] || 0) > 365)
      return "PAUSE 1 à 365 JOURS, ou PAUSE sans durée.";
    if (pause) {
      this.change(identity, {
        action: "routine_pause",
        pauseDays: Number(pause[1] || 0),
      });
      return en
        ? "Your daily selections are paused. Personal reminders stay active. Send RESUME to restart."
        : "Tes sélections sont en pause. Tes rappels personnels restent actifs. Écris REPRENDRE pour réactiver tes sélections.";
    }
    if (["REPRENDRE", "RESUME"].includes(text)) {
      this.change(identity, { action: "routine_resume" });
      return en
        ? "Your existing selections will resume at their next scheduled time."
        : "Tes sélections existantes reprendront au prochain horaire prévu.";
    }
    if (["MOINS", "LESS"].includes(text)) {
      this.change(identity, { action: "routine_preferences", maxPerDay: 1 });
      return en
        ? "At most one daily selection from now on."
        : "Tu recevras au maximum une sélection par jour.";
    }
    if (["MON PROGRAMME", "MY SCHEDULE", "MES RENDEZ-VOUS"].includes(text)) {
      const status = this.status(identity);
      const tasks = status.tasks
        .map((t: Row) => `${t.kind} · ${t.at} · ${t.timezone} · ${t.reference}`)
        .join("\n");
      return `${en ? "Your schedule" : "Ton programme"}\n${tasks || (en ? "No subscriptions." : "Aucun abonnement.")}\n${status.preferences.maxPerDay}/jour · silence ${status.preferences.quietStart}–${status.preferences.quietEnd}\n${status.preferences.pausedUntil === -1 || status.preferences.pausedUntil > this.c.now ? "⏸ Pause" : "▶ Actif"}\nPAUSE · REPRENDRE · MOINS · STOP`;
    }
    return null;
  }
  erase(identity: string) {
    for (const table of [
      "nanba_routine_preferences",
      "nanba_routine_runs",
      "nanba_routine_content",
    ])
      this.c.db.run(`DELETE FROM ${table} WHERE identity=?`, identity);
  }
  cleanup() {
    this.c.db.run(
      "DELETE FROM nanba_routine_content WHERE created_at<?",
      this.c.now - 14 * 86400000,
    );
    this.c.db.run(
      "DELETE FROM nanba_routine_runs WHERE created_at<?",
      this.c.now - 30 * 86400000,
    );
    this.c.db.run("DELETE FROM nanba_api_cache WHERE expires_at<?", this.c.now);
  }
}
