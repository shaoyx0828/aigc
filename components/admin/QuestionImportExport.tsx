"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";

/**
 * 题库模板下载、Excel 导入、全量导出。
 */
export function QuestionImportExport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onImport(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/questions/import", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        const rows = data.rowErrors?.map((r: { row: number; message: string }) => `行${r.row}: ${r.message}`).join("\n");
        setMsg(`${data.error ?? "导入失败"}${rows ? `\n${rows}` : ""}`);
        return;
      }
      setMsg(`成功导入 ${data.created} 条${data.rowErrors?.length ? `，${data.rowErrors.length} 行失败` : ""}`);
      router.refresh();
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <CardTitle>导入 / 导出</CardTitle>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/api/questions/template"
          prefetch={false}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          下载导入模板
        </Link>
        <Link
          href="/api/questions/export"
          prefetch={false}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          导出题库 xlsx
        </Link>
      </div>
      <div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={busy}
          onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-600"
        />
        <p className="mt-1 text-xs text-slate-500">
          上传 Excel，表头需与模板一致；失败时会返回行级错误原因。
        </p>
      </div>
      {msg ? (
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          {msg}
        </pre>
      ) : null}
    </Card>
  );
}
