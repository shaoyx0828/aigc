import Link from "next/link";
import { QuestionType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Th, Td } from "@/components/ui/table";
import { QuestionImportExport } from "@/components/admin/QuestionImportExport";
import { DeleteQuestionButton } from "@/components/admin/DeleteQuestionButton";
import { QuestionsFilter } from "./questions-filter";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === "string" ? sp.search.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const enabled = typeof sp.enabled === "string" ? sp.enabled : "";

  const where: Prisma.QuestionWhereInput = {};
  if (search) {
    where.OR = [
      { question: { contains: search } },
      { category: { contains: search } },
    ];
  }
  if (category) where.category = category;
  if (type && Object.values(QuestionType).includes(type as QuestionType)) {
    where.type = type as QuestionType;
  }
  if (enabled === "true") where.enabled = true;
  if (enabled === "false") where.enabled = false;

  const [items, categories] = await Promise.all([
    prisma.question.findMany({ where, orderBy: { updatedAt: "desc" } }),
    prisma.question.findMany({ select: { category: true }, distinct: ["category"] }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">题库管理</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              后台首页
            </Button>
          </Link>
          <Link href="/admin/questions/new">
            <Button size="sm">新增题目</Button>
          </Link>
        </div>
      </div>

      <QuestionImportExport />

      <Card className="space-y-3">
        <CardTitle>筛选</CardTitle>
        <QuestionsFilter
          categories={categories.map((c) => c.category)}
          initial={{ search, category, type, enabled }}
        />
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>题干</Th>
            <Th>分类</Th>
            <Th>题型</Th>
            <Th>启用</Th>
            <Th>分值</Th>
            <Th>操作</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.length === 0 ? (
            <tr>
              <Td colSpan={6} className="py-8 text-center text-slate-500">
                暂无题目
              </Td>
            </tr>
          ) : (
            items.map((q) => (
              <tr key={q.id}>
                <Td className="max-w-[220px] text-xs">{q.question}</Td>
                <Td>{q.category}</Td>
                <Td>
                  <Badge>{q.type}</Badge>
                </Td>
                <Td>{q.enabled ? "是" : "否"}</Td>
                <Td>{q.score}</Td>
                <Td className="space-x-2 whitespace-nowrap">
                  <Link
                    href={`/admin/questions/${q.id}/edit`}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    编辑
                  </Link>
                  <DeleteQuestionButton id={q.id} />
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
