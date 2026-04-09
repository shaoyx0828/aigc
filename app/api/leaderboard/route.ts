import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertAdminOr401 } from "@/lib/assert-admin-api";
import {
  isQuizOpenForPlayers,
  QUIZ_CLOSED_ERROR_CODE,
  QUIZ_CLOSED_USER_MESSAGE,
} from "@/lib/quiz/quiz-deadline";
import { maskPhoneForDisplay } from "@/lib/quiz/quiz-phone";

export const dynamic = "force-dynamic";

/**
 * GET：最近已完成场次排行榜（总分降序、用时升序）
 */
export async function GET() {
  const admin = await assertAdminOr401();
  if (admin) return admin;
  if (!isQuizOpenForPlayers()) {
    return NextResponse.json(
      { error: QUIZ_CLOSED_USER_MESSAGE, code: QUIZ_CLOSED_ERROR_CODE, items: [] },
      { status: 403 }
    );
  }

  const items = await prisma.quizSession.findMany({
    where: { finishedAt: { not: null } },
    orderBy: [{ totalScore: "desc" }, { totalDurationSec: "asc" }],
    take: 100,
  });
  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      nickname: s.nickname,
      phoneMask: maskPhoneForDisplay(s.phone),
      totalScore: s.totalScore,
      correctCount: s.correctCount,
      wrongCount: s.wrongCount,
      totalDurationSec: s.totalDurationSec,
      finishedAt: s.finishedAt?.toISOString() ?? null,
      sourceChannel: s.sourceChannel,
    })),
  });
}
