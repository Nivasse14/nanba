import { preparePrivateChat } from "./private-chat.ts";
import { configureRuntime } from "./runtime.ts";
import { Pilot, setupAvailable, setupOwner, authorizeSetup } from "./pilot.ts";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { DB, parse, json, uid, type Row } from "./db.ts";
import { Domain, kinds } from "./modules.ts";
import { Administration } from "./admin.ts";
import { Worker } from "./worker.ts";
import {
  SimulatedConnector,
  WahaConnector,
  verifyWaha,
  normalizeWaha,
  WAHA_VERSION,
  type WhatsAppConnector,
} from "./whatsapp.ts";
import { Knowledge } from "./knowledge.ts";
import { Agent } from "./agent.ts";
import {
  TwilioAssistant,
  twilioAssets,
  TWILIO_PATH,
} from "./twilio-assistant.ts";
import {
  Payments,
  calendarEvent,
  storyCard,
  challengeCard,
  xml,
} from "./integrations.ts";
import {
  authenticated,
  newSession,
  passwordValid,
  hash,
  passwordHash,
  safeEqual,
} from "./auth.ts";
import { check, text, oneOf, Problem } from "./validation.ts";
import { seed } from "./seed.ts";
export function createApplication(
  options: {
    database?: string;
    now?: () => number;
    connector?: WhatsAppConnector;
    production?: boolean;
    origin?: string;
    seed?: boolean;
  } = {},
) {
  configureRuntime(process.env);
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const mode = oneOf(
    process.env.WHATSAPP_MODE ?? "simulated",
    ["simulated", "waha"],
    "WHATSAPP_MODE",
  );
  if (production) {
    check(mode !== "simulated", "simulation_forbidden_in_production", 503);
    check(
      /^[a-f0-9]{64}$/i.test(process.env.IDENTITY_ENCRYPTION_KEY ?? ""),
      "encryption_key_required",
      503,
    );
    check(
      (process.env.WAHA_WEBHOOK_SECRET ?? "").length >= 32,
      "webhook_secret_required",
      503,
    );
  }
  const db = new DB(
    options.database ?? process.env.DATABASE_PATH ?? "data/development.db",
  );
  const a = new Domain(
    db,
    options.now ?? (() => Date.now()),
    options.connector?.mode ?? mode,
    process.env.WAHA_SESSION ?? "nanba-pilot",
  );
  const origin =
    options.origin ?? process.env.APP_ORIGIN ?? "http://localhost:3000";
  const marker = db.get("SELECT value FROM settings WHERE key='runtime_mode'");
  check(
    !marker || marker.value === a.mode,
    "database_transport_mode_mismatch",
    503,
  );
  db.run("INSERT OR IGNORE INTO settings VALUES('runtime_mode',?)", a.mode);
  const connector =
    options.connector ??
    (mode === "simulated"
      ? new SimulatedConnector(a.session)
      : new WahaConnector({
          base: process.env.WAHA_URL ?? "",
          apiKey: process.env.WAHA_API_KEY ?? "",
          session: a.session,
          engine: process.env.WAHA_ENGINE ?? "WEBJS",
          allowReal: process.env.ALLOW_REAL_SEND === "true",
          privateHostport: process.env.WAHA_PRIVATE_HOSTPORT,
          privateChatIds: () =>
            db
              .all(
                "SELECT chat_id FROM groups WHERE allowed=1 AND paused=0 AND (json_extract(settings,'$.selfTest')=1 OR json_extract(settings,'$.privateChat')=1)",
              )
              .map((g) => g.chat_id),
        }));
  if (options.seed && !production) {
    check(a.mode === "simulated", "demo_requires_simulation");
    seed(a);
  }
  const worker = new Worker(a, connector, origin),
    knowledge = new Knowledge(a),
    agent = new Agent(a, knowledge),
    admin = new Administration(a),
    payments = new Payments(a);
  const pilot =
    connector instanceof WahaConnector
      ? new Pilot(a, connector, origin, process.env.WAHA_WEBHOOK_SECRET ?? "")
      : null;
  worker.recover();
  const twilio = new TwilioAssistant(db, origin);
  const security = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "Cache-Control": "no-store",
  };
  function rate(key: string, limit = 100, period = 60000) {
    db.tx(() => {
      const old = db.get("SELECT * FROM rate_limits WHERE key=?", key);
      if (!old || old.reset_at <= a.now()) {
        db.run(
          "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at",
          key,
          a.now() + period,
        );
        return;
      }
      check(old.count < limit, "rate_limited", 429);
      db.run("UPDATE rate_limits SET count=count+1 WHERE key=?", key);
    });
  }
  async function body(req: http.IncomingMessage, maximum = 65536) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      check(size <= maximum, "body_too_large", 413);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  const server = http.createServer(async (req, res) => {
    const send = (
      status: number,
      data: unknown,
      type = "application/json; charset=utf-8",
    ) => {
      res.writeHead(status, { ...security, "Content-Type": type });
      res.end(
        type.startsWith("application/json")
          ? json(data)
          : (data as string | Buffer),
      );
    };
    try {
      const path = new URL(req.url ?? "/", "http://local"),
        method = req.method ?? "GET";
      if (path.pathname === "/health") {
        send(200, { ok: true, mode: a.mode });
        return;
      }
      if (
        path.pathname.startsWith("/api/twilio/files/") &&
        ["GET", "HEAD"].includes(method)
      ) {
        const match = path.pathname.match(
          /^\/api\/twilio\/files\/([a-f0-9]{64})\/[a-zA-Z0-9_.-]+$/,
        );
        check(match, "file_not_found", 404);
        const file = twilio.deliverables.download(match[1]);
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="' + file.filename + '"',
        );
        res.setHeader("Content-Length", file.bytes.length);
        res.setHeader("X-Content-Type-Options", "nosniff");
        send(200, method === "HEAD" ? Buffer.alloc(0) : file.bytes, file.mime);
        return;
      }
      if (
        path.pathname.startsWith("/api/twilio/images/") &&
        (method === "GET" || method === "HEAD")
      ) {
        const image = twilio.companion.publicImage(
          path.pathname.slice("/api/twilio/images/".length),
        );
        check(image, "image_not_found", 404);
        send(
          200,
          method === "HEAD" ? Buffer.alloc(0) : Buffer.from(image.bytes),
          image.mime,
        );
        return;
      }
      if (path.pathname === "/api/twilio/image-upload" && method === "POST") {
        const key = req.headers["x-nanba-setup-key"];
        check(typeof key === "string", "setup_key_required", 401);
        authorizeSetup(a, key, process.env.PILOT_SETUP_HASH ?? "");
        rate("image-upload:" + hash(key), 30, 60000);
        const meta = {
          title: path.searchParams.get("title"),
          style: path.searchParams.get("style"),
          language: path.searchParams.get("language"),
          days: (path.searchParams.get("days") || "")
            .split(",")
            .filter(Boolean)
            .map(Number),
        };
        send(
          201,
          twilio.companion.upload(
            await body(req, 4 * 1024 * 1024),
            req.headers["content-type"] || "",
            meta,
          ),
        );
        return;
      }
      if (path.pathname === "/api/twilio/templates" && method === "POST") {
        const key = req.headers["x-nanba-setup-key"];
        check(typeof key === "string", "setup_key_required", 401);
        authorizeSetup(a, key, process.env.PILOT_SETUP_HASH ?? "");
        rate("templates:" + hash(key), 5, 60000);
        send(200, await twilio.companion.templates(true));
        return;
      }
      if (path.pathname === "/api/twilio/diagnostic" && method === "POST") {
        const key = req.headers["x-nanba-setup-key"];
        check(typeof key === "string", "setup_key_required", 401);
        authorizeSetup(a, key, process.env.PILOT_SETUP_HASH ?? "");
        if (path.searchParams.get("mode") === "presence") {
          rate("presence-check:" + hash(key), 3, 3600000);
          send(200, await twilio.presence.probe());
          return;
        }
        rate("diagnostic:" + hash(key), 3, 3600000);
        send(
          200,
          ["routines", "horoscope"].includes(
            path.searchParams.get("mode") || "",
          )
            ? await twilio.diagnosticRoutines(
                path.searchParams.get("mode") === "horoscope",
              )
            : ["features", "voice"].includes(
                  path.searchParams.get("mode") || "",
                )
              ? await twilio.diagnosticFeatures(
                  path.searchParams.get("mode") === "voice",
                )
              : await twilio.diagnostic(),
        );
        return;
      }
      if (method === "GET" && twilioAssets[path.pathname]) {
        const asset = twilioAssets[path.pathname];
        send(200, asset.body, asset.type);
        return;
      }
      if (path.pathname === "/api/twilio/health" && method === "GET") {
        send(200, {
          implemented: true,
          ready: twilio.ready(),
          version: "assistant-v4.2-diaspora",
          capabilities: {
            text: true,
            images: true,
            audio: true,
            reply: "text_audio_images_pdf",
            readAndTyping: twilio.presence.enabled,
            voiceChoice: true,
            documents: true,
            humanSupport: true,
            privateJourneys: true,
            frenchPractice: true,
            guidedLetters: true,
            officialResources: true,
            mainCataloguePublishingConfigured:
              (process.env.NANBA_WHATSAPP_CATALOGUE_SECRET || "").length >= 32,
            memory: true,
            scheduling: true,
            personalizedRoutines: true,
            nanbaServices: true,
            birthDateHoroscope: true,
            news: true,
            adaptiveTone: true,
          },
        });
        return;
      }
      if ([TWILIO_PATH, TWILIO_PATH + "/status"].includes(path.pathname)) {
        check(method === "POST", "method_not_allowed", 405);
        check(
          req.headers["content-type"]?.split(";")[0] ===
            "application/x-www-form-urlencoded",
          "form_required",
          415,
        );
        const form = twilio.parseAndVerify(
          await body(req),
          req.headers["x-twilio-signature"],
          req.url!,
        );
        const reply = path.pathname.endsWith("/status")
          ? twilio.callback(form, path.searchParams.get("job") ?? "")
          : twilio.receive(form);
        send(200, reply, "application/xml; charset=utf-8");
        if (path.pathname === TWILIO_PATH)
          void twilio.presence.indicate(form.MessageSid).catch(() => {});
        return;
      }
      if (!path.pathname.startsWith("/api/")) {
        check(method === "GET", "method_not_allowed", 405);
        const allowed: Record<string, string> = {
          "/": "index.html",
          "/index.html": "index.html",
          "/app.js": "app.js",
          "/styles.css": "styles.css",
        };
        const f = allowed[path.pathname];
        check(f, "not_found", 404);
        const file = new URL("../public/" + f, import.meta.url);
        check(existsSync(file), "asset_not_built", 503);
        send(
          200,
          readFileSync(file),
          f.endsWith(".html")
            ? "text/html; charset=utf-8"
            : f.endsWith(".css")
              ? "text/css; charset=utf-8"
              : "application/javascript; charset=utf-8",
        );
        return;
      }
      let raw = Buffer.alloc(0),
        b: Row = {};
      if (method !== "GET") {
        check(
          req.headers["content-type"]?.includes("application/json"),
          "json_required",
          415,
        );
        raw = await body(req);
        try {
          b = JSON.parse(raw.toString() || "{}");
        } catch {
          throw new Problem(400, "invalid_json");
        }
        check(b && typeof b === "object" && !Array.isArray(b), "invalid_body");
      }
      if (path.pathname === "/api/webhooks/waha" && method === "POST") {
        check(a.mode === "waha", "real_webhook_disabled", 403);
        verifyWaha(raw, req.headers, process.env.WAHA_WEBHOOK_SECRET ?? "");
        if (connector instanceof WahaConnector)
          await connector.resolveSelfIdentity(b);
        preparePrivateChat(a, b);
        const event = normalizeWaha(
          b,
          "waha",
          a.session,
          (chat) => db.get("SELECT * FROM groups WHERE chat_id=?", chat),
          (id) => {
            const p = db.get(
              "SELECT options FROM polls WHERE provider=? AND session=? AND message_id=?",
              "waha",
              a.session,
              id,
            );
            return p ? parse(p.options) : undefined;
          },
        );
        send(
          202,
          event
            ? db.tx(() => worker.accept(event))
            : { accepted: true, ignored: true },
        );
        return;
      }
      if (path.pathname === "/api/webhooks/payment" && method === "POST") {
        send(
          200,
          await payments.webhook(raw, req.headers as Record<string, string>),
        );
        return;
      }
      if (method !== "GET") {
        check(
          req.headers["sec-fetch-site"] !== "cross-site",
          "cross_site_forbidden",
          403,
        );
        if (req.headers.origin)
          check(
            req.headers.origin === origin ||
              (!production &&
                new URL(req.headers.origin).host === req.headers.host),
            "origin_forbidden",
            403,
          );
      }
      if (path.pathname === "/api/setup" && method === "POST") {
        rate(
          "setup:" + hash(req.socket.remoteAddress ?? "unknown"),
          10,
          900000,
        );
        setupOwner(a, b, process.env.PILOT_SETUP_HASH ?? "");
        send(201, { created: true });
        return;
      }
      if (
        ["/api/twilio/setup", "/api/twilio/admin-link"].includes(path.pathname)
      ) {
        let linkedOwner: string | null = null;
        const key = req.headers["x-nanba-setup-key"];
        if (typeof key === "string" && key) {
          authorizeSetup(a, key, process.env.PILOT_SETUP_HASH ?? "");
          rate("twilio-setup:" + hash(key), 10, 60000);
        } else {
          const token = /nanba_session=([^;]+)/.exec(
            req.headers.cookie ?? "",
          )?.[1];
          const owner = authenticated(db, token, a.now());
          check(owner.platform_admin, "platform_admin_required", 403);
          linkedOwner = owner.id;
          if (method !== "GET")
            check(
              typeof req.headers["x-csrf-token"] === "string" &&
                safeEqual(owner.csrf, req.headers["x-csrf-token"]),
              "csrf_required",
              403,
            );
          rate("twilio-setup:" + owner.id, 10, 60000);
        }
        if (path.pathname === "/api/twilio/admin-link") {
          check(method === "POST", "method_not_allowed", 405);
          send(201, twilio.support.linkCode(linkedOwner));
          return;
        }
        if (method === "GET") send(200, twilio.status());
        else if (method === "POST") send(200, await twilio.configure(b));
        else throw new Problem(405, "method_not_allowed");
        return;
      }
      if (path.pathname.startsWith("/api/pairing/")) {
        check(pilot, "whatsapp_not_configured", 503);
        // The bootstrap capability can pair only this session and authorize only its own self-chat.
        const key = req.headers["x-nanba-setup-key"];
        check(typeof key === "string", "pairing_key_required", 401);
        authorizeSetup(a, key, process.env.PILOT_SETUP_HASH ?? "");
        rate("pairing:" + hash(key), 60);
        const action = path.pathname.slice("/api/pairing/".length);
        if (method === "GET" && action === "status")
          send(200, await pilot.readStatus());
        else if (method === "GET" && action === "qr")
          send(200, await pilot.readQr());
        else if (method === "POST" && action === "connect")
          send(200, await pilot.startSession());
        else if (method === "POST" && action === "self-test") {
          check(b.authorized === true, "self_test_consent_required", 403);
          send(200, await pilot.enableSelfTest());
        } else throw new Problem(404, "not_found");
        return;
      }
      if (path.pathname === "/api/login" && method === "POST") {
        rate(
          "login:" + hash(req.socket.remoteAddress ?? "unknown"),
          15,
          900000,
        );
        const email = text(b.email, "email", 250).toLowerCase(),
          password = text(b.password, "password", 200);
        const u = db.get(
          "SELECT * FROM users WHERE email=? AND deleted=0",
          email,
        );
        const valid = passwordValid(
          password,
          u?.password ?? passwordHash("invalid-login-padding"),
        );
        check(u && valid, "invalid_credentials", 401);
        const s = newSession(db, u.id, a.now());
        res.setHeader(
          "Set-Cookie",
          `nanba_session=${s.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${production ? "; Secure" : ""}`,
        );
        send(200, { csrf: s.csrf });
        return;
      }
      if (path.pathname === "/api/config" && method === "GET") {
        send(200, {
          mode: a.mode,
          demo:
            !production &&
            !!db.get("SELECT value FROM settings WHERE key='demo'"),
          setup: setupAvailable(a, process.env.PILOT_SETUP_HASH ?? ""),
          assistant: "whatsapp-complete-v2",
          registration: "Invitation par administrateur",
          logo: "wordmark_placeholder",
        });
        return;
      }
      const token = /nanba_session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
      const user = authenticated(db, token, a.now());
      rate("user:" + user.id, 200);
      if (method !== "GET")
        check(
          typeof req.headers["x-csrf-token"] === "string" &&
            safeEqual(user.csrf, req.headers["x-csrf-token"]),
          "csrf_required",
          403,
        );
      if (path.pathname === "/api/logout" && method === "POST") {
        db.run("DELETE FROM sessions WHERE token_hash=?", hash(token!));
        res.setHeader(
          "Set-Cookie",
          "nanba_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        send(200, { loggedOut: true });
        return;
      }
      if (path.pathname === "/api/me" && method === "GET") {
        send(200, {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            platformAdmin: !!user.platform_admin,
            orgId: user.org_id,
            preferences: parse(user.preferences),
          },
          csrf: user.csrf,
          groups: db.all(
            "SELECT g.id,g.name,g.zone,g.paused,m.role FROM groups g JOIN memberships m ON m.group_id=g.id WHERE m.user_id=? AND m.active=1",
            user.id,
          ),
          mode: a.mode,
        });
        return;
      }
      const c = {
        userId: user.id,
        groupId: text(req.headers["x-group-id"], "group_id", 100),
      };
      a.member(c);
      if (path.pathname.startsWith("/api/whatsapp/")) {
        check(pilot, "whatsapp_not_configured", 503);
        const action = path.pathname.slice("/api/whatsapp/".length);
        if (method === "GET" && action === "status")
          send(200, await pilot.status(c));
        else if (method === "GET" && action === "qr")
          send(200, await pilot.qr(c));
        else if (method === "GET" && action === "groups")
          send(200, await pilot.groups(c));
        else if (method === "POST" && action === "connect")
          send(200, await pilot.connect(c));
        else if (method === "POST" && action === "bind")
          send(200, await pilot.bind(c, b));
        else if (method === "POST" && action === "poll")
          send(202, pilot.poll(c));
        else throw new Problem(404, "not_found");
        return;
      }
      if (path.pathname === "/api/home" && method === "GET") {
        send(200, {
          requests: a.list(c, "request"),
          meetups: a.list(c, "meetup").filter((r) => r.status === "open"),
          radar: a.currentRadar(c),
          stories: a.list(c, "story").filter((r) => r.status === "published"),
          mine: db.all(
            "SELECT e.*,r.kind,json_extract(r.data,'$.title') title FROM enrollments e JOIN records r ON r.id=e.record_id WHERE e.user_id=? AND r.group_id=? ORDER BY e.created_at DESC",
            c.userId,
            c.groupId,
          ),
        });
        return;
      }
      if (path.pathname === "/api/organizations" && method === "GET") {
        send(
          200,
          db.all(
            "SELECT DISTINCT o.id,o.name FROM organizations o JOIN users u ON u.org_id=o.id JOIN memberships m ON m.user_id=u.id WHERE o.active=1 AND m.group_id=? AND m.role='professional' AND m.active=1",
            c.groupId,
          ),
        );
        return;
      }
      if (path.pathname === "/api/preferences" && method === "POST") {
        send(200, admin.preferences(c, b));
        return;
      }
      if (path.pathname === "/api/identity/link" && method === "POST") {
        send(200, a.linkCode(c));
        return;
      }
      if (path.pathname === "/api/privacy/export" && method === "GET") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="nanba-mes-donnees.json"',
        );
        send(200, admin.export(c));
        return;
      }
      if (path.pathname === "/api/privacy/delete" && method === "POST") {
        send(200, admin.erase(c, text(b.password, "password", 200)));
        return;
      }
      if (path.pathname === "/api/matches" && method === "POST") {
        send(200, a.matches(c, b));
        return;
      }
      if (path.pathname === "/api/knowledge" && method === "GET") {
        const after = path.searchParams.get("after");
        send(
          200,
          knowledge.search(
            c,
            path.searchParams.get("q") ?? "",
            after ? Date.parse(after) : undefined,
          ),
        );
        return;
      }
      if (path.pathname === "/api/agent" && method === "POST") {
        send(200, await agent.draft(c, b));
        return;
      }
      if (path.pathname === "/api/agent/tool" && method === "POST") {
        send(200, agent.tool(c, text(b.name, "tool", 60), b.arguments ?? {}));
        return;
      }
      if (path.pathname === "/api/admin" && method === "GET") {
        send(200, {
          ...admin.dashboard(c),
          capabilities: connector.capabilities,
          wahaVersion: WAHA_VERSION,
          aiConfigured: !!process.env.AI_API_KEY,
          paymentConfigured: false,
        });
        return;
      }
      if (path.pathname === "/api/admin/action" && method === "POST") {
        send(200, admin.action(c, text(b.action, "action", 60), b));
        return;
      }
      if (
        path.pathname === "/api/admin/housing-aggregate" &&
        method === "GET"
      ) {
        send(200, a.housingAggregate(c));
        return;
      }
      if (path.pathname === "/api/admin/collect" && method === "POST") {
        send(200, await knowledge.collect(c, text(b.id, "id")));
        return;
      }
      if (path.pathname === "/api/admin/process" && method === "POST") {
        a.admin(c);
        await worker.tick();
        send(200, { processed: true, mode: a.mode });
        return;
      }
      if (path.pathname === "/api/admin/simulate-vote" && method === "POST") {
        check(
          !production && a.mode === "simulated",
          "simulation_disabled",
          403,
        );
        a.admin(c);
        const poll = a.get(c, text(b.pollId, "pollId"), "poll");
        const p = db.get("SELECT * FROM polls WHERE id=?", poll.id)!;
        check(p.message_id, "publish_poll_first", 409);
        const event = {
          provider: "simulated",
          session: a.session,
          id: text(b.eventId ?? uid(), "eventId"),
          groupId: c.groupId,
          type: "vote",
          messageId: p.message_id,
          voter: text(b.voter, "voter", 150),
          choices: b.choices ?? [],
          at: b.at ?? Math.floor(a.now() / 1000) * 1000,
          failed: b.failed === true,
        };
        send(
          202,
          db.tx(() => worker.accept(event)),
        );
        return;
      }
      if (path.pathname === "/api/admin/retry-inbox" && method === "POST") {
        a.admin(c);
        const e = db.get(
          "SELECT * FROM inbox WHERE id=? AND context=? AND status='failed'",
          b.id,
          c.groupId,
        );
        check(e, "not_found", 404);
        db.run("UPDATE inbox SET status='pending',attempts=0 WHERE id=?", e.id);
        send(200, { queued: true });
        return;
      }
      if (path.pathname === "/api/report" && method === "POST") {
        db.run(
          "INSERT INTO reports VALUES(?,?,?,?,?,?,?)",
          uid(),
          c.groupId,
          c.userId,
          b.targetId ? text(b.targetId, "targetId") : null,
          text(b.reason, "reason", 1000),
          "open",
          a.now(),
        );
        send(201, { recorded: true });
        return;
      }
      if (path.pathname === "/api/payment/checkout" && method === "POST") {
        send(
          200,
          await payments.checkout(c, text(b.enrollmentId, "enrollmentId")),
        );
        return;
      }
      const card =
        /^\/api\/records\/([^/]+)\/(card|calendar|leaderboard)$/.exec(
          path.pathname,
        );
      if (card && method === "GET") {
        const r = a.get(c, card[1]);
        if (card[2] === "calendar") {
          check(["meetup", "offer"].includes(r.kind), "not_calendar");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="nanba-evenement.ics"',
          );
          send(200, calendarEvent(r), "text/calendar; charset=utf-8");
          return;
        }
        if (card[2] === "leaderboard") {
          send(200, a.leaderboard(c, r.id));
          return;
        }
        if (r.kind === "challenge") {
          const rows = a.leaderboard(c, r.id);
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="nanba-resultats.svg"',
          );
          send(
            200,
            challengeCard(r.data.title, rows, r.data.rulesVersion),
            "image/svg+xml; charset=utf-8",
          );
          return;
        }
        check(
          r.kind === "story" &&
            r.status === "published" &&
            r.data.audiences.includes("nanba"),
          "card_not_published",
          403,
        );
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="nanba-histoire.svg"',
        );
        send(200, storyCard(r), "image/svg+xml; charset=utf-8");
        return;
      }
      const recordRoute = /^\/api\/records(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(
        path.pathname,
      );
      if (recordRoute) {
        if (!recordRoute[1]) {
          const kind = oneOf(
            method === "GET" ? path.searchParams.get("kind") : b.kind,
            kinds,
            "kind",
          );
          if (method === "GET") {
            send(200, a.list(c, kind));
            return;
          }
          if (method === "POST") {
            send(201, a.present(c, a.create(c, kind, b)));
            return;
          }
        }
        if (recordRoute[1] && !recordRoute[2] && method === "GET") {
          send(200, a.present(c, a.get(c, recordRoute[1])));
          return;
        }
        if (
          recordRoute[1] &&
          recordRoute[2] === "action" &&
          method === "POST"
        ) {
          send(
            200,
            a.action(c, recordRoute[1], text(b.action, "action", 80), b),
          );
          return;
        }
      }
      throw new Problem(404, "not_found");
    } catch (error) {
      const status = error instanceof Problem ? error.status : 500;
      send(status, {
        error: error instanceof Problem ? error.code : "internal_error",
      });
      if (status === 500)
        console.error(
          "Request failed:",
          error instanceof Error ? error.message : "unknown",
        );
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    app: a,
    worker,
    knowledge,
    agent,
    admin,
    payments,
    twilio,
    db,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const instance = createApplication({
    seed:
      process.env.NODE_ENV !== "production" &&
      process.env.WHATSAPP_MODE !== "waha",
  });
  const argument = (flag: string) =>
    process.argv.includes(flag)
      ? process.argv[process.argv.indexOf(flag) + 1]
      : undefined;
  const port = Number(argument("--port") ?? process.env.PORT ?? 3000);
  instance.server.listen(
    port,
    argument("--host") ?? process.env.HOST ?? "127.0.0.1",
    () =>
      console.log(
        `Nanba Ensemble ready on port ${port} (${instance.app.mode})`,
      ),
  );
  const tick = setInterval(
    () =>
      void instance.worker
        .tick()
        .catch(() => console.error("Worker failed; consult inbox and outbox")),
    2000,
  );
  const sources = setInterval(() => void instance.knowledge.due(), 60000);
  const twilioTick = setInterval(
    () =>
      void instance.twilio
        .tick()
        .catch(() => console.error("Twilio worker failed")),
    1000,
  );
  const twilioCleanup = setInterval(() => instance.twilio.cleanup(), 3600000);
  const cleanup = setInterval(() => instance.admin.retention(), 3600000);
  const stop = () => {
    clearInterval(tick);
    clearInterval(sources);
    clearInterval(cleanup);
    clearInterval(twilioTick);
    clearInterval(twilioCleanup);
    instance.server.close(() => {
      instance.db.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
