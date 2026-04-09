import type { AvatarState } from "@/lib/providers/avatar/interface";

export type AvatarEvent =
  | { type: "PAGE_ENTER" }
  | { type: "GREETING_DONE" }
  | { type: "SPEAK_START" }
  | { type: "SPEAK_END" }
  | { type: "LISTEN_START" }
  | { type: "LISTEN_END" }
  | { type: "ANSWER_CORRECT" }
  | { type: "ANSWER_WRONG" }
  | { type: "FEEDBACK_DONE" }
  | { type: "RESET_IDLE" };

export type AvatarMachineState = {
  value: AvatarState;
  /**
   * 用于保护“短状态”的行为（例如 greeting/feedback）不被随意覆盖。
   * 例：greeting 期间来了 speak 请求，先标记 pendingSpeak，待 greeting 结束再进入 speaking。
   */
  pendingSpeak: boolean;
};

export const AVATAR_DURATIONS_MS = {
  greeting: 700,
  feedback: 900,
} as const;

export const avatarInitialState: AvatarMachineState = {
  value: "idle",
  pendingSpeak: false,
};

export function avatarReducer(
  state: AvatarMachineState,
  event: AvatarEvent
): AvatarMachineState {
  switch (event.type) {
    case "PAGE_ENTER":
      return { value: "greeting", pendingSpeak: false };

    case "SPEAK_START":
      if (state.value === "greeting") {
        return { ...state, pendingSpeak: true };
      }
      return { value: "speaking", pendingSpeak: false };

    case "SPEAK_END":
      if (state.value === "speaking") return { value: "listening", pendingSpeak: false };
      return state;

    case "LISTEN_START":
      if (state.value === "speaking") return state;
      return { value: "listening", pendingSpeak: false };

    case "LISTEN_END":
      if (state.value === "listening") return { value: "idle", pendingSpeak: false };
      return state;

    case "ANSWER_CORRECT":
      return { value: "correct", pendingSpeak: false };
    case "ANSWER_WRONG":
      return { value: "wrong", pendingSpeak: false };

    case "GREETING_DONE":
      if (state.value !== "greeting") return state;
      if (state.pendingSpeak) return { value: "speaking", pendingSpeak: false };
      return { value: "idle", pendingSpeak: false };

    case "FEEDBACK_DONE":
      if (state.value === "correct" || state.value === "wrong") {
        return { value: "idle", pendingSpeak: false };
      }
      return state;

    case "RESET_IDLE":
      return { value: "idle", pendingSpeak: false };

    default:
      return state;
  }
}

