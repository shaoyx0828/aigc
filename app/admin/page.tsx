import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardTitle } from "@/components/ui/card";

export default async function AdminHomePage() {
  const [totalQ, enabledQ, sessions, finishedSessions] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({ where: { enabled: true } }),
    prisma.quizSession.count(),
    prisma.quizSession.findMany({
      where: { finishedAt: { not: null } },
      select: { totalScore: true },
    }),
  ]);

  const avgScore =
    finishedSessions.length > 0
      ? Math.round(
          finishedSessions.reduce((s, x) => s + x.totalScore, 0) / finishedSessions.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">管理后台</h1>
        <p className="text-sm text-slate-500">
          超级管理员：题库、会话与排行榜导出；大众答题截止后前台不可再答，仍可在本后台导出得分。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>题库总数</CardTitle>
          <p className="mt-2 text-3xl font-bold text-slate-900">{totalQ}</p>
        </Card>
        <Card>
          <CardTitle>启用题目</CardTitle>
          <p className="mt-2 text-3xl font-bold text-brand-600">{enabledQ}</p>
        </Card>
        <Card>
          <CardTitle>答题场次</CardTitle>
          <p className="mt-2 text-3xl font-bold text-slate-900">{sessions}</p>
        </Card>
        <Card>
          <CardTitle>已完成场均分</CardTitle>
          <p className="mt-2 text-3xl font-bold text-slate-900">{avgScore}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/questions">
          <span className="text-brand-600 hover:underline">题库管理 →</span>
        </Link>
        <Link href="/admin/sessions">
          <span className="text-brand-600 hover:underline">会话记录 →</span>
        </Link>
      </div>
    </div>
  );
}
