import { z } from "zod";

export const deviceResultSchema = z.enum(["success", "mismatch", "unavailable", "unverified"]);
export const captureResultSchema = z.enum(["not_tested", "detected", "not_detected", "mismatch"]);

export const deviceVerificationSchema = z.object({
  id: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  questionRevision: z.number().int().positive(),
  result: deviceResultSchema,
  confirmedInTarget: z.boolean(),
  verifiedAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  os: z.string().trim().min(1).max(200),
  browser: z.string().trim().min(1).max(200),
  application: z.string().trim().min(1).max(200),
  keyboardLayout: z.string().trim().min(1).max(200),
  notes: z.string().max(2000),
  capture: captureResultSchema,
}).strict().superRefine((record, context) => {
  if (record.result === "success" && !record.confirmedInTarget) {
    context.addIssue({ code: "custom", path: ["confirmedInTarget"], message: "対象アプリでの実機確認が必要です。" });
  }
  if (record.result !== "success" && record.confirmedInTarget) {
    context.addIssue({ code: "custom", path: ["confirmedInTarget"], message: "正常動作以外では成功確認を指定できません。" });
  }
});

export type DeviceVerification = z.infer<typeof deviceVerificationSchema>;
export type DeviceResult = z.infer<typeof deviceResultSchema>;
