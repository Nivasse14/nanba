// Read module definitions only; never inspect account, message or QR values.
import { createRequire } from "node:module";
const requireWaha = createRequire("/app/package.json");
const { Client } = requireWaha("whatsapp-web.js");
const originalInject = Client.prototype.inject;
Client.prototype.inject = async function (...args) {
  try {
    return await originalInject.apply(this, args);
  } catch (error) {
    try {
      const summary = await this.pupPage.evaluate(() => {
        const safeRequire = (name) => {
          try {
            return window.require?.(name);
          } catch {
            return undefined;
          }
        };
        const registry = safeRequire("__debug")?.modulesMap || {};
        const names = Object.keys(registry)
          .filter((name) =>
            /SocketModel|LaunchSocket|ConnModel|RegistrationUtils|AltDeviceLinking|Main.*Loadable|Login.*Loadable|Auth.*Loadable|QR.*Loadable/.test(
              name,
            ),
          )
          .slice(0, 80);
        const exports = names.map((name) => ({
          name,
          keys: Object.keys(safeRequire(name) || {}).slice(0, 35),
          definitionKeys: Object.keys(registry[name] || {}).slice(0, 20),
        }));
        return {
          registryCount: Object.keys(registry).length,
          requireType: typeof window.require,
          socketType: typeof safeRequire("WAWebSocketModel"),
          modules: exports,
          qrShape: (() => {
            const canvas = document.querySelector("[data-ref] canvas");
            const value =
              canvas?.closest("[data-ref]")?.getAttribute("data-ref") || "";
            return {
              canvasPresent: !!canvas,
              length: value.length,
              fields: value.split(",").length,
            };
          })(),
          refreshLoginSource: String(
            safeRequire("WAWebLoginLaunchSocketUtils")?.refreshLoginQR,
          ).slice(0, 2500),
          socketFactory: String(registry.WAWebSocketModel?.factory).slice(
            0,
            1500,
          ),
          loginStateModules: Object.keys(registry)
            .filter((name) =>
              /Login.*State|Comms.*State|Socket.*State|Conn.*State/.test(name),
            )
            .slice(0, 35),
        };
      });
      console.error("[nanba-module-diagnostic-v2] " + JSON.stringify(summary));
    } catch {
      console.error('[nanba-module-diagnostic-v2] {"unavailable":true}');
    }
    throw error;
  }
};
