export class Problem extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export function check(
  condition: unknown,
  code: string,
  status = 400,
): asserts condition {
  if (!condition) throw new Problem(status, code);
}
export function text(value: unknown, name: string, max = 5000): string {
  check(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `invalid_${name}`,
  );
  return value.trim();
}
export function integer(
  value: unknown,
  name: string,
  min = 0,
  max = 10000000,
): number {
  check(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max,
    `invalid_${name}`,
  );
  return value;
}
export function date(value: unknown, name: string): number {
  check(
    typeof value === "string" || typeof value === "number",
    `invalid_${name}`,
  );
  const d = typeof value === "number" ? value : Date.parse(value);
  check(Number.isSafeInteger(d) && d > 0, `invalid_${name}`);
  return d;
}
export function list(value: unknown, name: string, max = 30): string[] {
  check(Array.isArray(value) && value.length <= max, `invalid_${name}`);
  return [...new Set(value.map((x) => text(x, name, 250)))];
}
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string,
): T {
  check(
    typeof value === "string" && allowed.includes(value as T),
    `invalid_${name}`,
  );
  return value as T;
}
export function url(value: unknown, name = "url"): string {
  const s = text(value, name, 2000);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Problem(400, `invalid_${name}`);
  }
  check(
    u.protocol === "https:" && !u.username && !u.password,
    `invalid_${name}`,
  );
  return u.href;
}
