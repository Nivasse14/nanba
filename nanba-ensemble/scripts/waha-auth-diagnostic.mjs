// Read-only diagnosis. Deliberately excludes QR values, account IDs and messages.
import { createRequire } from "node:module";
const requireWaha = createRequire("/app/package.json");
const { Client } = requireWaha("whatsapp-web.js");
const originalInject = Client.prototype.inject;
Client.prototype.inject = async function (...args) {
  try {
    return await originalInject.apply(this, args);
  } catch (error) {
    try {
      const state = await this.pupPage.evaluate(() => {
        const socket = window.require?.("WAWebSocketModel")?.Socket;
        const known = [
          "OPENING",
          "UNLAUNCHED",
          "PAIRING",
          "UNPAIRED",
          "UNPAIRED_IDLE",
          "CONNECTED",
          "TIMEOUT",
          "CONFLICT",
          "PROXYBLOCK",
          "TOS_BLOCK",
          "SMB_TOS_BLOCK",
          "DEPRECATED_VERSION",
        ];
        return {
          requireType: typeof window.require,
          requireLazyType: typeof window.requireLazy,
          socketModuleKeys: Object.keys(
            window.require?.("WAWebSocketModel") || {},
          ).slice(0, 20),
          launchModuleKeys: Object.keys(
            window.require?.("WAWebLaunchSocketUtils") || {},
          ).slice(0, 20),
          version: /^\d[\d.\-a-z]{0,60}$/.test(window.Debug?.VERSION)
            ? window.Debug.VERSION
            : "unknown",
          socketPresent: !!socket,
          state: known.includes(socket?.state)
            ? socket.state
            : typeof socket?.state,
          hasSynced: socket?.hasSynced === true,
          refreshFunction: typeof window.require?.("WAWebLaunchSocketUtils")
            ?.refreshQR,
          qrCanvasPresent: !!document.querySelector("canvas"),
        };
      });
      console.error("[nanba-auth-diagnostic-v1] " + JSON.stringify(state));
    } catch {
      console.error(
        '[nanba-auth-diagnostic-v1] {"diagnosticUnavailable":true}',
      );
    }
    throw error;
  }
};
