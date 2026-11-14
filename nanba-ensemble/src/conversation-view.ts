import type { Domain } from "./modules.ts";
import type { Context, Entity } from "./core.ts";
import { codeOf, when, euros } from "./conversation-format.ts";
import type { Row } from "./db.ts";

export const MAIN_MENU = `Vanakkam 👋 Nanba Ensemble\nChoisis un module :\n1 · Collectif — Nanba collectif\n2 · Rencontres — Nanba rencontres\n3 · Logement — Nanba logement\n4 · Entraide — Nanba entraide\n5 · Radar terrain — Nanba radar\n6 · Nouveaux arrivants — Nanba arrivée\n7 · Défis — Nanba défis\n8 · Histoires — Nanba histoires\n\nNanba mes dossiers / inscriptions / professionnels / profil\nNanba privé : accéder aux parcours confidentiels\nNanba groupes : choisir la communauté en message privé\nNanba préférences : langue et consentements\nNanba partager CODE : publication dans le groupe (admin)\nNanba admin : gestion selon tes droits\nNanba rechercher SUJET : sources validées déjà enregistrées\n\nCommence chaque message par « Nanba ». Je suis un assistant guidé, sans modèle IA connecté. Aucun paiement externe. Un vote exprime un intérêt ; les votes ne sont pas anonymes pour Nanba.`;
export const MENUS: Record<string, string> = {
  collectif:
    "Demandes collectives\nNanba proposer MON IDÉE\nNanba demandes / offres\nNanba voir CODE\nNanba intérêt CODE / désintérêt CODE\nNanba sondage CODE (admin)\nNanba résultats CODE\nNanba offre créer CODE_DEMANDE (professionnel)\nNanba offre confirmer CODE / offre modifier CODE\nNanba inscrire CODE_OFFRE / quitter CODE_OFFRE",
  rencontres:
    "Rencontres\nNanba rencontre créer (organisateur)\nNanba rencontres liste\nNanba chercher rencontre\nNanba voir CODE / inscrire CODE / quitter CODE\nNanba terminer CODE / supprimer CODE (organisateur)\nNanba avis CODE après l’activité",
  logement:
    "Logement privé\nNanba logement créer\nNanba logements / propositions logement\nNanba professionnels\nNanba logement partager CODE (remplace les autorisations)\nNanba logement suspendre CODE / logement reprendre CODE / logement trouvé CODE\nNanba logement proposer CODE_DEMANDE (professionnel autorisé)\nNanba logement intérêt CODE_OFFRE / logement contact CODE_OFFRE\nNanba logement reconfirmer CODE_OFFRE (professionnel)\nNanba voir CODE\nAucun dossier ni renseignement personnel dans un groupe.",
  entraide:
    "Entraide\nNanba entraide créer\nNanba entraide liste / bénévoles\nNanba bénévole créer / bénévole disponibilités CODE\nNanba bénévole pause CODE / bénévole reprendre CODE\nNanba aider CODE / accepter CODE / refuser CODE\nNanba voir CODE / supprimer CODE / terminer CODE\nNanba avis CODE après l’aide",
  radar:
    "Radar terrain\nNanba radar signaler\nNanba radar liste / voir CODE\nNanba contester CODE\nModération : Nanba radar publier CODE / radar confirmer CODE / radar corriger CODE / radar retirer CODE",
  arrivee:
    "Nouveaux arrivants\nNanba parcours créer (organisateur)\nNanba parcours / voir CODE\nNanba inscrire CODE / quitter CODE\nNanba progression CODE\nNanba étape CODE / ressource CODE / activité CODE / mentor CODE\nLa progression reste privée.",
  defis:
    "Défis entre villes\nNanba défis liste / voir CODE\nNanba défi rejoindre CODE / défi répondre CODE\nNanba résultats CODE / contester CODE\nAdmin : Nanba défi créer / défi question CODE / défi valider CODE / défi ouvrir CODE / défi clôturer CODE / défi corriger CODE",
  histoires:
    "Histoires familiales\nNanba histoire créer / mes histoires\nNanba voir CODE / histoire modifier CODE\nNanba histoire approuver CODE / histoire retirer CODE\nAdmin : Nanba histoire publier CODE / histoire partager CODE\nLes brouillons et traductions sont privés. Les deux textes sont saisis manuellement puis relus par leur auteur.",
};
export function detail(a: Domain, c: Context, r: Entity): string {
  const d = a.present(c, r).data;
  const head = `${d.title} · ${codeOf(r)}\nÉtat : ${r.status} · version ${r.version}`;
  const enrollment = d.enrollment
    ? `\nTon inscription : ${{ confirmed: "confirmée", waitlisted: "liste d’attente", offered: "place proposée — à accepter", reconfirm: "nouvelles conditions à accepter", cancelled: "annulée", completed: "terminée" }[d.enrollment.status as string] ?? d.enrollment.status} · ${d.enrollment.seats} place(s)${d.enrollment.offered_until ? " · jusqu’au " + when(d.enrollment.offered_until) : ""}`
    : "";
  switch (r.kind) {
    case "request":
      return `${head}\n${d.description}\n${d.zone} · ${d.slots}\nBudget : ${d.budget == null ? "non renseigné" : euros(d.budget)}\nIntérêts : ${d.counts.total}/${d.threshold} · jusqu’au ${when(d.deadline)}\nOffres : ${d.offers.map((o: Row) => `${o.data.title} (${codeOf(o)})`).join(", ") || "aucune"}\nNanba intérêt ${codeOf(r)} / résultats ${codeOf(r)}`;
    case "offer":
      return `${head}\n${d.description}\nPartenaire : ${d.provider}${d.sponsored ? " · sponsorisé" : ""}\n${d.place} · ${when(d.startsAt)}\nPrix : ${euros(d.price)} · ${d.remaining} place(s) restante(s)\nConditions : ${d.terms}\nFin des inscriptions : ${when(d.deadline)}${enrollment}\nNanba inscrire ${codeOf(r)} / quitter ${codeOf(r)}\nL’inscription Nanba n’est pas un paiement ni un billet d’un fournisseur externe.`;
    case "meetup":
      return `${head}\n${d.description}\n${d.zone} · ${d.place}\n${when(d.startsAt)} · ${d.language} · ${d.format}\n${d.remaining} place(s) restante(s)${enrollment}\nCoordination : ${d.coordination ?? "réservée aux inscrits confirmés"}\nNanba inscrire ${codeOf(r)} / quitter ${codeOf(r)}`;
    case "housing":
      return `${head}\n${d.zone} · budget ${euros(d.budget)}/mois\nEntrée : ${when(d.moveDate)} · ${d.duration}\n${d.criteria}\nPartage autorisé : ${d.sharedWith.map((id: string) => a.db.get("SELECT name FROM organizations WHERE id=?", id)?.name ?? id).join(", ") || "aucun professionnel"}\nNanba logement partager ${codeOf(r)} / propositions logement`;
    case "housing_offer":
      return `${head}\n${d.description}\n${euros(d.price)} · référence ${d.listingRef}\nSource : ${d.source}\nDisponibilité vérifiée le ${when(d.confirmedAt)}${d.stale ? " — PÉRIMÉE, demander une reconfirmation" : ""}\nIntérêt : ${d.interested ? "oui" : "non"} · contact demandé : ${d.contactRequested ? "oui" : "non"}\nNanba logement contact ${codeOf(r)}\nUne demande de contact ne constitue pas une réservation.`;
    case "volunteer":
      return `${head}\nCompétences : ${d.skills.join(", ")}\nLangues : ${d.languages.join(", ")}\n${d.maxDuration} min maximum · ${d.maxPerWeek} aide(s)/semaine\n${d.slots.map((s: Row) => `${when(s.start)} → ${when(s.end)}`).join("\n")}`;
    case "help":
      return `${head}\n${d.theme} · ${d.language}\nObjectif : ${d.outcome}\n${when(d.startsAt)} · ${d.duration} min\nAccord bénévole : ${d.volunteerAccepted ? "oui" : "non"} · accord demandeur : ${d.requesterAccepted ? "oui" : "non"}\nNanba aider ${codeOf(r)} / accepter ${codeOf(r)} / refuser ${codeOf(r)}`;
    case "radar":
      return `${head}\n${d.description}\n${d.place} · ${d.zone}\nObservation : ${when(d.observedAt)}\nProvenance : ${d.confirmation}\nPreuve : ${d.evidence || "témoignage sans lien"}\nExpiration : ${when(d.expiresAt)}${d.expired ? " — INFORMATION PÉRIMÉE" : ""}\nNanba contester ${codeOf(r)}`;
    case "cohort":
      return `${head}\n${d.zone} · ${d.period}\nThèmes : ${d.themes.join(", ")}\nÉtapes :\n${d.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\nRessources :\n${d.resources.map((x: Row, i: number) => `${i + 1}. ${x.title} — ${x.url} (vérifiée le ${when(x.verifiedAt)})`).join("\n") || "aucune"}${enrollment}\nNanba progression ${codeOf(r)} / étape ${codeOf(r)} / mentor ${codeOf(r)}`;
    case "challenge":
      return `${head}\n${d.description}\nÉquipes : ${d.teams.join(", ")}\nFin : ${when(d.deadline)}\nRègle : ${d.rule}\n${d.questions.length} question(s)\nSources : ${d.sources.join(", ")}\nTon équipe : ${d.entry?.team ?? "non inscrit"}\nNanba défi rejoindre ${codeOf(r)} / défi répondre ${codeOf(r)} / résultats ${codeOf(r)}`;
    case "story":
      return `${head}\n${d.original}\n\nTraduction (${d.translationLanguage}) :\n${d.translation || "à compléter"}\n— ${d.credit}\nCanaux autorisés : ${d.audiences.join(", ") || "aucun"}\n${r.owner_id === c.userId ? "Nanba histoire approuver " + codeOf(r) + " / histoire retirer " + codeOf(r) : ""}`;
    default:
      return `${head}\n${d.excerpt ?? d.description ?? ""}${d.url ? "\n" + d.url : ""}`;
  }
}

// Deliberately separate from the personalized detail view: no enrollment,
// coordination, progress, quiz solution or private request can be broadcast.
export function publicActivity(a: Domain, r: Entity): string {
  const d = r.data,
    code = codeOf(r);
  const footer = `\n\nÉcris à Nanba en privé : Nanba voir ${code}.\nNanba inscrire ${code} pour les rencontres, offres et parcours.`;
  const head = `🤝 Nanba · ${d.title}\n`;
  switch (r.kind) {
    case "offer":
      return (
        head +
        `${d.description}\n${d.provider}${d.sponsored ? " · sponsorisé" : ""}\n${d.place} · ${when(d.startsAt)}\n${euros(d.price)} · conditions : ${d.terms}\nFin des inscriptions : ${when(d.deadline)}. Aucun paiement ni billet externe.` +
        footer
      );
    case "meetup":
      return (
        head +
        `${d.description}\n${d.zone} · ${d.place}\n${when(d.startsAt)} · ${d.language} · capacité ${d.capacity}.` +
        footer
      );
    case "cohort":
      return (
        head +
        `${d.zone} · ${d.period}\nThèmes : ${d.themes.join(", ")}\n${d.steps.length} étapes · capacité ${d.capacity}.` +
        footer
      );
    case "radar":
      return (
        head +
        `${d.description}\n${d.place} · ${d.zone}\nObservé le ${when(d.observedAt)}, provenance ${d.confirmation}.\n${d.evidence ?? "Témoignage sans lien de preuve"}\nValable jusqu’au ${when(d.expiresAt)}.\nNanba voir ${code} / contester ${code} en privé.`
      );
    case "challenge":
      return (
        head +
        (r.status === "closed"
          ? a
              .leaderboard({ userId: r.owner_id, groupId: r.group_id }, r.id)
              .map(
                (x: Row) =>
                  `${x.team} : ${x.score.toFixed(2)} points/membre (${x.participants} inscrits)`,
              )
              .join("\n")
          : `${d.description}\nÉquipes : ${d.teams.join(", ")}\nFin : ${when(d.deadline)}\n${d.rule}`) +
        `\nEn privé : Nanba défi rejoindre ${code} / défi répondre ${code} / résultats ${code}.`
      );
    default:
      throw new Error("private_content_not_publishable");
  }
}
