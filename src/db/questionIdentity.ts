import type { Transaction } from "dexie";
import { sampleQuestions } from "../data/sampleQuestions";

export async function resolveStandardQuestionIdCollisions(tx: Transaction): Promise<Map<string, string>> {
  const customTable = tx.table("customQuestions");
  const customQuestions = await customTable.toArray();
  const standardIds = new Set(sampleQuestions.map((question) => question.id));
  const collisions = customQuestions.filter((question) => standardIds.has(question.id));
  const remapped = new Map<string, string>();
  if (!collisions.length) return remapped;

  const attemptsTable = tx.table("attempts");
  const sessionsTable = tx.table("sessions");
  const masteryTable = tx.table("mastery");
  const [attempts, sessions, masteries] = await Promise.all([
    attemptsTable.toArray(),
    sessionsTable.toArray(),
    masteryTable.toArray(),
  ]);
  const reserved = new Set<string>([
    ...standardIds,
    ...customQuestions.map((question) => question.id),
    ...attempts.map((attempt) => attempt.questionId),
    ...sessions.flatMap((session) => session.questionIds),
    ...masteries.map((mastery) => mastery.questionId),
  ]);

  for (const question of collisions) {
    let newId = `custom-${question.id}`;
    let suffix = 2;
    while (reserved.has(newId)) newId = `custom-${question.id}-${suffix++}`;

    await customTable.add({ ...question, id: newId });
    await customTable.delete(question.id);

    const relatedAttempts = attempts.filter((attempt) => attempt.questionId === question.id);
    if (relatedAttempts.length) {
      await attemptsTable.bulkPut(relatedAttempts.map((attempt) => ({ ...attempt, questionId: newId })));
    }

    const mastery = masteries.find((item) => item.questionId === question.id);
    if (mastery) {
      await masteryTable.add({ ...mastery, questionId: newId });
      await masteryTable.delete(question.id);
    }

    const relatedSessions = sessions.filter((session) => session.questionIds.includes(question.id));
    if (relatedSessions.length) {
      await sessionsTable.bulkPut(relatedSessions.map((session) => ({
        ...session,
        questionIds: session.questionIds.map((id: string) => id === question.id ? newId : id),
      })));
    }

    remapped.set(question.id, newId);
    reserved.add(newId);
  }
  return remapped;
}
