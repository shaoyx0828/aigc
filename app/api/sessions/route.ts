import { NextResponse } from "next/server";
import { SourceChannel } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import { prisma } from "@/lib/db";

/**
 * GET：答题会话列表（管理端）
 */
export async function GET(request: Request) {
  const deny = await assertAdminOr401();
  if (deny) return deny;
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim();
  const source = searchParams.get("sourceChannel") as SourceChannel | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.QuizSessionWhereInput = {};
  if (nickname) where.nickname = { contains: nickname };
  if (source && Object.values(SourceChannel).includes(source)) {
    where.sourceChannel = source;
  }
  if (from || to) {
    where.startedAt = {};
    if (from) where.startedAt.gte = new Date(from);
    if (to) where.startedAt.lte = new Date(to);
  }

  const items = await prisma.quizSession.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}
