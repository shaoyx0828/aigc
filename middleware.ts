import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  const ok = await verifyAdminSession(
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
    process.env.ADMIN_SESSION_SECRET
  );
  if (!ok) {
    const u = new URL("/admin/login", request.url);
    u.searchParams.set("from", pathname);
    return NextResponse.redirect(u);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
