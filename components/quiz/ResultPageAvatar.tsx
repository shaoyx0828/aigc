"use client";

import { useState } from "react";
import { AvatarVideoCanvas } from "@/components/quiz/AvatarVideoCanvas";
import {
  pickRandomIdleClipUrl,
  RESULT_LOW_CLIP_URL,
} from "@/lib/quiz/avatarVideoMap";

type Props = {
  /** true：播放「60分以下 / 后50%」表情；false：随机一段待机循环 */
  showDisappointed: boolean;
};

/**
 * 答题结果页右下角数字人（与答题中 Dock 风格一致，无状态机）。
 */
export function ResultPageAvatar({ showDisappointed }: Props) {
  const [idleUrl] = useState(() => pickRandomIdleClipUrl());
  const src = showDisappointed ? RESULT_LOW_CLIP_URL : idleUrl;

  return (
    <div
      className="pointer-events-none fixed z-[12] flex max-w-[calc(100vw-1.5rem)] flex-col items-end"
      style={{
        width: 360,
        bottom: `max(0.75rem, calc(176px + env(safe-area-inset-bottom, 0px)))`,
        right: `max(0.75rem, calc(20px + env(safe-area-inset-right, 0px)))`,
      }}
    >
      <AvatarVideoCanvas
        src={src}
        loop
        blackThreshold={32}
        edgeFeather={38}
        renderMode="blackKey"
        className="w-full max-h-[min(52vh,320px)]"
        width="100%"
      />
    </div>
  );
}
