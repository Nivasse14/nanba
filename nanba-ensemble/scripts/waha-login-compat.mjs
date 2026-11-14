// Compatibility for the separate WhatsApp Web login bundle (November 2026).
// Forward WhatsApp's genuine rendered QR, then let WEBJS perform its existing
// authenticated initialization. Never fabricate authentication/ready events.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const clientHash =
  "2b047b691a7aca07581302daae041f8199802925447cd2bb9264fdb7de59dd5e";
const controllers = new WeakMap();

export function validLoginQr(value) {
  if (typeof value !== "string" || value.length < 150 || value.length > 2048)
    return false;
  const fields = value.split(",");
  return (
    fields.length === 5 &&
    fields.slice(0, 4).every((field) => field.length > 0) &&
    fields.every((field) => /^[\x21-\x7e]*$/.test(field))
  );
}

export async function readLoginPage(client) {
  return client.pupPage.evaluate(() => {
    const get = (name) => {
      try {
        return window.require?.(name);
      } catch {
        return undefined;
      }
    };
    const canvas = document.querySelector("[data-ref] canvas");
    const qr = canvas?.closest("[data-ref]")?.getAttribute("data-ref") || "";
    const initialized = !!window.Debug?.VERSION;
    const socket = initialized ? get("WAWebSocketModel")?.Socket : undefined;
    const reloadVisible = Array.from(
      document.querySelectorAll('button,[role="button"]'),
    ).some((el) => {
      const label = (
        el.innerText ||
        el.getAttribute("aria-label") ||
        ""
      ).trim();
      return (
        el.getClientRects().length > 0 &&
        /^(click to reload qr code|reload qr code|click to reload|cliquez pour recharger le code qr|recharger le code qr)$/i.test(
          label,
        )
      );
    });
    return {
      classicReady: !!socket && typeof socket.state === "string",
      modernLogin:
        initialized &&
        typeof get("WAWebLoginLaunchSocketUtils")?.refreshLoginQR ===
          "function",
      qr,
      reloadVisible,
      diagnostic: (() => {
        if (!initialized) return { initialized: false };
        const record = get("__debug")?.modulesMap?.WAWebSocketModel;
        const self = get("WAWebUserPrefsMeUser");
        return {
          initialized: true,
          qrVisible: !!canvas?.getClientRects().length,
          selfAvailable:
            typeof self?.getMaybeMePnUser === "function" &&
            !!self.getMaybeMePnUser(),
          socketKeys: Object.keys(get("WAWebSocketModel") || {}),
          socketFinished: !!record?.factoryFinished,
          socketError: !!record?.hasError,
          socketErrorName: record?.error?.name || null,
          socketExports: Object.keys(record?.exports || {}),
          socketFactoryTail: String(record?.factory).slice(-650),
          collectionsAvailable: !!get("WAWebCollections")?.Chat,
        };
      })(),
    };
  });
}

export async function refreshExpiredQr(client) {
  return client.pupPage.evaluate(() => {
    const refresh = window.require?.(
      "WAWebLoginLaunchSocketUtils",
    )?.refreshLoginQR;
    if (typeof refresh !== "function")
      throw new Error("nanba_login_refresh_unavailable");
    refresh();
  });
}

export async function compatibleInject(
  client,
  original,
  events,
  args = [],
  io = {},
) {
  controllers.get(client)?.abort();
  client._injectAbort?.abort();
  const abort = new AbortController();
  controllers.set(client, abort);
  const now = io.now || Date.now;
  const pause =
    io.pause || (() => new Promise((resolve) => setTimeout(resolve, 750)));
  const read = io.read || readLoginPage;
  const refresh = io.refresh || refreshExpiredQr;
  const log = io.log || (() => {});
  let diagnosticSent = false;
  let lastDiagnostic = -Infinity;
  let lastQr = "",
    seenQr = false,
    lastProgress = now(),
    lastRefresh = -Infinity;
  try {
    while (!abort.signal.aborted) {
      if (client.pupPage.isClosed()) throw new Error("nanba_login_page_closed");
      let page;
      try {
        page = await read(client);
      } catch (error) {
        if (abort.signal.aborted) return;
        if (now() - lastProgress > 120000)
          throw new Error("nanba_login_navigation_timeout");
        await pause();
        continue;
      }
      if (abort.signal.aborted) return;
      if (now() - lastDiagnostic >= 30000 && page.diagnostic) {
        lastDiagnostic = now();
        log("transition_" + JSON.stringify(page.diagnostic));
      }
      if (!diagnosticSent && page.qr) {
        diagnosticSent = true;
        log(
          "qr_shape_" +
            JSON.stringify({
              length: page.qr.length,
              fields: page.qr.split(",").length,
              valid: validLoginQr(page.qr),
              modern: page.modernLogin,
            }),
        );
      }
      if (page.classicReady) {
        log("delegate_to_webjs");
        return await original.apply(client, args);
      }
      if (page.modernLogin && validLoginQr(page.qr)) {
        lastProgress = now();
        if (page.qr !== lastQr) {
          lastQr = page.qr;
          seenQr = true;
          client.emit(events.QR_RECEIVED, page.qr);
          log("native_qr_observed");
        }
      }
      // Only renew when WhatsApp visibly asks to reload its expired QR.
      // Never stop the pairing transport on an arbitrary wall-clock timer.
      if (
        seenQr &&
        page.modernLogin &&
        page.reloadVisible &&
        now() - lastRefresh >= 15000
      ) {
        await refresh(client);
        lastRefresh = now();
        lastProgress = now();
        log("expired_qr_refreshed");
      }
      if (now() - lastProgress > (seenQr ? 120000 : 45000))
        throw new Error("nanba_login_modules_unavailable");
      await pause();
    }
  } finally {
    if (controllers.get(client) === abort) controllers.delete(client);
  }
}

export function installLoginCompatibility() {
  const path = "/app/node_modules/whatsapp-web.js/src/Client.js";
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (hash !== clientHash) throw new Error("nanba_login_upstream_mismatch");
  const requireWaha = createRequire("/app/package.json");
  const { Client, Events } = requireWaha("whatsapp-web.js");
  const marker = Symbol.for("nanba.login.compat.v1");
  if (Client.prototype[marker]) return;
  const original = Client.prototype.inject;
  Client.prototype.inject = function (...args) {
    return compatibleInject(this, original, Events, args, {
      log: (phase) =>
        console.error("[nanba-login-compat-v1] " + JSON.stringify({ phase })),
    });
  };
  Client.prototype[marker] = true;
  console.error('[nanba-login-compat-v1] {"phase":"installed"}');
}
