import { NextResponse } from "next/server";
import { z } from "zod";
import { AnswerMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseQuestionOrder } from "@/lib/utils";
import { gradeAnswer } from "@/lib/quiz/scoring";
import {
  isQuizOpenForPlayers,
  QUIZ_CLOSED_ERROR_CODE,
  QUIZ_CLOSED_USER_MESSAGE,
} from "@/lib/quiz/quiz-deadline";
import { isSessionOverdue } from "@/lib/quiz/quiz-session-time";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  questionId: z.string().min(1),
  userAnswerText: z.string(),
  answerMethod: z.nativeEnum(AnswerMethod),
  durationSec: z.coerce.number().int().min(0).max(24 * 60 * 60),
});

/**
 * POST：提交本题答案，判分并更新累计；最后一题时回写会话汇总与 finishedAt。
 */
export async function POST(
  request: Request,
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

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数错误", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    if (session.finishedAt) {
      return NextResponse.json({ error: "本场已结束" }, { status: 400 });
    }

    if (isSessionOverdue(session.startedAt)) {
      return NextResponse.json({ error: "答题时间已结束" }, { status: 400 });
    }

    const order = parseQuestionOrder(session.questionOrder);
    const existing = await prisma.quizAnswer.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    if (existing.length >= order.length) {
      return NextResponse.json({ error: "题目已完成" }, { status: 400 });
    }

    if (!order.includes(parsed.data.questionId)) {
      return NextResponse.json({ error: "题目不属于本场测验" }, { status: 400 });
    }

    if (existing.some((a) => a.questionId === parsed.data.questionId)) {
      return NextResponse.json({ error: "该题已作答" }, { status: 400 });
    }

    const question = await prisma.question.findUnique({
      where: { id: parsed.data.questionId },
    });
    if (!question) return NextResponse.json({ error: "题目不存在" }, { status: 400 });

    const graded = gradeAnswer(question, parsed.data.userAnswerText);

    const answer = await prisma.quizAnswer.create({
      data: {
        sessionId,
        questionId: question.id,
        userAnswerText: parsed.data.userAnswerText,
        normalizedAnswer: graded.normalizedAnswer,
        isCorrect: graded.isCorrect,
        scoreAwarded: graded.scoreAwarded,
        durationSec: parsed.data.durationSec,
        answerMethod: parsed.data.answerMethod,
      },
    });

    const newCorrect = session.correctCount + (graded.isCorrect ? 1 : 0);
    const newWrong = session.wrongCount + (graded.isCorrect ? 0 : 1);
    const newScore = session.totalScore + graded.scoreAwarded;
    const afterIds = new Set(existing.map((a) => a.questionId));
    afterIds.add(question.id);
    const isLast = order.every((id) => afterIds.has(id));

    const now = new Date();
    const totalDurationSec = Math.max(
      0,
      Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
    );

    await prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        totalScore: newScore,
        correctCount: newCorrect,
        wrongCount: newWrong,
        ...(isLast
          ? {
              finishedAt: now,
              totalDurationSec,
            }
          : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      finished: isLast,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
