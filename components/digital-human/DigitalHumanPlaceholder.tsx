"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { AvatarState } from "@/lib/providers/avatar/interface";
import {
  DIGITAL_HUMAN_TARGET_WORLD_HEIGHT,
  type DigitalHumanMetrics,
} from "./DigitalHumanModel";

type Props = {
  avatarState?: AvatarState;
  onMetrics?: (m: DigitalHumanMetrics) => void;
  rootRef?: React.RefObject<any>;
};

/** 卡通皮克斯/乐园风：低粗糙 + 略高光，偏「胶皮玩偶」 */
const skinMat = {
  color: "#ffd4b8",
  roughness: 0.28,
  metalness: 0.05,
} as const;

const coatMat = {
  color: "#2563eb",
  roughness: 0.3,
  metalness: 0.12,
} as const;

const shoeMat = {
  color: "#1e3a5f",
  roughness: 0.35,
  metalness: 0.08,
} as const;

const hairMat = {
  color: "#3f2a1d",
  roughness: 0.55,
  metalness: 0.02,
} as const;

const eyeWhiteMat = {
  color: "#ffffff",
  roughness: 0.22,
  metalness: 0,
} as const;

const pupilMat = {
  color: "#0f172a",
  roughness: 0.35,
  metalness: 0,
} as const;

const cheekMat = {
  color: "#fb7185",
  roughness: 0.45,
  metalness: 0,
  emissive: "#fda4af",
  emissiveIntensity: 0.12,
} as const;

const bowMat = {
  color: "#e11d48",
  roughness: 0.32,
  metalness: 0.1,
} as const;

/**
 * GLB 缺失时：Q 版「乐园主持人」占位（大头、大眼、暖肤、亮外套），与镜头 metrics 管线一致。
 */
export function DigitalHumanPlaceholder({
  onMetrics,
  rootRef,
}: Props) {
  const innerOuterRef = useRef<any>(null);
  const outerRef = rootRef ?? innerOuterRef;
  const fitRef = useRef<any>(null);
  const animatedRef = useRef<any>(null);

  const layoutH = 3.38;
  const metricsH = DIGITAL_HUMAN_TARGET_WORLD_HEIGHT;
  const sy = metricsH / layoutH;

  useLayoutEffect(() => {
    let cancelled = false;

    const publishFromBox = () => {
      const g = fitRef.current;
      if (!g) return false;
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      const h = Math.max(0.05, b.max.y - b.min.y);
      const w = Math.max(0.05, b.max.x - b.min.x);
      const dep = Math.max(0.05, b.max.z - b.min.z);
      const centerWorldY = (b.min.y + b.max.y) / 2;
      onMetrics?.({
        height: h,
        width: w,
        depth: dep,
        centerWorldY,
        chestY: b.min.y + h * 0.58,
        headY: b.min.y + h * 0.88,
      });
      return true;
    };

    const publishAnalytical = () => {
      const h = metricsH;
      const w = 1.18 * sy;
      const d = 0.78 * sy;
      onMetrics?.({
        height: h,
        width: w,
        depth: d,
        centerWorldY: h * 0.5,
        chestY: h * 0.58,
        headY: h * 0.88,
      });
    };

    if (!publishFromBox()) {
      publishAnalytical();
      const id = requestAnimationFrame(() => {
        if (!cancelled) publishFromBox();
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [onMetrics, sy, metricsH]);

  return (
    <group ref={outerRef}>
      <group ref={fitRef}>
        <group ref={animatedRef} scale={[1, sy, 1]}>
          <mesh position={[0.24, 0.22, 0.06]} castShadow>
            <sphereGeometry args={[0.2, 20, 20]} />
            <meshStandardMaterial {...shoeMat} />
          </mesh>
          <mesh position={[-0.24, 0.22, 0.06]} castShadow>
            <sphereGeometry args={[0.2, 20, 20]} />
            <meshStandardMaterial {...shoeMat} />
          </mesh>

          <mesh position={[0, 0.92, 0]} castShadow>
            <capsuleGeometry args={[0.26, 0.52, 8, 16]} />
            <meshStandardMaterial {...coatMat} />
          </mesh>

          <mesh position={[0, 1.62, 0]} castShadow>
            <capsuleGeometry args={[0.46, 0.88, 10, 20]} />
            <meshStandardMaterial {...coatMat} />
          </mesh>

          <mesh position={[0, 2.72, 0.04]} castShadow>
            <sphereGeometry args={[0.68, 32, 32]} />
            <meshStandardMaterial {...skinMat} />
          </mesh>

          <mesh position={[0, 3.38, -0.12]} castShadow scale={[1.15, 0.62, 1.05]}>
            <sphereGeometry args={[0.58, 24, 24]} />
            <meshStandardMaterial {...hairMat} />
          </mesh>

          <mesh position={[0.26, 2.78, 0.58]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial {...eyeWhiteMat} />
          </mesh>
          <mesh position={[-0.26, 2.78, 0.58]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial {...eyeWhiteMat} />
          </mesh>
          <mesh position={[0.26, 2.76, 0.72]} castShadow>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial {...pupilMat} />
          </mesh>
          <mesh position={[-0.26, 2.76, 0.72]} castShadow>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial {...pupilMat} />
          </mesh>

          <mesh position={[0.42, 2.52, 0.48]} castShadow>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial {...cheekMat} />
          </mesh>
          <mesh position={[-0.42, 2.52, 0.48]} castShadow>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial {...cheekMat} />
          </mesh>

          <mesh position={[0, 3.52, 0.5]} castShadow rotation={[0.35, 0, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial {...bowMat} />
          </mesh>
          <mesh position={[-0.14, 3.48, 0.48]} castShadow>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial {...bowMat} />
          </mesh>
          <mesh position={[0.14, 3.48, 0.48]} castShadow>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial {...bowMat} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
