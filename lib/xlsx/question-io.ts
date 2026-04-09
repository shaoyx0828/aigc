import * as XLSX from "xlsx";
import { z } from "zod";
import {
  questionImportRowSchema,
  IMPORT_HEADERS,
  type QuestionImportRow,
} from "@/lib/schemas/question";
import type { QuestionType, Difficulty, ReviewStatus } from "@prisma/client";

// 给导出路由复用：表头顺序必须一致
export { IMPORT_HEADERS };

/** 生成空白导入模板（含表头） */
export function buildQuestionTemplateWorkbook(): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([Array.from(IMPORT_HEADERS)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "questions");
  return wb;
}

/** 将题库导出为工作簿 */
export function questionsToWorkbook(
  rows: Array<Record<(typeof IMPORT_HEADERS)[number], string | number | boolean>>
) {
  const data = [
    Array.from(IMPORT_HEADERS),
    ...rows.map((r) => IMPORT_HEADERS.map((h) => r[h] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "questions");
  return wb;
}

export interface ParsedImportRow {
  rowNumber: number;
  data?: QuestionImportRow;
  zodError?: z.ZodError;
}

/**
 * 解析上传的 xlsx/csv buffer，按表头映射为对象数组并 zod 校验。
 */
export function parseQuestionImportBuffer(buffer: Buffer): {
  ok: ParsedImportRow[];
  errors: ParsedImportRow[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const ok: ParsedImportRow[] = [];
  const errors: ParsedImportRow[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1 为表头
    const normalized: Record<string, unknown> = {};
    for (const key of IMPORT_HEADERS) {
      normalized[key] = row[key] ?? "";
    }
    const parsed = questionImportRowSchema.safeParse(normalized);
    if (parsed.success) {
      ok.push({ rowNumber, data: parsed.data });
    } else {
      errors.push({ rowNumber, zodError: parsed.error });
    }
  });

  return { ok, errors };
}

/** 导入行转 Prisma create 输入 */
export function importRowToPrismaData(row: QuestionImportRow) {
  return {
    category: row.category,
    type: row.type as QuestionType,
    difficulty: row.difficulty as Difficulty,
    question: row.question,
    aliases: row.aliases,
    canonicalAnswer: row.canonicalAnswer,
    avatarAnswer: row.avatarAnswer,
    optionA: row.optionA,
    optionB: row.optionB,
    optionC: row.optionC,
    optionD: row.optionD,
    correctOption: row.correctOption,
    keywords: row.keywords,
    explanation: row.explanation,
    score: row.score,
    timeLimitSec: row.timeLimitSec,
    enabled: row.enabled,
    sourceDoc: row.sourceDoc,
    sourceVersion: row.sourceVersion,
    reviewStatus: row.reviewStatus as ReviewStatus,
  };
}
