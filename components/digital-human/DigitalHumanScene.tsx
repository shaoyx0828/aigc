"use client";

import { Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import { useThree } from "@react-three/fiber";
import {
  DIGITAL_HUMAN_TARGET_WORLD_HEIGHT,
  DigitalHumanModel,
  type DigitalHumanMetrics,
} from "./DigitalHumanModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";

/** 环境贴图单独 Suspense + 错误边界，避免加载 HDR 时卡住整棵 Canvas（表现为长时间空白）。 */
function SoftEnvironment() {
  return (
    <ModelErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <Environment preset="dawn" environmentIntensity={0.34} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
import type { AvatarState } from "@/lib/providers/avatar/interface";
import { cn } from "@/lib/utils";
import * as THREE from "three";
import { AvatarMotionController } from "./AvatarMotionController";
import { DigitalHumanPlaceholder } from "./DigitalHumanPlaceholder";

const MODEL_URL = "/models/digital-human.glb";

/** 无 GLB metrics 时的假定包围盒，与 `DIGITAL_HUMAN_TARGET_WORLD_HEIGHT` 一致，避免首帧机位乱跳 */
const FRAMING_FALLBACK_METRICS: DigitalHumanMetrics = {
  height: DIGITAL_HUMAN_TARGET_WORLD_HEIGHT,
  width: 1.12,
  depth: 0.88,
  centerWorldY: DIGITAL_HUMAN_TARGET_WORLD_HEIGHT * 0.5,
  chestY: DIGITAL_HUMAN_TARGET_WORLD_HEIGHT * 0.58,
  headY: DIGITAL_HUMAN_TARGET_WORLD_HEIGHT * 0.88,
};

/**
 * 按透视与包围盒自动算机位：相机 y 与 lookAt 均取 `metrics.centerWorldY`（世界空间真实垂直中心），
 * 保证人在画面垂直方向居中；距离以竖直填满为主，横向仅在窄画布上略增，且限制「横向」最多把相机拉远 ~18%。
 *
 * 【最终冻结】与 `.cursor/rules/digital-human-layout-frozen.mdc` 逐项一致；非用户明确要求禁止改动。
 */
function computeDigitalHumanCameraLayout(
  metrics: DigitalHumanMetrics,
  viewWidthPx: number,
  viewHeightPx: number
): { fovDeg: number; centerY: number; dist: number } {
  const FOV_DEG = 47;
  const vFovRad = THREE.MathUtils.degToRad(FOV_DEG);
  const aspect = Math.max(1e-6, viewWidthPx / Math.max(1, viewHeightPx));
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

  const h = Math.max(1e-6, metrics.height);
  const centerY =
    Number.isFinite(metrics.centerWorldY) && metrics.centerWorldY > -1e5
      ? metrics.centerWorldY
      : h * 0.5;

  const vertPad = 0.026;
  const vertHalfSpan = h * (0.5 + vertPad);
  const dVert = vertHalfSpan / Math.tan(vFovRad / 2);

  const horizHalfSpan =
    metrics.width * 0.5 +
    Math.max(h * 0.038, metrics.width * 0.042);
  const halfH = Math.min(hFovRad / 2, 1.52);
  const dHoriz = horizHalfSpan / Math.max(1e-6, Math.tan(halfH));

  let dist = Math.max(dVert, Math.min(dHoriz, dVert * 1.18));
  dist = THREE.MathUtils.clamp(dist, h * 0.48, h * 2.85);

  return { fovDeg: FOV_DEG, centerY, dist };
}

/** 状态轮廓光：偏童话/乐园感的高饱和点缀色 */
function stateToRimColor(state: AvatarState) {
  switch (state) {
    case "greeting":
      return "#fbbf24"; // 魔法金
    case "speaking":
      return "#7dd3fc"; // 童话天蓝
    case "listening":
      return "#86efac"; // 薄荷绿
    case "correct":
      return "#4ade80"; // 亮绿庆祝
    case "wrong":
      return "#fb923c"; // 暖橙（柔和，非警告红）
    default:
      return "#c4b5fd"; // 淡紫魔法边光
  }
}

function Lights() {
  return (
    <>
      {/* 主光：暖色键光，像舞台追光 */}
      <directionalLight
        position={[3.5, 7.5, 4]}
        intensity={1.15}
        color="#fff8f0"
        castShadow
      />
      {/* 补光：淡粉填充，减轻死黑 */}
      <directionalLight
        position={[-4, 2.5, 2]}
        intensity={0.38}
        color="#ffe8f5"
      />
      {/* 背顶柔光：勾勒头发轮廓 */}
      <directionalLight
        position={[0, 9, -2]}
        intensity={0.22}
        color="#fef3c7"
      />
      <ambientLight intensity={0.52} color="#faf5ff" />
    </>
  );
}

function SceneRig({
  metrics,
}: {
  metrics: DigitalHumanMetrics | null;
}) {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    const aspectPx =
      Math.max(1e-6, size.width) / Math.max(1, size.height);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = aspectPx;
      camera.near = 0.1;
      camera.far = 100;
    }

    const m =
      metrics &&
      Number.isFinite(metrics.height) &&
      metrics.height >= 0.01
        ? metrics
        : FRAMING_FALLBACK_METRICS;

    const { fovDeg, centerY, dist } = computeDigitalHumanCameraLayout(
      m,
      size.width,
      size.height
    );

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fovDeg;
      camera.updateProjectionMatrix();
    }

    camera.up.set(0, 1, 0);
    camera.position.set(0, centerY, dist);
    camera.lookAt(0, centerY, 0);
  }, [camera, metrics, size.height, size.width]);

  return null;
}

/** GLB 加载中 / HEAD 检测中：大号胶囊 + 上报近似 metrics，避免「小人漂在空白里」 */
function LoadingCapsuleMesh({
  onMetrics,
}: {
  onMetrics: (m: DigitalHumanMetrics) => void;
}) {
  const h = FRAMING_FALLBACK_METRICS.height;
  const r = 0.62;
  const len = Math.max(0.35, h - 2 * r);
  const cy = len / 2 + r;

  useLayoutEffect(() => {
    onMetrics({
      height: h,
      width: FRAMING_FALLBACK_METRICS.width,
      depth: FRAMING_FALLBACK_METRICS.depth,
      centerWorldY: h * 0.5,
      chestY: h * 0.58,
      headY: h * 0.88,
    });
  }, [onMetrics, h]);

  return (
    <mesh position={[0, cy, 0]} castShadow>
      <capsuleGeometry args={[r, len, 8, 18]} />
      <meshStandardMaterial
        color="#f5e6ff"
        roughness={0.42}
        metalness={0.06}
      />
    </mesh>
  );
}

/**
 * 先 HEAD 检测 GLB 是否存在：避免 404 时长时间 Suspense/空白；失败则用占位并上报 metrics 供镜头对齐。
 */
function GltfModelGate({
  avatarState,
  onMetrics,
  rootRef,
  onSceneReady,
}: {
  avatarState: AvatarState;
  onMetrics: (m: DigitalHumanMetrics) => void;
  rootRef: RefObject<any>;
  onSceneReady: (scene: any) => void;
}) {
  const [mode, setMode] = useState<"checking" | "file" | "missing">(
    "checking"
  );

  useEffect(() => {
    fetch(MODEL_URL, { method: "HEAD" })
      .then((r) => setMode(r.ok ? "file" : "missing"))
      .catch(() => setMode("missing"));
  }, []);

  if (mode === "checking") {
    return <LoadingCapsuleMesh onMetrics={onMetrics} />;
  }
  if (mode === "missing") {
    return (
      <DigitalHumanPlaceholder
        avatarState={avatarState}
        onMetrics={onMetrics}
        rootRef={rootRef}
      />
    );
  }
  return (
    <Suspense fallback={<LoadingCapsuleMesh onMetrics={onMetrics} />}>
      <ModelErrorBoundary
        fallback={
          <DigitalHumanPlaceholder
            avatarState={avatarState}
            onMetrics={onMetrics}
            rootRef={rootRef}
          />
        }
      >
        <DigitalHumanModel
          url={MODEL_URL}
          avatarState={avatarState}
          onMetrics={onMetrics}
          onSceneReady={onSceneReady}
          rootRef={rootRef}
        />
      </ModelErrorBoundary>
    </Suspense>
  );
}

function SceneContent({
  avatarState,
  onMetrics,
}: {
  avatarState: AvatarState;
  onMetrics: (m: DigitalHumanMetrics) => void;
}) {
  const rimColor = stateToRimColor(avatarState);
  const rimIntensity =
    avatarState === "greeting"
      ? 1.05
      : avatarState === "speaking"
      ? 1.25
      : avatarState === "listening"
        ? 0.95
        : avatarState === "correct"
          ? 1.1
          : avatarState === "wrong"
            ? 1.35
            : 0.8;

  const rootRef = useRef<any>(null);
  const [sceneObj, setSceneObj] = useState<any | null>(null);

  return (
    <>
      <Lights />
      <SoftEnvironment />

      {/* 轮廓光：让角色更“有主持感” */}
      <directionalLight
        position={[0, 6, -5]}
        intensity={rimIntensity}
        color={rimColor}
      />

      <GltfModelGate
        avatarState={avatarState}
        onMetrics={onMetrics}
        rootRef={rootRef}
        onSceneReady={setSceneObj}
      />

      <AvatarMotionController
        avatarState={avatarState}
        rootRef={rootRef}
        scene={sceneObj}
      />
    </>
  );
}

/**
 * 答题页顶部 3D 展示区：Canvas、灯光、相机、轨道控制。
 */
export function DigitalHumanScene({
  state,
  containerClassName,
}: {
  state: AvatarState;
  /** 侧栏等场景下覆盖默认宽高 */
  containerClassName?: string;
}) {
  const [metrics, setMetrics] = useState<DigitalHumanMetrics | null>(null);

  const handleMetrics = useCallback((m: DigitalHumanMetrics) => {
    setMetrics(m);
  }, []);

  // 【最终冻结】默认外层尺寸见 digital-human-layout-frozen.mdc；侧栏用 containerClassName 完全接管尺寸，避免与工具类高度冲突。
  return (
    <div
      className={cn(
        "w-full shrink-0 overflow-hidden bg-[var(--background)]",
        containerClassName
          ? containerClassName
          : "mx-auto h-[248px] max-w-md sm:h-[272px] lg:h-[296px]",
      )}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#f8fafc");
        }}
        camera={{
          position: [0, FRAMING_FALLBACK_METRICS.centerWorldY, 3.4],
          fov: 47,
          near: 0.1,
          far: 100,
        }}
      >
        <SceneRig metrics={metrics} />
        <SceneContent avatarState={state} onMetrics={handleMetrics} />
      </Canvas>
    </div>
  );
}

