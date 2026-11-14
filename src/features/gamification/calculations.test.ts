import { describe, expect, it } from "vitest";
import type { Attempt } from "../../data/questionSchema";
import { attemptXp, levelForXp, sessionStreak } from "./calculations";

const correct: Attempt = { id: "1", questionId: "q", questionRevision: 1, sessionId: "s", timestamp: "2026-01-01T00:00:00.000Z", mode: "quiz", gradingMethod: "keyboard", correct: true, firstTry: true, interrupted: false, outcome: "answered" };

describe("gamification", () => {
  it("awards only an answered first correct attempt, regardless of method", () => {
    expect(attemptXp(correct)).toBe(10);
    expect(attemptXp({ ...correct, gradingMethod: "self_assessment" })).toBe(10);
    expect(attemptXp({ ...correct, firstTry: false })).toBe(0);
    expect(attemptXp({ ...correct, correct: false })).toBe(0);
    expect(attemptXp({ ...correct, outcome: "skipped" })).toBe(0);
  });
  it("calculates level boundaries and streak without treating retries as first answers", () => {
    expect([0, 99, 100, 200].map(levelForXp)).toEqual([1, 1, 2, 3]);
    expect(sessionStreak([correct, { ...correct, correct: false }, { ...correct, firstTry: false }, correct])).toBe(1);
    expect(sessionStreak([correct, { ...correct, outcome: "skipped" }])).toBe(0);
  });
});
