import { createHash, createHmac, randomBytes } from "node:crypto";
import type { TwilioAssistant } from "./twilio-assistant.ts";
import type { Row } from "./db.ts";
import { check } from "./validation.ts";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const clean = (s: unknown, n = 3000) =>
  String(s ?? "")
    .trim()
    .slice(0, n);
export class HumanSupport {
  host: TwilioAssistant;
  constructor(host: TwilioAssistant) {
    this.host = host;
    host.db.raw.exec(`
    CREATE TABLE IF NOT EXISTS nanba_support_admins(identity TEXT PRIMARY KEY,user_id TEXT,source TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS nanba_support_codes(hash TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS nanba_support_tickets(id TEXT PRIMARY KEY,identity TEXT NOT NULL,state TEXT NOT NULL,assigned TEXT,summary TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS nanba_support_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,ticket TEXT NOT NULL,sender TEXT NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL);
  `);
    if (
      !host.db
        .all("PRAGMA table_info(twilio_jobs)")
        .some((x) => x.name === "support_ticket")
    )
      host.db.raw.exec(
        "ALTER TABLE twilio_jobs ADD COLUMN support_ticket TEXT",
      );
    if (
      !host.db
        .all("PRAGMA table_info(twilio_jobs)")
        .some((x) => x.name === "support_actor")
    )
      host.db.raw.exec("ALTER TABLE twilio_jobs ADD COLUMN support_actor TEXT");
  }
  get db() {
    return this.host.db;
  }
  identity(phone: string) {
    const c = this.host.config();
    return createHmac("sha256", this.host.env.IDENTITY_ENCRYPTION_KEY!)
      .update("twilio:" + c.accountSid + ":" + c.from + ":" + phone)
      .digest("hex");
  }
  validUser(userId: string) {
    const u = this.db.get(
      "SELECT * FROM users WHERE id=? AND deleted=0",
      userId,
    );
    if (!u) return false;
    if (u.platform_admin) return true;
    return (
      userId === "pilot-whatsapp-owner" &&
      !!this.db.get(
        "SELECT 1 FROM memberships m JOIN groups g ON g.id=m.group_id WHERE m.user_id=? AND m.role='group_admin' AND m.active=1 AND g.id='pilot-self' AND json_extract(g.settings,'$.selfTest')=1",
        userId,
      )
    );
  }
  bootstrap() {
    if (!this.host.ready()) return;
    for (const r of this.db.all(
      "SELECT * FROM identities WHERE verified_at IS NOT NULL AND user_id IS NOT NULL AND encrypted_ref IS NOT NULL",
    )) {
      if (!this.validUser(r.user_id)) continue;
      let ref = "";
      try {
        ref = this.host.unseal(r.encrypted_ref);
      } catch {
        continue;
      }
      if (!/^[1-9]\d{7,14}@(c\.us|s\.whatsapp\.net)$/.test(ref)) continue;
      if (
        r.user_id === "pilot-whatsapp-owner" &&
        !this.db.get(
          "SELECT 1 FROM groups WHERE id='pilot-self' AND chat_id=?",
          ref,
        )
      )
        continue;
      const phone = "whatsapp:+" + ref.split("@")[0],
        identity = this.identity(phone);
      if (phone === this.host.config().from) continue;
      this.db.run(
        "INSERT OR IGNORE INTO twilio_contacts(identity,phone,last_at) VALUES(?,?,0)",
        identity,
        this.host.seal(phone),
      );
      this.db.run(
        "INSERT OR IGNORE INTO nanba_support_admins(identity,user_id,source) VALUES(?,?,'verified-owner')",
        identity,
        r.user_id,
      );
    }
  }
  isAdmin(identity: string) {
    const row = this.db.get(
      "SELECT * FROM nanba_support_admins WHERE identity=? AND enabled=1",
      identity,
    );
    return (
      !!row &&
      ((row.source === "private-link" && !row.user_id) ||
        (!!row.user_id && this.validUser(row.user_id)))
    );
  }
  admins() {
    this.bootstrap();
    return this.db
      .all("SELECT identity FROM nanba_support_admins WHERE enabled=1")
      .filter((r) => this.isAdmin(r.identity));
  }
  status() {
    return {
      admins: this.admins().map((r) => {
        const c = this.db.get(
          "SELECT phone FROM twilio_contacts WHERE identity=?",
          r.identity,
        );
        const phone = c?.phone ? this.host.unseal(c.phone) : "";
        return {
          number: phone ? phone.slice(0, 12) + "…" + phone.slice(-3) : null,
        };
      }),
      waiting: this.db.get(
        "SELECT COUNT(*) n FROM nanba_support_tickets WHERE state IN('waiting','assigned')",
      )!.n,
    };
  }
  linkCode(userId: string | null = null) {
    if (userId) check(this.validUser(userId), "admin_required", 403);
    const code = randomBytes(8).toString("hex").toUpperCase();
    this.db.run(
      "DELETE FROM nanba_support_codes WHERE expires_at<=?",
      this.host.now(),
    );
    this.db.run(
      "INSERT INTO nanba_support_codes VALUES(?,?,?)",
      digest(code),
      userId,
      this.host.now() + 600000,
    );
    return {
      command: "ADMIN ASSOCIER " + code,
      expiresInMinutes: 10,
      instruction:
        "Envoie cette commande depuis le numéro WhatsApp de l’administrateur. Ne partage pas le code.",
    };
  }
  active(identity: string) {
    return this.db.get(
      "SELECT * FROM nanba_support_tickets WHERE identity=? AND state IN('waiting','assigned') ORDER BY created_at DESC LIMIT 1",
      identity,
    );
  }
  queue(
    identity: string,
    text: string,
    ticket: string,
    actor: string | null = null,
  ) {
    const sid = "NT" + randomBytes(16).toString("hex");
    this.host.companion.enqueue(identity, text, "support", null, null, sid);
    this.db.run(
      "UPDATE twilio_jobs SET human_reply=1,support_ticket=?,support_actor=? WHERE sid=?",
      ticket,
      actor,
      sid,
    );
  }
  notify(ticket: Row) {
    for (const admin of this.admins())
      this.queue(
        admin.identity,
        `Nouvelle demande Nanba ${ticket.id}. Réponds ADMIN LIRE ${ticket.id} pour la consulter, puis ADMIN PRENDRE ${ticket.id} pour la prendre en charge.`,
        ticket.id,
      );
  }
  open(identity: string, args: Row) {
    const prior = this.active(identity);
    if (prior)
      return {
        reference: prior.id,
        message:
          "Ta demande est déjà ouverte. Écris ici pour la compléter, ou REPRENDRE IA pour revenir à l’assistant.",
      };
    check(this.admins().length > 0, "equipe_humaine_pas_encore_raccordee");
    check(
      this.db.get(
        "SELECT COUNT(*) n FROM nanba_support_tickets WHERE identity=? AND created_at>?",
        identity,
        this.host.now() - 86400000,
      )!.n < 5,
      "maximum_5_demandes_par_jour",
    );
    const id = "N" + randomBytes(4).toString("hex").toUpperCase(),
      summary =
        args.shareSummary === true
          ? clean(args.text, 1000)
          : "Demande de contact avec l’équipe Nanba";
    this.db.run(
      "INSERT INTO nanba_support_tickets VALUES(?,?,'waiting',NULL,?,?,?)",
      id,
      identity,
      this.host.seal(summary || "Demande de contact"),
      this.host.now(),
      this.host.now(),
    );
    this.notify(this.active(identity)!);
    return {
      reference: id,
      message:
        "Ta demande est transmise à l’équipe humaine Nanba. Une réponse dépend de sa disponibilité. Les prochains messages de cette discussion lui seront destinés ; ton ancien historique n’est pas transmis. Écris REPRENDRE IA pour revenir à l’assistant.",
      sharedSummary: summary,
    };
  }
  resume(identity: string) {
    const t = this.active(identity);
    if (!t) return "Tu échanges déjà avec l’assistant IA.";
    this.close(t, "closed");
    return `Demande ${t.id} clôturée. Tu échanges de nouveau avec l’assistant IA.`;
  }
  close(t: Row, state: string) {
    this.db.run(
      "UPDATE nanba_support_tickets SET state=?,updated_at=? WHERE id=?",
      state,
      this.host.now(),
      t.id,
    );
    this.db.run(
      "UPDATE twilio_jobs SET state='cancelled' WHERE support_ticket=? AND state IN('ready','queued','generating','waiting_template')",
      t.id,
    );
  }
  stop(identity: string, forget: boolean) {
    for (const t of this.db.all(
      "SELECT * FROM nanba_support_tickets WHERE identity=?",
      identity,
    )) {
      this.close(t, "cancelled");
      if (forget) {
        this.db.run("DELETE FROM nanba_support_messages WHERE ticket=?", t.id);
        this.db.run("DELETE FROM nanba_support_tickets WHERE id=?", t.id);
        this.db.run(
          "UPDATE twilio_jobs SET input=?,output=NULL,file_id=NULL WHERE support_ticket=?",
          this.host.seal(""),
          t.id,
        );
      }
    }
  }
  async incoming(job: Row, prepared: Row) {
    const t = this.active(job.identity);
    check(t, "demande_introuvable");
    const files: string[] = [];
    for (const item of Array.isArray(prepared.content) ? prepared.content : [])
      if (item.type === "input_image" && typeof item.image_url === "string") {
        const m = item.image_url.match(
          /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s,
        );
        if (m) {
          const ext =
            m[1] === "image/png"
              ? "png"
              : m[1] === "image/webp"
                ? "webp"
                : "jpg";
          files.push(
            this.host.deliverables.put(
              job.identity,
              job.sid,
              "support",
              "photo." + ext,
              m[1],
              Buffer.from(m[2], "base64"),
            ),
          );
        }
      }
    this.db.run(
      "INSERT INTO nanba_support_messages(ticket,sender,data,created_at) VALUES(?,?,?,?)",
      t.id,
      "user",
      this.host.seal(JSON.stringify({ text: clean(prepared.history), files })),
      this.host.now(),
    );
    this.db.run(
      "UPDATE nanba_support_tickets SET updated_at=? WHERE id=?",
      this.host.now(),
      t.id,
    );
    for (const admin of this.admins().filter(
      (a) => !t.assigned || a.identity === t.assigned,
    ))
      this.queue(
        admin.identity,
        `Nouveau message sur la demande ${t.id}. ADMIN LIRE ${t.id}`,
        t.id,
      );
    this.db.run("UPDATE twilio_jobs SET human_reply=1 WHERE sid=?", job.sid);
    return (
      "Message ajouté à ta demande " +
      t.id +
      ". L’équipe Nanba pourra le consulter. Pour revenir à l’assistant : REPRENDRE IA."
    );
  }
  command(job: Row, body: string): string | null {
    if (/^(REPRENDRE IA|RETOUR IA|RETURN TO AI)$/i.test(body.trim()))
      return this.resume(job.identity);
    if (!/^ADMIN(?:\s|$)/i.test(body)) return null;
    const link = body.match(/^ADMIN ASSOCIER ([A-F0-9]{16})$/i);
    if (link) {
      const row = this.db.get(
        "SELECT * FROM nanba_support_codes WHERE hash=? AND expires_at>?",
        digest(link[1].toUpperCase()),
        this.host.now(),
      );
      if (!row)
        return "Code invalide ou expiré. Crée un nouveau code depuis la configuration privée Nanba.";
      this.db.run(
        "DELETE FROM nanba_support_codes WHERE hash=?",
        digest(link[1].toUpperCase()),
      );
      this.db.run(
        "INSERT INTO nanba_support_admins(identity,user_id,source) VALUES(?,?,'private-link') ON CONFLICT(identity) DO UPDATE SET user_id=excluded.user_id,source=excluded.source,enabled=1",
        job.identity,
        row.user_id,
      );
      return "Numéro administrateur associé. Commandes : ADMIN DEMANDES, ADMIN LIRE référence, ADMIN PRENDRE référence, ADMIN REPONDRE référence message, ADMIN TERMINER référence.";
    }
    this.bootstrap();
    if (!this.isAdmin(job.identity))
      return "Cette commande est réservée aux administrateurs Nanba associés depuis la configuration privée.";
    if (/^ADMIN DEMANDES$/i.test(body))
      return (
        this.db
          .all(
            "SELECT id,state FROM nanba_support_tickets WHERE state IN('waiting','assigned') ORDER BY created_at LIMIT 20",
          )
          .map(
            (x) =>
              x.id +
              " · " +
              (x.state === "waiting" ? "à prendre en charge" : "en cours"),
          )
          .join("\n") || "Aucune demande en attente."
      );
    const m = body.match(
      /^ADMIN (LIRE|PRENDRE|REPONDRE|RÉPONDRE|TERMINER) (N[A-F0-9]{8})(?:\s+([\s\S]+))?$/i,
    );
    if (!m)
      return "Commandes : ADMIN DEMANDES, ADMIN LIRE référence, ADMIN PRENDRE référence, ADMIN REPONDRE référence message, ADMIN TERMINER référence.";
    const t = this.db.get(
      "SELECT * FROM nanba_support_tickets WHERE id=? AND state IN('waiting','assigned')",
      m[2].toUpperCase(),
    );
    if (!t) return "Demande introuvable ou clôturée.";
    const verb = m[1].toUpperCase();
    if (verb === "LIRE") {
      job.support_ticket = t.id;
      this.db.run(
        "UPDATE twilio_jobs SET support_ticket=? WHERE sid=?",
        t.id,
        job.sid,
      );
      const messages = this.db
        .all(
          "SELECT * FROM nanba_support_messages WHERE ticket=? ORDER BY id DESC LIMIT 6",
          t.id,
        )
        .reverse();
      const parts = [t.id + " · " + this.host.unseal(t.summary)];
      for (const r of messages) {
        const d = JSON.parse(this.host.unseal(r.data));
        parts.push(
          (r.sender === "user" ? "Membre" : "Équipe") + " : " + d.text,
        );
        for (const f of d.files || [])
          if (
            this.db.get(
              "SELECT 1 FROM nanba_files WHERE id=? AND expires_at>?",
              f,
              this.host.now(),
            )
          ) {
            this.host.deliverables.child(job, f);
          }
      }
      this.db.run(
        "UPDATE twilio_jobs SET support_ticket=? WHERE sid=?",
        t.id,
        job.sid,
      );
      const all = parts.join("\n\n"),
        page = Math.max(1, Math.min(20, Number(m[3]) || 1)),
        pages = Math.ceil(all.length / 1250);
      return (
        all.slice((page - 1) * 1250, page * 1250) +
        (pages > 1
          ? `\n\nPage ${page}/${pages}. Suite : ADMIN LIRE ${t.id} ${page + 1}`
          : "")
      );
    }
    if (t.assigned && t.assigned !== job.identity)
      return "Cette demande est déjà prise en charge par un autre administrateur.";
    if (verb === "PRENDRE") {
      this.db.run(
        "UPDATE nanba_support_tickets SET assigned=?,state='assigned',updated_at=? WHERE id=?",
        job.identity,
        this.host.now(),
        t.id,
      );
      this.queue(
        t.identity,
        `L’équipe Nanba a pris en charge ta demande ${t.id}. Tu peux continuer à écrire ici.`,
        t.id,
      );
      return "Demande " + t.id + " prise en charge.";
    }
    if (verb === "TERMINER") {
      this.close(t, "closed");
      this.queue(
        t.identity,
        `L’équipe Nanba a clôturé la demande ${t.id}. L’assistant IA est de nouveau disponible.`,
        t.id,
      );
      return "Demande clôturée.";
    }
    if ((m[3] || " ").length > 650)
      return "Pour garantir la réception complète, envoie une réponse de 650 caractères maximum. Tu peux répondre en plusieurs messages.";
    const text = clean(m[3], 650);
    if (!text) return "Ajoute le texte après ADMIN REPONDRE " + t.id;
    this.db.run(
      "UPDATE nanba_support_tickets SET assigned=?,state='assigned',updated_at=? WHERE id=?",
      job.identity,
      this.host.now(),
      t.id,
    );
    this.db.run(
      "INSERT INTO nanba_support_messages(ticket,sender,data,created_at) VALUES(?,?,?,?)",
      t.id,
      "admin",
      this.host.seal(JSON.stringify({ text, files: [] })),
      this.host.now(),
    );
    this.queue(
      t.identity,
      "Équipe humaine Nanba · " + t.id + "\n" + text,
      t.id,
      job.identity,
    );
    return "Réponse mise en file pour la demande " + t.id + ".";
  }
  allowed(job: Row) {
    if (job.support_actor && !this.isAdmin(job.support_actor)) return false;
    if (!job.support_ticket) return true;
    const t = this.db.get(
      "SELECT * FROM nanba_support_tickets WHERE id=?",
      job.support_ticket,
    );
    if (!t || t.state === "cancelled") return false;
    return t.identity === job.identity || this.isAdmin(job.identity);
  }
  cleanup() {
    this.db.run(
      "DELETE FROM nanba_support_codes WHERE expires_at<=?",
      this.host.now(),
    );
    for (const t of this.db.all(
      "SELECT * FROM nanba_support_tickets WHERE updated_at<?",
      this.host.now() - 30 * 86400000,
    )) {
      this.close(t, "cancelled");
      this.db.run("DELETE FROM nanba_support_messages WHERE ticket=?", t.id);
      this.db.run("DELETE FROM nanba_support_tickets WHERE id=?", t.id);
    }
  }
}
