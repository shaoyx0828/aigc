import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { buildQuestionTemplateWorkbook } from "@/lib/xlsx/question-io";

/** GET：下载 Excel 导入模板 */
export async function GET() {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const wb = buildQuestionTemplateWorkbook();
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buf);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="question-import-template.xlsx"',
    },
  });
}
