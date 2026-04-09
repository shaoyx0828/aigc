/**
 * Live2D / 3D 吉祥物占位。
 *
 * 接入步骤（概念）：
 * 1. 将吉祥物模型与动画资源放入 public/ 或 CDN。
 * 2. 使用 Cubism / three.js 等运行时加载模型。
 * 3. 实现 AvatarProvider：setState 时切换 idle/speak/listen 动画状态；
 *    speaking 时根据 TTS 音频或 viseme 数据驱动口型。
 * 4. 用新组件替换 AvatarPresenter 内部「几何占位」层，保留外层布局与文案 props。
 */

import type { AvatarProvider, AvatarState } from "./avatar/interface";

export class Live2DAvatarPlaceholder implements AvatarProvider {
  setState(_state: AvatarState): void {
    console.warn("[Live2DAvatarPlaceholder] 未加载 Live2D 运行时。");
  }
}
