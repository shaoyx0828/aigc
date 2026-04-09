/**
 * 为中文 TTS 挑选偏「活泼 / 年轻 / 童话主持」的音色（启发式，随系统语音包变化）。
 */
export function pickPlayfulZhVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const zh = voices.filter((v) => {
    const l = (v.lang || "").toLowerCase();
    return l.startsWith("zh") || l.includes("cmn");
  });
  if (zh.length === 0) return null;

  const score = (v: SpeechSynthesisVoice) => {
    const n = `${v.name} ${v.voiceURI}`.toLowerCase();
    let s = 0;
    if (
      /儿童|童声|kid|child|baby|幼儿|萌|乖|童话|story|cartoon/i.test(n)
    ) {
      s += 10;
    }
    if (
      /xiaoyi|xiaoxiao|xiaoshuang|yaoyao|yunxi|yunxia|云希|云夏|晓伊|晓晓|晓双|mei-jia|meijia|ting-ting|huihui/i.test(
        n
      )
    ) {
      s += 6;
    }
    if (/female|女|girl|young|neural|premium|natural|xiaom/i.test(n)) {
      s += 3;
    }
    if (/microsoft|google|apple/.test(n)) s += 1;
    return s;
  };

  return zh.reduce((best, v) => (score(v) > score(best) ? v : best), zh[0]!);
}

/**
 * 偏「小男孩 / 少年男声」：优先云希类年轻男声，降低女声权重（系统语音名因平台而异）。
 */
export function pickBoyChildZhVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const zh = voices.filter((v) => {
    const l = (v.lang || "").toLowerCase();
    return l.startsWith("zh") || l.includes("cmn");
  });
  if (zh.length === 0) return null;

  const score = (v: SpeechSynthesisVoice) => {
    const n = `${v.name} ${v.voiceURI}`.toLowerCase();
    let s = 0;
    // 微软 / 常见：云希 = 年轻男声；健哥部分环境为男声
    if (/yunxi|云希|kangkang|康康|yunjian|云健|yunyang|云扬/i.test(n)) {
      s += 14;
    }
    if (/male|boy|男童|男孩|男声|少年|青年男|男生/i.test(n)) {
      s += 10;
    }
    if (/儿童|kid|child|幼儿|童话|cartoon/i.test(n)) {
      s += 6;
    }
    // 明显女声向：压低权重
    if (
      /xiaoxiao|xiaoyi|xiaomo|xiaoshuang|yaoyao|huihui|ting-ting|meijia|晓晓|晓伊|晓双|女|female|girl|mei-jia/i.test(
        n
      )
    ) {
      s -= 12;
    }
    if (/neural|premium|microsoft|google|apple|natural/i.test(n)) {
      s += 2;
    }
    return s;
  };

  return zh.reduce((best, v) => (score(v) > score(best) ? v : best), zh[0]!);
}
