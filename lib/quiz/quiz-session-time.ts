/** 整场答题总时长（从「开始答题」起算） */
export const QUIZ_SESSION_DURATION_SEC = 30 * 60;
export const QUIZ_SESSION_DURATION_MS = QUIZ_SESSION_DURATION_SEC * 1000;

export function getSessionDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + QUIZ_SESSION_DURATION_MS);
}

export function getRemainingSessionSec(
  startedAt: Date,
  nowMs: number = Date.now()
): number {
  const deadline = startedAt.getTime() + QUIZ_SESSION_DURATION_MS;
  return Math.max(0, Math.floor((deadline - nowMs) / 1000));
}

export function isSessionOverdue(startedAt: Date, nowMs: number = Date.now()): boolean {
  return nowMs > startedAt.getTime() + QUIZ_SESSION_DURATION_MS;
}
