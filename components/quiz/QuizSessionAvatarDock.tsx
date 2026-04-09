"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import type { AvatarState } from "@/lib/providers/avatar/interface";
import { AVATAR_DURATIONS_MS } from "@/lib/avatar/state-machine";
import { AVATAR_CLIP_URLS, useNativeLoopForState } from "@/lib/quiz/avatarClips";
import {
  pickRandomIdleClipUrl,
  resolveAvatarSessionVideoSrc,
} from "@/lib/quiz/avatarVideoMap";
import {
  AvatarVideoCanvas,
  type AvatarVideoCanvasHandle,
} from "@/components/quiz/AvatarVideoCanvas";
import {
  AvatarVideoDebugPanel,
  isAvatarDebugEnabled,
  readAvatarDebugSessionDefaults,
} from "@/components/quiz/AvatarVideoDebugPanel";

const GREETING_MAX_WAIT_MS = 12_000;
const WRONG_MAX_WAIT_MS = 10_000;
const CLIP_LOAD_TIMEOUT_MS = 6000;

export type QuizSessionAvatarDockProps = {
  state: AvatarState;
  onGreetingClipEnded: () => void;
  onWrongClipEnded: () => void;
  onCorrectClipEnded?: () => void;
};

/**
 * 答题页数字人（视频）：置于侧栏流式布局内（非 fixed），Canvas 去黑底；动作 URL 见 `avatarVideoMap`。
 * 状态机仍由 `avatarReducer` + 页面事件驱动（PAGE_ENTER→greeting、SPEAK→speaking、判分→correct/wrong 等）。
 */
export function QuizSessionAvatarDock({
  state,
  onGreetingClipEnded,
  onWrongClipEnded,
  onCorrectClipEnded,
}: QuizSessionAvatarDockProps) {
  const canvasHostRef = useRef<AvatarVideoCanvasHandle>(null);
  const stateRef = useRef(state);
  const greetingFiredRef = useRef(false);
  const wrongFiredRef = useRef(false);
  const correctFiredRef = useRef(false);
  const [mediaError, setMediaError] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [blackThreshold, setBlackThreshold] = useState(32);
  const [edgeFeather, setEdgeFeather] = useState(38);
  const [dockWidthPx, setDockWidthPx] = useState(360);
  /** 默认抬高，避免贴底裁切感（可用 ?avatarDebug=1 微调） */
  const [bottomPx, setBottomPx] = useState(176);
  const [rightPx, setRightPx] = useState(20);
  /** 待机 / listening 使用随机片段，避免固定轮询顺序 */
  const [idleClipUrl, setIdleClipUrl] = useState(() => pickRandomIdleClipUrl());
  const prevStateForIdleRef = useRef<AvatarState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const prev = prevStateForIdleRef.current;
    prevStateForIdleRef.current = state;
    if (
      (state === "idle" || state === "listening") &&
      prev !== "idle" &&
      prev !== "listening"
    ) {
      setIdleClipUrl((cur) => pickRandomIdleClipUrl(cur));
    }
  }, [state]);

  /** 长时间停留在待机时，随机间隔换一段待机，更拟人 */
  useEffect(() => {
    if (state !== "idle" && state !== "listening") return;
    /** 拉长间隔，减少频繁换片解码带来的顿挫 */
    const delay = 22000 + Math.random() * 26000;
    const id = window.setTimeout(() => {
      setIdleClipUrl((cur) => pickRandomIdleClipUrl(cur));
    }, delay);
    return () => window.clearTimeout(id);
  }, [state, idleClipUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAvatarDebugEnabled()) return;
    const d = readAvatarDebugSessionDefaults();
    setDebugOpen(true);
    setBlackThreshold(d.blackThreshold);
    setEdgeFeather(d.edgeFeather);
    setDockWidthPx(d.dockWidthPx);
    setBottomPx(d.bottomPx);
    setRightPx(d.rightPx);
  }, []);

  useEffect(() => {
    if (state !== "greeting") greetingFiredRef.current = false;
    if (state !== "wrong") wrongFiredRef.current = false;
    if (state !== "correct") correctFiredRef.current = false;
  }, [state]);

  useEffect(() => {
    if (!mediaError || state !== "greeting") return;
    const t = window.setTimeout(() => {
      if (stateRef.current === "greeting" && !greetingFiredRef.current) {
        greetingFiredRef.current = true;
        onGreetingClipEnded();
      }
    }, AVATAR_DURATIONS_MS.greeting);
    return () => window.clearTimeout(t);
  }, [mediaError, state, onGreetingClipEnded]);

  useEffect(() => {
    if (!mediaError || state !== "wrong") return;
    const t = window.setTimeout(() => {
      if (stateRef.current === "wrong" && !wrongFiredRef.current) {
        wrongFiredRef.current = true;
        onWrongClipEnded();
      }
    }, AVATAR_DURATIONS_MS.feedback);
    return () => window.clearTimeout(t);
  }, [mediaError, state, onWrongClipEnded]);

  useEffect(() => {
    if (!mediaError || state !== "correct") return;
    if (!AVATAR_CLIP_URLS.correct || !onCorrectClipEnded) return;
    const t = window.setTimeout(() => {
      if (stateRef.current === "correct" && !correctFiredRef.current) {
        correctFiredRef.current = true;
        onCorrectClipEnded();
      }
    }, AVATAR_DURATIONS_MS.feedback);
    return () => window.clearTimeout(t);
  }, [mediaError, state, onCorrectClipEnded]);

  const src = resolveAvatarSessionVideoSrc(state, idleClipUrl);
  const nativeLoop = useNativeLoopForState(state);

  const [clipReady, setClipReady] = useState(false);

  useEffect(() => {
    setMediaError(false);
    setClipReady(false);
  }, [src]);

  useEffect(() => {
    if (clipReady) return;
    const t = window.setTimeout(() => {
      setMediaError(true);
    }, CLIP_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [src, clipReady]);

  useEffect(() => {
    if (state !== "greeting") return;
    const t = window.setTimeout(() => {
      if (stateRef.current === "greeting" && !greetingFiredRef.current) {
        greetingFiredRef.current = true;
        onGreetingClipEnded();
      }
    }, GREETING_MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [state, onGreetingClipEnded]);

  useEffect(() => {
    if (state !== "wrong") return;
    const t = window.setTimeout(() => {
      if (stateRef.current === "wrong" && !wrongFiredRef.current) {
        wrongFiredRef.current = true;
        onWrongClipEnded();
      }
    }, WRONG_MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [state, onWrongClipEnded]);

  const handleEnded = useCallback(() => {
    const st = stateRef.current;

    if (st === "greeting" && !greetingFiredRef.current) {
      greetingFiredRef.current = true;
      onGreetingClipEnded();
      return;
    }

    if (st === "speaking") {
      const el = canvasHostRef.current?.getVideoElement();
      if (el) {
        el.currentTime = 0;
        void el.play().catch(() => {});
      }
      return;
    }

    if (st === "wrong" && !wrongFiredRef.current) {
      wrongFiredRef.current = true;
      onWrongClipEnded();
      return;
    }

    if (
      st === "correct" &&
      AVATAR_CLIP_URLS.correct &&
      onCorrectClipEnded &&
      !correctFiredRef.current
    ) {
      correctFiredRef.current = true;
      onCorrectClipEnded();
    }
  }, [onGreetingClipEnded, onWrongClipEnded, onCorrectClipEnded]);

  return (
    <>
      <div className="quiz-avatar-dock-root">
        {mediaError ? (
          <div className="w-full rounded-lg border border-slate-200 bg-[var(--background)] p-3 text-center text-[11px] text-slate-600">
            <UserRound
              className="mx-auto mb-1 h-8 w-8 text-slate-300"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="font-medium text-slate-700">主持人视频未就绪</p>
            <p className="mt-1 text-slate-500">
              请将 MP4 放入{" "}
              <code className="rounded bg-slate-100 px-1">public/avatar/</code>
            </p>
          </div>
        ) : (
          <AvatarVideoCanvas
            ref={canvasHostRef}
            src={src}
            loop={nativeLoop}
            blackThreshold={blackThreshold}
            edgeFeather={edgeFeather}
            renderMode="blackKey"
            className="quiz-avatar-video-canvas"
            width="100%"
            onEnded={handleEnded}
            onLoadedData={() => setClipReady(true)}
            onError={() => setMediaError(true)}
          />
        )}
      </div>

      {debugOpen ? (
        <AvatarVideoDebugPanel
          blackThreshold={blackThreshold}
          edgeFeather={edgeFeather}
          dockWidthPx={dockWidthPx}
          bottomPx={bottomPx}
          rightPx={rightPx}
          onBlackThresholdChange={setBlackThreshold}
          onEdgeFeatherChange={setEdgeFeather}
          onDockWidthChange={setDockWidthPx}
          onBottomChange={setBottomPx}
          onRightChange={setRightPx}
        />
      ) : null}
    </>
  );
}
