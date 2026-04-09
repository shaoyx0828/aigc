"use client";

import React from "react";

/**
 * 3D 模型加载失败时的错误边界：
 * - useGLTF / 加载资源失败会在渲染阶段抛错，导致整个 Canvas 崩溃
 * - 我们捕获后显示一个占位网格，保证答题页可运行
 */
export class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; errorMessage?: string }
> {
  constructor(props: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          {this.props.fallback ?? (
            <mesh>
              <sphereGeometry args={[0.7, 32, 32]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          )}
        </>
      );
    }
    return this.props.children;
  }
}

