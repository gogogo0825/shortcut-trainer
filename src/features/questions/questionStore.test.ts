import Papa from "papaparse";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { database } from "../../db/database";
import { sampleQuestions } from "../../data/sampleQuestions";
import { validateQuestions } from "../../data/validateQuestions";
import { importCustomQuestions, loadQuestions, parseQuestionFile, retireCustomQuestion, saveCustomQuestion } from "./questionStore";
import { makeBackup, parseBackup, restoreBackup } from "./backup";
import { resolveStandardQuestionIdCollisions } from "../../db/questionIdentity";

vi.mock("../../db/database", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../db/database")>();
  return { ...original, database: new original.ShortcutTrainerDatabase(`phase4-test-${crypto.randomUUID()}`) };
});

const custom = { ...sampleQuestions[0], id: "custom-copy", action: "独自コピー", description: "説明" };
const attempt = {
  id: "attempt", questionId: custom.id, questionRevision: 1, sessionId: "session",
  timestamp: "2026-01-01T00:00:00.000Z", mode: "quiz" as const, gradingMethod: "keyboard" as const,
  correct: true, firstTry: true, interrupted: false,
};

beforeEach(async () => {
  await Promise.all(database.tables.map((table) => table.clear()));
});
afterAll(async () => { await database.delete(); });

describe("question validation and import", () => {
  it("rejects malformed, duplicate, unsafe and unsupported data", () => {
    expect(() => parseQuestionFile("{", "json")).toThrow();
    expect(() => validateQuestions([custom, custom])).toThrow(/重複/);
    expect(() => validateQuestions([{ ...custom, source: { publisher: "x", url: "javascript:alert(1)" } }])).toThrow();
    expect(() => validateQuestions([{ ...custom, source: { publisher: "未確認" }, verification: "docs_checked" }])).toThrow(/出典/);
    expect(() => parseQuestionFile("x".repeat(2 * 1024 * 1024 + 1), "json")).toThrow(/2 MiB/);
  });

  it("parses CSV quoted commas, quotes and newlines with empty optional fields", () => {
    const row = {
      ...custom, action: 'コピー, "引用"\n続き', revision: "1", enabled: "true",
      platform: JSON.stringify(custom.platform), appVersions: "", targetTimeMs: "",
      steps: JSON.stringify(custom.steps), gradingModes: JSON.stringify(custom.gradingModes),
      source: JSON.stringify(custom.source), tags: JSON.stringify(custom.tags),
    };
    const [parsed] = parseQuestionFile(Papa.unparse([row]), "csv");
    expect(parsed.action).toBe(row.action);
    expect(parsed.targetTimeMs).toBeUndefined();
  });

  it("preserves original standard identifiers and revisions", () => {
    expect(sampleQuestions.slice(0, 6).map((q) => [q.id, q.revision])).toEqual([
      ["windows-copy", 1], ["excel-save", 1], ["word-bold", 1], ["powerpoint-new-slide", 2], ["vscode-command-palette", 1], ["browser-new-tab", 1],
    ]);
  });

  it("protects history during editing and soft deletion", async () => {
    await saveCustomQuestion(custom);
    await database.attempts.add(attempt);
    await expect(saveCustomQuestion({ ...custom, id: "changed", revision: 2 }, custom.id)).rejects.toThrow(/ID/);
    await expect(saveCustomQuestion({ ...custom, action: "別の操作", revision: 2 }, custom.id)).rejects.toThrow(/履歴/);
    await saveCustomQuestion({ ...custom, description: "修正", revision: 2 }, custom.id);
    await retireCustomQuestion(custom.id);
    expect(await database.customQuestions.get(custom.id)).toMatchObject({ enabled: false, revision: 3 });
    expect(await database.attempts.get(attempt.id)).toEqual(attempt);
    expect((await loadQuestions()).find((q) => q.id === custom.id)?.enabled).toBe(false);
    await expect(saveCustomQuestion(custom)).rejects.toThrow(/ID/);
  });

  it("rolls back a batch on collision or used history ID", async () => {
    await database.attempts.add(attempt);
    await expect(importCustomQuestions([{ ...custom, id: "new", action: "別の操作" }, custom], "replace")).rejects.toThrow(/履歴/);
    expect(await database.customQuestions.count()).toBe(0);
    await expect(importCustomQuestions([sampleQuestions[0]], "skip")).rejects.toThrow(/標準/);
  });

  it("keeps standard and custom questions available and moves colliding history", async () => {
    const id = "windows-copy";
    await database.customQuestions.add({ ...custom, id, action: "衝突した独自問題" });
    await database.attempts.add({ ...attempt, questionId: id });
    await database.mastery.add({
      questionId: id, score: 44, reviewDueAt: "2026-01-02T00:00:00.000Z", intervalDays: 1,
      easeFactor: 2.5, lapses: 1, algorithmVersion: 1,
    });
    await database.sessions.add({
      id: "session", mode: "quiz", questionIds: [id], startedAt: attempt.timestamp,
      completedCount: 1, xp: 0,
    });

    const questions = await loadQuestions();
    expect(questions.find((question) => question.id === id)?.action).toBe(sampleQuestions[0].action);
    expect(questions.find((question) => question.id === `custom-${id}`)?.action).toBe("衝突した独自問題");
    expect((await database.attempts.get(attempt.id))?.questionId).toBe(`custom-${id}`);
    expect(await database.mastery.get(`custom-${id}`)).toMatchObject({ questionId: `custom-${id}`, score: 44 });
    expect((await database.sessions.get("session"))?.questionIds).toEqual([`custom-${id}`]);
    expect(await database.customQuestions.get(id)).toBeUndefined();
  });

  it("rolls back all collision changes when a later save fails", async () => {
    const id = "windows-copy";
    await database.customQuestions.add({ ...custom, id });
    await database.attempts.add({ ...attempt, questionId: id });
    await expect(database.transaction("rw", [database.attempts, database.sessions, database.mastery, database.customQuestions], async (tx) => {
      await resolveStandardQuestionIdCollisions(tx);
      throw new Error("simulated save failure");
    })).rejects.toThrow(/simulated save failure/);
    expect(await database.customQuestions.get(id)).toBeDefined();
    expect(await database.customQuestions.get(`custom-${id}`)).toBeUndefined();
    expect((await database.attempts.get(attempt.id))?.questionId).toBe(id);
  });

  it("retains old revision answers when a standard question is corrected", async () => {
    const old = { ...attempt, questionId: "powerpoint-new-slide", questionRevision: 1 };
    await database.attempts.add(old);
    const current = (await loadQuestions()).find((q) => q.id === old.questionId);
    expect(current?.revision).toBe(2);
    expect(await database.attempts.get(old.id)).toEqual(old);
  });
});

describe("backup and restore", () => {
  it("round trips all stored records and skips identical records", async () => {
    await saveCustomQuestion(custom);
    await database.attempts.add(attempt);
    await database.settings.add({ key: "test", value: { enabled: true } });
    const backup = parseBackup(JSON.stringify(await makeBackup()));
    expect(backup.version).toBe(3);
    const result = await restoreBackup(backup);
    expect(result.skipped).toBe(3);
    expect(await database.attempts.get("attempt")).toEqual(attempt);
    expect(await database.mastery.get(custom.id)).toBeDefined();
  });

  it("continues to parse version 1 backups without mastery revision metadata", async () => {
    const backup = await makeBackup();
    backup.version = 1;
    delete backup.deviceVerifications;
    backup.mastery.push({
      questionId: "powerpoint-new-slide", score: 60, reviewDueAt: "2026-01-02T00:00:00.000Z",
      intervalDays: 1, easeFactor: 2.5, lapses: 0, algorithmVersion: 1,
    });

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.version).toBe(1);
    expect(parsed.mastery[0]?.questionRevision).toBeUndefined();
  });

  it("backs up verification history and rolls back a conflicting restore", async () => {
      const verification = {
        id: "device-record", questionId: "windows-copy", questionRevision: 1,
        result: "success" as const, confirmedInTarget: true,
        verifiedAt: "2026-01-01T00:00:00.000Z", recordedAt: "2026-01-01T00:00:00.000Z",
        os: "Windows 11", browser: "Edge 130", application: "Explorer", keyboardLayout: "JIS",
        notes: "", capture: "not_tested" as const,
      };
      await database.deviceVerifications.add(verification);
      const backup = parseBackup(JSON.stringify(await makeBackup()));
      expect(backup.deviceVerifications).toEqual([verification]);
      await database.deviceVerifications.clear();
      await restoreBackup(backup);
      expect(await database.deviceVerifications.get(verification.id)).toEqual(verification);
      await database.deviceVerifications.put({ ...verification, notes: "different" });
      backup.customQuestions.push(custom);
      await expect(restoreBackup(backup)).rejects.toThrow(/実機検証記録ID/);
      expect(await database.customQuestions.count()).toBe(0);
      expect((await database.deviceVerifications.get(verification.id))?.notes).toBe("different");
  });

  it("accepts version 2 backups without verification records", async () => {
      const backup = await makeBackup();
      backup.version = 2;
      delete backup.deviceVerifications;
      expect(parseBackup(JSON.stringify(backup)).version).toBe(2);
      await expect(restoreBackup(backup)).resolves.toBeDefined();
  });

  it("rolls back earlier additions when a later session conflicts", async () => {
    const backup = await makeBackup();
    backup.customQuestions.push(custom);
    const session = { id: "session", mode: "quiz" as const, questionIds: [custom.id], startedAt: "2026-01-01T00:00:00.000Z", completedCount: 0, xp: 0 };
    backup.sessions.push(session);
    await database.sessions.add({ ...session, questionIds: [], xp: 1 });
    await expect(restoreBackup(backup)).rejects.toThrow(/セッションID/);
    expect(await database.customQuestions.count()).toBe(0);
    expect(await database.sessions.get("session")).toMatchObject({ xp: 1 });
  });

  it("restores a colliding legacy backup with consistent remapped references", async () => {
    const id = "windows-copy";
    const collision = { ...custom, id, action: "バックアップ内の独自問題" };
    const collisionAttempt = { ...attempt, questionId: id };
    await database.customQuestions.add(collision);
    await database.attempts.add(collisionAttempt);
    await database.sessions.add({
      id: "session", mode: "quiz", questionIds: [id], startedAt: attempt.timestamp,
      completedCount: 1, xp: 0,
    });
    await database.mastery.add({
      questionId: id, score: 62, reviewDueAt: "2026-01-02T00:00:00.000Z", intervalDays: 1,
      easeFactor: 2.5, lapses: 0, algorithmVersion: 1,
    });
    const backup = parseBackup(JSON.stringify(await makeBackup()));
    await Promise.all(database.tables.map((table) => table.clear()));

    const result = await restoreBackup(backup);
    expect(result.remapped).toBe(1);
    expect(await database.customQuestions.get(`custom-${id}`)).toMatchObject({ action: "バックアップ内の独自問題" });
    expect((await database.attempts.get(attempt.id))?.questionId).toBe(`custom-${id}`);
    expect((await database.sessions.get("session"))?.questionIds).toEqual([`custom-${id}`]);
    expect(await database.mastery.get(`custom-${id}`)).toMatchObject({ questionId: `custom-${id}` });
  });

  it("rejects duplicate IDs, unsafe custom sources and corrupted backups", async () => {
    const backup = await makeBackup();
    backup.customQuestions.push(custom, custom);
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/重複/);
    backup.customQuestions = [{ ...custom, source: { publisher: "x", url: "javascript:alert(1)" } }];
    expect(() => parseBackup(JSON.stringify(backup))).toThrow();
    expect(() => parseBackup("{")).toThrow();
  });
});
