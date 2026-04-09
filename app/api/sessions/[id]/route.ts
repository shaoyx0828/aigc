import { NextResponse } from "next/server";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";

/**
 * GET：单场会话详情 + 每题作答记录
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const { id } = await context.params;
  const session = await prisma.quizSession.findUnique({
    where: { id },
    include: {
      answers: {
        include: { question: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(session);
}
