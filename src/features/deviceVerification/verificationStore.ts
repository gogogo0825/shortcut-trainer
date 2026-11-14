import { deviceVerificationSchema, type DeviceResult, type DeviceVerification } from "../../data/deviceVerification";
import { sampleQuestions } from "../../data/sampleQuestions";
import type { Question } from "../../data/questionSchema";
import { database } from "../../db/database";

export const resultLabels: Record<DeviceResult, string> = {
  success: "正常動作",
  mismatch: "動作不一致",
  unavailable: "検証不可",
  unverified: "未確認",
};

export async function listVerifications(): Promise<DeviceVerification[]> {
  return (await database.deviceVerifications.toArray()).map((record) => deviceVerificationSchema.parse(record));
}

export async function saveVerification(input: unknown): Promise<DeviceVerification> {
  const record = deviceVerificationSchema.parse(input);
  const question = sampleQuestions.find((item) => item.id === record.questionId);
  if (!question || question.revision !== record.questionRevision) {
    throw new Error("現行revisionの標準問題だけに実機検証結果を登録できます。");
  }
  await database.deviceVerifications.add(record);
  return record;
}

export function latestVerifications(questions: readonly Question[], records: readonly DeviceVerification[]): Map<string, DeviceVerification> {
  const revisions = new Map(questions.map((question) => [question.id, question.revision]));
  const latest = new Map<string, DeviceVerification>();
  for (const record of records) {
    if (revisions.get(record.questionId) !== record.questionRevision) continue;
    const old = latest.get(record.questionId);
    if (!old || record.recordedAt > old.recordedAt || (record.recordedAt === old.recordedAt && record.id > old.id)) {
      latest.set(record.questionId, record);
    }
  }
  return latest;
}

export function countResults(questions: readonly Question[], latest: ReadonlyMap<string, DeviceVerification>): Record<DeviceResult, number> {
  const counts: Record<DeviceResult, number> = { success: 0, mismatch: 0, unavailable: 0, unverified: 0 };
  for (const question of questions) counts[latest.get(question.id)?.result ?? "unverified"]++;
  return counts;
}
