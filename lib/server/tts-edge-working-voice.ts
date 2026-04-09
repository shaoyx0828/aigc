import type { TTSVoiceStyle } from "@/src/config/tts";

/** 已通过 /api/tts 最小链路验证的中文 Edge Neural voice（可 env 覆盖） */
export const EDGE_VERIFIED_WORKING_VOICE =
  process.env.TTS_WORKING_VOICE?.trim() || "zh-CN-YunxiNeural";

/**
 * working 路径下的「幼态 + 迪士尼感活力」Edge 参数（避免此前 +30% 量级易断连，用中度抬调 + 略快语速）。
 * debugMinimal 探测仍用 default/default，见 route 分支。
 */
export const WORKING_VOICE_PLAYFUL_PITCH =
  process.env.TTS_WORKING_PLAYFUL_PITCH?.trim() || "+14%";
export const WORKING_VOICE_PLAYFUL_RATE =
  process.env.TTS_WORKING_PLAYFUL_RATE?.trim() || "+8%";
export const WORKING_VOICE_PLAYFUL_VOLUME =
  process.env.TTS_WORKING_PLAYFUL_VOLUME?.trim() || "default";

/** 临时：男孩线 style 先统一用 working voice，保证 external 稳定（设 TTS_TEMP_BOY_STYLES_USE_WORKING_VOICE=0 关闭） */
export const TEMP_BOY_STYLES_USE_WORKING_VOICE: readonly TTSVoiceStyle[] = [
  "preschoolBoy",
  "littleBoy",
  "storybookBoy",
  "heroBoy",
] as const;

export type WorkingVoiceReason =
  | "debug_minimal"
  | "force_body"
  | "force_env"
  | "temp_boy_map"
  | null;

export function resolveWorkingVoiceSynthesis(opts: {
  debugMinimal: boolean;
  forceExternalWorkingVoiceBody: boolean;
  resolvedStyle: TTSVoiceStyle;
}): { useWorkingSynthesis: boolean; reason: WorkingVoiceReason } {
  if (opts.debugMinimal) {
    return { useWorkingSynthesis: true, reason: "debug_minimal" };
  }
  const envForce = process.env.TTS_FORCE_WORKING_VOICE?.trim();
  if (envForce === "1" || envForce?.toLowerCase() === "true") {
    return { useWorkingSynthesis: true, reason: "force_env" };
  }
  if (opts.forceExternalWorkingVoiceBody) {
    return { useWorkingSynthesis: true, reason: "force_body" };
  }
  const tempOff =
    process.env.TTS_TEMP_BOY_STYLES_USE_WORKING_VOICE?.trim() === "0";
  if (!tempOff && TEMP_BOY_STYLES_USE_WORKING_VOICE.includes(opts.resolvedStyle)) {
    return { useWorkingSynthesis: true, reason: "temp_boy_map" };
  }
  return { useWorkingSynthesis: false, reason: null };
}
