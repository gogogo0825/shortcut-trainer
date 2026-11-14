import { describe, expect, it } from "vitest";
import { sampleQuestions } from "./sampleQuestions";
import { duplicateShortcutCandidates, validateQuestions } from "./validateQuestions";
import { ShortcutEngine } from "../features/keyboard/engine";

describe("standard content quality", () => {
  it("validates category totals, Windows difficulty distribution and ID uniqueness", () => {
    expect(validateQuestions(sampleQuestions)).toHaveLength(180);
    for (const category of ["windows", "excel", "word", "powerpoint", "vscode", "browser"]) {
      const questions = sampleQuestions.filter((q) => q.category === category);
      expect(["beginner", "intermediate", "advanced"].map((difficulty) => questions.filter((q) => q.difficulty === difficulty).length), category).toEqual([10, 12, 8]);
    }
    expect(new Set(sampleQuestions.map((q) => q.id)).size).toBe(sampleQuestions.length);
  });

  it("has no duplicate shortcut sequences inside a category", () => {
    expect(duplicateShortcutCandidates(sampleQuestions)).toEqual([]);
    expect(duplicateShortcutCandidates([sampleQuestions[0], { ...sampleQuestions[0], id: "another" }])).toEqual([[sampleQuestions[0].id, "another"]]);
  });

  it("tracks the 17 audited shortcuts with their verified sources without changing revision or keys", () => {
    const sources = {
      windows: "https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows",
      excel: "https://support.microsoft.com/en-us/accessibility/excel/keyboard-shortcuts-in-excel",
      word: "https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word",
      powerpoint: "https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-create-powerpoint-presentations",
      vscode: "https://code.visualstudio.com/docs/editing/getting-started/tips-and-tricks",
      browser: "https://support.google.com/chrome/answer/157179?hl=en",
    } as const;
    const cases = [
      ["windows-copy", "windows", "C", false], ["windows-paste", "windows", "V", false],
      ["windows-cut", "windows", "X", false], ["windows-undo", "windows", "Z", false],
      ["excel-save", "excel", "S", false], ["excel-copy", "excel", "C", false],
      ["excel-paste", "excel", "V", false], ["excel-undo", "excel", "Z", false],
      ["word-bold", "word", "B", false], ["word-save", "word", "S", false],
      ["word-copy", "word", "C", false], ["word-italic", "word", "I", false],
      ["powerpoint-save", "powerpoint", "S", false], ["powerpoint-copy", "powerpoint", "C", false],
      ["powerpoint-undo", "powerpoint", "Z", false], ["vscode-command-palette", "vscode", "P", true],
      ["browser-new-tab", "browser", "T", false],
    ] as const;
    for (const [id, category, key, shift] of cases) {
      const question = sampleQuestions.find((item) => item.id === id);
      expect(question, id).toMatchObject({
        category, difficulty: "beginner", revision: 1, verification: "docs_checked",
        source: { url: sources[category], checkedAt: "2026-11-14T06:51:52.000Z" },
        steps: [{ key, code: `Key${key}`, modifiers: shift ? ["Ctrl", "Shift"] : ["Ctrl"] }],
      });
      expect(question?.appVersions?.length, id).toBeGreaterThan(0);
    }
    expect(sampleQuestions.filter((question) => question.verification === "pending")).toHaveLength(0);
    expect(sampleQuestions.filter((question) => question.verification === "device_checked")).toHaveLength(0);
  });

  it("supports new shortcut key definitions in the input engine", () => {
    for (const q of sampleQuestions.filter((item) => item.id.startsWith("standard-"))) {
      expect(q.verification).toBe("docs_checked");
      expect(q.source.url).toMatch(/^https:\/\/(support\.microsoft\.com|code\.visualstudio\.com|support\.google\.com)\//);
      expect(q.gradingModes).toEqual(["keyboard", "multiple_choice", "self_assessment"]);
      const engine = new ShortcutEngine(q.steps);
      const step = q.steps[0];
      expect(engine.keyDown({
        key: step.key, code: step.code, ctrlKey: step.modifiers.includes("Ctrl"),
        shiftKey: step.modifiers.includes("Shift"), altKey: step.modifiers.includes("Alt"),
        metaKey: step.modifiers.includes("Meta"), repeat: false, isComposing: false,
      }, 0), q.id).toBe("correct");
    }
  });
});
