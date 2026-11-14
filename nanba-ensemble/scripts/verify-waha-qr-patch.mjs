import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import {
  applyQrPatch,
  previousCall,
  replacementCall,
} from "./waha-qr-patch.mjs";

const upstream = readFileSync(process.argv[2], "utf8");
const temporary = mkdtempSync(join(tmpdir(), "nanba-qr-test-"));
const target = join(temporary, "Client.cjs");
try {
  writeFileSync(target, upstream);
  const result = applyQrPatch(target);
  assert.equal(result.status, "applied");
  const patched = readFileSync(target, "utf8");
  assert.equal(patched.replace(replacementCall, previousCall), upstream);
  assert.equal(spawnSync(process.execPath, ["--check", target]).status, 0);
  assert.equal(applyQrPatch(target).status, "already_applied");
  assert.equal(readFileSync(target, "utf8"), patched);

  let refreshes = 0;
  const browser = {
    window: {
      require(module) {
        if (module === "WAWebCmd") return { Cmd: {} };
        assert.equal(module, "WAWebLaunchSocketUtils");
        return { refreshQR: () => refreshes++ };
      },
    },
  };
  assert.throws(() => runInNewContext(previousCall, browser), /not a function/);
  runInNewContext(replacementCall, browser);
  assert.equal(refreshes, 1);

  // Verify the exact startup mechanism on Node 24 before shipping it.
  writeFileSync(target, upstream);
  const loader =
    readFileSync(new URL("./waha-qr-patch.mjs", import.meta.url), "utf8") +
    "\nconsole.error(JSON.stringify(applyQrPatch(" +
    JSON.stringify(target) +
    ")));";
  const options =
    "--max-old-space-size=16384 --import=data:text/javascript;base64," +
    Buffer.from(loader).toString("base64");
  const run = spawnSync(
    process.execPath,
    ["-e", "console.log('main-started')"],
    {
      env: { ...process.env, NODE_OPTIONS: options },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /main-started/);
  assert.match(run.stderr, /applied/);
  assert.equal(readFileSync(target, "utf8"), patched);

  writeFileSync(target, upstream + "\n// Unexpected source change\n");
  const unknown = readFileSync(target, "utf8");
  assert.throws(() => applyQrPatch(target), /upstream_mismatch/);
  assert.equal(readFileSync(target, "utf8"), unknown);
  console.log(
    JSON.stringify({
      node: process.version,
      result,
      checks: [
        "one call changed in the exact pinned upstream source",
        "JavaScript syntax valid",
        "idempotent on repeated startup",
        "reproduced missing old method and verified replacement call",
        "NODE_OPTIONS preload runs before application entrypoint",
        "unknown upstream source rejected without modification",
      ],
    }),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
