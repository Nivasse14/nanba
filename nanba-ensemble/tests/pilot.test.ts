import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DB } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
import { hash, passwordValid } from "../src/auth.ts";
import { setupAvailable, setupOwner, Pilot } from "../src/pilot.ts";
import { configureRuntime } from "../src/runtime.ts";
import { WahaConnector } from "../src/whatsapp.ts";
import { fixture, admin, member } from "./helpers.ts";
import { createApplication } from "../src/server.ts";

test("private pairing HTTP capability protects QR, requires consent, and cannot authorize an arbitrary chat", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pairing-http-"));
  const prior = process.env.PILOT_SETUP_HASH;
  const key = "test-only-pairing-secret";
  process.env.PILOT_SETUP_HASH = hash(key);
  let status = "SCAN_QR_CODE";
  const connector = new WahaConnector({
    base: "http://localhost:3001",
    apiKey: "test-only-provider-key",
    session: "nanba-pilot",
    engine: "WEBJS",
    allowReal: true,
    fetcher: async (url) =>
      new URL(String(url)).pathname.endsWith("/auth/qr")
        ? Response.json({
            mimetype: "image/png",
            data: Buffer.from("test-image").toString("base64"),
          })
        : Response.json({ status, me: { id: "33600000001@c.us" } }),
  });
  const app = createApplication({
    database: join(dir, "db"),
    production: false,
    seed: false,
    connector,
  });
  await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + (app.server.address() as any).port;
  const call = (
    path: string,
    body?: any,
    secret = key,
    extra: Record<string, string> = {},
  ) =>
    fetch(base + "/api/pairing/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Nanba-Setup-Key": secret,
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await fetch(base + "/api/pairing/qr")).status, 401);
    assert.equal((await call("qr", undefined, "bad")).status, 403);
    assert.equal((await call("qr")).status, 200);
    assert.equal(
      (await call("connect", {}, key, { Origin: "https://evil.example" }))
        .status,
      403,
    );
    assert.equal((await call("self-test", {})).status, 403);
    assert.equal((await call("self-test", { authorized: true })).status, 409);
    status = "WORKING";
    assert.equal(
      (
        await call("self-test", {
          authorized: true,
          chatId: "33600000002@c.us",
        })
      ).status,
      200,
    );
    assert.equal(
      app.db.get("SELECT chat_id FROM groups WHERE allowed=1")!.chat_id,
      "33600000001@c.us",
    );
    assert.equal((await call("groups", { chatId: "123@g.us" })).status, 404);
    setupOwner(
      app.app,
      {
        key,
        name: "Owner",
        email: "owner@example.invalid",
        password: "test-only-long-password",
      },
      hash(key),
    );
    assert.equal((await call("qr")).status, 409);
  } finally {
    await new Promise<void>((r) => app.server.close(() => r()));
    app.db.close();
    if (prior === undefined) delete process.env.PILOT_SETUP_HASH;
    else process.env.PILOT_SETUP_HASH = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pilot setup is secret-bound, single-use, persistent and creates no authorized destination", () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-"));
  const db = new DB(join(dir, "db.sqlite"));
  const a = new Domain(db);
  const key = "test-only-key";
  const expected = hash(key);
  try {
    assert.equal(setupAvailable(a, ""), false);
    assert.throws(() => setupOwner(a, { key: "wrong" }, expected));
    const result = setupOwner(
      a,
      {
        key,
        email: "pilot@example.invalid",
        name: "Owner",
        password: "test-only-password-123",
      },
      expected,
    );
    assert.equal(
      passwordValid("test-only-password-123", a.user(result.id).password),
      true,
    );
    assert.equal(
      a.db.get("SELECT allowed FROM groups WHERE id='pilot'")!.allowed,
      0,
    );
    assert.equal(setupAvailable(a, expected), false);
    assert.throws(() => setupOwner(a, { key }, expected));
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Render configuration keeps secrets private and only permits the explicit private address", () => {
  const env: NodeJS.ProcessEnv = {
    RENDER: "true",
    RENDER_EXTERNAL_URL: "https://pilot.example.invalid",
    IDENTITY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
    WAHA_PRIVATE_HOSTPORT: "waha-abcd:3000",
  };
  configureRuntime(env);
  assert.equal(env.APP_ORIGIN, "https://pilot.example.invalid");
  assert.equal(env.IDENTITY_ENCRYPTION_KEY!.length, 64);
  assert.equal(env.WAHA_URL, "http://waha-abcd:3000");
  assert.throws(() =>
    configureRuntime({ WAHA_PRIVATE_HOSTPORT: "external:3000" }),
  );
  assert.throws(() =>
    configureRuntime({
      RENDER: "true",
      WAHA_PRIVATE_HOSTPORT: "evil.example:3000",
    }),
  );
  const args = {
    apiKey: "test-only-secret-12345",
    session: "default",
    engine: "WEBJS",
    allowReal: true,
  };
  assert.throws(
    () =>
      new WahaConnector({
        ...args,
        base: "http://evil.example:3000",
        privateHostport: "waha-abcd:3000",
      }),
  );
  assert.doesNotThrow(
    () =>
      new WahaConnector({
        ...args,
        base: env.WAHA_URL!,
        privateHostport: env.WAHA_PRIVATE_HOSTPORT,
      }),
  );
});
test("pilot pairing is platform-admin-only, redacts provider secrets and uses pinned QR/session contracts", async () => {
  const f = fixture();
  const calls: any[] = [];
  let status = "NOT_CREATED";
  const connector = new WahaConnector({
    base: "http://localhost:3001",
    apiKey: "test-only-secret-12345",
    session: "default",
    engine: "WEBJS",
    allowReal: true,
    fetcher: async (url, options) => {
      const path = new URL(String(url)).pathname;
      calls.push({
        path,
        method: options?.method,
        body: options?.body,
        headers: options?.headers,
      });
      if (path === "/api/sessions/default" && status === "NOT_CREATED")
        return new Response("{}", { status: 404 });
      if (path === "/api/sessions") {
        status = "SCAN_QR_CODE";
        return Response.json({ status });
      }
      if (path.endsWith("/auth/qr"))
        return Response.json({
          mimetype: "image/png",
          data: Buffer.from("synthetic-image").toString("base64"),
        });
      return Response.json({
        status,
        config: { secret: "never-return" },
        me: { id: "private-phone" },
      });
    },
  });
  const pilot = new Pilot(
    f.a,
    connector,
    "https://pilot.example.invalid",
    "webhook-test-secret-123456789012345",
  );
  try {
    await assert.rejects(pilot.status(member));
    assert.equal((await pilot.status(admin)).status, "NOT_CREATED");
    const state = await pilot.connect(admin);
    assert.equal(state.status, "SCAN_QR_CODE");
    assert.equal(JSON.stringify(state).includes("secret"), false);
    const create = calls.find((x) => x.path === "/api/sessions");
    assert.equal(create.method, "POST");
    assert.equal(
      JSON.parse(create.body).config.webhooks[0].url,
      "https://pilot.example.invalid/api/webhooks/waha",
    );
    assert.match((await pilot.qr(admin)).image, /^data:image\/png;base64,/);
    assert.equal(calls.at(-1).method, "GET");
    assert.equal(calls.at(-1).headers.Accept, "application/json");
    await assert.rejects(pilot.bind(admin, { chatId: "123@g.us" }));
  } finally {
    f.close();
  }
});
test("HTTP setup needs a key; live WhatsApp management rejects anonymous requests", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-http-"));
  const old = process.env.PILOT_SETUP_HASH;
  process.env.PILOT_SETUP_HASH = hash("test-only-bootstrap");
  const app = createApplication({
    database: join(dir, "db"),
    production: false,
    seed: false,
  });
  await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + (app.server.address() as any).port;
  try {
    const config = (await (await fetch(base + "/api/config")).json()) as any;
    assert.equal(config.setup, true);
    assert.equal((await fetch(base + "/api/whatsapp/qr")).status, 401);
    const denied = await fetch(base + "/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "bad" }),
    });
    assert.equal(denied.status, 403);
    const create = await fetch(base + "/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "test-only-bootstrap",
        email: "owner@example.invalid",
        name: "Owner",
        password: "test-only-password-123",
      }),
    });
    assert.equal(create.status, 201);
    assert.equal(
      ((await (await fetch(base + "/api/config")).json()) as any).setup,
      false,
    );
  } finally {
    await new Promise<void>((r) => app.server.close(() => r()));
    app.db.close();
    if (old === undefined) delete process.env.PILOT_SETUP_HASH;
    else process.env.PILOT_SETUP_HASH = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
