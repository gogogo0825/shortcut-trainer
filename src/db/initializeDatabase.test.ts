import { afterEach, describe, expect, it } from "vitest";
import { database } from "./database";
import { initializeDatabase } from "./initializeDatabase";

describe("initializeDatabase", () => {
  afterEach(async () => {
    await database.delete();
  });

  it("opens schema version 4 and applies defaults idempotently", async () => {
    await initializeDatabase();
    await initializeDatabase();

    expect(database.verno).toBe(4);
    expect(database.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "attempts",
        "sessions",
        "mastery",
        "customQuestions",
        "settings",
        "achievements",
        "metadata",
        "deviceVerifications",
      ]),
    );
    expect(await database.settings.get("theme")).toEqual({
      key: "theme",
      value: "system",
    });
    expect(await database.metadata.get("schemaVersion")).toEqual({
      key: "schemaVersion",
      value: 4,
    });
  });
});
