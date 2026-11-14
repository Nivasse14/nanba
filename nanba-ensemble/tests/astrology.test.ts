import { test } from "node:test";
import assert from "node:assert/strict";
import { DB } from "../src/db.ts";
import { TwilioAssistant } from "../src/twilio-assistant.ts";
import {
  birthInstant,
  calculateBirth,
  lunarPosition,
} from "../src/nanba-astrology.ts";

const india = {
  geonameId: "1264527",
  city: "Chennai",
  label: "Chennai, Tamil Nadu, India",
  countryCode: "IN",
  latitude: 13.08784,
  longitude: 80.27847,
  timezone: "Asia/Kolkata",
};
const france = {
  geonameId: "2988507",
  city: "Paris",
  label: "Paris, France",
  countryCode: "FR",
  latitude: 48.85,
  longitude: 2.35,
  timezone: "Europe/Paris",
};
const texas = {
  ...france,
  geonameId: "4717560",
  label: "Paris, Texas, United States",
  countryCode: "US",
  timezone: "America/Chicago",
};
function fixture() {
  const db = new DB(":memory:");
  let now = Date.parse("2026-11-14T10:00Z"),
    index = 0;
  let delayed: (() => Promise<void>) | undefined;
  const urls: string[] = [];
  const a = new TwilioAssistant(
    db,
    "https://nanba.test",
    {
      IDENTITY_ENCRYPTION_KEY: "a".repeat(64),
      TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32),
      TWILIO_AUTH_TOKEN: "b".repeat(32),
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155550100",
      OPENAI_API_KEY: "test",
      TWILIO_AI_ENABLED: "true",
    },
    async (url) => {
      urls.push(String(url));
      if (delayed) await delayed();
      const q = new URL(String(url)).searchParams.get("q");
      return Response.json({
        items:
          q === "Paris"
            ? [france, texas]
            : q === "Chennai"
              ? [india]
              : q === "Pondichéry"
                ? [{ ...india, geonameId: "1259425", city: "Puducherry" }]
                : [],
      });
    },
    () => now,
  );
  const job = (phone = "whatsapp:+33600000001", body = "Mon horoscope") => {
    const sid = "SM" + (++index).toString(16).padStart(32, "0");
    a.receive({
      MessageSid: sid,
      From: phone,
      To: "whatsapp:+14155550100",
      Body: body,
      NumMedia: "0",
    });
    db.run("UPDATE twilio_jobs SET state='generating' WHERE sid=?", sid);
    return db.get("SELECT * FROM twilio_jobs WHERE sid=?", sid)!;
  };
  const first = job();
  return {
    db,
    a,
    job,
    first,
    urls,
    action: (args: any, j = first) => a.companion.action(j, args),
    setTime: (t: number) => (now = t),
    delay: (fn: () => Promise<void>) => (delayed = fn),
  };
}

test("Lahiri engine matches independent published natal samples, including Chennai", () => {
  for (const [utc, lon, rasi, nak, pada] of [
    ["1968-03-13T04:30Z", 128.1225, 4, 9, 3],
    ["1970-01-15T04:30Z", 8.8152777778, 0, 0, 3],
    ["2004-02-12T09:49Z", 194.08, 6, 14, 3],
  ] as const) {
    const p = lunarPosition(new Date(utc));
    assert.ok(Math.abs(p.longitude - lon) < 1 / 60);
    assert.deepEqual([p.rasi, p.nakshatra, p.pada], [rasi, nak, pada]);
  }
  const p = calculateBirth({ date: "2004-02-12", time: "15:19", place: india });
  assert.equal(p.rasi, "Tula");
  assert.equal(p.nakshatram, "Swati");
  assert.equal(p.pada, 3);
  assert.equal(p.birthInstant, "2004-02-12T09:49:00.000Z");
});
test("Historical zones, invalid calendars, DST gap and repeated birth hour", () => {
  assert.equal(
    birthInstant("1990-07-15", "12:00", "Europe/Paris").toISOString(),
    "1990-07-15T10:00:00.000Z",
  );
  assert.equal(
    birthInstant("1990-01-15", "12:00", "Europe/Paris").toISOString(),
    "1990-01-15T11:00:00.000Z",
  );
  for (const [date, time] of [
    ["2024-03-31", "02:30"],
    ["2024-10-27", "02:30"],
    ["2024-02-30", "12:00"],
  ])
    assert.throws(() => birthInstant(date, time, "Europe/Paris"));
  const p = calculateBirth({
    date: "2024-10-27",
    time: "02:30",
    place: france,
  });
  assert.equal(p.status, "time-review");
  assert.equal(p.rasi, null);
});
test("Unknown or approximate time never becomes a fabricated noon birth or exact pada", () => {
  const p = calculateBirth({
    date: "2004-02-12",
    time: "unknown",
    place: india,
  });
  assert.equal(p.status, "time-unknown");
  assert.equal(p.pada, null);
  assert.equal(p.birthInstant, undefined);
  assert.ok(p.possibleRasi.length >= 1);
  assert.equal(p.rasi, "Tula");
  const a = calculateBirth({
    date: "2004-02-12",
    time: "15:19",
    timeApproximate: true,
    place: india,
  });
  assert.equal(a.status, "time-approximate");
  assert.equal(a.birthInstant, undefined);
});
test("Plain birth onboarding stores encrypted per-number data; correction recomputes", async () => {
  const f = fixture();
  try {
    assert.match(
      (await f.action({ action: "horoscope" })).nextQuestion,
      /date de naissance/,
    );
    const date = await f.action({
      action: "horoscope_update",
      birthDate: "2004-02-12",
    });
    assert.match(date.nextQuestion, /ville/);
    assert.equal(date.natal.rasi, null);
    const place = await f.action({
      action: "horoscope_update",
      birthPlace: "Chennai",
      birthCountry: "IN",
    });
    assert.match(place.nextQuestion, /heure/);
    assert.equal(place.birth.place.timezone, "Asia/Kolkata");
    const done = await f.action({
      action: "horoscope_update",
      birthTime: "15:19",
    });
    assert.equal(done.natal.rasi, "Tula");
    assert.equal(done.nextQuestion, undefined);
    assert.ok(
      !f.db.get("SELECT data FROM nanba_profiles")!.data.includes("2004-02-12"),
    );
    assert.equal(
      f.a.companion.profile(f.job("whatsapp:+33600000002").identity).birth,
      undefined,
    );
    const corrected = await f.action({
      action: "horoscope_update",
      birthDate: "1970-01-15",
      birthTime: "10:00",
    });
    assert.equal(corrected.natal.rasi, "Mesha");
    assert.equal(f.a.companion.profile(f.first.identity).rasi, "Mesha");
    assert.ok(
      f.urls.every((u) => !u.includes("2004") && !u.includes("1970")),
      "dates never sent to location service",
    );
    await assert.rejects(
      f.action({ action: "profile_update", profile: { rasi: "Tula" } }),
      /signes_calcules/,
    );
  } finally {
    f.db.close();
  }
});
test("Homonymous places require a choice; canonical ids cannot be stolen from another number", async () => {
  const f = fixture();
  try {
    const ambiguous = await f.action({
      action: "horoscope_update",
      birthDate: "2004-02-12",
      birthPlace: "Paris",
      birthTime: "12:00",
    });
    assert.equal(ambiguous.natal.rasi, null);
    assert.equal(ambiguous.candidates.length, 2);
    await assert.rejects(
      f.action(
        { action: "horoscope_update", birthPlaceId: france.geonameId },
        f.job("whatsapp:+33600000002"),
      ),
      /rechercher/,
    );
    await assert.rejects(
      f.action({ action: "horoscope_update", birthPlaceId: "123" }),
      /non_proposee/,
    );
    const done = await f.action({
      action: "horoscope_update",
      birthPlaceId: france.geonameId,
    });
    assert.equal(done.birth.place.timezone, "Europe/Paris");
    const reset = await f.action({
      action: "horoscope_update",
      birthPlace: "Nowhere",
    });
    assert.equal(reset.natal.rasi, null);
    assert.equal(f.a.companion.profile(f.first.identity).rasi, undefined);
  } finally {
    f.db.close();
  }
});
test("Unknown time remains usable without nagging; horoscope subscriptions use calculated profile", async () => {
  const f = fixture();
  try {
    const r = await f.action({
      action: "horoscope_update",
      birthDate: "2004-02-12",
      birthPlace: "Chennai",
      birthTime: "unknown",
    });
    assert.equal(r.nextQuestion, undefined);
    assert.equal(r.natal.status, "time-unknown");
    const routine = await f.action({
      action: "routine_set",
      consent: true,
      slots: [{ kind: "morning", at: "08:00", topics: ["horoscope"] }],
    });
    assert.ok(routine);
    const first = await f.a.companion.routines.compose(
      f.first.identity,
      "morning",
      { topics: ["horoscope"] },
      true,
    );
    assert.match(first.text, /Lune|Moon/);
    const date1 = f.a.companion.horoscopes.daily(f.first.identity).date;
    f.setTime(Date.parse("2026-11-15T10:00Z"));
    assert.notEqual(
      f.a.companion.horoscopes.daily(f.first.identity).date,
      date1,
    );
  } finally {
    f.db.close();
  }
});
test("Invalid and future DOB rejected, old city choices expire, forget removes derived fields", async () => {
  const f = fixture();
  try {
    for (const birthDate of [
      "2004-02-30",
      "2027-01-01",
      "12/02/2004",
      "1899-01-01",
    ])
      await assert.rejects(
        f.action({ action: "horoscope_update", birthDate }),
        /date_naissance/,
      );
    await f.action({
      action: "horoscope_update",
      birthDate: "2004-02-12",
      birthPlace: "Paris",
    });
    f.setTime(Date.parse("2026-11-14T12:00Z"));
    await assert.rejects(
      f.action({ action: "horoscope_update", birthPlaceId: france.geonameId }),
      /rechercher/,
    );
    await f.action({ action: "horoscope_forget" });
    assert.equal(f.a.companion.profile(f.first.identity).birth, undefined);
    assert.equal(
      f.a.companion.profile(f.first.identity).birthAstrology,
      undefined,
    );
  } finally {
    f.db.close();
  }
});
test("OUBLIE during a pending city request cannot recreate the deleted birth profile", async () => {
  const f = fixture();
  try {
    let release!: () => void;
    f.delay(() => new Promise<void>((resolve) => (release = resolve)));
    const pending = f.action({
      action: "horoscope_update",
      birthDate: "2004-02-12",
      birthPlace: "Chennai",
      birthTime: "15:19",
    });
    await new Promise((resolve) => setImmediate(resolve));
    f.job("whatsapp:+33600000001", "OUBLIE");
    release();
    await assert.rejects(pending, /conversation_cancelled/);
    assert.deepEqual(f.a.companion.profile(f.first.identity), {});
  } finally {
    f.db.close();
  }
});
