import { describe, expect, it } from "vitest";
import { sampleQuestions } from "../../data/sampleQuestions";
import { chooseAdaptiveQuestion, countLimit, makeChoices, orderQuestions, timeLimitMs } from "./sessionLogic";
import { formatShortcut } from "../keyboard/engine";

describe("session selection", () => {
  it("handles all configured count and duration limits", () => {
    expect(["5", "10", "20", "50"].map((limit) => countLimit(limit as "5" | "10" | "20" | "50"))).toEqual([5, 10, 20, 50]);
    expect(["1m", "3m", "5m", "10m"].map((limit) => timeLimitMs(limit as "1m" | "3m" | "5m" | "10m"))).toEqual([60_000, 180_000, 300_000, 600_000]);
    expect(countLimit("unlimited")).toBeNull();
    expect(timeLimitMs("unlimited")).toBeNull();
  });
  it("sorts difficulty and shuffles deterministically without mutating input", () => {
    const questions = [{ ...sampleQuestions[0], difficulty: "advanced" as const }, sampleQuestions[1], { ...sampleQuestions[2], difficulty: "intermediate" as const }];
    expect(orderQuestions(questions, "difficulty").map((q) => q.difficulty)).toEqual(["beginner", "intermediate", "advanced"]);
    expect(orderQuestions(questions, "random", () => 0).map((q) => q.id)).toEqual([questions[1].id, questions[2].id, questions[0].id]);
    expect(questions[0].difficulty).toBe("advanced");
  });
  it("produces four distinct answers including the correct shortcut", () => {
    const answers = makeChoices(sampleQuestions[0], sampleQuestions, () => 0);
    expect(new Set(answers).size).toBe(4);
    expect(answers).toContain(formatShortcut(sampleQuestions[0].steps));
  });

  it("prioritizes due items and avoids consecutive repeats when possible", () => {
    const mastery = [{ questionId: sampleQuestions[0].id, score: 10, reviewDueAt: "2026-01-01T00:00:00.000Z", intervalDays: 1, easeFactor: 2.5, lapses: 1, algorithmVersion: 1 }];
    expect(chooseAdaptiveQuestion(sampleQuestions.slice(0, 3), mastery, Date.parse("2026-01-02T00:00:00.000Z")).id).toBe(sampleQuestions[0].id);
    expect(chooseAdaptiveQuestion(sampleQuestions.slice(0, 3), mastery, Date.parse("2026-01-02T00:00:00.000Z"), sampleQuestions[0].id).id).not.toBe(sampleQuestions[0].id);
    expect(chooseAdaptiveQuestion(sampleQuestions.slice(0, 1), mastery, Date.now(), sampleQuestions[0].id).id).toBe(sampleQuestions[0].id);
  });

  it("ignores mastery from an older question revision", () => {
    const current = sampleQuestions.find((question) => question.id === "powerpoint-new-slide")!;
    const other = sampleQuestions[0];
    const mastery = [
      { questionId: current.id, questionRevision: current.revision - 1, score: 0, reviewDueAt: "2020-01-01T00:00:00.000Z", intervalDays: 1, easeFactor: 2.5, lapses: 1, algorithmVersion: 1 },
      { questionId: other.id, questionRevision: other.revision, score: 80, reviewDueAt: "2027-01-01T00:00:00.000Z", intervalDays: 3, easeFactor: 2.5, lapses: 0, algorithmVersion: 1 },
    ];
    expect(chooseAdaptiveQuestion([current, other], mastery, Date.now()).id).toBe(other.id);
  });
});
