import { workerData, parentPort } from "node:worker_threads";
import { DB } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
const db = new DB(workerData.path),
  a = new Domain(db, () => workerData.now);
parentPort!.postMessage({ ready: true });
Atomics.wait(new Int32Array(workerData.gate), 0, 0);
try {
  parentPort!.postMessage({
    status: a.action(
      { userId: workerData.userId, groupId: "paris" },
      workerData.offerId,
      "enroll",
      { accept: true, version: workerData.version },
    ).status,
  });
} catch (e) {
  parentPort!.postMessage({ error: String(e) });
} finally {
  db.close();
}
