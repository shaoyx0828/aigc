import type { TTSVoiceStyle } from "@/src/config/tts";
import { DEFAULT_TTS_VOICE_STYLE } from "@/src/config/tts";

/** 浏览器兜底时：男孩相关 style 在 UI 中应表述为「参数预设」而非独立音色 */
export const BOY_BROWSER_PRESET_LABEL: Record<
  | "preschoolBoy"
  | "littleBoy"
  | "storybookBoy"
  | "heroBoy"
  | "brightBoy",
  string
> = {
  preschoolBoy: "学龄前小男孩预设",
  littleBoy: "小男孩预设",
  storybookBoy: "绘本小男孩预设",
  heroBoy: "主角感小少年预设",
  brightBoy: "清亮少年预设",
};

const BROWSER_PRESETS: Record<
  TTSVoiceStyle,
  { rate: number; pitch: number; volume: number; lang: string }
> = {
  preschoolBoy: { rate: 1.02, pitch: 1.5, volume: 1, lang: "zh-CN" },
  littleBoy: { rate: 0.99, pitch: 1.4, volume: 1, lang: "zh-CN" },
  storybookBoy: { rate: 0.92, pitch: 1.26, volume: 1, lang: "zh-CN" },
  heroBoy: { rate: 0.93, pitch: 1.22, volume: 1, lang: "zh-CN" },
  brightBoy: { rate: 0.96, pitch: 1.14, volume: 1, lang: "zh-CN" },
  gentleGirl: { rate: 0.93, pitch: 1.12, volume: 1, lang: "zh-CN" },
  defaultNarrator: { rate: 0.98, pitch: 1.04, volume: 1, lang: "zh-CN" },
};

export function resolveBrowserPresetValues(
  style: TTSVoiceStyle,
  override?: { rate?: number; pitch?: number; volume?: number }
): { rate: number; pitch: number; volume: number } {
  const p = BROWSER_PRESETS[style];
  return {
    rate: override?.rate ?? p.rate,
    pitch: override?.pitch ?? p.pitch,
    volume: override?.volume ?? p.volume,
  };
}

function langPriority(lang: string): number {
  const l = lang.toLowerCase();
  if (l === "zh-cn" || l.startsWith("zh-cn")) return 100;
  if (l.startsWith("zh-hk")) return 85;
  if (l.startsWith("zh-tw")) return 85;
  if (l.startsWith("zh")) return 70;
  if (l.includes("cmn")) return 55;
  return 0;
}

function penalizeRobotic(name: string): number {
  const n = name.toLowerCase();
  if (
    /microsoft\s+david|microsoft\s+mark|microsoft\s+zira|\bespeak\b|speech\s+platform|desktop|sapi5\s+?|old\s+speech|system\s+voice|robot\s+voice/i.test(
      n
    )
  ) {
    return -120;
  }
  return 0;
}

/** 男孩向 style 共用的一些声线偏好（在 style 分支上再叠加） */
function boyVoiceBaseScore(n: string): number {
  let s = 0;
  if (
    /yunxi|云希|yunjian|云健|kangkang|康康|yunyang|云扬|boy|男童|男孩|男声|少年|青年男|male/i.test(
      n
    )
  ) {
    s += 18;
  }
  if (
    /xiaoxiao|晓晓|xiaoyi|晓伊|xiaomo|晓墨|xiaoshuang|晓双|yaoyao|瑶瑶|female|女|girl|mei-jia|meijia/i.test(
      n
    )
  ) {
    s -= 16;
  }
  return s;
}

/**
 * 按「当前 style」为浏览器选不同优先策略（仍受设备可用 voice 限制）。
 * 若中文 voice 很少，多个 style 仍会落到同一 URI —— 由上层对比 voiceURI 并提示用户。
 */
export function scoreVoiceForTtsStyle(
  style: TTSVoiceStyle,
  v: SpeechSynthesisVoice
): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let s = langPriority(v.lang || "");
  s += penalizeRobotic(n);

  if (/neural|natural|premium|mandarin|chinese/i.test(n)) s += 7;
  if (/google|microsoft|apple|sinji|meijia/i.test(n)) s += 3;

  switch (style) {
    case "preschoolBoy": {
      s += boyVoiceBaseScore(n);
      if (/儿童|kid|child|幼儿|童话|cartoon|萌|童声|学龄|宝贝/i.test(n)) s += 34;
      if (/yunxi|云希|少年|童/i.test(n)) s += 16;
      if (/narration|news|播音|formal|低沉|主持/i.test(n)) s -= 14;
      break;
    }
    case "littleBoy": {
      s += boyVoiceBaseScore(n);
      if (/儿童|kid|child|幼儿|童话|cartoon|萌|童声/i.test(n)) s += 28;
      if (/yunxi|云希|少年|童/i.test(n)) s += 14;
      if (/narration|news|播音|formal|低沉/i.test(n)) s -= 12;
      break;
    }
    case "storybookBoy": {
      s += boyVoiceBaseScore(n);
      if (/gentle|温暖|warm|xiaoyi|晓伊|xiaomo|晓墨|温柔|亲切/i.test(n)) s += 22;
      if (/yunxi|云希/i.test(n)) s += 12;
      if (/narration-relaxed|旁白|新闻|播音/i.test(n)) s -= 10;
      break;
    }
    case "heroBoy": {
      s += boyVoiceBaseScore(n);
      if (/yunxi|云希|yunyang|云扬|cheerful|活泼|明亮|expressive/i.test(n)) s += 24;
      if (/narration|formal|新闻/i.test(n)) s -= 14;
      break;
    }
    case "brightBoy": {
      s += boyVoiceBaseScore(n);
      if (/yunyang|云扬|yunjian|清晰|chat|明亮|standard/i.test(n)) s += 22;
      if (/yunxi|云希/i.test(n)) s += 8;
      if (/xiaoxiao|晓晓|女|girl/i.test(n)) s -= 18;
      break;
    }
    case "gentleGirl": {
      if (
        /xiaoxiao|xiaoyi|xiaomo|xiaoshuang|yaoyao|huihui|female|女|girl|晓|瑶|伊|双/i.test(
          n
        )
      ) {
        s += 24;
      }
      if (/yunxi|david|mark|male|男/i.test(n)) s -= 12;
      break;
    }
    case "defaultNarrator": {
      if (/yunjian|yunyang|xiaoxiao|narrat|旁白|新闻|standard/i.test(n)) s += 16;
      if (/cartoon|萌|童/i.test(n)) s -= 6;
      break;
    }
    default: {
      const _e: never = style;
      return _e;
    }
  }

  return s;
}

export function filterZhVoices(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return list.filter((v) => {
    const l = (v.lang || "").toLowerCase();
    return l.startsWith("zh") || l.includes("cmn");
  });
}

export function countZhVoices(list: SpeechSynthesisVoice[]): number {
  return filterZhVoices(list).length;
}

const BOY_STYLES = [
  "preschoolBoy",
  "littleBoy",
  "storybookBoy",
  "heroBoy",
  "brightBoy",
] as const;

export type BoyStyleVoiceSummary = {
  byStyle: Record<(typeof BOY_STYLES)[number], string | null>;
  uniqueVoiceUriCount: number;
  sharedOneVoice: boolean;
  hint: string;
};

/** 对比男孩线各预设选中的 voiceURI，判断是否「真多音色」 */
export function summarizeBoyStyleVoiceSeparation(
  voices: SpeechSynthesisVoice[]
): BoyStyleVoiceSummary {
  const byStyle = {
    preschoolBoy: null as string | null,
    littleBoy: null as string | null,
    storybookBoy: null as string | null,
    heroBoy: null as string | null,
    brightBoy: null as string | null,
  };
  for (const st of BOY_STYLES) {
    const v = pickBestVoiceForStyle(st, voices);
    byStyle[st] = v?.voiceURI ?? null;
  }
  const uris = new Set(
    BOY_STYLES.map((st) => byStyle[st]).filter(Boolean) as string[]
  );
  const uniqueVoiceUriCount = uris.size;
  const sharedOneVoice = uniqueVoiceUriCount <= 1;
  const zhN = countZhVoices(voices);
  const nBoy = BOY_STYLES.length;
  let hint: string;
  if (zhN <= 1) {
    hint = `当前设备可用中文 voice 仅 ${zhN} 个，男孩各预设必然共用同一声线；差异几乎只有语速/音高。`;
  } else if (sharedOneVoice) {
    hint =
      `虽有多个中文 voice，但在当前评分策略下 ${nBoy} 种男孩预设仍指向同一 voiceURI；听感差异主要来自 rate/pitch，无法替代真实 5–7 岁音色。`;
  } else if (uniqueVoiceUriCount === nBoy) {
    hint = `${nBoy} 种男孩预设各自选中了不同的 voiceURI（浏览器层面已尽量区分声线）。`;
  } else {
    hint = `${nBoy} 种男孩预设共用到 ${uniqueVoiceUriCount} 个不同 voiceURI；部分选项会共享声线。`;
  }
  return { byStyle, uniqueVoiceUriCount, sharedOneVoice, hint };
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().slice();
}

export function pickBestVoiceForStyle(
  style: TTSVoiceStyle,
  voices?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const list = voices ?? getAvailableVoices();
  if (list.length === 0) return null;

  const zh = filterZhVoices(list);
  const pool = zh.length > 0 ? zh : list;
  let best = pool[0]!;
  let bestScore = scoreVoiceForTtsStyle(style, best);
  for (let i = 1; i < pool.length; i++) {
    const v = pool[i]!;
    const sc = scoreVoiceForTtsStyle(style, v);
    if (sc > bestScore) {
      bestScore = sc;
      best = v;
    }
  }
  return best;
}

export function estimateVoiceFitScoreForStyle(
  style: TTSVoiceStyle,
  voices?: SpeechSynthesisVoice[]
): number {
  if (typeof window === "undefined" || !window.speechSynthesis) return -Infinity;
  const list = voices ?? getAvailableVoices();
  if (list.length === 0) return -Infinity;
  const v = pickBestVoiceForStyle(style, list);
  if (!v) return -Infinity;
  return scoreVoiceForTtsStyle(style, v);
}

export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const synth = window.speechSynthesis;
  const initial = synth.getVoices();
  if (initial.length > 0) return Promise.resolve(initial.slice());

  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices().slice());
    const t = window.setTimeout(done, 2500);
    synth.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(t);
        done();
      },
      { once: true }
    );
    try {
      void synth.getVoices();
    } catch {
      window.clearTimeout(t);
      resolve([]);
    }
  });
}

export function isBrowserTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined"
  );
}

export function primeSpeechSynthesis(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.resume();
    void window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
}

export function splitTextForTts(text: string, maxChunk = 56): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    const s = cur.trim();
    if (s) chunks.push(s);
    cur = "";
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    cur += c;
    const hard = /[。！？!?]/.test(c);
    const soft = /[，、,；;]/.test(c) && cur.length >= maxChunk;
    const long = cur.length >= maxChunk * 1.35;
    if (hard || soft || long) flush();
  }
  flush();
  return chunks.length > 0 ? chunks : [t];
}

let segmentTimer: number | null = null;

function clearSegmentTimer(): void {
  if (segmentTimer != null) {
    window.clearTimeout(segmentTimer);
    segmentTimer = null;
  }
}

export function stopBrowserTtsEngine(): void {
  clearSegmentTimer();
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export type BrowserTtsSpeakOptions = {
  style?: TTSVoiceStyle;
  rate?: number;
  pitch?: number;
  volume?: number;
  interrupt?: boolean;
  segment?: boolean;
  segmentGapMs?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

export async function speakWithBrowserTts(
  text: string,
  options?: BrowserTtsSpeakOptions
): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    options?.onEnd?.();
    return;
  }

  primeSpeechSynthesis();

  const trimmed = text.trim();
  if (!trimmed) {
    queueMicrotask(() => options?.onEnd?.());
    return;
  }

  const style = options?.style ?? DEFAULT_TTS_VOICE_STYLE;
  const preset = resolveBrowserPresetValues(style, {
    rate: options?.rate,
    pitch: options?.pitch,
    volume: options?.volume,
  });
  const interrupt = options?.interrupt !== false;
  const segment = options?.segment !== false;
  const segmentGapMs = options?.segmentGapMs ?? 140;

  await preloadVoices();

  const synth = window.speechSynthesis;
  if (interrupt) stopBrowserTtsEngine();
  else clearSegmentTimer();

  const parts =
    segment && trimmed.length > 24 ? splitTextForTts(trimmed) : [trimmed];
  const voices = getAvailableVoices();
  const voice = pickBestVoiceForStyle(style, voices);

  let started = false;
  const fireStart = () => {
    if (!started) {
      started = true;
      options?.onStart?.();
    }
  };

  return new Promise((resolve) => {
    let i = 0;
    const speakNext = () => {
      if (i >= parts.length) {
        options?.onEnd?.();
        resolve();
        return;
      }
      const chunk = parts[i]!;
      i += 1;
      try {
        synth.resume();
      } catch {
        /* ignore */
      }
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = BROWSER_PRESETS[style].lang;
      u.rate = preset.rate;
      u.pitch = preset.pitch;
      u.volume = preset.volume;
      if (voice) {
        u.voice = voice;
        if (voice.lang) u.lang = voice.lang;
      }
      u.onstart = () => fireStart();
      u.onend = () => {
        if (i < parts.length) {
          segmentTimer = window.setTimeout(speakNext, segmentGapMs);
        } else {
          options?.onEnd?.();
          resolve();
        }
      };
      u.onerror = () => {
        if (i < parts.length) {
          segmentTimer = window.setTimeout(speakNext, segmentGapMs);
        } else {
          options?.onEnd?.();
          resolve();
        }
      };
      synth.speak(u);
      queueMicrotask(() => {
        if (synth.speaking || synth.pending) fireStart();
      });
    };

    speakNext();
  });
}
