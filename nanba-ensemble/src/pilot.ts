import { uid, json, parse, type Row } from "./db.ts";
import { hash, passwordHash, safeEqual } from "./auth.ts";
import { check, text } from "./validation.ts";
import type { Domain } from "./modules.ts";
import type { Context } from "./core.ts";
import { WahaConnector } from "./whatsapp.ts";

export function setupAvailable(a: Domain, expected: string) {
  return (
    /^[a-f0-9]{64}$/.test(expected) &&
    !a.db.get("SELECT id FROM users WHERE platform_admin=1 LIMIT 1")
  );
}
export function authorizeSetup(a: Domain, key: string, expected: string) {
  check(setupAvailable(a, expected), "setup_closed", 409);
  check(
    safeEqual(hash(text(key, "key", 150)), expected),
    "invalid_setup_key",
    403,
  );
}
export function setupOwner(a: Domain, input: Row, expected: string) {
  check(setupAvailable(a, expected), "setup_closed", 409);
  check(
    safeEqual(hash(text(input.key, "key", 150)), expected),
    "invalid_setup_key",
    403,
  );
  const email = text(input.email, "email", 250).toLowerCase();
  check(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "invalid_email");
  const name = text(input.name, "name", 120);
  const password = text(input.password, "password", 200);
  check(password.length >= 14, "password_too_short");
  const encoded = passwordHash(password);
  return a.db.tx(() => {
    check(setupAvailable(a, expected), "setup_closed", 409);
    const id = uid();
    a.db.run("INSERT INTO communities VALUES('pilot','Nanba Ensemble pilote')");
    a.db.run(
      "INSERT INTO groups(id,community_id,name,zone,allowed) VALUES('pilot','pilot','Nanba · groupe de test','France',0)",
    );
    a.db.run(
      "INSERT INTO users VALUES(?,?,?,?,1,NULL,'{}',0,?)",
      id,
      email,
      name,
      encoded,
      a.now(),
    );
    a.db.run("INSERT INTO memberships VALUES(?,'pilot','group_admin',1)", id);
    if (a.db.get("SELECT id FROM groups WHERE id='pilot-self'")) {
      a.db.run(
        "INSERT INTO memberships VALUES(?,'pilot-self','group_admin',1)",
        id,
      );
      a.db.run(
        "UPDATE identities SET user_id=? WHERE user_id='pilot-whatsapp-owner'",
        id,
      );
      a.db.run(
        "UPDATE records SET owner_id=? WHERE owner_id='pilot-whatsapp-owner'",
        id,
      );
    }
    a.audit({ userId: id, groupId: "pilot" }, "pilot.owner_created", id);
    return { id, email };
  });
}
export class Pilot {
  app: Domain;
  connector: WahaConnector;
  origin: string;
  webhookSecret: string;
  constructor(
    app: Domain,
    connector: WahaConnector,
    origin: string,
    webhookSecret: string,
  ) {
    this.app = app;
    this.connector = connector;
    this.origin = origin;
    this.webhookSecret = webhookSecret;
  }
  authorize(c: Context) {
    check(this.app.admin(c).platform_admin, "platform_admin_required", 403);
  }
  async status(c: Context) {
    this.authorize(c);
    return this.readStatus();
  }
  async readStatus() {
    let state;
    try {
      state = await this.connector.request(
        "/api/sessions/" + encodeURIComponent(this.connector.session),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "provider_http_404")
        return { status: "NOT_CREATED", connected: false };
      throw e;
    }
    return {
      status: state.status,
      connected: state.status === "WORKING",
      session: this.connector.session,
      personalTestReady:
        state.status === "WORKING" &&
        !!this.app.db.get(
          "SELECT 1 FROM groups WHERE id='pilot-self' AND chat_id=? AND allowed=1 AND paused=0",
          state.me?.id ?? "",
        ),
    };
  }
  async connect(c: Context) {
    this.authorize(c);
    const result = await this.startSession();
    this.app.audit(c, "pilot.session_start_requested");
    return result;
  }
  async startSession() {
    const current = await this.readStatus();
    if (["WORKING", "STARTING", "SCAN_QR_CODE"].includes(current.status))
      return current;
    check(current.status !== "FAILED", "session_failed_manual_review", 409);
    const config = {
      webhooks: [
        {
          url: this.origin + "/api/webhooks/waha",
          events: [
            "message.any",
            "poll.vote",
            "poll.vote.failed",
            "session.status",
          ],
          hmac: { key: this.webhookSecret },
          retries: { policy: "exponential", delaySeconds: 2, attempts: 10 },
        },
      ],
    };
    if (current.status === "NOT_CREATED")
      await this.connector.request("/api/sessions", {
        name: this.connector.session,
        start: true,
        config,
      });
    else {
      await this.connector.request(
        "/api/sessions/" + encodeURIComponent(this.connector.session),
        { config },
        "PUT",
      );
      await this.connector.request(
        "/api/sessions/" +
          encodeURIComponent(this.connector.session) +
          "/start",
        {},
      );
    }
    return this.readStatus();
  }
  async qr(c: Context) {
    this.authorize(c);
    return this.readQr();
  }
  async readQr() {
    const state = await this.readStatus();
    check(state.status === "SCAN_QR_CODE", "qr_not_ready", 409);
    const result = await this.connector.request(
      "/api/" + encodeURIComponent(this.connector.session) + "/auth/qr",
    );
    check(
      result.mimetype === "image/png" &&
        typeof result.data === "string" &&
        result.data.length < 500000 &&
        /^[a-zA-Z0-9+/=]+$/.test(result.data),
      "invalid_qr_response",
      502,
    );
    return { image: "data:image/png;base64," + result.data };
  }
  async enableSelfTest() {
    const state = await this.connector.request(
      "/api/sessions/" + encodeURIComponent(this.connector.session),
    );
    check(state.status === "WORKING", "whatsapp_not_connected", 409);
    const ownId = text(state.me?.id, "whatsapp_account", 150);
    check(/^\d+@c\.us$/.test(ownId), "unsupported_self_chat", 409);
    return this.app.db.tx(() => {
      const a = this.app,
        actor = "pilot-whatsapp-owner";
      const existing = a.db.get("SELECT * FROM groups WHERE id='pilot-self'");
      check(
        !existing || existing.chat_id === ownId,
        "self_test_account_changed",
        409,
      );
      a.db.run(
        "INSERT OR IGNORE INTO communities VALUES('pilot-personal','Nanba · essai personnel')",
      );
      a.db.run(
        "INSERT OR IGNORE INTO users VALUES(?,?,'Propriétaire WhatsApp','!whatsapp-only',0,NULL,'{}',0,?)",
        actor,
        actor + "@nanba.invalid",
        a.now(),
      );
      a.db.run(
        "INSERT OR IGNORE INTO groups(id,community_id,name,zone,chat_id,allowed,settings) VALUES('pilot-self','pilot-personal','Test personnel WhatsApp','France',?,1,?)",
        ownId,
        json({ assistantEnabled: true, selfTest: true }),
      );
      a.db.run("UPDATE groups SET allowed=1,paused=0 WHERE id='pilot-self'");
      a.db.run(
        "INSERT OR IGNORE INTO memberships VALUES(?,'pilot-self','group_admin',1)",
        actor,
      );
      const identity = a.identity(a.mode, a.session, ownId);
      const prior = a.db.get(
        "SELECT user_id FROM identities WHERE identity_hash=?",
        identity,
      )!;
      check(
        !prior.user_id || prior.user_id === actor,
        "identity_already_linked",
        409,
      );
      a.db.run(
        "UPDATE identities SET user_id=?,verified_at=? WHERE identity_hash=?",
        actor,
        a.now(),
        identity,
      );
      a.audit(
        { userId: actor, groupId: "pilot-self" },
        "pilot.self_test_authorized",
      );
      return {
        ready: true,
        instructions:
          "Dans WhatsApp, ouvre ta discussion avec toi-même et écris : Nanba aide",
      };
    });
  }
  async groups(c: Context) {
    this.authorize(c);
    const list = await this.connector.request(
      "/api/" +
        encodeURIComponent(this.connector.session) +
        "/groups?limit=100&offset=0",
    );
    const entries = Array.isArray(list) ? list : Object.values(list);
    return entries
      .map((g: any) => ({
        id: typeof g.id === "string" ? g.id : g.id?._serialized,
        name: String(g.subject ?? g.name ?? "Groupe WhatsApp"),
      }))
      .filter((g) => typeof g.id === "string" && g.id.endsWith("@g.us"));
  }
  async bind(c: Context, input: Row) {
    this.authorize(c);
    check(c.groupId !== "pilot-self", "personal_test_group_reserved", 409);
    check(input.authorized === true, "group_consent_required", 403);
    const id = text(input.chatId, "chatId", 150);
    check(/^\d+(?:-\d+)?@g\.us$/.test(id), "invalid_group");
    const g = await this.connector.request(
      "/api/" +
        encodeURIComponent(this.connector.session) +
        "/groups/" +
        encodeURIComponent(id),
    );
    const providerId = typeof g.id === "string" ? g.id : g.id?._serialized;
    check(providerId === id, "group_not_confirmed", 409);
    return this.app.db.tx(() => {
      this.app.db.run(
        "UPDATE outbox SET status='cancelled',error='pilot_group_changed',updated_at=? WHERE group_id=? AND status IN('pending','prepared')",
        this.app.now(),
        c.groupId,
      );
      this.app.db.run(
        "UPDATE groups SET chat_id=?,name=?,allowed=1,paused=0 WHERE id=?",
        id,
        String(g.subject ?? g.name ?? "Groupe de test").slice(0, 120),
        c.groupId,
      );
      const prior = this.app.db.get(
        "SELECT settings FROM groups WHERE id=?",
        c.groupId,
      )!;
      this.app.db.run(
        "UPDATE groups SET settings=? WHERE id=?",
        json({ ...parse<Row>(prior.settings), assistantEnabled: true }),
        c.groupId,
      );
      this.app.audit(c, "pilot.group_authorized", c.groupId);
      return { id: c.groupId, name: g.subject ?? g.name ?? "Groupe de test" };
    });
  }
  poll(c: Context) {
    this.authorize(c);
    const g = this.app.group(c);
    check(g.allowed && g.chat_id && !g.paused, "group_not_authorized", 403);
    const recent = this.app.db.get(
      "SELECT id FROM records WHERE group_id=? AND kind='request' AND json_extract(data,'$.category')='Test pilote' AND created_at>?",
      c.groupId,
      this.app.now() - 60000,
    );
    check(!recent, "pilot_poll_cooldown", 429);
    const r = this.app.create(c, "request", {
      title: "Test Nanba Ensemble · souhaitez-vous participer ?",
      description:
        "Sondage de vérification du groupe pilote. Aucune réservation ni aucun paiement.",
      category: "Test pilote",
      zone: g.zone,
      language: "fr",
      slots: "Test uniquement",
      budget: 0,
      threshold: 2,
      deadline: this.app.now() + 86400000,
    });
    const poll = this.app.action(c, r.id, "publish_poll");
    return { requestId: r.id, pollId: poll.id, status: "pending" };
  }
}
