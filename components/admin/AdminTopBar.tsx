"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (pathname === "/admin/login") return null;

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 text-sm">
      <div className="flex flex-wrap gap-3 text-slate-600">
        <Link href="/admin" className="hover:text-brand-600">
          后台首页
        </Link>
        <a
          href="/api/admin/leaderboard-export"
          className="hover:text-brand-600"
          download
        >
          导出排行榜 (Excel)
        </a>
        <Link href="/" className="hover:text-brand-600">
          前台首页
        </Link>
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={logout}>
        退出登录
      </Button>
    </div>
  );
}
