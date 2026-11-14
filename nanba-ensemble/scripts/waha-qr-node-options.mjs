import { readFileSync } from "node:fs";

let loader =
  readFileSync(new URL("./waha-qr-patch.mjs", import.meta.url), "utf8") +
  '\nconsole.error("[nanba-qr-refresh-v1] "+JSON.stringify(applyQrPatch()));\n';
if (process.argv.includes("--recover-failed-profile")) {
  loader +=
    readFileSync(
      new URL("./waha-profile-recovery.mjs", import.meta.url),
      "utf8",
    ) +
    '\nif ((process.env.WHATSAPP_DEFAULT_ENGINE || "WEBJS").toUpperCase() !== "WEBJS" || (process.env.WAHA_SESSION_NAMESPACE || "webjs").toLowerCase() !== "webjs" || (process.env.WAHA_LOCAL_STORE_BASE_DIR && resolve(process.env.WAHA_LOCAL_STORE_BASE_DIR) !== "/app/.sessions")) throw new Error("recovery_unexpected_storage_configuration");\n' +
    'console.error("[nanba-profile-recovery-v1] "+JSON.stringify(recoverFailedProfile()));\n';
}
if (process.argv.includes("--diagnose-auth")) {
  loader += readFileSync(
    new URL("./waha-auth-diagnostic.mjs", import.meta.url),
    "utf8",
  );
}
// Preserve the pinned image's existing heap option. No credentials or network
// downloads are embedded in this preload. Only the verified Client.js changes.
console.log(
  "--max-old-space-size=16384 --import=data:text/javascript;base64," +
    Buffer.from(loader).toString("base64"),
);
