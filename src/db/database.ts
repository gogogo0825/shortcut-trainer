import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Mastery, Question, Session } from "../data/questionSchema";
import { attemptSchema, masterySchema } from "../data/questionSchema";
import { sampleQuestions } from "../data/sampleQuestions";
import { calculateMastery } from "../features/analytics/calculations";
import { resolveStandardQuestionIdCollisions } from "./questionIdentity";
import type { DeviceVerification } from "../data/deviceVerification";

export interface SettingRecord {
  key: string;
  value: unknown;
}

export interface MetadataRecord {
  key: string;
  value: unknown;
}

export interface AchievementRecord {
  id: string;
  unlockedAt?: string;
}

export class ShortcutTrainerDatabase extends Dexie {
  attempts!: EntityTable<Attempt, "id">;
  sessions!: EntityTable<Session, "id">;
  mastery!: EntityTable<Mastery, "questionId">;
  customQuestions!: EntityTable<Question, "id">;
  settings!: EntityTable<SettingRecord, "key">;
  achievements!: EntityTable<AchievementRecord, "id">;
  metadata!: EntityTable<MetadataRecord, "key">;
  deviceVerifications!: EntityTable<DeviceVerification, "id">;

  constructor(name = "shortcut-trainer") {
    super(name);
    this.version(1).stores({
      attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod",
      sessions: "id, mode, startedAt, completedAt",
      mastery: "questionId, score, reviewDueAt, lastReviewedAt",
      customQuestions: "id, category, difficulty, enabled",
      settings: "key",
      achievements: "id, unlockedAt",
      metadata: "key",
    });
    this.version(2).stores({ attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod" }).upgrade(async (tx) => {
      const attempts = (await tx.table("attempts").toArray()).map((value) => attemptSchema.parse(value));
      const ids = [...new Set(attempts.map((a) => a.questionId))];
      for (const id of ids) {
        if (await tx.table("mastery").get(id)) continue;
        const mastery = calculateMastery(attempts.filter((a) => a.questionId === id), sampleQuestions.find((q) => q.id === id));
        if (mastery) await tx.table("mastery").add(masterySchema.parse(mastery));
      }
    });
    this.version(3).stores({
      attempts: "id, questionId, sessionId, timestamp, mode, gradingMethod",
      sessions: "id, mode, startedAt, completedAt",
      mastery: "questionId, score, reviewDueAt, lastReviewedAt",
      customQuestions: "id, category, difficulty, enabled",
      settings: "key",
      achievements: "id, unlockedAt",
      metadata: "key",
    }).upgrade(async (tx) => {
      await resolveStandardQuestionIdCollisions(tx);
      const customQuestions = await tx.table("customQuestions").toArray() as Question[];
      const questions = [...sampleQuestions, ...customQuestions];
      const attempts = (await tx.table("attempts").toArray()).map((value) => attemptSchema.parse(value));
      const existingMastery = await tx.table("mastery").toArray() as Mastery[];
      const questionIds = new Set([...attempts.map((attempt) => attempt.questionId), ...existingMastery.map((item) => item.questionId)]);

      for (const id of questionIds) {
        const question = questions.find((item) => item.id === id);
        if (!question) continue;
        const questionAttempts = attempts.filter((attempt) => attempt.questionId === id);
        const oldMastery = existingMastery.find((item) => item.questionId === id);
        const hasOlderRevision = questionAttempts.some((attempt) => attempt.questionRevision !== question.revision);
        const hasCurrentRevision = questionAttempts.some((attempt) => attempt.questionRevision === question.revision);
        if (oldMastery && oldMastery.questionRevision === undefined) {
          if (hasOlderRevision && hasCurrentRevision) {
            const mastery = calculateMastery(questionAttempts, question);
            await tx.table("mastery").put(masterySchema.parse(mastery ?? { ...oldMastery, questionRevision: 0 }));
          } else {
            await tx.table("mastery").put(masterySchema.parse({
              ...oldMastery,
              questionRevision: hasOlderRevision ? 0 : question.revision,
            }));
          }
          continue;
        }
        if (oldMastery && oldMastery.questionRevision !== question.revision) {
          const mastery = calculateMastery(questionAttempts, question);
          if (mastery) await tx.table("mastery").put(masterySchema.parse(mastery));
          else if (hasOlderRevision) await tx.table("mastery").put(masterySchema.parse({ ...oldMastery, questionRevision: 0 }));
          continue;
        }
        if (!oldMastery) {
          const mastery = calculateMastery(questionAttempts, question);
          if (mastery) await tx.table("mastery").add(masterySchema.parse(mastery));
        }
      }
    });
    this.version(4).stores({
      deviceVerifications: "id, questionId, [questionId+questionRevision], recordedAt",
    });
  }
}

export const database = new ShortcutTrainerDatabase();
