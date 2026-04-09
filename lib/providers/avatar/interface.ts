/**
 * 数字人展示状态（统一给 2D/3D、TTS/STT、判分结果联动）。
 * 说明：
 * - idle：默认待机
 * - speaking：系统正在播报题目（TTS）
 * - listening：等待用户语音回答（STT）
 * - correct：本题答对反馈
 * - wrong：本题答错反馈
 */
export type AvatarState =
  | "idle"
  | "greeting"
  | "speaking"
  | "listening"
  | "correct"
  | "wrong";

/**
 * 数字人驱动抽象：后续可接 Live2D/3D 运行时，将 setState 映射为动画与唇形。
 */
export interface AvatarProvider {
  setState(state: AvatarState): void;
}
