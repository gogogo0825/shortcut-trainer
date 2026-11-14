import { z } from "zod";
import { attemptSchema, masterySchema, questionSchema, sessionSchema, settingSchema } from "../../data/questionSchema";
import { sampleQuestions } from "../../data/sampleQuestions";
import { database } from "../../db/database";
import { MAX_IMPORT_BYTES } from "./questionStore";
import { calculateMastery } from "../analytics/calculations";
import { validateQuestions } from "../../data/validateQuestions";
import { resolveStandardQuestionIdCollisions } from "../../db/questionIdentity";
import { deviceVerificationSchema } from "../../data/deviceVerification";

const achievementSchema = z.object({ id: z.string().min(1), unlockedAt: z.string().datetime().optional() }).strict();
export const backupSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: z.string().datetime(),
  attempts: z.array(attemptSchema),
  sessions: z.array(sessionSchema),
  mastery: z.array(masterySchema),
  customQuestions: z.array(questionSchema),
  settings: z.array(settingSchema),
  achievements: z.array(achievementSchema),
  deviceVerifications: z.array(deviceVerificationSchema).optional(),
}).strict().superRefine((backup, context) => {
  if (backup.version === 3 && backup.deviceVerifications === undefined) {
    context.addIssue({ code: "custom", path: ["deviceVerifications"], message: "実機検証記録がありません。" });
  }
  if (backup.version !== 3 && backup.deviceVerifications !== undefined) {
    context.addIssue({ code: "custom", path: ["deviceVerifications"], message: "旧形式に実機検証記録は含められません。" });
  }
});
export type Backup = z.infer<typeof backupSchema>;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

function sameContent(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export async function makeBackup(): Promise<Backup> {
  return database.transaction("r", [database.attempts, database.sessions, database.mastery, database.customQuestions, database.settings, database.achievements, database.deviceVerifications], async () => backupSchema.parse({
    version: 3, exportedAt: new Date().toISOString(),
    attempts: await database.attempts.toArray(), sessions: await database.sessions.toArray(),
    mastery: await database.mastery.toArray(), customQuestions: await database.customQuestions.toArray(),
    settings: await database.settings.toArray(), achievements: await database.achievements.toArray(),
    deviceVerifications: await database.deviceVerifications.toArray(),
  }));
}

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("バックアップは2 MiB以下にしてください。");
  const parsed = backupSchema.parse(JSON.parse(text));
  if (parsed.customQuestions.length) validateQuestions(parsed.customQuestions);
  for (const [label, ids] of [
    ["attempts", parsed.attempts.map((x) => x.id)], ["sessions", parsed.sessions.map((x) => x.id)],
    ["mastery", parsed.mastery.map((x) => x.questionId)], ["customQuestions", parsed.customQuestions.map((x) => x.id)],
    ["settings", parsed.settings.map((x) => x.key)], ["achievements", parsed.achievements.map((x) => x.id)],
    ["deviceVerifications", (parsed.deviceVerifications ?? []).map((x) => x.id)],
  ] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`${label}にIDの重複があります。`);
  }
  return parsed;
}

function remapBackupCollisions(backup: Backup, reservedIds: Set<string>): { data: Backup; remapped: number } {
  const standardIds = new Set(sampleQuestions.map((question) => question.id));
  const remaps = new Map<string, string>();
  const reserved = new Set([
    ...reservedIds,
    ...standardIds,
    ...backup.customQuestions.map((question) => question.id),
    ...backup.attempts.map((attempt) => attempt.questionId),
    ...backup.sessions.flatMap((session) => session.questionIds),
    ...backup.mastery.map((item) => item.questionId),
  ]);
  for (const question of backup.customQuestions) {
    if (!standardIds.has(question.id)) continue;
    let newId = `custom-${question.id}`;
    let suffix = 2;
    while (reserved.has(newId)) newId = `custom-${question.id}-${suffix++}`;
    reserved.add(newId);
    remaps.set(question.id, newId);
  }
  const mappedId = (id: string) => remaps.get(id) ?? id;
  return {
    data: backupSchema.parse({
      ...backup,
      customQuestions: backup.customQuestions.map((question) => ({ ...question, id: mappedId(question.id) })),
      attempts: backup.attempts.map((attempt) => ({ ...attempt, questionId: mappedId(attempt.questionId) })),
      mastery: backup.mastery.map((item) => ({ ...item, questionId: mappedId(item.questionId) })),
      sessions: backup.sessions.map((session) => ({ ...session, questionIds: session.questionIds.map(mappedId) })),
    }),
    remapped: remaps.size,
  };
}

export async function restoreBackup(backup: Backup): Promise<{ added: number; skipped: number; remapped: number }> {
  const parsed = parseBackup(JSON.stringify(backup));
  return database.transaction("rw", [database.attempts, database.sessions, database.mastery, database.customQuestions, database.settings, database.achievements, database.deviceVerifications], async (tx) => {
    await resolveStandardQuestionIdCollisions(tx);
    const [existingAttempts, existingSessions, existingMastery, existingQuestions] = await Promise.all([
      database.attempts.toArray(),
      database.sessions.toArray(),
      database.mastery.toArray(),
      database.customQuestions.toArray(),
    ]);
    const reservedIds = new Set([
      ...existingAttempts.map((attempt) => attempt.questionId),
      ...existingSessions.flatMap((session) => session.questionIds),
      ...existingMastery.map((item) => item.questionId),
      ...existingQuestions.map((question) => question.id),
    ]);
    const { data, remapped } = remapBackupCollisions(parsed, reservedIds);
    if (data.customQuestions.length) validateQuestions(data.customQuestions);
    let added = 0, skipped = 0;
    const backupCustomIds = new Set(data.customQuestions.map((q) => q.id));
    for (const id of new Set([...data.attempts.map((a) => a.questionId), ...data.mastery.map((m) => m.questionId), ...data.sessions.flatMap((s) => s.questionIds)])) {
      if (!backupCustomIds.has(id) && await database.customQuestions.get(id)) throw new Error(`バックアップに問題定義のない独自問題IDが衝突しました: ${id}`);
    }
    for (const q of data.customQuestions) {
      const current = await database.customQuestions.get(q.id);
      if (current) {
        if (!sameContent(current, q)) throw new Error(`独自問題IDが異なる内容と衝突しました: ${q.id}`);
        skipped++; continue;
      }
      if (await database.attempts.where("questionId").equals(q.id).count() || await database.mastery.get(q.id) || (await database.sessions.toArray()).some((session) => session.questionIds.includes(q.id))) throw new Error(`既存履歴で使用中の問題IDです: ${q.id}`);
      await database.customQuestions.add(q); added++;
    }
    for (const item of data.sessions) {
      const old = await database.sessions.get(item.id);
      if (old) { if (!sameContent(old, item)) throw new Error(`セッションIDが異なる内容と衝突しました: ${item.id}`); skipped++; }
      else { await database.sessions.add(item); added++; }
    }
    for (const item of data.attempts) {
      const old = await database.attempts.get(item.id);
      if (old) { if (!sameContent(old, item)) throw new Error(`回答IDが異なる内容と衝突しました: ${item.id}`); skipped++; }
      else { await database.attempts.add(item); added++; }
    }
    for (const item of data.mastery) {
      if (await database.mastery.get(item.questionId)) { skipped++; continue; }
      await database.mastery.add(item); added++;
    }
    for (const id of new Set([...data.attempts.map((a) => a.questionId), ...data.mastery.map((item) => item.questionId)])) {
      const attempts = (await database.attempts.where("questionId").equals(id).toArray()).map((a) => attemptSchema.parse(a));
      const question = sampleQuestions.find((q) => q.id === id) ?? await database.customQuestions.get(id);
      const mastery = calculateMastery(attempts, question);
      if (mastery) {
        await database.mastery.put(masterySchema.parse(mastery));
      } else {
        const oldMastery = await database.mastery.get(id);
        if (oldMastery && question && oldMastery.questionRevision === undefined) {
          const hasOlderRevision = attempts.some((attempt) => attempt.questionRevision !== question.revision);
          await database.mastery.put(masterySchema.parse({
            ...oldMastery,
            questionRevision: hasOlderRevision ? 0 : question.revision,
          }));
        }
      }
    }
    for (const item of data.settings) {
      if (await database.settings.get(item.key)) { skipped++; continue; }
      await database.settings.add(item); added++;
    }
    for (const item of data.achievements) {
      if (await database.achievements.get(item.id)) { skipped++; continue; }
      await database.achievements.add(item); added++;
    }
    for (const item of data.deviceVerifications ?? []) {
      const old = await database.deviceVerifications.get(item.id);
      if (old) {
        if (!sameContent(old, item)) throw new Error(`実機検証記録IDが異なる内容と衝突しました: ${item.id}`);
        skipped++;
      } else {
        await database.deviceVerifications.add(item);
        added++;
      }
    }
    return { added, skipped, remapped };
  });
}
