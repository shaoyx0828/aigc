import type { TTSVoiceStyle } from "@/src/config/tts";
import { buildExternalTtsRequestBody } from "@/src/config/tts";
import {
  playTtsAudioFromBlob,
  playTtsAudioFromUrl,
  stopTtsAudio,
} from "@/src/services/tts/audioPlayer";
import { stopBrowserTtsEngine } from "@/src/services/tts/browserTtsEngine";
import {
  ExternalTtsError,
  readResponseSnippet,
} from "@/src/services/tts/externalTtsErrors";

export type ExternalTtsSpeakOptions = {
  interrupt?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  /** 已拿到可播放 URL / Blob，即将调用 play（用于诊断「是否成功拿到外部音频」） */
  onStreamReady?: () => void;
  /** 从响应头读取服务端选用的合成声线与提供方标识 */
  onResponseMeta?: (meta: {
    voiceId: string | null;
    voiceName: string | null;
    provider: string | null;
    debugMinimal: boolean | null;
    synthesisBranch: string | null;
    workingReason: string | null;
  }) => void;
  /** 便于调试：允许上层传入已构建的请求体（记录“前端发出了什么”） */
  requestBody?: Record<string, unknown>;
  timeoutMs?: number;
};

function looksLikeAudioBlob(blob: Blob): boolean {
  if (blob.type.startsWith("audio/")) return true;
  if (blob.type.includes("mpeg") || blob.type.includes("mp3")) return true;
  if (blob.size > 32) return true;
  return false;
}

/** 与当前 in-flight fetch 绑定的 AbortController，用于 stopSpeak / 新一段播报 取消上一段请求，避免晚到的音频盖住下一段。 */
let inFlightFetchAbort: AbortController | null = null;

export function abortExternalTtsFetch(): void {
  inFlightFetchAbort?.abort();
  inFlightFetchAbort = null;
}

function mapPlayError(e: unknown): ExternalTtsError {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "AUDIO_ELEMENT_ERROR") {
    return new ExternalTtsError(
      "AUDIO_PLAY_ELEMENT",
      "音频播放失败：媒体元素 error（URL/格式无效或无法解码）"
    );
  }
  return new ExternalTtsError(
    "AUDIO_PLAY_REJECTED",
    `音频播放失败：${msg || "play() 被拒绝（常见于自动播放策略）"}`
  );
}

/**
 * 通用 HTTP TTS：POST JSON，兼容 audio/* 流或 JSON { audioUrl }。
 * 失败抛出 ExternalTtsError，便于业务层记录原因，避免静默 fallback 不知为何。
 */
export async function speakWithExternalTts(
  text: string,
  style: TTSVoiceStyle,
  apiUrl: string,
  options?: ExternalTtsSpeakOptions
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    options?.onEnd?.();
    return;
  }

  // 外部音频与 speechSynthesis 互斥，避免「Edge 小男孩 + 系统朗读」叠音。
  stopBrowserTtsEngine();
  if (options?.interrupt !== false) {
    stopTtsAudio();
  }

  abortExternalTtsFetch();
  const fetchCtrl = new AbortController();
  inFlightFetchAbort = fetchCtrl;

  try {
  const timeoutMs = options?.timeoutMs ?? 9000;
  let timedOut = false;
  const t = window.setTimeout(() => {
    timedOut = true;
    fetchCtrl.abort();
  }, timeoutMs);
  let res: Response;
  try {
    const bodyObj = options?.requestBody ?? buildExternalTtsRequestBody(trimmed, style);
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      cache: "no-store",
      signal: fetchCtrl.signal,
    });
  } catch (e) {
    window.clearTimeout(t);
    if (e instanceof DOMException && e.name === "AbortError") {
      if (timedOut) {
        throw new ExternalTtsError(
          "ABORT_TIMEOUT",
          `请求超时或被中断（客户端等待 ${timeoutMs}ms，AbortSignal）`
        );
      }
      throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
    }
    throw new ExternalTtsError(
      "NETWORK",
      `网络或 fetch 异常：${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    window.clearTimeout(t);
  }

  if (inFlightFetchAbort !== fetchCtrl) {
    throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
  }

  const ct = res.headers.get("content-type") || "";

  const readVoiceMeta = () => {
    const voiceId =
      res.headers.get("x-tts-voice-id") ??
      res.headers.get("X-TTS-Voice-Id") ??
      null;
    const voiceName =
      res.headers.get("x-tts-voice-name") ??
      res.headers.get("X-TTS-Voice-Name") ??
      null;
    const provider =
      res.headers.get("x-tts-provider") ??
      res.headers.get("X-TTS-Provider") ??
      null;
    const dm =
      res.headers.get("x-tts-debug-minimal") ??
      res.headers.get("X-TTS-Debug-Minimal") ??
      null;
    const debugMinimal = dm === "1" || dm === "true" ? true : dm === "0" ? false : null;
    const synthesisBranch =
      res.headers.get("x-tts-synthesis-branch") ??
      res.headers.get("X-TTS-Synthesis-Branch") ??
      null;
    const workingReason =
      res.headers.get("x-tts-working-reason") ??
      res.headers.get("X-TTS-Working-Reason") ??
      null;
    options?.onResponseMeta?.({
      voiceId,
      voiceName,
      provider,
      debugMinimal,
      synthesisBranch,
      workingReason: workingReason || null,
    });
  };

  if (!res.ok) {
    const snippet = await readResponseSnippet(res);
    throw new ExternalTtsError(
      "HTTP_ERROR",
      `接口返回 HTTP ${res.status}${snippet ? ` · ${snippet}` : ""}`,
      { httpStatus: res.status, contentType: ct || undefined, responseSnippet: snippet }
    );
  }

  if (ct.includes("application/json")) {
    readVoiceMeta();
    const json = (await res.json()) as { audioUrl?: string; error?: string };
    if (inFlightFetchAbort !== fetchCtrl) {
      throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
    }
    if (json.error) {
      throw new ExternalTtsError(
        "JSON_SERVER_ERROR",
        `接口 JSON 错误字段：${json.error}`,
        { contentType: ct }
      );
    }
    if (!json.audioUrl) {
      throw new ExternalTtsError(
        "JSON_MISSING_AUDIO_URL",
        "接口返回 JSON 但缺少 audioUrl",
        { contentType: ct }
      );
    }
    options?.onStreamReady?.();
    if (inFlightFetchAbort !== fetchCtrl) {
      throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
    }
    try {
      await playTtsAudioFromUrl(json.audioUrl, options?.onEnd, options?.onStart);
    } catch (e) {
      throw mapPlayError(e);
    }
    return;
  }

  readVoiceMeta();
  const blob = await res.blob();
  if (inFlightFetchAbort !== fetchCtrl) {
    throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
  }
  if (!looksLikeAudioBlob(blob) && blob.type && !blob.type.startsWith("audio/")) {
    try {
      const asText = await blob.text();
      if (inFlightFetchAbort !== fetchCtrl) {
        throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
      }
      const j = JSON.parse(asText) as { audioUrl?: string; error?: string };
      if (j.error) {
        throw new ExternalTtsError("JSON_SERVER_ERROR", `嵌入 JSON 错误：${j.error}`);
      }
      if (j.audioUrl) {
        options?.onStreamReady?.();
        if (inFlightFetchAbort !== fetchCtrl) {
          throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
        }
        try {
          await playTtsAudioFromUrl(j.audioUrl, options?.onEnd, options?.onStart);
        } catch (e) {
          throw mapPlayError(e);
        }
        return;
      }
    } catch (e) {
      if (e instanceof ExternalTtsError) throw e;
    }
    throw new ExternalTtsError(
      "INVALID_AUDIO_BODY",
      `返回体不是可识别的音频（Content-Type: ${ct || blob.type || "无"}，size=${blob.size}）`,
      { contentType: ct || blob.type || undefined }
    );
  }

  options?.onStreamReady?.();
  if (inFlightFetchAbort !== fetchCtrl) {
    throw new ExternalTtsError("SUPERSEDED", "外部 TTS 请求已被新的播报或停止操作打断");
  }
  try {
    await playTtsAudioFromBlob(blob, options?.onEnd, options?.onStart);
  } catch (e) {
    throw mapPlayError(e);
  }
  } finally {
    if (inFlightFetchAbort === fetchCtrl) {
      inFlightFetchAbort = null;
    }
  }
}

export { stopTtsAudio as stopExternalTtsAudio };
export {
  ExternalTtsError,
  isExternalTtsError,
  type ExternalTtsErrorCode,
} from "@/src/services/tts/externalTtsErrors";
