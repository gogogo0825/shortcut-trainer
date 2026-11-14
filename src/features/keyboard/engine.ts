import type { Question } from "../../data/questionSchema";

export type Step = Question["steps"][number];
type Modifier = Step["modifiers"][number];
export const DEFAULT_STEP_TIMEOUT_MS = 1500;

export interface KeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  keyCode?: number;
}

export type KeyResult = "ignored" | "modifier" | "progress" | "correct" | "incorrect" | "timeout";

const modifierCodes: Record<string, Modifier> = {
  ControlLeft: "Ctrl", ControlRight: "Ctrl",
  ShiftLeft: "Shift", ShiftRight: "Shift",
  AltLeft: "Alt", AltRight: "Alt",
  MetaLeft: "Meta", MetaRight: "Meta",
};

function modifiersOf(event: KeyInput): Modifier[] {
  return [
    ...(event.ctrlKey ? ["Ctrl" as const] : []),
    ...(event.shiftKey ? ["Shift" as const] : []),
    ...(event.altKey ? ["Alt" as const] : []),
    ...(event.metaKey ? ["Meta" as const] : []),
  ];
}

export class ShortcutEngine {
  private index = 0;
  private deadline: number | null = null;
  private pressed = new Set<string>();

  constructor(
    private readonly steps: readonly Step[],
    private readonly timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  ) {
    if (!steps.length || timeoutMs <= 0) throw new Error("Invalid shortcut configuration");
  }

  get progress(): number { return this.index; }
  get pressedCodes(): readonly string[] { return [...this.pressed]; }

  reset(): void {
    this.index = 0;
    this.deadline = null;
    this.pressed.clear();
  }

  keyUp(code: string): void { this.pressed.delete(code); }

  expire(now: number): boolean {
    if (this.deadline === null || now < this.deadline) return false;
    this.reset();
    return true;
  }

  keyDown(event: KeyInput, now: number): KeyResult {
    if (event.repeat || event.isComposing || event.keyCode === 229 || event.key === "Process" || event.key === "Dead" || event.key === "Unidentified") {
      return "ignored";
    }
    if (this.expire(now)) return "timeout";
    this.pressed.add(event.code);
    if (modifierCodes[event.code]) return "modifier";

    const step = this.steps[this.index];
    const actual = modifiersOf(event);
    const modifiersMatch = actual.length === step.modifiers.length &&
      step.modifiers.every((modifier) => actual.includes(modifier));
    const sidesMatch = Object.entries(step.modifierSides ?? {}).every(([modifier, side]) => {
      const codePrefix = modifier === "Ctrl" ? "Control" : modifier;
      return this.pressed.has(`${codePrefix}${side === "left" ? "Left" : "Right"}`);
    });
    // Letter keys use physical code: Ctrl and JIS/US layouts can alter KeyboardEvent.key.
    const key = event.key === " " ? "space" : event.key.toLocaleLowerCase();
    const keyMatches = /^Key[A-Z]$/.test(step.code) ||
      key === step.key.toLocaleLowerCase();
    if (event.code !== step.code || !keyMatches || !modifiersMatch || !sidesMatch) {
      this.reset();
      return "incorrect";
    }
    this.index += 1;
    if (this.index === this.steps.length) {
      this.reset();
      return "correct";
    }
    this.deadline = now + this.timeoutMs;
    return "progress";
  }
}

export function formatShortcut(steps: readonly Step[]): string {
  return steps.map((step) => [...step.modifiers, step.key].join(" + ")).join(" → ");
}
