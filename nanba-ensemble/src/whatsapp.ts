import { createHmac } from "node:crypto";
import { check, text, integer, oneOf } from "./validation.ts";
import { safeEqual, hash } from "./auth.ts";
import type { Row } from "./db.ts";
export const WAHA_VERSION = "2026.10.1";
export type Message = {
  chatId: string;
  kind: "text" | "poll";
  text?: string;
  question?: string;
  options?: { id: string; label: string }[];
  multiple?: boolean;
  replyTo?: string;
  mentions?: string[];
};
export interface WhatsAppConnector {
  mode: "simulated" | "waha";
  session: string;
  capabilities: Row;
  health(): Promise<{ status: string }>;
  send(message: Message): Promise<{ id: string; simulated: boolean }>;
  participants(chatId: string): Promise<Row[]>;
}
export class TransportFailure extends Error {
  uncertain: boolean;
  constructor(code: string, uncertain: boolean) {
    super(code);
    this.uncertain = uncertain;
  }
}
export const capabilities = {
  text: { documented: true, implemented: true },
  polls: { documented: true, implemented: true },
  votes: { documented: true, implemented: true },
  participants: { documented: true, implemented: true },
  mentions: { documented: true, implemented: true },
  replies: { documented: true, implemented: true },
  media: { documented: true, implemented: false },
  nativeEvents: { documented: false, implemented: false },
  nativeRSVP: { documented: false, implemented: false },
  closePoll: { documented: false, implemented: false },
  editPoll: { documented: false, implemented: false },
  hideVoters: { documented: false, implemented: false },
};
export class SimulatedConnector implements WhatsAppConnector {
  mode = "simulated" as const;
  session: string;
  capabilities = { ...capabilities, liveVerified: false };
  sent: Message[] = [];
  failure: "none" | "timeout" | "disconnected" = "none";
  constructor(session = "nanba-pilot") {
    this.session = session;
  }
  async health() {
    return {
      status: this.failure === "disconnected" ? "disconnected" : "simulated",
    };
  }
  async send(message: Message) {
    if (this.failure === "timeout")
      throw new TransportFailure("simulated_timeout", true);
    if (this.failure === "disconnected")
      throw new TransportFailure("simulated_disconnected", false);
    this.sent.push(message);
    return { id: "simulated:" + crypto.randomUUID(), simulated: true };
  }
  async participants(_chatId: string) {
    return [];
  }
}
export class WahaConnector implements WhatsAppConnector {
  mode = "waha" as const;
  session: string;
  capabilities = { ...capabilities, liveVerified: false };
  base: string;
  apiKey: string;
  fetcher: typeof fetch;
  privateChatIds: () => string[];
  private selfLid?: { phone: string; lid: string; expires: number };
  constructor(options: {
    base: string;
    apiKey: string;
    session: string;
    engine: string;
    allowReal: boolean;
    privateHostport?: string;
    fetcher?: typeof fetch;
    privateChatIds?: () => string[];
  }) {
    check(options.allowReal, "real_send_not_authorized", 503);
    check(options.engine === "WEBJS", "engine_not_validated", 503);
    check(options.apiKey.length >= 16, "waha_key_missing", 503);
    const u = new URL(options.base);
    check(
      ["http:", "https:"].includes(u.protocol) &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash,
      "invalid_waha_url",
    );
    check(
      u.protocol === "https:" ||
        ["localhost", "127.0.0.1", "waha"].includes(u.hostname) ||
        (!!options.privateHostport &&
          /^[a-z0-9][a-z0-9-]*:\d{2,5}$/.test(options.privateHostport) &&
          u.host === options.privateHostport),
      "waha_https_required",
    );
    this.base = u.href.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.session = options.session;
    this.fetcher = options.fetcher ?? fetch;
    this.privateChatIds = options.privateChatIds ?? (() => []);
  }
  async request(path: string, body?: Row, method?: "PUT") {
    let response: Response;
    try {
      response = await this.fetcher(this.base + path, {
        method: method ?? (body ? "POST" : "GET"),
        headers: {
          "X-Api-Key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
    } catch {
      throw new TransportFailure("provider_timeout_or_network", !!body);
    }
    if (!response.ok)
      throw new TransportFailure(
        "provider_http_" + response.status,
        !!body && (response.status >= 500 || response.status === 408),
      );
    try {
      return (await response.json()) as any;
    } catch {
      throw new TransportFailure("provider_invalid_response", !!body);
    }
  }
  async health() {
    try {
      const r = await this.request(
        "/api/sessions/" + encodeURIComponent(this.session),
      );
      return { status: r.status === "WORKING" ? "connected" : "disconnected" };
    } catch {
      return { status: "disconnected" };
    }
  }
  async resolveSelfIdentity(body: Row) {
    const p = body.payload;
    const phone = body.me?.id;
    // Some WEBJS sessions omit me.lid even though messages use that identifier.
    // Resolve only explicitly addressed owner messages, using the provider's own
    // phone-to-LID mapping. Never infer a self-chat from fromMe alone.
    if (
      body.session !== this.session ||
      !["message", "message.any"].includes(body.event) ||
      p?.fromMe !== true ||
      p.source === "api" ||
      body.source === "api" ||
      !/^\/?nanba\b/i.test(p.body ?? "") ||
      !/^\d+@c\.us$/.test(phone ?? "") ||
      !/^\d+@lid$/.test(p.to ?? "") ||
      body.me?.lid === p.to ||
      !this.privateChatIds().includes(phone)
    )
      return;
    if (
      !this.selfLid ||
      this.selfLid.phone !== phone ||
      this.selfLid.expires < Date.now()
    ) {
      const mapping = await this.request(
        "/api/" +
          encodeURIComponent(this.session) +
          "/lids/pn/" +
          encodeURIComponent(phone),
      );
      check(mapping.pn === phone, "invalid_self_identity_mapping", 502);
      if (!/^\d+@lid$/.test(mapping.lid ?? "")) return;
      this.selfLid = { phone, lid: mapping.lid, expires: Date.now() + 300000 };
    }
    if (p.to === this.selfLid.lid)
      body.me = { ...body.me, lid: this.selfLid.lid };
  }
  async participants(chatId: string) {
    check(chatId.endsWith("@g.us"), "group_required");
    const r = await this.request(
      "/api/" +
        encodeURIComponent(this.session) +
        "/groups/" +
        encodeURIComponent(chatId) +
        "/participants",
    );
    check(Array.isArray(r), "invalid_participants", 502);
    return r;
  }
  async send(m: Message) {
    check(
      m.chatId.endsWith("@g.us") || this.privateChatIds().includes(m.chatId),
      "group_required",
    );
    const payload: Row = { session: this.session, chatId: m.chatId };
    if (m.kind === "poll")
      payload.poll = {
        name: m.question,
        options: m.options!.map((x) => x.label),
        multipleAnswers: !!m.multiple,
      };
    else {
      payload.text = m.text;
      payload.reply_to = m.replyTo ?? null;
      if (m.mentions) payload.mentions = m.mentions;
    }
    const result = await this.request(
      m.kind === "poll" ? "/api/sendPoll" : "/api/sendText",
      payload,
    );
    // WEBJS sends return a MessageId object; other WAHA engines/endpoints
    // return the serialized string directly.
    const id =
      typeof result.id === "string" ? result.id : result.id?._serialized;
    if (typeof id !== "string" || !id || id.length > 500)
      throw new TransportFailure("missing_provider_id", true);
    return { id, simulated: false };
  }
}
export function verifyWaha(
  raw: Buffer,
  headers: Record<string, any>,
  secret: string,
) {
  check(secret.length >= 32, "webhook_not_configured", 503);
  check(
    headers["x-webhook-hmac-algorithm"] === "sha512",
    "invalid_webhook_signature",
    401,
  );
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  check(
    typeof headers["x-webhook-hmac"] === "string" &&
      safeEqual(expected, headers["x-webhook-hmac"]),
    "invalid_webhook_signature",
    401,
  );
}
export function normalizeWaha(
  body: Row,
  provider: "waha" | "simulated",
  session: string,
  lookup: (chatId: string) => Row | undefined,
  optionsFor: (messageId: string) => Row[] | undefined,
): Row | null {
  check(body.session === session, "wrong_session", 403);
  check(body.payload && typeof body.payload === "object", "invalid_payload");
  const p = body.payload;
  if (body.event === "session.status")
    return {
      provider,
      session,
      id: text(body.id ?? hash(JSON.stringify(p)), "event_id", 300),
      groupId: "session",
      type: "session",
      status: oneOf(
        p.status,
        ["WORKING", "STOPPED", "STARTING", "SCAN_QR_CODE", "FAILED"],
        "status",
      ),
    };
  if (["poll.vote", "poll.vote.failed"].includes(body.event)) {
    check(p.vote && p.poll, "invalid_vote");
    const chat = text(p.poll.to, "chatId", 150),
      group = lookup(chat);
    if (
      p.vote.fromMe &&
      (!group || !JSON.parse(group.settings ?? "{}").assistantEnabled)
    )
      return null;
    check(group?.allowed, "group_not_allowed", 403);
    check(p.vote.to === chat, "wrong_vote_context");
    const known = optionsFor(text(p.poll.id, "poll_id", 500));
    if (!known) return null;
    check(Array.isArray(p.vote.selectedOptions), "invalid_choices");
    const choices = p.vote.selectedOptions.map((label: unknown) => {
      const o = known.find((x) => x.label === label);
      check(o, "unknown_poll_option");
      return o.id;
    });
    // Pinned WAHA contract: vote.timestamp is in seconds. Never guess milliseconds.
    const seconds = integer(p.vote.timestamp, "vote_timestamp", 1, 9999999999);
    return {
      provider,
      session,
      id: text(p.vote.id, "vote_id", 500),
      groupId: group.id,
      type: "vote",
      messageId: p.poll.id,
      voter: text(
        p.vote.fromMe && JSON.parse(group.settings ?? "{}").selfTest
          ? body.me?.id
          : p.vote.from,
        "voter",
        150,
      ),
      choices,
      at: seconds * 1000,
      failed: body.event === "poll.vote.failed",
    };
  }
  if (["message", "message.any"].includes(body.event)) {
    if (p.source === "api" || body.source === "api") return null;
    const content = typeof p.body === "string" ? p.body.slice(0, 3000) : "";
    const addressed = /^\/?nanba\b[\s,:-]*/i.test(content);
    let chat = p.fromMe ? (p.to ?? p.from) : p.from;
    if (p.fromMe && [body.me?.id, body.me?.lid].filter(Boolean).includes(chat))
      chat = body.me.id;
    const group = lookup(text(chat, "chatId", 150));
    if (!group?.allowed) return null;
    const settings = JSON.parse(group.settings ?? "{}");
    // An owner can test from their phone; API replies and ordinary outgoing messages never trigger a reply.
    if (p.fromMe && !(addressed && settings.assistantEnabled)) return null;
    if (
      !chat.endsWith("@g.us") &&
      !(settings.selfTest && p.fromMe) &&
      !(settings.privateChat && !p.fromMe)
    )
      return null;
    const mentioned =
      Array.isArray(p.mentionedIds) &&
      typeof body.me?.id === "string" &&
      p.mentionedIds.includes(body.me.id);
    const replying = p.replyTo?.from === body.me?.id && !!body.me?.id;
    if (
      !addressed &&
      !/^\/(aide|help|proposer|événements|evenements|résultats|resultats|signaler|pause|lier)\b/i.test(
        content,
      ) &&
      !mentioned &&
      !replying
    )
      return null;
    return {
      provider,
      session,
      id: text(p.id, "message_id", 500),
      groupId: group.id,
      type: "command",
      sender: text(
        p.fromMe
          ? body.me?.id
          : settings.privateChat
            ? p.from
            : (p.participant ?? p.author),
        "sender",
        150,
      ),
      body: content,
      at: integer(p.timestamp, "timestamp", 1, 9999999999) * 1000,
    };
  }
  return null;
}
