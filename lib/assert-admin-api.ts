import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-session";

/** 管理类 API：未登录返回 401 JSON */
export async function assertAdminOr401(): Promise<NextResponse | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE_NAME)?.value;
  const ok = await verifyAdminSession(token, secret);
  if (!ok) {
    return NextResponse.json({ error: "未授权，请先登录管理后台" }, { status: 401 });
  }
  return null;
}
