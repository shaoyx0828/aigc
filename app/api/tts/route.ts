import { NextResponse } from "next/server";
import { z } from "zod";
import type { TTSVoiceStyle } from "@/src/config/tts";
import { getEdgeSynthesisParamsForStyle } from "@/lib/server/tts-edge-by-style";
import {
  EDGE_VERIFIED_WORKING_VOICE,
  WORKING_VOICE_PLAYFUL_PITCH,
  WORKING_VOICE_PLAYFUL_RATE,
  WORKING_VOICE_PLAYFUL_VOLUME,
  resolveWorkingVoiceSynthesis,
} from "@/lib/server/tts-edge-working-voice";
import { synthesizeTtsStyleToMp3Buffer } from "@/lib/server/synthesize-quiz-tts-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

process.env.WS_NO_BUFFER_UTIL ||= "1";
process.env.WS_NO_UTF_8_VALIDATE ||= "1";

let edgeFailCount = 0;
let edgeDownUntil = 0;

const styleEnum = z.enum([
  "preschoolBoy",
  "littleBoy",
  "storybookBoy",
  "heroBoy",
  "brightBoy",
  "gentleGirl",
  "defaultNarrator",
]);

const bodySchema = z
  .object({
    text: z.string().max(6000),
    style: styleEnum.optional(),
    debugMinimal: z.boolean().optional(),
    forceExternalWorkingVoice: z.boolean().optional(),
  })
  .passthrough();

/**
 * 通用 TTS：POST JSON { text, style? } → audio/mpeg（node-edge-tts WebSocket）。
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const incomingBody = parsed.data as Record<string, unknown>;
  const originalText = String(incomingBody.text ?? "").trim();
  const originalTextLength = originalText.length;
  if (!originalText) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const requestedStyle = (incomingBody.style ?? "preschoolBoy") as TTSVoiceStyle;
  const debugMinimal = incomingBody.debugMinimal === true;
  const forceExternalWorkingVoiceBody =
    incomingBody.forceExternalWorkingVoice === true;
  const style = (debugMinimal ? "defaultNarrator" : requestedStyle) as TTSVoiceStyle;

  const provider = process.env.TTS_PROVIDER_LABEL?.trim() || "edge-tts-node";

  if (provider === "edge-tts-node" && Date.now() < edgeDownUntil) {
    const sec = Math.ceil((edgeDownUntil - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: "TTS synthesis failed",
        stage: "provider_circuit_open",
        provider,
        requestedStyle,
        resolvedStyle: style,
        code: "CIRCUIT_OPEN",
        message: `edge-tts-node 熔断中，约 ${sec}s 内跳过 external 合成`,
        detail: "provider down temporarily",
      },
      { status: 503 }
    );
  }

  console.log("[tts] incoming body:", incomingBody);
  console.log("[tts] resolved style:", {
    requestedStyle,
    style,
    debugMinimal,
    forceExternalWorkingVoiceBody,
  });

  const minimalText = "你好呀，欢迎来到答题挑战。";

  let edgeParams: ReturnType<typeof getEdgeSynthesisParamsForStyle> | null = null;
  let lastSynthesisBranch = "unknown";
  let lastResolvedVoiceForErr: string | undefined;
  try {
    edgeParams = getEdgeSynthesisParamsForStyle(style);
    const { useWorkingSynthesis, reason: workingVoiceReason } =
      resolveWorkingVoiceSynthesis({
        debugMinimal,
        forceExternalWorkingVoiceBody,
        resolvedStyle: style,
      });

    const resolvedText = debugMinimal ? minimalText : originalText;
    const resolvedTextLength = resolvedText.length;

    const resolvedVoice = useWorkingSynthesis
      ? EDGE_VERIFIED_WORKING_VOICE
      : edgeParams.voice;
    const resolvedPitch = useWorkingSynthesis
      ? debugMinimal
        ? "default"
        : WORKING_VOICE_PLAYFUL_PITCH
      : edgeParams.pitch;
    const resolvedRate = useWorkingSynthesis
      ? debugMinimal
        ? "default"
        : WORKING_VOICE_PLAYFUL_RATE
      : edgeParams.rate;
    const resolvedVolume = useWorkingSynthesis
      ? debugMinimal
        ? "default"
        : WORKING_VOICE_PLAYFUL_VOLUME
      : edgeParams.volume;
    const resolvedTimeout = edgeParams.timeout;
    const resolvedExpressAs = useWorkingSynthesis
      ? null
      : (edgeParams.expressAs ?? null);

    const synthesisBranch: "debug_minimal" | "working_voice" | "full_style" =
      debugMinimal ? "debug_minimal" : useWorkingSynthesis ? "working_voice" : "full_style";
    lastSynthesisBranch = synthesisBranch;
    lastResolvedVoiceForErr = resolvedVoice;

    const fullMapPayload = {
      voice: edgeParams.voice,
      pitch: edgeParams.pitch,
      rate: edgeParams.rate,
      volume: edgeParams.volume,
      timeout: edgeParams.timeout,
      expressAs: edgeParams.expressAs ?? null,
    };

    const providerPayload = {
      provider,
      voice: resolvedVoice,
      pitch: resolvedPitch,
      rate: resolvedRate,
      volume: resolvedVolume,
      timeout: resolvedTimeout,
      expressAs: resolvedExpressAs,
      textLen: resolvedTextLength,
      textPreview: resolvedText.slice(0, 120),
      style,
      requestedStyle,
      debugMinimal,
      forceExternalWorkingVoiceBody,
      synthesisBranch,
      workingVoiceReason,
      fullStyleMapIfUnused: useWorkingSynthesis ? fullMapPayload : null,
    };

    console.log("[tts] path compare (minimal vs normal):", {
      incomingKeys: Object.keys(incomingBody),
      requestedStyle,
      resolvedStyle: style,
      synthesisBranch,
      workingVoiceReason,
      debugMinimal,
      forceExternalWorkingVoiceBody,
      resolvedVoice,
      resolvedPitch,
      resolvedRate,
      resolvedVolume,
      resolvedTextLength,
      resolvedExpressAs,
      fullStyleMap: fullMapPayload,
      providerPayload,
    });
    console.log("[tts] mapped provider payload (actual):", providerPayload);

    const buf = await synthesizeTtsStyleToMp3Buffer(resolvedText, style, {
      edgeOverrides: useWorkingSynthesis
        ? {
            voice: resolvedVoice,
            pitch: debugMinimal ? "default" : WORKING_VOICE_PLAYFUL_PITCH,
            rate: debugMinimal ? "default" : WORKING_VOICE_PLAYFUL_RATE,
            volume: debugMinimal ? "default" : WORKING_VOICE_PLAYFUL_VOLUME,
            timeout: resolvedTimeout,
          }
        : undefined,
      operationStage: "edge_tts_ttsPromise_write_tmp_mp3",
    });
    edgeFailCount = 0;
    edgeDownUntil = 0;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Voice-Id": resolvedVoice,
        "X-TTS-Voice-Name": resolvedVoice,
        "X-TTS-Provider": provider,
        "X-TTS-Debug-Minimal": debugMinimal ? "1" : "0",
        "X-TTS-Synthesis-Branch": synthesisBranch,
        "X-TTS-Working-Reason": workingVoiceReason ?? "",
      },
    });
  } catch (e) {
    const err = e as any;
    const root = err?.cause ?? err;
    const code = root?.code ? String(root.code) : err?.code ? String(err.code) : undefined;
    const message = root?.message ? String(root.message) : err?.message ? String(err.message) : String(e);
    const stack = err?.stack ? String(err.stack) : undefined;
    const cause =
      root && root !== err
        ? {
            name: root?.name,
            message: root?.message,
            code: root?.code,
            stack: root?.stack,
          }
        : err?.cause
          ? { raw: String(err.cause) }
          : undefined;
    const detail = err instanceof Error ? err.message : String(e);

    const textLength = debugMinimal ? minimalText.length : originalTextLength;
    const failurePhase = (() => {
      if (detail.includes("stage=import_node_edge_tts")) return "import_node_edge_tts";
      if (detail.includes("retry_failed")) return "edge_tts_ttsPromise_retry_failed";
      if (detail.includes("stage=edge_tts_synthesis")) return "edge_tts_ttsPromise_write_tmp_mp3";
      return "unknown";
    })();

    edgeFailCount += 1;
    if (edgeFailCount >= 3) {
      edgeDownUntil = Date.now() + 30_000;
    }

    console.error("[tts] provider error full:", {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      cause: err?.cause,
      root: {
        name: root?.name,
        message: root?.message,
        code: root?.code,
        stack: root?.stack,
      },
      provider: "edge-tts-node",
      requestedStyle,
      resolvedStyle: style,
      resolvedVoice: lastResolvedVoiceForErr ?? edgeParams?.voice,
      synthesisBranch: lastSynthesisBranch,
      textLength,
      textLengthOriginal: originalTextLength,
      textLengthResolved: textLength,
      failurePhase,
      note:
        "本项目 external 合成路径：node-edge-tts 将音频写入临时 mp3 后再由 /api/tts 一次性写入 HTTP 响应。",
      debugMinimal,
      forceExternalWorkingVoiceBody,
      edgeFailCount,
      edgeDownUntilMs: Math.max(0, edgeDownUntil - Date.now()),
    });
    console.error("[tts] synthesis error:", e);
    return NextResponse.json(
      {
        error: "TTS synthesis failed",
        stage: "server_synthesis",
        provider,
        requestedStyle,
        resolvedStyle: style,
        resolvedVoice: lastResolvedVoiceForErr ?? edgeParams?.voice,
        synthesisBranch: lastSynthesisBranch,
        code,
        message,
        stack,
        cause,
        debugMinimal,
        forceExternalWorkingVoice: forceExternalWorkingVoiceBody,
        detail,
      },
      { status: 502 }
    );
  }
}
