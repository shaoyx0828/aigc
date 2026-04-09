/**
 * 答题文本归一化：用于客观题比对与简答题关键词匹配前的预处理。
 * 后续若接入 ASR，可在此统一处理标点、全半角等。
 */

import { extractSingleChoiceLetter } from "@/lib/quiz/speech-choice";

/** 去除首尾空白并转小写（英文）；中文保持不变但去多余空格 */
export function normalizeAnswerText(input: string): string {
  let s = input.trim();
  s = s.replace(/\s+/g, " ");
  return s.toLowerCase();
}

/** 单选/判断：将用户输入映射到可比较 token（选项统一为大写 A-D） */
export function normalizeChoiceToken(input: string): string {
  const n = normalizeAnswerText(input);
  const tfMap: Record<string, string> = {
    "正确": "true",
    "错误": "false",
    "对": "true",
    "错": "false",
    "是": "true",
    "否": "false",
    "true": "true",
    "false": "false",
  };
  if (tfMap[n] !== undefined) return tfMap[n];

  const fromSpeech = extractSingleChoiceLetter(input);
  if (fromSpeech) return fromSpeech;

  const compact = n.replace(/\s+/g, "");
  if (/^[abcd]$/i.test(compact)) return compact.toUpperCase();
  return n.toUpperCase();
}

/** 比较客观题是否一致（支持 True/False 与 A-D） */
export function choicesMatch(expected: string, user: string): boolean {
  const e = normalizeChoiceToken(expected);
  const u = normalizeChoiceToken(user);
  if (e === "true" || e === "false") {
    return e === u;
  }
  return e === u && ["A", "B", "C", "D"].includes(e);
}
