import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedDb } from "../app/lib/seed";

const dbPath = path.join(process.cwd(), "data", "mvp-db.json");

mkdir(path.dirname(dbPath), { recursive: true })
  .then(() => writeFile(dbPath, JSON.stringify(seedDb, null, 2)))
  .then(() => {
    console.log("Seeded data/mvp-db.json");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
