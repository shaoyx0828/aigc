import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin-session";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
    }
    const envUser = process.env.ADMIN_USERNAME?.trim();
    const envPass = process.env.ADMIN_PASSWORD;
    const secret = process.env.ADMIN_SESSION_SECRET;

    if (!envUser || !envPass || !secret || secret.length < 16) {
      console.error(
        "[admin/login] 请配置环境变量 ADMIN_USERNAME、ADMIN_PASSWORD、ADMIN_SESSION_SECRET（≥16 字符）"
      );
      return NextResponse.json({ error: "服务端未配置管理员账号" }, { status: 503 });
    }

    const userOk = parsed.data.username.trim() === envUser;
    const passOk = await verifyAdminPassword(parsed.data.password, envPass);
    if (!userOk || !passOk) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    const token = await createAdminSessionToken(secret);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
