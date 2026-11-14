import type { Attempt, GradingMethod, Mastery, Question } from "../../data/questionSchema";

export const MASTERY_VERSION = 1;
export const MASTERY_WEIGHTS = { accuracy: 0.6, speed: 0.2, recent: 0.2 } as const;
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;
const PRIOR_COUNT = 3;
const DAY_MS = 86_400_000;

export function isAnswered(attempt: Attempt): boolean {
  return attempt.outcome === "answered" || (attempt.outcome === undefined && !attempt.interrupted);
}

export function isMasteryAttempt(attempt: Attempt): boolean {
  return isAnswered(attempt) && attempt.mode === "quiz" && attempt.firstTry && attempt.gradingMethod === "keyboard";
}

export function isMasteryForQuestion(mastery: Mastery, question: Question): boolean {
  return mastery.questionRevision === undefined || mastery.questionRevision === question.revision;
}

export function calculateMastery(attempts: readonly Attempt[], question?: Question): Mastery | null {
  const eligible = attempts.filter((attempt) => isMasteryAttempt(attempt) &&
    (question === undefined || attempt.questionRevision === question.revision)).slice().sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  if (!eligible.length) return null;
  const latest = eligible.slice(-20);
  let weightedCorrect = PRIOR_COUNT * 0.5;
  let weight = PRIOR_COUNT;
  latest.forEach((attempt, i) => {
    const w = 1 + i / Math.max(1, latest.length - 1);
    weightedCorrect += (attempt.correct ? 1 : 0) * w;
    weight += w;
  });
  const recent = latest.slice(-5);
  const recentScore = (recent.filter((a) => a.correct).length + PRIOR_COUNT * 0.5) / (recent.length + PRIOR_COUNT);
  const speeds = question?.targetTimeMs ? latest.filter((a) => a.correct && !a.interrupted && a.elapsedMs !== undefined) : [];
  const speedScore = speeds.length && question?.targetTimeMs
    ? (speeds.reduce((sum, a) => sum + Math.min(1, question.targetTimeMs! / Math.max(1, a.elapsedMs!)), 0) + PRIOR_COUNT * 0.5) / (speeds.length + PRIOR_COUNT)
    : 0.5;
  const score = Math.round(100 * (MASTERY_WEIGHTS.accuracy * weightedCorrect / weight + MASTERY_WEIGHTS.speed * speedScore + MASTERY_WEIGHTS.recent * recentScore));
  let interval = 0;
  let lapses = 0;
  for (const attempt of eligible) {
    if (!attempt.correct) {
      lapses++;
      interval = 1;
    } else {
      interval = REVIEW_INTERVALS.find((days) => days > interval) ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
    }
  }
  const last = eligible[eligible.length - 1];
  return {
    questionId: last.questionId, score, intervalDays: interval, easeFactor: 2.5,
    reviewDueAt: new Date(Date.parse(last.timestamp) + interval * DAY_MS).toISOString(),
    lastReviewedAt: last.timestamp, lapses, algorithmVersion: MASTERY_VERSION,
    questionRevision: question?.revision ?? last.questionRevision,
  };
}

export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function streakDays(attempts: readonly Attempt[], now: Date): number {
  const days = new Set(attempts.filter(isAnswered).map((a) => localDay(new Date(a.timestamp))));
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(localDay(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(day))) { streak++; day.setDate(day.getDate() - 1); }
  return streak;
}

export interface MethodStats {
  method: GradingMethod;
  mode: Attempt["mode"];
  firstTry: boolean;
  total: number;
  correct: number;
  averageMs: number | null;
}

export function methodStats(attempts: readonly Attempt[]): MethodStats[] {
  const groups = new Map<string, { stats: MethodStats; times: number[] }>();
  for (const a of attempts.filter(isAnswered)) {
    const key = `${a.mode}:${a.gradingMethod}:${a.firstTry}`;
    let group = groups.get(key);
    if (!group) {
      group = { stats: { method: a.gradingMethod, mode: a.mode, firstTry: a.firstTry, total: 0, correct: 0, averageMs: null }, times: [] };
      groups.set(key, group);
    }
    group.stats.total++;
    if (a.correct) group.stats.correct++;
    if (a.gradingMethod === "keyboard" && !a.interrupted && a.elapsedMs !== undefined) group.times.push(a.elapsedMs);
  }
  return [...groups.values()].map(({ stats, times }) => ({
    ...stats, averageMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
  })).sort((a, b) => `${a.mode}:${a.method}:${a.firstTry}`.localeCompare(`${b.mode}:${b.method}:${b.firstTry}`));
}

export function dailyStats(attempts: readonly Attempt[]): { day: string; answered: number; correct: number }[] {
  const days = new Map<string, { day: string; answered: number; correct: number }>();
  for (const attempt of attempts.filter((a) => isMasteryAttempt(a))) {
    const day = localDay(new Date(attempt.timestamp));
    const item = days.get(day) ?? { day, answered: 0, correct: 0 };
    item.answered++;
    if (attempt.correct) item.correct++;
    days.set(day, item);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}
