import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isQuizOpenForPlayers,
  QUIZ_CLOSED_ERROR_CODE,
  QUIZ_CLOSED_USER_MESSAGE,
} from "@/lib/quiz/quiz-deadline";
import { isSessionOverdue } from "@/lib/quiz/quiz-session-time";

export const dynamic = "force-dynamic";

/**
 * POST：撤回上一题的作答记录，回到该题可重新选择（未作答时不可撤回）。
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  try {
    if (!isQuizOpenForPlayers()) {
      return NextResponse.json(
        { error: QUIZ_CLOSED_USER_MESSAGE, code: QUIZ_CLOSED_ERROR_CODE },
        { status: 403 }
      );
    }

    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    if (isSessionOverdue(session.startedAt)) {
      return NextResponse.json(
        { error: "答题时间已结束，无法撤回上一题" },
        { status: 400 }
      );
    }

    const last = await prisma.quizAnswer.findFirst({
      where: { sessionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    if (!last) {
      return NextResponse.json({ error: "暂无已提交的答案可撤回" }, { status: 400 });
    }

    const newScore = Math.max(0, session.totalScore - last.scoreAwarded);
    const newCorrect = Math.max(
      0,
      session.correctCount - (last.isCorrect ? 1 : 0)
    );
    const newWrong = Math.max(0, session.wrongCount - (last.isCorrect ? 0 : 1));

    await prisma.$transaction([
      prisma.quizAnswer.delete({ where: { id: last.id } }),
      prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          totalScore: newScore,
          correctCount: newCorrect,
          wrongCount: newWrong,
          finishedAt: null,
          totalDurationSec: 0,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      session: {
        totalScore: newScore,
        correctCount: newCorrect,
        wrongCount: newWrong,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "撤回失败" }, { status: 500 });
  }
}
