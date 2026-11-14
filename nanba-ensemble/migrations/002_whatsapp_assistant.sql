CREATE TABLE conversations (
  group_id TEXT NOT NULL REFERENCES groups(id),
  identity_hash TEXT NOT NULL REFERENCES identities(identity_hash) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK(json_valid(state)),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(group_id,identity_hash)
);
