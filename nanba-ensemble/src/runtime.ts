import { check } from "./validation.ts";
// Platform-generated secrets stay in the environment; never log them.
export function configureRuntime(env: NodeJS.ProcessEnv) {
  if (env.IDENTITY_ENCRYPTION_KEY_BASE64 && !env.IDENTITY_ENCRYPTION_KEY) {
    const bytes = Buffer.from(env.IDENTITY_ENCRYPTION_KEY_BASE64, "base64");
    check(bytes.length === 32, "invalid_platform_encryption_key", 503);
    env.IDENTITY_ENCRYPTION_KEY = bytes.toString("hex");
  }
  if (!env.APP_ORIGIN && env.RENDER_EXTERNAL_URL) {
    const url = new URL(env.RENDER_EXTERNAL_URL);
    check(url.protocol === "https:", "public_https_required", 503);
    env.APP_ORIGIN = url.origin;
  }
  if (env.WAHA_PRIVATE_HOSTPORT) {
    check(env.RENDER === "true", "private_network_requires_render", 503);
    check(
      /^[a-z0-9][a-z0-9-]*:\d{2,5}$/.test(env.WAHA_PRIVATE_HOSTPORT),
      "invalid_private_service_address",
      503,
    );
    env.WAHA_URL = "http://" + env.WAHA_PRIVATE_HOSTPORT;
  }
}
