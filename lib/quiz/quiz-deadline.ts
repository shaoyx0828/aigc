/**
 * 大众答题截止时间（东八区）。此后不可新开/继续答题；管理后台与导出不受影响。
 */
export const QUIZ_DEADLINE_LABEL = "2026 年 4 月 18 日 23：59：59";

/**
 * 东八区 2026-04-18 23:59:59.999 的瞬时，用 UTC 显式构造，避免运行环境对 ISO 字符串解析不一致。
 * （等价于 UTC 2026-04-18 15:59:59.999）
 */
export const QUIZ_CLOSE_INSTANT_MS = Date.UTC(2026, 3, 18, 15, 59, 59, 999);

export const QUIZ_CLOSED_ERROR_CODE = "QUIZ_CLOSED" as const;

export function isQuizOpenForPlayers(nowMs = Date.now()): boolean {
  return nowMs <= QUIZ_CLOSE_INSTANT_MS;
}

/** 面向普通参与者的说明文案 */
export const QUIZ_CLOSED_USER_MESSAGE = `答题已于 ${QUIZ_DEADLINE_LABEL} 截止，系统已关闭答题。得分情况请由管理员在后台导出。`;
