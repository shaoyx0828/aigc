"use client";

import {
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { cn } from "@/lib/utils";

const DEFAULT_BLACK_THRESHOLD = 32;
/** 略宽羽化，减轻黑底抠像后的硬边 / 黑线感 */
const DEFAULT_EDGE_FEATHER = 38;
/** 略降分辨率减轻每帧 getImageData + 泛洪开销，肉眼在 Dock 尺寸下差异不大 */
const DEFAULT_MAX_PROCESS_WIDTH = 448;
/** 与 `globals.css` :root --background (#f8fafc) 一致，用于边缘去溢色（半透明处混黑会发灰） */
const KEY_MATTE_R = 248;
const KEY_MATTE_G = 250;
const KEY_MATTE_B = 252;
/** 边框「播种」比连通阈值更严：避免略暗的底边误把人物连成背景；略小于 blackThreshold */
const BORDER_SEED_MARGIN = 10;

/** 复用泛洪缓冲区，避免每帧 new TypedArray 触发 GC 卡顿 */
const floodPool = {
  cap: 0,
  mxArr: null as Uint8Array | null,
  reachable: null as Uint8Array | null,
  q: null as Int32Array | null,
};

function ensureFloodPool(n: number): {
  mxArr: Uint8Array;
  reachable: Uint8Array;
  q: Int32Array;
} {
  if (floodPool.cap < n) {
    floodPool.cap = n;
    floodPool.mxArr = new Uint8Array(n);
    floodPool.reachable = new Uint8Array(n);
    floodPool.q = new Int32Array(n);
  }
  return {
    mxArr: floodPool.mxArr!,
    reachable: floodPool.reachable!,
    q: floodPool.q!,
  };
}

/** 轮廓去黑线：不透明但 RGB 仍偏暗、且邻接半透明背景的像素，向页面底色收敛 */
const despillPool = { capBytes: 0, snap: null as Uint8ClampedArray | null };

function ensureDespillSnap(byteLen: number): Uint8ClampedArray {
  if (despillPool.capBytes < byteLen) {
    despillPool.capBytes = byteLen;
    despillPool.snap = new Uint8ClampedArray(byteLen);
  }
  return despillPool.snap!;
}

function despillDarkOutlineEdges(
  d: Uint8ClampedArray,
  dw: number,
  dh: number
) {
  const byteLen = d.length;
  const snap = ensureDespillSnap(byteLen);
  snap.set(d);

  const OPAQUE_LO = 248;
  const NEIGHBOR_SOFT = 242;
  const DARK_MX = 128;
  const k = 0.74;

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const p = (y * dw + x) * 4;
      if (snap[p + 3]! < OPAQUE_LO) continue;

      const mx = Math.max(snap[p]!, snap[p + 1]!, snap[p + 2]!);
      if (mx > DARK_MX) continue;

      let nearSoft = false;
      if (y > 0 && snap[p - dw * 4 + 3]! < NEIGHBOR_SOFT) nearSoft = true;
      else if (y + 1 < dh && snap[p + dw * 4 + 3]! < NEIGHBOR_SOFT)
        nearSoft = true;
      else if (x > 0 && snap[p - 4 + 3]! < NEIGHBOR_SOFT) nearSoft = true;
      else if (x + 1 < dw && snap[p + 4 + 3]! < NEIGHBOR_SOFT) nearSoft = true;

      if (!nearSoft) continue;

      d[p] = Math.round(snap[p]! * (1 - k) + KEY_MATTE_R * k);
      d[p + 1] = Math.round(snap[p + 1]! * (1 - k) + KEY_MATTE_G * k);
      d[p + 2] = Math.round(snap[p + 2]! * (1 - k) + KEY_MATTE_B * k);
    }
  }
}

export type AvatarVideoCanvasRenderMode = "blackKey" | "passthrough";

export type AvatarVideoCanvasProps = {
  src: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** 最大 RGB 分量低于此值视为背景内核（0–255），默认约 32 */
  blackThreshold?: number;
  /** 阈值～阈值+feather 之间线性过渡 alpha，柔化边缘 */
  edgeFeather?: number;
  /** 处理时最大宽度，降采样减轻 getImageData 压力 */
  maxProcessWidth?: number;
  /**
   * blackKey：按阈值去黑底；passthrough：仅 drawImage，预留给透明 WebM / PNG 序列。
   */
  renderMode?: AvatarVideoCanvasRenderMode;
  className?: string;
  style?: React.CSSProperties;
  canvasClassName?: string;
  onEnded?: () => void;
  onLoadedData?: () => void;
  onError?: () => void;
};

export type AvatarVideoCanvasHandle = {
  /** 暴露内部 video，便于外层与答题状态机同步 currentTime / play */
  getVideoElement: () => HTMLVideoElement | null;
};

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * 用 max(R,G,B) 判断「近黑」：纯黑底接近 0；略亮的头发/阴影往往仍高于窄阈值区，可减少误伤。
 * alpha：mx <= T → 0；T < mx < T+F → 线性；mx >= T+F → 255。
 */
function alphaFromBlackKey(
  r: number,
  g: number,
  b: number,
  threshold: number,
  feather: number
): number {
  const mx = Math.max(r, g, b);
  if (mx <= threshold) return 0;
  const hi = threshold + feather;
  if (mx >= hi) return 255;
  return Math.round(((mx - threshold) / feather) * 255);
}

/**
 * 黑底抠像：从四边「播种」泛洪，仅去除与边缘连通的近黑背景。
 * （曾用全局阈值函数名 `applyBlackKeyToBuffer`，保留此名以免热更新/缓存仍引用旧符号。）
 * 眼珠、口腔等内部黑色不与边框连通，保留不透明。
 */
function applyBlackKeyToBuffer(
  imageData: ImageData,
  threshold: number,
  feather: number
) {
  const d = imageData.data;
  const dw = imageData.width;
  const dh = imageData.height;
  const n = dw * dh;
  if (n < 1) return;

  const seedT = Math.max(4, threshold - BORDER_SEED_MARGIN);
  const { mxArr, reachable, q } = ensureFloodPool(n);
  reachable.fill(0);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    mxArr[i] = Math.max(d[p]!, d[p + 1]!, d[p + 2]!);
  }

  let head = 0;
  let tail = 0;

  const at = (x: number, y: number) => y * dw + x;

  const trySeed = (i: number) => {
    if (reachable[i]) return;
    if (mxArr[i]! > seedT) return;
    reachable[i] = 1;
    q[tail++] = i;
  };

  for (let x = 0; x < dw; x++) {
    trySeed(at(x, 0));
    trySeed(at(x, dh - 1));
  }
  for (let y = 1; y < dh - 1; y++) {
    trySeed(at(0, y));
    trySeed(at(dw - 1, y));
  }

  while (head < tail) {
    const cur = q[head++]!;
    const x = cur % dw;
    const y = (cur / dw) | 0;

    if (x > 0) {
      const ni = cur - 1;
      if (!reachable[ni] && mxArr[ni]! <= threshold) {
        reachable[ni] = 1;
        q[tail++] = ni;
      }
    }
    if (x + 1 < dw) {
      const ni = cur + 1;
      if (!reachable[ni] && mxArr[ni]! <= threshold) {
        reachable[ni] = 1;
        q[tail++] = ni;
      }
    }
    if (y > 0) {
      const ni = cur - dw;
      if (!reachable[ni] && mxArr[ni]! <= threshold) {
        reachable[ni] = 1;
        q[tail++] = ni;
      }
    }
    if (y + 1 < dh) {
      const ni = cur + dw;
      if (!reachable[ni] && mxArr[ni]! <= threshold) {
        reachable[ni] = 1;
        q[tail++] = ni;
      }
    }
  }

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (!reachable[i]) {
      d[p + 3] = 255;
      continue;
    }
    const a = alphaFromBlackKey(
      d[p]!,
      d[p + 1]!,
      d[p + 2]!,
      threshold,
      feather
    );
    d[p + 3] = a;
    if (a <= 0) {
      d[p] = KEY_MATTE_R;
      d[p + 1] = KEY_MATTE_G;
      d[p + 2] = KEY_MATTE_B;
      continue;
    }
    if (a < 255) {
      const t = a / 255;
      const towardMatte = 1 - t * t * t;
      d[p] = Math.round(
        d[p]! * (1 - towardMatte) + KEY_MATTE_R * towardMatte
      );
      d[p + 1] = Math.round(
        d[p + 1]! * (1 - towardMatte) + KEY_MATTE_G * towardMatte
      );
      d[p + 2] = Math.round(
        d[p + 2]! * (1 - towardMatte) + KEY_MATTE_B * towardMatte
      );
    }
  }

  despillDarkOutlineEdges(d, dw, dh);
}

export const AvatarVideoCanvas = forwardRef<
  AvatarVideoCanvasHandle,
  AvatarVideoCanvasProps
>(function AvatarVideoCanvas(
  {
    src,
    width,
    height,
    autoplay = true,
    loop = false,
    muted = true,
    blackThreshold = DEFAULT_BLACK_THRESHOLD,
    edgeFeather = DEFAULT_EDGE_FEATHER,
    maxProcessWidth = DEFAULT_MAX_PROCESS_WIDTH,
    renderMode = "blackKey",
    className,
    style,
    canvasClassName,
    onEnded,
    onLoadedData,
    onError,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const rvfcHandleRef = useRef<number>(0);
  const useRvfcRef = useRef(false);
  const stoppedRef = useRef(true);

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw < 2 || vh < 2) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let dw = vw;
    let dh = vh;
    if (dw > maxProcessWidth) {
      dh = Math.round((vh * maxProcessWidth) / vw);
      dw = maxProcessWidth;
    }

    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }

    ctx.drawImage(video, 0, 0, dw, dh);

    if (renderMode === "blackKey") {
      const imageData = ctx.getImageData(0, 0, dw, dh);
      applyBlackKeyToBuffer(imageData, blackThreshold, edgeFeather);
      ctx.putImageData(imageData, 0, 0);
    }
  }, [blackThreshold, edgeFeather, maxProcessWidth, renderMode]);

  const scheduleNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    const video = videoRef.current as VideoWithRvfc | null;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const v = video as VideoWithRvfc;
    const isLoop = loop;

    stoppedRef.current = false;
    let started = false;

    const cancelScheduled = () => {
      if (useRvfcRef.current && typeof v.cancelVideoFrameCallback === "function") {
        v.cancelVideoFrameCallback(rvfcHandleRef.current);
      } else {
        cancelAnimationFrame(rafRef.current);
      }
    };

    const tick = () => {
      if (stoppedRef.current) return;

      if (video.paused && !video.ended) {
        return;
      }
      if (video.ended && !isLoop) {
        return;
      }

      drawFrame();

      if (typeof v.requestVideoFrameCallback === "function") {
        useRvfcRef.current = true;
        rvfcHandleRef.current = v.requestVideoFrameCallback(() => {
          scheduleNextRef.current();
        });
      } else {
        useRvfcRef.current = false;
        rafRef.current = requestAnimationFrame(() => {
          scheduleNextRef.current();
        });
      }
    };

    scheduleNextRef.current = () => {
      if (stoppedRef.current) return;
      tick();
    };

    const kick = () => {
      if (stoppedRef.current || started) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      started = true;
      scheduleNextRef.current();
    };

    const onPause = () => {
      cancelScheduled();
    };

    const onPlay = () => {
      if (stoppedRef.current) return;
      started = true;
      scheduleNextRef.current();
    };

    video.addEventListener("loadeddata", kick);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      kick();
    }

    return () => {
      stoppedRef.current = true;
      cancelScheduled();
      video.removeEventListener("loadeddata", kick);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [src, drawFrame, loop]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.src = src;
    video.loop = loop;
    video.muted = muted;
    video.load();
    if (autoplay) {
      void video.play().catch(() => {});
    }
  }, [src, loop, muted, autoplay]);

  const wrapStyle: React.CSSProperties = {
    width: width ?? undefined,
    height: height ?? undefined,
    ...style,
  };

  return (
    <div
      className={cn("relative inline-block max-w-full bg-transparent", className)}
      style={wrapStyle}
    >
      <div className="grid place-items-center bg-transparent">
        <video
          ref={videoRef}
          className="col-start-1 row-start-1 max-h-full max-w-full object-contain opacity-0"
          playsInline
          muted={muted}
          loop={loop}
          autoPlay={autoplay}
          preload="auto"
          controls={false}
          disablePictureInPicture
          onEnded={onEnded}
          onLoadedData={onLoadedData}
          onError={onError}
          aria-hidden
          style={{ touchAction: "none", pointerEvents: "none" }}
        />
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="数字人"
          className={cn(
            "col-start-1 row-start-1 z-[1] max-h-full max-w-full object-contain select-none transform-gpu",
            canvasClassName
          )}
          style={{ touchAction: "none", pointerEvents: "none" }}
        />
      </div>
    </div>
  );
});

AvatarVideoCanvas.displayName = "AvatarVideoCanvas";
