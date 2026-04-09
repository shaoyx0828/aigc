import { NextResponse } from "next/server";
import { z } from "zod";
import { SourceChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseQuestionOrder } from "@/lib/utils";
import {
  isQuizOpenForPlayers,
  QUIZ_CLOSED_ERROR_CODE,
  QUIZ_CLOSED_USER_MESSAGE,
} from "@/lib/quiz/quiz-deadline";
import { QUIZ_PHONE_PATTERN } from "@/lib/quiz/quiz-phone";
import { QUIZ_SESSION_DRAW_COUNT } from "@/lib/quiz/quiz-draw-count";
import { shuffleQuestionIds } from "@/lib/quiz/shuffle-question-order";

export const dynamic = "force-dynamic";

const PHONE_ALREADY_FINISHED_CODE = "PHONE_ALREADY_FINISHED";
const SESSION_IN_PROGRESS_CODE = "SESSION_IN_PROGRESS";

const bodySchema = z.object({
  nickname: z.string().min(1, "请输入姓名").max(40),
  phone: z
    .string()
    .regex(QUIZ_PHONE_PATTERN, "请输入11位手机号，以1开头"),
});

/**
 * POST：创建答题会话；从启用题目中 Fisher–Yates 打乱后取前 N 题（N=`QUIZ_SESSION_DRAW_COUNT`）写入 questionOrder。
 */
export async function POST(request: Request) {
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

    const enabled = await prisma.question.findMany({
      where: { enabled: true },
      select: { id: true },
    });
    if (enabled.length === 0) {
      return NextResponse.json({ error: "暂无启用题目，请先在后台添加题库" }, { status: 400 });
    }

    const phoneNorm = parsed.data.phone.trim();

    /** 已答完但未写 finishedAt 的场次，先收口，避免同号重复开新场 */
    const orphans = await prisma.quizSession.findMany({
      where: { phone: phoneNorm, finishedAt: null },
    });
    for (const s of orphans) {
      const order = parseQuestionOrder(s.questionOrder);
      if (order.length === 0) continue;
      const answered = await prisma.quizAnswer.count({ where: { sessionId: s.id } });
      if (answered >= order.length) {
        await prisma.quizSession.update({
          where: { id: s.id },
          data: { finishedAt: new Date() },
        });
      }
    }

    const alreadyDone = await prisma.quizSession.findFirst({
      where: { phone: phoneNorm, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
    });
    if (alreadyDone) {
      return NextResponse.json(
        {
          error:
            "该手机号已完成答题，无法重复参与。如需帮助请联系管理员。",
          code: PHONE_ALREADY_FINISHED_CODE,
        },
        { status: 400 }
      );
    }

    const inProgress = await prisma.quizSession.findFirst({
      where: { phone: phoneNorm, finishedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (inProgress) {
      const order = parseQuestionOrder(inProgress.questionOrder);
      const answered = await prisma.quizAnswer.count({
        where: { sessionId: inProgress.id },
      });
      if (order.length > 0 && answered < order.length) {
        return NextResponse.json(
          {
            error: "该手机号有一场答题尚未完成，请继续上一场，不能重新开始。",
            code: SESSION_IN_PROGRESS_CODE,
            sessionId: inProgress.id,
          },
          { status: 409 }
        );
      }
    }

    const shuffled = shuffleQuestionIds(enabled.map((q) => q.id));
    const take = Math.min(QUIZ_SESSION_DRAW_COUNT, shuffled.length);
    const ids = shuffled.slice(0, take);

    const session = await prisma.quizSession.create({
      data: {
        nickname: parsed.data.nickname.trim(),
        phone: phoneNorm,
        /** 前台不再区分链接/二维码，统一记为 link，便于后台统计字段非空 */
        sourceChannel: SourceChannel.link,
        questionOrder: ids,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "开始失败" }, { status: 500 });
  }
}
