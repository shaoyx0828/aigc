"use client";

import { useEffect } from "react";
import { clearPersistedQuizSession } from "@/lib/quiz/active-session-storage";

/** 进入结果页后丢弃本地「进行中」标记，避免开始页误提示继续上一场 */
export function ClearStoredQuizSession() {
  useEffect(() => {
    clearPersistedQuizSession();
  }, []);
  return null;
}
