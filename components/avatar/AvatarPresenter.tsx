"use client";

import { cn } from "@/lib/utils";
import type { AvatarState } from "@/lib/providers/avatar/interface";

export interface AvatarPresenterProps {
  state: AvatarState;
  /** 辅助文案，例如题干摘要 */
  text?: string;
}

/**
 * 占位数字人：几何风格 + 三态动画，后续可替换为 Live2D/视频层而不改 props。
 */
export function AvatarPresenter({ state, text }: AvatarPresenterProps) {
  const statusLabel =
    state === "speaking"
      ? "正在播报题目"
      : state === "listening"
        ? "正在聆听回答"
        : state === "correct"
          ? "答对了"
          : state === "wrong"
            ? "答错了"
        : "待机中";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-indigo-100 shadow-inner ring-1 ring-white/60",
          state === "idle" && "animate-float-slow"
        )}
      >
        {/* 身体占位 */}
        <div className="absolute bottom-4 h-14 w-24 rounded-2xl bg-brand-500/90 shadow-md" />
        {/* 头部 */}
        <div
          className={cn(
            "relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-brand-200/80",
            state === "speaking" && "ring-brand-500"
          )}
        >
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-800" />
            <span className="h-2 w-2 rounded-full bg-slate-800" />
          </div>
          {/* 嘴部：speaking 波纹 */}
          {state === "speaking" && (
            <div className="absolute -bottom-1 flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-1 w-1 animate-pulse rounded-full bg-brand-600"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}
        </div>
        {/* listening 环形光效 */}
        {state === "listening" && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400/60 animate-pulse-ring" />
            <span className="absolute -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            </span>
          </>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{statusLabel}</p>
        {text ? (
          <p className="mt-1 line-clamp-2 max-w-xs text-sm text-slate-600">{text}</p>
        ) : null}
      </div>
    </div>
  );
}
