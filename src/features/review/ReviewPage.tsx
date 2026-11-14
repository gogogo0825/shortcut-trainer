import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { masterySchema, type Mastery, type Question } from "../../data/questionSchema";
import { loadQuestions } from "../questions/questionStore";
import { database } from "../../db/database";
import { isMasteryForQuestion } from "../analytics/calculations";

export function ReviewPage() {
  const [items, setItems] = useState<Mastery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([database.mastery.toArray(), loadQuestions()]).then(([rows, all]) => {
      if (active) {
        setQuestions(all);
        const questionsById = new Map(all.map((question) => [question.id, question]));
        setItems(rows.map((row) => masterySchema.parse(row)).filter((row) => {
          const question = questionsById.get(row.questionId);
          return question && isMasteryForQuestion(row, question) && Date.parse(row.reviewDueAt) <= Date.now();
        }).sort((a, b) => a.reviewDueAt.localeCompare(b.reviewDueAt)));
      }
    }).catch((reason: unknown) => { if (active) setError(`復習一覧を読み込めませんでした: ${reason instanceof Error ? reason.message : String(reason)}`); });
    return () => { active = false; };
  }, []);
  return <section className="surface-card mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-bold">復習一覧</h1>
    <p className="text-muted">クイズ初回・キーボード回答の復習期限に基づきます。</p>
    {error ? <p role="alert">{error}</p> : !items ? <p role="status">読み込み中です。</p> : !items.length ? <p>期限が到来した問題はありません。</p> : <ul className="space-y-4">{items.map((item) => {
      const question = questions.find((q) => q.id === item.questionId && q.enabled);
      return <li key={item.questionId} className="rounded-xl border border-line p-4">
        <p>{question?.action ?? `問題ID: ${item.questionId}（現在の問題集にはありません）`}</p>
        <p>習熟度 {item.score} / 100 / 期限 {new Date(item.reviewDueAt).toLocaleString("ja-JP")}</p>
        {question && <Link className="button-secondary mt-2 inline-flex" to={`/practice?question=${encodeURIComponent(question.id)}`}>この問題を練習</Link>}
      </li>;
    })}</ul>}
    <Link className="button-secondary inline-flex" to="/analytics">分析へ戻る</Link>
  </section>;
}
