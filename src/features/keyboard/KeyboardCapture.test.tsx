import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleQuestions } from "../../data/sampleQuestions";
import { KeyboardCapture } from "./KeyboardCapture";

const question = {
  ...sampleQuestions[0],
  steps: [
    { key: "K", code: "KeyK", modifiers: [] },
    { key: "C", code: "KeyC", modifiers: [] },
  ],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("keyboard capture", () => {
  it("reports multi-step timeouts and clears progress on blur", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<KeyboardCapture question={question} showAnswers disabled={false} onAnswer={onAnswer} />);
    const area = screen.getByRole("region", { name: "ショートカット回答欄" });
    fireEvent.focus(area);
    fireEvent.keyDown(area, { key: "k", code: "KeyK" });
    act(() => vi.advanceTimersByTime(1501));
    expect(onAnswer).toHaveBeenCalledWith(false, true);

    onAnswer.mockClear();
    fireEvent.keyDown(area, { key: "k", code: "KeyK" });
    fireEvent.blur(area);
    fireEvent.focus(area);
    fireEvent.keyDown(area, { key: "c", code: "KeyC" });
    expect(onAnswer).toHaveBeenCalledWith(false, false);
  });

  it("does not score Tab, Escape, composing events or keys in another control", () => {
    const onAnswer = vi.fn();
    render(<><input aria-label="別の入力欄" /><KeyboardCapture question={question} showAnswers={false} disabled={false} onAnswer={onAnswer} /></>);
    const area = screen.getByRole("region", { name: "ショートカット回答欄" });
    fireEvent.keyDown(area, { key: "Tab", code: "Tab" });
    fireEvent.keyDown(area, { key: "Escape", code: "Escape" });
    fireEvent.keyDown(area, { key: "k", code: "KeyK", isComposing: true });
    fireEvent.keyDown(screen.getByLabelText("別の入力欄"), { key: "k", code: "KeyK" });
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
