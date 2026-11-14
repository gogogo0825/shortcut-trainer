import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { attemptSchema, masterySchema, sessionSchema, type Attempt, type Mastery, type Question, type Session } from "../../data/questionSchema";
import { database } from "../../db/database";
import { loadQuestions } from "../questions/questionStore";
import { dailyStats, isAnswered, isMasteryAttempt, isMasteryForQuestion, methodStats, streakDays } from "./calculations";

type Data = { attempts: Attempt[]; mastery: Mastery[]; sessions: Session[]; questions: Question[]; loadedAt: number };
const methodLabels = { keyboard: "キーボード", multiple_choice: "4択", self_assessment: "自己申告" } as const;
const categoryLabels = { windows: "Windows", excel: "Excel", word: "Word", powerpoint: "PowerPoint", vscode: "VS Code", browser: "ブラウザー" } as const;

export function AnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadQuestions().then((questions) => database.transaction("r", [database.attempts, database.mastery, database.sessions], async () => ({
      attempts: (await database.attempts.toArray()).map((value) => attemptSchema.parse(value)),
      mastery: (await database.mastery.toArray()).map((value) => masterySchema.parse(value)),
      sessions: (await database.sessions.toArray()).map((value) => sessionSchema.parse(value)),
      questions,
      loadedAt: Date.now(),
    }))).then((value) => { if (active) setData(value); }).catch((reason: unknown) => {
      if (active) setError(`学習記録を読み込めませんでした: ${reason instanceof Error ? reason.message : String(reason)}`);
    });
    return () => { active = false; };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">学習記録を読み込み中です。</p>;
  const { attempts, mastery, sessions, loadedAt, questions } = data;
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const masteryMap = new Map(mastery.filter((item) => {
    const question = questionsById.get(item.questionId);
    return question && isMasteryForQuestion(item, question);
  }).map((m) => [m.questionId, m]));
  const answered = attempts.filter(isAnswered);
  const stats = methodStats(attempts);
  const daily = dailyStats(attempts);
  const due = mastery.filter((m) => Date.parse(m.reviewDueAt) <= loadedAt && questions.some((q) => q.id === m.questionId && q.enabled));
  const weaknesses = mastery.filter((m) => questions.some((q) => q.id === m.questionId)).slice().sort((a, b) => a.score - b.score || a.questionId.localeCompare(b.questionId));
  const unknown = attempts.filter((a) => !questions.some((q) => q.id === a.questionId));
  const oldRevisions = attempts.filter((a) => questions.some((q) => q.id === a.questionId && a.questionRevision < q.revision));
  const latest = attempts.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id)).slice(0, 30);
  const recent = attempts.filter(isMasteryAttempt).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id)).slice(0, 5);
  const outcome = (a: Attempt) => a.outcome === "skipped" ? "スキップ" : a.outcome === "timeout" ? "時間切れ" : a.outcome === "abandoned" ? "中断" : !isAnswered(a) ? "旧記録・中断（詳細不明）" : a.correct ? "正解" : "不正解";
  return (
    <div className="space-y-6">
      <header><h1 className="text-3xl font-bold">学習分析</h1><p className="mt-2 text-muted">端末内の履歴を集計します。採点方法と初回・再挑戦は混合しません。</p></header>
      {oldRevisions.length > 0 && <p className="surface-card p-4" role="note">以前のrevisionに基づく回答 {oldRevisions.length} 件は履歴・全体分析に保持されますが、現在revisionの習熟度・復習には反映しません。当時の採点結果は再計算されません。</p>}
      <section className="surface-card p-5 space-y-3">
        <h2 className="text-xl font-bold">学習の概要</h2>
        <p>セッション {sessions.length} 件 / 回答 {answered.length} 件 / 連続学習 {streakDays(attempts, new Date(loadedAt))} 日 / 復習期限到来 {due.length} 問</p>
        <p>直近5件（クイズ初回・キーボード）: {recent.length ? `${recent.filter((a) => a.correct).length} / ${recent.length} 件正解` : "対象なし"}</p>
        <p>スキップ {attempts.filter((a) => a.outcome === "skipped").length} 件 / 時間切れ {attempts.filter((a) => a.outcome === "timeout").length} 件 / 中断 {attempts.filter((a) => a.outcome === "abandoned" || (a.outcome === undefined && a.interrupted)).length} 件</p>
        <Link className="button-primary inline-flex" to="/review">復習一覧を見る</Link>
      </section>
      <section className="surface-card p-5 space-y-3">
        <h2 className="text-xl font-bold">採点方式別の成績</h2>
        <p className="text-sm text-muted">正答率は回答済みのみ。回答時間は中断のないキーボード入力のみで、4択・自己申告とは比較しません。</p>
        {stats.length === 0 ? <p>回答済みの記録はありません。</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>モード</th><th>採点方式</th><th>回答</th><th>正答率</th><th>平均時間</th></tr></thead><tbody>{stats.map((s) => <tr key={`${s.mode}-${s.method}-${s.firstTry}`}><td>{s.mode === "quiz" ? "クイズ" : "ガイド"}</td><td>{methodLabels[s.method]}</td><td>{s.firstTry ? "初回" : "再挑戦"} {s.total}件</td><td>{s.correct}/{s.total} ({Math.round(s.correct / s.total * 100)}%)</td><td>{s.averageMs === null ? "対象なし" : `${(s.averageMs / 1000).toFixed(1)}秒`}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="surface-card p-5 space-y-3">
        <h2 className="text-xl font-bold">日次推移</h2>
        <p className="text-sm text-muted">クイズ初回・キーボード回答のみ。日付はこの端末のローカル時間です。</p>
        {daily.length === 0 ? <p>対象の回答はありません。</p> : <>
          <div className="h-64 w-full" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="answered" name="回答" fill="#2563eb" /><Bar dataKey="correct" name="正解" fill="#15803d" /></BarChart></ResponsiveContainer></div>
          <ul>{daily.map((d) => <li key={d.day}>{d.day}: 回答 {d.answered} 件、正解 {d.correct} 件</li>)}</ul>
        </>}
      </section>
      <section className="surface-card p-5 space-y-3">
        <h2 className="text-xl font-bold">カテゴリ別進捗</h2>
        <p className="text-sm text-muted">クイズ初回・キーボードで回答した問題数 / 有効な問題数</p>
        <ul>{Object.entries(categoryLabels).map(([category, label]) => {
          const categoryQuestions = questions.filter((q) => q.enabled && q.category === category);
          return <li key={category}>{label}: {categoryQuestions.filter((q) => masteryMap.has(q.id)).length} / {categoryQuestions.length} 問</li>;
        })}</ul>
      </section>
      <section className="surface-card p-5 space-y-3">
        <h2 className="text-xl font-bold">問題別習熟度・弱点順</h2>
        <p className="text-sm text-muted">クイズ初回のキーボード回答だけを基に算出。目標時間未設定時は速度を中立に扱います。</p>
        {weaknesses.length === 0 ? <p>対象の回答はありません。</p> : <ol className="list-decimal space-y-2 pl-6">{weaknesses.map((m) => <li key={m.questionId}>{questions.find((q) => q.id === m.questionId)?.action}: {m.score} / 100、復習予定 {new Date(m.reviewDueAt).toLocaleString("ja-JP")}</li>)}</ol>}
        <h3 className="font-semibold">未学習の問題</h3>
        {questions.filter((q) => q.enabled && !masteryMap.has(q.id)).length === 0 ? <p>ありません。</p> : <ul>{questions.filter((q) => q.enabled && !masteryMap.has(q.id)).map((q) => <li key={q.id}>{q.action}: 未学習</li>)}</ul>}
        {unknown.length > 0 && <p>現在の問題集にない問題の履歴 {unknown.length} 件は保持されています。</p>}
      </section>
      <section className="surface-card p-5 space-y-3">
        <h2 className="text-xl font-bold">最近の学習履歴</h2>
        {latest.length === 0 ? <p>履歴はありません。</p> : <ol className="space-y-2">{latest.map((a) => {
          const question = questionsById.get(a.questionId);
          const oldRevision = question && a.questionRevision < question.revision;
          return <li key={a.id}>{new Date(a.timestamp).toLocaleString("ja-JP")} — {question?.action ?? `問題ID: ${a.questionId}`}{oldRevision ? `（旧revision ${a.questionRevision} / 現在 ${question.revision}）` : ""} — {a.mode === "quiz" ? "クイズ" : "ガイド"}・{methodLabels[a.gradingMethod]}・{a.firstTry ? "初回" : "再挑戦"}・{outcome(a)}{a.interrupted && isAnswered(a) ? "（中断あり）" : ""}</li>;
        })}</ol>}
        {attempts.length > 30 && <p className="text-sm text-muted">直近30件を表示しています。残りの履歴も保持されています。</p>}
      </section>
    </div>
  );
}
