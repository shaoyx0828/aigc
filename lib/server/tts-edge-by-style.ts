import type { TTSVoiceStyle } from "@/src/config/tts";

export type EdgeExpressAs = { style: string; role?: string };

export type TtsEdgeSynthesisParams = {
  voice: string;
  pitch: string;
  rate: string;
  volume: string;
  timeout: number;
  expressAs?: EdgeExpressAs | null;
};

/**
 * 学龄前小男孩感优先：preschoolBoy 更高 pitch、更活泼；依次略增龄至 brightBoy。
 */
export function getEdgeSynthesisParamsForStyle(
  style: TTSVoiceStyle
): TtsEdgeSynthesisParams {
  const timeout = Number(process.env.TTS_API_TIMEOUT ?? "25000") || 25000;
  const volume = process.env.QUIZ_EDGE_TTS_VOLUME?.trim() || "default";

  switch (style) {
    case "preschoolBoy":
      return {
        voice:
          process.env.TTS_STYLE_PRESCHOOL_VOICE?.trim() || "zh-CN-YunxiNeural",
        pitch: process.env.TTS_STYLE_PRESCHOOL_PITCH?.trim() || "+38%",
        rate: process.env.TTS_STYLE_PRESCHOOL_RATE?.trim() || "+6%",
        volume,
        timeout,
        expressAs: {
          style: process.env.TTS_STYLE_PRESCHOOL_EXPRESS?.trim() || "cheerful",
          role: process.env.TTS_STYLE_PRESCHOOL_ROLE?.trim() || "Boy",
        },
      };
    case "littleBoy":
      return {
        voice: process.env.TTS_STYLE_LITTLE_VOICE?.trim() || "zh-CN-YunxiNeural",
        pitch: process.env.TTS_STYLE_LITTLE_PITCH?.trim() || "+28%",
        rate: process.env.TTS_STYLE_LITTLE_RATE?.trim() || "+5%",
        volume,
        timeout,
        expressAs: {
          style: process.env.TTS_STYLE_LITTLE_EXPRESS?.trim() || "cheerful",
          role: process.env.TTS_STYLE_LITTLE_ROLE?.trim() || "Boy",
        },
      };
    case "storybookBoy":
      return {
        voice: process.env.TTS_STYLE_STORY_VOICE?.trim() || "zh-CN-YunxiNeural",
        pitch: process.env.TTS_STYLE_STORY_PITCH?.trim() || "+19%",
        rate: process.env.TTS_STYLE_STORY_RATE?.trim() || "+2%",
        volume,
        timeout,
        expressAs: {
          style: process.env.TTS_STYLE_STORY_EXPRESS?.trim() || "gentle",
          role: process.env.TTS_STYLE_STORY_ROLE?.trim() || "Boy",
        },
      };
    case "heroBoy":
      return {
        voice: process.env.TTS_STYLE_HERO_VOICE?.trim() || "zh-CN-YunxiNeural",
        pitch: process.env.TTS_STYLE_HERO_PITCH?.trim() || "+23%",
        rate: process.env.TTS_STYLE_HERO_RATE?.trim() || "+6%",
        volume,
        timeout,
        expressAs: {
          style: process.env.TTS_STYLE_HERO_EXPRESS?.trim() || "cheerful",
          role: process.env.TTS_STYLE_HERO_ROLE?.trim() || "Boy",
        },
      };
    case "brightBoy":
      return {
        voice: process.env.TTS_STYLE_BRIGHT_VOICE?.trim() || "zh-CN-YunxiNeural",
        pitch: process.env.TTS_STYLE_BRIGHT_PITCH?.trim() || "+14%",
        rate: process.env.TTS_STYLE_BRIGHT_RATE?.trim() || "+8%",
        volume,
        timeout,
        expressAs: {
          style: process.env.TTS_STYLE_BRIGHT_EXPRESS?.trim() || "chat",
        },
      };
    case "gentleGirl":
      return {
        voice: process.env.TTS_STYLE_GIRL_VOICE?.trim() || "zh-CN-XiaoxiaoNeural",
        pitch: "default",
        rate: "default",
        volume,
        timeout,
        expressAs: {
          style: process.env.TTS_STYLE_GIRL_EXPRESS?.trim() || "gentle",
        },
      };
    case "defaultNarrator":
      return {
        voice:
          process.env.TTS_STYLE_NARRATOR_VOICE?.trim() || "zh-CN-YunjianNeural",
        pitch: "default",
        rate: "default",
        volume,
        timeout,
        expressAs: {
          style:
            process.env.TTS_STYLE_NARRATOR_EXPRESS?.trim() || "narration-relaxed",
        },
      };
    default:
      return getEdgeSynthesisParamsForStyle("preschoolBoy");
  }
}
