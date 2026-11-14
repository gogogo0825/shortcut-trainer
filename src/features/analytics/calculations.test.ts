import { describe, expect, it } from "vitest";
import type { Attempt } from "../../data/questionSchema";
import { sampleQuestions } from "../../data/sampleQuestions";
import { calculateMastery, dailyStats, isAnswered, methodStats, streakDays } from "./calculations";

function attempt(id: string, values: Partial<Attempt> = {}): Attempt {
  return {
    id, questionId: "windows-copy", questionRevision: 1, sessionId: "session",
    timestamp: "2026-03-01T10:00:00.000Z", mode: "quiz", gradingMethod: "keyboard",
    correct: true, firstTry: true, elapsedMs: 2000, interrupted: false, outcome: "answered",
    ...values,
  };
}

describe("mastery and interval repetition", () => {
  it("uses only first-try keyboard quiz answers and handles old records conservatively", () => {
    const invalid = [
      attempt("practice", { mode: "practice" }), attempt("retry", { firstTry: false }),
      attempt("choice", { gradingMethod: "multiple_choice" }), attempt("self", { gradingMethod: "self_assessment" }),
      attempt("skip", { outcome: "skipped" }), attempt("timeout", { outcome: "timeout" }),
      attempt("abandoned", { outcome: "abandoned" }), attempt("old-interrupted", { outcome: undefined, interrupted: true }),
    ];
    expect(calculateMastery(invalid)).toBeNull();
    expect(isAnswered(attempt("old", { outcome: undefined }))).toBe(true);
    const mastery = calculateMastery([...invalid, attempt("good")]);
    expect(mastery).toMatchObject({ questionId: "windows-copy", intervalDays: 1, lapses: 0, algorithmVersion: 1 });
    expect(mastery?.score).toBeGreaterThan(50);
    expect(mastery?.score).toBeLessThan(100);
    expect(mastery?.reviewDueAt).toBe("2026-03-02T10:00:00.000Z");
  });

  it("progresses 1/3/7/14/30 days and resets on error", () => {
    const entries = Array.from({ length: 5 }, (_, i) => attempt(String(i), { timestamp: `2026-03-0${i + 1}T10:00:00.000Z` }));
    expect(entries.map((_, i) => calculateMastery(entries.slice(0, i + 1))?.intervalDays)).toEqual([1, 3, 7, 14, 30]);
    const wrong = attempt("wrong", { timestamp: "2026-03-06T10:00:00.000Z", correct: false });
    expect(calculateMastery([...entries, wrong])).toMatchObject({ intervalDays: 1, lapses: 1, reviewDueAt: "2026-03-07T10:00:00.000Z" });
  });

  it("uses a neutral speed when no target is defined and excludes interrupted timing", () => {
    const fast = attempt("fast", { elapsedMs: 1000 });
    const slow = attempt("fast", { elapsedMs: 30_000 });
    expect(calculateMastery([fast])?.score).toBe(calculateMastery([slow])?.score);
    const q = { ...sampleQuestions[0], targetTimeMs: 2000 };
    expect(calculateMastery([fast], q)!.score).toBeGreaterThan(calculateMastery([slow], q)!.score);
    expect(calculateMastery([{ ...fast, interrupted: true }], q)!.score).toBe(calculateMastery([fast])!.score);
  });

  it("does not use old-revision answers in current mastery", () => {
    const question = sampleQuestions.find((item) => item.id === "powerpoint-new-slide")!;
    const oldCorrect = attempt("old-correct", { questionId: question.id, questionRevision: 1, correct: true });
    const oldWrong = attempt("old-wrong", { questionId: question.id, questionRevision: 1, correct: false });
    const currentWrong = attempt("current-wrong", { questionId: question.id, questionRevision: question.revision, correct: false });
    const mastery = calculateMastery([oldCorrect, oldWrong, currentWrong], question);

    expect(mastery).toMatchObject({ questionId: question.id, questionRevision: question.revision, lapses: 1 });
    expect(mastery?.score).toBe(calculateMastery([currentWrong], question)?.score);
  });
});

describe("analytics grouping", () => {
  it("separates method, mode and retries and excludes unscored events", () => {
    const records = [
      attempt("one"), attempt("two", { correct: false, interrupted: true }),
      attempt("three", { mode: "practice", firstTry: false }),
      attempt("four", { gradingMethod: "multiple_choice", elapsedMs: 4 }),
      attempt("five", { outcome: "skipped", correct: false }),
      attempt("six", { outcome: "abandoned", correct: false }),
    ];
    const groups = methodStats(records);
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.mode === "quiz" && g.method === "keyboard")).toMatchObject({ total: 2, correct: 1, averageMs: 2000 });
    expect(groups.find((g) => g.method === "multiple_choice")?.averageMs).toBeNull();
    expect(dailyStats(records)).toEqual([{ day: expect.any(String), answered: 2, correct: 1 }]);
  });

  it("calculates streaks across local midnight and year boundaries", () => {
    const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).toISOString();
    const records = [attempt("1", { timestamp: at(2025, 12, 31, 23) }), attempt("2", { timestamp: at(2026, 1, 1, 0) })];
    expect(streakDays(records, new Date(2026, 0, 1, 12))).toBe(2);
    expect(streakDays(records, new Date(2026, 0, 2, 12))).toBe(2);
    expect(streakDays(records, new Date(2026, 0, 3, 12))).toBe(0);
  });
});
