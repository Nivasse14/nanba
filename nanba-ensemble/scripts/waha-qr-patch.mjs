// Temporary compatibility fix for WAHA 2026.10.1's pinned WEBJS fork.
// Its cancelPairingCode already uses WAWebLaunchSocketUtils, while the
// UNPAIRED_IDLE callback still calls the removed WAWebCmd.Cmd.refreshQR.
// Upstream: devlikeapro/whatsapp-web.js, src/Client.js, exact yarn.lock commit
// e2c7fdea6a2efad1e786c422e59f534eb45ab44c. The named fork tag has moved.
import { readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

export const originalHash =
  "2b047b691a7aca07581302daae041f8199802925447cd2bb9264fdb7de59dd5e";
export const previousCall = "window.require('WAWebCmd').Cmd.refreshQR();";
export const replacementCall =
  "/* nanba-qr-refresh-v1 */ window.require('WAWebLaunchSocketUtils').refreshQR();";
const digest = (text) => createHash("sha256").update(text).digest("hex");

export function applyQrPatch(
  path = "/app/node_modules/whatsapp-web.js/src/Client.js",
) {
  const source = readFileSync(path, "utf8");
  const restored = source.replace(replacementCall, previousCall);
  if (
    source.includes(replacementCall) &&
    !source.includes(previousCall) &&
    digest(restored) === originalHash
  ) {
    return { status: "already_applied", sha256: digest(source) };
  }
  if (
    digest(source) !== originalHash ||
    source.split(previousCall).length !== 2
  ) {
    throw new Error("nanba_qr_patch_upstream_mismatch");
  }
  const patched = source.replace(previousCall, replacementCall);
  const temporary = path + ".nanba-" + process.pid;
  writeFileSync(temporary, patched, { mode: statSync(path).mode & 0o777 });
  renameSync(temporary, path);
  return { status: "applied", sha256: digest(patched) };
}
