/**
 * 业务层统一 TTS：优先外部 HTTP，失败或未配置时浏览器 speechSynthesis 兜底。
 */

import {
  buildQuestionSpeech,
  buildExternalTtsRequestBody,
  DEFAULT_TTS_VOICE_STYLE,
  getTtsClientConfig,
  shouldPreferExternalEngine,
  type QuestionSpeechVariant,
  type TTSVoiceStyle,
  stepBoyStyleMoreLively,
  stepBoyStyleYounger,
  TTS_STYLE_CONFIG,
  TTS_STYLE_PROFILE,
  TTS_STYLE_UI_ORDER,
  TTS_STYLE_VOICE_SEMANTICS,
  TTS_TEXT,
} from "@/src/config/tts";
import { playTtsAudioFromBlob, stopTtsAudio } from "@/src/services/tts/audioPlayer";
import {
  abortExternalTtsFetch,
  isExternalTtsError,
  speakWithExternalTts,
} from "@/src/services/tts/externalTtsEngine";
import {
  BOY_BROWSER_PRESET_LABEL,
  countZhVoices,
  getAvailableVoices,
  isBrowserTtsSupported,
  pickBestVoiceForStyle,
  preloadVoices,
  primeSpeechSynthesis,
  resolveBrowserPresetValues,
  speakWithBrowserTts,
  splitTextForTts,
  stopBrowserTtsEngine,
  summarizeBoyStyleVoiceSeparation,
} from "@/src/services/tts/browserTtsEngine";

export type { TTSVoiceStyle, QuestionSpeechVariant };
export type { TtsPerceivedAgeBand } from "@/src/config/tts";
export {
  BOY_BROWSER_PRESET_LABEL,
  DEFAULT_TTS_VOICE_STYLE,
  TTS_TEXT,
  TTS_STYLE_CONFIG,
  TTS_STYLE_PROFILE,
  TTS_STYLE_UI_ORDER,
  TTS_STYLE_VOICE_SEMANTICS,
  buildQuestionSpeech,
  countZhVoices,
  getTtsClientConfig,
  shouldPreferExternalEngine,
  stepBoyStyleMoreLively,
  stepBoyStyleYounger,
  summarizeBoyStyleVoiceSeparation,
};

export { buildExternalTtsRequestBody } from "@/src/config/tts";

export type SpeakTextOptions = {
  style?: TTSVoiceStyle;
  interrupt?: boolean;
  onEnd?: () => void;
  onStart?: () => void;
  segment?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  /** 单次请求强制走服务端已验证 working voice（与 env 开关叠加） */
  forceExternalWorkingVoice?: boolean;
  /**
   * 禁用浏览器 speechSynthesis 兜底（例如“无人操作的催促互动”不希望出现系统自带声音）。
   * 若外部不可用/失败，则本次直接结束，不播放任何声音。
   */
  disableFallbackToBrowser?: boolean;
};

type PrefetchCacheEntry = { blob: Blob; at: number };
const PREFETCH_CACHE_MAX = 10;
const PREFETCH_CACHE_TTL_MS = 10 * 60_000;
const prefetchCache = new Map<string, PrefetchCacheEntry>();

function cacheKey(style: TTSVoiceStyle, text: string): string {
  return `${style}::${text}`;
}

function getCachedBlob(style: TTSVoiceStyle, text: string): Blob | null {
  const k = cacheKey(style, text);
  const e = prefetchCache.get(k);
  if (!e) return null;
  if (Date.now() - e.at > PREFETCH_CACHE_TTL_MS) {
    prefetchCache.delete(k);
    return null;
  }
  return e.blob;
}

function putCachedBlob(style: TTSVoiceStyle, text: string, blob: Blob): void {
  const k = cacheKey(style, text);
  prefetchCache.set(k, { blob, at: Date.now() });
  if (prefetchCache.size <= PREFETCH_CACHE_MAX) return;
  const firstKey = prefetchCache.keys().next().value as string | undefined;
  if (firstKey) prefetchCache.delete(firstKey);
}

/**
 * 预取外部 TTS 音频（仅缓存，不播放），用于降低“点播后很久才出声”的体感延迟。
 * 预取失败不影响主流程。
 */
export async function prefetchSpeakText(
  text: string,
  options?: Pick<SpeakTextOptions, "style" | "forceExternalWorkingVoice">
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (typeof window === "undefined") return;

  const cfg = getTtsClientConfig();
  const style = options?.style ?? DEFAULT_TTS_VOICE_STYLE;
  const preferExternal = shouldPreferExternalEngine(cfg);
  if (!preferExternal || !cfg.apiUrl) return;
  if (Date.now() < externalDownUntil) return;
  if (getCachedBlob(style, trimmed)) return;

  const forceWorking = cfg.forceExternalWorkingVoice || options?.forceExternalWorkingVoice === true;
  const requestBody = forceWorking
    ? ({
        text: trimmed,
        style,
        forceExternalWorkingVoice: true,
      } as Record<string, unknown>)
    : (buildExternalTtsRequestBody(trimmed, style) as Record<string, unknown>);

  const ctrl = new AbortController();
  const timeoutMs = Math.max(cfg.externalTimeoutMs, 12_000);
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("audio/") && !ct.includes("mpeg") && !ct.includes("mp3")) return;
    const blob = await res.blob();
    if (blob.size < 64) return;
    putCachedBlob(style, trimmed, blob);
  } catch {
    // ignore
  } finally {
    window.clearTimeout(t);
  }
}

let externalDownUntil = 0;
let lastEngineUsed: "external" | "browser" | null = null;
let lastWasFallback = false;
let lastBrowserVoiceName: string | null = null;
let lastBrowserVoiceUri: string | null = null;
let lastBrowserVoiceLang: string | null = null;
let lastBrowserEffectiveRate: number | null = null;
let lastBrowserEffectivePitch: number | null = null;
let lastBrowserEffectiveVolume: number | null = null;
let lastSpeakStyle: TTSVoiceStyle | null = null;

let lastFallbackReason: string | null = null;

let lastExternalAttemptAt: number | null = null;
let lastExternalFetchedOkAt: number | null = null;
let lastExternalSuccessAt: number | null = null;
let lastExternalHttpStatus: number | null = null;
let lastExternalContentType: string | null = null;
let lastExternalErrorCode: string | null = null;
let lastExternalErrorMessage: string | null = null;
let lastExternalResponseSnippet: string | null = null;
let lastExternalPhase: TtsExternalRequestStatus = "idle";
let lastExternalVoiceId: string | null = null;
let lastExternalVoiceName: string | null = null;
let lastExternalProvider: string | null = null;
let lastExternalRequestBody: Record<string, unknown> | null = null;
let lastExternalServerStage: string | null = null;
let lastExternalServerDetail: string | null = null;
let lastExternalServerProvider: string | null = null;
let lastExternalServerRequestedStyle: string | null = null;
let lastExternalServerResolvedStyle: string | null = null;
let lastExternalServerResolvedVoice: string | null = null;
let lastExternalServerErrCode: string | null = null;
let lastExternalServerErrMessage: string | null = null;
let lastExternalMinimalProbeOk: boolean | null = null;
let lastExternalSynthesisBranch: string | null = null;
let lastExternalWorkingReason: string | null = null;
let lastExternalPlaybackGotAudio: boolean | null = null;

export type TtsExternalRequestStatus = "idle" | "fetching" | "ok" | "failed";

export type TtsRuntimeStatus = {
  engine: "external" | "browser" | null;
  fallback: boolean;
  browserVoiceName: string | null;
  browserVoiceUri: string | null;
  browserVoiceLang: string | null;
  lastBrowserEffectiveRate: number | null;
  lastBrowserEffectivePitch: number | null;
  lastBrowserEffectiveVolume: number | null;
  externalDownUntilMs: number;
  lastSpeakStyle: TTSVoiceStyle | null;
  lastFallbackReason: string | null;
  externalRequestStatus: TtsExternalRequestStatus;
  lastExternalAttemptAt: number | null;
  lastExternalFetchedOkAt: number | null;
  lastExternalSuccessAt: number | null;
  lastExternalHttpStatus: number | null;
  lastExternalContentType: string | null;
  lastExternalErrorCode: string | null;
  lastExternalErrorMessage: string | null;
  lastExternalResponseSnippet: string | null;
  lastExternalVoiceId: string | null;
  lastExternalVoiceName: string | null;
  lastExternalProvider: string | null;
  lastExternalRequestBody: Record<string, unknown> | null;
  lastExternalServerStage: string | null;
  lastExternalServerDetail: string | null;
  lastExternalServerProvider: string | null;
  lastExternalServerRequestedStyle: string | null;
  lastExternalServerResolvedStyle: string | null;
  lastExternalServerResolvedVoice: string | null;
  lastExternalServerErrCode: string | null;
  lastExternalServerErrMessage: string | null;
  lastExternalMinimalProbeOk: boolean | null;
  lastExternalSynthesisBranch: string | null;
  lastExternalWorkingReason: string | null;
  /** 最近一次 speakText external 路径是否拿到可播放二进制（不等同于用户已听完） */
  lastExternalPlaybackGotAudio: boolean | null;
};

export function stopSpeak(): void {
  abortExternalTtsFetch();
  stopTtsAudio();
  stopBrowserTtsEngine();
}

export function getTtsRuntimeStatus(): TtsRuntimeStatus {
  return {
    engine: lastEngineUsed,
    fallback: lastWasFallback,
    browserVoiceName: lastBrowserVoiceName,
    browserVoiceUri: lastBrowserVoiceUri,
    browserVoiceLang: lastBrowserVoiceLang,
    lastBrowserEffectiveRate,
    lastBrowserEffectivePitch,
    lastBrowserEffectiveVolume,
    externalDownUntilMs: Math.max(0, externalDownUntil - Date.now()),
    lastSpeakStyle,
    lastFallbackReason,
    externalRequestStatus: lastExternalPhase,
    lastExternalAttemptAt,
    lastExternalFetchedOkAt,
    lastExternalSuccessAt,
    lastExternalHttpStatus,
    lastExternalContentType,
    lastExternalErrorCode,
    lastExternalErrorMessage,
    lastExternalResponseSnippet,
    lastExternalVoiceId,
    lastExternalVoiceName,
    lastExternalProvider,
    lastExternalRequestBody,
    lastExternalServerStage,
    lastExternalServerDetail,
    lastExternalServerProvider,
    lastExternalServerRequestedStyle,
    lastExternalServerResolvedStyle,
    lastExternalServerResolvedVoice,
    lastExternalServerErrCode,
    lastExternalServerErrMessage,
    lastExternalMinimalProbeOk,
    lastExternalSynthesisBranch,
    lastExternalWorkingReason,
    lastExternalPlaybackGotAudio,
  };
}

/**
 * 调试用：TTSDebugger「探测外部 API」不经过 speakText，需单独写入运行时诊断，避免面板仍显示 engine=—。
 */
export type TtsApiProbeResult = {
  ok: boolean;
  httpStatus: number;
  contentType: string;
  requestBody: Record<string, unknown>;
  voiceId?: string | null;
  voiceName?: string | null;
  provider?: string | null;
  debugMinimalHeader?: string | null;
  synthesisBranchHeader?: string | null;
  workingReasonHeader?: string | null;
  /** 非 2xx 时原始响应体（尽量短），用于解析服务端 JSON 错误 */
  errorBodyText?: string;
  /** fetch 异常或超时 */
  clientError?: string;
};

export function recordTtsApiProbeResult(r: TtsApiProbeResult): void {
  const now = Date.now();
  lastExternalAttemptAt = now;
  lastExternalHttpStatus = r.httpStatus;
  lastExternalContentType = r.contentType || null;
  lastExternalRequestBody = r.requestBody;
  lastEngineUsed = "external";
  lastWasFallback = false;

  const clearServerErr = () => {
    lastExternalServerStage = null;
    lastExternalServerDetail = null;
    lastExternalServerProvider = null;
    lastExternalServerRequestedStyle = null;
    lastExternalServerResolvedStyle = null;
    lastExternalServerResolvedVoice = null;
    lastExternalServerErrCode = null;
    lastExternalServerErrMessage = null;
  };

  if (r.clientError) {
    lastExternalPhase = "failed";
    lastExternalFetchedOkAt = null;
    lastExternalVoiceId = null;
    lastExternalVoiceName = null;
    lastExternalProvider = null;
    lastExternalErrorCode = "PROBE_CLIENT";
    lastExternalErrorMessage = r.clientError;
    lastExternalResponseSnippet = null;
    clearServerErr();
    lastFallbackReason = null;
    return;
  }

  if (r.ok) {
    lastExternalPhase = "ok";
    lastExternalFetchedOkAt = now;
    lastExternalVoiceId = r.voiceId ?? null;
    lastExternalVoiceName = r.voiceName ?? null;
    lastExternalProvider = r.provider ?? null;
    lastExternalErrorCode = null;
    lastExternalErrorMessage = null;
    lastExternalResponseSnippet = null;
    clearServerErr();
    const dm = r.debugMinimalHeader;
    if (dm === "1" || dm === "true") lastExternalMinimalProbeOk = true;
    else if (dm === "0" || dm === "false") lastExternalMinimalProbeOk = false;
    else lastExternalMinimalProbeOk = null;
    lastExternalSynthesisBranch = r.synthesisBranchHeader ?? null;
    lastExternalWorkingReason = r.workingReasonHeader ?? null;
    lastExternalPlaybackGotAudio = true;
    lastFallbackReason = null;
    return;
  }

  lastExternalPhase = "failed";
  lastExternalFetchedOkAt = null;
  lastExternalVoiceId = r.voiceId ?? null;
  lastExternalVoiceName = r.voiceName ?? null;
  lastExternalProvider = r.provider ?? null;
  lastExternalErrorCode = "HTTP_ERROR";
  lastExternalErrorMessage = `探测接口返回 HTTP ${r.httpStatus}（Content-Type=${r.contentType || "—"}）`;

  let snippet = "";
  if (r.errorBodyText && r.contentType.includes("application/json")) {
    try {
      const j = JSON.parse(r.errorBodyText) as Record<string, unknown>;
      snippet = JSON.stringify({
        error: typeof j.error === "string" ? j.error : undefined,
        stage: typeof j.stage === "string" ? j.stage : undefined,
        provider: typeof j.provider === "string" ? j.provider : undefined,
        requestedStyle: typeof j.requestedStyle === "string" ? j.requestedStyle : undefined,
        resolvedStyle: typeof j.resolvedStyle === "string" ? j.resolvedStyle : undefined,
        resolvedVoice: typeof j.resolvedVoice === "string" ? j.resolvedVoice : undefined,
        code:
          typeof j.code === "string" || typeof j.code === "number"
            ? String(j.code)
            : undefined,
        message: typeof j.message === "string" ? j.message : undefined,
        detail: typeof j.detail === "string" ? j.detail.slice(0, 800) : undefined,
      });
      lastExternalServerStage = typeof j.stage === "string" ? j.stage : null;
      lastExternalServerDetail = typeof j.detail === "string" ? j.detail : null;
      lastExternalServerProvider = typeof j.provider === "string" ? j.provider : null;
      lastExternalServerRequestedStyle =
        typeof j.requestedStyle === "string" ? j.requestedStyle : null;
      lastExternalServerResolvedStyle =
        typeof j.resolvedStyle === "string" ? j.resolvedStyle : null;
      lastExternalServerResolvedVoice =
        typeof j.resolvedVoice === "string" ? j.resolvedVoice : null;
      lastExternalServerErrCode =
        typeof j.code === "string" || typeof j.code === "number"
          ? String(j.code)
          : null;
      lastExternalServerErrMessage =
        typeof j.message === "string" ? j.message : null;
    } catch {
      snippet = r.errorBodyText.slice(0, 400);
      clearServerErr();
    }
  } else if (r.errorBodyText) {
    snippet = r.errorBodyText.slice(0, 400);
    clearServerErr();
  } else {
    clearServerErr();
  }
  lastExternalResponseSnippet = snippet || null;
  lastFallbackReason = null;
}

export function isTtsPlaybackAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const cfg = getTtsClientConfig();
  if (shouldPreferExternalEngine(cfg)) return true;
  return isBrowserTtsSupported();
}

export {
  getAvailableVoices,
  isBrowserTtsSupported,
  pickBestVoiceForStyle,
  preloadVoices,
  primeSpeechSynthesis,
  resolveBrowserPresetValues,
  splitTextForTts,
};

/** 纯预览：不修改「最近一次播报」诊断状态 */
export function pickBestVoice(style: TTSVoiceStyle = DEFAULT_TTS_VOICE_STYLE) {
  return pickBestVoiceForStyle(style, getAvailableVoices());
}

export async function speakText(
  text: string,
  options?: SpeakTextOptions
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    options?.onEnd?.();
    return;
  }

  const cfg = getTtsClientConfig();
  const style = options?.style ?? DEFAULT_TTS_VOICE_STYLE;
  lastSpeakStyle = style;
  const preferExternal = shouldPreferExternalEngine(cfg);
  const allowFallback = options?.disableFallbackToBrowser ? false : cfg.fallbackToBrowser;

  if (options?.interrupt !== false) {
    stopSpeak();
  }

  const runBrowserWithStyle = async (
    s: TTSVoiceStyle,
    reason: string,
    opts?: { resetExternalDiag?: boolean }
  ) => {
    const resetExternalDiag = opts?.resetExternalDiag !== false;
    lastEngineUsed = "browser";
    lastWasFallback = preferExternal;
    lastFallbackReason = reason;
    if (resetExternalDiag) {
      // 仅在“未尝试 external / 明确跳过 external”时清空 external 诊断。
      // 如果是 external 失败后回退浏览器，需要保留 external 的请求体/错误详情以便排查。
      lastExternalPhase = "idle";
      lastExternalVoiceId = null;
      lastExternalVoiceName = null;
      lastExternalProvider = null;
      lastExternalRequestBody = null;
      lastExternalServerStage = null;
      lastExternalServerDetail = null;
      lastExternalServerProvider = null;
      lastExternalServerRequestedStyle = null;
      lastExternalServerResolvedStyle = null;
      lastExternalServerResolvedVoice = null;
      lastExternalServerErrCode = null;
      lastExternalServerErrMessage = null;
      lastExternalMinimalProbeOk = null;
      lastExternalSynthesisBranch = null;
      lastExternalWorkingReason = null;
      lastExternalPlaybackGotAudio = null;
    }

    await preloadVoices();
    const voices = getAvailableVoices();
    const voice = pickBestVoiceForStyle(s, voices);
    lastBrowserVoiceName = voice?.name ?? null;
    lastBrowserVoiceUri = voice?.voiceURI ?? null;
    lastBrowserVoiceLang = voice?.lang ?? null;

    const eff = resolveBrowserPresetValues(s, {
      rate: options?.rate,
      pitch: options?.pitch,
      volume: options?.volume,
    });
    lastBrowserEffectiveRate = eff.rate;
    lastBrowserEffectivePitch = eff.pitch;
    lastBrowserEffectiveVolume = eff.volume;

    await speakWithBrowserTts(trimmed, {
      style: s,
      interrupt: false,
      segment: options?.segment,
      rate: options?.rate,
      pitch: options?.pitch,
      volume: options?.volume,
      onStart: options?.onStart,
      onEnd: options?.onEnd,
    });
  };

  const explainSkipExternal = (): string => {
    if (cfg.engine === "browser") {
      return "已配置 NEXT_PUBLIC_TTS_ENGINE=browser，不会请求外部 TTS。";
    }
    if (!cfg.apiUrl) {
      return "未配置 NEXT_PUBLIC_TTS_API_URL，无法请求外部 TTS。";
    }
    if (Date.now() < externalDownUntil) {
      const sec = Math.ceil((externalDownUntil - Date.now()) / 1000);
      return `外部 TTS 熔断冷却中（约 ${sec}s 内不发起请求，因上次失败）。本次未发请求，直接走浏览器。`;
    }
    return "当前未尝试外部 TTS。";
  };

  const browserRun = async (reason: string) => {
    await runBrowserWithStyle(style, reason, { resetExternalDiag: true });
  };

  const externalAllowed =
    preferExternal &&
    cfg.apiUrl &&
    typeof window !== "undefined" &&
    Date.now() >= externalDownUntil;

  if (!externalAllowed) {
    if (!allowFallback) {
      options?.onEnd?.();
      return;
    }
    await browserRun(explainSkipExternal());
    return;
  }

  // 命中预取缓存：直接本地播放，显著缩短“点了很久才出声”的体感延迟
  const cached = getCachedBlob(style, trimmed);
  if (cached) {
    lastEngineUsed = "external";
    lastWasFallback = false;
    lastFallbackReason = null;
    lastExternalPhase = "ok";
    lastExternalPlaybackGotAudio = true;
    stopBrowserTtsEngine();
    try {
      await playTtsAudioFromBlob(cached, options?.onEnd, options?.onStart);
      return;
    } catch {
      // 缓存播放失败则继续走正常 external 请求
    }
  }

  lastExternalAttemptAt = Date.now();
  lastExternalErrorCode = null;
  lastExternalErrorMessage = null;
  lastExternalHttpStatus = null;
  lastExternalContentType = null;
  lastExternalResponseSnippet = null;
  lastExternalFetchedOkAt = null;
  lastExternalSuccessAt = null;
  lastExternalPhase = "fetching";
  lastExternalVoiceId = null;
  lastExternalVoiceName = null;
  lastExternalProvider = null;
  lastExternalRequestBody = null;
  lastExternalServerStage = null;
  lastExternalServerDetail = null;
  lastExternalServerProvider = null;
  lastExternalServerRequestedStyle = null;
  lastExternalServerResolvedStyle = null;
  lastExternalServerResolvedVoice = null;
  lastExternalServerErrCode = null;
  lastExternalServerErrMessage = null;
  lastExternalMinimalProbeOk = null;
  lastExternalSynthesisBranch = null;
  lastExternalWorkingReason = null;
  lastExternalPlaybackGotAudio = null;

  try {
    lastEngineUsed = "external";
    lastWasFallback = false;
    lastFallbackReason = null;

    const forceWorking =
      cfg.forceExternalWorkingVoice || options?.forceExternalWorkingVoice === true;
    const requestBody = forceWorking
      ? ({
          text: trimmed,
          style,
          forceExternalWorkingVoice: true,
        } as Record<string, unknown>)
      : (buildExternalTtsRequestBody(trimmed, style) as Record<string, unknown>);
    lastExternalRequestBody = requestBody;

    const fetchTimeoutMs = Math.max(cfg.externalTimeoutMs, 25_000);

    await speakWithExternalTts(trimmed, style, cfg.apiUrl, {
      interrupt: options?.interrupt !== false,
      onStart: options?.onStart,
      onEnd: options?.onEnd,
      requestBody,
      onStreamReady: () => {
        lastExternalFetchedOkAt = Date.now();
        lastExternalPlaybackGotAudio = true;
      },
      onResponseMeta: (m) => {
        lastExternalVoiceId = m.voiceId;
        lastExternalVoiceName = m.voiceName;
        lastExternalProvider = m.provider;
        lastExternalSynthesisBranch = m.synthesisBranch;
        lastExternalWorkingReason = m.workingReason;
        if (m.debugMinimal === true && m.voiceId) {
          lastExternalMinimalProbeOk = true;
        } else if (m.debugMinimal === false) {
          lastExternalMinimalProbeOk = false;
        }
      },
      timeoutMs: fetchTimeoutMs,
    });

    lastExternalSuccessAt = Date.now();
    lastExternalPhase = "ok";
    return;
  } catch (e) {
    if (isExternalTtsError(e) && e.code === "SUPERSEDED") {
      return;
    }

    lastExternalPhase = "failed";
    lastExternalPlaybackGotAudio = false;

    if (isExternalTtsError(e)) {
      lastExternalErrorCode = e.code;
      lastExternalErrorMessage = e.message;
      lastExternalHttpStatus = e.httpStatus ?? null;
      lastExternalContentType = e.contentType ?? null;
      lastExternalResponseSnippet = e.responseSnippet ?? null;

      // 解析服务端 detail/stage/provider（/api/tts 的增强返回）
      if (lastExternalResponseSnippet) {
        try {
          const j = JSON.parse(lastExternalResponseSnippet) as {
            stage?: string;
            detail?: string;
            provider?: string;
            requestedStyle?: string;
            resolvedStyle?: string;
            resolvedVoice?: string;
            synthesisBranch?: string;
            code?: string;
            message?: string;
          };
          lastExternalServerStage = j.stage ?? null;
          lastExternalServerDetail = j.detail ?? null;
          lastExternalServerProvider = j.provider ?? null;
          lastExternalServerRequestedStyle = j.requestedStyle ?? null;
          lastExternalServerResolvedStyle = j.resolvedStyle ?? null;
          lastExternalServerResolvedVoice = j.resolvedVoice ?? null;
          lastExternalServerErrCode =
            j.code !== undefined && j.code !== null ? String(j.code) : null;
          lastExternalServerErrMessage = j.message ?? null;
          lastExternalSynthesisBranch = j.synthesisBranch ?? lastExternalSynthesisBranch;
        } catch {
          // ignore
        }
      }
    } else {
      lastExternalErrorCode = "UNKNOWN";
      lastExternalErrorMessage =
        e instanceof Error ? e.message : String(e);
    }

    const now = Date.now();
    let coolMs = 30_000;
    if (lastExternalHttpStatus === 503 && lastExternalServerStage === "provider_circuit_open") {
      coolMs = 60_000;
    }
    externalDownUntil = Math.max(externalDownUntil, now + coolMs);

    if (!allowFallback) {
      lastEngineUsed = "external";
      lastWasFallback = false;
      lastFallbackReason = `外部 TTS 失败且已禁止浏览器回退（NEXT_PUBLIC_TTS_FALLBACK）。原因：${lastExternalErrorMessage}`;
      options?.onEnd?.();
      return;
    }

    const detail = lastExternalErrorMessage ?? "未知错误";
    const providerHint =
      lastExternalHttpStatus === 503 || lastExternalServerStage === "provider_circuit_open"
        ? "提示：edge-tts-node 服务端已触发短时熔断/不可用，短时间内将减少重复请求。"
        : "";
    await runBrowserWithStyle(
      style,
      `外部 TTS 未成功（已回退浏览器）。原因：${detail}（错误码：${lastExternalErrorCode ?? "—"}）${
        providerHint ? `。${providerHint}` : ""
      }`,
      { resetExternalDiag: false }
    );
  }
}

export const speakTextAsync = speakText;
