import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
const source = process.env.DATABASE_PATH ?? "data/development.db";
const target = resolve(
  process.argv[2] ??
    "data/backups/nanba-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".db",
);
if (existsSync(target)) throw new Error("Backup destination already exists");
mkdirSync(resolve(target, ".."), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source);
db.prepare("VACUUM INTO ?").run(target);
db.close();
chmodSync(target, 0o600);
console.log("Consistent SQLite backup created: " + target);
