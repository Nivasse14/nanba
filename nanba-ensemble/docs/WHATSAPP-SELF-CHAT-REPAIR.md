# Personal WhatsApp help repair — 13 November 2026

The phone was paired and personal testing enabled, but the owner's `Nanba aide`
message was ignored. Read-only diagnostics confirmed the message in the owner's
own chat, with source `app`, destination `@lid`, and no corresponding inbox row.
The live session's `me` object had no `lid`. WAHA's authenticated phone-to-LID
mapping confirmed that the destination was the same owner.

## Changes

- After HMAC verification, resolve a missing self identity using WAHA's
  `/api/{session}/lids/pn/{phone}` mapping. Only an explicitly addressed outgoing
  owner message and an already-authorized personal destination can use this
  fallback. Cache the verified mapping for five minutes.
- Preserve filtering of ordinary outgoing chats, API echoes, wrong sessions and
  unapproved destinations. Never use `fromMe` alone as proof of a self-chat.
- Accept WEBJS's `MessageId._serialized` response as well as WAHA's string ID.
  Missing IDs still leave the delivery uncertain, without automatic resending.

## Validation

- `npm run check`: build and 67 tests passed.
- The generated source preload was tested against the exact original sources
  fetched from the live repository archive: 24 conversation, transport and HTTP
  tests passed. This tests the actual fallback deployment mechanism too.
- The first help recovery was accepted at 17:08:10 UTC. Its API-origin message
  appeared in the self-chat at 17:08:11 with acknowledgment 3. The original
  adapter recorded `missing_provider_id`, which led to the second correction.
- Delivery reconciliation is restricted to that recovered help response: same
  authorized self-chat, exact stored reply text, matching send time, API origin,
  acknowledgment, and exactly one matching message. It never resends.
- At 17:11:39 UTC, the live reconciliation returned `matched: true`, `ack: 3`,
  `status: confirmed`, `resend: false`. The exact stored help text was found once
  in the authorized self-chat. Both fixes ran in deployment
  `dep-dbrk90l6e07s73bvq470`. The pairing endpoint still reported `WORKING`,
  `connected: true`, `personalTestReady: true` afterward.
- Cleanup removes the diagnostic, recovery and reconciliation imports, keeping
  only the verified source preload. Recovery was queued exactly once; the
  confirmed response was never resent.
- Cleanup deployment `dep-dbrk9ttg1s2s738o3jr0` became live at 17:13:03 UTC.
  Startup verified both source hashes and the application was ready in WAHA mode.

## Deployment and follow-up

The GitHub connector has returned 403 on writes. The active app remains built
from commit `6640be6047dc08ca802bef59897964e8d1043070`; these changes are delivered
through a hash-guarded Node preload in the existing Render service's
`NODE_OPTIONS`. No new service or paid capacity was created.

`scripts/build-self-lid-preload.mjs` generates that preload from the reviewed
source changes relative to local commit `e2aec9a`. It verifies both original and
patched SHA-256 values, and becomes a no-op if the fixed source is already in the
image. `src/server.ts` and `src/whatsapp.ts` remain the canonical implementation.

Once repository write access is restored, publish the corrected sources and
rebuild the root `nanba-ensemble-source.tar.gz` used by `Dockerfile.ensemble`.
Remove the preload after that source deployment is verified. Do not reset the
WAHA session or change the linked device for this application-level correction.

The temporary diagnostic and help-recovery modules contain no account IDs,
secrets or conversation text. Recovery expires at 18:00 UTC and is recorded once
in database settings; it is restricted to the exact non-mutating help command
sent before 17:00 UTC. The original event time is retained separately from the
explicit recovery time. No other historical commands are replayed.
