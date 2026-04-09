"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BOY_BROWSER_PRESET_LABEL,
  buildExternalTtsRequestBody,
  countZhVoices,
  getAvailableVoices,
  getTtsClientConfig,
  getTtsRuntimeStatus,
  isBrowserTtsSupported,
  recordTtsApiProbeResult,
  isTtsPlaybackAvailable,
  pickBestVoice,
  pickBestVoiceForStyle,
  preloadVoices,
  resolveBrowserPresetValues,
  shouldPreferExternalEngine,
  speakText,
  stepBoyStyleMoreLively,
  stepBoyStyleYounger,
  stopSpeak,
  summarizeBoyStyleVoiceSeparation,
  type TTSVoiceStyle,
  TTS_STYLE_CONFIG,
  TTS_STYLE_PROFILE,
  TTS_STYLE_UI_ORDER,
  TTS_STYLE_VOICE_SEMANTICS,
  TTS_TEXT,
} from "@/src/services/tts";

const BOY_STYLES = [
  "preschoolBoy",
  "littleBoy",
  "storybookBoy",
  "heroBoy",
  "brightBoy",
] as const;

function isBoyStyle(s: TTSVoiceStyle): s is (typeof BOY_STYLES)[number] {
  return (BOY_STYLES as readonly string[]).includes(s);
}

function formatTime(ms: number | null): string {
  if (ms == null) return "—";
  try {
    return `${new Date(ms).toLocaleString()}（${ms}）`;
  } catch {
    return String(ms);
  }
}

function shortUri(uri: string | null, max = 56): string {
  if (!uri) return "—";
  return uri.length <= max ? uri : `${uri.slice(0, max)}…`;
}

/** 调试用：把配置里的听感段落到四条「男童—少年—成年」轴上 */
function ageAssessmentLabel(style: TTSVoiceStyle): string {
  const b = TTS_STYLE_VOICE_SEMANTICS[style].perceivedAgeBand;
  if (b === "学龄前男童")
    return "学龄前男童（目标约 5–7 岁：活泼明亮稚嫩，非少年、非主持男声）";
  if (b === "幼态男童") return "幼态男童（目标：男童音，非少年抬调）";
  if (b === "偏小男孩") return "偏小男孩（绘本向，仍偏童声）";
  if (b === "偏少年") return "偏少年（清亮小少年，勿低沉）";
  if (b === "偏成年") return "偏成年";
  if (b === "女童向") return "非男童线 · 女童向";
  return "非男童线 · 中性旁白";
}

function voiceCategoryHint(style: TTSVoiceStyle): string {
  const b = TTS_STYLE_VOICE_SEMANTICS[style].perceivedAgeBand;
  if (b === "学龄前男童" || b === "幼态男童" || b === "偏小男孩")
    return "归类：男童音一侧（与「少年音」「成年年轻男声」区分）";
  if (b === "偏少年") return "归类：少年音一侧（比男童略成熟，仍应避免成年厚声）";
  if (b === "偏成年") return "归类：成年声线";
  return "归类：非男童主持向";
}

/**
 * 开发环境：展示 external 失败原因、浏览器 voice 实况、男孩 style 是否真多音色。
 */
export function TTSDebugger() {
  const cfg = useMemo(() => getTtsClientConfig(), []);
  const preferEx = useMemo(() => shouldPreferExternalEngine(cfg), [cfg]);

  const [style, setStyle] = useState<TTSVoiceStyle>("preschoolBoy");
  const [text, setText] = useState<string>(TTS_TEXT.welcome);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [probe, setProbe] = useState<string>("未探测");
  const [busy, setBusy] = useState(false);
  const [diagTick, setDiagTick] = useState(0);
  const [minimalProbe, setMinimalProbe] = useState(false);
  const [forceWorkingPlay, setForceWorkingPlay] = useState(false);

  const preschoolPreset = resolveBrowserPresetValues("preschoolBoy");
  const [rate, setRate] = useState(preschoolPreset.rate);
  const [pitch, setPitch] = useState(preschoolPreset.pitch);
  const [volume, setVolume] = useState(preschoolPreset.volume);

  const refreshVoices = useCallback(() => {
    void preloadVoices().then(() => setVoices(getAvailableVoices()));
  }, []);

  useEffect(() => {
    refreshVoices();
  }, [refreshVoices]);

  const probeExternal = useCallback(async () => {
    if (!cfg.apiUrl) {
      setProbe("未配置 API URL（请求未发出）");
      return;
    }
    const probeBody: Record<string, unknown> = minimalProbe
      ? {
          text: "你好呀，欢迎来到答题挑战。",
          style: "defaultNarrator",
          debugMinimal: true,
        }
      : (buildExternalTtsRequestBody("测试", style) as Record<string, unknown>);

    setBusy(true);
    setProbe("探测中…");
    const ctrl = new AbortController();
    const probeTimeoutMs = Math.max(cfg.externalTimeoutMs, 25_000);
    const t = window.setTimeout(() => ctrl.abort(), probeTimeoutMs);
    try {
      const res = await fetch(cfg.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(probeBody),
        cache: "no-store",
        signal: ctrl.signal,
      });
      window.clearTimeout(t);
      const ct = res.headers.get("content-type") || "";
      const vid = res.headers.get("x-tts-voice-id") ?? res.headers.get("X-TTS-Voice-Id");
      const vname = res.headers.get("x-tts-voice-name") ?? res.headers.get("X-TTS-Voice-Name");
      const prov =
        res.headers.get("x-tts-provider") ?? res.headers.get("X-TTS-Provider");
      const dm =
        res.headers.get("x-tts-debug-minimal") ?? res.headers.get("X-TTS-Debug-Minimal");
      const sb =
        res.headers.get("x-tts-synthesis-branch") ?? res.headers.get("X-TTS-Synthesis-Branch");
      const wr =
        res.headers.get("x-tts-working-reason") ?? res.headers.get("X-TTS-Working-Reason");
      const voiceHint =
        [vid || vname ? `Voice=${vid ?? vname}` : null, prov ? `Provider=${prov}` : null]
          .filter(Boolean)
          .join(" · ") || "";
      const voiceHintSuffix = voiceHint ? ` · ${voiceHint}` : "";
      if (res.ok && (ct.includes("audio") || ct.includes("mpeg"))) {
        const blob = await res.blob();
        recordTtsApiProbeResult({
          ok: true,
          httpStatus: res.status,
          contentType: ct,
          requestBody: probeBody,
          voiceId: vid,
          voiceName: vname,
          provider: prov,
          debugMinimalHeader: dm,
          synthesisBranchHeader: sb,
          workingReasonHeader: wr,
        });
        setProbe(
          `OK：HTTP ${res.status}，Content-Type=${ct || "（空）"}，body≈${blob.size}B（二进制音频）${voiceHintSuffix}`
        );
      } else if (res.ok && ct.includes("json")) {
        const j = (await res.json()) as { audioUrl?: string; error?: string };
        recordTtsApiProbeResult({
          ok: false,
          httpStatus: res.status,
          contentType: ct,
          requestBody: probeBody,
          errorBodyText: JSON.stringify(j),
          voiceId: vid,
          voiceName: vname,
          provider: prov,
          debugMinimalHeader: dm,
          synthesisBranchHeader: sb,
          workingReasonHeader: wr,
        });
        if (j.error) setProbe(`OK HTTP 但 JSON 含 error：${j.error}`);
        else if (j.audioUrl)
          setProbe(`OK：HTTP ${res.status}，JSON 含 audioUrl（长度 ${j.audioUrl.length}）`);
        else setProbe(`OK HTTP ${res.status}，但 JSON 缺 audioUrl（格式不正确）`);
      } else {
        const raw = await res.text();
        recordTtsApiProbeResult({
          ok: false,
          httpStatus: res.status,
          contentType: ct,
          requestBody: probeBody,
          errorBodyText: raw,
          voiceId: vid,
          voiceName: vname,
          provider: prov,
          debugMinimalHeader: dm,
          synthesisBranchHeader: sb,
          workingReasonHeader: wr,
        });
        if (ct.includes("application/json")) {
          try {
            const j = JSON.parse(raw) as Record<string, unknown>;
            setProbe(
              `失败 HTTP ${res.status}，JSON：${JSON.stringify(j, null, 0).replace(/\s+/g, " ")}`
            );
          } catch {
            setProbe(`失败 HTTP ${res.status}，Content-Type=${ct || "—"} · ${raw.slice(0, 400)}`);
          }
        } else {
          setProbe(`失败 HTTP ${res.status}，Content-Type=${ct || "—"} · ${raw.slice(0, 400)}`);
        }
      }
    } catch (e) {
      window.clearTimeout(t);
      if (e instanceof DOMException && e.name === "AbortError") {
        recordTtsApiProbeResult({
          ok: false,
          httpStatus: 0,
          contentType: "",
          requestBody: probeBody,
          clientError: `请求超时/中断（${probeTimeoutMs}ms 内无完整响应，与业务层 external 超时一致）`,
        });
        setProbe(
          `请求超时/中断（${probeTimeoutMs}ms 内无完整响应，与业务层 external 超时一致）`
        );
      } else {
        recordTtsApiProbeResult({
          ok: false,
          httpStatus: 0,
          contentType: "",
          requestBody: probeBody,
          clientError: `网络或 fetch 异常：${e instanceof Error ? e.message : String(e)}`,
        });
        setProbe(`网络或 fetch 异常：${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      setDiagTick((x) => x + 1);
      setBusy(false);
    }
  }, [cfg.apiUrl, cfg.externalTimeoutMs, style, minimalProbe]);

  const voiceSep = useMemo(
    () => summarizeBoyStyleVoiceSeparation(voices),
    [voices]
  );

  const rt = useMemo(() => getTtsRuntimeStatus(), [diagTick]);

  if (process.env.NODE_ENV !== "development") return null;

  const panelPreset = resolveBrowserPresetValues(style, { rate, pitch, volume });
  const previewVoice = pickBestVoice(style);
  const zhCount = countZhVoices(voices);

  const honestBrowserMode =
    !preferEx || rt.fallback || rt.engine === "browser";
  const externalWorked =
    preferEx && rt.engine === "external" && !rt.fallback && rt.externalRequestStatus === "ok";

  const applyYoungerPreset = () => {
    setStyle("preschoolBoy");
    const p = resolveBrowserPresetValues("preschoolBoy");
    setRate(p.rate);
    setPitch(p.pitch);
    setVolume(p.volume);
  };

  const applyNaturalPreset = () => {
    setStyle("storybookBoy");
    const p = resolveBrowserPresetValues("storybookBoy");
    setRate(p.rate);
    setPitch(p.pitch);
    setVolume(p.volume);
  };

  /** bright→hero→story→little→preschool，并同步请求语义与浏览器预设 */
  const applyStepYounger = () => {
    const next = stepBoyStyleYounger(style);
    setStyle(next);
    const p = resolveBrowserPresetValues(next);
    setRate(p.rate);
    setPitch(p.pitch);
    setVolume(p.volume);
  };

  /** 在男孩线内提高活泼/表现（不依赖单纯抬 pitch） */
  const applyMoreLively = () => {
    const next = stepBoyStyleMoreLively(style);
    setStyle(next);
    const p = resolveBrowserPresetValues(next);
    setRate(p.rate);
    setPitch(p.pitch);
    setVolume(p.volume);
  };

  const playAndRefresh = () => {
    void speakText(text, {
      style,
      interrupt: true,
      rate,
      pitch,
      volume,
      forceExternalWorkingVoice: forceWorkingPlay || cfg.forceExternalWorkingVoice,
    }).finally(() => setDiagTick((x) => x + 1));
  };

  const engineIntent = preferEx ? "external（优先）" : "browser（仅浏览器引擎）";

  const optionLabel = (k: TTSVoiceStyle) => {
    if (honestBrowserMode && isBoyStyle(k)) {
      return `${BOY_BROWSER_PRESET_LABEL[k]}（${k}）`;
    }
    return `${k} — ${TTS_STYLE_CONFIG[k].label}`;
  };

  const showVoiceSection =
    isBrowserTtsSupported() &&
    (!preferEx || rt.engine === "browser" || rt.fallback);

  return (
    <div className="fixed bottom-4 right-4 z-[200] max-h-[min(82vh,620px)] w-[min(94vw,400px)] overflow-auto rounded-xl border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-800 shadow-xl backdrop-blur-sm">
      <div className="mb-2 font-semibold text-slate-900">TTS 调试（开发）</div>

      <p className="mb-1 text-slate-600">
        配置引擎倾向：<span className="font-mono text-slate-900">{engineIntent}</span>
      </p>
      <p className="mb-1 text-slate-600">
        外部超时：<span className="font-mono">{cfg.externalTimeoutMs}ms</span>（取 max(基线, 25000)；
        <span className="font-mono">NEXT_PUBLIC_TTS_TIMEOUT_MS</span>）
      </p>
      <p className="mb-1 text-slate-600">
        环境变量强制 working voice（<span className="font-mono">NEXT_PUBLIC_TTS_FORCE_EXTERNAL_WORKING_VOICE</span>
        ）：<span className="font-mono">{cfg.forceExternalWorkingVoice ? "是" : "否"}</span>
      </p>
      <p className="mb-1 text-slate-600">
        最近实际引擎：<span className="font-mono text-slate-900">{rt.engine ?? "—"}</span>
      </p>
      <p className="mb-1 text-slate-600">
        是否浏览器兜底：
        <span className="font-mono text-slate-900">
          {rt.fallback ? "是" : rt.engine ? "否" : "—"}
        </span>
      </p>

      {rt.lastFallbackReason ? (
        <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-950">
          <div className="font-medium text-amber-900">回退 / 跳过 external 原因</div>
          <p className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-snug">
            {rt.lastFallbackReason}
          </p>
        </div>
      ) : null}

      {preferEx ? (
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="font-medium text-slate-800">外部 TTS 状态</div>
          <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-700">
            <li>请求阶段：{rt.externalRequestStatus}</li>
            <li>最近一次发起请求：{formatTime(rt.lastExternalAttemptAt)}</li>
            <li>成功拿到可播放数据（流/URL）：{formatTime(rt.lastExternalFetchedOkAt)}</li>
            <li>外部链路播放结束：{formatTime(rt.lastExternalSuccessAt)}</li>
            <li>
              外部曾成功拿到可播放音频：
              {rt.lastExternalFetchedOkAt ? "是" : "否"}
            </li>
            <li className="break-all">
              服务端声线 id（响应头）：{rt.lastExternalVoiceId ?? "—"}
            </li>
            <li className="break-all">
              服务端声线 name（响应头）：{rt.lastExternalVoiceName ?? "—"}
            </li>
            <li className="break-all">
              Provider（响应头）：{rt.lastExternalProvider ?? "—"}
            </li>
            <li className="break-all">
              最近一次发送到 /api/tts 的请求体：
              {rt.lastExternalRequestBody ? "" : " —"}
              {rt.lastExternalRequestBody ? (
                <pre className="mt-0.5 whitespace-pre-wrap break-words rounded bg-white/70 p-1 text-[9px] leading-snug">
                  {JSON.stringify(rt.lastExternalRequestBody, null, 2)}
                </pre>
              ) : null}
            </li>
            <li className="break-all">
              服务端错误 stage / provider / detail：{" "}
              <span className="text-slate-900">
                {rt.lastExternalServerStage ?? "—"} / {rt.lastExternalServerProvider ?? "—"} /{" "}
                {rt.lastExternalServerDetail ?? "—"}
              </span>
            </li>
            <li className="break-all">
              服务端 requestedStyle / resolvedStyle / resolvedVoice：
              <span className="text-slate-900">
                {" "}
                {rt.lastExternalServerRequestedStyle ?? "—"} / {rt.lastExternalServerResolvedStyle ?? "—"} /{" "}
                {rt.lastExternalServerResolvedVoice ?? "—"}
              </span>
            </li>
            <li className="break-all">
              服务端 error.code / error.message：
              <span className="text-slate-900">
                {" "}
                {rt.lastExternalServerErrCode ?? "—"} / {rt.lastExternalServerErrMessage ?? "—"}
              </span>
            </li>
            <li>
              minimal probe 最近一次是否成功（仅 debugMinimal 成功响应可判定）：
              <span className="font-mono text-slate-900">
                {rt.lastExternalMinimalProbeOk == null ? "—" : rt.lastExternalMinimalProbeOk ? "是" : "否"}
              </span>
            </li>
            <li className="break-all">
              服务端 synthesis 分支（X-TTS-Synthesis-Branch）：
              <span className="font-mono text-slate-900">{rt.lastExternalSynthesisBranch ?? "—"}</span>
            </li>
            <li className="break-all">
              working 原因（X-TTS-Working-Reason）：
              <span className="font-mono text-slate-900">{rt.lastExternalWorkingReason || "—"}</span>
            </li>
            <li>
              本次 external 是否拿到可播放二进制（onStreamReady）：
              <span className="font-mono text-slate-900">
                {rt.lastExternalPlaybackGotAudio == null ? "—" : rt.lastExternalPlaybackGotAudio ? "是" : "否"}
              </span>
            </li>
            {rt.lastExternalErrorCode ? (
              <>
                <li className="text-red-800">错误码：{rt.lastExternalErrorCode}</li>
                <li className="whitespace-pre-wrap break-words text-red-800">
                  错误信息：{rt.lastExternalErrorMessage ?? "—"}
                </li>
                {rt.lastExternalHttpStatus != null ? (
                  <li>HTTP：{rt.lastExternalHttpStatus}</li>
                ) : null}
                {rt.lastExternalContentType ? (
                  <li>Content-Type：{rt.lastExternalContentType}</li>
                ) : null}
                {rt.lastExternalResponseSnippet ? (
                  <li className="break-all text-red-900">
                    响应片段：{rt.lastExternalResponseSnippet}
                  </li>
                ) : null}
              </>
            ) : (
              <li className="text-slate-500">（尚无外部错误记录，或上次走浏览器未请求）</li>
            )}
          </ul>
        </div>
      ) : null}

      {externalWorked ? (
        <p className="mb-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
          上次播报走外部引擎且未标记兜底：style 差异应由服务端/外部音色体现（非浏览器变调）。
        </p>
      ) : null}

      <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50/70 p-2 text-indigo-950">
        <div className="font-medium">年龄感评估（按配置目标，非主观听测）</div>
        <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed">
          <li>
            <span className="font-semibold">当前面板 style：</span>
            {ageAssessmentLabel(style)}
          </li>
          <li>{voiceCategoryHint(style)}</li>
          <li>
            <span className="font-semibold">目标年龄段：</span>
            {TTS_STYLE_VOICE_SEMANTICS[style].targetAgeUiHint}
            <span className="font-mono text-slate-600">（targetAge={TTS_STYLE_VOICE_SEMANTICS[style].targetAge}）</span>
          </li>
          <li>
            <span className="font-semibold">当前活泼度（liveliness）：</span>
            <span className="font-mono">{TTS_STYLE_VOICE_SEMANTICS[style].liveliness}</span>
          </li>
          <li className="font-mono text-[9px]">
            maturity={TTS_STYLE_VOICE_SEMANTICS[style].maturity} · thinness=
            {TTS_STYLE_VOICE_SEMANTICS[style].thinness} · brightness=
            {TTS_STYLE_VOICE_SEMANTICS[style].brightness} · warmth=
            {TTS_STYLE_VOICE_SEMANTICS[style].warmth} · softness=
            {TTS_STYLE_VOICE_SEMANTICS[style].softness} · expressiveness=
            {TTS_STYLE_VOICE_SEMANTICS[style].expressiveness}
          </li>
          <li className="text-indigo-900/90">
            说明：「男童音」与「少年音」「成年年轻男声」不同；仅靠抬 pitch 的少年神经网络不等于幼态男童。
          </li>
        </ul>
      </div>

      {honestBrowserMode ? (
        <div className="mb-2 rounded-lg border border-amber-400 bg-amber-50/90 p-2 text-amber-950">
          <p className="font-medium">浏览器兜底说明</p>
          <p className="mt-1 leading-relaxed">
            当前为浏览器兜底模式，只能近似模拟幼态和活泼感，无法真正实现 5–7 岁小男孩音色。
          </p>
          {isBoyStyle(style) ? (
            <>
              <p className="mt-1 leading-relaxed">
                当前处于浏览器播报路径时，
                <span className="font-semibold">
                  preschoolBoy / littleBoy / storybookBoy / heroBoy / brightBoy
                </span>{" "}
                仅表示<strong>学龄前 / 幼态 / 绘本感 / 主角感 / 清亮</strong>的
                <strong>语速、音高、音量预设</strong>，不是独立神经网络音色。
              </p>
              <p className="mt-1 leading-relaxed">
                若系统只有少量中文 voice，多个预设可能<strong>共用同一 voiceURI</strong>，听感差异主要来自
                rate/pitch。
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="mb-1 text-slate-600">
        面板所选 style：<span className="font-mono">{style}</span>
        {honestBrowserMode && isBoyStyle(style) ? (
          <span className="text-amber-800"> → {BOY_BROWSER_PRESET_LABEL[style]}</span>
        ) : null}
      </p>
      <p className="mb-1 text-slate-600">
        最近一次播报 style：<span className="font-mono">{rt.lastSpeakStyle ?? "—"}</span>
      </p>

      <div className="mb-2 rounded border border-slate-100 bg-slate-50/80 p-2">
        <div className="font-medium text-slate-800">若本次走浏览器：面板参数与选声预览</div>
        <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-700">
          <li>
            rate / pitch / volume：{panelPreset.rate.toFixed(2)} / {panelPreset.pitch.toFixed(2)} /{" "}
            {panelPreset.volume.toFixed(2)}
          </li>
          <li>本机中文 voice 数量：{zhCount}</li>
          <li className="break-words">
            当前 style 将优先选：{previewVoice?.name ?? "—"}
          </li>
          <li>lang：{previewVoice?.lang ?? "—"}</li>
          <li className="break-all">voiceURI：{shortUri(previewVoice?.voiceURI ?? null, 72)}</li>
        </ul>
      </div>

      <div className="mb-2 rounded border border-slate-100 bg-slate-50/80 p-2">
        <div className="font-medium text-slate-800">上一次实际播报（浏览器字段）</div>
        <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-700">
          <li>voice：{rt.browserVoiceName ?? "—"}</li>
          <li>lang：{rt.browserVoiceLang ?? "—"}</li>
          <li className="break-all">voiceURI：{shortUri(rt.browserVoiceUri, 72)}</li>
          <li>
            实际 rate / pitch / volume：
            {rt.lastBrowserEffectiveRate ?? "—"} / {rt.lastBrowserEffectivePitch ?? "—"} /{" "}
            {rt.lastBrowserEffectiveVolume ?? "—"}
          </li>
        </ul>
        {rt.lastSpeakStyle === style && rt.browserVoiceUri && previewVoice?.voiceURI ? (
          <p className="mt-1 text-[10px] text-slate-600">
            与当前面板同 style 预览 voiceURI{" "}
            {rt.browserVoiceUri === previewVoice.voiceURI ? "一致" : "不一致（请再点播放刷新）"}。
          </p>
        ) : null}
      </div>

      <div className="mb-2 rounded border border-slate-200 p-2">
        <div className="font-medium text-slate-800">男孩五预设 · 是否共用声线（本机）</div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-700">{voiceSep.hint}</p>
        <ul className="mt-1 font-mono text-[9px] text-slate-600">
          {BOY_STYLES.map((st) => {
            const v = pickBestVoiceForStyle(st, voices);
            return (
              <li key={st} className="break-all">
                {st} → {v?.name ?? "—"} · {shortUri(v?.voiceURI ?? null, 40)}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mb-1 text-slate-600">
        语义画像（外部用）：age={TTS_STYLE_PROFILE[style].age} / tone={TTS_STYLE_PROFILE[style].tone} / …
      </p>
      <p className="mb-1 text-slate-600">
        API：<span className="font-mono break-all">{cfg.apiUrl}</span>
      </p>
      <p className="mb-1 text-slate-600">允许回退浏览器：{cfg.fallbackToBrowser ? "是" : "否"}</p>
      <p className="mb-2 text-slate-600">可播报：{isTtsPlaybackAvailable() ? "是" : "否"}</p>

      {rt.externalDownUntilMs > 0 ? (
        <p className="mb-2 text-[10px] text-amber-700">
          外部熔断：约 {(rt.externalDownUntilMs / 1000).toFixed(1)}s 内不发起 external 请求
        </p>
      ) : null}

      <label className="mb-2 flex flex-col gap-0.5">
        <span className="text-slate-500">
          {honestBrowserMode ? "预设 / 风格（浏览器下为参数预设）" : "风格（外部引擎）"}
        </span>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1"
          value={style}
          onChange={(e) => setStyle(e.target.value as TTSVoiceStyle)}
        >
          {TTS_STYLE_UI_ORDER.map((k) => (
            <option key={k} value={k}>
              {optionLabel(k)}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-2 flex flex-col gap-0.5">
        <span className="text-slate-500">文本</span>
        <textarea
          className="min-h-[72px] rounded border border-slate-200 p-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="secondary" className="text-xs" onClick={applyStepYounger}>
          更幼一点
        </Button>
        <Button type="button" size="sm" variant="secondary" className="text-xs" onClick={applyMoreLively}>
          更活泼一点
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={applyYoungerPreset}>
          最幼（直接 preschool）
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={applyNaturalPreset}>
          更自然（绘本）
        </Button>
        <p className="col-span-2 text-[10px] leading-relaxed text-slate-600">
          「更幼一点」按 bright→hero→story→little→preschool 步进并同步外部语义与浏览器预设；「更活泼一点」在男孩线内提高
          liveliness / expressiveness，避免只靠抬 pitch。
        </p>
      </div>

      <label className="mb-1 flex flex-col gap-0.5">
        <span className="text-slate-500">rate {rate.toFixed(2)}（覆盖浏览器预设；外部忽略）</span>
        <input
          type="range"
          min={0.6}
          max={1.2}
          step={0.01}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </label>
      <label className="mb-1 flex flex-col gap-0.5">
        <span className="text-slate-500">pitch {pitch.toFixed(2)}（覆盖浏览器预设；外部忽略）</span>
        <input
          type="range"
          min={0.9}
          max={1.55}
          step={0.01}
          value={pitch}
          onChange={(e) => setPitch(Number(e.target.value))}
        />
      </label>
      <label className="mb-2 flex flex-col gap-0.5">
        <span className="text-slate-500">volume {volume.toFixed(2)}（覆盖浏览器预设；外部忽略）</span>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setText(TTS_TEXT.welcome)}>
          试听：欢迎
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => setText(TTS_TEXT.questionIntro)}
        >
          试听：出题引导
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setText(TTS_TEXT.thinking)}>
          试听：别着急
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setText(TTS_TEXT.finish)}>
          试听：收尾
        </Button>
      </div>

      {preferEx ? (
        <label className="mb-2 flex items-center gap-2 text-[10px] text-slate-700">
          <input
            type="checkbox"
            checked={forceWorkingPlay}
            onChange={(e) => setForceWorkingPlay(e.target.checked)}
          />
          <span>
            单次播放附带 <span className="font-mono">forceExternalWorkingVoice</span>（请求体最小化，服务端强制已验证
            voice）
          </span>
        </label>
      ) : null}

      {preferEx ? (
        <label className="mb-2 flex items-center gap-2 text-[10px] text-slate-700">
          <input
            type="checkbox"
            checked={minimalProbe}
            onChange={(e) => setMinimalProbe(e.target.checked)}
          />
          <span>
            最小链路探测（debugMinimal：固定短文本 + <span className="font-mono">zh-CN-YunxiNeural</span>，不走
            preschoolBoy 映射）
          </span>
        </label>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" className="text-xs" disabled={busy} onClick={playAndRefresh}>
          播放
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => {
            stopSpeak();
            setDiagTick((x) => x + 1);
          }}
        >
          停止
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs" disabled={busy} onClick={() => void probeExternal()}>
          探测外部 API
        </Button>
      </div>

      {preferEx ? (
        <p className="mb-2 text-slate-600">
          手动探测结果：<span className="break-words font-mono text-[10px]">{probe}</span>
        </p>
      ) : null}

      {showVoiceSection ? (
        <>
          <p className="mb-1 font-medium text-slate-700">本机 Voice 列表（浏览器）</p>
          <Button type="button" size="sm" variant="ghost" className="mb-2 text-xs" onClick={() => refreshVoices()}>
            刷新 voice 列表
          </Button>
          <ul className="max-h-28 overflow-auto rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] leading-snug">
            {voices.length === 0 ? (
              <li className="text-slate-400">（空，点刷新）</li>
            ) : (
              voices.map((v) => (
                <li key={v.voiceURI}>
                  {v.name} · {v.lang}
                </li>
              ))
            )}
          </ul>
        </>
      ) : preferEx ? (
        <p className="text-slate-500">
          当前为 external 且未兜底时，隐藏浏览器 voice 列表；若刚失败回退，请再点「播放」或查看上方原因。
        </p>
      ) : null}

      {!isBrowserTtsSupported() ? (
        <p className="text-amber-800">当前环境无 speechSynthesis</p>
      ) : null}
    </div>
  );
}
