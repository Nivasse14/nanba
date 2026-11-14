import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
export type Row = Record<string, any>;
export class DB {
  raw: DatabaseSync;
  transactionDepth = 0;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.raw = new DatabaseSync(path);
    this.raw.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    this.raw.exec(
      "CREATE TABLE IF NOT EXISTS migrations(version TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)",
    );
    for (const name of readdirSync(
      new URL("../migrations/", import.meta.url),
    ).sort()) {
      if (
        !name.endsWith(".sql") ||
        this.get("SELECT 1 FROM migrations WHERE version=?", name)
      )
        continue;
      this.tx(() => {
        this.raw.exec(
          readFileSync(
            new URL("../migrations/" + name, import.meta.url),
            "utf8",
          ),
        );
        this.run("INSERT INTO migrations VALUES(?,?)", name, Date.now());
      });
    }
  }
  get(sql: string, ...args: any[]): Row | undefined {
    return this.raw.prepare(sql).get(...args) as Row | undefined;
  }
  all(sql: string, ...args: any[]): Row[] {
    return this.raw.prepare(sql).all(...args) as Row[];
  }
  run(sql: string, ...args: any[]) {
    return this.raw.prepare(sql).run(...args);
  }
  tx<T>(fn: () => T): T {
    const depth = this.transactionDepth;
    const point = `nested_${depth}`;
    this.raw.exec(depth ? `SAVEPOINT ${point}` : "BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const result = fn();
      this.raw.exec(depth ? `RELEASE SAVEPOINT ${point}` : "COMMIT");
      return result;
    } catch (e) {
      this.raw.exec(depth ? `ROLLBACK TO SAVEPOINT ${point}` : "ROLLBACK");
      if (depth) this.raw.exec(`RELEASE SAVEPOINT ${point}`);
      throw e;
    } finally {
      this.transactionDepth--;
    }
  }
  close() {
    this.raw.close();
  }
}
export const uid = () => randomUUID();
export const json = (value: unknown) => JSON.stringify(value);
export function parse<T = Row>(value: string): T {
  return JSON.parse(value);
}
