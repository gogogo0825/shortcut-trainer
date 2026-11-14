import { z } from "zod";
import { questionSchema, type Question } from "./questionSchema";

export function duplicateShortcutCandidates(questions: readonly Question[]): string[][] {
  const grouped = new Map<string, string[]>();
  for (const q of questions) {
    const signature = JSON.stringify([q.category, q.steps.map((step) => [step.code, [...step.modifiers].sort(), step.modifierSides ?? {}])]);
    grouped.set(signature, [...(grouped.get(signature) ?? []), q.id]);
  }
  return [...grouped.values()].filter((ids) => ids.length > 1);
}

export function validateQuestions(input: unknown): Question[] {
  const questions = z.array(questionSchema).min(1).parse(input);
  const ids = new Set<string>();
  const signatures = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`問題IDが重複しています: ${q.id}`);
    ids.add(q.id);
    const signature = JSON.stringify([q.category, q.action.trim().toLowerCase()]);
    if (signatures.has(signature)) throw new Error(`同一カテゴリ内で操作名が重複しています: ${q.action}`);
    signatures.add(signature);
    if (q.verification !== "pending" && (!q.source.url || !q.source.checkedAt || q.source.publisher === "未確認")) {
      throw new Error(`確認済み問題に出典URL・確認日・発行元が必要です: ${q.id}`);
    }
    if (q.source.url && !["https:", "http:"].includes(new URL(q.source.url).protocol)) {
      throw new Error(`出典URLの形式が不正です: ${q.id}`);
    }
  }
  return questions;
}
