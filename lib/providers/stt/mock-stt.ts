import type { STTProvider } from "./interface";

/**
 * 无麦克风 / 不支持 Web Speech 时的回退：用 prompt 模拟识别结果。
 */
export class MockSTTProvider implements STTProvider {
  async listenOnce(): Promise<string> {
    if (typeof window === "undefined") return "";
    const text = window.prompt("【模拟语音识别】请输入识别到的文字：", "") ?? "";
    return text.trim();
  }
}
