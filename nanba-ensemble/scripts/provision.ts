import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { DB, uid, json } from "../src/db.ts";
import { passwordHash } from "../src/auth.ts";
import { check, text, oneOf } from "../src/validation.ts";
// JSON on stdin only; never echo credentials. Run on the trusted application host.
let raw = "";
for await (const chunk of stdin) {
  raw += chunk;
  check(raw.length < 10000, "input_too_large");
}
const input = JSON.parse(raw);
const email = text(input.email, "email", 250).toLowerCase();
check(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "invalid_email");
const password = text(input.password, "password", 200);
check(password.length >= 14, "password_too_short");
const db = new DB(process.env.DATABASE_PATH ?? "data/pilot.db");
check(
  !db.get("SELECT value FROM settings WHERE key='demo'"),
  "cannot_provision_demo_database",
);
const result = db.tx(() => {
  const id = uid();
  db.run(
    "INSERT OR IGNORE INTO communities VALUES('pilot','Nanba Ensemble pilote')",
  );
  const groupId = input.groupId ?? "pilot";
  if (!db.get("SELECT id FROM groups WHERE id=?", groupId)) {
    check(input.platformAdmin === true, "bootstrap_requires_platform_admin");
    db.run(
      "INSERT INTO groups(id,community_id,name,zone,allowed) VALUES(?,?,?,?,0)",
      groupId,
      "pilot",
      text(input.groupName ?? "Groupe pilote", "groupName", 150),
      text(input.zone ?? "Île-de-France", "zone", 120),
    );
  }
  const role = oneOf(
    input.role ?? "member",
    ["member", "organizer", "group_admin", "professional"],
    "role",
  );
  let orgId = null;
  if (role === "professional") {
    orgId = text(input.orgId, "orgId", 120);
    db.run(
      "INSERT OR IGNORE INTO organizations(id,name) VALUES(?,?)",
      orgId,
      text(input.orgName, "orgName", 150),
    );
  }
  db.run(
    "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)",
    id,
    email,
    text(input.name, "name", 120),
    passwordHash(password),
    input.platformAdmin === true ? 1 : 0,
    orgId,
    "{}",
    0,
    Date.now(),
  );
  db.run("INSERT INTO memberships VALUES(?,?,?,1)", id, groupId, role);
  return { id, groupId, role };
});
db.close();
console.log(JSON.stringify(result));
