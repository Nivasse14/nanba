import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DB, uid, type Row } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
import { seed } from "../src/seed.ts";
import { Worker } from "../src/worker.ts";
import { SimulatedConnector } from "../src/whatsapp.ts";
import { Administration } from "../src/admin.ts";
export const admin = { userId: "admin", groupId: "paris" },
  member = { userId: "member", groupId: "paris" },
  member2 = { userId: "member2", groupId: "paris" },
  member3 = { userId: "member3", groupId: "paris" },
  organizer = { userId: "organizer", groupId: "paris" },
  pro = { userId: "pro", groupId: "paris" },
  otherpro = { userId: "otherpro", groupId: "paris" },
  outsider = { userId: "outsider", groupId: "lyon" };
export function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "nanba-test-"));
  let time = Date.UTC(2026, 10, 12, 12);
  const path = join(dir, "test.db");
  const db = new DB(path),
    a = new Domain(db, () => time);
  seed(a);
  const connector = new SimulatedConnector(),
    worker = new Worker(a, connector, "https://nanba.invalid"),
    administration = new Administration(a);
  return {
    dir,
    path,
    db,
    a,
    worker,
    connector,
    administration,
    now: () => time,
    advance: (n: number) => {
      time += n;
    },
    close: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
export function request(a: Domain, options: Row = {}) {
  return a.create(member, "request", {
    title: "Atelier collectif",
    description: "Apprendre et partager.",
    category: "Cuisine",
    zone: "Paris",
    language: "fr",
    slots: "Samedi",
    budget: 2000,
    threshold: 2,
    deadline: a.now() + 86400000,
    ...options,
  });
}
export function offer(a: Domain, requestId: string, options: Row = {}) {
  const r = a.create(pro, "offer", {
    requestId,
    title: "Atelier confirmé",
    description: "Deux heures",
    provider: "Atelier fictif",
    place: "Paris",
    startsAt: a.now() + 2 * 86400000,
    price: 2500,
    capacity: 2,
    terms: "Annulation libre.",
    deadline: a.now() + 86400000,
    ...options,
  });
  return a.action(pro, r.id, "confirm") as any;
}
export async function poll(f: ReturnType<typeof fixture>, r: Row) {
  const p = f.a.action(admin, r.id, "publish_poll");
  await f.worker.tick();
  return f.db.get("SELECT * FROM polls WHERE id=?", p.id)!;
}
export function sendVote(
  f: ReturnType<typeof fixture>,
  p: Row,
  overrides: Row = {},
) {
  const event = {
    provider: "simulated",
    session: "nanba-pilot",
    id: uid(),
    type: "vote",
    groupId: "paris",
    messageId: p.message_id,
    voter: "33600000099@c.us",
    choices: ["yes"],
    at: f.now(),
    failed: false,
    ...overrides,
  };
  const result = f.db.tx(() => f.worker.accept(event));
  f.worker.processInbox();
  return { event, result };
}
