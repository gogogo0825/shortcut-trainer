import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { attemptSchema, sessionSchema } from "../../data/questionSchema";
import { database } from "../../db/database";
import { streakDays } from "../analytics/calculations";
import { levelForXp } from "./calculations";

export function Progress() {
  const [progress, setProgress] = useState<{ xp: number; days: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [sessions, attempts] = await Promise.all([database.sessions.toArray(), database.attempts.toArray()]);
      return {
        xp: sessions.map((item) => sessionSchema.parse(item)).reduce((total, session) => total + session.xp, 0),
        days: streakDays(attempts.map((item) => attemptSchema.parse(item)), new Date()),
      };
    }).subscribe({ next: (value) => { setProgress(value); setError(false); }, error: (reason: unknown) => { console.error("学習進捗を読み込めませんでした", reason); setError(true); } });
    return () => subscription.unsubscribe();
  }, []);
  if (error) return <p role="alert" className="text-sm">学習進捗を読み込めませんでした。</p>;
  if (!progress) return <p className="text-sm">学習進捗を読み込み中</p>;
  return <p aria-label="学習進捗" className="text-sm">レベル {levelForXp(progress.xp)} / {progress.xp} XP / 連続学習 {progress.days} 日</p>;
}
