import { createHash } from "node:crypto";
import type { Row } from "./db.ts";
import type { Companion } from "./nanba-companion.ts";
import { check } from "./validation.ts";

export const NANBA_APP = "https://nanba-app.indiancat.chatgpt.site";
export const services = [
  "news",
  "cinema",
  "cards",
  "exchange",
  "travel",
  "employment",
  "training",
  "debate",
  "kids",
  "cuisine",
  "housing",
  "market",
  "jobs",
  "services",
  "events",
];
export const tidy = (s: unknown, max = 240) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, max);
export function webUrl(value: unknown) {
  try {
    const u = new URL(String(value));
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export const fingerprint = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export class NanbaServices {
  companion: Companion;
  pending = new Map<string, Promise<any>>();
  failures = new Map<string, number>();
  constructor(companion: Companion) {
    this.companion = companion;
    companion.db.raw
      .exec(`CREATE TABLE IF NOT EXISTS nanba_api_cache(key TEXT PRIMARY KEY,data TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nanba_api_health(service TEXT PRIMARY KEY,checked_at INTEGER NOT NULL,status TEXT NOT NULL);`);
  }
  async cached(path: string, ttl = 15 * 60000) {
    // Fixed read-only routes only. Never forward user URLs, tokens or refresh flags.
    check(
      /^\/(cinema\/streaming|cards-smiles\/feed|business\/overview|travel\/overview|employment\/(opportunities|training-options)|debates\/current|kids\/daily-game|cuisine\/videos)\?/.test(
        path,
      ),
      "service_non_autorise",
    );
    const c = this.companion;
    check((this.failures.get(path) || 0) <= c.now, "api_nanba_backoff");
    const row = c.db.get(
      "SELECT data FROM nanba_api_cache WHERE key=? AND expires_at>?",
      path,
      c.now,
    );
    if (row) return JSON.parse(row.data);
    if (this.pending.has(path)) return this.pending.get(path)!;
    const request = c
      .api(path)
      .then((data) => {
        c.db.run("DELETE FROM nanba_api_cache WHERE expires_at<?", c.now);
        if (c.db.get("SELECT COUNT(*) n FROM nanba_api_cache")!.n >= 160)
          c.db.run(
            "DELETE FROM nanba_api_cache WHERE key IN(SELECT key FROM nanba_api_cache ORDER BY expires_at LIMIT 20)",
          );
        c.db.run(
          "INSERT INTO nanba_api_cache VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
          path,
          JSON.stringify(data),
          c.now + ttl,
        );
        return data;
      })
      .catch((error) => {
        if (this.failures.size > 160) this.failures.clear();
        this.failures.set(path, c.now + 60000);
        throw error;
      })
      .finally(() => this.pending.delete(path));
    this.pending.set(path, request);
    return request;
  }
  async read(identity: string, args: Row): Promise<Row> {
    const c = this.companion,
      p = c.profile(identity);
    const service = String(args.service || "");
    check(services.includes(service), "service_inconnu");
    try {
      const result = await this.resolve(identity, { ...p, ...args, service });
      c.db.run(
        "INSERT INTO nanba_api_health VALUES(?,?,?) ON CONFLICT(service) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status",
        service,
        c.now,
        result.items?.length ? "ready" : "empty",
      );
      return {
        service,
        ...result,
        items: (result.items || []).slice(0, 8).map((x: Row) => ({
          ...x,
          key: fingerprint(service + ":" + (x.id || x.url || x.title)),
        })),
      };
    } catch (e) {
      c.db.run(
        "INSERT INTO nanba_api_health VALUES(?,?,?) ON CONFLICT(service) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status",
        service,
        c.now,
        "unavailable",
      );
      return {
        service,
        items: [],
        available: false,
        message:
          "Ce service Nanba est momentanément indisponible. Ne pas inventer de résultat.",
      };
    }
  }
  async resolve(identity: string, a: Row): Promise<Row> {
    const c = this.companion,
      locale = ["en", "ta"].includes(a.language) ? a.language : "fr";
    const q = (params: Record<string, string> = {}) =>
      new URLSearchParams({ locale, ...params }).toString();
    const fresh = (date: unknown, days: number) =>
      Number.isFinite(Date.parse(String(date))) &&
      Date.parse(String(date)) <= c.now + 300000 &&
      c.now - Date.parse(String(date)) < days * 86400000;
    const local = (value: any) =>
      typeof value === "object"
        ? value?.[locale] || value?.fr || value?.en || ""
        : value;
    if (a.service === "news") return c.news(identity, a);
    if (["housing", "jobs", "market", "services", "events"].includes(a.service))
      return c.listings(identity, { ...a, target: a.service });
    if (a.service === "cinema") {
      const country = ["FR", "IN"].includes(a.country) ? a.country : "FR";
      const industry = [
        "kollywood",
        "bollywood",
        "tollywood",
        "mollywood",
        "sandalwood",
      ].includes(a.industry)
        ? a.industry
        : "all";
      const d = await this.cached(
        "/cinema/streaming?" + q({ country, industry, limit: "36" }),
        3600000,
      );
      const platforms = Array.isArray(a.platforms) ? a.platforms : [];
      return {
        country,
        fetchedAt: d.fetchedAt,
        attribution: "JustWatch via TMDB",
        message:
          "Disponibilités indicatives à vérifier sur la plateforme. Ne pas inventer de genre ni de prix.",
        items: !fresh(d.fetchedAt, 7)
          ? []
          : (d.items || [])
              .filter(
                (x: Row) =>
                  !platforms.length ||
                  x.providers?.some((v: Row) => platforms.includes(v.key)),
              )
              .filter(
                (x: Row) =>
                  !a.query ||
                  (x.title + " " + x.overview)
                    .toLowerCase()
                    .includes(tidy(a.query).toLowerCase()),
              )
              .map((x: Row) => ({
                id: x.id,
                title: tidy(x.title, 100),
                summary: tidy(x.overview, 350),
                url: webUrl(x.watchUrl),
                language: tidy(x.language, 30),
                platforms: (x.providers || []).map((v: Row) =>
                  tidy(v.name, 40),
                ),
                rating: x.voteAverage,
                runtimeMinutes: x.runtimeMinutes,
                publishedAt: d.fetchedAt,
              }))
              .filter((x: Row) => x.url),
      };
    }
    if (a.service === "exchange") {
      const d = await this.cached("/business/overview?" + q());
      return {
        message:
          "Taux de référence, pas un prix de transfert. LKR : taux comptable mensuel. Cotation or non redistribuée : droits limités à l’application.",
        items: (d.fx?.rates || [])
          .filter(
            (x: Row) =>
              ["INR", "LKR"].includes(x.quoteCurrency) &&
              Number.isFinite(x.value) &&
              fresh(x.asOf, x.frequency === "monthly" ? 40 : 7),
          )
          .map((x: Row) => ({
            id: `${x.pair}:${x.asOf}:${x.value}`,
            title: `1 EUR = ${x.value} ${x.quoteCurrency}`,
            summary: `${x.asOf} · ${tidy(x.source?.publisher, 60)} · ${x.frequency === "monthly" ? "monthly accounting reference" : "reference rate"}`,
            url: webUrl(x.source?.url),
            publishedAt: x.asOf,
            indicative: true,
            sourceStatus: x.sourceStatus,
          })),
      };
    }
    if (a.service === "cards") {
      const d = await this.cached("/cards-smiles/feed?" + q({ limit: "30" }));
      return {
        message:
          "Liens vers les créateurs originaux ; aucune republication des médias externes. Les images jointes proviennent de la collection Nanba autorisée.",
        items: (d.items || [])
          .filter(
            (x: Row) =>
              x.status === "published" &&
              webUrl(x.sourceUrl) &&
              fresh(x.publishedAt || x.createdAt, 7) &&
              (!x.language || x.language === locale) &&
              (a.imageStyle === "spiritual" ||
                !/spiritual|religio|devotion|god|temple|prayer|mahalakshmi|murugan|ganesh|sacred/i.test(
                  [x.category, x.whatsappTheme, x.title].join(" "),
                )),
          )
          .map((x: Row) => ({
            id: x.id,
            title: tidy(x.title, 100),
            url: webUrl(x.sourceUrl),
            publishedAt: x.publishedAt || x.createdAt,
            source: tidy(x.sourceName, 60),
            rights: tidy(x.rights, 200),
          })),
      };
    }
    if (a.service === "travel") {
      const params: Record<string, string> = {};
      for (const k of ["origin", "destination"])
        if (/^[A-Z]{3}$/.test(String(a[k]))) params[k] = a[k];
      if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(a.month)))
        params.month = a.month;
      const d = await this.cached("/travel/overview?" + q(params), 3600000);
      const offers = fresh(d.route?.fetchedAt, 1)
        ? (d.route?.offers || [])
            .filter(
              (x: Row) =>
                Number.isFinite(x.price) &&
                x.price > 0 &&
                x.currency === "EUR" &&
                Date.parse(x.departureDate) >= c.now &&
                (!a.budget || x.price <= Number(a.budget)) &&
                webUrl(x.bookingUrl),
            )
            .map((x: Row) => ({
              id: `${params.origin}:${params.destination}:${x.departureDate}:${x.returnDate}:${x.price}`,
              title: `${params.origin || "CDG"} → ${params.destination} · ${x.price} EUR`,
              summary: `${x.departureDate} → ${x.returnDate || ""} · ${locale === "fr" ? "Prix observé, à revérifier" : "Observed fare, recheck before booking"}`,
              url: webUrl(x.bookingUrl),
              publishedAt: d.route.fetchedAt,
            }))
        : [];
      return {
        origin: params.origin || "CDG",
        destination: params.destination || null,
        automaticRefresh: false,
        message:
          "Lecture du cache sans crédit SerpAPI. Prix observés, jamais garantis. Aucun prix dans le cache = ouvrir la recherche authentifiée Nanba ou le lien de comparaison.",
        items: offers.length
          ? offers
          : [
              {
                id: "travel:" + JSON.stringify(params),
                title: `${params.origin || "CDG"} → ${params.destination || "destination à choisir"}`,
                summary:
                  "Comparer les vols et vérifier les prix à la réservation.",
                url: webUrl(d.booking?.searchUrl) || NANBA_APP,
                suggestionOnly: true,
              },
            ],
      };
    }
    if (a.service === "employment") {
      const departmentCode = /^(FR|\d{2,3}|2[AB])$/.test(a.departmentCode || "")
        ? a.departmentCode
        : "FR";
      const d = await this.cached(
        "/employment/opportunities?" + q({ departmentCode }),
        86400000,
      );
      const source = (d.sources || []).find((x: Row) => webUrl(x.url));
      return {
        departmentCode,
        updatedAt: d.updatedAt,
        message:
          "Intentions de recrutement annuelles, pas des offres vacantes. Utiliser jobs pour des annonces. Les conditions d’accès se vérifient individuellement.",
        pathways: (d.pathways || []).slice(0, 8).map((x: Row) => ({
          id: x.id,
          trainingQuery: x.training?.searchQuery,
          source: webUrl(x.training?.source?.url),
        })),
        items: (d.topOccupations || [])
          .filter(
            (x: Row) =>
              !a.query ||
              String(x.label)
                .toLowerCase()
                .includes(tidy(a.query).toLowerCase()),
          )
          .map((x: Row) => ({
            id: `${departmentCode}:${x.code}:${d.year}`,
            title: tidy(x.label, 110),
            summary: `${d.year || ""} · ${x.projects} intentions de recrutement · département ${departmentCode}`,
            publishedAt: d.updatedAt,
            url: webUrl(source?.url) || NANBA_APP,
          })),
      };
    }
    if (a.service === "training") {
      check(
        /^[a-z][a-z-]{1,40}$/.test(a.careerKey || ""),
        "careerKey_requis_depuis_employment",
      );
      const d = await this.cached(
        "/employment/training-options?" +
          q({
            careerKey: a.careerKey,
            departmentCode: /^(FR|\d{2,3}|2[AB])$/.test(a.departmentCode || "")
              ? a.departmentCode
              : "FR",
          }),
        3600000,
      );
      // Keep only the public catalog contract, never inferred eligibility or funding.
      return {
        message:
          "Catalogue de formations : vérifier éligibilité, financement et disponibilité avec l’organisme.",
        source: d.source,
        fetchedAt: d.fetchedAt,
        items: (d.items || d.options || d.examples || [])
          .slice(0, 8)
          .map((x: Row) => ({
            id: x.id,
            title: tidy(x.title || x.name || x.trainingTitle, 150),
            summary: tidy(
              x.providerName || x.organization || x.organisation || x.city,
              150,
            ),
            url: webUrl(x.url || x.sourceUrl || d.source?.url) || NANBA_APP,
          }))
          .filter((x: Row) => x.title),
      };
    }
    if (a.service === "debate") {
      const d = await this.cached("/debates/current?" + q());
      return {
        message:
          "Discussion privée ici ; aucun vote ou commentaire publié dans Nanba. Pour participer au débat public, ouvrir Nanba.",
        items:
          d.status !== "active" || (d.endsAt && Date.parse(d.endsAt) < c.now)
            ? []
            : [
                {
                  id: d.id,
                  title: tidy(local(d.question), 180),
                  summary: `${tidy(local(d.campA), 60)} / ${tidy(local(d.campB), 60)}`,
                  url: NANBA_APP,
                  sourceUrl: webUrl(d.sourceUrl),
                },
              ],
      };
    }
    if (a.service === "kids") {
      const grade = ["cp", "ce1", "ce2", "cm1", "cm2"].includes(a.grade)
        ? a.grade
        : "cp";
      const d = await this.cached("/kids/daily-game?" + q({ grade }));
      return {
        grade,
        date: d.quiz?.date,
        message:
          "Jeu privé dans cette conversation ; aucun score inscrit au classement de l’application. Proposer une question à la fois, expliquer la réponse après l’essai de la personne.",
        items: (d.quiz?.questions || []).map((x: Row) => ({
          id: x.id,
          title: tidy(x.prompt, 180),
          summary: (x.options || [])
            .map((s: string, i: number) => `${i + 1}. ${tidy(s, 55)}`)
            .join(" / "),
          options: x.options,
          topic: x.topic,
        })),
      };
    }
    const d = await this.cached(
      "/cuisine/videos?" + q(a.query ? { q: tidy(a.query, 80) } : {}),
      3600000,
    );
    return {
      message:
        "Vidéos des créateurs : donner le lien source, sans republier leurs vidéos.",
      items: (d.items || d.videos || [])
        .map((x: Row) => ({
          id: x.id || x.videoId,
          title: tidy(x.title, 140),
          url:
            webUrl(x.url || x.sourceUrl || x.videoUrl) ||
            (/^[\w-]{11}$/.test(x.videoId || "")
              ? `https://www.youtube.com/watch?v=${x.videoId}`
              : ""),
          source: tidy(x.channelTitle || x.sourceName, 80),
        }))
        .filter((x: Row) => x.url),
    };
  }
}
