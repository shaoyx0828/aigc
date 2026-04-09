/** 外部 TTS 失败分类，便于调试面板展示（非静默吞掉）。 */

export type ExternalTtsErrorCode =
  | "ABORT_TIMEOUT"
  /** 新的播报或 stopSpeak 打断了本次请求，不应触发熔断或浏览器回退 */
  | "SUPERSEDED"
  | "NETWORK"
  | "HTTP_ERROR"
  | "HTTP_ERROR_BODY"
  | "JSON_MISSING_AUDIO_URL"
  | "JSON_SERVER_ERROR"
  | "INVALID_AUDIO_BODY"
  | "AUDIO_PLAY_ELEMENT"
  | "AUDIO_PLAY_REJECTED"
  | "UNKNOWN";

export class ExternalTtsError extends Error {
  readonly code: ExternalTtsErrorCode;
  readonly httpStatus?: number;
  readonly contentType?: string;
  readonly responseSnippet?: string;

  constructor(
    code: ExternalTtsErrorCode,
    message: string,
    init?: {
      httpStatus?: number;
      contentType?: string;
      responseSnippet?: string;
    }
  ) {
    super(message);
    this.name = "ExternalTtsError";
    this.code = code;
    this.httpStatus = init?.httpStatus;
    this.contentType = init?.contentType;
    this.responseSnippet = init?.responseSnippet;
  }
}

export function isExternalTtsError(e: unknown): e is ExternalTtsError {
  return e instanceof ExternalTtsError;
}

function clip(s: string, max = 220): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function readResponseSnippet(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = (await res.clone().json()) as Record<string, unknown>;
      // 注意：调试面板/解析逻辑会尝试 JSON.parse(snippet)。
      // 这里必须返回“可解析的 JSON 字符串”，不能在 JSON 外部追加省略号导致 parse 失败。
      const codeRaw = j.code;
      const code =
        typeof codeRaw === "string" || typeof codeRaw === "number"
          ? String(codeRaw)
          : undefined;

      const safe = {
        error: typeof j.error === "string" ? j.error : undefined,
        stage: typeof j.stage === "string" ? j.stage : undefined,
        provider: typeof j.provider === "string" ? j.provider : undefined,
        resolvedStyle:
          typeof j.resolvedStyle === "string" ? j.resolvedStyle : undefined,
        resolvedVoice:
          typeof j.resolvedVoice === "string" ? j.resolvedVoice : undefined,
        synthesisBranch:
          typeof j.synthesisBranch === "string" ? j.synthesisBranch : undefined,
        code,
        message: typeof j.message === "string" ? j.message : undefined,
        requestedStyle:
          typeof j.requestedStyle === "string" ? j.requestedStyle : undefined,
        debugMinimal:
          typeof j.debugMinimal === "boolean" ? j.debugMinimal : undefined,
        stack: typeof j.stack === "string" ? clip(j.stack, 1200) : undefined,
        cause: j.cause,
        detail:
          typeof j.detail === "string"
            ? clip(j.detail, 1200)
            : undefined,
      };
      return JSON.stringify(safe);
    }
    const txt = await res.clone().text();
    return clip(txt);
  } catch {
    return "";
  }
}
