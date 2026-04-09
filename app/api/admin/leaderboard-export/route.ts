import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { SourceChannel } from "@prisma/client";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";

const channelLabel: Record<SourceChannel, string> = {
  link: "链接",
  qrcode: "二维码",
  other: "其他",
};

export async function GET() {
  const deny = await assertAdminOr401();
  if (deny) return deny;

  const items = await prisma.quizSession.findMany({
    where: { finishedAt: { not: null } },
    orderBy: [{ totalScore: "desc" }, { totalDurationSec: "asc" }],
  });

  const header = [
    "排名",
    "姓名",
    "手机号",
    "总分",
    "正确数",
    "错误数",
    "用时(秒)",
    "完成时间",
    "来源渠道",
  ];
  const rows: (string | number)[][] = items.map((s, i) => [
    i + 1,
    s.nickname,
    s.phone,
    s.totalScore,
    s.correctCount,
    s.wrongCount,
    s.totalDurationSec,
    s.finishedAt ? s.finishedAt.toISOString() : "",
    channelLabel[s.sourceChannel],
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "排行榜");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="leaderboard-export.xlsx"',
    },
  });
}
