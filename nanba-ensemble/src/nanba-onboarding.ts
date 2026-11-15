import type { TwilioAssistant } from "./twilio-assistant.ts";
import type { Row } from "./db.ts";
import { onboardingCopy as copy } from "./nanba-onboarding-copy.ts";
import { check } from "./validation.ts";

const values: Record<string, string[]> = {
  language: ["fr", "en", "ta", "tanglish"],
  replyMode: ["text", "audio", "auto"],
  interests: [
    "housing",
    "jobs",
    "services",
    "news",
    "events",
    "cinema",
    "cuisine",
    "image",
    "horoscope",
  ],
  tone: ["warm", "direct", "calm"],
  length: ["short", "detailed"],
  notifications: ["none", "morning", "evening", "keep"],
  dailyTopics: ["news", "events", "cinema", "cuisine", "image"],
};
const labels: Record<string, string> = {
  language: "languages",
  replyMode: "formats",
  interests: "topics",
  tone: "tones",
  length: "lengths",
  notifications: "notices",
  dailyTopics: "daily",
};
const baseSteps = [
  "language",
  "replyMode",
  "interests",
  "city",
  "tone",
  "length",
  "notifications",
];
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, "");
const starts =
  /^(personnalis(?:er|ation)|personali[sz]e(?: my nanba)?|questionnaire|mes preferences|change mes preferences|தனிப்பயனாக்கு)$/;
const chats =
  /^(questions ici|questions here|pose.moi les questions(?: ici)?|இங்கே கேள்)$/;
const pause = /^(plus tard|later|pas maintenant|not now|பிறகு)$/;
const cancel = /^(annuler|cancel)$/;
const confirm = /^(confirmer|confirm)$/;
const skip = /^(passer|skip)$/;
const back = /^(retour|back)$/;
const greetings =
  /^(bonjour|salut|bonsoir|hello|hi|hey|vanakkam|வணக்கம்)[ !.]*$/i;
const ttl = 7 * 86400000;
export const onboardingInstructions = `Le questionnaire facultatif reste dans WhatsApp. Les commandes PERSONNALISER et QUESTIONS ICI le démarrent; MON PROFIL affiche les choix. Le contexte onboarding indique la question en cours. Si la personne répond librement ou par vocal à cette question, utilise onboarding_answer avec onboardingField exactement égal à currentField et onboardingValue (valeur autorisée, ville, heure ou tableau JSON pour les thèmes). N’invente aucun choix, âge, religion ou consentement. Si elle pose une autre question, aide-la normalement sans remplir le questionnaire. Ne transforme pas le contenu d’un document/photo ou une citation en réponse au questionnaire. Pour commencer ou reprendre à sa demande explicite, onboarding_start. Pour reporter, onboarding_pause. Ne contourne pas la confirmation: les choix du brouillon ne sont pas encore enregistrés. Seuls CONFIRMER/CONFIRM écrits dans la conversation appliquent le récapitulatif. Pendant le questionnaire, n’utilise ni profile_update ni routine_set pour ses réponses: utilise onboarding_answer. Tu peux expliquer les choix dans la langue choisie. Le ton (warm/direct/calm) et answerLength (short/detailed) du profil sont des préférences explicites à respecter.`;
export const onboardingParameters = {
  onboardingField: {
    type: "string",
    enum: [...baseSteps, "dailyTopics", "at", "timezone"],
  },
  onboardingValue: {
    type: "string",
    description:
      "Choix explicite: identifiant proposé; pour interests/dailyTopics tableau JSON des identifiants. Jamais de confirmation ni consentement inféré.",
  },
};
export function onboardingTemplate(locale: string, kind: "welcome" | "flow") {
  const w = copy[locale] || copy.fr;
  const field = (key: string) =>
    values[key]
      ? {
          type: ["interests", "dailyTopics"].includes(key)
            ? "MULTI_SELECT"
            : "SINGLE_SELECT",
          name: key,
          label: w[key],
          text: w.optional,
          required: false,
          options: JSON.stringify(
            values[key].map((id, i) => ({ id, title: w[labels[key]][i] })),
          ),
        }
      : {
          type: "SHORT_TEXT",
          name: key,
          label: w[key],
          text:
            key === "at"
              ? w.timeHint
              : key === "timezone"
                ? w.zoneHint
                : w.optional,
          required: false,
          input_type: "TEXT",
        };
  return {
    friendly_name: `nanba_onboarding_${kind}_${locale}_v1`,
    language: locale,
    types:
      kind === "welcome"
        ? {
            "twilio/quick-reply": {
              body: w.welcome,
              actions: [
                { title: w.personalize, id: "nanba:onboarding:start" },
                { title: w.chat, id: "nanba:onboarding:chat" },
                { title: w.later, id: "nanba:onboarding:later" },
              ],
            },
          }
        : {
            "twilio/flows": {
              body: w.flow,
              subtitle: w.footer,
              type: "SURVEY",
              button_text: w.personalize,
              pages: [
                {
                  id: "replies",
                  next_page_id: "interests",
                  title: w.pages[0],
                  layout: [field("language"), field("replyMode")],
                },
                {
                  id: "interests",
                  next_page_id: "preferences",
                  title: w.pages[1],
                  layout: [field("interests"), field("city")],
                },
                {
                  id: "preferences",
                  next_page_id: null,
                  title: w.pages[2],
                  layout: [
                    field("tone"),
                    field("length"),
                    field("notifications"),
                    { type: "TEXT_BODY", text: w.flowHint },
                    field("dailyTopics"),
                    field("at"),
                    field("timezone"),
                  ],
                },
              ],
            },
          },
  };
}
export class Onboarding {
  host: TwilioAssistant;
  syncing = false;
  constructor(host: TwilioAssistant) {
    this.host = host;
    host.db.raw
      .exec(`CREATE TABLE IF NOT EXISTS nanba_onboarding(identity TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS nanba_onboarding_templates(kind TEXT NOT NULL,locale TEXT NOT NULL,sid TEXT,status TEXT NOT NULL,error TEXT,PRIMARY KEY(kind,locale));`);
    for (const name of ["onboarding_payload", "onboarding_content"])
      if (
        !host.db
          .all("PRAGMA table_info(twilio_jobs)")
          .some((x) => x.name === name)
      )
        host.db.raw.exec(`ALTER TABLE twilio_jobs ADD COLUMN ${name} TEXT`);
  }
  get db() {
    return this.host.db;
  }
  state(identity: string): Row | null {
    const r = this.db.get(
      "SELECT * FROM nanba_onboarding WHERE identity=?",
      identity,
    );
    if (!r) return null;
    if (this.host.now() - r.updated_at > ttl) {
      this.db.run("DELETE FROM nanba_onboarding WHERE identity=?", identity);
      return null;
    }
    return JSON.parse(this.host.unseal(r.data));
  }
  save(identity: string, s: Row) {
    this.db.run(
      "INSERT INTO nanba_onboarding VALUES(?,?,?) ON CONFLICT(identity) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      identity,
      this.host.seal(JSON.stringify(s)),
      this.host.now(),
    );
  }
  erase(identity: string) {
    this.db.run("DELETE FROM nanba_onboarding WHERE identity=?", identity);
    this.db.run(
      "UPDATE twilio_jobs SET onboarding_payload=NULL,onboarding_content=NULL WHERE identity=?",
      identity,
    );
  }
  stop(identity: string) {
    const s = this.state(identity);
    if (s) {
      s.mode = "paused";
      s.flowIssuedAt = 0;
      this.save(identity, s);
    }
    this.db.run(
      "UPDATE twilio_jobs SET onboarding_payload=NULL,onboarding_content=NULL WHERE identity=?",
      identity,
    );
  }
  locale(identity: string, s?: Row | null) {
    const lang =
      s?.draft?.language ||
      s?.locale ||
      this.host.companion.profile(identity).language;
    return ["en", "ta"].includes(lang)
      ? lang
      : lang === "tanglish"
        ? "en"
        : "fr";
  }
  steps(s: Row) {
    return [
      ...baseSteps,
      ...(["morning", "evening"].includes(s.draft.notifications)
        ? ["dailyTopics", "at", "timezone"]
        : []),
    ];
  }
  context(identity: string) {
    const s = this.state(identity);
    return s && ["chat", "review"].includes(s.mode)
      ? {
          mode: s.mode,
          currentField: s.mode === "chat" ? this.steps(s)[s.step] : null,
          allowed: values[this.steps(s)[s.step]] || null,
          draft: s.draft,
          requiresWrittenConfirmation: true,
        }
      : null;
  }
  question(identity: string, s: Row) {
    const w = copy[this.locale(identity, s)],
      steps = this.steps(s),
      k = steps[s.step];
    if (!k) return this.review(identity, s);
    const options = values[k]
      ?.map((v, i) => `${i + 1}. ${w[labels[k]][i]}`)
      .join("\n");
    return `${s.step + 1}/${steps.length} — ${w[k]}\n${options || (k === "at" ? w.timeHint : k === "timezone" ? w.zoneHint : w.optional)}\n\n${w.hint}`;
  }
  review(identity: string, s: Row) {
    const w = copy[this.locale(identity, s)];
    s.mode = "review";
    s.flowIssuedAt = 0;
    this.save(identity, s);
    const lines = Object.entries(s.draft)
      .filter(([k]) => k !== "notifications")
      .map(
        ([k, v]) =>
          `${w[k] || k} ${Array.isArray(v) ? v.map((x) => this.label(k, x, w)).join(", ") : this.label(k, String(v), w)}`,
      );
    const n = s.draft.notifications;
    return `${w.review}\n${lines.join("\n")}\n\n${n === "none" ? w.none : ["morning", "evening"].includes(n) ? w.dailyNotice : w.keep}\n\n${w.confirm}`;
  }
  label(k: string, v: string, w: Row) {
    const i = values[k]?.indexOf(v) ?? -1;
    return i >= 0 ? w[labels[k]][i] : v;
  }
  validation(k: string, v: any): any {
    if (["interests", "dailyTopics"].includes(k)) {
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
        } catch {
          v = v.split(/[,;]+/).map((x: string) => x.trim());
        }
      }
      check(
        Array.isArray(v) &&
          v.length <= 4 &&
          v.every(
            (x: unknown) => typeof x === "string" && values[k].includes(x),
          ),
        "onboarding_invalid_choice",
      );
      return [...new Set(v)];
    }
    check(
      typeof v === "string" && v.length <= 80 && !/[\r\n<>]/.test(v),
      "onboarding_invalid_choice",
    );
    v = v.trim();
    if (values[k]) check(values[k].includes(v), "onboarding_invalid_choice");
    else if (k === "at")
      check(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), "onboarding_invalid_time");
    else if (k === "timezone")
      new Intl.DateTimeFormat("fr", { timeZone: v }).format();
    else
      check(
        k === "city" &&
          v.length > 0 &&
          v.length <= 60 &&
          !/[\d@/?!]/.test(v) &&
          v.split(/\s+/).length <= 5 &&
          !/^(je |j[’']|i |help|aide|cherche|comment|besoin|want|please|qu[ei]|what|trouve|montre)/i.test(
            v,
          ),
        "onboarding_city_only",
      );
    return v;
  }
  choose(k: string, text: string, locale: string): any {
    if (!values[k])
      return this.validation(
        k,
        k === "timezone"
          ? {
              france: "Europe/Paris",
              inde: "Asia/Kolkata",
              india: "Asia/Kolkata",
            }[norm(text)] || text
          : text,
      );
    if (text.startsWith("[")) return this.validation(k, text);
    const parts = ["interests", "dailyTopics"].includes(k)
      ? text.split(/[,;]+/)
      : [text];
    const result = parts.map((part) => {
      const n = norm(part);
      const num = /^[1-9]$/.test(n) ? Number(n) - 1 : -1;
      if (num >= 0) return values[k][num];
      for (const lang of [locale, "fr", "en", "ta"]) {
        const i = copy[lang][labels[k]].findIndex((x: string) => norm(x) === n);
        if (i >= 0) return values[k][i];
      }
      return values[k].find((x) => norm(x) === n);
    });
    return this.validation(
      k,
      ["interests", "dailyTopics"].includes(k) ? result : result[0],
    );
  }
  advance(job: Row, k: string, value: any) {
    const s = this.state(job.identity);
    check(
      s?.mode === "chat" && this.steps(s)[s.step] === k,
      "onboarding_question_changed",
    );
    s.draft[k] = this.validation(k, value);
    if (k === "notifications" && !["morning", "evening"].includes(value))
      for (const x of ["dailyTopics", "at", "timezone"]) delete s.draft[x];
    s.step++;
    this.save(job.identity, s);
    return this.question(job.identity, s);
  }
  start(job: Row, preferFlow = false) {
    let s = this.state(job.identity);
    if (!s || !["chat", "paused", "flow", "review"].includes(s.mode))
      s = {
        mode: "chat",
        step: 0,
        draft: {},
        locale: this.locale(job.identity),
      };
    s.mode = "chat";
    s.flowIssuedAt = 0;
    const locale = this.locale(job.identity, s);
    if (
      preferFlow &&
      this.db.get(
        "SELECT sid FROM nanba_onboarding_templates WHERE kind='flow' AND locale=? AND status='approved'",
        locale,
      )
    ) {
      s.mode = "flow";
      s.flowIssuedAt = this.host.now();
      s.epoch = job.epoch;
      this.db.run(
        "UPDATE twilio_jobs SET onboarding_content=? WHERE sid=?",
        "flow:" + locale,
        job.sid,
      );
      this.save(job.identity, s);
      return copy[locale].flow;
    }
    this.save(job.identity, s);
    return copy[locale].intro + "\n\n" + this.question(job.identity, s);
  }
  profile(identity: string) {
    const p = this.host.companion.profile(identity),
      w = copy[this.locale(identity)];
    const keys = [
      "language",
      "replyMode",
      "interests",
      "city",
      "tone",
      "answerLength",
    ];
    const lines = keys
      .filter((k) => p[k] !== undefined)
      .map(
        (k) =>
          `${w[k === "answerLength" ? "length" : k]} ${Array.isArray(p[k]) ? p[k].map((x: string) => this.label(k, x, w)).join(", ") : this.label(k === "answerLength" ? "length" : k, p[k], w)}`,
      );
    const tasks = this.host.companion
      .tasks(identity)
      .filter((x) => ["morning", "evening"].includes(x.kind));
    return `${w.review}\n${lines.join("\n") || "—"}\n\n${tasks.length ? tasks.map((t) => `${t.at} (${t.timezone}) · ${t.topics.join(", ")}`).join("\n") : w.none}\n\n${w.footer}\nPERSONNALISER / PERSONALISE · QUESTIONS ICI / QUESTIONS HERE · OUBLIE`;
  }
  complete(job: Row, s: Row) {
    const identity = job.identity,
      d = s.draft,
      w = copy[this.locale(identity, s)];
    const result = this.db.tx(() => {
      check(this.host.currentJob(job), "conversation_cancelled");
      const next = { ...this.host.companion.profile(identity) };
      for (const k of [
        "language",
        "replyMode",
        "interests",
        "city",
        "tone",
        "length",
      ])
        if (Object.hasOwn(d, k))
          next[k === "length" ? "answerLength" : k] = this.validation(k, d[k]);
      let notice = "";
      this.db.run(
        "INSERT INTO nanba_profiles VALUES(?,?,?) ON CONFLICT(identity) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
        identity,
        this.host.seal(JSON.stringify(next)),
        this.host.now(),
      );
      if (["morning", "evening"].includes(d.notifications)) {
        check(
          d.dailyTopics?.length && d.at && d.timezone,
          "onboarding_schedule_incomplete",
        );
        const r = this.host.companion.routines.configure(identity, {
          consent: true,
          slots: [{ kind: d.notifications, at: d.at, topics: d.dailyTopics }],
          timezone: d.timezone,
        });
        notice = r.outside24h;
      } else if (d.notifications === "none") {
        this.db.run(
          "UPDATE twilio_jobs SET state='cancelled' WHERE identity=? AND schedule_id IN(SELECT id FROM nanba_tasks WHERE identity=? AND kind IN('morning','evening')) AND state IN('queued','generating','ready','waiting_template')",
          identity,
          identity,
        );
        this.db.run(
          "UPDATE nanba_tasks SET state='cancelled' WHERE identity=? AND kind IN('morning','evening')",
          identity,
        );
      }
      this.save(identity, {
        mode: "complete",
        locale: next.language || s.locale,
        confirmedAt: this.host.now(),
      });
      return notice;
    });
    return w.saved + (result ? "\n" + result : "");
  }
  submission(job: Row, payload: string) {
    const s = this.state(job.identity),
      w = copy[this.locale(job.identity, s)];
    if (
      !s ||
      s.mode !== "flow" ||
      s.epoch !== job.epoch ||
      this.host.now() - s.flowIssuedAt > 23 * 3600000
    )
      return w.stale;
    try {
      const data = JSON.parse(payload);
      check(
        data && typeof data === "object" && !Array.isArray(data),
        "invalid_flow",
      );
      const draft: Row = {};
      for (const k of [...baseSteps, "dailyTopics", "at", "timezone"])
        if (Object.hasOwn(data, k) && data[k] !== "" && data[k] !== null)
          draft[k] = this.validation(k, data[k]);
      check(Object.keys(draft).length > 0, "empty_flow");
      if (["morning", "evening"].includes(draft.notifications))
        draft.timezone ||= "Europe/Paris";
      else for (const k of ["dailyTopics", "at", "timezone"]) delete draft[k];
      s.draft = draft;
      s.step = 0;
      for (const k of ["dailyTopics", "at", "timezone"])
        if (
          ["morning", "evening"].includes(draft.notifications) &&
          (!draft[k] || !draft[k].length)
        ) {
          s.mode = "chat";
          s.step = this.steps(s).indexOf(k);
          this.save(job.identity, s);
          return this.question(job.identity, s);
        }
      return this.review(job.identity, s);
    } catch {
      return w.invalid + "\n" + w.flow;
    }
  }
  command(job: Row, text: string): string | null {
    if (
      this.host.support.active(job.identity) ||
      job.schedule_id ||
      job.parent_sid
    )
      return null;
    const s = this.state(job.identity),
      locale = this.locale(job.identity, s),
      w = copy[locale],
      t = norm(text.replace(/^Transcription du vocal \d+\s*:\s*/, "").trim());
    if (job.onboarding_payload) {
      const out = this.submission(
        job,
        this.host.unseal(job.onboarding_payload),
      );
      this.db.run(
        "UPDATE twilio_jobs SET onboarding_payload=NULL WHERE sid=?",
        job.sid,
      );
      return out;
    }
    if (starts.test(t) || t === "nanba:onboarding:start")
      return this.start(job, true);
    if (chats.test(t) || t === "nanba:onboarding:chat") return this.start(job);
    if (/^(mon profil|my profile)$/.test(t)) return this.profile(job.identity);
    if ((pause.test(t) || t === "nanba:onboarding:later") && s) {
      s.mode = "paused";
      s.flowIssuedAt = 0;
      this.save(job.identity, s);
      return w.paused;
    }
    if (cancel.test(t) && s) {
      this.save(job.identity, { mode: "cancelled", locale });
      return w.cancelled;
    }
    if (confirm.test(t)) {
      if (job.inbound_audio) return w.confirm;
      if (s?.mode !== "review") return w.noDraft;
      try {
        return this.complete(job, s);
      } catch (e) {
        s.mode = "chat";
        s.step = this.steps(s).indexOf("at");
        if (s.step < 0) s.step = 0;
        this.save(job.identity, s);
        return w.invalid + "\n" + this.question(job.identity, s);
      }
    }
    if (s && ["chat", "review"].includes(s.mode)) {
      if (back.test(t)) {
        s.mode = "chat";
        s.step = Math.max(0, (s.step ?? this.steps(s).length) - 1);
        this.save(job.identity, s);
        return this.question(job.identity, s);
      }
      if (s.mode === "review") return null;
      if (skip.test(t)) {
        const k = this.steps(s)[s.step];
        delete s.draft[k];
        if (["dailyTopics", "at", "timezone"].includes(k)) {
          s.draft.notifications = "keep";
          for (const x of ["dailyTopics", "at", "timezone"]) delete s.draft[x];
          s.step = baseSteps.length;
        } else s.step++;
        this.save(job.identity, s);
        return this.question(job.identity, s);
      }
      if (job.media) return null;
      const k = this.steps(s)[s.step];
      try {
        return this.advance(
          job,
          k,
          this.choose(
            k,
            text.replace(/^Transcription du vocal \d+\s*:\s*/, ""),
            locale,
          ),
        );
      } catch {
        return /^\d+(?:[,; ]\d+)*$/.test(t)
          ? w.invalid + "\n" + this.question(job.identity, s)
          : null;
      }
    }
    if (
      !s &&
      greetings.test(text) &&
      !job.media &&
      this.db.get(
        "SELECT count(*) n FROM twilio_jobs WHERE identity=?",
        job.identity,
      )?.n === 1
    ) {
      this.save(job.identity, { mode: "invited", locale });
      this.db.run(
        "UPDATE twilio_jobs SET onboarding_content=? WHERE sid=?",
        "welcome:" + locale,
        job.sid,
      );
      return w.welcome;
    }
    return null;
  }
  action(job: Row, args: Row) {
    if (args.action === "onboarding_start") return { message: this.start(job) };
    if (args.action === "onboarding_pause") {
      this.stop(job.identity);
      return { message: copy[this.locale(job.identity)].paused };
    }
    return {
      message: this.advance(job, args.onboardingField, args.onboardingValue),
    };
  }
  invite(job: Row, output: string) {
    if (
      job.schedule_id ||
      job.parent_sid ||
      job.file_id ||
      job.human_reply ||
      job.error ||
      this.host.support.active(job.identity) ||
      this.state(job.identity)
    )
      return output;
    if (
      this.db.get(
        "SELECT count(*) n FROM twilio_jobs WHERE identity=?",
        job.identity,
      )?.n !== 1
    )
      return output;
    const locale = this.locale(job.identity);
    this.save(job.identity, { mode: "invited", locale });
    return output + "\n\n" + copy[locale].newInvite;
  }
  form(job: Row): Record<string, string> | null {
    if (!job.onboarding_content) return null;
    const [kind, locale] = job.onboarding_content.split(":");
    const row = this.db.get(
      "SELECT * FROM nanba_onboarding_templates WHERE kind=? AND locale=?",
      kind,
      locale,
    );
    if (!row?.sid || (kind === "flow" && row.status !== "approved"))
      return null;
    return { ContentSid: row.sid };
  }
  status() {
    return {
      conversation: true,
      optional: true,
      templates: this.db.all(
        "SELECT kind,locale,status,error FROM nanba_onboarding_templates",
      ),
    };
  }
  async syncTemplates() {
    if (
      this.syncing ||
      this.host.env.NANBA_ONBOARDING_PROVISION !== "true" ||
      !this.host.ready()
    )
      return;
    this.syncing = true;
    const base = "https://content.twilio.com/v1/Content",
      headers = {
        Authorization: this.host.authorization(this.host.config()),
        "Content-Type": "application/json",
      };
    try {
      for (const locale of ["fr", "en", "ta"])
        for (const kind of ["welcome", "flow"] as const) {
          let row = this.db.get(
            "SELECT * FROM nanba_onboarding_templates WHERE kind=? AND locale=?",
            kind,
            locale,
          );
          if (!row?.sid) {
            // A reserved row prevents unbounded duplicate creates after network ambiguity/restarts.
            if (row?.status === "creating" || row?.status === "uncertain")
              continue;
            if (row?.status === "rejected") continue;
            this.db.run(
              "INSERT INTO nanba_onboarding_templates VALUES(?,?,NULL,?,NULL) ON CONFLICT(kind,locale) DO UPDATE SET status=excluded.status",
              kind,
              locale,
              "creating",
            );
            try {
              const r = await this.host.fetcher(base, {
                method: "POST",
                headers,
                body: JSON.stringify(onboardingTemplate(locale, kind)),
                signal: AbortSignal.timeout(15000),
                redirect: "error",
              });
              if (!r.ok) {
                const e = (await r.json().catch(() => ({}))) as Row;
                this.db.run(
                  "UPDATE nanba_onboarding_templates SET status=?,error=? WHERE kind=? AND locale=?",
                  "rejected",
                  `http_${r.status}_code_${Number(e.code) || 0}`,
                  kind,
                  locale,
                );
                continue;
              }
              const data = (await r.json()) as Row;
              check(/^HX[0-9a-f]{32}$/i.test(data.sid), "invalid_content_sid");
              this.db.run(
                "UPDATE nanba_onboarding_templates SET sid=?,status=?,error=NULL WHERE kind=? AND locale=?",
                data.sid,
                kind === "welcome" ? "in_session" : "unsubmitted",
                kind,
                locale,
              );
              row = {
                sid: data.sid,
                status: kind === "welcome" ? "in_session" : "unsubmitted",
              };
            } catch {
              this.db.run(
                "UPDATE nanba_onboarding_templates SET status=?,error=? WHERE kind=? AND locale=?",
                "uncertain",
                "create_response_unknown",
                kind,
                locale,
              );
              continue;
            }
          }
          if (kind !== "flow") continue;
          if (row.status === "unsubmitted") {
            const r = await this.host.fetcher(
              `${base}/${row.sid}/ApprovalRequests/whatsapp`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  name: `nanba_onboarding_flow_${locale}_v1`,
                  category: "MARKETING",
                }),
                signal: AbortSignal.timeout(15000),
                redirect: "error",
              },
            );
            this.db.run(
              "UPDATE nanba_onboarding_templates SET status=?,error=? WHERE kind=? AND locale=?",
              r.ok ? "pending" : "submission_failed",
              r.ok ? null : `approval_http_${r.status}`,
              kind,
              locale,
            );
          }
          const r = await this.host.fetcher(
            `${base}/${row.sid}/ApprovalRequests`,
            { headers, signal: AbortSignal.timeout(10000), redirect: "error" },
          );
          if (r.ok) {
            const data = (await r.json()) as Row;
            const status = String(
              data.whatsapp?.status || data.status || "unknown",
            ).toLowerCase();
            this.db.run(
              "UPDATE nanba_onboarding_templates SET status=? WHERE kind=? AND locale=?",
              [
                "approved",
                "pending",
                "received",
                "rejected",
                "unsubmitted",
              ].includes(status)
                ? status
                : "unknown",
              kind,
              locale,
            );
          }
        }
    } finally {
      this.syncing = false;
    }
  }
}
