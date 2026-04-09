import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().max(6000),
});

/** 云希年轻男声；配合 narration-relaxed 更像真人讲述，少「机器味」 */
const DEFAULT_VOICE = "zh-CN-YunxiNeural";
/** 默认不抬 pitch/rate，保留神经网络自然韵律；需要童声可设 QUIZ_EDGE_TTS_ROLE=Boy 并略调 pitch */
const DEFAULT_PITCH = "default";
const DEFAULT_RATE = "default";

async function writeTtsMp3ToFile(
  text: string,
  tmp: string,
  voice: string,
  pitch: string,
  rate: string,
  volume: string,
  timeout: number
): Promise<void> {
  const { EdgeTTS } = await import("node-edge-tts");
  const synth = new EdgeTTS({
    voice,
    lang: "zh-CN",
    pitch,
    rate,
    volume,
    timeout,
  });
  await synth.ttsPromise(text, tmp);
}

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

  const text = parsed.data.text.trim();
  if (!text) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const voice = process.env.QUIZ_EDGE_TTS_VOICE?.trim() || DEFAULT_VOICE;
  const pitch = process.env.QUIZ_EDGE_TTS_PITCH?.trim() || DEFAULT_PITCH;
  const rate = process.env.QUIZ_EDGE_TTS_RATE?.trim() || DEFAULT_RATE;
  const volume = process.env.QUIZ_EDGE_TTS_VOLUME?.trim() || "default";
  const timeout = Number(process.env.QUIZ_EDGE_TTS_TIMEOUT ?? "25000") || 25000;

  const tmp = join(tmpdir(), `quiz-tts-${randomBytes(16).toString("hex")}.mp3`);

  try {
    await writeTtsMp3ToFile(text, tmp, voice, pitch, rate, volume, timeout);
    const buf = await readFile(tmp);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/quiz/tts]", e);
    return NextResponse.json({ error: "TTS synthesis failed" }, { status: 502 });
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
