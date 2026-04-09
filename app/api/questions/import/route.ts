import { NextResponse } from "next/server";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";
import { parseQuestionImportBuffer, importRowToPrismaData } from "@/lib/xlsx/question-io";

/**
 * POST：multipart/form-data，字段 file 为 xlsx/csv
 */
export async function POST(request: Request) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "请上传 file 字段" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { ok, errors } = parseQuestionImportBuffer(buffer);

    if (ok.length === 0) {
      return NextResponse.json(
        {
          error: "没有有效行",
          rowErrors: errors.map((e) => ({
            row: e.rowNumber,
            message: e.zodError?.errors.map((x) => x.message).join("; ") ?? "未知错误",
          })),
        },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(
      ok.map((row) =>
        prisma.question.create({
          data: importRowToPrismaData(row.data!),
        })
      )
    );

    return NextResponse.json({
      created: created.length,
      rowErrors: errors.map((e) => ({
        row: e.rowNumber,
        message: e.zodError?.errors.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") ?? "",
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "导入解析失败" }, { status: 500 });
  }
}
