"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AvatarState } from "@/lib/providers/avatar/interface";

type MouthMesh = { mesh: any; baseScaleY: number };
type EyelidMesh = { mesh: any; baseScaleY: number };
type MorphMouth = { mesh: any; indices: number[]; baseInfluences: number[] };

export type AvatarMotionControllerProps = {
  avatarState: AvatarState;
  /** 模型根节点（外层 group），由 MotionController 驱动姿态 */
  rootRef: React.RefObject<any>;
  /** GLTF scene：用于扫描 mouth/blink 的 mesh 或 morph targets */
  scene: any | null;
  /** 底座材质：用于 speaking/correct/wrong 的轻量脉冲反馈 */
  baseMaterialRef?: React.RefObject<any>;
};

function stateToMouthStrength(state: AvatarState) {
  switch (state) {
    case "speaking":
      return 1;
    case "listening":
      return 0.42;
    case "greeting":
      return 0.36;
    case "correct":
      return 0.32;
    case "wrong":
      return 0.24;
    default:
      return 0;
  }
}

function stateToBaseTint(state: AvatarState) {
  switch (state) {
    case "speaking":
      return new THREE.Color("#38bdf8"); // sky
    case "correct":
      return new THREE.Color("#22c55e"); // green
    case "wrong":
      return new THREE.Color("#fb7185"); // rose
    default:
      return new THREE.Color("#0f172a"); // slate
  }
}

export function AvatarMotionController({
  avatarState,
  rootRef,
  scene,
  baseMaterialRef,
}: AvatarMotionControllerProps) {
  const avatarStateRef = useRef<AvatarState>(avatarState);
  useEffect(() => {
    avatarStateRef.current = avatarState;
  }, [avatarState]);

  const mouthMeshesRef = useRef<MouthMesh[]>([]);
  const eyelidMeshesRef = useRef<EyelidMesh[]>([]);
  const morphMouthRef = useRef<MorphMouth[]>([]);

  useEffect(() => {
    if (!scene) return;
    const mouthMeshes: MouthMesh[] = [];
    const eyelids: EyelidMesh[] = [];
    const morphMouths: MorphMouth[] = [];

    scene.traverse((obj: any) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mesh = obj as any;
      const name = (mesh.name || "").toLowerCase();

      const isMouth =
        name.includes("mouth") ||
        name.includes("jaw") ||
        name.includes("lips") ||
        name.includes("lip");
      if (isMouth) mouthMeshes.push({ mesh, baseScaleY: mesh.scale.y || 1 });

      const isEye =
        name.includes("eye") || name.includes("eyelid") || name.includes("blink");
      const isLid =
        name.includes("lid") || name.includes("eyelid") || name.includes("blink");
      if (isEye && isLid) eyelids.push({ mesh, baseScaleY: mesh.scale.y || 1 });

      const morphDict = (mesh as any).morphTargetDictionary as
        | Record<string, number>
        | undefined;
      const morphInfluences = (mesh as any).morphTargetInfluences as number[] | undefined;
      if (morphDict && morphInfluences) {
        const keys = Object.keys(morphDict);
        const mouthKeys = keys.filter((k) => {
          const kk = k.toLowerCase();
          return kk.includes("mouth") || kk.includes("jaw") || kk.includes("lip");
        });
        if (mouthKeys.length) {
          const indices = mouthKeys.map((k) => morphDict[k]).filter((i) => i >= 0);
          if (indices.length) {
            morphMouths.push({
              mesh,
              indices,
              baseInfluences: indices.map((i) => morphInfluences[i] ?? 0),
            });
          }
        }
      }
    });

    mouthMeshesRef.current = mouthMeshes;
    eyelidMeshesRef.current = eyelids;
    morphMouthRef.current = morphMouths;
  }, [scene]);

  const mouthStrengthRef = useRef(0);

  const blinkRef = useRef<{
    initialized: boolean;
    nextAt: number;
    blinkStartAt: number;
    duration: number;
    blinking: boolean;
  }>({
    initialized: false,
    nextAt: 0,
    blinkStartAt: 0,
    duration: 0.18,
    blinking: false,
  });

  // greeting 的“欢迎动作”做一个短暂的 envelope（避免靠页面定时器影响帧内表现）
  const greetingRef = useRef<{ startAt: number | null }>({ startAt: null });
  useEffect(() => {
    if (avatarState === "greeting") greetingRef.current.startAt = null;
  }, [avatarState]);

  const baseTintIdle = useMemo(() => new THREE.Color("#0f172a"), []);

  /** 包络平滑：状态切换时高频项从 0 缓升，减轻「每道题刚开始」的剧烈抖动 */
  const oscBlendRef = useRef(1);
  const lastAvatarStateRef = useRef<AvatarState>(avatarState);
  const smFloatAmp = useRef(0.016);
  const smYawAmp = useRef(0.055);
  const smRollAmp = useRef(0.018);
  const smBaseLean = useRef(0.028);

  useFrame(({ clock }, delta) => {
    const root = rootRef.current;
    if (!root) return;

    const dt = Math.min(delta, 0.055);
    const t = clock.getElapsedTime();
    const st = avatarStateRef.current;

    if (lastAvatarStateRef.current !== st) {
      oscBlendRef.current = 0;
      lastAvatarStateRef.current = st;
    }
    oscBlendRef.current = Math.min(1, oscBlendRef.current + dt * 2.35);
    const osc =
      oscBlendRef.current *
      oscBlendRef.current *
      (3 - 2 * oscBlendRef.current);

    const lerpK = Math.min(1, dt * 3.6);

    // ========== 1) 姿态伪动画（略提高幅度 + idle 微位移，更灵动；机位仍对准包围盒中心） ==========
    const breathe = Math.sin(t * 0.9);
    const breathe2 = Math.sin(t * 1.65 + 0.7);
    const sway = Math.sin(t * 0.55);
    const swaySlow = Math.sin(t * 0.31 + 1.2);

    // idle：呼吸 + 慢摆 + 轻微俯仰变化（仍控制总位移）
    const idleFloat = 0.016;
    const idleYaw = 0.055;
    const idleRoll = 0.018;
    const idlePitchWiggle = Math.sin(t * 0.95 + 0.4) * 0.014;

    // speaking：更活跃 + 前倾 + 节奏点头 + 起伏（高频仍受 osc 约束）
    const speakFloat = 0.034;
    const speakYaw = 0.074;
    const speakRoll = 0.021;
    const speakLean = 0.108;
    const speakNod = Math.max(0, Math.sin(t * 10)) * 0.044;
    const speakBob = Math.sin(t * 5.2) * 0.007 + Math.sin(t * 7.3 + 1) * 0.0035;

    // listening：前倾 + 侧身 + 回应式点头 + 轻侧移
    const listenFloat = 0.023;
    const listenYaw = 0.048;
    const listenLean = 0.074;
    const listenNod = Math.sin(t * 2.4) * 0.03 + Math.sin(t * 4.1) * 0.008;
    const listenSwayX = Math.sin(t * 1.85 + 0.6) * 0.007;

    // correct：快速点头 + 略强的上扬感
    const correctBoost = Math.max(0, Math.sin(t * 8)) * 0.06;

    // wrong：摇头更明显一点
    const wrongShake = Math.sin(t * 9) * 0.088;

    // greeting：短暂欢迎（向前/上扬 + 轻点头），持续约 0.7s，之后自动回到常规状态（由页面状态机负责切换）
    let greetAmt = 0;
    if (st === "greeting") {
      if (greetingRef.current.startAt === null) greetingRef.current.startAt = t;
      const p = Math.min(1, (t - (greetingRef.current.startAt ?? t)) / 0.7);
      const ease = p < 0.5 ? p / 0.5 : (1 - p) / 0.5; // 三角 envelope
      greetAmt = ease;
    }

    const floatAmp =
      st === "speaking"
        ? speakFloat
        : st === "listening"
          ? listenFloat
          : st === "correct"
            ? 0.028
            : st === "wrong"
              ? 0.022
              : st === "greeting"
                ? 0.026
                : idleFloat;

    smFloatAmp.current = THREE.MathUtils.lerp(
      smFloatAmp.current,
      floatAmp,
      lerpK
    );

    root.position.y =
      breathe * smFloatAmp.current +
      (st === "idle" ? breathe2 * idleFloat * 0.42 : 0) +
      (st === "speaking" ? speakBob * osc : 0) +
      (st === "correct" ? 0.02 * osc : 0) +
      greetAmt * 0.026;

    // yaw/roll
    const yawAmp =
      st === "speaking"
        ? speakYaw
        : st === "listening"
          ? listenYaw
          : st === "wrong"
            ? 0.036
            : st === "greeting"
              ? 0.062
              : idleYaw;

    smYawAmp.current = THREE.MathUtils.lerp(smYawAmp.current, yawAmp, lerpK);

    root.rotation.y =
      sway * smYawAmp.current +
      (st === "idle" ? swaySlow * idleYaw * 0.52 : 0) +
      (st === "wrong" ? wrongShake * osc : 0);

    const rollAmp =
      st === "speaking"
        ? speakRoll
        : st === "greeting"
          ? 0.014
          : idleRoll;

    smRollAmp.current = THREE.MathUtils.lerp(smRollAmp.current, rollAmp, lerpK);

    root.rotation.z =
      Math.sin(t * 0.6) * smRollAmp.current * (st === "idle" ? 1 : osc) +
      (st === "listening" ? Math.sin(t * 1.1) * 0.017 * osc : 0) +
      (st === "speaking" ? Math.sin(t * 2.2 + 0.3) * 0.009 * osc : 0);

    // pitch（前倾/点头/反馈）
    const baseLean =
      st === "speaking"
        ? speakLean
        : st === "listening"
          ? listenLean
          : st === "greeting"
            ? 0.09
            : 0.032;

    smBaseLean.current = THREE.MathUtils.lerp(smBaseLean.current, baseLean, lerpK);

    const pitchOscAmp = st === "speaking" ? 0.026 : st === "listening" ? 0.022 : 0.018;

    root.rotation.x =
      Math.sin(t * (st === "speaking" ? 2.05 : st === "listening" ? 1.05 : 0.85)) *
        pitchOscAmp *
        osc +
      smBaseLean.current +
      (st === "idle" ? idlePitchWiggle : 0) +
      (st === "speaking" ? speakNod * osc : 0) +
      (st === "listening" ? listenNod * osc : 0) +
      (st === "correct" ? correctBoost * osc : 0) +
      (st === "wrong" ? 0.02 * osc : 0) +
      greetAmt * 0.032;

    // idle：很轻的前后重心移；wrong：略大的左右位移
    if (st === "wrong") {
      root.position.x = Math.sin(t * 12) * 0.017 * osc;
    } else if (st === "idle") {
      root.position.x = THREE.MathUtils.lerp(
        root.position.x ?? 0,
        Math.sin(t * 0.38) * 0.018 + Math.sin(t * 0.71 + 1.1) * 0.006,
        0.09
      );
    } else if (st === "speaking") {
      const sx = Math.sin(t * 3.05) * 0.008 * osc + Math.sin(t * 1.15) * 0.004 * osc;
      root.position.x = THREE.MathUtils.lerp(root.position.x ?? 0, sx, 0.22);
    } else if (st === "listening") {
      root.position.x = THREE.MathUtils.lerp(
        root.position.x ?? 0,
        listenSwayX * osc,
        0.18
      );
    } else {
      root.position.x = THREE.MathUtils.lerp(root.position.x ?? 0, 0, 0.12 + osc * 0.06);
    }

    // ========== 2) 伪口型 + 眨眼 ==========
    const mouthTarget = stateToMouthStrength(st);
    mouthStrengthRef.current = THREE.MathUtils.lerp(
      mouthStrengthRef.current,
      mouthTarget,
      st === "speaking" || st === "listening" ? 0.28 : 0.18
    );
    const m = mouthStrengthRef.current;

    for (const item of mouthMeshesRef.current) {
      item.mesh.scale.y = item.baseScaleY * (1 + m * 0.54);
    }
    for (const item of morphMouthRef.current) {
      for (let i = 0; i < item.indices.length; i++) {
        const idx = item.indices[i];
        const base = item.baseInfluences[i] ?? 0;
        const target = base + m * 0.8;
        (item.mesh as any).morphTargetInfluences[idx] = THREE.MathUtils.lerp(
          (item.mesh as any).morphTargetInfluences[idx] ?? base,
          target,
          0.25
        );
      }
    }

    // blink：只要有 eyelid mesh 就做轻眨眼
    const eyelids = eyelidMeshesRef.current;
    if (eyelids.length > 0) {
      if (!blinkRef.current.initialized) {
        blinkRef.current.initialized = true;
        blinkRef.current.nextAt = t + THREE.MathUtils.randFloat(2.2, 4.4);
      }
      if (!blinkRef.current.blinking && t >= blinkRef.current.nextAt) {
        blinkRef.current.blinking = true;
        blinkRef.current.blinkStartAt = t;
      }
      if (blinkRef.current.blinking) {
        const p = (t - blinkRef.current.blinkStartAt) / blinkRef.current.duration;
        const closeAmt = p < 0.5 ? p / 0.5 : (1 - p) / 0.5;
        const w = THREE.MathUtils.lerp(1, 0.12, closeAmt);
        for (const item of eyelids) item.mesh.scale.y = item.baseScaleY * w;
        if (p >= 1) {
          blinkRef.current.blinking = false;
          blinkRef.current.nextAt = t + THREE.MathUtils.randFloat(2.0, 5.0);
        }
      } else {
        for (const item of eyelids) item.mesh.scale.y = item.baseScaleY;
      }
    }

    // ========== 3) 底座轻量反馈（脉冲/颜色） ==========
    const mat = baseMaterialRef?.current;
    if (mat) {
      const tint = stateToBaseTint(st);
      const pulse =
        st === "speaking"
          ? 0.08 + Math.max(0, Math.sin(t * 6)) * 0.06
          : st === "correct"
            ? 0.1 + Math.max(0, Math.sin(t * 10)) * 0.06
            : st === "wrong"
              ? 0.09 + Math.max(0, Math.sin(t * 10)) * 0.05
              : 0.08;
      // 维持“轻”的存在感：只调 opacity 和 color，不做强发光
      mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 0.08, pulse, 0.12);
      if (mat.color?.lerp) mat.color.lerp(st === "idle" ? baseTintIdle : tint, 0.12);
    }
  });

  return null;
}

