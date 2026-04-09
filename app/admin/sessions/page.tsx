import Link from "next/link";
import { SourceChannel } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { SessionsFilter } from "./sessions-filter";

const channelLabel: Record<SourceChannel, string> = {
  link: "链接",
  qrcode: "二维码",
  other: "其他",
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nickname = typeof sp.nickname === "string" ? sp.nickname.trim() : "";
  const sourceChannel =
    typeof sp.sourceChannel === "string" ? sp.sourceChannel : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const where: Prisma.QuizSessionWhereInput = {};
  if (nickname) where.nickname = { contains: nickname };
  if (sourceChannel && Object.values(SourceChannel).includes(sourceChannel as SourceChannel)) {
    where.sourceChannel = sourceChannel as SourceChannel;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">答题会话</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          后台首页
        </Link>
      </div>

      <Card className="space-y-3">
        <CardTitle>筛选</CardTitle>
        <SessionsFilter initial={{ nickname, sourceChannel, from, to }} />
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>姓名</Th>
            <Th>手机号</Th>
            <Th>渠道</Th>
            <Th>分数</Th>
            <Th>正确/错误</Th>
            <Th>用时</Th>
            <Th>完成时间</Th>
            <Th>操作</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.length === 0 ? (
            <tr>
              <Td colSpan={8} className="py-8 text-center text-slate-500">
                暂无记录
              </Td>
            </tr>
          ) : (
            items.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.nickname}</Td>
                <Td className="tabular-nums text-slate-700">{s.phone}</Td>
                <Td>{channelLabel[s.sourceChannel]}</Td>
                <Td>{s.totalScore}</Td>
                <Td>
                  {s.correctCount}/{s.wrongCount}
                </Td>
                <Td>{s.totalDurationSec}s</Td>
                <Td className="whitespace-nowrap text-xs text-slate-500">
                  {s.finishedAt ? s.finishedAt.toLocaleString("zh-CN") : "进行中"}
                </Td>
                <Td>
                  <Link
                    href={`/admin/sessions/${s.id}`}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    详情
                  </Link>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
