"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function formatRemaining(sec: number) {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} 分 ${s.toString().padStart(2, "0")} 秒`;
}

/**
 * 倒计时进度条：剩余时间可视化。
 */
export function TimerBar({
  totalSec,
  onExpire,
  resetKey,
}: {
  totalSec: number;
  onExpire: () => void;
  /** 换题时变更以重置计时 */
  resetKey: string;
}) {
  const [left, setLeft] = useState(totalSec);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const expiredOnceRef = useRef(false);

  useEffect(() => {
    setLeft(totalSec);
    expiredOnceRef.current = false;
  }, [resetKey, totalSec]);

  useEffect(() => {
    if (totalSec <= 0) return;
    const id = setInterval(() => {
      setLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resetKey, totalSec]);

  // 过期回调必须在 effect 中触发，避免在 TimerBar 渲染/状态更新过程中
  // 直接触发父组件 setState 导致 React 警告。
  useEffect(() => {
    if (expiredOnceRef.current) return;
    if (totalSec <= 0) return;
    if (left > 0) return;
    expiredOnceRef.current = true;
    // 异步调度到下一轮事件循环，进一步避免“render phase update”
    const t = window.setTimeout(() => expireRef.current(), 0);
    return () => window.clearTimeout(t);
  }, [left, totalSec]);

  const ratio = totalSec > 0 ? Math.max(0, left / totalSec) : 0;
  const urgent = ratio < 0.2;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>本题剩余</span>
        <span className={cn(urgent && "font-semibold text-red-600")}>
          {formatRemaining(left)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            urgent ? "bg-red-500" : "bg-brand-500"
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
