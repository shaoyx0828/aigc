import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";
import { IMPORT_HEADERS, questionsToWorkbook } from "@/lib/xlsx/question-io";

/** GET：导出当前题库为 xlsx */
export async function GET() {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const items = await prisma.question.findMany({ orderBy: { createdAt: "asc" } });
  const rows = items.map((q) => {
    const r: Record<(typeof IMPORT_HEADERS)[number], string | number | boolean> = {
      category: q.category,
      type: q.type,
      difficulty: q.difficulty,
      question: q.question,
      aliases: q.aliases,
      canonicalAnswer: q.canonicalAnswer,
      avatarAnswer: q.avatarAnswer,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      keywords: q.keywords,
      explanation: q.explanation,
      score: q.score,
      timeLimitSec: q.timeLimitSec,
      enabled: q.enabled,
      sourceDoc: q.sourceDoc,
      sourceVersion: q.sourceVersion,
      reviewStatus: q.reviewStatus,
    };
    return r;
  });
  const wb = questionsToWorkbook(rows);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buf);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="questions-export.xlsx"',
    },
  });
}
