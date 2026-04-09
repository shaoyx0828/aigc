"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteQuestionButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("确定删除该题目？若已有答题记录引用可能删除失败。")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "删除失败");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" className="text-red-600" disabled={busy} onClick={onDelete}>
      删除
    </Button>
  );
}
