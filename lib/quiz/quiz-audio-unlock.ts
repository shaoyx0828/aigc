/**
 * 移动端 / 微信内置浏览器等环境下，语音与音频常在「无用户手势」时被静默拦截。
 * 桌面 Chrome 一般可直接朗读，返回 false。
 */
export function quizClientNeedsSpeechUnlock(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile|micromessenger|MicroMessenger/i.test(
    ua
  );
}
