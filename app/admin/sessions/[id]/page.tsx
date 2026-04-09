import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerMethod, SourceChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";

const channelLabel: Record<SourceChannel, string> = {
  link: "链接",
  qrcode: "二维码",
  other: "其他",
};

const methodLabel: Record<AnswerMethod, string> = {
  text: "文本",
  voice: "语音",
};

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.quizSession.findUnique({
    where: { id },
    include: {
      answers: {
        include: { question: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">会话详情</h1>
        <Link href="/admin/sessions" className="text-sm text-brand-600 hover:underline">
          返回列表
        </Link>
      </div>

      <Card className="space-y-2 text-sm">
        <CardTitle>概要</CardTitle>
        <p>
          姓名：<span className="font-medium">{session.nickname}</span>
        </p>
        <p>
          手机号：<span className="font-medium tabular-nums">{session.phone}</span>
        </p>
        <p>渠道：{channelLabel[session.sourceChannel]}</p>
        <p>总分：{session.totalScore}</p>
        <p>
          正确/错误：{session.correctCount}/{session.wrongCount}
        </p>
        <p>用时：{session.totalDurationSec}s</p>
        <p>开始：{session.startedAt.toLocaleString("zh-CN")}</p>
        <p>结束：{session.finishedAt?.toLocaleString("zh-CN") ?? "进行中"}</p>
      </Card>

      <Card className="space-y-3">
        <CardTitle>每题记录</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>题目</Th>
              <Th>用户答案</Th>
              <Th>标准答案</Th>
              <Th>得分</Th>
              <Th>正确</Th>
              <Th>方式</Th>
              <Th>耗时</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {session.answers.map((a, i) => (
              <tr key={a.id}>
                <Td>{i + 1}</Td>
                <Td className="max-w-[200px] text-xs">{a.question.question}</Td>
                <Td className="max-w-[120px] text-xs">{a.userAnswerText || "—"}</Td>
                <Td className="max-w-[120px] text-xs">{a.question.canonicalAnswer}</Td>
                <Td>{a.scoreAwarded}</Td>
                <Td>{a.isCorrect ? "是" : "否"}</Td>
                <Td>{methodLabel[a.answerMethod]}</Td>
                <Td>{a.durationSec}s</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
