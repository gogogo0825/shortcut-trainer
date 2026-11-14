import { describe, expect, it } from "vitest";
import { sampleQuestions } from "./sampleQuestions";
import {
  attemptSchema,
  masterySchema,
  questionSchema,
} from "./questionSchema";

describe("questionSchema", () => {
  it("accepts standard questions and preserves original IDs and their revision history", () => {
    expect(sampleQuestions).toHaveLength(180);
    for (const question of sampleQuestions) {
      expect(questionSchema.parse(question)).toEqual(question);
    }
    for (const question of sampleQuestions.slice(0, 6).filter((item) => item.id !== "powerpoint-new-slide")) {
      expect(question.verification).toBe("docs_checked");
      expect(question.revision).toBe(1);
      expect(question.source.url).toMatch(/^https:\/\//);
    }
    expect(sampleQuestions.find((item) => item.id === "powerpoint-new-slide")).toMatchObject({
      revision: 2, verification: "docs_checked", steps: [{ key: "M", code: "KeyM", modifiers: ["Ctrl"] }],
    });
  });

  it("rejects a question missing required platform and step data", () => {
    const question = { ...sampleQuestions[0], platform: [], steps: [] };
    expect(questionSchema.safeParse(question).success).toBe(false);
  });

  it("rejects unsupported grading modes and invalid question revisions", () => {
    const question = {
      ...sampleQuestions[0],
      revision: 0,
      gradingModes: ["magic"],
    };
    expect(questionSchema.safeParse(question).success).toBe(false);
  });

  it("validates optional modifier-side specifications", () => {
    const original = sampleQuestions[0];
    expect(questionSchema.safeParse({
      ...original,
      steps: [{ ...original.steps[0], modifierSides: { Ctrl: "left" } }],
    }).success).toBe(true);
    expect(questionSchema.safeParse({
      ...original,
      steps: [{ ...original.steps[0], modifierSides: { Shift: "right" } }],
    }).success).toBe(false);
    expect(questionSchema.safeParse({
      ...original,
      steps: [{ ...original.steps[0], modifiers: ["Ctrl", "Ctrl"] }],
    }).success).toBe(false);
  });
});

describe("attemptSchema and masterySchema", () => {
  it("validates attempts and mastery records", () => {
    expect(
      attemptSchema.safeParse({
        id: "attempt-1",
        questionId: "windows-copy",
        questionRevision: 1,
        sessionId: "session-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        mode: "quiz",
        gradingMethod: "keyboard",
        correct: true,
        firstTry: true,
        elapsedMs: 1200,
        interrupted: false,
      }).success,
    ).toBe(true);

    expect(
      masterySchema.safeParse({
        questionId: "windows-copy",
        score: 75,
        reviewDueAt: "2026-01-02T00:00:00.000Z",
        intervalDays: 1,
        easeFactor: 2.5,
        lapses: 0,
        algorithmVersion: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects scores outside the defined range", () => {
    expect(
      masterySchema.safeParse({
        questionId: "windows-copy",
        score: 101,
        reviewDueAt: "2026-01-02T00:00:00.000Z",
        intervalDays: 1,
        easeFactor: 2.5,
        lapses: 0,
        algorithmVersion: 1,
      }).success,
    ).toBe(false);
  });
});
