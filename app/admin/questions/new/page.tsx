import Link from "next/link";
import { QuestionForm } from "@/components/admin/QuestionForm";

export default function NewQuestionPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">新增题目</h1>
        <Link href="/admin/questions" className="text-sm text-brand-600 hover:underline">
          返回列表
        </Link>
      </div>
      <QuestionForm />
    </div>
  );
}
