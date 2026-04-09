"use client";

/**
 * 调试入口：URL ?avatarDebug=1 或 localStorage.setItem('avatarVideoDebug','1') 后刷新。
 * 可微调去黑底阈值与停靠尺寸，数值写入 sessionStorage 便于刷新保留。
 */
const SK = {
  black: "avatarDebugBlackThreshold",
  feather: "avatarDebugEdgeFeather",
  width: "avatarDebugDockWidth",
  bottom: "avatarDebugDockBottom",
  right: "avatarDebugDockRight",
} as const;

function readNum(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const v = sessionStorage.getItem(key);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type AvatarVideoDebugPanelProps = {
  blackThreshold: number;
  edgeFeather: number;
  dockWidthPx: number;
  bottomPx: number;
  rightPx: number;
  onBlackThresholdChange: (n: number) => void;
  onEdgeFeatherChange: (n: number) => void;
  onDockWidthChange: (n: number) => void;
  onBottomChange: (n: number) => void;
  onRightChange: (n: number) => void;
};

export function AvatarVideoDebugPanel({
  blackThreshold,
  edgeFeather,
  dockWidthPx,
  bottomPx,
  rightPx,
  onBlackThresholdChange,
  onEdgeFeatherChange,
  onDockWidthChange,
  onBottomChange,
  onRightChange,
}: AvatarVideoDebugPanelProps) {
  return (
    <div
      className="pointer-events-auto fixed left-2 top-16 z-[220] max-h-[min(80vh,420px)] w-[min(calc(100vw-16px),280px)] overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] shadow-xl backdrop-blur-sm"
      role="region"
      aria-label="数字人调试"
    >
      <p className="mb-2 font-semibold text-slate-800">数字人调试</p>
      <label className="mb-2 flex flex-col gap-0.5 text-slate-600">
        <span>blackThreshold（0–80）</span>
        <input
          type="range"
          min={0}
          max={80}
          value={blackThreshold}
          onChange={(e) => {
            const n = Number(e.target.value);
            onBlackThresholdChange(n);
            sessionStorage.setItem(SK.black, String(n));
          }}
          className="w-full"
        />
        <span className="font-mono text-slate-900">{blackThreshold}</span>
      </label>
      <label className="mb-2 flex flex-col gap-0.5 text-slate-600">
        <span>edgeFeather（0–56）</span>
        <input
          type="range"
          min={0}
          max={56}
          value={edgeFeather}
          onChange={(e) => {
            const n = Number(e.target.value);
            onEdgeFeatherChange(n);
            sessionStorage.setItem(SK.feather, String(n));
          }}
          className="w-full"
        />
        <span className="font-mono text-slate-900">{edgeFeather}</span>
      </label>
      <label className="mb-2 flex flex-col gap-0.5 text-slate-600">
        <span>宽度 px（240–420）</span>
        <input
          type="range"
          min={240}
          max={420}
          value={dockWidthPx}
          onChange={(e) => {
            const n = Number(e.target.value);
            onDockWidthChange(n);
            sessionStorage.setItem(SK.width, String(n));
          }}
          className="w-full"
        />
        <span className="font-mono text-slate-900">{dockWidthPx}</span>
      </label>
      <label className="mb-2 flex flex-col gap-0.5 text-slate-600">
        <span>距底 px（56–220）</span>
        <input
          type="range"
          min={56}
          max={220}
          value={bottomPx}
          onChange={(e) => {
            const n = Number(e.target.value);
            onBottomChange(n);
            sessionStorage.setItem(SK.bottom, String(n));
          }}
          className="w-full"
        />
        <span className="font-mono text-slate-900">{bottomPx}</span>
      </label>
      <label className="mb-1 flex flex-col gap-0.5 text-slate-600">
        <span>距右 px（4–48）</span>
        <input
          type="range"
          min={4}
          max={48}
          value={rightPx}
          onChange={(e) => {
            const n = Number(e.target.value);
            onRightChange(n);
            sessionStorage.setItem(SK.right, String(n));
          }}
          className="w-full"
        />
        <span className="font-mono text-slate-900">{rightPx}</span>
      </label>
      <p className="mt-2 leading-relaxed text-slate-500">
        关闭：去掉 URL 参数并执行{" "}
        <code className="rounded bg-slate-100 px-0.5">localStorage.removeItem(&apos;avatarVideoDebug&apos;)</code>
      </p>
    </div>
  );
}

export function readAvatarDebugSessionDefaults() {
  return {
    blackThreshold: readNum(SK.black, 32),
    edgeFeather: readNum(SK.feather, 38),
    dockWidthPx: readNum(SK.width, 360),
    bottomPx: readNum(SK.bottom, 176),
    rightPx: readNum(SK.right, 20),
  };
}

export function isAvatarDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("avatarVideoDebug") === "1") return true;
    return new URLSearchParams(window.location.search).get("avatarDebug") === "1";
  } catch {
    return false;
  }
}
