import type { Mastery, Question } from "../../data/questionSchema";

export type SessionLimit = "5" | "10" | "20" | "50" | "1m" | "3m" | "5m" | "10m" | "unlimited";
export type Order = "difficulty" | "random" | "adaptive";

const rank = { beginner: 0, intermediate: 1, advanced: 2 } as const;

export function orderQuestions(questions: readonly Question[], order: Order, random = Math.random): Question[] {
  const result = [...questions];
  if (order === "difficulty" || order === "adaptive") {
    return result.sort((a, b) => rank[a.difficulty] - rank[b.difficulty]);
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function chooseAdaptiveQuestion(questions: readonly Question[], mastery: readonly Mastery[], now: number, previousId?: string): Question {
  if (!questions.length) throw new Error("適応出題の対象問題がありません");
  const map = new Map(mastery.filter((item) => {
    const question = questions.find((candidate) => candidate.id === item.questionId);
    return question && (item.questionRevision === undefined || item.questionRevision === question.revision);
  }).map((item) => [item.questionId, item]));
  const candidates = questions.length > 1 ? questions.filter((q) => q.id !== previousId) : [...questions];
  return candidates.slice().sort((a, b) => {
    const ma = map.get(a.id);
    const mb = map.get(b.id);
    const priority = (m: Mastery | undefined) => !m ? 2 : Date.parse(m.reviewDueAt) <= now ? 0 : 1;
    return priority(ma) - priority(mb) ||
      (ma?.score ?? 50) - (mb?.score ?? 50) ||
      a.id.localeCompare(b.id);
  })[0];
}

export function countLimit(limit: SessionLimit): number | null {
  return /^\d+$/.test(limit) ? Number(limit) : null;
}

export function timeLimitMs(limit: SessionLimit): number | null {
  return limit.endsWith("m") ? Number(limit.slice(0, -1)) * 60_000 : null;
}

export function makeChoices(question: Question, allQuestions: readonly Question[], random = Math.random): string[] {
  const correct = question.steps.map((step) => [...step.modifiers, step.key].join(" + ")).join(" → ");
  const alternatives = [...new Set(allQuestions
    .map((item) => item.steps.map((step) => [...step.modifiers, step.key].join(" + ")).join(" → "))
    .filter((answer) => answer !== correct))];
  for (let i = alternatives.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [alternatives[i], alternatives[j]] = [alternatives[j], alternatives[i]];
  }
  const choices = [correct, ...alternatives.slice(0, 3)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
