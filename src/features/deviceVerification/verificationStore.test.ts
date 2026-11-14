import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleQuestions } from "../../data/sampleQuestions";
import { database } from "../../db/database";
import { countResults, latestVerifications, listVerifications, saveVerification } from "./verificationStore";
import type { DeviceVerification } from "../../data/deviceVerification";

vi.mock("../../db/database", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../db/database")>();
  return { ...original, database: new original.ShortcutTrainerDatabase(`device-test-${crypto.randomUUID()}`) };
});

const record: DeviceVerification = {
  id: "verification-1", questionId: "windows-copy", questionRevision: 1,
  result: "success", confirmedInTarget: true, verifiedAt: "2026-01-01T10:00:00.000Z",
  recordedAt: "2026-01-01T10:00:00.000Z", os: "Windows 11", browser: "Edge 130",
  application: "Explorer", keyboardLayout: "JIS", notes: "", capture: "not_tested",
};

beforeEach(async () => { await Promise.all(database.tables.map((table) => table.clear())); });
afterAll(async () => { await database.delete(); });

describe("device verification", () => {
  it("requires explicit target confirmation and saves without changing learning data", async () => {
    const mastery = { questionId: record.questionId, score: 77, reviewDueAt: "2026-01-02T00:00:00.000Z", intervalDays: 1, easeFactor: 2.5, lapses: 0, algorithmVersion: 1 };
    await database.mastery.add(mastery);
    await expect(saveVerification({ ...record, confirmedInTarget: false })).rejects.toThrow();
    await expect(saveVerification({ ...record, questionRevision: 2 })).rejects.toThrow(/revision/);
    await saveVerification(record);
    expect(await listVerifications()).toEqual([record]);
    expect(await database.mastery.get(record.questionId)).toEqual(mastery);
    expect(await database.attempts.count()).toBe(0);
    expect(sampleQuestions.find((question) => question.id === record.questionId)?.verification).toBe("docs_checked");
  });

  it("uses only the most recently recorded result for the current revision", () => {
    const question = sampleQuestions.find((item) => item.id === "powerpoint-new-slide")!;
    const old = { ...record, id: "old", questionId: question.id, questionRevision: 1 };
    expect(countResults([question], latestVerifications([question], [old]))).toEqual({ success: 0, mismatch: 0, unavailable: 0, unverified: 1 });
    const current = { ...old, id: "current", questionRevision: question.revision, result: "mismatch" as const, confirmedInTarget: false };
    const unavailable = { ...current, id: "latest", result: "unavailable" as const, recordedAt: "2026-01-02T10:00:00.000Z" };
    expect(countResults([question], latestVerifications([question], [unavailable, old, current]))).toEqual({ success: 0, mismatch: 0, unavailable: 1, unverified: 0 });
    expect(countResults(sampleQuestions, latestVerifications(sampleQuestions, [record]))).toEqual({ success: 1, mismatch: 0, unavailable: 0, unverified: 179 });
  });
});
