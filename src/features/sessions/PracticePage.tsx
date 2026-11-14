import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Attempt, GradingMethod, Question, QuestionCategory, Session } from "../../data/questionSchema";
import { attemptSchema, categorySchema, masterySchema, sessionSchema } from "../../data/questionSchema";
import { sampleQuestions } from "../../data/sampleQuestions";
import { database } from "../../db/database";
import { KeyboardCapture } from "../keyboard/KeyboardCapture";
import { formatShortcut } from "../keyboard/engine";
import { calculateMastery, isMasteryAttempt } from "../analytics/calculations";
import { loadQuestions } from "../questions/questionStore";
import { attemptXp, sessionStreak } from "../gamification/calculations";
import { chooseAdaptiveQuestion, countLimit, makeChoices, orderQuestions, timeLimitMs, type Order, type SessionLimit } from "./sessionLogic";

const categories: { value: QuestionCategory | "all"; label: string }[] = [
  { value: "all", label: "すべて" }, { value: "windows", label: "Windows" },
  { value: "excel", label: "Excel" }, { value: "word", label: "Word" },
  { value: "powerpoint", label: "PowerPoint" }, { value: "vscode", label: "VS Code" },
  { value: "browser", label: "ブラウザー" },
];

type Mode = "practice" | "quiz";
type Outcome = "answered" | "skipped" | "timeout" | "abandoned";
type Feedback = { correct: boolean; outcome: Outcome; method: GradingMethod; answer: string; description: string };

interface Running {
  session: Session;
  questions: Question[];
  index: number;
  attempts: Attempt[];
  questionStartedAt: number;
  questionInterrupted: boolean;
  questionAttempts: number;
  feedback: Feedback | null;
  choices: string[];
  done: boolean;
}

export function PracticePage() {
  const [params] = useSearchParams();
  const initialCategory = categorySchema.safeParse(params.get("category"));
  const [category, setCategory] = useState<QuestionCategory | "all">(initialCategory.success ? initialCategory.data : "all");
  const [mode, setMode] = useState<Mode>("practice");
  const [order, setOrder] = useState<Order>("difficulty");
  const [limit, setLimit] = useState<SessionLimit>("5");
  const [method, setMethod] = useState<GradingMethod>("keyboard");
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>(sampleQuestions);
  const runningRef = useRef<Running | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const locked = useRef(false);
  const pendingWrite = useRef<Promise<void> | null>(null);
  const methodRef = useRef(method);
  const manualPause = useRef(false);
  const clock = useRef({ base: 0, since: 0, paused: false });

  useEffect(() => { methodRef.current = method; }, [method]);
  useEffect(() => { headingRef.current?.focus(); }, [running?.index, running?.done]);

  const updateRunning = useCallback((value: Running | null) => {
    runningRef.current = value;
    setRunning(value);
  }, []);

  const now = useCallback(() => {
    const c = clock.current;
    return c.base + (c.paused ? 0 : performance.now() - c.since);
  }, []);

  const persist = useCallback((session: Session, attempt?: Attempt) => {
    const operation = database.transaction("rw", database.sessions, database.attempts, database.mastery, async () => {
      await database.sessions.put(sessionSchema.parse(session));
      if (attempt) {
        await database.attempts.add(attemptSchema.parse(attempt));
        if (isMasteryAttempt(attempt)) {
          const attempts = (await database.attempts.where("questionId").equals(attempt.questionId).toArray()).map((item) => attemptSchema.parse(item));
          const mastery = calculateMastery(attempts, runningRef.current?.questions.find((q) => q.id === attempt.questionId) ?? sampleQuestions.find((q) => q.id === attempt.questionId));
          if (mastery) await database.mastery.put(masterySchema.parse(mastery));
        }
      }
    });
    pendingWrite.current = operation;
    return operation;
  }, []);

  const submit = useCallback(async (correct: boolean, outcome: Outcome = "answered", endSession = false) => {
    const state = runningRef.current;
    if (!state || state.done || state.feedback || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError(null);
    const question = state.questions[state.index % state.questions.length];
    const attempt: Attempt = {
      id: crypto.randomUUID(), questionId: question.id, questionRevision: question.revision,
      sessionId: state.session.id, timestamp: new Date().toISOString(), mode: state.session.mode,
      gradingMethod: method, correct, firstTry: state.questionAttempts === 0,
      elapsedMs: Math.max(0, now() - state.questionStartedAt),
      interrupted: state.questionInterrupted || outcome !== "answered",
      outcome,
    };
    const advances = outcome === "skipped" || state.session.mode === "quiz" || correct;
    const isFinished = outcome === "abandoned" || endSession;
    const session = { ...state.session, completedCount: state.session.completedCount + (advances && !isFinished ? 1 : 0), xp: state.session.xp + attemptXp(attempt) };
    if (isFinished) session.completedAt = new Date().toISOString();
    try {
      await persist(session, attempt);
      updateRunning({
        ...state, session, attempts: [...state.attempts, attempt], questionAttempts: state.questionAttempts + 1,
        done: isFinished,
        feedback: isFinished ? null : advances ? { correct, outcome, method, answer: formatShortcut(question.steps), description: question.description } : null,
      });
      if (!advances) setError(outcome === "timeout" ? "時間切れです。もう一度入力してください。" : "不正解です。正解するまで再挑戦できます。");
    } catch (reason) {
      setError(`保存できませんでした。もう一度回答してください: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }, [method, now, persist, updateRunning]);

  const finish = useCallback(async () => {
    const state = runningRef.current;
    if (!state || state.done || locked.current) return;
    if (!state.feedback) {
      await submit(false, "timeout", true);
      return;
    }
    locked.current = true;
    setSaving(true);
    try {
      const session = { ...state.session, completedAt: new Date().toISOString() };
      await persist(session);
      updateRunning({ ...state, session, done: true, feedback: null });
    } catch (reason) {
      setError(`結果を保存できませんでした: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally { locked.current = false; setSaving(false); }
  }, [persist, submit, updateRunning]);

  useEffect(() => {
    if (!running || running.done) return;
    const interval = window.setInterval(() => {
      const current = now();
      setElapsed(current);
      const maximum = timeLimitMs(limit);
      if (maximum !== null && current >= maximum) void finish();
    }, 250);
    const visibility = () => {
      const c = clock.current;
      if (document.hidden && !c.paused) {
        c.base += performance.now() - c.since;
        c.paused = true;
        const state = runningRef.current;
        if (state) updateRunning({ ...state, questionInterrupted: true });
      } else if (!document.hidden && c.paused && !manualPause.current) {
        c.since = performance.now();
        c.paused = false;
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [running, limit, now, finish, updateRunning]);

  useEffect(() => () => {
    if (!runningRef.current || runningRef.current.done) return;
    void (async () => {
      try {
        if (pendingWrite.current) await pendingWrite.current;
        const state = runningRef.current;
        if (!state || state.done) return;
        const session = { ...state.session, completedAt: new Date().toISOString() };
        if (state.feedback) {
          await persist(session);
        } else {
          const question = state.questions[state.index % state.questions.length];
          await persist(session, {
            id: crypto.randomUUID(), questionId: question.id, questionRevision: question.revision,
            sessionId: session.id, timestamp: new Date().toISOString(), mode: session.mode,
            gradingMethod: methodRef.current, correct: false, firstTry: state.questionAttempts === 0,
            elapsedMs: Math.max(0, now() - state.questionStartedAt),
            interrupted: true, outcome: "abandoned",
          });
        }
      } catch (reason) {
        console.error("ページ離脱時のセッション保存に失敗しました", reason);
      }
    })();
  }, [now, persist]);

  async function start() {
    const questionId = params.get("question");
    setError(null);
    setSaving(true);
    try {
      const available = await loadQuestions();
      const selected = orderQuestions(available.filter((question) => question.enabled && (!questionId || question.id === questionId) && (category === "all" || question.category === category)), order);
      if (!selected.length) throw new Error("対象となる問題がありません。");
      setAllQuestions(available);
      if (order === "adaptive") {
        const first = chooseAdaptiveQuestion(selected, (await database.mastery.toArray()).map((item) => masterySchema.parse(item)), Date.now());
        selected.splice(selected.indexOf(first), 1);
        selected.unshift(first);
      }
      const session: Session = {
        id: crypto.randomUUID(), mode, category, order, limit, questionIds: order === "adaptive" ? [selected[0].id] : selected.map((q) => q.id),
        startedAt: new Date().toISOString(), completedCount: 0, xp: 0,
      };
      await persist(session);
      clock.current = { base: 0, since: performance.now(), paused: document.hidden };
      manualPause.current = false;
      setPaused(false);
      setElapsed(0);
      updateRunning({ session, questions: selected, index: 0, attempts: [], questionStartedAt: 0, questionInterrupted: false, questionAttempts: 0, feedback: null, choices: makeChoices(selected[0], available), done: false });
    } catch (reason) {
      setError(`セッションを保存できませんでした: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally { setSaving(false); }
  }

  function togglePause() {
    const c = clock.current;
    if (!manualPause.current) {
      if (!c.paused) c.base += performance.now() - c.since;
      c.paused = true;
      manualPause.current = true;
      setPaused(true);
      const state = runningRef.current;
      if (state) updateRunning({ ...state, questionInterrupted: true });
    } else {
      manualPause.current = false;
      if (!document.hidden) {
        c.since = performance.now();
        c.paused = false;
      }
      setPaused(false);
    }
  }

  async function next() {
    const state = runningRef.current;
    if (!state || locked.current) return;
    const nextIndex = state.index + 1;
    const maxCount = countLimit(limit);
    const maxTime = timeLimitMs(limit);
    if ((maxCount !== null && nextIndex >= maxCount) || (maxTime !== null && now() >= maxTime)) {
      locked.current = true;
      setSaving(true);
      try {
        const session = { ...state.session, completedAt: new Date().toISOString() };
        await persist(session);
        updateRunning({ ...state, session, done: true, feedback: null });
      } catch (reason) {
        setError(`結果を保存できませんでした: ${reason instanceof Error ? reason.message : String(reason)}`);
      } finally { locked.current = false; setSaving(false); }
      return;
    }
    if (order === "adaptive") {
      locked.current = true;
      setSaving(true);
      try {
        const question = chooseAdaptiveQuestion(state.questions, (await database.mastery.toArray()).map((item) => masterySchema.parse(item)), Date.now(), state.questions[state.index % state.questions.length].id);
        const questions = state.questions.slice();
        const target = nextIndex % questions.length;
        const source = questions.findIndex((q) => q.id === question.id);
        [questions[target], questions[source]] = [questions[source], questions[target]];
        const session = { ...state.session, questionIds: [...state.session.questionIds, question.id] };
        await persist(session);
        setError(null);
        updateRunning({ ...state, session, questions, index: nextIndex, feedback: null, questionStartedAt: now(), questionInterrupted: false, questionAttempts: 0, choices: makeChoices(question, allQuestions) });
      } catch (reason) {
        setError(`次の問題を選択できませんでした: ${reason instanceof Error ? reason.message : String(reason)}`);
      } finally { locked.current = false; setSaving(false); }
      return;
    }
    const question = state.questions[nextIndex % state.questions.length];
    setError(null);
    updateRunning({ ...state, index: nextIndex, feedback: null, questionStartedAt: now(), questionInterrupted: false, questionAttempts: 0, choices: makeChoices(question, allQuestions) });
  }

  const selectClass = "mt-1 block w-full rounded-lg border border-line bg-panel p-2 text-ink";
  if (!running) return (
    <section className="surface-card mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">練習を設定</h1>
      <p className="text-sm text-muted">問題ごとの確認状況を表示します。同じ問題を繰り返して指定の問題数または時間まで練習します。スマートフォンでは4択または自己申告を選べます。</p>
      <label className="block">モード<select className={selectClass} value={mode} onChange={(e) => setMode(e.target.value as Mode)}><option value="practice">ガイド練習</option><option value="quiz">クイズ</option></select></label>
      <label className="block">カテゴリ<select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as QuestionCategory | "all")}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {params.get("question") && <p>復習対象: {allQuestions.find((q) => q.id === params.get("question"))?.action ?? "独自問題は開始時に確認します"}</p>}
      <label className="block">出題順<select className={selectClass} value={order} onChange={(e) => setOrder(e.target.value as Order)}><option value="difficulty">難易度順</option><option value="random">ランダム</option><option value="adaptive">適応型</option></select></label>
      <label className="block">セッション長<select className={selectClass} value={limit} onChange={(e) => setLimit(e.target.value as SessionLimit)}>{["5", "10", "20", "50", "1m", "3m", "5m", "10m", "unlimited"].map((item) => <option value={item} key={item}>{item === "unlimited" ? "無制限" : item.endsWith("m") ? `${item.slice(0, -1)}分` : `${item}問`}</option>)}</select></label>
      <label className="block">採点方法<select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as GradingMethod)}><option value="keyboard">キーボード入力</option><option value="multiple_choice">4択</option><option value="self_assessment">自己申告</option></select></label>
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      <button className="button-primary" disabled={saving} onClick={() => void start()} type="button">セッション開始</button>
    </section>
  );

  if (running.done) return (
    <section className="surface-card mx-auto max-w-2xl space-y-5 p-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">セッション結果</h1>
      <p>完了 {running.session.completedCount} 問 / 回答記録 {running.attempts.length} 件</p>
      <p>正解 {running.attempts.filter((a) => a.correct).length} 件（再挑戦を含む）</p>
      <p>獲得 {running.session.xp} XP / 現在の連続初回正解 {sessionStreak(running.attempts)} 問</p>
      <ul className="space-y-2">{running.attempts.map((a) => <li key={a.id}>{allQuestions.find((q) => q.id === a.questionId)?.action ?? a.questionId}: {a.outcome === "answered" ? (a.correct ? "正解" : "不正解") : a.outcome === "timeout" ? "時間切れ" : a.outcome === "skipped" ? "スキップ" : "中断"}（{a.gradingMethod === "keyboard" ? "キーボード" : a.gradingMethod === "multiple_choice" ? "4択" : "自己申告"}）</li>)}</ul>
      <div className="flex flex-wrap gap-3"><button className="button-primary" onClick={() => updateRunning(null)} type="button">もう一度設定する</button><Link className="button-secondary" to="/">ホームへ</Link></div>
    </section>
  );

  const question = running.questions[running.index % running.questions.length];
  const allowed = question.gradingModes.includes(method);
  return (
    <section className="surface-card mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted"><span>{mode === "practice" ? "ガイド練習" : "クイズ"} / {categories.find((c) => c.value === question.category)?.label} / {running.index + 1}問目</span><span>経過 {Math.floor(elapsed / 1000)}秒</span></div>
      <p className="text-sm">獲得 {running.session.xp} XP / 連続初回正解 {sessionStreak(running.attempts)} 問</p>
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">{question.action}</h1>
      <p className="text-sm text-muted">{question.verification === "pending" ? "この問題の出典・実機動作は未確認です。" : question.verification === "docs_checked" ? "出典確認済み・実機動作は未確認です。" : "実機確認済み"}</p>
      {mode === "practice" && <p>正解キー: <strong>{formatShortcut(question.steps)}</strong></p>}
      {running.feedback ? (
        <div className="space-y-3 rounded-xl bg-canvas p-4" role="status">
          <p className="font-bold">{running.feedback.outcome === "skipped" ? "スキップ" : running.feedback.outcome === "timeout" ? "時間切れ" : running.feedback.correct ? "正解" : "不正解"}</p>
          <p>正解: {running.feedback.answer}</p><p>{running.feedback.description}</p>
          <p>採点方法: {running.feedback.method === "keyboard" ? "キーボード" : running.feedback.method === "multiple_choice" ? "4択" : "自己申告"}</p>
          <button autoFocus className="button-primary" disabled={saving} onClick={() => void next()} type="button">次へ</button>
          {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
        </div>
      ) : paused ? (
        <div className="space-y-3 rounded-xl bg-canvas p-4">
          <p>一時停止中です。時間は進みません。</p>
          <div className="flex flex-wrap gap-3">
            <button className="button-primary" onClick={togglePause} type="button">再開</button>
            <button className="button-secondary" disabled={saving} onClick={() => void submit(false, "abandoned")} type="button">セッションを終了</button>
          </div>
          {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
        </div>
      ) : (
        <>
          <label className="block">採点方法を切替<select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as GradingMethod)}><option value="keyboard">キーボード入力</option><option value="multiple_choice">4択</option><option value="self_assessment">自己申告</option></select></label>
          <p className="text-sm text-muted">OSやブラウザーが予約するキーは届かない場合があります。その場合は4択または自己申告へ切り替えてください。</p>
          {!allowed ? <p role="alert">この問題では選択した採点方法を利用できません。別の方法を選択してください。</p> : method === "keyboard" ? (
            <KeyboardCapture key={`${running.index}-${question.id}`} question={question} showAnswers={mode === "practice"} disabled={saving} onAnswer={(correct, timeout) => void submit(correct, timeout ? "timeout" : "answered")} />
          ) : method === "multiple_choice" ? (
            <div className="grid gap-2 sm:grid-cols-2">{running.choices.map((choice) => <button className="button-secondary text-left" disabled={saving} key={choice} onClick={() => void submit(choice === formatShortcut(question.steps))} type="button">{choice}</button>)}</div>
          ) : (
            <div className="space-y-3"><p>実際のアプリで操作を試し、できたかを自己申告します。自動検出ではありません。</p><div className="flex gap-2"><button className="button-secondary" disabled={saving} onClick={() => void submit(true)} type="button">できた</button><button className="button-secondary" disabled={saving} onClick={() => void submit(false)} type="button">できなかった</button></div></div>
          )}
          {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-3"><button className="button-secondary" disabled={saving} onClick={togglePause} type="button">一時停止</button><button className="button-secondary" disabled={saving} onClick={() => void submit(false, "skipped")} type="button">スキップ</button><button className="button-secondary" disabled={saving} onClick={() => void submit(false, "abandoned")} type="button">セッションを終了</button></div>
        </>
      )}
    </section>
  );
}
