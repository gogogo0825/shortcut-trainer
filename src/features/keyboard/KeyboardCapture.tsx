import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "../../data/questionSchema";
import { DEFAULT_STEP_TIMEOUT_MS, ShortcutEngine } from "./engine";

const rows = [
  [["Esc", "Escape"], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]), ["Delete", "Delete"]],
  [["半角/全角", "Backquote"], ["1", "Digit1"], ["2", "Digit2"], ["3", "Digit3"], ["4", "Digit4"], ["5", "Digit5"], ["6", "Digit6"], ["7", "Digit7"], ["8", "Digit8"], ["9", "Digit9"], ["0", "Digit0"], ["-", "Minus"], ["^", "Equal"], ["¥", "IntlYen"], ["Backspace", "Backspace"]],
  [["Tab", "Tab"], ...Array.from("QWERTYUIOP", (key) => [key, `Key${key}`]), ["@", "BracketLeft"], ["[", "BracketRight"]],
  [["Caps", "CapsLock"], ...Array.from("ASDFGHJKL", (key) => [key, `Key${key}`]), [";", "Semicolon"], [":", "Quote"], ["]", "Backslash"], ["Enter", "Enter"]],
  [["Shift", "ShiftLeft"], ...Array.from("ZXCVBNM", (key) => [key, `Key${key}`]), [",", "Comma"], [".", "Period"], ["/", "Slash"], ["ろ", "IntlRo"], ["Shift", "ShiftRight"]],
  [["Ctrl", "ControlLeft"], ["Win", "MetaLeft"], ["Alt", "AltLeft"], ["無変換", "NonConvert"], ["Space", "Space"], ["変換", "Convert"], ["かな", "KanaMode"], ["Alt", "AltRight"], ["Ctrl", "ControlRight"], ["←", "ArrowLeft"], ["↑", "ArrowUp"], ["↓", "ArrowDown"], ["→", "ArrowRight"]],
];

export function KeyboardCapture({
  question, showAnswers, disabled, onAnswer,
}: {
  question: Question;
  showAnswers: boolean;
  disabled: boolean;
  onAnswer: (correct: boolean, timeout?: boolean) => void;
}) {
  const engine = useMemo(() => new ShortcutEngine(question.steps), [question]);
  const area = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState<readonly string[]>([]);
  const [active, setActive] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    engine.reset();
  }, [engine]);

  useEffect(() => {
    const blur = () => {
      area.current?.blur();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      engine.reset();
      setPressed([]);
      setProgress(0);
      setActive(false);
    };
    window.addEventListener("blur", blur);
    const visibility = () => { if (document.hidden) blur(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [engine]);

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    engine.reset();
    setPressed([]);
    setProgress(0);
  }

  const answerCodes = showAnswers
    ? new Set(question.steps.flatMap((step) => [
      step.code,
      ...step.modifiers.flatMap((modifier) => {
        const prefix = modifier === "Ctrl" ? "Control" : modifier;
        const side = step.modifierSides?.[modifier];
        return side ? [`${prefix}${side === "left" ? "Left" : "Right"}`] : [`${prefix}Left`, `${prefix}Right`];
      }),
    ]))
    : new Set<string>();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">キー入力は下の回答欄にフォーカスがある間だけ採点します。Tab・Escapeは通常操作に使えます。</p>
      <button className="button-secondary" disabled={disabled} onClick={() => area.current?.focus()} type="button">回答開始</button>
      <div
        ref={area}
        aria-label="ショートカット回答欄"
        className="rounded-xl border-2 border-dashed border-line p-5 text-center focus:border-brand-600"
        onFocus={() => setActive(true)}
        onBlur={() => { setActive(false); reset(); }}
        onKeyUp={(event) => {
          engine.keyUp(event.code);
          setPressed(engine.pressedCodes);
        }}
        onKeyDown={(event) => {
          if (disabled || event.key === "Tab" || event.key === "Escape" || event.nativeEvent.isComposing || event.key === "Process" || event.key === "Dead") return;
          const result = engine.keyDown(event.nativeEvent, performance.now());
          if (result !== "ignored") event.preventDefault();
          setPressed(engine.pressedCodes);
          setProgress(engine.progress);
          if (result === "progress") {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              if (engine.expire(performance.now())) {
                setPressed([]);
                setProgress(0);
                onAnswer(false, true);
              }
            }, DEFAULT_STEP_TIMEOUT_MS + 1);
          } else if (result === "correct" || result === "incorrect" || result === "timeout") {
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
            onAnswer(result === "correct", result === "timeout");
          }
        }}
        role="region"
        tabIndex={disabled ? -1 : 0}
      >
        {active ? "入力受付中 — ショートカットを押してください" : "ここを選択して回答を開始"}
        {progress > 0 && <span>（{progress} / {question.steps.length}段階）</span>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input checked={showKeyboard} onChange={(event) => setShowKeyboard(event.target.checked)} type="checkbox" />
        JISキーボードを表示
      </label>
      {showKeyboard && (
        <div aria-label="JISキーボードの入力状態" className="space-y-1 overflow-x-auto rounded-xl bg-canvas p-3" role="img">
          {rows.map((row, i) => (
            <div className="flex min-w-max gap-1" key={i}>
              {row.map(([label, code]) => (
                <span className={`min-w-8 rounded border px-1 py-2 text-center text-xs ${pressed.includes(code) ? "border-blue-700 bg-blue-700 text-white" : answerCodes.has(code) ? "border-amber-600 bg-amber-100 text-amber-950" : "border-line bg-panel"}`} key={code}>{label}</span>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted">青: 押下中 {showAnswers && "黄: 正解キー"}</p>
        </div>
      )}
    </div>
  );
}
