import type { Attempt } from "../../data/questionSchema";
import { isAnswered } from "../analytics/calculations";

export const XP_PER_FIRST_CORRECT = 10;
export const XP_PER_LEVEL = 100;

export function attemptXp(attempt: Attempt): number {
  return isAnswered(attempt) && attempt.firstTry && attempt.correct ? XP_PER_FIRST_CORRECT : 0;
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export function sessionStreak(attempts: readonly Attempt[]): number {
  let streak = 0;
  for (const attempt of attempts) {
    if (!attempt.firstTry) continue;
    streak = isAnswered(attempt) && attempt.correct ? streak + 1 : 0;
  }
  return streak;
}
