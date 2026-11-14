import { describe, expect, it } from "vitest";
import { ShortcutEngine, type KeyInput, type Step } from "./engine";

const step = (key: string, modifiers: Step["modifiers"] = []): Step => ({
  key, code: `Key${key}`, modifiers,
});
const event = (code: string, options: Partial<KeyInput> = {}): KeyInput => ({
  key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
  code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
  repeat: false, isComposing: false, ...options,
});

describe("ShortcutEngine", () => {
  it("matches modifier sets and multi-step shortcuts in order", () => {
    const engine = new ShortcutEngine([step("K", ["Ctrl"]), step("C", ["Ctrl"])]);
    expect(engine.keyDown(event("ControlRight", { ctrlKey: true }), 0)).toBe("modifier");
    expect(engine.keyDown(event("KeyK", { ctrlKey: true }), 10)).toBe("progress");
    engine.keyUp("KeyK");
    expect(engine.keyDown(event("KeyC", { ctrlKey: true }), 100)).toBe("correct");
    expect(engine.progress).toBe(0);
    expect(engine.pressedCodes).toEqual([]);
  });

  it("rejects wrong order, extra modifiers and wrong physical code", () => {
    const engine = new ShortcutEngine([step("K", ["Ctrl"]), step("C", ["Ctrl"])]);
    expect(engine.keyDown(event("KeyC", { ctrlKey: true }), 0)).toBe("incorrect");
    expect(engine.keyDown(event("KeyK", { ctrlKey: true, shiftKey: true }), 1)).toBe("incorrect");
    expect(engine.keyDown(event("KeyK", { ctrlKey: true }), 2)).toBe("progress");
    expect(engine.keyDown(event("KeyX", { ctrlKey: true }), 3)).toBe("incorrect");
    expect(engine.progress).toBe(0);
  });

  it("expires after the configured timeout and can restart", () => {
    const engine = new ShortcutEngine([step("K"), step("C")], 1500);
    expect(engine.keyDown(event("KeyK"), 0)).toBe("progress");
    expect(engine.expire(1499)).toBe(false);
    expect(engine.expire(1500)).toBe(true);
    expect(engine.keyDown(event("KeyK"), 1600)).toBe("progress");
    expect(engine.keyDown(event("KeyC"), 3100)).toBe("timeout");
    expect(engine.keyDown(event("KeyK"), 3101)).toBe("progress");
  });

  it("ignores IME and repeat events without changing sequence", () => {
    const engine = new ShortcutEngine([step("K"), step("C")]);
    expect(engine.keyDown(event("KeyK", { isComposing: true }), 0)).toBe("ignored");
    expect(engine.keyDown(event("KeyK", { key: "Process" }), 0)).toBe("ignored");
    expect(engine.keyDown(event("KeyK", { keyCode: 229 }), 0)).toBe("ignored");
    expect(engine.keyDown(event("KeyK", { repeat: true }), 0)).toBe("ignored");
    expect(engine.keyDown(event("KeyK"), 1)).toBe("progress");
    expect(engine.keyDown(event("KeyC", { repeat: true }), 2)).toBe("ignored");
    expect(engine.keyDown(event("KeyC"), 3)).toBe("correct");
  });

  it("tracks keyup and reset, and enforces a side only when specified", () => {
    const engine = new ShortcutEngine([{ ...step("C", ["Ctrl"]), modifierSides: { Ctrl: "right" } }]);
    engine.keyDown(event("ControlLeft", { ctrlKey: true }), 0);
    expect(engine.keyDown(event("KeyC", { ctrlKey: true }), 1)).toBe("incorrect");
    engine.keyDown(event("ControlRight", { ctrlKey: true }), 2);
    engine.keyUp("ControlRight");
    expect(engine.pressedCodes).toEqual([]);
    engine.keyDown(event("ControlRight", { ctrlKey: true }), 3);
    expect(engine.keyDown(event("KeyC", { ctrlKey: true, key: "c" }), 4)).toBe("correct");
  });

  it("distinguishes printable key labels for non-letter physical keys", () => {
    const engine = new ShortcutEngine([{ key: "@", code: "BracketLeft", modifiers: [] }]);
    expect(engine.keyDown(event("BracketLeft", { key: "[" }), 0)).toBe("incorrect");
    expect(engine.keyDown(event("BracketLeft", { key: "@" }), 1)).toBe("correct");
  });

  it("recognizes the browser's space character as the Space key", () => {
    const engine = new ShortcutEngine([{ key: "Space", code: "Space", modifiers: [] }]);
    expect(engine.keyDown(event("Space", { key: " " }), 0)).toBe("correct");
  });
});
