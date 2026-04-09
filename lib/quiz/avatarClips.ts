import type { AvatarState } from "@/lib/providers/avatar/interface";
import {
  AVATAR_IDLE_CLIP_URLS,
  avatarVideoMap,
} from "@/lib/quiz/avatarVideoMap";

/**
 * 各状态对应视频 URL（null 表示与 idle 同源，见 `resolveAvatarClipUrl`）。
 */
export const AVATAR_CLIP_URLS: Record<AvatarState, string | null> = {
  idle: AVATAR_IDLE_CLIP_URLS[0],
  greeting: avatarVideoMap.greeting,
  speaking: avatarVideoMap.speaking,
  wrong: avatarVideoMap.wrong,
  correct: avatarVideoMap.correct,
  listening: null,
};

export const AVATAR_IDLE_URL = AVATAR_IDLE_CLIP_URLS[0];

export const AVATAR_IP_PACK_MARK_URL = AVATAR_IDLE_URL;

export function resolveAvatarClipUrl(state: AvatarState): string {
  const direct = AVATAR_CLIP_URLS[state];
  if (direct) return direct;
  return AVATAR_IDLE_URL;
}

export function hasDedicatedClip(state: AvatarState): boolean {
  return AVATAR_CLIP_URLS[state] != null;
}

export function useNativeLoopForState(state: AvatarState): boolean {
  if (state === "greeting" || state === "speaking" || state === "wrong")
    return false;
  if (state === "correct" && AVATAR_CLIP_URLS.correct != null) return false;
  return true;
}
