import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 类名合并 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 安全解析 JSON 数组（题目顺序） */
export function parseQuestionOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** 格式化正确率百分比 */
export function formatAccuracy(correct: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((correct / total) * 1000) / 10}%`;
}
