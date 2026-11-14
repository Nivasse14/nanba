import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { check, url, Problem, text } from "./validation.ts";
import type { Domain } from "./modules.ts";
import type { Context, Entity } from "./core.ts";
import { hash } from "./auth.ts";
import { json, parse, type Row } from "./db.ts";
export function publicIPv4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0)
  );
}
export async function safeFetch(sourceUrl: string) {
  const u = new URL(url(sourceUrl));
  check(!u.port || u.port === "443", "source_port_forbidden");
  check(!isIP(u.hostname), "literal_ip_forbidden");
  const addresses = await lookup(u.hostname, { all: true });
  check(
    addresses.length > 0 && addresses.every((x) => publicIPv4(x.address)),
    "private_address_forbidden",
  );
  const address = addresses[0].address;
  return await new Promise<{ body: string; type: string }>(
    (resolve, reject) => {
      const req = https.get(
        u,
        {
          lookup: (_host, _opts, cb) => {
            cb(null, address, 4);
          },
          headers: {
            Accept:
              "application/feed+json, application/json, application/rss+xml, application/atom+xml",
            "User-Agent": "NanbaEnsemble/0.1",
          },
          timeout: 8000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Problem(502, "source_http_" + res.statusCode));
            return;
          }
          const contentType = String(res.headers["content-type"] ?? "");
          if (!/(json|xml|rss|atom)/i.test(contentType)) {
            res.resume();
            reject(new Problem(400, "unsupported_source_format"));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => {
            size += chunk.length;
            if (size > 512000) {
              req.destroy(new Problem(413, "source_too_large"));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              body: Buffer.concat(chunks).toString("utf8"),
              type: contentType,
            }),
          );
        },
      );
      req.on("timeout", () => req.destroy(new Problem(504, "source_timeout")));
      req.on("error", reject);
    },
  );
}
export function feedItems(body: string, format: string): Row[] {
  if (format === "json") {
    const data = JSON.parse(body);
    check(Array.isArray(data.items), "invalid_json_feed");
    return data.items.slice(0, 40).map((v: Row) => ({
      title: v.title,
      url: v.url,
      excerpt: v.summary ?? v.content_text,
      publishedAt: v.date_published ?? null,
      eventAt: v.event_at ?? null,
    }));
  }
  check(!/<!DOCTYPE|<!ENTITY/i.test(body), "xml_entities_forbidden");
  const decode = (s: string) =>
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  const tags = (chunk: string, tag: string) =>
    decode(
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(chunk)?.[1] ??
        "",
    ).trim();
  const items = [
    ...body.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  ].slice(0, 40);
  return items.map((m) => ({
    title: tags(m[2], "title"),
    url: tags(m[2], "link") || /<link[^>]*href="([^"]+)"/i.exec(m[2])?.[1],
    excerpt: tags(m[2], "description") || tags(m[2], "summary"),
    publishedAt: tags(m[2], "pubDate") || tags(m[2], "published") || null,
  }));
}
export class Knowledge {
  app: Domain;
  fetcher: typeof safeFetch;
  busy = false;
  constructor(app: Domain, fetcher = safeFetch) {
    this.app = app;
    this.fetcher = fetcher;
  }
  search(c: Context, q: string, after?: number) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return this.app
      .list(c, "document")
      .filter(
        (r) =>
          r.status === "verified" &&
          r.data.expiresAt > this.app.now() &&
          (!after || (r.data.publishedAt && r.data.publishedAt >= after)) &&
          terms.every((t) =>
            (r.data.title + " " + r.data.excerpt + " " + r.data.zone)
              .toLowerCase()
              .includes(t),
          ),
      )
      .slice(0, 8)
      .map((r) => ({ id: r.id, ...r.data }));
  }
  async collect(c: Context, id: string) {
    const a = this.app;
    a.admin(c);
    const source = a.get(c, id, "source");
    check(source.status === "active", "source_paused", 409);
    check(
      !source.data.lastAttempt || source.data.lastAttempt < a.now() - 60000,
      "source_rate_limited",
      429,
    );
    a.save(c, source, { ...source.data, lastAttempt: a.now() });
    try {
      const response = await this.fetcher(source.data.url);
      const items = feedItems(response.body, source.data.format);
      const result = a.db.tx(() => {
        const current = a.get(c, id, "source");
        check(current.status === "active", "source_paused", 409);
        let changed = 0;
        for (const item of items) {
          const itemUrl = url(item.url);
          check(
            new URL(itemUrl).hostname === new URL(source.data.url).hostname,
            "feed_link_domain_forbidden",
          );
          const d = a.documentData({
            ...item,
            publisher: source.data.publisher,
            zone: source.data.zone,
            language: source.data.language,
            category: source.data.category,
            official: source.data.official,
            sourceId: id,
            expiresAt: a.now() + source.data.freshnessHours * 3600000,
          });
          const fingerprint = hash(
            json({
              title: d.title,
              excerpt: d.excerpt,
              publishedAt: d.publishedAt,
              eventAt: d.eventAt,
            }),
          );
          const prior = a.db.get(
            "SELECT id FROM records WHERE group_id=? AND kind='document' AND json_extract(data,'$.url')=? AND json_extract(data,'$.sourceId')=?",
            c.groupId,
            itemUrl,
            id,
          );
          if (prior) {
            const old = a.raw(prior.id);
            if (old.data.fingerprint === fingerprint) continue;
            a.save(c, old, { ...d, fingerprint }, "pending");
          } else
            a.createRecord(c, "document", "pending", { ...d, fingerprint });
          changed++;
        }
        a.save(c, a.raw(id), {
          ...current.data,
          lastCollected: a.now(),
          lastError: null,
        });
        return { collected: items.length, changed };
      });
      return result;
    } catch (e) {
      const current = a.raw(id);
      a.save(c, current, {
        ...current.data,
        lastError: e instanceof Problem ? e.code : "collection_failed",
      });
      throw e;
    }
  }
  async due() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const row of this.app.db.all(
        "SELECT id FROM records WHERE kind='source' AND status='active' LIMIT 30",
      )) {
        const r = this.app.raw(row.id);
        if (
          (r.data.lastAttempt ?? 0) + r.data.frequencyHours * 3600000 >
          this.app.now()
        )
          continue;
        try {
          await this.collect({ userId: r.owner_id, groupId: r.group_id }, r.id);
        } catch {
          /* status recorded; keep processing other authorized sources */
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
