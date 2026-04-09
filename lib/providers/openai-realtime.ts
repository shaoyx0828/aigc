/**
 * OpenAI Realtime API 占位模块（语音双向链路）。
 *
 * 后续接入思路：
 * 1. 在服务端建立与 OpenAI Realtime 的 WebSocket，浏览器与自家信令服务通信，避免暴露密钥。
 * 2. 将题目文本以「系统/助手」消息推给会话，用户侧走音频流输入。
 * 3. 在本项目中可把 TTSProvider/STTProvider 合并为 RealtimeVoiceProvider，
 *    或在答题页用单一 hook 管理连接状态，与 AvatarPresenter 的 speaking/listening 同步。
 * 4. 判题仍建议走现有 gradeAnswer，以免模型自由发挥篡改分数逻辑。
 *
 * 下方类型与空实现用于编译通过与文档化。
 */

export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface OpenAIRealtimeConfig {
  /** 由服务端下发的短期 token 或代理 URL，勿在前端硬编码 API Key */
  clientSecretUrl?: string;
  model?: string;
}

export class OpenAIRealtimeVoicePlaceholder {
  constructor(_config: OpenAIRealtimeConfig) {}

  async connect(): Promise<void> {
    throw new Error("OpenAI Realtime 未接入：请在服务端实现信令与代理后再启用。");
  }

  disconnect(): void {
    /* no-op */
  }
}
