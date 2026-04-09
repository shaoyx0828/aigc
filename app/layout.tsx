import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "中天火箭在线答题",
  description: "中天火箭在线答题演示系统（网页 H5 + 3D 数字人 + 题库与统计）",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="touch-manipulation antialiased">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
          <div className="mx-auto flex w-full max-w-[min(100%,100rem)] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
            <Link
              href="/"
              className="inline-flex min-h-11 max-w-[min(100%,18rem)] items-center text-sm font-semibold leading-snug text-slate-900 sm:min-h-0 sm:max-w-none sm:text-base"
            >
              中天火箭在线答题
            </Link>
            <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-600 sm:gap-x-4 sm:text-sm">
              <Link
                href="/quiz/start"
                className="rounded-md px-2.5 py-2 hover:bg-slate-50 hover:text-brand-600 active:bg-slate-100 sm:px-1 sm:py-1 sm:hover:bg-transparent"
              >
                开始答题
              </Link>
              <Link
                href="/admin/login"
                className="rounded-md px-2.5 py-2 hover:bg-slate-50 hover:text-brand-600 active:bg-slate-100 sm:px-1 sm:py-1 sm:hover:bg-transparent"
              >
                管理登录
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-[min(100%,100rem)] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:min-h-[calc(100dvh-4rem)] sm:px-4 sm:py-6 md:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
