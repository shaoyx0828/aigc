/**
 * 从中文语音识别结果中尽量解析出单选题选项 A–D（宽松匹配，适应「选 b」「我选 a」等）。
 */

const FULLWIDTH_MAP: Record<string, string> = {
  Ａ: "A",
  Ｂ: "B",
  Ｃ: "C",
  Ｄ: "D",
  ａ: "a",
  ｂ: "b",
  ｃ: "c",
  ｄ: "d",
};

const ZH_ORDINAL: Record<string, "A" | "B" | "C" | "D"> = {
  一: "A",
  二: "B",
  三: "C",
  四: "D",
  "1": "A",
  "2": "B",
  "3": "C",
  "4": "D",
};

function normalizeFullwidthAndCase(s: string): string {
  let t = s;
  for (const [fw, hw] of Object.entries(FULLWIDTH_MAP)) {
    t = t.split(fw).join(hw);
  }
  return t;
}

/**
 * 若整句能解析出唯一选项字母则返回 A/B/C/D，否则 null。
 */
export function extractSingleChoiceLetter(raw: string): string | null {
  const s0 = normalizeFullwidthAndCase(raw).trim();
  if (!s0) return null;

  const lower = s0.toLowerCase();

  // 单独字母（允许前后标点）
  const lone = lower.replace(/[\s.。，,、；;：:！!？?'"「」]/g, "");
  if (/^[abcd]$/i.test(lone)) return lone[0]!.toUpperCase();

  // 常见口语：选a / 答案b / 选项c / 我选的是d
  const explicit = lower.match(
    /(?:选个|选的是|选的是选项|我选|答案|选项|选择|应该选|就是|选)\s*([abcd])/i
  );
  if (explicit?.[1]) return explicit[1].toUpperCase();

  const bare = lower.match(/(?:^|[\s，,。.])([abcd])(?:$|[\s，,。.！!？?])/i);
  if (bare?.[1]) return bare[1].toUpperCase();

  // 第 一/二/三/四（个） / 第 1–4
  const ord = lower.match(/第\s*([一二三四1-4])\s*(?:个|项|个选项|选项|题)?/);
  if (ord?.[1] && ZH_ORDINAL[ord[1]]) return ZH_ORDINAL[ord[1]]!;

  // 甲/乙/丙/丁
  const jia = lower.match(/[甲乙丙丁]/);
  if (jia) {
    const m: Record<string, "A" | "B" | "C" | "D"> = {
      甲: "A",
      乙: "B",
      丙: "C",
      丁: "D",
    };
    return m[jia[0]!] ?? null;
  }

  // 句中所有拉丁 a–d，取最后一次（适应「不是 a 是 b」）
  const letters = [...lower.matchAll(/([abcd])/gi)].map((m) => m[1]!.toUpperCase());
  if (letters.length >= 1) return letters[letters.length - 1]!;

  return null;
}
