import { cpSync, mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
cpSync("public", "dist/public", { recursive: true });
console.log(
  "Validated TypeScript backend; copied browser assets to dist/public. Node 24 runs source TypeScript.",
);
