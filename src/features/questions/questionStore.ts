import { z } from "zod";
import Papa from "papaparse";
import { questionSchema, type Question } from "../../data/questionSchema";
import { sampleQuestions } from "../../data/sampleQuestions";
import { database } from "../../db/database";
import { validateQuestions } from "../../data/validateQuestions";
import { resolveStandardQuestionIdCollisions } from "../../db/questionIdentity";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const standardIds = new Set(sampleQuestions.map((q) => q.id));

async function hasHistory(id: string): Promise<boolean> {
  return Boolean(await database.attempts.where("questionId").equals(id).count() ||
    await database.mastery.get(id) ||
    (await database.sessions.toArray()).some((session) => session.questionIds.includes(id)));
}

export async function loadQuestions(): Promise<Question[]> {
  return database.transaction("rw", [database.attempts, database.sessions, database.mastery, database.customQuestions], async (tx) => {
    await resolveStandardQuestionIdCollisions(tx);
    const custom = (await database.customQuestions.toArray()).map((q) => questionSchema.parse(q));
    return [...sampleQuestions, ...custom];
  });
}

export function parseQuestionFile(text: string, format: "csv" | "json"): Question[] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("ファイルは2 MiB以下にしてください。");
  if (format === "json") {
    const raw: unknown = JSON.parse(text);
    return validateQuestions(raw);
  }
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error(`CSV形式が不正です: ${parsed.errors[0].message}`);
  const rows = parsed.data.map((row, i) => {
    try {
      return {
        ...row,
        revision: Number(row.revision),
        enabled: row.enabled === "true" ? true : row.enabled === "false" ? false : row.enabled,
        platform: JSON.parse(row.platform), appVersions: row.appVersions ? JSON.parse(row.appVersions) : undefined,
        steps: JSON.parse(row.steps), gradingModes: JSON.parse(row.gradingModes),
        source: JSON.parse(row.source), tags: JSON.parse(row.tags),
        targetTimeMs: row.targetTimeMs ? Number(row.targetTimeMs) : undefined,
      };
    } catch (reason) { throw new Error(`CSV ${i + 2}行目: ${reason instanceof Error ? reason.message : String(reason)}`); }
  });
  return validateQuestions(rows);
}

export async function saveCustomQuestion(input: unknown, originalId?: string): Promise<void> {
  const question = validateQuestions([input])[0];
  if (standardIds.has(question.id)) throw new Error("標準問題のIDは使用できません。");
  if (originalId && originalId !== question.id) throw new Error("既存問題のIDは変更できません。");
  await database.transaction("rw", database.customQuestions, database.attempts, database.mastery, database.sessions, async () => {
    const current = await database.customQuestions.get(question.id);
    if (originalId) {
      if (!current) throw new Error("編集対象が見つかりません。");
      if (question.revision !== current.revision + 1) throw new Error("revisionは現在値より1増やしてください。");
      if ((question.category !== current.category || question.action !== current.action) && await hasHistory(question.id)) throw new Error("履歴のある問題のカテゴリ・操作名は変更できません。");
      await database.customQuestions.put(question);
    } else {
      if (current || await hasHistory(question.id)) {
        throw new Error("このIDは既存問題または履歴で使用されています。");
      }
      if (question.revision !== 1) throw new Error("新規問題のrevisionは1にしてください。");
      await database.customQuestions.add(question);
    }
  });
}

export async function retireCustomQuestion(id: string): Promise<void> {
  await database.transaction("rw", database.customQuestions, async () => {
    const item = await database.customQuestions.get(id);
    if (!item) throw new Error("対象の独自問題が見つかりません。");
    await database.customQuestions.put(questionSchema.parse({ ...item, enabled: false, revision: item.revision + 1 }));
  });
}

export async function importCustomQuestions(questions: Question[], collision: "skip" | "replace"): Promise<{ added: number; skipped: number; updated: number }> {
  const checked = validateQuestions(questions);
  if (checked.some((q) => standardIds.has(q.id))) throw new Error("標準問題のIDは取り込めません。");
  return database.transaction("rw", database.customQuestions, database.attempts, database.mastery, database.sessions, async () => {
    let added = 0, skipped = 0, updated = 0;
    for (const question of checked) {
      const current = await database.customQuestions.get(question.id);
      if (current) {
        if (collision === "skip") { skipped++; continue; }
        if (question.revision <= current.revision) throw new Error(`更新には現在より大きなrevisionが必要です: ${question.id}`);
        if ((question.category !== current.category || question.action !== current.action) && await hasHistory(question.id)) throw new Error(`履歴のある問題のカテゴリ・操作名は変更できません: ${question.id}`);
        await database.customQuestions.put(question);
        updated++;
      } else {
        if (await hasHistory(question.id)) throw new Error(`履歴で使用中のIDです: ${question.id}`);
        if (question.revision !== 1) throw new Error(`新規問題のrevisionは1にしてください: ${question.id}`);
        await database.customQuestions.add(question);
        added++;
      }
    }
    return z.object({ added: z.number(), skipped: z.number(), updated: z.number() }).parse({ added, skipped, updated });
  });
}
