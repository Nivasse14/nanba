import { readFileSync } from "node:fs";
const source =
  readFileSync(new URL("./waha-login-compat.mjs", import.meta.url), "utf8") +
  "\ninstallLoginCompatibility();\n";
console.log(
  "--max-old-space-size=16384 --import=data:text/javascript;base64," +
    Buffer.from(source).toString("base64"),
);
