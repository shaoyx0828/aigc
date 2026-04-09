import type { AvatarProvider, AvatarState } from "./interface";

/**
 * 本地占位：仅维护状态，由 AvatarPresenter 根据状态渲染 UI。
 */
export class LocalAvatarProvider implements AvatarProvider {
  private state: AvatarState = "idle";
  private listener?: (s: AvatarState) => void;

  constructor(onChange?: (s: AvatarState) => void) {
    this.listener = onChange;
  }

  setState(state: AvatarState): void {
    this.state = state;
    this.listener?.(state);
  }

  getState(): AvatarState {
    return this.state;
  }
}
