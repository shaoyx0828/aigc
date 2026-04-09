"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function QuestionsFilter({
  categories,
  initial,
}: {
  categories: string[];
  initial: { search: string; category: string; type: string; enabled: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initial.search);
  const [category, setCategory] = useState(initial.category);
  const [type, setType] = useState(initial.type);
  const [enabled, setEnabled] = useState(initial.enabled);

  const apply = useCallback(() => {
    const p = new URLSearchParams(sp.toString());
    if (search) p.set("search", search);
    else p.delete("search");
    if (category) p.set("category", category);
    else p.delete("category");
    if (type) p.set("type", type);
    else p.delete("type");
    if (enabled) p.set("enabled", enabled);
    else p.delete("enabled");
    startTransition(() => {
      router.push(`/admin/questions?${p.toString()}`);
    });
  }, [search, category, type, enabled, router, sp]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[140px] flex-1">
        <Label>搜索</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="题干/分类" />
      </div>
      <div className="min-w-[120px]">
        <Label>分类</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">全部</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-[120px]">
        <Label>题型</Label>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">全部</option>
          <option value="single_choice">single_choice</option>
          <option value="true_false">true_false</option>
          <option value="short_answer">short_answer</option>
        </Select>
      </div>
      <div className="min-w-[120px]">
        <Label>启用</Label>
        <Select value={enabled} onChange={(e) => setEnabled(e.target.value)}>
          <option value="">全部</option>
          <option value="true">启用</option>
          <option value="false">停用</option>
        </Select>
      </div>
      <Button type="button" onClick={apply} disabled={pending}>
        应用
      </Button>
    </div>
  );
}
