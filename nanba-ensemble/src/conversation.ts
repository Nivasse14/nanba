import type { Domain } from "./modules.ts";
import type { Context, Entity } from "./core.ts";
import { uid, json, parse, type Row } from "./db.ts";
import { check, Problem, text } from "./validation.ts";
import { Knowledge } from "./knowledge.ts";
import { WhatsAppFlows } from "./conversation-flows.ts";
import { MAIN_MENU } from "./conversation-view.ts";
import { scopes, isPrivate } from "./private-chat.ts";

const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const conversational = (s: string) =>
  s
    .replace(/^\/?nanba\b[\s,:-]*/i, "")
    .replace(/^@\S+\s*/, "")
    .replace(/^\//, "")
    .trim();
const short = (r: Row) => r.id.slice(0, 8);
export class Conversation {
  app: Domain;
  constructor(app: Domain) {
    this.app = app;
  }
  enabled(group: Row) {
    return parse(group.settings).assistantEnabled === true;
  }
  handle(p: Row): boolean {
    const a = this.app,
      group = a.db.get("SELECT * FROM groups WHERE id=?", p.groupId)!;
    if (!this.enabled(group)) return false;
    const settings = parse(group.settings),
      content = conversational(p.body),
      command = normalized(content);
    const identity = a.db.get(
      "SELECT * FROM identities WHERE identity_hash=?",
      p.identityHash,
    )!;
    if (
      settings.privateChat &&
      (settings.privateIdentity !== p.identityHash ||
        settings.privateUser !== identity.user_id)
    )
      return true;
    let scopeGroupId = settings.privateChat ? settings.scopeGroupId : group.id;
    const service = a.db.get(
      "SELECT m.user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.active=1 AND u.deleted=0 AND (m.role='group_admin' OR u.platform_admin=1) ORDER BY u.platform_admin DESC LIMIT 1",
      p.groupId,
    );
    if (!service) return true;
    const actor = { userId: service.user_id, groupId: p.groupId };
    const rateKey = "conversation:" + p.groupId + ":" + p.identityHash;
    const rate = a.db.get("SELECT * FROM rate_limits WHERE key=?", rateKey);
    if (rate && rate.reset_at > a.now() && rate.count >= 15) return true;
    a.db.run(
      "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END",
      rateKey,
      a.now() + 60000,
      a.now(),
      a.now(),
    );
    if (
      ["reprendre", "admin reprendre"].includes(command) &&
      identity.user_id
    ) {
      try {
        a.admin({
          userId: identity.user_id,
          groupId: command === "reprendre" ? group.id : scopeGroupId,
        });
      } catch {
        return true;
      }
      a.db.run(
        "UPDATE groups SET paused=0 WHERE id=?",
        command === "reprendre" ? group.id : scopeGroupId,
      );
      group.paused = 0;
    }
    if (
      group.paused ||
      a.db.get("SELECT value FROM settings WHERE key='global_pause'")?.value ===
        "true"
    )
      return true;
    if (
      ["pause", "stop", "admin pause"].includes(command) &&
      identity.user_id
    ) {
      const target = command === "admin pause" ? scopeGroupId : group.id;
      try {
        a.admin({ userId: identity.user_id, groupId: target });
      } catch {
        return true;
      }
      a.db.run("UPDATE groups SET paused=1 WHERE id=?", target);
      a.db.run(
        "UPDATE outbox SET status='cancelled',error='group_paused',updated_at=? WHERE group_id=? AND status IN('pending','prepared')",
        a.now(),
        target,
      );
      a.audit(
        { userId: identity.user_id, groupId: target },
        "assistant.paused",
      );
      return true;
    }
    let refs: { id: string; version: number }[] = [];
    let reply: string;
    try {
      reply = a.db.tx(() => {
        if (
          settings.privateChat &&
          (command === "groupes" ||
            command.startsWith("groupe ") ||
            !scopeGroupId)
        ) {
          const available = scopes(a, identity.user_id);
          if (command.startsWith("groupe ")) {
            const choice = Number(command.split(/\s+/)[1]);
            check(
              Number.isInteger(choice) &&
                choice >= 1 &&
                choice <= available.length,
              "invalid_choice",
            );
            scopeGroupId = available[choice - 1].id;
            a.db.run(
              "UPDATE groups SET settings=? WHERE id=?",
              json({ ...settings, scopeGroupId }),
              group.id,
            );
            a.db.run(
              "DELETE FROM conversations WHERE group_id=? AND identity_hash=?",
              group.id,
              p.identityHash,
            );
            return (
              "Communauté sélectionnée : " +
              available[choice - 1].name +
              ". Nanba aide pour continuer."
            );
          }
          return available.length
            ? "Tes communautés :\n" +
                available.map((g, i) => `${i + 1}. ${g.name}`).join("\n") +
                "\nÉcris « Nanba groupe NUMÉRO »."
            : "Aucune communauté accessible. Rejoins un groupe autorisé pour continuer.";
        }
        if (command.startsWith("activer groupe "))
          return "Groupe autorisé pour Nanba. Les membres peuvent écrire Nanba rejoindre puis Nanba aide. Les démarches personnelles passent en message privé.";
        if (command === "groupes")
          return (
            "Tu utilises la communauté " +
            group.name +
            ". Pour changer de groupe, écris à Nanba en privé."
          );
        if (["rejoindre", "join"].includes(command)) {
          let userId = identity.user_id;
          if (!userId) {
            userId = uid();
            a.db.run(
              "INSERT INTO users VALUES(?,?,?,?,0,NULL,'{}',0,?)",
              userId,
              "whatsapp-" + userId + "@nanba.invalid",
              "Membre WhatsApp",
              "!whatsapp-only",
              a.now(),
            );
            a.db.run(
              "UPDATE identities SET user_id=?,verified_at=? WHERE identity_hash=?",
              userId,
              a.now(),
              p.identityHash,
            );
          }
          const membership = a.db.get(
            "SELECT active FROM memberships WHERE user_id=? AND group_id=?",
            userId,
            scopeGroupId,
          );
          check(!membership || membership.active, "membership_revoked", 403);
          a.db.run(
            "INSERT OR IGNORE INTO memberships VALUES(?,?,'member',1)",
            userId,
            scopeGroupId,
          );
          return "C’est enregistré : ton profil est lié à ce groupe. Les commandes adressées à Nanba sont conservées, les conversations ordinaires sont ignorées. Nanba aide pour les huit modules ; Nanba privé pour les démarches personnelles.";
        }
        if (
          [
            "",
            "aide",
            "help",
            "menu",
            "bonjour",
            "salut",
            "hello",
            "hi",
            "vanakkam",
          ].includes(command)
        )
          return (
            MAIN_MENU +
            (!identity.user_id
              ? "\nÉcris « Nanba rejoindre » pour participer."
              : "")
          );
        if (!identity.user_id)
          return "Écris d’abord « Nanba rejoindre » pour créer ton profil minimal dans ce groupe.";
        const c = { userId: identity.user_id, groupId: scopeGroupId };
        a.member(c);
        if (["reprendre", "admin reprendre"].includes(command))
          return "Les réponses sont réactivées. Nanba aide.";
        const flow = new WhatsAppFlows(a, c, p, group);
        const answer = flow.handle(content);
        refs = flow.refs;
        if (answer !== null) return answer;
        // Legacy collective wizard remains compatible with existing proposals.
        return this.respond(
          c,
          { ...p, conversationGroupId: group.id },
          content,
          command,
        );
      });
    } catch (e) {
      if (!(e instanceof Problem)) throw e;
      const errors: Record<string, string> = {
        private_chat_required:
          "Cette démarche doit se faire en privé. Écris « Nanba aide » directement au compte WhatsApp de Nanba, puis sélectionne ce groupe avec « Nanba groupes ». Tes informations ne seront pas publiées ici.",
        forbidden:
          "Cette action est réservée à un administrateur ou au rôle autorisé dans ce groupe.",
        owner_required: "Seul l’auteur peut effectuer cette action.",
        professional_required:
          "Cette action est réservée aux professionnels autorisés.",
        membership_revoked:
          "Ton accès a été retiré. Demande à un administrateur de le rétablir.",
        group_forbidden:
          "Tu n’as pas accès à cette communauté. Nanba groupes pour choisir un autre groupe autorisé.",
        not_found:
          "Je ne trouve pas ce code parmi les éléments auxquels tu as accès.",
        terms_changed:
          "Les conditions ont changé depuis le récapitulatif. Écris Nanba annuler puis recommence pour lire et accepter la nouvelle version.",
        record_code_required:
          "Ajoute le code de la fiche à la commande. Nanba mes dossiers pour retrouver tes codes.",
        unexpected_arguments:
          "Commence par la commande seule ; je te poserai les questions une à une.",
        date_format:
          "Utilise une date précise : JJ/MM/AAAA HH:mm, heure de Paris.",
        date_time_required:
          "Précise aussi l’heure : JJ/MM/AAAA HH:mm, heure de Paris.",
        date_ambiguous:
          "Cette heure est ambiguë lors du changement d’heure. Utilise une date ISO avec décalage, par exemple 2027-10-31T02:30+01:00.",
        date_in_past: "Cette date est déjà passée. Choisis une date future.",
        invalid_choice: "Choisis l’une des options proposées ou son numéro.",
        yes_no_required: "Réponds oui ou non.",
        results_not_final:
          "Le défi n’est pas encore clôturé. Les résultats seront disponibles après la clôture.",
        volunteer_profile_required:
          "Crée d’abord ton profil avec Nanba bénévole créer.",
        incompatible_availability:
          "Tes compétences, ta langue ou tes disponibilités ne correspondent pas à cette demande.",
        roster_frozen:
          "Tu devais rejoindre une équipe avant l’ouverture des réponses.",
        challenge_closed: "Les réponses à ce défi ne sont pas ouvertes.",
        join_required:
          "Inscris-toi d’abord à ce parcours avec Nanba inscrire CODE.",
        author_review_required:
          "L’auteur doit confirmer les droits et la relecture de la traduction.",
        translation_required:
          "Complète d’abord la traduction avec Nanba histoire modifier CODE.",
        invalid_threshold: "Indique un seuil entre 2 et 500 personnes.",
        interest_closed:
          "Cette demande est terminée ; aucun nouvel intérêt n’a été enregistré.",
        partner_already_assigned:
          "Ce membre est déjà rattaché à une organisation.",
        organization_required:
          "Rattache d’abord ce membre à une organisation avec Nanba admin partenaire.",
      };
      reply =
        errors[e.code] ??
        "Action non enregistrée : " +
          e.code +
          ". Corrige ta réponse ou écris Nanba annuler.";
      refs = [];
    }
    const chunks = reply.match(/[\s\S]{1,3500}/g) ?? [""];
    for (let i = 0; i < chunks.length; i++) {
      const r = a.createRecord(actor, "assistant_reply", "approved", {
        title: "Réponse automatique Nanba",
        text: "🤝 Nanba · " + chunks[i],
        replyTo: p.id,
        identityHash: p.identityHash,
        automatic: true,
        scopeGroupId,
        recordRefs: refs,
        privateResponse: isPrivate(group),
        replyChatId: group.chat_id,
      });
      a.enqueue(
        actor,
        r,
        "assistant",
        {},
        "assistant:" +
          p.provider +
          ":" +
          p.session +
          ":" +
          p.groupId +
          ":" +
          p.id +
          (i ? ":" + i : ""),
      );
    }
    return true;
  }
  find(c: Context, code: string, kinds?: string[]): Entity {
    check(/^[a-f0-9-]{8,36}$/i.test(code), "not_found", 404);
    const rows = this.app.db.all(
      "SELECT id FROM records WHERE group_id=? AND substr(id,1,?)=?",
      c.groupId,
      code.length,
      code.toLowerCase(),
    );
    const visible = rows
      .map((r) => this.app.raw(r.id))
      .filter(
        (r) => (!kinds || kinds.includes(r.kind)) && this.app.canRead(c, r),
      );
    check(visible.length === 1, "not_found", 404);
    return visible[0];
  }
  respond(c: Context, p: Row, content: string, command: string): string {
    const a = this.app;
    a.db.run("DELETE FROM conversations WHERE expires_at<=?", a.now());
    const saved = a.db.get(
      "SELECT state FROM conversations WHERE group_id=? AND identity_hash=?",
      p.conversationGroupId ?? c.groupId,
      p.identityHash,
    );
    const state = saved ? parse(saved.state) : null;
    const put = (s: Row) =>
      a.db.run(
        "INSERT INTO conversations VALUES(?,?,?,?) ON CONFLICT(group_id,identity_hash) DO UPDATE SET state=excluded.state,expires_at=excluded.expires_at",
        p.conversationGroupId ?? c.groupId,
        p.identityHash,
        json(s),
        a.now() + 86400000,
      );
    const clear = () =>
      a.db.run(
        "DELETE FROM conversations WHERE group_id=? AND identity_hash=?",
        p.conversationGroupId ?? c.groupId,
        p.identityHash,
      );
    if (["annuler", "cancel"].includes(command)) {
      clear();
      return "Préparation annulée. Aucune nouvelle demande n’a été créée.";
    }
    if (/^(proposer|propose)\b/.test(command)) {
      const title = content.replace(/^(proposer|propose)\s*/i, "").trim();
      put({ step: title ? "city" : "title", title: title.slice(0, 160) });
      return title
        ? "Dans quelle ville ? Réponds par exemple « Nanba Paris »."
        : "Quelle idée veux-tu proposer ? Réponds par exemple « Nanba une sortie à Disneyland ».";
    }
    if (state) {
      if (state.step === "title") {
        state.title = text(content, "title", 160);
        state.step = "city";
        put(state);
        return "Dans quelle ville ? Exemple : « Nanba Paris ».";
      }
      if (state.step === "city") {
        state.city = text(content, "zone", 120);
        state.step = "when";
        put(state);
        return "Pour quand ? Exemple : « Nanba dimanche prochain ». Le créneau restera à confirmer avec l’organisateur.";
      }
      if (state.step === "when") {
        state.when = text(content, "slots", 300);
        state.step = "threshold";
        put(state);
        return "À partir de combien de personnes ? Réponds « Nanba 3 » (minimum 2).";
      }
      if (state.step === "threshold") {
        const n = Number(content);
        check(Number.isInteger(n) && n >= 2 && n <= 500, "invalid_threshold");
        state.threshold = n;
        state.step = "confirm";
        put(state);
        return `Récapitulatif : ${state.title}\nVille : ${state.city}\nCréneau souhaité : ${state.when}\nSeuil : ${n} personnes\nBudget : non renseigné.\nÉcris « Nanba confirmer » pour enregistrer la proposition dans cette discussion, ou « Nanba annuler ». Ce n’est pas une réservation.`;
      }
      if (state.step === "confirm" && command === "confirmer") {
        const r = a.request(c, {
          title: state.title,
          description: state.title,
          zone: state.city,
          slots: state.when,
          threshold: state.threshold,
          budget: null,
          language: "fr",
          category: "Proposition WhatsApp",
          deadline: a.now() + 7 * 86400000,
        });
        clear();
        return `Proposition enregistrée : ${state.title}\nCode : ${short(r)}\nUn administrateur peut lancer le sondage avec « Nanba sondage ${short(r)} ». Écris « Nanba résultats ${short(r)} » pour suivre les intérêts. Aucune réservation ni aucun paiement.`;
      }
      return "Écris « Nanba confirmer » pour enregistrer cette proposition, ou « Nanba annuler ».";
    }
    const code = content.split(/\s+/)[1] ?? "";
    if (/^sondage\b/.test(command)) {
      a.admin(c);
      const r = this.find(c, code, ["request"]);
      a.publishPoll(c, r, {});
      return "Le sondage est placé dans la file d’envoi de cette discussion. Il apparaîtra ici après confirmation de WhatsApp. Un vote exprime un intérêt, pas une réservation.";
    }
    if (/^resultats\b/.test(command) && code) {
      const r = this.find(c, code, ["request"]),
        n = a.counts(r.id);
      return `${r.data.title} · ${short(r)}\n${n.total} intérêt(s), seuil ${r.data.threshold}.\n${n.verified} profil(s) liés, ${n.provisional} intérêt(s) WhatsApp non liés ; ${n.uncertain} vote(s) incertain(s).\n${n.total >= r.data.threshold ? "Seuil atteint : une offre doit encore être confirmée par un partenaire." : "Le seuil n’est pas encore atteint."}\nAucune réservation ni aucun paiement.`;
    }
    if (/^(interet|interesse)\b/.test(command)) {
      const r = this.find(c, code, ["request"]),
        n = a.interest(c, r, true);
      return `Ton intérêt est enregistré pour « ${r.data.title} » : ${n.total}/${r.data.threshold}. Ce n’est pas une réservation.`;
    }
    if (/^(logement|housing)\b/.test(command))
      return "Pour le logement, ne publie pas de dossier personnel dans un groupe. Les demandes sont privées et partagées uniquement avec les professionnels que tu autorises. Aucune offre de logement réelle n’est connectée à ce pilote ; je ne peux pas confirmer de disponibilité.";
    if (/^(rechercher|recherche|search)\b/.test(command)) {
      const query = content.replace(/^\S+\s*/, "");
      check(query, "invalid_query");
      const hits = new Knowledge(a).search(c, query).slice(0, 3);
      return hits.length
        ? hits
            .map((h) => `${h.title}\n${h.excerpt}\nSource : ${h.url}`)
            .join("\n\n")
        : "Je n’ai pas de source vérifiée sur ce sujet dans cette discussion. Je préfère ne pas inventer une réponse. Écris « Nanba aide » pour voir les actions disponibles.";
    }
    const categories: Record<string, string> = {
      demandes: "request",
      resultats: "request",
      rencontres: "meetup",
      evenements: "meetup",
      offres: "offer",
      radar: "radar",
      arrivee: "cohort",
      defis: "challenge",
      histoires: "story",
      entraide: "help",
    };
    const kind = categories[command];
    if (kind) {
      const allowed: Record<string, string[]> = {
        request: ["proposed", "open"],
        meetup: ["open"],
        offer: ["confirmed"],
        radar: ["published"],
        cohort: ["open"],
        challenge: ["registration", "active", "closed", "completed"],
        story: ["published"],
        help: ["open"],
      };
      const rows = a
        .list(c, kind)
        .filter(
          (r) =>
            allowed[kind].includes(r.status) &&
            (r.data.expiresAt ?? Infinity) > a.now() &&
            (r.data.deadline ?? Infinity) > a.now() &&
            (kind !== "story" || r.data.audiences.includes("whatsapp")),
        )
        .slice(0, 5);
      return rows.length
        ? rows
            .map(
              (r) =>
                `${short(r)} · ${r.data.title}${r.data.zone ? " — " + r.data.zone : ""}${kind === "request" ? " · " + a.counts(r.id).total + "/" + r.data.threshold + " intérêts" : ""}`,
            )
            .join("\n")
        : "Aucun élément confirmé disponible dans cette discussion pour le moment. Tu peux commencer avec « Nanba proposer une sortie ».";
    }
    return "Je peux déjà t’aider à proposer une activité, lancer un sondage et lire les données de cette discussion. Pour une conversation libre et des recherches externes, le fournisseur IA reste à connecter. Écris « Nanba aide » ou « Nanba proposer une sortie ».";
  }
}
