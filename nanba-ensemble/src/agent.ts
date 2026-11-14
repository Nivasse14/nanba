import { readFileSync } from "node:fs";
import { check, text, oneOf } from "./validation.ts";
import type { Domain } from "./modules.ts";
import type { Context } from "./core.ts";
import type { Knowledge } from "./knowledge.ts";
import type { Row } from "./db.ts";
export const SYSTEM_PROMPT = readFileSync(
  new URL("../docs/AGENT_PROMPT.txt", import.meta.url),
  "utf8",
);
export class Agent {
  app: Domain;
  knowledge: Knowledge;
  fetcher: typeof fetch;
  constructor(app: Domain, knowledge: Knowledge, fetcher = fetch) {
    this.app = app;
    this.knowledge = knowledge;
    this.fetcher = fetcher;
  }
  tool(c: Context, name: string, args: Row): Row | Row[] {
    this.app.member(c);
    switch (name) {
      case "search_knowledge":
        return this.knowledge.search(c, text(args.query, "query", 300));
      case "find_meetups":
        return this.app.matches(c, args);
      case "prepare_request":
        return this.app.create(c, "request", args);
      case "submit_radar":
        return this.app.create(c, "radar", args);
      case "prepare_story":
        return this.app.create(c, "story", args);
      case "request_help":
        return this.app.create(c, "help", args);
      default:
        throw new Error("tool_not_allowed");
    }
  }
  async draft(c: Context, input: Row) {
    const a = this.app;
    a.member(c);
    const prompt = text(input.text, "text", 3000);
    const language = oneOf(
      input.language ?? "fr",
      ["fr", "en", "ta", "tanglish"],
      "language",
    );
    const sources = this.knowledge.search(c, prompt);
    const configured = !!(
      process.env.AI_API_KEY &&
      process.env.AI_BASE_URL &&
      process.env.AI_MODEL
    );
    if (!configured)
      return {
        mode: "unconfigured",
        draft: null,
        sources,
        message:
          "Aucun fournisseur IA connecté. Les formulaires, recherches et inscriptions restent disponibles.",
        languagesEvaluated: ["fr", "en"],
        unevaluated: ["ta", "tanglish"],
      };
    const day = new Date(a.now()).toISOString().slice(0, 10),
      limit = Number(process.env.AI_DAILY_CALLS ?? 20);
    a.db.tx(() => {
      const userUsage = a.db.get(
        "SELECT COALESCE(SUM(calls),0) calls,COALESCE(SUM(tokens),0) tokens FROM ai_usage WHERE user_id=? AND day=?",
        c.userId,
        day,
      )!;
      const groupUsage = a.db.get(
        "SELECT COALESCE(SUM(calls),0) calls FROM ai_usage WHERE group_id=? AND day=?",
        c.groupId,
        day,
      )!;
      check(
        userUsage.calls < limit &&
          userUsage.tokens < 20000 &&
          groupUsage.calls < 200,
        "ai_budget_exceeded",
        429,
      );
      a.db.run(
        "INSERT INTO ai_usage(user_id,group_id,day,calls) VALUES(?,?,?,1) ON CONFLICT(user_id,group_id,day) DO UPDATE SET calls=calls+1",
        c.userId,
        c.groupId,
        day,
      );
    });
    const start = Date.now();
    try {
      const base = new URL(process.env.AI_BASE_URL!);
      check(
        base.protocol === "https:" ||
          (process.env.NODE_ENV === "test" && base.hostname === "localhost"),
        "ai_https_required",
      );
      const response = await this.fetcher(
        base.href.replace(/\/$/, "") + "/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.AI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.AI_MODEL,
            max_tokens: Math.min(
              1000,
              Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 600),
            ),
            temperature: 0.3,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: JSON.stringify({
                  task: "Prépare uniquement un brouillon à valider.",
                  language,
                  request: prompt,
                  untrustedSources: sources
                    .map((s) => ({
                      title: s.title,
                      excerpt: s.excerpt,
                      url: s.url,
                    }))
                    .slice(0, 4),
                }),
              },
            ],
          }),
          signal: AbortSignal.timeout(12000),
          redirect: "error",
        },
      );
      check(response.ok, "ai_unavailable", 503);
      const result = (await response.json()) as Row;
      const draft = text(
        result.choices?.[0]?.message?.content,
        "ai_output",
        6000,
      );
      a.db.run(
        "UPDATE ai_usage SET tokens=tokens+?,latency_ms=latency_ms+? WHERE user_id=? AND group_id=? AND day=?",
        Math.min(
          30000,
          Math.max(0, Number(result.usage?.total_tokens ?? 5000)),
        ),
        Date.now() - start,
        c.userId,
        c.groupId,
        day,
      );
      return {
        mode: "draft",
        draft,
        sources,
        requiresReview: true,
        unevaluated: language === "ta" || language === "tanglish",
      };
    } catch {
      a.db.run(
        "UPDATE ai_usage SET failures=failures+1,latency_ms=latency_ms+? WHERE user_id=? AND group_id=? AND day=?",
        Date.now() - start,
        c.userId,
        c.groupId,
        day,
      );
      return {
        mode: "unavailable",
        draft: null,
        sources,
        message:
          "Le fournisseur IA est indisponible. Aucun message publié ; les formulaires restent accessibles.",
      };
    }
  }
}
