import type { STTProvider } from "./interface";
import { BrowserWebSpeechSTTProvider } from "./browser-web-speech-stt";
import { MockSTTProvider } from "./mock-stt";

/** 当前环境是否可用浏览器语音识别（Web Speech API）。 */
export function isBrowserSpeechSttSupported(): boolean {
  if (typeof window === "undefined") return false;
  return BrowserWebSpeechSTTProvider.isSupported();
}

/** 客户端：支持则使用浏览器语音识别，否则回退 Mock。 */
export function createSttProvider(): STTProvider {
  if (typeof window === "undefined") return new MockSTTProvider();
  if (BrowserWebSpeechSTTProvider.isSupported()) {
    return new BrowserWebSpeechSTTProvider();
  }
  return new MockSTTProvider();
}

