import type { Domain } from "./modules.ts";
import type { Context, Entity } from "./core.ts";
import { json, parse, uid, type Row } from "./db.ts";
import { check, integer, text } from "./validation.ts";
import { forms, type Form } from "./conversation-forms.ts";
import {
  field,
  parseField,
  displayValue,
  norm,
  codeOf,
  when,
  type Field,
} from "./conversation-format.ts";
import { detail, MENUS } from "./conversation-view.ts";
import { isPrivate } from "./private-chat.ts";
import { hash } from "./auth.ts";
import { Administration } from "./admin.ts";

const aliases: Record<string, string> = {
  "1": "collectif",
  "2": "rencontres",
  "3": "logement",
  "4": "entraide",
  "5": "radar",
  "6": "arrivee",
  "7": "defis",
  "8": "histoires",
  "nouveaux arrivants": "arrivee",
  evenements: "rencontres",
  "creer rencontre": "rencontre creer",
  "creer logement": "logement creer",
  "creer entraide": "entraide creer",
  "creer defi": "defi creer",
  "creer histoire": "histoire creer",
  "proposer histoire": "histoire creer",
  inscription: "inscrire",
  "mes inscriptions": "inscriptions",
};
const lists: Record<string, string> = {
  demandes: "request",
  offres: "offer",
  "rencontres liste": "meetup",
  logements: "housing",
  "propositions logement": "housing_offer",
  "entraide liste": "help",
  benevoles: "volunteer",
  "radar liste": "radar",
  parcours: "cohort",
  "defis liste": "challenge",
  "histoires liste": "story",
  sources: "source",
  documents: "document",
  digests: "digest",
};
const visibleStatus: Record<string, string[]> = {
  request: ["proposed", "open"],
  offer: ["confirmed"],
  meetup: ["open"],
  help: ["open"],
  volunteer: ["active"],
  radar: ["published"],
  cohort: ["open"],
  challenge: ["registration", "open", "closed"],
  story: ["published"],
  source: ["active", "paused"],
  document: ["pending", "verified"],
  digest: ["draft", "approved"],
};
const simple: Record<
  string,
  {
    action: string;
    kinds: string[];
    title: string;
    private?: boolean;
    data?: Row;
    notice?: string;
  }
> = {
  partager: {
    action: "publish_whatsapp",
    kinds: ["meetup", "offer", "cohort", "radar", "challenge"],
    title: "Publier dans le groupe WhatsApp",
    private: true,
    notice:
      "Un message sera mis en file d’envoi dans le groupe. Il contiendra les commandes WhatsApp utiles aux participants.",
  },
  "source pause": {
    action: "pause",
    kinds: ["source"],
    title: "Suspendre la collecte",
    private: true,
  },
  "source reprendre": {
    action: "resume",
    kinds: ["source"],
    title: "Reprendre la collecte",
    private: true,
  },
  "document verifier": {
    action: "verify",
    kinds: ["document"],
    title: "Valider cette connaissance sourcée",
    private: true,
  },
  "document retirer": {
    action: "remove",
    kinds: ["document"],
    title: "Retirer cette connaissance",
    private: true,
  },
  "digest publier": {
    action: "publish",
    kinds: ["digest"],
    title: "Programmer la publication de ce digest",
    private: true,
  },
  quitter: {
    action: "leave",
    kinds: ["meetup", "offer", "cohort"],
    title: "Annuler mon inscription",
    private: true,
  },
  supprimer: {
    action: "cancel",
    kinds: ["request", "meetup", "offer", "help"],
    title: "Annuler cette activité",
    private: true,
  },
  terminer: {
    action: "complete",
    kinds: ["meetup", "offer", "help"],
    title: "Marquer cette activité comme terminée",
    private: true,
  },
  "offre confirmer": {
    action: "confirm",
    kinds: ["offer"],
    title: "Confirmer mon offre professionnelle",
    private: true,
  },
  "logement suspendre": {
    action: "suspend",
    kinds: ["housing"],
    title: "Suspendre ma recherche de logement",
    private: true,
  },
  "logement reprendre": {
    action: "resume",
    kinds: ["housing"],
    title: "Reprendre ma recherche de logement",
    private: true,
  },
  "logement trouve": {
    action: "satisfy",
    kinds: ["housing"],
    title: "Indiquer que mon logement est trouvé",
    private: true,
  },
  "logement interet": {
    action: "interest",
    kinds: ["housing_offer"],
    title: "Exprimer mon intérêt pour ce logement",
    private: true,
  },
  "logement contact": {
    action: "contact",
    kinds: ["housing_offer"],
    title: "Demander à être contacté pour ce logement",
    private: true,
    notice:
      "Le professionnel pourra consulter cette demande dans ses dossiers Nanba. Aucun paiement ni réservation.",
  },
  "logement reconfirmer": {
    action: "reconfirm",
    kinds: ["housing_offer"],
    title: "Confirmer que j’ai revérifié la disponibilité",
    private: true,
  },
  "benevole pause": {
    action: "pause",
    kinds: ["volunteer"],
    title: "Mettre mon bénévolat en pause",
    private: true,
  },
  "benevole reprendre": {
    action: "resume",
    kinds: ["volunteer"],
    title: "Réactiver mon bénévolat",
    private: true,
  },
  aider: {
    action: "volunteer",
    kinds: ["help"],
    title: "Proposer mon aide sur ce créneau",
    private: true,
  },
  accepter: {
    action: "accept",
    kinds: ["help"],
    title: "Accepter le bénévole et le rendez-vous",
    private: true,
  },
  refuser: {
    action: "decline",
    kinds: ["help"],
    title: "Décliner cette proposition de bénévole",
    private: true,
  },
  "radar publier": {
    action: "publish",
    kinds: ["radar"],
    title: "Valider cette information terrain",
  },
  "radar retirer": {
    action: "remove",
    kinds: ["radar"],
    title: "Retirer cette information terrain",
  },
  "defi valider": {
    action: "verify",
    kinds: ["challenge"],
    title: "Valider le contenu et ouvrir les inscriptions",
    private: true,
    data: { verified: true },
  },
  "defi ouvrir": {
    action: "open",
    kinds: ["challenge"],
    title: "Figer les équipes et ouvrir les réponses",
    private: true,
  },
  "defi cloturer": {
    action: "close",
    kinds: ["challenge"],
    title: "Clôturer le défi après son échéance",
  },
  "histoire publier": {
    action: "publish",
    kinds: ["story"],
    title: "Valider la publication du récit",
    private: true,
  },
  "histoire partager": {
    action: "share",
    kinds: ["story"],
    title: "Diffuser le récit dans le groupe autorisé",
    private: true,
    notice:
      "Le message sera mis en file d’envoi. Une confirmation fournisseur sera nécessaire pour connaître son état.",
  },
  "histoire retirer": {
    action: "withdraw",
    kinds: ["story"],
    title: "Retirer mon récit et ses autorisations",
    private: true,
    notice:
      "Le récit est retiré de Nanba et les envois en attente sont annulés. Les messages déjà reçus sur WhatsApp ne peuvent pas être effacés par ce retrait.",
  },
};
export class WhatsAppFlows {
  refs: { id: string; version: number; projectionHash: string }[] = [];
  a: Domain;
  c: Context;
  p: Row;
  transport: Row;
  constructor(a: Domain, c: Context, p: Row, transport: Row) {
    this.a = a;
    this.c = c;
    this.p = p;
    this.transport = transport;
  }
  get private() {
    return isPrivate(this.transport);
  }
  requirePrivate() {
    check(this.private, "private_chat_required", 403);
  }
  ref(r: Entity) {
    this.refs.push({
      id: r.id,
      version: r.version,
      projectionHash: hash(json(this.a.present(this.c, this.a.raw(r.id)))),
    });
    return r;
  }
  find(code: string, kinds?: string[]) {
    check(/^[a-f0-9-]{8,36}$/i.test(code), "not_found", 404);
    const rs = this.a.db
      .all(
        "SELECT id FROM records WHERE group_id=? AND substr(id,1,?)=?",
        this.c.groupId,
        code.length,
        code.toLowerCase(),
      )
      .map((x) => this.a.raw(x.id))
      .filter(
        (r) => (!kinds || kinds.includes(r.kind)) && this.a.canRead(this.c, r),
      );
    check(rs.length === 1, "not_found", 404);
    if (rs[0].kind === "story" && rs[0].owner_id !== this.c.userId)
      check(
        rs[0].data.audiences.includes("whatsapp"),
        "channel_consent_required",
        403,
      );
    return this.ref(rs[0]);
  }
  saved() {
    return parse(
      this.a.db.get(
        "SELECT state FROM conversations WHERE group_id=? AND identity_hash=? AND expires_at>?",
        this.transport.id,
        this.p.identityHash,
        this.a.now(),
      )?.state ?? "{}",
    );
  }
  put(s: Row) {
    this.a.db.run(
      "INSERT INTO conversations VALUES(?,?,?,?) ON CONFLICT(group_id,identity_hash) DO UPDATE SET state=excluded.state,expires_at=excluded.expires_at",
      this.transport.id,
      this.p.identityHash,
      json({ ...s, scopeGroupId: this.c.groupId }),
      this.a.now() + 86400000,
    );
  }
  clear() {
    this.a.db.run(
      "DELETE FROM conversations WHERE group_id=? AND identity_hash=?",
      this.transport.id,
      this.p.identityHash,
    );
  }
  form(key: string, target?: Entity): Form | undefined {
    const a = this.a,
      c = this.c;
    if (simple[key]) {
      const s = simple[key];
      return {
        title: s.title,
        fields: [],
        action: s.action,
        kinds: s.kinds,
        private: s.private,
        prepare: () => s.data ?? {},
        notice: s.notice,
      };
    }
    if (key === "digest creer")
      return {
        title: "Préparer un digest",
        private: true,
        roles: ["group_admin"],
        kind: "digest",
        fields: [
          field("title", "Titre", "Titre du digest ?", "text", { max: 160 }),
          field(
            "codes",
            "Documents",
            "Codes des documents vérifiés, séparés par ;",
            "list",
          ),
          field(
            "dueAt",
            "Publication",
            "Date de publication : JJ/MM/AAAA HH:mm, heure de Paris",
            "date",
          ),
        ],
        prepare: (d) => ({
          ...d,
          documentIds: d.codes.map(
            (code: string) => this.find(code, ["document"]).id,
          ),
        }),
        notice:
          "Le digest sera un brouillon. Nanba digest publier CODE pour programmer l’envoi.",
      };
    if (key === "preferences")
      return {
        title: "Mes préférences",
        private: true,
        fields: [
          field("language", "Langue", "fr / en / ta / tanglish", "enum", {
            options: ["fr", "en", "ta", "tanglish"],
          }),
          field("zone", "Ville", "Ta ville ?"),
          field(
            "notifications",
            "Notifications",
            "Autoriser les notifications ? oui / non",
            "boolean",
          ),
          field(
            "commercial",
            "Commercial",
            "Autoriser les communications commerciales ? oui / non",
            "boolean",
          ),
          field(
            "visibility",
            "Visibilité",
            "Autoriser l’affichage de ton nom ? oui / non",
            "boolean",
          ),
          field("format", "Public", "solo / couple / family", "enum", {
            options: ["solo", "couple", "family"],
          }),
        ],
        run: (d) => new Administration(a).preferences(c, d),
      };
    if (
      ["admin resoudre", "admin annuler envoi", "admin reconcilier"].includes(
        key,
      )
    )
      return {
        title: {
          "admin resoudre": "Résoudre un signalement",
          "admin annuler envoi": "Annuler une publication en attente",
          "admin reconcilier": "Confirmer un envoi incertain",
        }[key]!,
        private: true,
        roles: ["group_admin"],
        fields: [
          field(
            "code",
            "Code",
            "Code affiché par Nanba admin signalements ou Nanba admin envois ?",
          ),
          ...(key === "admin reconcilier"
            ? [
                field(
                  "providerId",
                  "Identifiant WhatsApp",
                  "Identifiant exact du message dont tu as vérifié l’envoi ?",
                ),
                field(
                  "evidence",
                  "Justificatif",
                  "Décris comment tu as vérifié cet envoi (12 caractères minimum).",
                ),
              ]
            : []),
        ],
        run: (d) => {
          const table = key === "admin resoudre" ? "reports" : "outbox";
          const rs = a.db.all(
            `SELECT id FROM ${table} WHERE group_id=? AND (id=? OR substr(id,1,8)=?)`,
            c.groupId,
            d.code,
            d.code,
          );
          check(rs.length === 1, "not_found", 404);
          return new Administration(a).action(
            c,
            {
              "admin resoudre": "report_resolve",
              "admin annuler envoi": "cancel_job",
              "admin reconcilier": "reconcile",
            }[key]!,
            { ...d, id: rs[0].id },
          );
        },
      };
    if (key === "inscrire")
      return {
        title: "M’inscrire",
        fields: [
          field("seats", "Places", "Combien de places ? De 1 à 6.", "integer", {
            min: 1,
            max: 6,
          }),
        ],
        private: true,
        kinds: ["meetup", "offer", "cohort"],
        action: "enroll",
        prepare: (d) => ({ ...d, accept: true, version: target!.version }),
        notice:
          "Tu acceptes les conditions et la version affichées. Une activité complète entraîne une inscription en attente. Aucun paiement ni billet externe.",
      };
    if (key === "defi rejoindre")
      return {
        title: "Rejoindre une équipe",
        private: true,
        kinds: ["challenge"],
        action: "join",
        fields: [
          field(
            "team",
            "Équipe",
            "Choisis ton équipe : " + (target?.data.teams.join(" / ") ?? ""),
            "enum",
            { options: target?.data.teams ?? [] },
          ),
          field(
            "visible",
            "Visibilité",
            "Autoriser l’affichage de ton nom dans les résultats ? oui / non",
            "boolean",
          ),
        ],
      };
    if (key === "defi repondre")
      return {
        title: "Répondre au défi",
        private: true,
        kinds: ["challenge"],
        action: "answer",
        fields: (target?.data.questions ?? []).map((q: Row, i: number) =>
          field(
            "q" + i,
            "Question " + (i + 1),
            `${i + 1}. ${q.prompt}\n${q.options.map((o: string, j: number) => `${j + 1}. ${o}`).join("\n")}\nRéponds avec le numéro de ton choix.`,
            "integer",
            { min: 1, max: q.options.length },
          ),
        ),
        prepare: (d) => ({
          answers: target!.data.questions.map(
            (_: Row, i: number) => d["q" + i] - 1,
          ),
        }),
        notice:
          "Les réponses sont définitives après confirmation. Le score est calculé par le serveur et les résultats sont publiés après clôture.",
      };
    if (["etape", "ressource", "activite", "mentor"].includes(key)) {
      const labels: Record<string, string> = {
        etape: "Modifier mes étapes terminées",
        ressource: "Modifier mes ressources sauvegardées",
        activite: "Relier mes activités",
        mentor: "Choisir le mentorat",
      };
      const fs: Field[] =
        key === "mentor"
          ? [
              field(
                "mentor",
                "Mentorat",
                "Souhaites-tu être accompagné par un mentor ? oui / non",
                "boolean",
              ),
              field("theme", "Thème", "Sur quel thème ? Ou passer.", "text", {
                optional: true,
                max: 120,
              }),
            ]
          : [
              field(
                "selection",
                "Sélection",
                key === "etape"
                  ? "Numéros de toutes les étapes terminées, séparés par ; (passer pour aucune)."
                  : key === "ressource"
                    ? "Numéros des ressources à sauvegarder, séparés par ; (passer pour aucune)."
                    : "Codes des activités auxquelles tu es déjà inscrit, séparés par ; (passer pour aucune).",
                "list",
                { optional: true },
              ),
            ];
      return {
        title: labels[key],
        private: true,
        kinds: ["cohort"],
        action: "progress",
        fields: fs,
        prepare: (d) => {
          const progress = parse(
            a.db.get(
              "SELECT data FROM progress WHERE cohort_id=? AND user_id=?",
              target!.id,
              c.userId,
            )?.data ?? "{}",
          );
          if (key === "mentor") return { ...progress, ...d };
          const values = d.selection.map((s: string) =>
            key === "activite"
              ? this.find(s, ["meetup", "offer", "cohort"]).id
              : key === "etape"
                ? target!.data.steps[
                    integer(Number(s), "step", 1, target!.data.steps.length) - 1
                  ]
                : target!.data.resources[
                    integer(
                      Number(s),
                      "resource",
                      1,
                      target!.data.resources.length,
                    ) - 1
                  ].url,
          );
          return {
            ...progress,
            [{ etape: "completed", ressource: "saved", activite: "activities" }[
              key
            ]!]: values,
          };
        },
      };
    }
    if (key === "chercher rencontre")
      return {
        title: "Trouver une rencontre",
        private: true,
        fields: [
          field("zone", "Ville", "Dans quelle ville ?"),
          field(
            "language",
            "Langue",
            "Quelle langue ? fr / en / ta / tanglish",
          ),
          field("activity", "Activité", "Quelle activité ?"),
          field("format", "Public", "solo / couple / family / all", "enum", {
            options: ["solo", "couple", "family", "all"],
          }),
        ],
        run: (d) => ({ matches: a.matches(c, d) }),
      };
    if (key === "admin role")
      return {
        title: "Attribuer un rôle dans ce groupe",
        private: true,
        roles: ["group_admin"],
        fields: [
          field("userCode", "Membre", "Code du membre (Nanba admin membres) ?"),
          field(
            "role",
            "Rôle",
            "member / organizer / professional / group_admin",
            "enum",
            { options: ["member", "organizer", "professional", "group_admin"] },
          ),
        ],
        run: (d) => {
          const who = this.memberCode(d.userCode);
          check(who.user_id !== c.userId, "cannot_change_self_role", 403);
          check(
            who.role !== "group_admin" || a.member(c).platform_admin,
            "forbidden",
            403,
          );
          check(
            d.role !== "professional" || who.org_id,
            "organization_required",
          );
          a.db.run(
            "UPDATE memberships SET role=? WHERE user_id=? AND group_id=?",
            d.role,
            who.user_id,
            c.groupId,
          );
          a.audit(c, "membership.role_updated", who.user_id);
          return { updated: true };
        },
      };
    if (key === "admin partenaire")
      return {
        title: "Rattacher un professionnel vérifié",
        private: true,
        roles: ["group_admin"],
        fields: [
          field(
            "userCode",
            "Membre",
            "Code du membre déjà présent dans ce groupe ?",
          ),
          field(
            "name",
            "Organisation",
            "Nom de l’organisation que tu as vérifiée ?",
            "text",
            { max: 160 },
          ),
        ],
        run: (d) => {
          const who = this.memberCode(d.userCode);
          check(
            who.user_id !== c.userId && who.role !== "group_admin",
            "forbidden",
            403,
          );
          check(!who.org_id, "partner_already_assigned", 409);
          const id = uid();
          a.db.run(
            "INSERT INTO organizations(id,name) VALUES(?,?)",
            id,
            d.name,
          );
          a.db.run("UPDATE users SET org_id=? WHERE id=?", id, who.user_id);
          a.db.run(
            "UPDATE memberships SET role='professional' WHERE user_id=? AND group_id=?",
            who.user_id,
            c.groupId,
          );
          a.audit(c, "partner.created", id);
          return { updated: true };
        },
      };
    if (key === "admin retirer membre")
      return {
        title: "Retirer l’accès d’un membre au groupe",
        private: true,
        roles: ["group_admin"],
        fields: [field("userCode", "Membre", "Code du membre à retirer ?")],
        run: (d) => {
          const who = this.memberCode(d.userCode);
          check(
            who.user_id !== c.userId && who.role !== "group_admin",
            "forbidden",
            403,
          );
          a.db.run(
            "UPDATE memberships SET active=0 WHERE user_id=? AND group_id=?",
            who.user_id,
            c.groupId,
          );
          a.audit(c, "membership.revoked", who.user_id);
          return { updated: true };
        },
      };
    return forms(a, c)[key];
  }
  memberCode(code: string) {
    const rows = this.a.db
      .all(
        "SELECT m.*,u.name,u.org_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.active=1 AND u.deleted=0",
        this.c.groupId,
      )
      .filter((u) => u.user_id === code || u.user_id.slice(0, 8) === code);
    check(rows.length === 1, "member_not_found", 404);
    return rows[0];
  }
  prompt(form: Form, s: Row) {
    if (s.index < form.fields.length) {
      const f = form.fields[s.index];
      return `${form.title} · ${s.index + 1}/${form.fields.length}\n${f.prompt}\nRéponds « Nanba … ». Nanba retour / annuler.`;
    }
    return `${form.title} — récapitulatif\n${form.fields.map((f) => `${f.label} : ${displayValue(f, s.data[f.key])}`).join("\n")}${form.notice ? "\n" + form.notice : ""}\nÉcris « Nanba confirmer » pour valider, « Nanba retour » pour corriger ou « Nanba annuler ». Aucune action n’est effectuée avant confirmation.`;
  }
  advance(s: Row, content: string, command: string): string {
    check(s.scopeGroupId === this.c.groupId, "conversation_scope_changed", 409);
    const target = s.targetId
      ? this.ref(this.a.get(this.c, s.targetId))
      : undefined;
    check(!target || target.version === s.targetVersion, "terms_changed", 409);
    const form = this.form(s.flow, target);
    check(form, "unknown_action");
    if (form.private) this.requirePrivate();
    if (form.roles) this.a.role(this.c, form.roles);
    if (command === "retour") {
      s.index = Math.max(0, s.index - 1);
      this.put(s);
      return this.prompt(form, s);
    }
    if (s.index < form.fields.length) {
      const f = form.fields[s.index];
      s.data[f.key] = parseField(f, content, this.a.now());
      s.index++;
      this.put(s);
      return this.prompt(form, s);
    }
    if (command !== "confirmer") return this.prompt(form, s);
    const data = form.prepare ? form.prepare(s.data, target) : s.data;
    let result: Row;
    if (form.run) result = form.run(data, target);
    else if (form.kind) result = this.a.create(this.c, form.kind, data);
    else result = this.a.action(this.c, target!.id, form.action!, data);
    this.clear();
    this.refs = this.refs.filter((r) => r.id !== target?.id);
    if (result.kind && result.data) this.ref(result as Entity);
    if (result.matches)
      return this.rows(
        result.matches.map((r: Row) => {
          this.ref(r as Entity);
          return `${codeOf(r)} · ${r.data.title} — correspondances : ${r.reasons.join(", ")}`;
        }),
        1,
      );
    if (form.action === "enroll")
      return `Inscription ${({ confirmed: "confirmée", waitlisted: "sur liste d’attente", offered: "en attente de ton acceptation", reconfirm: "à reconfirmer" } as Row)[result.status] ?? result.status} · ${result.seats} place(s).\nNanba voir ${codeOf(target!)} / inscriptions. Aucun paiement effectué.`;
    if (["share", "publish_whatsapp"].includes(form.action ?? ""))
      return `Publication mise en file d’envoi. Nanba admin envois pour suivre la confirmation WhatsApp.`;
    if (form.action === "answer")
      return (
        "Tes réponses sont enregistrées. Résultats après clôture : Nanba résultats " +
        codeOf(target!)
      );
    if (form.action === "withdraw") return form.notice!;
    if (result.kind && result.data)
      return `${form.title} : enregistré.\nCode : ${codeOf(result)} · état : ${result.status}\nNanba voir ${codeOf(result)}\n${form.notice ?? ""}`;
    return `${form.title} : enregistré.${target ? "\nNanba voir " + codeOf(target) : ""}`;
  }
  start(key: string, target?: Entity) {
    const form = this.form(key, target)!;
    if (form.private) this.requirePrivate();
    if (form.roles) this.a.role(this.c, form.roles);
    if (form.kinds)
      check(target && form.kinds.includes(target.kind), "not_found", 404);
    // Check action prerequisites before collecting personal information.
    if (
      target &&
      ["housing", "volunteer"].includes(target.kind) &&
      form.kind !== "housing_offer"
    )
      this.a.own(this.c, target);
    if (
      target?.kind === "story" &&
      !["publish", "share"].includes(form.action ?? "")
    )
      this.a.own(this.c, target);
    if (key === "defi repondre")
      check(target!.status === "open", "challenge_closed", 409);
    const s = {
      flow: key,
      targetId: target?.id,
      targetVersion: target?.version,
      index: 0,
      data: {},
      scopeGroupId: this.c.groupId,
    };
    this.put(s);
    return (
      (target ? detail(this.a, this.c, target) + "\n\n" : "") +
      this.prompt(form, s)
    );
  }
  rows(rows: string[], page: number) {
    const size = 6;
    check(Number.isInteger(page) && page > 0, "invalid_page");
    const slice = rows.slice((page - 1) * size, page * size);
    return slice.length
      ? slice.join("\n") +
          (rows.length > page * size
            ? `\nPage ${page}. Pour la suite, ajoute ${page + 1} à la commande de liste.`
            : "")
      : "Aucun élément accessible pour le moment.";
  }
  list(kind: string, page: number, mine = false) {
    if (
      ["housing", "housing_offer", "source", "document", "digest"].includes(
        kind,
      ) ||
      mine
    )
      this.requirePrivate();
    const all = this.a
      .list(this.c, kind)
      .filter((r) =>
        mine
          ? r.owner_id === this.c.userId
          : ["housing", "housing_offer"].includes(kind)
            ? true
            : visibleStatus[kind]?.includes(r.status) &&
              (r.data.expiresAt ?? Infinity) > this.a.now() &&
              (kind !== "story" || r.data.audiences.includes("whatsapp")),
      );
    return (
      this.rows(
        all.map((r) => {
          this.ref(r as Entity);
          return `${codeOf(r)} · ${r.data.title} · ${r.status}${r.data.zone ? " — " + r.data.zone : ""}`;
        }),
        page,
      ) + "\nNanba voir CODE pour les détails et actions."
    );
  }
  handle(content: string): string | null {
    const a = this.a,
      c = this.c;
    let command = norm(content);
    command = aliases[command] ?? command;
    const saved = this.saved();
    if (["annuler", "cancel"].includes(command)) {
      this.clear();
      return "Préparation annulée. Aucune nouvelle action effectuée.";
    }
    if (saved.flow) return this.advance(saved, content, command);
    if (saved.step) return null;
    if (MENUS[command])
      return (
        MENUS[command] +
        (!this.private
          ? "\nPour les démarches personnelles, écris Nanba privé."
          : "")
      );
    if (command === "prive")
      return this.private
        ? "Tu es déjà dans une conversation privée. Nanba aide pour choisir un parcours."
        : "Écris « Nanba aide » en message privé au compte WhatsApp de Nanba. Commence par « Nanba rejoindre » ici si tu ne l’as pas encore fait. Tu pourras sélectionner ce groupe sans exposer tes informations aux autres membres.";
    if (command === "professionnels") {
      this.requirePrivate();
      const rs = a.db.all(
        "SELECT DISTINCT o.id,o.name FROM organizations o JOIN users u ON u.org_id=o.id JOIN memberships m ON m.user_id=u.id WHERE o.active=1 AND u.deleted=0 AND m.group_id=? AND m.active=1 AND m.role='professional'",
        c.groupId,
      );
      return rs.length
        ? rs.map((o) => `${o.id} · ${o.name}`).join("\n") +
            "\nCopie les identifiants des seuls professionnels que tu autorises."
        : "Aucun professionnel actif dans ce groupe. Ta recherche peut rester privée.";
    }
    if (/^inscriptions(?: \d+)?$/.test(command)) {
      this.requirePrivate();
      const page = Number(command.split(" ")[1] ?? 1);
      const rs = a.db
        .all(
          "SELECT r.id,e.status,e.seats,e.offered_until FROM enrollments e JOIN records r ON r.id=e.record_id WHERE e.user_id=? AND r.group_id=? ORDER BY e.updated_at DESC",
          c.userId,
          c.groupId,
        )
        .filter((x) => a.canRead(c, a.raw(x.id)));
      return (
        this.rows(
          rs.map((e) => {
            const r = this.ref(a.get(c, e.id));
            return `${codeOf(r)} · ${r.data.title} · ${e.status} · ${e.seats} place(s)${e.offered_until ? " · accepter avant " + when(e.offered_until) : ""}`;
          }),
          page,
        ) +
        "\nNanba inscrire CODE pour accepter une place proposée ou de nouvelles conditions."
      );
    }
    if (/^mes dossiers(?: \d+)?$/.test(command)) {
      this.requirePrivate();
      const rs = a.db
        .all(
          "SELECT id FROM records WHERE group_id=? AND kind IN('request','offer','meetup','housing','housing_offer','volunteer','help','radar','cohort','challenge','story') ORDER BY updated_at DESC",
          c.groupId,
        )
        .map((x) => a.raw(x.id))
        .filter(
          (r) =>
            a.canRead(c, r) &&
            (r.owner_id === c.userId ||
              r.data.volunteerId === c.userId ||
              (r.kind === "housing_offer" &&
                a.raw(r.data.requestId).owner_id === c.userId)),
        );
      return (
        this.rows(
          rs.map((r) => {
            this.ref(r);
            return `${codeOf(r)} · ${r.data.title} · ${r.status}`;
          }),
          Number(command.split(" ")[2] ?? 1),
        ) + "\nNanba voir CODE"
      );
    }
    if (/^mes histoires(?: \d+)?$/.test(command))
      return this.list("story", Number(command.split(" ")[2] ?? 1), true);
    for (const [key, kind] of Object.entries(lists))
      if (command === key || new RegExp("^" + key + " \\d+$").test(command))
        return this.list(kind, Number(command.slice(key.length).trim() || 1));
    if (command.startsWith("voir ")) {
      this.requirePrivate();
      return detail(a, c, this.find(content.split(/\s+/)[1]));
    }
    if (command.startsWith("progression ")) {
      this.requirePrivate();
      const r = this.find(content.split(/\s+/)[1], ["cohort"]);
      const p = a.present(c, r).data.progress;
      return `${r.data.title} — ma progression privée\nÉtapes terminées : ${(p.completed ?? []).join("; ") || "aucune"}\nRessources sauvegardées : ${(p.saved ?? []).join("; ") || "aucune"}\nActivités : ${
        (p.activities ?? [])
          .map((id: string) => {
            const x = this.ref(a.get(c, id));
            return `${x.data.title} (${codeOf(x)})`;
          })
          .join("; ") || "aucune"
      }\nMentorat demandé : ${p.mentor ? "oui" : "non"}\nThème : ${p.theme ?? "aucun"}\nNanba étape ${codeOf(r)} / ressource ${codeOf(r)} / activité ${codeOf(r)} / mentor ${codeOf(r)}`;
    }
    if (command.startsWith("resultats ")) {
      const r = this.find(content.split(/\s+/)[1], ["request", "challenge"]);
      if (r.kind === "challenge") {
        return (
          a
            .leaderboard(c, r.id)
            .map(
              (x: Row, i: number) =>
                `${i + 1}. ${x.team} · ${x.score.toFixed(2)} points/membre (${x.points} points / ${x.participants} inscrits)`,
            )
            .join("\n") + `\nRègles v${r.data.rulesVersion}`
        );
      }
      return null;
    }
    if (command.startsWith("desinteret ")) {
      const r = this.find(content.split(/\s+/)[1], ["request"]);
      const n = a.action(c, r.id, "interest", { active: false });
      return `Ton intérêt est retiré : ${n.total}/${r.data.threshold}.`;
    }
    if (command === "admin" || command.startsWith("admin ")) {
      this.requirePrivate();
      a.admin(c);
      if (command === "admin")
        return (
          "Administration de " +
          a.group(c).name +
          "\nNanba admin membres / admin rôle / admin partenaire / admin retirer membre\nNanba admin modération / admin envois / admin signalements\nNanba admin résoudre / admin annuler envoi / admin réconcilier\nNanba sources / source créer / source pause CODE / source reprendre CODE\nNanba documents / document créer / document vérifier CODE / document retirer CODE\nNanba digests / digest créer / digest publier CODE\nNanba admin pause / admin reprendre\nLes offres doivent être confirmées par leur professionnel ; les récits par leur auteur."
        );
      if (command === "admin membres")
        return a.db
          .all(
            "SELECT u.id,u.name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.active=1 AND u.deleted=0",
            c.groupId,
          )
          .map((u) => `${u.id.slice(0, 8)} · ${u.name} · ${u.role}`)
          .join("\n");
      if (command === "admin moderation") {
        return this.rows(
          a.db
            .all(
              "SELECT id FROM records WHERE group_id=? AND ((kind='radar' AND status IN('pending','disputed')) OR (kind='story' AND status='approved') OR (kind='challenge' AND status='draft')) ORDER BY created_at",
              c.groupId,
            )
            .map((x) => a.raw(x.id))
            .filter(
              (r) =>
                a.canRead(c, r) &&
                (r.kind !== "story" || r.data.audiences.includes("whatsapp")),
            )
            .map((r) => {
              this.ref(r);
              return `${codeOf(r)} · ${r.data.title} · ${r.kind} / ${r.status}`;
            }),
          1,
        );
      }
      if (command === "admin envois")
        return (
          a.db
            .all(
              "SELECT o.id,o.status,o.kind,o.error FROM outbox o WHERE o.group_id IN(?,?) ORDER BY o.created_at DESC LIMIT 10",
              c.groupId,
              this.transport.id,
            )
            .map(
              (o) =>
                `${o.id.slice(0, 8)} · ${o.kind} · ${o.status}${o.error ? " · " + o.error : ""}`,
            )
            .join("\n") || "Aucun envoi."
        );
      if (command === "admin signalements")
        return (
          a.db
            .all(
              "SELECT id,reason FROM reports WHERE group_id=? AND status='open' ORDER BY created_at DESC LIMIT 10",
              c.groupId,
            )
            .map((x) => `${x.id.slice(0, 8)} · ${x.reason}`)
            .join("\n") || "Aucun signalement ouvert."
        );
    }
    // Longest matching form name, followed only by the target code if needed.
    const keys = [
      ...Object.keys(forms(a, c)),
      ...Object.keys(simple),
      "inscrire",
      "defi rejoindre",
      "defi repondre",
      "etape",
      "ressource",
      "activite",
      "mentor",
      "chercher rencontre",
      "admin role",
      "admin partenaire",
      "admin retirer membre",
      "digest creer",
      "preferences",
      "admin resoudre",
      "admin annuler envoi",
      "admin reconcilier",
    ].sort((x, y) => y.length - x.length);
    for (const key of keys) {
      if (command !== key && !command.startsWith(key + " ")) continue;
      const proto = this.form(key);
      if (!proto) continue;
      const tail = content
        .split(/\s+/)
        .slice(key.split(" ").length)
        .join(" ")
        .trim();
      if (proto.private) this.requirePrivate();
      if (proto.kinds) {
        check(tail && !tail.includes(" "), "record_code_required");
        return this.start(key, this.find(tail, proto.kinds));
      }
      check(!tail, "unexpected_arguments");
      return this.start(key);
    }
    return null;
  }
}
