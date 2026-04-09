import { z } from "zod";
import {
  QuestionType,
  Difficulty,
  ReviewStatus,
} from "@prisma/client";

/** 与 Prisma 枚举一致的 zod 枚举 */
export const questionTypeZ = z.nativeEnum(QuestionType);
export const difficultyZ = z.nativeEnum(Difficulty);
export const reviewStatusZ = z.nativeEnum(ReviewStatus);

/** 后台表单 / API 创建与更新 */
export const questionWriteSchema = z.object({
  category: z.string().min(1, "分类不能为空"),
  type: questionTypeZ,
  difficulty: difficultyZ,
  question: z.string().min(1, "题干不能为空"),
  aliases: z.string().optional().default(""),
  canonicalAnswer: z.string().min(1, "标准答案不能为空"),
  avatarAnswer: z.string().optional().default(""),
  optionA: z.string().optional().default(""),
  optionB: z.string().optional().default(""),
  optionC: z.string().optional().default(""),
  optionD: z.string().optional().default(""),
  correctOption: z.string().optional().default(""),
  keywords: z.string().optional().default(""),
  explanation: z.string().optional().default(""),
  score: z.coerce.number().int().min(0).max(1000),
  timeLimitSec: z.coerce.number().int().min(5).max(24 * 60 * 60),
  enabled: z.coerce.boolean().optional().default(true),
  sourceDoc: z.string().optional().default(""),
  sourceVersion: z.string().optional().default(""),
  reviewStatus: reviewStatusZ.optional().default(ReviewStatus.draft),
});

export type QuestionWriteInput = z.infer<typeof questionWriteSchema>;

/** Excel 行（表头为英文） */
export const questionImportRowSchema = z.object({
  category: z.string().min(1, "category 必填"),
  type: z.enum(["single_choice", "true_false", "short_answer"], {
    errorMap: () => ({ message: "type 须为 single_choice | true_false | short_answer" }),
  }),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string().min(1, "question 必填"),
  aliases: z.string().optional().default(""),
  canonicalAnswer: z.string().min(1, "canonicalAnswer 必填"),
  avatarAnswer: z.string().optional().default(""),
  optionA: z.string().optional().default(""),
  optionB: z.string().optional().default(""),
  optionC: z.string().optional().default(""),
  optionD: z.string().optional().default(""),
  correctOption: z.string().optional().default(""),
  keywords: z.string().optional().default(""),
  explanation: z.string().optional().default(""),
  score: z.coerce.number().int().min(0),
  timeLimitSec: z.coerce.number().int().min(5).max(24 * 60 * 60),
  enabled: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    })
    .optional()
    .default(true),
  sourceDoc: z.string().optional().default(""),
  sourceVersion: z.string().optional().default(""),
  reviewStatus: z.enum(["draft", "reviewed", "needs_review"]).optional().default("draft"),
});

export type QuestionImportRow = z.infer<typeof questionImportRowSchema>;

export const IMPORT_HEADERS = [
  "category",
  "type",
  "difficulty",
  "question",
  "aliases",
  "canonicalAnswer",
  "avatarAnswer",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctOption",
  "keywords",
  "explanation",
  "score",
  "timeLimitSec",
  "enabled",
  "sourceDoc",
  "sourceVersion",
  "reviewStatus",
] as const;
