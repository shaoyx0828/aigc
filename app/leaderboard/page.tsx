import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const c = await cookies();
  const ok = await verifyAdminSession(c.get(ADMIN_COOKIE_NAME)?.value, process.env.ADMIN_SESSION_SECRET);
  if (!ok) notFound();
  // 排行榜统计仅管理员后台导出（普通用户不可见）
  notFound();
}
