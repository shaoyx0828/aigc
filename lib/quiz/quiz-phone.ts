/**
 * 答题身份用手机号：11 位数字、以 1 开头。
 * （不设第二位 3–9 限制，便于内测号如 111…；正式环境仍可在后台按真实号段筛数据。）
 */
export const QUIZ_PHONE_PATTERN = /^1\d{10}$/;

export const QUIZ_PHONE_HINT =
  "请输入 11 位数字，以 1 开头";

/** 公开展示用脱敏：重名时凭尾号区分，不暴露完整号码 */
export function maskPhoneForDisplay(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}****${d.slice(7)}`;
  if (d.length >= 8) return `${d.slice(0, 2)}****${d.slice(-4)}`;
  if (d.length >= 4) return `${d.slice(0, 1)}****${d.slice(-2)}`;
  return d.length > 0 ? "****" : "—";
}
