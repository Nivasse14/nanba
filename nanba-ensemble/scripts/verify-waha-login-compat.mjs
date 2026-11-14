import assert from "node:assert/strict";
import { compatibleInject, validLoginQr } from "./waha-login-compat.mjs";
const qr =
  "2@" +
  "A".repeat(70) +
  "," +
  "B".repeat(44) +
  "," +
  "C".repeat(44) +
  "," +
  "D".repeat(44) +
  ",1";
const events = { QR_RECEIVED: "qr" };
assert.equal(validLoginQr(qr), true);
assert.equal(validLoginQr("short,invalid"), false);
assert.equal(validLoginQr(qr + ",extra"), false);
assert.equal(validLoginQr(qr + "\n"), false);
assert.equal(validLoginQr(qr.replace("B".repeat(44), "")), false);
assert.equal(validLoginQr(qr.replace("2@", "2@!")), true);
const make = () => ({
  pupPage: { isClosed: () => false },
  sent: [],
  emit(event, value) {
    this.sent.push([event, value]);
  },
});
let called = 0,
  t = 0,
  refreshed = 0;
const original = async () => {
  called++;
  return "original-result";
};
const client = make();
const states = [
  { modernLogin: true, qr },
  { modernLogin: true, qr },
  { modernLogin: true, qr: qr.replace("2@", "3@") },
  { modernLogin: true, qr: qr.replace("2@", "3@"), reloadVisible: true },
  { classicReady: true },
];
const result = await compatibleInject(client, original, events, [], {
  read: async () => states.shift(),
  now: () => t,
  pause: async () => {
    t += 750;
  },
  refresh: async () => {
    refreshed++;
  },
});
assert.equal(result, "original-result");
assert.equal(called, 1);
assert.equal(client.sent.length, 2);
assert.equal(refreshed, 1);
assert.ok(client.sent.every(([name]) => name === "qr"));
// A page that has a canvas but no genuine QR must never become ready.
t = 0;
await assert.rejects(
  compatibleInject(make(), original, events, [], {
    read: async () => ({ modernLogin: true, qr: "invalid" }),
    now: () => t,
    pause: async () => {
      t += 10000;
    },
  }),
  /modules_unavailable/,
);
// Closing the browser ends the observer instead of retaining an orphan loop.
const closed = make();
closed.pupPage.isClosed = () => true;
await assert.rejects(compatibleInject(closed, original, events), /page_closed/);
// Navigation replaces a pending observer; only the new invocation continues.
const concurrent = make();
let release;
const first = compatibleInject(concurrent, original, events, [], {
  read: () =>
    new Promise((resolve) => {
      release = resolve;
    }),
});
const second = compatibleInject(concurrent, original, events, [], {
  read: async () => ({ classicReady: true }),
});
release({ modernLogin: true, qr });
await Promise.all([first, second]);
assert.equal(concurrent.sent.length, 0);
assert.equal(called, 2);
console.log(
  "PASS: genuine QR validation, deduplication, native expiry refresh, original authenticated initialization, no forged ready event, timeout, browser close, navigation cancellation",
);
