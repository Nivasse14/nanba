import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
import {
  catalogueCompatible,
  catalogueCriteria,
} from "../src/nanba-catalogue.ts";

function fixture() {
  const db = new DB(":memory:");
  let now = Date.parse("2026-11-15T10:00:00Z"),
    seq = 0,
    semantic: string[] | null = null;
  const entries: any[] = [],
    calls: { url: string; body: any }[] = [];
  const env = {
    IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
    TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
    TWILIO_AUTH_TOKEN: "b".repeat(32),
    TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
    OPENAI_API_KEY: "test",
    TWILIO_AI_ENABLED: "true",
    NANBA_WHATSAPP_CATALOGUE_SECRET: "catalogue-test-secret-".repeat(3),
  };
  const fetcher: typeof fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: String(url), body });
    if (String(url).includes("/integrations/whatsapp/catalogue")) {
      const headers = init!.headers as Record<string, string>;
      assert.equal(
        headers["x-nanba-signature"],
        createHmac("sha256", env.NANBA_WHATSAPP_CATALOGUE_SECRET)
          .update(headers["x-nanba-timestamp"] + "\n" + String(init!.body))
          .digest("hex"),
      );
      const id =
        "wa_listing_" + body.requestId?.replace(/-/g, "").padEnd(36, "0");
      if (body.action === "publish") {
        const existing = entries.find((x) => x.id === id);
        if (existing) return Response.json(existing);
        const item = {
          ...body.listing,
          id,
          ownerId: "wa_" + body.actor,
          source: "whatsapp",
          status: "moderation",
          expiresAt: new Date(now + 30 * 86400000).toISOString(),
          housingDetails: {
            propertyTypes: body.listing.propertyTypes,
            rent: body.listing.price,
          },
        };
        entries.push(item);
        return Response.json(item);
      }
      if (body.action === "mine")
        return Response.json({
          items: entries.filter((x) => x.ownerId === "wa_" + body.actor),
        });
      const item = entries.find(
        (x) => x.id === body.reference && x.ownerId === "wa_" + body.actor,
      );
      if (!item) return Response.json({ error: "owner" }, { status: 403 });
      if (body.action === "remove") {
        item.status = "withdrawn";
        item.deletedAt = new Date(now).toISOString();
      }
      return Response.json(item);
    }
    if (String(url).includes("/listings?"))
      return Response.json(
        entries.filter(
          (x) =>
            x.target === new URL(String(url)).searchParams.get("target") &&
            x.status === "published" &&
            !x.deletedAt,
        ),
      );
    if (String(url).endsWith("/responses"))
      return Response.json({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ids:
                    semantic ??
                    JSON.parse(body.input).listings.map((x: any) => x.id),
                }),
              },
            ],
          },
        ],
        usage: { total_tokens: 100 },
      });
    throw Error("unexpected URL");
  };
  const a = new TwilioAssistant(
    db,
    "https://nanba.test",
    env,
    fetcher,
    () => now,
  );
  const receive = (phone = "whatsapp:+33600000001", text = "Bonjour") => {
    const sid = "SM" + (++seq).toString(16).padStart(32, "0");
    a.receive({
      MessageSid: sid,
      From: phone,
      To: env.TWILIO_WHATSAPP_FROM,
      Body: text,
      NumMedia: "0",
    });
    db.run("UPDATE twilio_jobs SET state='generating' WHERE sid=?", sid);
    return db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid)!;
  };
  const action = (job: any, args: any) => a.companion.action(job, args);
  const markDone = () =>
    db.run("UPDATE twilio_jobs SET state='sent' WHERE schedule_id IS NULL");
  return {
    db,
    a,
    env,
    entries,
    calls,
    receive,
    action,
    markDone,
    advance: (ms: number) => {
      now += ms;
    },
    semantic: (value: string[]) => {
      semantic = value;
    },
    close: () => db.close(),
  };
}
const draft = {
  action: "catalogue_prepare",
  target: "housing",
  intent: "offer",
  title: "Chambre meublée à Sevran",
  text: "Une chambre meublée disponible dès maintenant.",
  city: "Sevran",
  budget: 500,
  propertyTypes: ["private-room"],
};
const listing = (id = "one", extra: any = {}) => ({
  id,
  title: "Une chambre meublée",
  description: "Chambre individuelle disponible",
  location: "Sevran",
  target: "housing",
  intent: "offer",
  price: 500,
  status: "published",
  housingDetails: { propertyTypes: ["private-room"] },
  ...extra,
});

test("draft requires confirmation; confirmed publication goes to main catalogue exactly once and keeps moderation honest", async () => {
  const f = fixture();
  try {
    const job = f.receive(),
      other = f.receive("whatsapp:+33600000002");
    const prepared = await f.action(job, draft);
    assert.equal(prepared.published, false);
    assert.equal(f.entries.length, 0);
    await assert.rejects(
      f.action(other, {
        action: "catalogue_publish",
        reference: prepared.reference,
        consent: true,
      }),
    );
    await assert.rejects(
      f.action(job, {
        action: "catalogue_publish",
        reference: prepared.reference,
      }),
    );
    const receipt = await f.action(job, {
      action: "catalogue_publish",
      reference: prepared.reference,
      consent: true,
    });
    assert.equal(receipt.inMainCatalogue, true);
    assert.equal(receipt.visible, false);
    assert.equal(receipt.status, "moderation");
    const repeated = f.receive();
    assert.deepEqual(
      await f.action(repeated, {
        action: "catalogue_publish",
        reference: prepared.reference,
        consent: true,
      }),
      receipt,
    );
    assert.equal(f.entries.length, 1);
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM nanba_offers")!.n,
      0,
      "no second publication in assistant catalogue",
    );
    f.entries[0].status = "published";
    f.a.companion.cache.clear();
    const found = await f.action(other, {
      action: "catalogue_search",
      target: "housing",
      city: "Sevran",
      query: "un petit endroit où vivre",
    });
    assert.equal(found.items.length, 1);
    assert(!JSON.stringify(found).includes("+336"));
    await assert.rejects(
      f.action(other, {
        action: "catalogue_remove",
        reference: receipt.reference,
      }),
    );
    await f.action(job, {
      action: "catalogue_remove",
      reference: receipt.reference,
    });
    assert.equal(
      (
        await f.a.companion.catalogue.search(other.identity, {
          target: "housing",
          city: "Sevran",
        })
      ).items.length,
      0,
    );
  } finally {
    f.close();
  }
});

test("publication fails closed without bridge; vague multilingual searches return candidates and available regions without requiring exact keywords", async () => {
  const f = fixture();
  try {
    const j = f.receive();
    f.env.NANBA_WHATSAPP_CATALOGUE_SECRET = "";
    await assert.rejects(
      f.action(j, { ...draft, action: "community_publish" }),
      /non_connecte/,
    );
    f.entries.push(listing());
    const found = await f.action(j, {
      action: "catalogue_search",
      target: "housing",
      query: "எனக்கு தங்க இடம் வேண்டும்",
    });
    assert.equal(found.items.length, 1);
    assert.equal(found.needsArea, true);
    assert.deepEqual(found.availableAreas, ["Sevran"]);
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM nanba_catalogue_searches")!.n,
      0,
    );
    assert.equal(
      (
        await f.a.companion.catalogue.search(j.identity, {
          target: "housing",
          areas: ["Lyon"],
        })
      ).items.length,
      0,
    );
  } finally {
    f.close();
  }
});

test("hard constraints never silently broaden location, budget, property type, contract or offer/request direction", () => {
  const criteria = catalogueCriteria({
    target: "housing",
    areas: ["Île-de-France"],
    budget: 550,
    propertyTypes: ["private-room"],
  });
  assert(catalogueCompatible(listing(), criteria));
  for (const patch of [
    { location: "Lyon" },
    { price: 600 },
    { price: null },
    { intent: "request" },
    { status: "moderation" },
    { housingDetails: { propertyTypes: ["studio"] } },
    { expiresAt: "2000-01-01" },
  ])
    assert(
      !catalogueCompatible(listing("x", patch), criteria),
      JSON.stringify(patch),
    );
  assert(
    !catalogueCompatible(
      listing("x", { location: "Parisot" }),
      catalogueCriteria({ target: "housing", areas: ["Paris"] }),
    ),
  );
  assert(
    !catalogueCompatible(
      listing("x", { target: "jobs", jobContract: "CDD" }),
      catalogueCriteria({ target: "jobs", anywhere: true, jobContract: "CDI" }),
    ),
  );
});

test("alerts require consent and accepted area, use semantic comparison, suppress duplicates and recheck availability before delivery", async () => {
  const f = fixture();
  try {
    const j = f.receive();
    await assert.rejects(
      f.action(j, {
        action: "catalogue_watch",
        target: "housing",
        areas: ["Sevran"],
      }),
      /consentement/,
    );
    await assert.rejects(
      f.action(j, {
        action: "catalogue_watch",
        target: "housing",
        consent: true,
      }),
      /zone/,
    );
    const watch = await f.action(j, {
      action: "catalogue_watch",
      target: "housing",
      areas: ["Sevran"],
      budget: 550,
      query: "une chambre pour vivre près de mon travail",
      consent: true,
    });
    assert(watch.reference);
    f.markDone();
    f.entries.push(
      listing("good"),
      listing("expensive", { price: 900 }),
      listing("elsewhere", { location: "Lyon" }),
    );
    f.semantic(["good", "invented-id"]);
    await f.a.companion.catalogue.tick();
    const queued = f.db.get("SELECT * FROM twilio_jobs WHERE sid LIKE 'NC%'")!;
    assert(queued);
    assert(f.a.unseal(queued.output).includes("good"));
    assert(!f.a.unseal(queued.output).includes("expensive"));
    assert.equal(f.calls.filter((x) => x.url.endsWith("/responses")).length, 1);
    f.advance(5 * 60000);
    await f.a.companion.catalogue.tick();
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM nanba_catalogue_alerts")!.n,
      1,
    );
    f.entries[0].status = "withdrawn";
    assert.equal(
      await f.a.companion.catalogue.deliveryAvailable(queued),
      false,
    );
  } finally {
    f.close();
  }
});

test("PAUSE, STOP, cancellation and account separation prohibit proactive delivery", async () => {
  const f = fixture();
  try {
    const j = f.receive(),
      other = f.receive("whatsapp:+33600000002");
    const watch = await f.action(j, {
      action: "catalogue_watch",
      target: "market",
      areas: ["Paris"],
      query: "un vélo pour aller au travail",
      consent: true,
    });
    f.entries.push(
      listing("bike", {
        target: "market",
        title: "Bicyclette",
        location: "Paris",
        price: 80,
      }),
    );
    f.markDone();
    f.a.companion.routines.command(j.identity, "PAUSE");
    await f.a.companion.catalogue.tick();
    assert.equal(f.calls.filter((x) => x.url.endsWith("/responses")).length, 0);
    assert.equal(
      (
        await f.a.companion.catalogue.action(other.identity, {
          action: "catalogue_watch_list",
        })
      ).searches.length,
      0,
    );
    await f.a.companion.catalogue.action(j.identity, {
      action: "catalogue_watch_cancel",
      reference: watch.reference,
    });
    assert.equal(
      f.db.get("SELECT active FROM nanba_catalogue_searches")!.active,
      0,
    );
    f.a.companion.stop(j.identity, true);
    assert.equal(
      f.db.get("SELECT COUNT(*) n FROM nanba_catalogue_searches")!.n,
      0,
    );
  } finally {
    f.close();
  }
});

test("new catalogue contact still requires advertiser acceptance; a third person cannot accept", async () => {
  const f = fixture();
  try {
    const owner = f.receive(),
      seeker = f.receive("whatsapp:+33600000002");
    const prepared = await f.action(owner, draft);
    const receipt = await f.action(owner, {
      action: "catalogue_publish",
      reference: prepared.reference,
      consent: true,
    });
    f.entries[0].status = "published";
    f.a.companion.cache.clear();
    const request = await f.action(seeker, {
      action: "community_request",
      reference: receipt.reference,
    });
    assert(!JSON.stringify(request).includes("+336"));
    await assert.rejects(
      f.action(seeker, {
        action: "community_accept",
        reference: request.reference,
      }),
    );
    const accepted = await f.action(owner, {
      action: "community_accept",
      reference: request.reference,
    });
    assert.equal(accepted.phone, "+33600000002");
  } finally {
    f.close();
  }
});
