/**
 * STT 抽象：后续可接入云端识别、OpenAI Realtime 等。
 * 浏览器端推荐实现 `listenOnce`：一次点击完成拾音→识别→结束。
 */
export interface STTProvider {
  /**
   * 单次听写：开始监听麦克风，在识别到一段话语、超时或错误时结束并返回文本。
   * 返回空字符串表示用户未说话、拒绝授权或环境不支持。
   */
  listenOnce(): Promise<string>;
}
