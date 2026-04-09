import { normalizeAnswerText } from "./normalization";

/** 简答题判定档位，后续可映射到大模型返回的离散标签 */
export type ShortAnswerVerdict = "full" | "partial" | "incorrect";

export interface ShortAnswerJudgeResult {
  verdict: ShortAnswerVerdict;
  /** 0~1，用于按分值比例给分 */
  ratio: number;
  /** 命中关键词（演示用） */
  matchedKeywords: string[];
}

/**
 * 简答题判分接口：当前为关键词命中实现，可整体替换为 LLM 调用。
 */
export interface ShortAnswerJudge {
  judge(input: {
    userText: string;
    canonicalAnswer: string;
    keywordsCsv: string;
    maxScore: number;
  }): ShortAnswerJudgeResult;
}

function splitKeywords(csv: string): string[] {
  return csv
    .split(/[,，;；\n]/g)
    .map((s) => normalizeAnswerText(s))
    .filter(Boolean);
}

/**
 * 默认实现：关键词命中 + 与标准答案子串弱匹配。
 * - 命中比例高或包含标准答案关键片段 → full
 * - 部分命中 → partial
 * - 否则 incorrect
 */
export class KeywordShortAnswerJudge implements ShortAnswerJudge {
  judge(input: {
    userText: string;
    canonicalAnswer: string;
    keywordsCsv: string;
    maxScore: number;
  }): ShortAnswerJudgeResult {
    const user = normalizeAnswerText(input.userText);
    if (!user) {
      return { verdict: "incorrect", ratio: 0, matchedKeywords: [] };
    }

    const keys = splitKeywords(input.keywordsCsv);
    const matched = keys.filter((k) => k.length > 0 && user.includes(k));
    const hitRatio = keys.length > 0 ? matched.length / keys.length : 0;

    const canon = normalizeAnswerText(input.canonicalAnswer);
    const canonChunks = canon
      .split(/[，,；;。.\s]+/g)
      .map((c) => c.trim())
      .filter((c) => c.length >= 2);
    const chunkHits = canonChunks.filter((c) => user.includes(c)).length;
    const chunkRatio =
      canonChunks.length > 0 ? chunkHits / canonChunks.length : 0;

    let verdict: ShortAnswerVerdict = "incorrect";
    let ratio = 0;

    if (hitRatio >= 0.6 || chunkRatio >= 0.5 || (keys.length === 0 && chunkRatio >= 0.33)) {
      verdict = "full";
      ratio = 1;
    } else if (hitRatio >= 0.25 || chunkRatio >= 0.2 || matched.length > 0) {
      verdict = "partial";
      ratio = Math.min(0.9, 0.4 + hitRatio * 0.5 + chunkRatio * 0.3);
    } else {
      verdict = "incorrect";
      ratio = 0;
    }

    return { verdict, ratio, matchedKeywords: matched };
  }
}

export const defaultShortAnswerJudge: ShortAnswerJudge = new KeywordShortAnswerJudge();
