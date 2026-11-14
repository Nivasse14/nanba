import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApplication } from "../src/server.ts";
import { fixture, request, offer } from "./helpers.ts";

test("real concurrent SQLite connections cannot overbook the last place", async () => {
  const f = fixture();
  try {
    const r = request(f.a),
      o = offer(f.a, r.id, { capacity: 1 }),
      gate = new SharedArrayBuffer(4),
      workers: Worker[] = [];
    const tasks = [
      "member",
      "member2",
      "member3",
      "organizer",
      "pro",
      "otherpro",
    ].map(
      (userId) =>
        new Promise<any>((resolve, reject) => {
          const worker = new Worker(
            new URL("./reservation-worker.ts", import.meta.url),
            {
              workerData: {
                path: f.path,
                now: f.now(),
                offerId: o.id,
                version: o.version,
                userId,
                gate,
              },
            },
          );
          workers.push(worker);
          worker.on("error", reject);
          worker.on("message", (result) => {
            if (result.ready) {
              ready++;
              if (ready === 6) {
                Atomics.store(new Int32Array(gate), 0, 1);
                Atomics.notify(new Int32Array(gate), 0, 6);
              }
            } else resolve(result);
          });
        }),
    );
    let ready = 0;
    const results = await Promise.all(tasks);
    assert.equal(results.filter((x) => x.status === "confirmed").length, 1);
    assert.equal(results.filter((x) => x.status === "waitlisted").length, 5);
    assert.equal(results.filter((x) => x.error).length, 0);
    await Promise.all(workers.map((w) => w.terminate()));
  } finally {
    f.close();
  }
});

test("HTTP session/CSRF/group authorization and complete first-module flow with process restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nanba-http-"));
  const database = join(dir, "http.db");
  let app = createApplication({ database, seed: true, production: false });
  await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
  let base = "http://127.0.0.1:" + (app.server.address() as any).port;
  const login = async (profile: string) => {
    const res = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: profile + "@demo.nanba",
        password: "Nanba-demo-2026!",
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    return {
      cookie: res.headers.get("set-cookie")!.split(";")[0],
      csrf: data.csrf,
    };
  };
  const call = async (
    auth: any,
    path: string,
    body?: any,
    group = "paris",
    csrf = true,
  ) => {
    const res = await fetch(base + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: auth.cookie,
        "X-Group-Id": group,
        ...(csrf ? { "X-CSRF-Token": auth.csrf } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: (await res.json()) as any };
  };
  try {
    assert.equal((await fetch(base + "/api/me")).status, 401);
    const member = await login("member"),
      admin = await login("admin"),
      pro = await login("pro"),
      otherpro = await login("otherpro");
    const n = Date.now();
    assert.equal(
      (
        await call(
          member,
          "/records",
          { kind: "request", title: "X" },
          "paris",
          false,
        )
      ).status,
      403,
    );
    assert.equal((await call(member, "/home", undefined, "lyon")).status, 403);
    const created = await call(member, "/records", {
      kind: "request",
      title: "HTTP activité",
      description: "Test complet",
      category: "Culture",
      zone: "Paris",
      language: "fr",
      slots: "Samedi",
      threshold: 2,
      deadline: n + 86400000,
    });
    assert.equal(created.status, 201);
    const rid = created.data.id;
    assert.equal(
      (
        await call(member, "/records/" + rid + "/action", {
          action: "publish_poll",
        })
      ).status,
      403,
    );
    const published = await call(admin, "/records/" + rid + "/action", {
      action: "publish_poll",
    });
    assert.equal(published.status, 200);
    await call(admin, "/admin/process", {});
    const pid = published.data.id;
    assert.equal(
      (
        await call(admin, "/admin/simulate-vote", {
          pollId: pid,
          voter: "33600000123@c.us",
          choices: ["yes"],
          eventId: "http-vote",
        })
      ).status,
      202,
    );
    await call(admin, "/admin/process", {});
    await call(member, "/records/" + rid + "/action", {
      action: "interest",
      active: true,
    });
    const r = (await call(member, "/records/" + rid)).data;
    assert.equal(r.data.counts.total, 2);
    assert.equal(r.data.poll.status, "simulated");
    const proposed = await call(pro, "/records", {
      kind: "offer",
      requestId: rid,
      title: "Offre HTTP",
      description: "Exemple",
      provider: "Maya",
      place: "Paris",
      startsAt: n + 2 * 86400000,
      deadline: n + 86400000,
      price: 1000,
      capacity: 1,
      terms: "Conditions v1",
    });
    assert.equal(proposed.status, 201);
    const o = (
      await call(pro, "/records/" + proposed.data.id + "/action", {
        action: "confirm",
      })
    ).data;
    assert.equal(
      (
        await call(member, "/records/" + o.id + "/action", {
          action: "enroll",
          version: o.version,
          accept: true,
        })
      ).data.status,
      "confirmed",
    );
    assert.equal(
      (
        await call(member, "/payment/checkout", {
          enrollmentId: app.db.get(
            "SELECT id FROM enrollments WHERE record_id=?",
            o.id,
          )!.id,
        })
      ).status,
      503,
    );
    const housing = (await call(member, "/records?kind=housing")).data[0];
    assert.equal((await call(otherpro, "/records/" + housing.id)).status, 404);
    assert.equal((await call(admin, "/records/" + housing.id)).status, 404);
    await new Promise<void>((r) => app.server.close(() => r()));
    app.db.close();
    app = createApplication({ database, production: false });
    await new Promise<void>((r) => app.server.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + (app.server.address() as any).port;
    const persisted = (await call(member, "/records/" + rid)).data;
    assert.equal(persisted.data.counts.total, 2);
    assert.equal(
      (await call(member, "/records/" + o.id)).data.data.enrollment.status,
      "confirmed",
    );
    for (const kind of [
      "meetup",
      "housing",
      "help",
      "radar",
      "cohort",
      "challenge",
      "story",
    ])
      assert.equal((await call(member, "/records?kind=" + kind)).status, 200);
  } finally {
    await new Promise<void>((r) => app.server.close(() => r()));
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production refuses simulated mode and development identity shortcuts", () => {
  assert.throws(
    () => createApplication({ production: true, database: ":memory:" }),
    /simulation_forbidden_in_production/,
  );
});
