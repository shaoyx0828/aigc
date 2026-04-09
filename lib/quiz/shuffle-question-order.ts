import { randomInt } from "node:crypto";

/**
 * Fisher–Yates 打乱题目 id 列表（每场答题开始时的顺序）。
 * 使用 `crypto.randomInt`，避免部分运行环境对 `Math.random` 的固定化/可预测行为。
 */
export function shuffleQuestionIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
