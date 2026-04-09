import type { TTSProvider } from "./interface";

/**
 * 占位：接入公司自研或第三方 HTTP TTS API。
 *
 * 接入步骤（示例）：
 * 1. 在环境变量中配置 TTS_ENDPOINT、API_KEY。
 * 2. 在 speak() 内 POST 文本，返回音频 URL 或二进制。
 * 3. 使用 Web Audio / HTMLAudioElement 播放，并在 ended 时 resolve Promise。
 * 4. 将此类注册为工厂默认实现以替换 BrowserTTSProvider。
 */
export class CustomHttpTTSProvider implements TTSProvider {
  speak(_text: string): Promise<void> {
    console.warn(
      "[CustomHttpTTSProvider] 未实现：请配置 TTS 服务后在此发起请求并播放音频。"
    );
    return Promise.resolve();
  }

  stop(): void {
    // 停止音频播放
  }
}
