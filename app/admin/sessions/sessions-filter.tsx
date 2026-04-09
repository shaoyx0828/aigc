"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function SessionsFilter({
  initial,
}: {
  initial: { nickname: string; sourceChannel: string; from: string; to: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [nickname, setNickname] = useState(initial.nickname);
  const [sourceChannel, setSourceChannel] = useState(initial.sourceChannel);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const apply = useCallback(() => {
    const p = new URLSearchParams(sp.toString());
    if (nickname) p.set("nickname", nickname);
    else p.delete("nickname");
    if (sourceChannel) p.set("sourceChannel", sourceChannel);
    else p.delete("sourceChannel");
    if (from) p.set("from", from);
    else p.delete("from");
    if (to) p.set("to", to);
    else p.delete("to");
    startTransition(() => {
      router.push(`/admin/sessions?${p.toString()}`);
    });
  }, [nickname, sourceChannel, from, to, router, sp]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="min-w-[140px] flex-1">
        <Label>昵称</Label>
        <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
      </div>
      <div className="min-w-[120px]">
        <Label>渠道</Label>
        <Select value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)}>
          <option value="">全部</option>
          <option value="link">链接</option>
          <option value="qrcode">二维码</option>
          <option value="other">其他</option>
        </Select>
      </div>
      <div className="min-w-[160px]">
        <Label>开始时间 ≥</Label>
        <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="min-w-[160px]">
        <Label>开始时间 ≤</Label>
        <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="button" onClick={apply} disabled={pending}>
        应用
      </Button>
    </div>
  );
}
