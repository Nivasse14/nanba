import { check, text, integer, url } from "./validation.ts";
import type { Row } from "./db.ts";

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const codeOf = (r: Row) => r.id.slice(0, 8);
export const when = (v: number) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(v);
export const euros = (v: number) =>
  (v / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export function parisDate(s: string, dateOnly = false): number {
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(s)) {
    const v = Date.parse(s);
    check(Number.isFinite(v), "invalid_date");
    return v;
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/.exec(s);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(s);
  check(m || iso, "date_format");
  const y = Number(m?.[3] ?? iso?.[1]),
    mo = Number(m?.[2] ?? iso?.[2]),
    d = Number(m?.[1] ?? iso?.[3]);
  const h = Number(m?.[4] ?? iso?.[4] ?? 12),
    min = Number(m?.[5] ?? iso?.[5] ?? 0);
  check(dateOnly || (m?.[4] ?? iso?.[4]), "date_time_required");
  const utc = Date.UTC(y, mo - 1, d, h, min),
    found: number[] = [];
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let delta = -180; delta <= 180; delta += 30) {
    const candidate = utc + delta * 60000;
    const parts = Object.fromEntries(
      fmt.formatToParts(candidate).map((p) => [p.type, p.value]),
    );
    if (
      +parts.year === y &&
      +parts.month === mo &&
      +parts.day === d &&
      +parts.hour === h &&
      +parts.minute === min
    )
      found.push(candidate);
  }
  check(
    found.length === 1,
    found.length > 1 ? "date_ambiguous" : "invalid_date",
  );
  return found[0];
}
export type Field = {
  key: string;
  label: string;
  prompt: string;
  type?: string;
  max?: number;
  min?: number;
  options?: string[];
  optional?: boolean;
};
export const field = (
  key: string,
  label: string,
  prompt = label,
  type = "text",
  extra: Partial<Field> = {},
): Field => ({ key, label, prompt, type, ...extra });
export function parseField(f: Field, s: string, now: number): any {
  s = s.trim();
  if (f.optional && ["passer", "aucun", "aucune", "-"].includes(norm(s)))
    return f.type === "list" ? [] : "";
  if (f.type === "integer")
    return integer(Number(s), f.key, f.min ?? 0, f.max ?? 10000000);
  if (f.type === "money") {
    check(/^\d+(?:[,.]\d{1,2})?$/.test(s), "invalid_money");
    return integer(Math.round(Number(s.replace(",", ".")) * 100), f.key);
  }
  if (f.type === "date" || f.type === "day")
    return parisDate(s, f.type === "day");
  if (f.type === "past") return norm(s) === "maintenant" ? now : parisDate(s);
  if (f.type === "boolean") {
    check(["oui", "non"].includes(norm(s)), "yes_no_required");
    return norm(s) === "oui";
  }
  if (f.type === "url") return url(s);
  if (f.type === "enum") {
    const options = f.options ?? [];
    const index = /^\d+$/.test(s)
      ? Number(s) - 1
      : options.findIndex((o) => norm(o) === norm(s));
    check(index >= 0 && index < options.length, "invalid_choice");
    return options[index];
  }
  if (f.type === "list")
    return [...new Set(s.split(/[;\n]/).map((x) => text(x, f.key, 250)))];
  if (f.type === "slots")
    return s.split("\n").map((line) => {
      const [start, end] = line.split("|").map((x) => x.trim());
      return { start: parisDate(start), end: parisDate(end ?? "") };
    });
  if (f.type === "resources")
    return s
      ? s.split("\n").map((line) => {
          const [title, link] = line.split("|").map((x) => x.trim());
          return {
            title: text(title, "title", 160),
            url: url(link),
            verifiedAt: now,
          };
        })
      : [];
  return text(s, f.key, f.max ?? 1500);
}
export function displayValue(f: Field, v: any): string {
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (f.type === "money") return euros(v);
  if (["date", "day", "past"].includes(f.type ?? "")) return when(v);
  if (f.type === "slots")
    return v.map((s: Row) => `${when(s.start)} → ${when(s.end)}`).join("; ");
  if (f.type === "resources")
    return Array.isArray(v)
      ? v.map((r: Row) => `${r.title} — ${r.url}`).join("\n")
      : "aucune";
  if (Array.isArray(v)) return v.join("; ");
  return String(v || "non renseigné");
}
export const DATE = "JJ/MM/AAAA HH:mm, heure de Paris (ex. 20/12/2026 14:30)";
