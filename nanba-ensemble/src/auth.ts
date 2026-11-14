import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import type { DB, Row } from "./db.ts";
import { check } from "./validation.ts";
export const hash = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordValid(password: string, stored: string) {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(h, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const secret = () => randomBytes(32).toString("hex");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function newSession(db: DB, userId: string, now: number) {
  const token = secret(),
    csrf = secret();
  db.run(
    "INSERT INTO sessions VALUES(?,?,?,?)",
    hash(token),
    userId,
    csrf,
    now + 86400000,
  );
  return { token, csrf };
}
export function authenticated(
  db: DB,
  token: string | undefined,
  now: number,
): Row {
  check(token, "unauthenticated", 401);
  const s = db.get(
    "SELECT u.*,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>? AND u.deleted=0",
    hash(token),
    now,
  );
  check(s, "unauthenticated", 401);
  return s;
}
export function encryptRef(value: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((x) => x.toString("base64"))
    .join(".");
}
export function decryptRef(value: string, key: string) {
  const [iv, tag, data] = value.split(".").map((x) => Buffer.from(x, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
