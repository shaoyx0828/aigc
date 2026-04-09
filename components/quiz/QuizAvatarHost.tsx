"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "@/lib/providers/avatar/interface";
import { QuizSessionAvatarDock } from "@/components/quiz/QuizSessionAvatarDock";
import { AVATAR_IP_PACK_MARK_URL } from "@/lib/quiz/avatarClips";

const GLB_URL = "/models/digital-human.glb";

const DigitalHumanScene = dynamic(
  () =>
    import("@/components/digital-human/DigitalHumanScene").then(
      (m) => m.DigitalHumanScene
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto h-[248px] w-full max-w-md shrink-0 animate-pulse rounded-2xl bg-slate-100 sm:h-[272px] lg:h-[296px]" />
    ),
  }
);

export type AvatarDisplaySurface = "unknown" | "glb" | "video";

function detectWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl") ||
      c.getContext("webgl2") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

type Props = {
  state: AvatarState;
  /** 解析完成后告知父组件，用于选择问候/反馈计时方式 */
  onSurfaceResolved: (surface: "glb" | "video") => void;
  onGreetingClipEnded: () => void;
  onWrongClipEnded: () => void;
  onCorrectClipEnded?: () => void;
  /** 侧栏内嵌：3D 加高、占位与默认页不同 */
  layout?: "default" | "sidebar";
};

/**
 * 优先 3D GLB；若无模型文件或浏览器无 WebGL，则回退到 MP4 状态视频，避免答题页空白。
 */
/** 高度由 app/globals.css `.quiz-avatar-scene-glb` 按断点控制（透明场景、无卡片） */
const AVATAR_SCENE_GLB_CLASS = "quiz-avatar-scene-glb";

export function QuizAvatarHost({
  state,
  onSurfaceResolved,
  onGreetingClipEnded,
  onWrongClipEnded,
  onCorrectClipEnded,
  layout = "default",
}: Props) {
  const [surface, setSurface] = useState<AvatarDisplaySurface>("unknown");
  const reportedRef = useRef(false);
  const onSurfaceResolvedRef = useRef(onSurfaceResolved);
  onSurfaceResolvedRef.current = onSurfaceResolved;

  useEffect(() => {
    let cancelled = false;
    const resolve = (s: "glb" | "video") => {
      if (cancelled) return;
      setSurface(s);
      if (!reportedRef.current) {
        reportedRef.current = true;
        onSurfaceResolvedRef.current(s);
      }
    };

    if (!detectWebGL()) {
      resolve("video");
      return () => {
        cancelled = true;
      };
    }

    const forceGlb = process.env.NEXT_PUBLIC_QUIZ_AVATAR_FORCE_GLB === "1";
    if (forceGlb) {
      fetch(GLB_URL, { method: "HEAD" })
        .then((res) => {
          resolve(res.ok ? "glb" : "video");
        })
        .catch(() => {
          resolve("video");
        });
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      fetch(GLB_URL, { method: "HEAD" }),
      fetch(AVATAR_IP_PACK_MARK_URL, { method: "HEAD" }),
    ])
      .then(([glbRes, ipRes]) => {
        if (ipRes.ok) resolve("video");
        else resolve(glbRes.ok ? "glb" : "video");
      })
      .catch(() => {
        resolve("video");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (surface === "unknown") {
    return (
      <div
        className={
          layout === "sidebar"
            ? "quiz-avatar-scene-glb w-full shrink-0 animate-pulse rounded-none bg-slate-100/40"
            : "mx-auto h-[248px] w-full max-w-md shrink-0 animate-pulse rounded-2xl bg-slate-100 sm:h-[272px] lg:h-[296px]"
        }
      />
    );
  }

  if (surface === "video") {
    return (
      <QuizSessionAvatarDock
        state={state}
        onGreetingClipEnded={onGreetingClipEnded}
        onWrongClipEnded={onWrongClipEnded}
        onCorrectClipEnded={onCorrectClipEnded}
      />
    );
  }

  return (
    <DigitalHumanScene
      state={state}
      containerClassName={layout === "sidebar" ? AVATAR_SCENE_GLB_CLASS : undefined}
    />
  );
}
