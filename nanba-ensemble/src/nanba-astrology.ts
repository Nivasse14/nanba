// Reuses Nanba app's indian-astrology.js Lahiri model, with WhatsApp onboarding.
import * as A from "astronomy-engine";
import type { Row } from "./db.ts";
import type { Companion } from "./nanba-companion.ts";
import { check } from "./validation.ts";

const KEYS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];
const RASI = [
  "Mesha",
  "Vrishabha",
  "Mithuna",
  "Karka",
  "Simha",
  "Kanya",
  "Tula",
  "Vrischika",
  "Dhanu",
  "Makara",
  "Kumbha",
  "Meena",
];
const NAKSHATRA = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashirsha",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];
const TAMIL_RASI = [
  "மேஷம்",
  "ரிஷபம்",
  "மிதுனம்",
  "கடகம்",
  "சிம்மம்",
  "கன்னி",
  "துலாம்",
  "விருச்சிகம்",
  "தனுசு",
  "மகரம்",
  "கும்பம்",
  "மீனம்",
];
const TAMIL_NAKSHATRA = [
  "அசுவினி",
  "பரணி",
  "கார்த்திகை",
  "ரோகிணி",
  "மிருகசீரிடம்",
  "திருவாதிரை",
  "புனர்பூசம்",
  "பூசம்",
  "ஆயில்யம்",
  "மகம்",
  "பூரம்",
  "உத்திரம்",
  "அஸ்தம்",
  "சித்திரை",
  "சுவாதி",
  "விசாகம்",
  "அனுஷம்",
  "கேட்டை",
  "மூலம்",
  "பூராடம்",
  "உத்திராடம்",
  "திருவோணம்",
  "அவிட்டம்",
  "சதயம்",
  "பூரட்டாதி",
  "உத்திரட்டாதி",
  "ரேவதி",
];
const norm = (x: number) => ((x % 360) + 360) % 360;
// Standard Lahiri anchor (IAE 1985): 23°15′00.658″, JD TT 2435553.5.
// Astronomical frame rotations below are Astronomy Engine's MIT implementation,
// not Swiss Ephemeris code. ECT includes nutation; do not add it a second time.
// Reference: astro.com/swisseph/swisseph.htm, section 2.8.5.
const ANCHOR = A.AstroTime.FromTerrestrialTime(2435553.5 - 2451545);
const ANCHOR_DEGREES = 23 + 15 / 60 + 0.658 / 3600;
const MODEL = "nanba-lahiri-1956-astronomy-engine-v1";
export function ayanamsa(date: Date) {
  const time = A.MakeTime(date);
  const equinox = new A.Vector(1, 0, 0, time);
  const j2000 = A.RotateVector(A.Rotation_ECT_EQJ(time), equinox);
  const atAnchor = A.RotateVector(A.Rotation_EQJ_ECT(ANCHOR), j2000);
  return norm(ANCHOR_DEGREES - A.SphereFromVector(atAnchor).lon);
}
export function lunarPosition(date: Date) {
  const tropical = A.EclipticGeoMoon(date).lon;
  const longitude = norm(tropical - ayanamsa(date));
  const rasi = Math.floor(longitude / 30);
  const nakshatra = Math.floor(longitude / (40 / 3));
  const pada = (Math.floor(longitude / (10 / 3)) % 4) + 1;
  const margin = (size: number) =>
    Math.min(longitude % size, size - (longitude % size));
  return {
    longitude,
    rasi,
    signKey: KEYS[rasi],
    nakshatra,
    pada,
    // Conservative product guard, not a claimed bound on ephemeris error.
    nearBoundary: Math.min(margin(30), margin(40 / 3), margin(10 / 3)) < 0.05,
  };
}

// Preserve historical offsets (including seconds), reject gaps and repeated times.
export function birthInstant(
  date: string,
  time: string,
  zone: string,
  repeated = false,
) {
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time),
    "naissance_date_heure_invalide",
  );
  const wall = `${date}T${time}:00`,
    base = Date.parse(wall + "Z");
  check(
    Number.isFinite(base) && new Date(base).toISOString().slice(0, 19) === wall,
    "naissance_date_invalide",
  );
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const format = (ms: number) => {
    const p = Object.fromEntries(
      fmt.formatToParts(ms).map((x) => [x.type, x.value]),
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  const offsets = new Set(
    [-36, -12, 0, 12, 36].map((h) => {
      const t = base + h * 3600000;
      return Date.parse(format(t) + "Z") - t;
    }),
  );
  const hits = [...offsets]
    .map((o) => base - o)
    .filter((t) => format(t) === wall)
    .sort((a, b) => a - b);
  check(hits.length > 0, "naissance_heure_inexistante_changement_heure");
  check(
    repeated || hits.length === 1,
    "naissance_heure_ambigue_changement_heure",
  );
  return new Date(hits[0]);
}

function fields(moon: ReturnType<typeof lunarPosition>) {
  const margin = (size: number) =>
    Math.min(moon.longitude % size, size - (moon.longitude % size));
  return {
    rasi: margin(30) >= 0.05 ? RASI[moon.rasi] : null,
    nakshatram: margin(40 / 3) >= 0.05 ? NAKSHATRA[moon.nakshatra] : null,
    pada: margin(10 / 3) >= 0.05 ? moon.pada : null,
  };
}

export function calculateBirth(birth: Row): Row {
  const base = {
    model: MODEL,
    method: "Lahiri",
    rasi: null,
    nakshatram: null,
    pada: null,
  };
  if (!birth.date || !birth.place || !birth.time)
    return { ...base, status: "incomplete" };
  if (birth.time === "unknown") {
    try {
      const start = birthInstant(
        birth.date,
        "00:00",
        birth.place.timezone,
        true,
      );
      const nextDate = new Date(Date.parse(birth.date + "T12:00Z") + 86400000)
        .toISOString()
        .slice(0, 10);
      const end = birthInstant(nextDate, "00:00", birth.place.timezone, true);
      // Moon is prograde. Include both day boundaries, plus hourly samples;
      // keep only sectors that stay identical over the entire local birth day.
      const samples = [];
      for (let t = +start; t < +end; t += 3600000)
        samples.push(lunarPosition(new Date(t)));
      samples.push(lunarPosition(end));
      const values = samples.map(fields),
        stable: Row = {};
      for (const key of ["rasi", "nakshatram", "pada"])
        stable[key] = values.every(
          (v) => v[key as keyof typeof v] === values[0][key as keyof typeof v],
        )
          ? values[0][key as keyof (typeof values)[0]]
          : null;
      return {
        ...base,
        ...stable,
        status: "time-unknown",
        possibleRasi: [...new Set(samples.map((m) => RASI[m.rasi]))],
        note: "Heure inconnue : seuls les éléments stables sur toute la journée sont conservés. Les autres restent indéterminés.",
      };
    } catch {
      return {
        ...base,
        status: "time-unknown",
        note: "Heure inconnue et journée atypique dans ce fuseau : aucun signe natal précis annoncé.",
      };
    }
  }
  try {
    const instant = birthInstant(birth.date, birth.time, birth.place.timezone);
    const moon = lunarPosition(instant),
      f = fields(moon);
    if (birth.timeApproximate) {
      const samples = [-2, -1, 0, 1, 2].map((h) =>
        fields(lunarPosition(new Date(+instant + h * 3600000))),
      );
      for (const key of ["rasi", "nakshatram", "pada"] as const) {
        if (!samples.every((v) => v[key] === f[key])) (f as Row)[key] = null;
      }
      return {
        ...base,
        ...f,
        status: "time-approximate",
        uncertaintyHours: 2,
        note: "Heure approximative : seuls les éléments stables sur une marge de deux heures avant et après sont retenus ; cela ne couvre pas une incertitude plus grande.",
      };
    }
    const sun = A.SunPosition(instant).elon;
    return {
      ...base,
      ...f,
      status: moon.nearBoundary ? "boundary-review" : "ready",
      birthInstant: instant.toISOString(),
      sunRasi: RASI[Math.floor(norm(sun - ayanamsa(instant)) / 30)],
      westernSign: KEYS[Math.floor(norm(sun) / 30)],
      note: moon.nearBoundary
        ? "Proche d’une frontière : les éléments incertains ne sont pas attribués."
        : "Calcul à partir de la date, de l’heure locale et du lieu indiqués.",
    };
  } catch (e) {
    return {
      ...base,
      status: "time-review",
      reason: (e as Error).message,
      note: "Cette heure est ambiguë ou inexistante lors d’un changement d’heure. Vérifier l’heure déclarée ; ne pas en choisir une arbitrairement.",
    };
  }
}

const fold = (x: unknown) =>
  String(x || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const alias = (q: string) =>
  (
    ({
      pondicherry: "puducherry",
      pondichery: "puducherry",
      madras: "chennai",
    }) as Record<string, string>
  )[q] || q;

export class Horoscopes {
  c: Companion;
  constructor(c: Companion) {
    this.c = c;
  }
  save(identity: string, profile: Row) {
    this.c.db.run(
      "INSERT INTO nanba_profiles VALUES(?,?,?) ON CONFLICT(identity) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      identity,
      this.c.host.seal(JSON.stringify(profile)),
      this.c.now,
    );
  }
  async update(job: Row, args: Row) {
    const c = this.c,
      p = c.profile(job.identity),
      birth = { ...p.birth };
    if (Object.hasOwn(args, "birthDate")) {
      const date = args.birthDate;
      check(
        typeof date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Number.isFinite(Date.parse(date)) &&
          new Date(date).toISOString().slice(0, 10) === date &&
          date >= "1900-01-01" &&
          date <= new Date(c.now + 14 * 3600000).toISOString().slice(0, 10),
        "date_naissance_invalide_YYYY-MM-DD_pas_future",
      );
      birth.date = date;
    }
    if (Object.hasOwn(args, "birthTime")) {
      check(
        args.birthTime === "unknown" ||
          /^([01]\d|2[0-3]):[0-5]\d$/.test(args.birthTime),
        "heure_naissance_HH_mm_ou_unknown",
      );
      birth.time = args.birthTime;
    }
    if (Object.hasOwn(args, "birthTime"))
      birth.timeApproximate = args.birthTimeApproximate === true;
    if (Object.hasOwn(args, "birthTimeApproximate")) {
      check(
        typeof args.birthTimeApproximate === "boolean",
        "precision_heure_invalide",
      );
      birth.timeApproximate = args.birthTimeApproximate;
    }
    if (Object.hasOwn(args, "birthPlace")) {
      const q = String(args.birthPlace || "").trim();
      check(q.length >= 2 && q.length <= 100, "ville_naissance_requise");
      check(
        !args.birthCountry || /^[A-Z]{2}$/.test(args.birthCountry),
        "pays_naissance_code_ISO",
      );
      const response = await c.api(
        "/locations/birth-place?" + new URLSearchParams({ q, limit: "8" }),
      );
      check(c.host.currentJob(job), "conversation_cancelled", 409);
      const candidates = (Array.isArray(response.items) ? response.items : [])
        .filter((x: Row) => {
          try {
            if (
              !/^\d{1,12}$/.test(x.geonameId) ||
              typeof x.city !== "string" ||
              typeof x.label !== "string" ||
              x.label.length > 250 ||
              !Number.isFinite(x.latitude) ||
              Math.abs(x.latitude) > 90 ||
              !Number.isFinite(x.longitude) ||
              Math.abs(x.longitude) > 180 ||
              typeof x.timezone !== "string" ||
              !x.timezone
            )
              return false;
            new Intl.DateTimeFormat("en", { timeZone: x.timezone });
            return !args.birthCountry || args.birthCountry === x.countryCode;
          } catch {
            return false;
          }
        })
        .slice(0, 8)
        .map((x: Row) => ({
          geonameId: x.geonameId,
          city: x.city,
          label: x.label,
          countryCode: x.countryCode,
          latitude: x.latitude,
          longitude: x.longitude,
          timezone: x.timezone,
          source: "GeoNames via Nanba",
          sourceUrl: "https://www.geonames.org/",
          license: "CC BY 4.0",
        }));
      const matches = candidates.filter(
        (x: Row) =>
          alias(fold(q)) === fold(x.city) || fold(q) === fold(x.label),
      );
      const chosen = matches.length === 1 ? matches[0] : null;
      // A changed/ambiguous place invalidates the old natal result immediately.
      delete birth.place;
      birth.placeQuery = q;
      birth.candidates = { at: c.now, items: candidates };
      if (chosen) {
        birth.place = chosen;
        delete birth.candidates;
      }
    }
    if (args.birthPlaceId) {
      check(
        birth.candidates?.at > c.now - 3600000,
        "rechercher_a_nouveau_la_ville_de_naissance",
      );
      const chosen = birth.candidates.items.find(
        (x: Row) => x.geonameId === args.birthPlaceId,
      );
      check(chosen, "ville_non_proposee_pour_ce_numero");
      birth.place = chosen;
      delete birth.candidates;
    }
    check(c.host.currentJob(job), "conversation_cancelled", 409);
    const next: Row = {
      ...c.profile(job.identity),
      birth,
      birthAstrology: calculateBirth(birth),
    };
    delete next.rasi;
    delete next.nakshatram;
    if (next.birthAstrology.rasi) next.rasi = next.birthAstrology.rasi;
    if (next.birthAstrology.nakshatram)
      next.nakshatram = next.birthAstrology.nakshatram;
    this.save(job.identity, next);
    return {
      ...this.read(job.identity),
      saved: true,
      memory:
        "Données de naissance mémorisées uniquement pour ce numéro ; modifiables et effaçables sur demande.",
    };
  }
  forget(identity: string) {
    const p = this.c.profile(identity);
    for (const k of ["birth", "birthAstrology", "rasi", "nakshatram"])
      delete p[k];
    this.save(identity, p);
    return {
      message:
        "Données de naissance et signes astrologiques effacés de la mémoire de ce numéro.",
    };
  }
  read(identity: string): Row {
    const c = this.c,
      p = c.profile(identity),
      b = p.birth || {},
      natal = p.birthAstrology;
    const sky = this.daily(identity);
    const result: Row = {
      birth: b,
      natal: natal || null,
      daily: sky,
      interpretation:
        "Repères astronomiques et lecture culturelle facultative, pas de prédictions certaines. Ne pas inventer d’ascendant, de dashas, d’heure favorable ni de chance financière ou médicale.",
    };
    if (!b.date)
      result.nextQuestion =
        "Quelle est ta date de naissance (jour, mois et année) ?";
    else if (!b.place) {
      result.candidates =
        b.candidates?.items?.map((x: Row) => ({
          id: x.geonameId,
          label: x.label,
        })) || [];
      result.nextQuestion = result.candidates.length
        ? "Dans quelle ville et quel pays es-tu né(e) ? Fais préciser uniquement les lieux plausibles parmi les résultats, sans choisir à sa place."
        : "Dans quelle ville et quel pays es-tu né(e) ?";
    } else if (!b.time)
      result.nextQuestion =
        "Connais-tu ton heure de naissance ? Sinon, dis simplement « je ne sais pas ».";
    else if (natal?.status === "time-review")
      result.nextQuestion =
        "Peux-tu vérifier ton heure de naissance ? Elle tombe sur un changement d’heure ; si tu ne sais pas, on gardera l’heure inconnue.";
    result.instruction = result.nextQuestion
      ? "Pose uniquement la prochaine question, dans la langue de la personne. Ne demande jamais de connaître son Rasi/Nakshatra. N’invente aucune donnée manquante."
      : "Utilise seulement les signes déterminés par le calcul. Si l’heure est inconnue, l’expliquer une fois, ne pas la redemander. Réutiliser ce profil ensuite. Expliquer simplement le signe lunaire sans liste de jargon technique sauf demande.";
    return result;
  }
  daily(identity: string): Row {
    const p = this.c.profile(identity);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: p.timezone || "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(this.c.now);
    const instant = new Date(date + "T06:30:00Z"),
      moon = lunarPosition(instant);
    const waxing =
      norm(A.EclipticGeoMoon(instant).lon - A.SunPosition(instant).elon) < 180;
    const ta = p.language === "ta",
      en = ["en", "tanglish"].includes(p.language);
    const rasi = ta ? TAMIL_RASI[moon.rasi] : RASI[moon.rasi],
      nak = ta ? TAMIL_NAKSHATRA[moon.nakshatra] : NAKSHATRA[moon.nakshatra];
    const title = ta
      ? "இன்றைய வானியல் நிலை"
      : en
        ? "Today’s sky"
        : "Repères astrologiques du jour";
    const summary = ta
      ? `இந்திய நேரம் 12:00: சந்திரன் ${rasi} · ${nak}. ${waxing ? "வளர்பிறை" : "தேய்பிறை"}. தனிப்பட்ட எதிர்காலப் பலன் அல்ல.`
      : en
        ? `At noon in India: Moon in ${rasi} · ${nak}. ${waxing ? "Waxing" : "Waning"} Moon. Astronomical positions, not personal predictions.`
        : `À 12 h en Inde : Lune en ${rasi} · ${nak}. Lune ${waxing ? "croissante" : "décroissante"}. Repères astronomiques, sans prédictions personnelles.`;
    return {
      date,
      observedAt: instant.toISOString(),
      title,
      summary,
      moonSign: rasi,
      nakshatra: nak,
      waxing,
      model: MODEL,
      contentKind: "astronomical-facts",
      natalRasi: p.rasi || null,
    };
  }
}
