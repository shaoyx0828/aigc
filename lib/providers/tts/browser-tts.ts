import type { TTSProvider } from "./interface";
import {
  primeSpeechSynthesis,
  speakText,
  stopSpeak,
} from "@/lib/services/tts";

/** @deprecated 请使用 `primeSpeechSynthesis`（`@/lib/services/tts`） */
export function primeBrowserSpeech(): void {
  primeSpeechSynthesis();
}

/**
 * 兼容旧 `TTSProvider`：内部走统一 `speakText`（外部引擎或浏览器）。
 */
export class BrowserTTSProvider implements TTSProvider {
  speak(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return Promise.resolve();
    return speakText(trimmed, {
      style: "preschoolBoy",
      interrupt: true,
      segment: true,
    });
  }

  stop(): void {
    stopSpeak();
  }
}
