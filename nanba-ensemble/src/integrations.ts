import { check, text, integer } from "./validation.ts";
import { uid, json, type Row } from "./db.ts";
import type { Domain } from "./modules.ts";
import type { Context } from "./core.ts";
export interface NanbaCatalog {
  searchAuthorized(
    context: Context,
    query: { zone: string; budget: number },
  ): Promise<{ items: Row[]; configured: boolean }>;
}
export class UnconfiguredNanbaCatalog implements NanbaCatalog {
  async searchAuthorized(
    _context: Context,
    _query: { zone: string; budget: number },
  ) {
    return { items: [], configured: false };
  }
}
export interface TranslationProvider {
  translate(input: {
    text: string;
    from: string;
    to: string;
  }): Promise<{ text: string; uncertain: boolean }>;
}
export interface TranscriptionProvider {
  transcribe(input: {
    bytes: Uint8Array;
    mime: "audio/ogg" | "audio/mpeg";
    language: string;
  }): Promise<{ text: string; uncertain: boolean }>;
}
export interface PaymentEvent {
  provider: string;
  eventId: string;
  orderId: string;
  providerOrder: string;
  amount: number;
  currency: string;
  beneficiary: string;
  offerVersion: number;
  enrollmentId: string;
  type: "paid" | "refunded";
}
export interface PaymentProvider {
  name: string;
  createCheckout(order: Row): Promise<{ providerOrder: string; url: string }>;
  verifyWebhook(
    raw: Buffer,
    headers: Record<string, string>,
  ): Promise<PaymentEvent>;
}
export class Payments {
  app: Domain;
  provider: PaymentProvider | null;
  constructor(app: Domain, provider: PaymentProvider | null = null) {
    this.app = app;
    this.provider = provider;
  }
  prepare(c: Context, enrollmentId: string) {
    const a = this.app;
    a.member(c);
    return a.db.tx(() => {
      const e = a.db.get(
        "SELECT * FROM enrollments WHERE id=? AND user_id=?",
        enrollmentId,
        c.userId,
      );
      check(e, "not_found", 404);
      const r = a.get(c, e.record_id, "offer");
      check(
        e.status === "confirmed" &&
          e.accepted_version === r.version &&
          r.status === "confirmed",
        "terms_not_accepted",
        409,
      );
      const existing = a.db.get(
        "SELECT * FROM payment_orders WHERE enrollment_id=?",
        e.id,
      );
      if (existing) {
        check(existing.offer_version === r.version, "payment_order_stale", 409);
        return existing;
      }
      const id = uid();
      a.db.run(
        "INSERT INTO payment_orders VALUES(?,?,?,?,?,?,?,?,?)",
        id,
        e.id,
        r.version,
        r.data.price * e.seats,
        "EUR",
        r.data.orgId,
        "unconfigured",
        null,
        0,
      );
      return a.db.get("SELECT * FROM payment_orders WHERE id=?", id)!;
    });
  }
  async checkout(c: Context, id: string) {
    check(this.provider, "payment_not_configured", 503);
    const order = this.prepare(c, id);
    const result = await this.provider.createCheckout(order);
    this.app.db.run(
      "UPDATE payment_orders SET provider_order=?,status='pending' WHERE id=?",
      result.providerOrder,
      order.id,
    );
    return result;
  }
  async webhook(raw: Buffer, headers: Record<string, string>) {
    check(this.provider, "payment_not_configured", 503);
    const verified = await this.provider.verifyWebhook(raw, headers);
    return this.applyVerified(verified);
  }
  applyVerified(e: PaymentEvent) {
    const a = this.app;
    return a.db.tx(() => {
      const order = a.db.get(
        "SELECT * FROM payment_orders WHERE id=?",
        text(e.orderId, "orderId"),
      );
      check(order, "unknown_payment_order", 404);
      check(
        order.amount === integer(e.amount, "amount") &&
          order.currency === e.currency &&
          order.beneficiary === e.beneficiary &&
          order.enrollment_id === e.enrollmentId &&
          order.offer_version === e.offerVersion &&
          order.provider_order === e.providerOrder,
        "payment_mismatch",
        409,
      );
      const enrollment = a.db.get(
        "SELECT * FROM enrollments WHERE id=?",
        order.enrollment_id,
      )!;
      const offer = a.raw(enrollment.record_id);
      check(
        offer.version === e.offerVersion &&
          enrollment.accepted_version === e.offerVersion,
        "payment_version_mismatch",
        409,
      );
      check(
        !this.provider || this.provider.name === e.provider,
        "payment_provider_mismatch",
        409,
      );
      const prior = a.db.get(
        "SELECT 1 FROM payment_events WHERE provider=? AND event_id=?",
        e.provider,
        e.eventId,
      );
      if (prior) return { duplicate: true };
      if (e.type === "paid")
        check(
          enrollment.status === "confirmed" &&
            offer.status === "confirmed" &&
            order.status === "pending",
          "payment_invalid_state",
          409,
        );
      else check(order.status === "paid", "refund_invalid_state", 409);
      a.db.run(
        "INSERT INTO payment_events VALUES(?,?,?,?)",
        e.provider,
        e.eventId,
        order.id,
        a.now(),
      );
      a.db.run(
        "UPDATE payment_orders SET status=? WHERE id=?",
        e.type,
        order.id,
      );
      return { status: e.type };
    });
  }
}
export function calendarEvent(r: Row) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const dt = (n: number) =>
    new Date(n)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nanba Ensemble//FR",
    "BEGIN:VEVENT",
    "UID:" + r.id + "@nanba-ensemble",
    "DTSTAMP:" + dt(r.created_at),
    "DTSTART:" + dt(r.data.startsAt),
    "DTEND:" + dt(r.data.startsAt + 3600000),
    "SUMMARY:" + escape(r.data.title),
    "LOCATION:" + escape(r.data.place ?? r.data.zone),
    "DESCRIPTION:" + escape(r.data.description ?? ""),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
export function xml(s: string) {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
export function storyCard(r: Row) {
  const wrap = (s: string) => {
    const result: string[] = [];
    for (const paragraph of s.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if ((line + " " + word).length > 43) {
          result.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      if (line) result.push(line);
      result.push("");
    }
    return result;
  };
  const left = wrap(r.data.original),
    right = wrap(r.data.translation);
  const h = Math.max(900, 310 + Math.max(left.length, right.length) * 30);
  const column = (lines: string[], x: number) =>
    lines
      .map(
        (line, i) =>
          `<text x="${x}" y="${235 + i * 30}" font-size="22" fill="#173c36">${xml(line)}</text>`,
      )
      .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}"><rect width="1080" height="${h}" rx="24" fill="#f7f3e8"/><rect x="40" y="40" width="1000" height="90" rx="15" fill="#184d42"/><text x="65" y="95" font-family="sans-serif" fill="white" font-size="30">${xml(r.data.title)}</text><g font-family="sans-serif">${column(left, 55)}${column(right, 565)}<text x="55" y="${h - 95}" font-size="23" fill="#184d42">${xml(r.data.credit)} · ${xml(r.data.language)} / ${xml(r.data.translationLanguage)}</text><text x="55" y="${h - 45}" font-size="19" fill="#6c7770">Nanba Ensemble · Récit personnel validé par son auteur</text></g></svg>`;
}
export function challengeCard(
  title: string,
  rows: Row[],
  rulesVersion: number,
) {
  const h = 270 + rows.length * 85;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${h}" viewBox="0 0 900 ${h}"><rect width="900" height="${h}" rx="24" fill="#f7f3e8"/><g font-family="sans-serif" fill="#183f36"><text x="45" y="65" font-size="27">${xml(title)}</text><text x="45" y="110" font-size="17">Classement final · points / membres inscrits · règles v${rulesVersion}</text>${rows.map((r, i) => `<text x="45" y="${185 + i * 85}" font-size="25">${i + 1}. ${xml(r.team)}</text><text x="520" y="${185 + i * 85}" font-size="25">${r.score.toFixed(2)} (${r.points} / ${r.participants})</text>`).join("")}<text x="45" y="${h - 40}" font-size="18">Nanba Ensemble · résultats calculés · aucune donnée individuelle</text></g></svg>`;
}
