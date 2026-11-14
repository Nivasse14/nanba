import type { TwilioAssistant } from "./twilio-assistant.ts";
export class Presence {
  host: TwilioAssistant;
  pending = new Set<string>();
  constructor(host: TwilioAssistant) {
    this.host = host;
    for (const [name, type] of Object.entries({
      presence_at: "INTEGER",
      presence_state: "TEXT",
      presence_error: "TEXT",
    }))
      if (
        !host.db
          .all("PRAGMA table_info(twilio_jobs)")
          .some((x) => x.name === name)
      )
        host.db.raw.exec(`ALTER TABLE twilio_jobs ADD COLUMN ${name} ${type}`);
  }
  get enabled() {
    return this.host.env.TWILIO_PRESENCE_ENABLED === "true";
  }
  async indicate(sid: string) {
    const h = this.host;
    if (
      !this.enabled ||
      !h.ready() ||
      !/^(SM|MM)[a-f0-9]{32}$/i.test(sid) ||
      this.pending.has(sid)
    )
      return;
    const j = h.db.get(
      "SELECT j.* FROM twilio_jobs j JOIN twilio_contacts c ON c.identity=j.identity WHERE j.sid=? AND j.state IN('queued','generating','ready') AND c.epoch=j.epoch AND c.stopped=0 AND j.parent_sid IS NULL",
      sid,
    );
    if (
      !j ||
      h.now() - j.created_at > 15 * 60000 ||
      (j.presence_at !== null && h.now() - j.presence_at < 20000)
    )
      return;
    this.pending.add(sid);
    h.db.run(
      "UPDATE twilio_jobs SET presence_at=?,presence_state='requested',presence_error=NULL WHERE sid=?",
      h.now(),
      sid,
    );
    try {
      const response = await h.fetcher(
        "https://messaging.twilio.com/v3/Indicators/Typing.json",
        {
          method: "POST",
          headers: {
            Authorization: h.authorization(h.config()),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel: "WHATSAPP", messageId: sid }),
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        },
      );
      if (!response.ok) throw Error("presence_http_" + response.status);
      const data = (await response.json()) as { success?: boolean };
      if (data.success !== true) throw Error("presence_not_confirmed");
      h.db.run(
        "UPDATE twilio_jobs SET presence_state='accepted' WHERE sid=?",
        sid,
      );
    } catch (e) {
      try {
        h.db.run(
          "UPDATE twilio_jobs SET presence_state='failed',presence_error=? WHERE sid=?",
          e instanceof Error && /^presence_/.test(e.message)
            ? e.message
            : "presence_unavailable",
          sid,
        );
      } catch {
        /* shutdown does not affect a reply */
      }
    } finally {
      this.pending.delete(sid);
    }
  }
  begin(sid: string) {
    if (!this.enabled || !/^(SM|MM)[a-f0-9]{32}$/i.test(sid)) return () => {};
    void this.indicate(sid).catch(() => {});
    let count = 0;
    const timer = setInterval(() => {
      if (++count >= 8) {
        clearInterval(timer);
        return;
      }
      void this.indicate(sid).catch(() => {});
    }, 20000);
    timer.unref();
    return () => clearInterval(timer);
  }
  async probe() {
    // Missing required messageId deliberately: this cannot mark a user's message as read.
    const h = this.host,
      r = await h.fetcher(
        "https://messaging.twilio.com/v3/Indicators/Typing.json",
        {
          method: "POST",
          headers: {
            Authorization: h.authorization(h.config()),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel: "WHATSAPP" }),
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        },
      );
    let code: unknown = null;
    try {
      code = ((await r.json()) as { code?: unknown }).code || null;
    } catch {}
    return {
      sentToWhatsApp: false,
      requestHasNoRecipient: true,
      httpStatus: r.status,
      providerCode: code,
      validationReached: r.status === 400,
    };
  }
  status() {
    return {
      enabled: this.enabled,
      mode: "read_and_typing",
      lastResult:
        this.host.db.get(
          "SELECT presence_state AS state,presence_error AS error,presence_at AS at FROM twilio_jobs WHERE presence_at IS NOT NULL ORDER BY presence_at DESC LIMIT 1",
        ) || null,
    };
  }
}
