import type { Domain } from "./modules.ts";
import { passwordHash } from "./auth.ts";
import { json } from "./db.ts";
export const DEMO_PASSWORD = "Nanba-demo-2026!";
export function seed(a: Domain) {
  const d = a.db;
  if (d.get("SELECT 1 FROM settings WHERE key='demo'")) return;
  if (d.get("SELECT 1 FROM users LIMIT 1")) return;
  const n = a.now();
  d.tx(() => {
    d.run(
      "INSERT INTO communities VALUES('india-france','Communauté pilote · données fictives')",
    );
    d.run(
      "INSERT INTO organizations VALUES('atelier','Atelier & Habitat — démonstration',1,'pilot')",
    );
    d.run(
      "INSERT INTO organizations VALUES('other-org','Autre partenaire — démonstration',1,'pilot')",
    );
    d.run(
      "INSERT INTO groups VALUES('paris','india-france','Paris & Île-de-France','Île-de-France','120363000001@g.us',1,0,'{}')",
    );
    d.run(
      "INSERT INTO groups VALUES('lyon','india-france','Lyon & alentours','Lyon','120363000002@g.us',1,0,'{}')",
    );
    const people = [
      ["admin", "Leïla", "admin@demo.nanba", 1, null, "group_admin"],
      ["member", "Anjali", "member@demo.nanba", 0, null, "member"],
      ["organizer", "Arun", "organizer@demo.nanba", 0, null, "organizer"],
      ["pro", "Maya", "pro@demo.nanba", 0, "atelier", "professional"],
      [
        "otherpro",
        "Sam",
        "otherpro@demo.nanba",
        0,
        "other-org",
        "professional",
      ],
      ["member2", "Jules", "member2@demo.nanba", 0, null, "member"],
      ["member3", "Priya", "member3@demo.nanba", 0, null, "member"],
      ["outsider", "Alex", "lyon@demo.nanba", 0, null, "member"],
    ];
    const password = passwordHash(DEMO_PASSWORD);
    for (const [id, name, email, platform, org, role] of people) {
      d.run(
        "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)",
        id,
        email,
        name,
        password,
        platform,
        org,
        json({
          language: "fr",
          zone: "Île-de-France",
          notifications: false,
          commercial: false,
          visibility: false,
          format: "solo",
        }),
        0,
        n,
      );
      d.run(
        "INSERT INTO memberships VALUES(?,?,?,1)",
        id,
        id === "outsider" ? "lyon" : "paris",
        role,
      );
    }
    d.run("INSERT INTO settings VALUES('demo','true')");
  });
  const member = { userId: "member", groupId: "paris" },
    admin = { userId: "admin", groupId: "paris" },
    organizer = { userId: "organizer", groupId: "paris" },
    pro = { userId: "pro", groupId: "paris" };
  const request = a.create(member, "request", {
    title: "Un atelier dosa, ça vous tente ?",
    description:
      "Apprendre ensemble, partager nos recettes et repartir avec de nouvelles idées. Proposition fictive pour explorer le parcours.",
    category: "Cuisine",
    zone: "Paris",
    language: "fr",
    slots: "Un samedi après-midi",
    budget: 2500,
    threshold: 6,
    deadline: n + 7 * 86400000,
  });
  for (const userId of ["member", "member2", "member3", "organizer"])
    a.action({ userId, groupId: "paris" }, request.id, "interest", {
      active: true,
    });
  a.create(organizer, "meetup", {
    title: "Un café, de nouvelles rencontres",
    description:
      "Un moment simple pour faire connaissance. Rencontre de démonstration, sans réservation réelle.",
    activity: "Café",
    zone: "Paris",
    place: "Paris 10e · lieu fictif",
    language: "fr",
    format: "all",
    startsAt: n + 4 * 86400000,
    capacity: 6,
    coordination: "Retrouvez Arun à l’entrée du café. Informations fictives.",
  });
  const home = a.create(member, "housing", {
    title: "Une chambre près du RER B",
    zone: "Sevran",
    budget: 55000,
    moveDate: n + 30 * 86400000,
    duration: "6 mois",
    criteria: "Meublé, transports accessibles. Recherche synthétique.",
    sharedWith: ["atelier"],
  });
  a.create(pro, "housing_offer", {
    title: "Chambre meublée · exemple",
    requestId: home.id,
    listingRef: "demo:chambre-1",
    source: "https://example.com/demo-logement",
    description:
      "Proposition entièrement fictive, sans logement réellement disponible.",
    price: 50000,
    confirmedAt: n - 10 * 86400000,
  });
  a.create(organizer, "volunteer", {
    skills: ["CV", "Conversation"],
    languages: ["fr", "en"],
    maxDuration: 20,
    maxPerWeek: 2,
    slots: [{ start: n + 3 * 86400000, end: n + 3 * 86400000 + 7200000 }],
    notifications: false,
  });
  a.create(member, "help", {
    title: "Un regard sur mon CV",
    theme: "CV",
    outcome:
      "Relire mon introduction et choisir les informations essentielles.",
    language: "fr",
    duration: 20,
    startsAt: n + 3 * 86400000,
  });
  const radar = a.create(member, "radar", {
    title: "Farine de riz repérée en boutique",
    description: "Exemple de signalement : à vérifier avant tout déplacement.",
    category: "product",
    place: "Épicerie fictive, Paris 10e",
    zone: "Paris",
    observedAt: n - 3600000,
  });
  a.action(admin, radar.id, "publish");
  a.create(organizer, "cohort", {
    title: "Mes premiers repères en France",
    zone: "Île-de-France",
    period: "Promotion de novembre",
    themes: ["Se repérer", "Rencontrer du monde", "Préparer un CV"],
    steps: [
      "Choisir mon quartier",
      "Trouver une activité",
      "Préparer ma candidature",
    ],
    resources: [
      {
        title: "Portail officiel des démarches",
        url: "https://www.service-public.gouv.fr/",
        verifiedAt: n,
      },
    ],
    capacity: 30,
  });
  const challenge = a.create(admin, "challenge", {
    title: "Paris × Lyon · les mots nous relient",
    description:
      "Défi de démonstration. Un point par bonne réponse, moyenne par membre inscrit.",
    teams: ["Paris", "Lyon"],
    questions: [
      {
        prompt: "Comment dit-on « bonjour » en anglais ?",
        options: ["Hello", "Goodbye", "Thanks"],
        answer: 0,
        points: 1,
      },
    ],
    deadline: n + 5 * 86400000,
    sources: ["https://dictionary.cambridge.org/dictionary/english/hello"],
  });
  a.action(admin, challenge.id, "verify", { verified: true });
  const story = a.create(member, "story", {
    title: "Le dimanche sentait la cardamome",
    original:
      "Chez nous, le dimanche commençait avec le bruit des tasses. Ma grand-mère préparait le thé, et chacun racontait sa semaine. Une petite habitude que j’ai emportée avec moi.",
    translation:
      "At home, Sunday began with the sound of cups. My grandmother made tea, and everyone shared stories from their week. A small tradition I brought with me.",
    language: "fr",
    translationLanguage: "en",
    credit: "Anjali · récit fictif",
    storyType: "personal",
  });
  a.action(member, story.id, "approve", {
    rightsConfirmed: true,
    translationReviewed: true,
    audiences: ["nanba"],
  });
  a.action(admin, story.id, "publish");
}
