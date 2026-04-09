import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseQuestionOrder } from "@/lib/utils";
import { getTotalQuestions } from "@/lib/quiz/engine";
import {
  isQuizOpenForPlayers,
  QUIZ_CLOSED_ERROR_CODE,
  QUIZ_CLOSED_USER_MESSAGE,
} from "@/lib/quiz/quiz-deadline";
import {
  getRemainingSessionSec,
  getSessionDeadline,
  isSessionOverdue,
} from "@/lib/quiz/quiz-session-time";
import { maskPhoneForDisplay } from "@/lib/quiz/quiz-phone";

/** 进度随作答变化，禁止缓存 */
export const dynamic = "force-dynamic";

function toPublicQuestion(q: {
  id: string;
  category: string;
  type: string;
  difficulty: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  timeLimitSec: number;
  score: number;
}) {
  return {
    id: q.id,
    category: q.category,
    type: q.type,
    difficulty: q.difficulty as "easy" | "medium" | "hard",
    question: q.question,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    timeLimitSec: q.timeLimitSec,
    score: q.score,
    speakText: q.question,
  };
}

/**
 * GET：场次状态、全场剩余时间、全部题目（不含标准答案）、已答题 id。
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  let session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: "会话不存在" }, { status: 404 });

  const finishedEarly = !!session.finishedAt;
  if (!finishedEarly && !isQuizOpenForPlayers()) {
    return NextResponse.json(
      { error: QUIZ_CLOSED_USER_MESSAGE, code: QUIZ_CLOSED_ERROR_CODE },
      { status: 403 }
    );
  }

  const answers = await prisma.quizAnswer.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  const order = parseQuestionOrder(session.questionOrder);
  const total = order.length;
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const allAnswered = total > 0 && order.every((id) => answeredIds.has(id));
  const now = new Date();
  const overdue = isSessionOverdue(session.startedAt, now.getTime());

  if (!session.finishedAt && (allAnswered || overdue)) {
    await prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        finishedAt: now,
        totalDurationSec: Math.max(
          0,
          Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
        ),
      },
    });
    session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
  }

  const finished = !!session.finishedAt;
  const answeredCount = answers.length;
  const questionIds = [...new Set(order)];
  const dbQuestions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  });
  const map = new Map(dbQuestions.map((q) => [q.id, q]));

  const questions = order
    .map((id) => {
      const q = map.get(id);
      return q ? toPublicQuestion(q) : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const remainingSec = finished
    ? 0
    : getRemainingSessionSec(session.startedAt, now.getTime());
  const sessionEndsAt = getSessionDeadline(session.startedAt).toISOString();
  const finishReason: "complete" | "time_up" | null = finished
    ? total > 0 && order.every((id) => answeredIds.has(id))
      ? "complete"
      : "time_up"
    : null;

  return NextResponse.json(
    {
      session: {
        id: session.id,
        nickname: session.nickname,
        phoneMask: maskPhoneForDisplay(session.phone),
        totalScore: session.totalScore,
        correctCount: session.correctCount,
        wrongCount: session.wrongCount,
        finishedAt: session.finishedAt,
        startedAt: session.startedAt,
        totalDurationSec: session.totalDurationSec,
      },
      total: getTotalQuestions(session),
      answeredCount,
      /** @deprecated 请用 answeredCount */
      currentIndex: answeredCount,
      finished,
      finishReason,
      sessionEndsAt,
      remainingSec,
      serverNow: now.toISOString(),
      answeredQuestionIds: Array.from(answeredIds),
      questions,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    }
  );
}
