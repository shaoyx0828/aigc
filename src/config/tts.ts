/**
 * TTS 配置层：学龄前小男孩感（约 5–7 岁）优先，分层到清亮少年；外部语义全量透传。
 */

export type TTSVoiceStyle =
  | "preschoolBoy"
  | "littleBoy"
  | "storybookBoy"
  | "heroBoy"
  | "brightBoy"
  | "gentleGirl"
  | "defaultNarrator";

/** 界面顺序：幼态优先 preschoolBoy > littleBoy > storybookBoy > heroBoy > brightBoy */
export const TTS_STYLE_UI_ORDER: TTSVoiceStyle[] = [
  "preschoolBoy",
  "littleBoy",
  "storybookBoy",
  "heroBoy",
  "brightBoy",
  "gentleGirl",
  "defaultNarrator",
];

/** 默认：学龄前小男孩感（非少年抬 pitch） */
export const DEFAULT_TTS_VOICE_STYLE: TTSVoiceStyle = "preschoolBoy";

export const TTS_STYLE_CONFIG: Record<
  TTSVoiceStyle,
  { label: string; description: string }
> = {
  preschoolBoy: {
    label: "学龄前小男孩",
    description:
      "目标约 5–7 岁：最幼态、最轻、最亮、活泼、稚嫩；清澈自然，避免尖锐、夸张卡通、女声化（非少年音、非主持男声）",
  },
  littleBoy: {
    label: "小男孩",
    description:
      "目标约 7–9 岁：幼态、清澈、轻快、自然；适合题目引导与陪伴（仍明显小于少年）",
  },
  storybookBoy: {
    label: "绘本小男孩",
    description:
      "目标约 8–10 岁：绘本感、温暖、清澈、自然；适合读题与讲述",
  },
  heroBoy: {
    label: "主角感小少年",
    description:
      "目标约 10–12 岁：有主角感，比学龄前/小男孩略成熟；适合开场、收尾（仍非成年年轻男声）",
  },
  brightBoy: {
    label: "清亮少年",
    description:
      "男孩线中相对最成熟：清亮少年感，底线避免成年厚声与新闻腔",
  },
  gentleGirl: {
    label: "温柔女声",
    description: "自然、温和、亲切",
  },
  defaultNarrator: {
    label: "默认旁白",
    description: "中性自然播报",
  },
};

export type TtsPerceivedAgeBand =
  | "学龄前男童"
  | "幼态男童"
  | "偏小男孩"
  | "偏少年"
  | "偏成年"
  | "女童向"
  | "中性旁白";

export type TtsMaturitySemantic =
  | "veryLow"
  | "low"
  | "mediumLow"
  | "medium"
  | "mediumHigh"
  | "high";

export type TtsScalarSemantic =
  | "veryLow"
  | "low"
  | "lowMedium"
  | "medium"
  | "mediumHigh"
  | "high"
  | "veryHigh";

export type TTSVoiceAvoidTag =
  | "adult"
  | "teen"
  | "deep"
  | "broadcaster"
  | "serious"
  | "lowPitch"
  | "female"
  | "matureTeen"
  | "heavyResonance"
  | "formalNews";

export type TTSStyleTone = "bright" | "warm" | "neutral";
export type TTSStyleAge = "child" | "youngBoy" | "teenBoy" | "adult";
export type TTSStyleEnergy =
  | "low"
  | "lowMedium"
  | "medium"
  | "mediumHigh"
  | "high";
export type TTSStyleWarmth = "low" | "medium" | "mediumHigh" | "high";
export type TTSStyleExpressiveness = "low" | "medium" | "high";

export type TTSStyleVoiceSemantics = {
  targetAge: string;
  /** 调试用短标签 */
  targetAgeUiHint: string;
  perceivedAgeBand: TtsPerceivedAgeBand;
  timbre: string;
  gender: "male" | "female" | "neutral";
  liveliness: TtsScalarSemantic;
  brightness: TtsScalarSemantic;
  thinness: TtsScalarSemantic;
  softness: TtsScalarSemantic;
  warmth: TtsScalarSemantic;
  maturity: TtsMaturitySemantic;
  expressiveness: TtsScalarSemantic;
  avoid: TTSVoiceAvoidTag[];
  tone: TTSStyleTone;
  energy: TTSStyleEnergy;
  legacyAgeBucket: TTSStyleAge;
};

const BOY_AVOID: TTSVoiceAvoidTag[] = [
  "adult",
  "teen",
  "deep",
  "broadcaster",
  "serious",
  "lowPitch",
  "female",
  "matureTeen",
  "heavyResonance",
  "formalNews",
];

export const TTS_STYLE_VOICE_SEMANTICS: Record<
  TTSVoiceStyle,
  TTSStyleVoiceSemantics
> = {
  preschoolBoy: {
    targetAge: "5-7",
    targetAgeUiHint: "5–7 岁（学龄前小男孩）",
    perceivedAgeBand: "学龄前男童",
    timbre: "preschoolPlayfulBrightLightBoy",
    gender: "male",
    liveliness: "high",
    brightness: "high",
    thinness: "high",
    softness: "mediumHigh",
    warmth: "mediumHigh",
    maturity: "veryLow",
    expressiveness: "high",
    avoid: BOY_AVOID,
    tone: "bright",
    energy: "mediumHigh",
    legacyAgeBucket: "child",
  },
  littleBoy: {
    targetAge: "7-9",
    targetAgeUiHint: "7–9 岁（小男孩）",
    perceivedAgeBand: "幼态男童",
    timbre: "lightClearQuickBoy",
    gender: "male",
    liveliness: "mediumHigh",
    brightness: "high",
    thinness: "mediumHigh",
    softness: "mediumHigh",
    warmth: "mediumHigh",
    maturity: "veryLow",
    expressiveness: "medium",
    avoid: BOY_AVOID,
    tone: "bright",
    energy: "medium",
    legacyAgeBucket: "child",
  },
  storybookBoy: {
    targetAge: "8-10",
    targetAgeUiHint: "8–10 岁（绘本感男孩）",
    perceivedAgeBand: "偏小男孩",
    timbre: "warmNaturalStorybookBoy",
    gender: "male",
    liveliness: "medium",
    brightness: "mediumHigh",
    thinness: "mediumHigh",
    softness: "high",
    warmth: "high",
    maturity: "low",
    expressiveness: "medium",
    avoid: BOY_AVOID,
    tone: "warm",
    energy: "lowMedium",
    legacyAgeBucket: "child",
  },
  heroBoy: {
    targetAge: "10-12",
    targetAgeUiHint: "10–12 岁（小少年）",
    perceivedAgeBand: "偏少年",
    timbre: "brightExpressiveYoungHeroBoy",
    gender: "male",
    liveliness: "mediumHigh",
    brightness: "high",
    thinness: "mediumHigh",
    softness: "medium",
    warmth: "mediumHigh",
    maturity: "low",
    expressiveness: "high",
    avoid: [
      "adult",
      "teen",
      "deep",
      "broadcaster",
      "serious",
      "lowPitch",
      "female",
      "heavyResonance",
      "formalNews",
    ],
    tone: "bright",
    energy: "mediumHigh",
    legacyAgeBucket: "youngBoy",
  },
  brightBoy: {
    targetAge: "12-14",
    targetAgeUiHint: "12–14 岁（清亮少年）",
    perceivedAgeBand: "偏少年",
    timbre: "clearBrightTeenBoy",
    gender: "male",
    liveliness: "medium",
    brightness: "mediumHigh",
    thinness: "mediumHigh",
    softness: "medium",
    warmth: "medium",
    maturity: "mediumLow",
    expressiveness: "medium",
    avoid: ["adult", "deep", "broadcaster", "serious", "formalNews"],
    tone: "bright",
    energy: "medium",
    legacyAgeBucket: "teenBoy",
  },
  gentleGirl: {
    targetAge: "adult",
    targetAgeUiHint: "—（女声）",
    perceivedAgeBand: "女童向",
    timbre: "softWarmFemale",
    gender: "female",
    liveliness: "medium",
    brightness: "medium",
    thinness: "medium",
    softness: "high",
    warmth: "high",
    maturity: "medium",
    expressiveness: "medium",
    avoid: ["deep", "broadcaster", "formalNews"],
    tone: "warm",
    energy: "lowMedium",
    legacyAgeBucket: "adult",
  },
  defaultNarrator: {
    targetAge: "adult",
    targetAgeUiHint: "—（旁白）",
    perceivedAgeBand: "中性旁白",
    timbre: "neutralNarration",
    gender: "neutral",
    liveliness: "low",
    brightness: "medium",
    thinness: "medium",
    softness: "medium",
    warmth: "medium",
    maturity: "medium",
    expressiveness: "low",
    avoid: [],
    tone: "neutral",
    energy: "lowMedium",
    legacyAgeBucket: "adult",
  },
};

function scalarToApiBrightness(
  s: TtsScalarSemantic
): "medium" | "mediumHigh" | "high" {
  if (s === "veryHigh" || s === "high") return "high";
  if (s === "mediumHigh" || s === "medium") return "mediumHigh";
  return "medium";
}

function scalarWarmthToApi(s: TtsScalarSemantic): TTSStyleWarmth {
  if (s === "veryHigh" || s === "high") return "high";
  if (s === "mediumHigh") return "mediumHigh";
  if (s === "medium") return "medium";
  return "low";
}

function scalarExpressToApi(s: TtsScalarSemantic): TTSStyleExpressiveness {
  if (s === "veryHigh" || s === "high") return "high";
  if (s === "mediumHigh" || s === "medium") return "medium";
  return "low";
}

export type TTSStyleProfile = {
  age: TTSStyleAge;
  tone: TTSStyleTone;
  brightness: "medium" | "mediumHigh" | "high";
  warmth: TTSStyleWarmth;
  energy: TTSStyleEnergy;
  expressiveness: TTSStyleExpressiveness;
};

export const TTS_STYLE_PROFILE: Record<TTSVoiceStyle, TTSStyleProfile> =
  Object.fromEntries(
    TTS_STYLE_UI_ORDER.map((k) => {
      const v = TTS_STYLE_VOICE_SEMANTICS[k];
      const row: TTSStyleProfile = {
        age: v.legacyAgeBucket,
        tone: v.tone,
        brightness: scalarToApiBrightness(v.brightness),
        warmth: scalarWarmthToApi(v.warmth),
        energy: v.energy,
        expressiveness: scalarExpressToApi(v.expressiveness),
      };
      return [k, row];
    })
  ) as Record<TTSVoiceStyle, TTSStyleProfile>;

export function buildExternalTtsRequestBody(
  text: string,
  style: TTSVoiceStyle
): Record<string, unknown> {
  const s = TTS_STYLE_VOICE_SEMANTICS[style];
  return {
    text,
    style,
    targetAge: s.targetAge,
    gender: s.gender,
    timbre: s.timbre,
    liveliness: s.liveliness,
    brightness: s.brightness,
    thinness: s.thinness,
    softness: s.softness,
    warmth: s.warmth,
    maturity: s.maturity,
    expressiveness: s.expressiveness,
    avoid: s.avoid,
    perceivedAgeBand: s.perceivedAgeBand,
    tone: s.tone,
    energy: s.energy,
    age: s.legacyAgeBucket,
  };
}

/** 从「偏少年」往「学龄前」步进（更幼一点） */
export const BOY_STYLE_YOUNGER_CHAIN = [
  "preschoolBoy",
  "littleBoy",
  "storybookBoy",
  "heroBoy",
  "brightBoy",
] as const satisfies readonly TTSVoiceStyle[];

export function stepBoyStyleYounger(style: TTSVoiceStyle): TTSVoiceStyle {
  const chain = BOY_STYLE_YOUNGER_CHAIN;
  const idx = chain.indexOf(style as (typeof chain)[number]);
  if (idx === -1) return "preschoolBoy";
  if (idx <= 0) return "preschoolBoy";
  return chain[idx - 1]!;
}

/**
 * 更活泼一点：在男孩线内提高活泼/表现倾向（storybook→little→bright→hero→preschool 已为高活泼档）。
 * 避免一味抬 pitch，优先换到语义上 liveliness 更高的档。
 */
export const BOY_STYLE_LIVELIER_CHAIN = [
  "storybookBoy",
  "brightBoy",
  "littleBoy",
  "heroBoy",
  "preschoolBoy",
] as const satisfies readonly TTSVoiceStyle[];

export function stepBoyStyleMoreLively(style: TTSVoiceStyle): TTSVoiceStyle {
  const chain = BOY_STYLE_LIVELIER_CHAIN;
  const idx = chain.indexOf(style as (typeof chain)[number]);
  if (idx === -1) return "preschoolBoy";
  if (idx >= chain.length - 1) return chain[chain.length - 1]!;
  return chain[idx + 1]!;
}

export const TTS_TEXT = {
  welcome: "你好呀，欢迎来到答题挑战！",
  questionIntro: "准备好了吗？我们来看这一题。",
  nextQuestion: "好呀，我们继续下一题吧。",
  thinking: "别着急呀，我们慢慢想一想。",
  encourage: "继续加油呀！",
  finish: "今天的答题结束啦，感谢你的参与！",
} as const;

export type QuestionSpeechVariant = "first" | "continuation";

export function buildQuestionSpeech(
  questionText: string,
  variant: QuestionSpeechVariant = "first"
): string {
  const q = questionText.trim();
  // continuation：切换题目后要尽快进入题干，省略长铺垫，减少等待感
  if (variant === "continuation") {
    return `请听题：${q}`;
  }
  return `${TTS_TEXT.questionIntro}请听题：${q}`;
}

export type TtsClientEngineMode = "external" | "browser" | "auto";

export type TtsClientConfig = {
  engine: TtsClientEngineMode;
  apiUrl: string;
  fallbackToBrowser: boolean;
  externalTimeoutMs: number;
  /** 请求 /api/tts 时附带 forceExternalWorkingVoice，服务端强制走已验证 working voice */
  forceExternalWorkingVoice: boolean;
};

function readEnvEngine(): TtsClientEngineMode {
  const v = process.env.NEXT_PUBLIC_TTS_ENGINE?.trim().toLowerCase();
  if (v === "external" || v === "browser" || v === "auto") return v;
  return "auto";
}

function readEnvFallbackToBrowser(): boolean {
  const v = process.env.NEXT_PUBLIC_TTS_FALLBACK?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (
    v === undefined ||
    v === "" ||
    v === "browser" ||
    v === "1" ||
    v === "true" ||
    v === "on"
  ) {
    return true;
  }
  return true;
}

function readExternalTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_TTS_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 2000 && n <= 120000) return Math.floor(n);
  return 12_000;
}

function readEnvForceExternalWorkingVoice(): boolean {
  const v =
    process.env.NEXT_PUBLIC_TTS_FORCE_EXTERNAL_WORKING_VOICE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

export function getTtsClientConfig(): TtsClientConfig {
  const apiUrl =
    process.env.NEXT_PUBLIC_TTS_API_URL?.trim() || "/api/tts";
  return {
    engine: readEnvEngine(),
    apiUrl: apiUrl.startsWith("/") ? apiUrl : apiUrl,
    fallbackToBrowser: readEnvFallbackToBrowser(),
    externalTimeoutMs: readExternalTimeoutMs(),
    forceExternalWorkingVoice: readEnvForceExternalWorkingVoice(),
  };
}

export function shouldPreferExternalEngine(cfg: TtsClientConfig): boolean {
  if (cfg.engine === "browser") return false;
  if (cfg.engine === "external") return Boolean(cfg.apiUrl);
  return Boolean(cfg.apiUrl);
}
