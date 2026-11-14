import type { Domain } from "./modules.ts";
import type { Context, Entity } from "./core.ts";
import type { Row } from "./db.ts";
import { field as f, DATE, type Field } from "./conversation-format.ts";

export type Form = {
  title: string;
  fields: Field[];
  kind?: string;
  action?: string;
  kinds?: string[];
  private?: boolean;
  roles?: string[];
  prepare?: (data: Row, target?: Entity) => Row;
  run?: (data: Row, target?: Entity) => Row;
  notice?: string;
};
const title = () =>
  f("title", "Titre", "Quel titre souhaites-tu donner ?", "text", { max: 160 });
const desc = () =>
  f(
    "description",
    "Description",
    "Décris la proposition (1500 caractères maximum).",
  );
const zone = () =>
  f("zone", "Ville", "Dans quelle ville ou zone ?", "text", { max: 120 });
const lang = () =>
  f("language", "Langue", "Quelle langue ? fr / en / ta / tanglish", "enum", {
    options: ["fr", "en", "ta", "tanglish"],
  });
const date = (key = "startsAt", label = "Début") =>
  f(key, label, `${label} : ${DATE}`, "date");
const num = (key: string, label: string, min = 1, max = 500) =>
  f(key, label, `${label} (de ${min} à ${max}) ?`, "integer", { min, max });
const money = (key = "price", label = "Prix") =>
  f(key, label, `${label} en euros (ex. 12,50 ; 0 si gratuit) ?`, "money");
const boolean = (key: string, label: string) =>
  f(key, label, `${label} ? Réponds oui ou non.`, "boolean");
const list = (key: string, label: string, optional = false) =>
  f(
    key,
    label,
    `${label} : sépare les éléments par des points-virgules.${optional ? " Écris passer si aucun." : ""}`,
    "list",
    { optional },
  );
const reason = () =>
  f("reason", "Motif", "Quel est le motif ?", "text", { max: 1000 });
const question = () => [
  f("prompt", "Question", "Quelle question veux-tu poser ?", "text", {
    max: 300,
  }),
  list("options", "Choix de réponse (au moins 2)"),
  num("answer", "Numéro de la bonne réponse", 1, 10),
  num("points", "Points pour cette question", 1, 100),
];
const slots = () =>
  f(
    "slots",
    "Disponibilités",
    `Indique tes disponibilités, une plage par ligne : début | fin. Format de chaque date : ${DATE}`,
    "slots",
  );

export function forms(a: Domain, c: Context): Record<string, Form> {
  return {
    "rencontre creer": {
      title: "Créer une rencontre",
      kind: "meetup",
      private: true,
      roles: ["organizer", "group_admin"],
      fields: [
        title(),
        desc(),
        f("activity", "Activité", "Quel type d’activité ?", "text", {
          max: 60,
        }),
        zone(),
        f("place", "Lieu public", "Quel lieu public annoncer ?", "text", {
          max: 200,
        }),
        lang(),
        f(
          "format",
          "Public",
          "Pour qui ? solo / couple / family / all",
          "enum",
          { options: ["solo", "couple", "family", "all"] },
        ),
        date(),
        num("capacity", "Nombre de places", 2, 30),
        f(
          "coordination",
          "Coordination privée",
          "Quelles consignes seront réservées aux inscrits confirmés ?",
          "text",
          { max: 500 },
        ),
      ],
    },
    "logement creer": {
      title: "Recherche privée de logement",
      kind: "housing",
      private: true,
      fields: [
        title(),
        zone(),
        money("budget", "Budget mensuel maximum"),
        f(
          "moveDate",
          "Date d’entrée",
          "Date d’entrée souhaitée : JJ/MM/AAAA",
          "day",
        ),
        f("duration", "Durée", "Pour quelle durée ?", "text", { max: 100 }),
        f(
          "criteria",
          "Critères",
          "Quels sont tes critères ? Ne transmets pas de pièce d’identité ni de dossier financier.",
        ),
      ],
      prepare: (d) => ({ ...d, sharedWith: [] }),
      notice:
        "La recherche reste privée. Tu choisiras ensuite les professionnels autorisés avec « Nanba logement partager CODE ».",
    },
    "logement partager": {
      title: "Choisir les professionnels autorisés",
      action: "consent",
      kinds: ["housing"],
      private: true,
      fields: [
        list(
          "sharedWith",
          "Identifiants des professionnels (voir Nanba professionnels)",
          true,
        ),
      ],
      notice:
        "Cette liste remplace les autorisations précédentes. « passer » révoque tous les partages.",
    },
    "logement proposer": {
      title: "Proposition professionnelle de logement",
      kind: "housing_offer",
      kinds: ["housing"],
      private: true,
      roles: ["professional"],
      fields: [
        title(),
        f(
          "listingRef",
          "Référence",
          "Quelle est la référence de l’annonce ?",
          "text",
          { max: 300 },
        ),
        f("source", "Source", "Lien HTTPS vers l’annonce ?", "url"),
        desc(),
        money(),
        f(
          "confirmedAt",
          "Disponibilité vérifiée",
          "Quand as-tu réellement vérifié la disponibilité ? « maintenant » ou " +
            DATE,
          "past",
        ),
      ],
      prepare: (d, r) => ({ ...d, requestId: r!.id }),
    },
    "offre creer": {
      title: "Créer une offre collective",
      kind: "offer",
      kinds: ["request"],
      private: true,
      roles: ["professional"],
      fields: [
        title(),
        desc(),
        f("provider", "Partenaire", "Nom du partenaire ?", "text", {
          max: 160,
        }),
        f("place", "Lieu", "Où aura lieu l’activité ?", "text", { max: 300 }),
        date(),
        money(),
        num("capacity", "Nombre de places"),
        f(
          "terms",
          "Conditions",
          "Précise les conditions et la politique d’annulation.",
        ),
        date("deadline", "Fin des inscriptions"),
        boolean("sponsored", "Offre sponsorisée"),
      ],
      prepare: (d, r) => ({ ...d, requestId: r!.id }),
      notice:
        "L’offre sera enregistrée en brouillon. Son auteur devra la confirmer avant toute inscription.",
    },
    "offre modifier": {
      title: "Modifier les conditions de l’offre",
      action: "revise",
      kinds: ["offer"],
      private: true,
      fields: [
        money(),
        date(),
        f("terms", "Conditions", "Quelles sont les nouvelles conditions ?"),
      ],
      notice:
        "L’offre repasse en brouillon et les inscrits devront accepter la nouvelle version.",
    },
    "entraide creer": {
      title: "Demander une entraide",
      kind: "help",
      private: true,
      fields: [
        title(),
        f(
          "theme",
          "Thème",
          "Compétence recherchée (ex. français, informatique) ?",
          "text",
          { max: 60 },
        ),
        f(
          "outcome",
          "Objectif",
          "Quel résultat souhaites-tu obtenir ? Sans donnée personnelle sensible.",
          "text",
          { max: 1000 },
        ),
        lang(),
        date(),
        num("duration", "Durée en minutes", 5, 60),
      ],
      notice:
        "La demande ouverte est visible aux membres du groupe. Elle ne devient un rendez-vous qu’après l’accord des deux personnes.",
    },
    "benevole creer": {
      title: "Devenir bénévole",
      kind: "volunteer",
      private: true,
      fields: [
        list("skills", "Compétences"),
        list("languages", "Langues : fr, en, ta ou tanglish"),
        num("maxDuration", "Durée maximum en minutes", 5, 60),
        num("maxPerWeek", "Maximum d’aides par semaine", 1, 10),
        slots(),
        boolean("notifications", "Autoriser les notifications"),
      ],
      notice:
        "Ton profil actif et tes disponibilités seront visibles dans le groupe.",
    },
    "benevole disponibilites": {
      title: "Modifier mes disponibilités",
      action: "update",
      kinds: ["volunteer"],
      private: true,
      fields: [
        slots(),
        boolean("notifications", "Autoriser les notifications"),
      ],
    },
    "radar signaler": {
      title: "Signaler une information terrain",
      kind: "radar",
      fields: [
        title(),
        desc(),
        f(
          "category",
          "Catégorie",
          "Catégorie : product (produit), hours (horaires), event (événement), other (autre)",
          "enum",
          { options: ["product", "hours", "event", "other"] },
        ),
        f("place", "Lieu", "Quel lieu ou commerce ?", "text", { max: 200 }),
        zone(),
        f(
          "observedAt",
          "Observation",
          "Quand l’as-tu observé ? « maintenant » ou " + DATE,
          "past",
        ),
        f("evidence", "Preuve", "Lien HTTPS de provenance, ou passer.", "url", {
          optional: true,
        }),
      ],
      notice:
        "L’information sera en attente de modération. Sa durée de validité dépend de sa catégorie.",
    },
    "radar confirmer": {
      title: "Reconfirmer une information",
      action: "confirm",
      kinds: ["radar"],
      roles: ["group_admin"],
      fields: [
        f("evidence", "Preuve", "Lien HTTPS de confirmation ?", "url"),
        f(
          "confirmation",
          "Provenance",
          "Confirmation organizer (organisateur) ou official (officielle) ?",
          "enum",
          { options: ["organizer", "official"] },
        ),
        num("hours", "Validité en heures", 1, 720),
      ],
    },
    "radar corriger": {
      title: "Corriger une information",
      action: "correct",
      kinds: ["radar"],
      roles: ["group_admin"],
      fields: [desc()],
    },
    "parcours creer": {
      title: "Créer un parcours nouveaux arrivants",
      kind: "cohort",
      roles: ["organizer", "group_admin"],
      fields: [
        title(),
        zone(),
        f(
          "period",
          "Période",
          "Quelle période concerne ce parcours ?",
          "text",
          { max: 120 },
        ),
        list("themes", "Thèmes"),
        list("steps", "Étapes à accomplir"),
        f(
          "resources",
          "Ressources vérifiées",
          "Une ressource réellement vérifiée par ligne : titre | lien HTTPS. Ou passer.",
          "resources",
          { optional: true },
        ),
        num("capacity", "Nombre de places", 1, 200),
      ],
      prepare: (d) => ({ ...d, resources: d.resources || [] }),
    },
    "defi creer": {
      title: "Créer un défi entre villes",
      kind: "challenge",
      private: true,
      roles: ["group_admin"],
      fields: [
        title(),
        desc(),
        list("teams", "Villes ou équipes (au moins 2)"),
        date("deadline", "Fin du défi"),
        list("sources", "Sources HTTPS vérifiées"),
        ...question(),
      ],
      prepare: (d) => ({
        ...d,
        questions: [
          {
            prompt: d.prompt,
            options: d.options,
            answer: d.answer - 1,
            points: d.points,
          },
        ],
      }),
      notice:
        "Le défi reste en brouillon. Tu peux ajouter des questions puis le valider pour ouvrir les inscriptions.",
    },
    "defi question": {
      title: "Ajouter une question au défi",
      action: "add_question",
      kinds: ["challenge"],
      private: true,
      roles: ["group_admin"],
      fields: question(),
      prepare: (d) => ({ ...d, answer: d.answer - 1 }),
    },
    "defi corriger": {
      title: "Corriger un résultat de défi",
      action: "correct",
      kinds: ["challenge"],
      private: true,
      roles: ["group_admin"],
      fields: [
        num("question", "Numéro de la question", 1, 20),
        num("answer", "Numéro de la bonne réponse", 1, 10),
        reason(),
      ],
      prepare: (d) => ({
        ...d,
        question: d.question - 1,
        answer: d.answer - 1,
      }),
    },
    "histoire creer": {
      title: "Raconter une histoire",
      kind: "story",
      private: true,
      fields: [
        title(),
        f(
          "original",
          "Texte original",
          "Raconte ton histoire (1500 caractères maximum).",
        ),
        lang(),
        f(
          "translationLanguage",
          "Langue de traduction",
          "Langue de traduction : fr / en / ta",
          "enum",
          { options: ["fr", "en", "ta"] },
        ),
        f(
          "translation",
          "Traduction",
          "Écris la traduction relue, ou passer pour la compléter plus tard. Traduction automatique non connectée.",
          "text",
          { optional: true },
        ),
        f(
          "credit",
          "Signature",
          "Sous quel nom ou pseudonyme veux-tu signer ?",
          "text",
          { max: 100 },
        ),
        f(
          "storyType",
          "Type",
          "personal (souvenir personnel) ou verified_history (histoire documentée) ?",
          "enum",
          { options: ["personal", "verified_history"] },
        ),
      ],
      notice:
        "Le récit reste privé en brouillon. Aucune diffusion sans ton accord sur le texte et les canaux.",
    },
    "histoire modifier": {
      title: "Modifier mon histoire",
      action: "edit",
      kinds: ["story"],
      private: true,
      fields: [
        title(),
        f("original", "Texte original", "Nouveau texte original ?"),
        f(
          "translation",
          "Traduction",
          "Nouvelle traduction, ou passer.",
          "text",
          { optional: true },
        ),
      ],
      notice:
        "La modification annule les accords et les publications en attente.",
    },
    "histoire approuver": {
      title: "Autoriser la publication de mon histoire",
      action: "approve",
      kinds: ["story"],
      private: true,
      fields: [
        boolean(
          "rightsConfirmed",
          "Confirmer disposer des droits et accords nécessaires",
        ),
        boolean("translationReviewed", "Confirmer avoir relu la traduction"),
        f(
          "audience",
          "Canaux autorisés",
          "1 : Nanba uniquement ; 2 : Nanba et ce groupe WhatsApp",
          "enum",
          { options: ["Nanba uniquement", "Nanba et WhatsApp"] },
        ),
        f(
          "source",
          "Source historique",
          "Pour une histoire documentée : lien HTTPS de la source. Sinon passer.",
          "url",
          { optional: true },
        ),
      ],
      prepare: (d) => ({
        ...d,
        audiences:
          d.audience === "Nanba et WhatsApp"
            ? ["nanba", "whatsapp"]
            : ["nanba"],
        source: d.source || null,
      }),
      notice:
        "L’accord concerne cette version précise. Un administrateur devra ensuite valider sa publication.",
    },
    contester: {
      title: "Contester une information ou un résultat",
      action: "dispute",
      kinds: ["radar", "challenge"],
      private: true,
      fields: [reason()],
    },
    avis: {
      title: "Donner mon avis après une activité",
      action: "feedback",
      kinds: ["help", "offer", "meetup"],
      private: true,
      fields: [
        num("rating", "Note", 1, 5),
        f("comment", "Commentaire", "Ton commentaire, ou passer.", "text", {
          optional: true,
          max: 1000,
        }),
      ],
    },
    "source creer": {
      title: "Configurer une source",
      kind: "source",
      private: true,
      roles: ["group_admin"],
      fields: [
        title(),
        f("url", "Flux", "Lien HTTPS du flux JSON ou RSS ?", "url"),
        f("publisher", "Éditeur", "Nom de l’éditeur ?", "text", { max: 160 }),
        f("format", "Format", "json ou rss ?", "enum", {
          options: ["json", "rss"],
        }),
        f(
          "category",
          "Catégorie",
          "culture / events / administrative / other",
          "enum",
          { options: ["culture", "events", "administrative", "other"] },
        ),
        zone(),
        f("language", "Langue", "fr / en / ta", "enum", {
          options: ["fr", "en", "ta"],
        }),
        num("frequencyHours", "Fréquence de collecte en heures", 1, 720),
        num("freshnessHours", "Validité des informations en heures", 1, 8760),
        boolean("official", "Source officielle"),
      ],
      notice:
        "Le collecteur tentera de lire ce flux. Les documents collectés resteront à vérifier avant leur utilisation.",
    },
    "document creer": {
      title: "Ajouter une connaissance sourcée",
      kind: "document",
      private: true,
      roles: ["group_admin"],
      fields: [
        title(),
        f("url", "Source", "Lien HTTPS de la source ?", "url"),
        f("publisher", "Éditeur", "Qui publie cette information ?", "text", {
          max: 160,
        }),
        f(
          "excerpt",
          "Information",
          "Résumé factuel de la source (2500 caractères maximum) ?",
          "text",
          { max: 2500 },
        ),
        zone(),
        f("language", "Langue", "fr / en / ta", "enum", {
          options: ["fr", "en", "ta"],
        }),
        f(
          "category",
          "Catégorie",
          "culture / events / administrative / other",
          "enum",
          { options: ["culture", "events", "administrative", "other"] },
        ),
        date("expiresAt", "Expiration"),
        boolean("official", "Source officielle"),
      ],
      notice: "Le document reste en attente de vérification.",
    },
    profil: {
      title: "Mon nom dans Nanba",
      private: true,
      fields: [
        f(
          "name",
          "Nom ou pseudonyme",
          "Quel nom ou pseudonyme utiliser ?",
          "text",
          { max: 120 },
        ),
      ],
      run: (d) => {
        a.db.run("UPDATE users SET name=? WHERE id=?", d.name, c.userId);
        a.audit(c, "profile.name_updated");
        return { saved: true };
      },
    },
  };
}
