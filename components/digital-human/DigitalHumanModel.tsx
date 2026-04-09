"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { AvatarState } from "@/lib/providers/avatar/interface";

const MODEL_URL = "/models/digital-human.glb";

/** 在 GLB 动画名中按子串匹配（兼容 Mixamo 等 `Armature|Wave` 命名） */
function findClipName(names: string[], hints: string[]): string | null {
  const lower = names.map((n) => n.toLowerCase());
  for (const h of hints) {
    const hi = h.toLowerCase();
    const i = lower.findIndex((n) => n.includes(hi));
    if (i >= 0) return names[i];
  }
  return null;
}

function clipForAvatarState(names: string[], state: AvatarState): string {
  if (!names.length) return "";
  const idle =
    findClipName(names, [
      "idle",
      "stand",
      "tpose",
      "t-pose",
      "breathing",
      "default",
    ]) ?? names[0];

  const byState: Record<AvatarState, string> = {
    idle,
    greeting:
      findClipName(names, ["wave", "greet", "hello", "welcome", "hi", "salute"]) ??
      idle,
    speaking: findClipName(names, ["talk", "speak", "speech", "speaking"]) ?? idle,
    listening: findClipName(names, ["listen", "listening"]) ?? idle,
    correct:
      findClipName(names, [
        "correct",
        "yes",
        "thumbs",
        "thumb",
        "nod",
        "celebrate",
        "victory",
        "clap",
      ]) ?? idle,
    wrong:
      findClipName(names, ["wrong", "no", "shake", "disagree", "sad", "refuse"]) ??
      idle,
  };
  return byState[state];
}

/** 【最终冻结】5.52 — 与 `.cursor/rules/digital-human-layout-frozen.mdc` 一致；非用户要求勿改 */
export const DIGITAL_HUMAN_TARGET_WORLD_HEIGHT = 5.52;

export type DigitalHumanMetrics = {
  /** 归一化后的模型高度（缩放后），单位：three 世界单位 */
  height: number;
  /** 缩放后的包围盒宽度（x） */
  width: number;
  /** 缩放后的包围盒深度（z） */
  depth: number;
  /**
   * 摆放后世界空间包围盒的垂直中心（y）。镜头用此对准画面垂直中心；
   * 若仅用手算 height/2 可能与实际网格/蒙皮包围盒不一致，导致人沉底或悬空。
   */
  centerWorldY: number;
  /** 角色胸口附近高度（世界 y，供灯光等） */
  chestY: number;
  /** 角色头顶附近高度（世界 y） */
  headY: number;
};

type DigitalHumanModelProps = {
  /** 可选：用于后续扩展多吉祥物/多模型切换 */
  url?: string;
  /** 与答题页状态同步：在 GLB 含对应动画名时切换挥手/对错等 clip（无匹配则回 idle） */
  avatarState?: AvatarState;
  /** 模型加载后/更新后回传包围盒信息（用于相机与舞台对齐） */
  onMetrics?: (m: DigitalHumanMetrics) => void;
  /** 透出 scene 供 MotionController 扫描口型/眨眼 targets（与加载逻辑解耦） */
  onSceneReady?: (scene: any) => void;
  /** 外部传入的根节点 ref（用于 MotionController 驱动） */
  rootRef?: React.RefObject<any>;
};

/**
 * 加载 GLB；可选按 `avatarState` 切换动画（clip 名模糊匹配）。
 * 未传 `avatarState` 时仍自动播放第一个 clip。
 * 若模型不存在，会抛错并由外层 ModelErrorBoundary 捕获。
 */
export function DigitalHumanModel({
  url = MODEL_URL,
  avatarState,
  onMetrics,
  onSceneReady,
  rootRef,
}: DigitalHumanModelProps) {
  // outer：外部可拿到 ref 进行程序化动作驱动
  const innerOuterRef = useRef<any>(null);
  const outerRef = rootRef ?? innerOuterRef;
  const fitRef = useRef<any>(null);
  const animatedRef = useRef<any>(null);

  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, animatedRef);
  const currentClipRef = useRef<string | null>(null);
  const lastAvatarStateRef = useRef<AvatarState | null>(null);

  /**
   * 自动对齐与缩放（不靠猜 position）：
   * - Box3 计算包围盒
   * - 水平居中（x/z）
   * - 脚底落到地面（y=0）
   * - 按目标高度自动缩放
   */
  useLayoutEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;

    // 骨骼/蒙皮未更新矩阵时 Box3 会失真，进而 scale/机位把模型送出视锥或触发错误剔除
    scene.updateMatrixWorld(true);
    // 以原始 scene 计算包围盒（不依赖外部摆放）
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const rawHeight = Math.max(1e-6, size.y);
    const targetHeight = DIGITAL_HUMAN_TARGET_WORLD_HEIGHT;
    const scale = targetHeight / rawHeight;

    // 缩放后再把脚底落到 y=0，且水平居中到原点
    const minY = box.min.y;
    fit.scale.setScalar(scale);
    fit.position.set(-center.x * scale, -minY * scale, -center.z * scale);
    fit.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);

    scene.traverse((obj: unknown) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mesh = obj as InstanceType<typeof THREE.Mesh>;
      mesh.frustumCulled = false;
      if (mesh instanceof THREE.SkinnedMesh && mesh.skeleton) {
        mesh.skeleton.update();
        mesh.geometry?.computeBoundingSphere();
      }
    });

    fit.updateMatrixWorld(true);
    const wb = new THREE.Box3().setFromObject(fit);
    const hAn = rawHeight * scale;
    const wAn = size.x * scale;
    const dAn = size.z * scale;
    const hW = wb.max.y - wb.min.y;
    const wW = wb.max.x - wb.min.x;
    const dW = wb.max.z - wb.min.z;
    const height = hW >= 0.02 ? hW : hAn;
    const width = wW >= 0.02 ? wW : wAn;
    const depth = dW >= 0.02 ? dW : dAn;
    const minWY = hW >= 0.02 ? wb.min.y : 0;
    const centerWorldY = hW >= 0.02 ? (wb.min.y + wb.max.y) / 2 : height * 0.5;

    const metrics: DigitalHumanMetrics = {
      height,
      width,
      depth,
      centerWorldY,
      chestY: minWY + height * 0.58,
      headY: minWY + height * 0.88,
    };
    onMetrics?.(metrics);
  }, [scene, onMetrics]);

  useEffect(() => {
    onSceneReady?.(scene);
  }, [scene, onSceneReady]);

  // 未接入口型状态时：只播第一个 clip（兼容旧用法）
  useEffect(() => {
    if (!names.length || avatarState !== undefined) return;
    const first = names[0];
    const clip = actions[first];
    clip?.reset().fadeIn(0.35).play();
    return () => clip?.fadeOut(0.25);
  }, [actions, names, avatarState]);

  // 按答题状态切换 GLB 内动画（需资源里确有对应 clip；否则回退 idle，仍由 AvatarMotionController 做程序化反馈）
  useEffect(() => {
    if (!names.length || avatarState === undefined) return;

    const target = clipForAvatarState(names, avatarState);
    if (!target) return;

    const next = actions[target];
    if (!next) return;

    const prevState = lastAvatarStateRef.current;
    lastAvatarStateRef.current = avatarState;

    const sameClip = currentClipRef.current === target;
    const oneShot =
      avatarState === "greeting" || avatarState === "correct" || avatarState === "wrong";
    const replay = oneShot && prevState !== avatarState;

    if (sameClip && !replay) return;

    if (sameClip && replay) {
      next.reset().fadeIn(0.22).play();
      return;
    }

    const prevName = currentClipRef.current;
    const prev = prevName ? actions[prevName] : null;
    prev?.fadeOut(0.32);
    next.reset().fadeIn(0.32).play();
    currentClipRef.current = target;
  }, [actions, avatarState, names]);

  return (
    <group ref={outerRef}>
      <group ref={fitRef}>
        <group ref={animatedRef}>
          <primitive object={scene} dispose={null} />
        </group>
      </group>
    </group>
  );
}

