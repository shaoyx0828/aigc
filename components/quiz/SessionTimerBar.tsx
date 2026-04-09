"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { QUIZ_SESSION_DURATION_SEC } from "@/lib/quiz/quiz-session-time";

function formatRemaining(sec: number) {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m} 分 ${s.toString().padStart(2, "0")} 秒`;
}

type Props = {
  /** 服务端计算的剩余秒数，fetch 后传入以校正本地钟差 */
  initialRemainingSec: number;
  /** 变更时把本地剩余时间重置为该值 */
  syncKey: string;
  onExpire: () => void;
  disabled?: boolean;
};

/**
 * 整场答题倒计时（默认 1 小时），用于替换「每题限时」。
 */
export function SessionTimerBar({
  initialRemainingSec,
  syncKey,
  onExpire,
  disabled,
}: Props) {
  const [left, setLeft] = useState(initialRemainingSec);
  const expireRef = useRef(onExpire);
  const expiredOnceRef = useRef(false);
  expireRef.current = onExpire;

  useEffect(() => {
    setLeft(initialRemainingSec);
    expiredOnceRef.current = false;
  }, [syncKey, initialRemainingSec]);

  useEffect(() => {
    if (disabled || initialRemainingSec <= 0) return;
    const id = window.setInterval(() => {
      setLeft((t) => (t <= 0 ? 0 : t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [syncKey, initialRemainingSec, disabled]);

  useEffect(() => {
    if (disabled || expiredOnceRef.current) return;
    if (left > 0) return;
    expiredOnceRef.current = true;
    const t = window.setTimeout(() => expireRef.current(), 0);
    return () => window.clearTimeout(t);
  }, [left, disabled]);

  const ratio =
    QUIZ_SESSION_DURATION_SEC > 0
      ? Math.max(0, Math.min(1, left / QUIZ_SESSION_DURATION_SEC))
      : 0;
  const urgent = ratio < 0.08 && left > 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>本场剩余</span>
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
