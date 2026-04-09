import type { AvatarState } from "@/lib/providers/avatar/interface";

/**
 * 答题过程待机池（`待机.mp4`～`待机4.mp4`）：随机切换，避免固定轮播顺序。
 */
export const AVATAR_IDLE_CLIP_URLS = [
  "/avatar/idle-0.mp4",
  "/avatar/idle-1.mp4",
  "/avatar/idle-2.mp4",
  "/avatar/idle-3.mp4",
  "/avatar/idle-4.mp4",
] as const;

/** 公布分数时：总分 &lt; 60 或排名处于后 50% */
export const RESULT_LOW_CLIP_URL = "/avatar/result-low.mp4";

export type AvatarVideoAction = "greeting" | "speaking" | "correct" | "wrong";

export type AvatarAction = AvatarVideoAction;

/** 非待机类动作（待机由 `AVATAR_IDLE_CLIP_URLS` + 随机逻辑单独处理） */
export const avatarVideoMap: Record<AvatarVideoAction, string> = {
  greeting: "/avatar/greeting.mp4",
  /** 语音播报（TTS 念题）；部署时由 `IP透明背景/19.mp4` 同步为 `public/avatar/speaking.mp4` */
  speaking: "/avatar/speaking.mp4",
  correct: "/avatar/correct.mp4",
  wrong: "/avatar/wrong.mp4",
};

/**
 * 随机选一段待机；可传入当前 URL 以尽量换另一条（仍可能相同当池子为 1）。
 */
export function pickRandomIdleClipUrl(excludeUrl?: string): string {
  const urls = AVATAR_IDLE_CLIP_URLS as unknown as readonly string[];
  const pool = excludeUrl
    ? urls.filter((u) => u !== excludeUrl)
    : [...urls];
  const list = pool.length > 0 ? pool : [...urls];
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * @param idleClipUrl 当前随机待机片段（idle / listening）
 */
export function resolveAvatarSessionVideoSrc(
  state: AvatarState,
  idleClipUrl: string
): string {
  if (state === "listening" || state === "idle") {
    return idleClipUrl;
  }
  return avatarVideoMap[state];
}
