import { z } from "zod";

export const categorySchema = z.enum([
  "windows",
  "excel",
  "word",
  "powerpoint",
  "vscode",
  "browser",
]);
export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const gradingMethodSchema = z.enum([
  "keyboard",
  "multiple_choice",
  "self_assessment",
]);
export const verificationSchema = z.enum([
  "pending",
  "docs_checked",
  "device_checked",
]);

const sourceSchema = z
  .object({
    publisher: z.string().trim().min(1),
    url: z.string().url().optional(),
    checkedAt: z.string().datetime().optional(),
  })
  .strict();

const questionStepSchema = z
  .object({
    key: z.string().trim().min(1),
    code: z.string().trim().min(1),
    modifiers: z.array(z.enum(["Ctrl", "Shift", "Alt", "Meta"])),
    modifierSides: z.object({
      Ctrl: z.enum(["left", "right"]).optional(),
      Shift: z.enum(["left", "right"]).optional(),
      Alt: z.enum(["left", "right"]).optional(),
      Meta: z.enum(["left", "right"]).optional(),
    }).strict().optional(),
  })
  .strict()
  .superRefine((step, context) => {
    if (new Set(step.modifiers).size !== step.modifiers.length) {
      context.addIssue({ code: "custom", message: "修飾キーを重複して指定できません", path: ["modifiers"] });
    }
    for (const modifier of Object.keys(step.modifierSides ?? {})) {
      if (!step.modifiers.some((item) => item === modifier)) {
        context.addIssue({ code: "custom", message: "左右指定には対応する修飾キーが必要です", path: ["modifierSides", modifier] });
      }
    }
  });

export const questionSchema = z
  .object({
    id: z.string().trim().min(1),
    revision: z.number().int().positive(),
    category: categorySchema,
    difficulty: difficultySchema,
    action: z.string().trim().min(1),
    description: z.string().trim().min(1),
    platform: z.array(z.string().trim().min(1)).min(1),
    appVersions: z.array(z.string().trim().min(1)).optional(),
    targetTimeMs: z.number().positive().optional(),
    layout: z.enum(["jis", "us", "any"]),
    steps: z.array(questionStepSchema).min(1),
    gradingModes: z.array(gradingMethodSchema).min(1),
    source: sourceSchema,
    verification: verificationSchema,
    tags: z.array(z.string().trim().min(1)),
    enabled: z.boolean(),
  })
  .strict();

export const attemptSchema = z
  .object({
    id: z.string().trim().min(1),
    questionId: z.string().trim().min(1),
    questionRevision: z.number().int().positive(),
    sessionId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    mode: z.enum(["practice", "quiz"]),
    gradingMethod: gradingMethodSchema,
    correct: z.boolean(),
    firstTry: z.boolean(),
    elapsedMs: z.number().nonnegative().optional(),
    inputSequence: z.array(z.string()).optional(),
    interrupted: z.boolean(),
    outcome: z.enum(["answered", "skipped", "timeout", "abandoned"]).optional(),
  })
  .strict();

export const masterySchema = z
  .object({
    questionId: z.string().trim().min(1),
    score: z.number().min(0).max(100),
    reviewDueAt: z.string().datetime(),
    intervalDays: z.number().nonnegative(),
    easeFactor: z.number().positive(),
    lastReviewedAt: z.string().datetime().optional(),
    lapses: z.number().int().nonnegative(),
    algorithmVersion: z.number().int().positive(),
    questionRevision: z.number().int().nonnegative().optional(),
  })
  .strict();

export const sessionSchema = z
  .object({
    id: z.string().trim().min(1),
    mode: z.enum(["practice", "quiz"]),
    questionIds: z.array(z.string().trim().min(1)),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    completedCount: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
    category: categorySchema.or(z.literal("all")).optional(),
    order: z.enum(["difficulty", "random", "adaptive"]).optional(),
    limit: z.string().optional(),
  })
  .strict();

export const settingSchema = z
  .object({
    key: z.string().trim().min(1),
    value: z.unknown(),
  })
  .strict();

export const metadataSchema = z
  .object({
    key: z.string().trim().min(1),
    value: z.unknown(),
  })
  .strict();

export type Question = z.infer<typeof questionSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type Mastery = z.infer<typeof masterySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type GradingMethod = z.infer<typeof gradingMethodSchema>;
export type QuestionCategory = z.infer<typeof categorySchema>;
