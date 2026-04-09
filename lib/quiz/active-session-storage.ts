/**
 * 浏览器本地记住「进行中的答题 sessionId」，便于断网/关页后从「开始答题」页一键继续。
 * 完成本场或会话失效时清除。
 */
const STORAGE_KEY = "digital-human-quiz:activeSessionId";

export function persistActiveQuizSession(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, sessionId);
  } catch {
    /* 隐私模式 / 配额 */
  }
}

export function readPersistedQuizSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearPersistedQuizSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}
