import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { ShortcutTrainerDatabase } from "./database";
import type { Attempt } from "../data/questionSchema";
import { sampleQuestions } from "../data/sampleQuestions";

describe("version 1 migration", () => {
  it("preserves records, builds missing mastery and survives reopening", async () => {
    const name = `shortcut-trainer-test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod",
      sessions: "id, mode, startedAt, completedAt",
      mastery: "questionId, score, reviewDueAt, lastReviewedAt",
      customQuestions: "id, category, difficulty, enabled",
      settings: "key", achievements: "id, unlockedAt", metadata: "key",
    });
    const attempt: Attempt = { id: "a1", questionId: "windows-copy", questionRevision: 1, sessionId: "s1", timestamp: "2026-01-01T12:00:00.000Z", mode: "quiz", gradingMethod: "keyboard", correct: true, firstTry: true, interrupted: false };
    await old.open();
    await old.table("attempts").add(attempt);
    await old.table("attempts").add({ ...attempt, id: "a2", questionId: "other" });
    await old.table("settings").add({ key: "custom", value: "kept" });
    await old.table("mastery").add({ questionId: "other", score: 77, reviewDueAt: "2026-01-01T00:00:00.000Z", intervalDays: 1, easeFactor: 2.5, lapses: 0, algorithmVersion: 1 });
    old.close();
    const db = new ShortcutTrainerDatabase(name);
    try {
      await db.open();
      expect(db.verno).toBe(4);
      expect(await db.attempts.get("a1")).toEqual(attempt);
      expect(await db.settings.get("custom")).toEqual({ key: "custom", value: "kept" });
      expect(await db.mastery.get("windows-copy")).toMatchObject({ intervalDays: 1, algorithmVersion: 1 });
      expect((await db.mastery.get("other"))?.score).toBe(77);
      db.close();
      await db.open();
      expect(await db.attempts.count()).toBe(2);
      expect(await db.mastery.count()).toBe(2);
    } finally { await db.delete(); }
  });

  it("rolls back migration on invalid legacy records without deleting data", async () => {
    const name = `shortcut-trainer-test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod",
      sessions: "id, mode, startedAt, completedAt",
      mastery: "questionId, score, reviewDueAt, lastReviewedAt",
      customQuestions: "id, category, difficulty, enabled",
      settings: "key", achievements: "id, unlockedAt", metadata: "key",
    });
    await old.open();
    await old.table("attempts").add({ id: "invalid", questionId: "windows-copy" });
    await old.table("settings").add({ key: "keep", value: 42 });
    old.close();
    const db = new ShortcutTrainerDatabase(name);
    try {
      await expect(db.open()).rejects.toThrow();
      await old.open();
      expect(await old.table("attempts").get("invalid")).toEqual({ id: "invalid", questionId: "windows-copy" });
      expect(await old.table("settings").get("keep")).toEqual({ key: "keep", value: 42 });
      expect(await old.table("mastery").count()).toBe(0);
    } finally { old.close(); db.close(); await db.delete(); }
  });

  it("moves a colliding custom question and all references atomically", async () => {
    const name = `shortcut-trainer-test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(2).stores({
      attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod",
      sessions: "id, mode, startedAt, completedAt",
      mastery: "questionId, score, reviewDueAt, lastReviewedAt",
      customQuestions: "id, category, difficulty, enabled",
      settings: "key", achievements: "id, unlockedAt", metadata: "key",
    });
    const id = "windows-copy";
    const custom = { ...sampleQuestions[0], action: "衝突前の独自問題", description: "独自問題の説明" };
    const attempt: Attempt = {
      id: "collision-attempt", questionId: id, questionRevision: 1, sessionId: "collision-session",
      timestamp: "2026-01-01T12:00:00.000Z", mode: "quiz", gradingMethod: "keyboard",
      correct: false, firstTry: true, interrupted: false,
    };
    await old.open();
    await old.table("customQuestions").add(custom);
    await old.table("attempts").add(attempt);
    await old.table("mastery").add({
      questionId: id, score: 37, reviewDueAt: "2026-01-02T12:00:00.000Z", intervalDays: 1,
      easeFactor: 2.5, lastReviewedAt: attempt.timestamp, lapses: 1, algorithmVersion: 1,
    });
    await old.table("sessions").add({
      id: "collision-session", mode: "quiz", questionIds: [id], startedAt: attempt.timestamp,
      completedCount: 1, xp: 0,
    });
    old.close();

    const db = new ShortcutTrainerDatabase(name);
    try {
      await db.open();
      const newId = "custom-windows-copy";
      expect(await db.customQuestions.get(id)).toBeUndefined();
      expect(await db.customQuestions.get(newId)).toMatchObject({ id: newId, action: "衝突前の独自問題" });
      expect(await db.attempts.get(attempt.id)).toMatchObject({ ...attempt, questionId: newId });
      expect(await db.mastery.get(newId)).toMatchObject({ questionId: newId, score: 37 });
      expect(await db.sessions.get("collision-session")).toMatchObject({ questionIds: [newId] });
      expect(await db.mastery.get(id)).toBeUndefined();
    } finally { old.close(); db.close(); await db.delete(); }
  });

  it("adds the verification table to version 3 without changing learning records", async () => {
    const name = `shortcut-trainer-test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(3).stores({
      attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod",
      sessions: "id, mode, startedAt, completedAt",
      mastery: "questionId, score, reviewDueAt, lastReviewedAt",
      customQuestions: "id, category, difficulty, enabled",
      settings: "key", achievements: "id, unlockedAt", metadata: "key",
    });
    const attempt: Attempt = { id: "keep", questionId: "windows-copy", questionRevision: 1, sessionId: "s", timestamp: "2026-01-01T00:00:00.000Z", mode: "quiz", gradingMethod: "keyboard", correct: true, firstTry: true, interrupted: false };
    const mastery = { questionId: "windows-copy", questionRevision: 1, score: 90, reviewDueAt: "2026-01-02T00:00:00.000Z", intervalDays: 1, easeFactor: 2.5, lapses: 0, algorithmVersion: 1 };
    await old.open();
    await old.table("attempts").add(attempt);
    await old.table("mastery").add(mastery);
    old.close();
    const db = new ShortcutTrainerDatabase(name);
    try {
      await db.open();
      expect(db.verno).toBe(4);
      expect(await db.attempts.get("keep")).toEqual(attempt);
      expect(await db.mastery.get("windows-copy")).toEqual(mastery);
      expect(await db.deviceVerifications.count()).toBe(0);
    } finally { old.close(); db.close(); await db.delete(); }
  });
});
