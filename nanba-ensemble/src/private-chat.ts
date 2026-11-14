import type { Domain } from "./modules.ts";
import { json, parse, type Row } from "./db.ts";

export function scopes(a: Domain, userId: string) {
  return a.db.all(
    "SELECT g.* FROM groups g JOIN memberships m ON m.group_id=g.id WHERE m.user_id=? AND m.active=1 AND g.allowed=1 AND COALESCE(json_extract(g.settings,'$.privateChat'),0)=0 ORDER BY g.name,g.id",
    userId,
  );
}

// Called only after webhook signature and session verification. An incoming
// message is the consent to reply privately; no private message is initiated
// from a group command and no user-supplied phone becomes a destination.
export function preparePrivateChat(a: Domain, body: Row) {
  const p = body.payload;
  // The linked owner explicitly enables the current group from their phone.
  // No arbitrary chat ID supplied in message text can authorize a destination.
  if (
    body.session === a.session &&
    body.event === "message.any" &&
    p?.fromMe &&
    p.source !== "api" &&
    body.source !== "api" &&
    typeof p.to === "string" &&
    /^\d+(?:-\d+)?@g\.us$/.test(p.to) &&
    /^nanba activer groupe\s+\S/i.test(p.body ?? "") &&
    Math.abs(a.now() - Number(p.timestamp) * 1000) < 600000 &&
    typeof body.me?.id === "string"
  ) {
    const ownerHash = a.identity(a.mode, a.session, body.me.id);
    const identity = a.db.get(
      "SELECT user_id FROM identities WHERE identity_hash=?",
      ownerHash,
    );
    const bootstrap =
      identity?.user_id &&
      a.db.get(
        "SELECT g.* FROM groups g JOIN memberships m ON m.group_id=g.id WHERE g.chat_id=? AND json_extract(g.settings,'$.selfTest')=1 AND m.user_id=? AND m.role='group_admin' AND m.active=1",
        body.me.id,
        identity.user_id,
      );
    if (bootstrap && !a.db.get("SELECT 1 FROM groups WHERE chat_id=?", p.to)) {
      a.db.tx(() => {
        const id = "wa-" + p.to.split("@")[0];
        a.db.run(
          "INSERT INTO groups(id,community_id,name,zone,chat_id,allowed,settings) VALUES(?,?,?,?,?,1,?)",
          id,
          bootstrap.community_id,
          p.body.replace(/^nanba activer groupe\s+/i, "").slice(0, 120),
          "France",
          p.to,
          json({ assistantEnabled: true }),
        );
        a.db.run(
          "INSERT INTO memberships VALUES(?,?,'group_admin',1)",
          identity.user_id,
          id,
        );
        a.audit(
          { userId: identity.user_id, groupId: id },
          "whatsapp.group_authorized_from_owner_phone",
        );
      });
    }
    return;
  }
  if (
    body.session !== a.session ||
    !["message", "message.any"].includes(body.event) ||
    !p ||
    p.fromMe ||
    p.source === "api" ||
    body.source === "api" ||
    typeof p.from !== "string" ||
    !/^[A-Za-z0-9_.:-]+@(c\.us|s\.whatsapp\.net|lid)$/.test(p.from) ||
    typeof p.body !== "string" ||
    !/^\/?nanba\b/i.test(p.body) ||
    Math.abs(a.now() - Number(p.timestamp) * 1000) > 600000
  )
    return;
  if (a.db.get("SELECT 1 FROM groups WHERE chat_id=?", p.from)) return;
  a.db.tx(() => {
    const identityHash = a.identity(a.mode, a.session, p.from);
    const identity = a.db.get(
      "SELECT * FROM identities WHERE identity_hash=?",
      identityHash,
    )!;
    if (!identity.user_id) return;
    const permitted = scopes(a, identity.user_id);
    if (!permitted.length) return;
    const scope = permitted[0],
      id = "private-" + identityHash;
    a.db.run(
      "INSERT INTO groups(id,community_id,name,zone,chat_id,allowed,settings) VALUES(?,?,?,?,?,1,?)",
      id,
      scope.community_id,
      "Conversation privée Nanba",
      scope.zone,
      p.from,
      json({
        assistantEnabled: true,
        privateChat: true,
        privateIdentity: identityHash,
        privateUser: identity.user_id,
        scopeGroupId: permitted.length === 1 ? scope.id : null,
      }),
    );
    a.db.run(
      "INSERT INTO memberships VALUES(?,?,'group_admin',1)",
      identity.user_id,
      id,
    );
    a.audit(
      { userId: identity.user_id, groupId: id },
      "whatsapp.private_consent",
    );
  });
}

export function isPrivate(group: Row) {
  const s = parse(group.settings ?? "{}");
  return (
    typeof group.chat_id === "string" &&
    /^[A-Za-z0-9_.:-]+@(c\.us|s\.whatsapp\.net|lid)$/.test(group.chat_id) &&
    (s.privateChat === true || s.selfTest === true)
  );
}
