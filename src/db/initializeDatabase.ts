import { database } from "./database";

const DATABASE_VERSION_KEY = "schemaVersion";
const DATABASE_VERSION = 4;

export async function initializeDatabase(): Promise<void> {
  await database.open();
  await database.transaction("rw", database.settings, database.metadata, async () => {
    if (!(await database.settings.get("theme"))) {
      await database.settings.add({ key: "theme", value: "system" });
    }

    await database.metadata.put({
      key: DATABASE_VERSION_KEY,
      value: DATABASE_VERSION,
    });
  });
}
