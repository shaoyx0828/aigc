import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { QuestionForm } from "@/components/admin/QuestionForm";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">编辑题目</h1>
        <Link href="/admin/questions" className="text-sm text-brand-600 hover:underline">
          返回列表
        </Link>
      </div>
      <QuestionForm initial={q} />
    </div>
  );
}
