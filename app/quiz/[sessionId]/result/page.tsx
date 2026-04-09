import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ClearStoredQuizSession } from "@/components/quiz/ClearStoredQuizSession";
import { ResultPageAvatar } from "@/components/quiz/ResultPageAvatar";
import {
  isQuizOpenForPlayers,
  QUIZ_CLOSED_USER_MESSAGE,
} from "@/lib/quiz/quiz-deadline";
import { maskPhoneForDisplay } from "@/lib/quiz/quiz-phone";

export const dynamic = "force-dynamic";

export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return (
      <>
        <ClearStoredQuizSession />
        <p className="text-center text-slate-600">
          未找到会话。
          <Link href="/" className="ml-2 text-brand-600 underline">
            回首页
          </Link>
        </p>
      </>
    );
  }

  if (!session.finishedAt) {
    if (!isQuizOpenForPlayers()) {
      return (
        <>
          <ClearStoredQuizSession />
          <p className="mx-auto max-w-md text-center text-sm leading-relaxed text-slate-700">
            {QUIZ_CLOSED_USER_MESSAGE}
            <span className="mt-2 block text-slate-600">本场未完成的进度已无法继续。</span>
            <Link href="/" className="mt-3 inline-block text-brand-600 underline">
              返回首页
            </Link>
          </p>
        </>
      );
    }
    return (
      <p className="text-center text-slate-600">
        本场答题尚未完成。
        <Link href={`/quiz/${sessionId}`} className="ml-2 text-brand-600 underline">
          继续答题
        </Link>
      </p>
    );
  }

  // 普通用户不展示排名/得分/对错统计
  const showResultLowFace = false;

  return (
    <div className="relative space-y-6 pb-36 sm:pb-32">
      <ResultPageAvatar showDisappointed={showResultLowFace} />
      <ClearStoredQuizSession />
      <Card className="space-y-2">
        <CardTitle>答题完成</CardTitle>
        <p className="text-sm text-slate-600">
          姓名：{session.nickname}
          <span className="ml-2 tabular-nums text-slate-500">
            手机（脱敏）：{maskPhoneForDisplay(session.phone)}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          感谢你的参与。本次答题结果与统计将由管理员后台统一导出。
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/">
          <Button variant="secondary">返回首页</Button>
        </Link>
      </div>
    </div>
  );
}
