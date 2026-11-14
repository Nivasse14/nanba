import { DB } from "../src/db.ts";
import { Domain } from "../src/modules.ts";
import { seed } from "../src/seed.ts";
if (
  process.env.NODE_ENV === "production" ||
  process.env.WHATSAPP_MODE === "waha"
)
  throw new Error("Demo seed is development/simulated only");
const db = new DB(process.env.DATABASE_PATH ?? "data/development.db");
seed(new Domain(db));
db.close();
console.log("Synthetic demo dataset ready. See README for local profiles.");
