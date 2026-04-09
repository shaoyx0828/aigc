import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TTSVoiceStyle } from "@/lib/config/tts";
import { getEdgeSynthesisParamsForStyle } from "@/lib/server/tts-edge-by-style";

// 重要：Next dev + Node 24 环境下，某些 ws/bufferutil 组合会触发
// `bufferUtil.mask is not a function` 的 uncaughtException。
// 这里强制让 ws 走纯 JS 路径，避免依赖可选原生扩展（即便它被错误解析/注入）。
process.env.WS_NO_BUFFER_UTIL ||= "1";
process.env.WS_NO_UTF_8_VALIDATE ||= "1";

/**
 * 按风格写入临时 mp3 并返回 Buffer（供 /api/tts 等 HTTP 层使用）。
 */
export async function synthesizeTtsStyleToMp3Buffer(
  text: string,
  style: TTSVoiceStyle,
  opts?: {
    /** 覆盖 EdgeTTS 构造参数（用于 debugMinimal：固定 voice / default pitch&rate） */
    edgeOverrides?: Partial<{
      voice: string;
      pitch: string;
      rate: string;
      volume: string;
      timeout: number;
    }>;
    /** 便于日志定位：当前处于 provider 的哪个阶段 */
    operationStage?: string;
  }
): Promise<Buffer> {
  const base = getEdgeSynthesisParamsForStyle(style);
  const params = {
    ...base,
    ...(opts?.edgeOverrides ?? {}),
  };
  const tmp = join(
    tmpdir(),
    `tts-${style}-${randomBytes(12).toString("hex")}.mp3`
  );

  try {
    let EdgeTTS: unknown;
    try {
      ({ EdgeTTS } = await import("node-edge-tts"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`[tts] stage=import_node_edge_tts failed: ${msg}`);
    }

    const runOnce = async (overrides?: Partial<typeof params>) => {
      const p = { ...params, ...(overrides ?? {}) };
      const synth = new (EdgeTTS as new (cfg: unknown) => {
        ttsPromise: (t: string, out: string) => Promise<void>;
      })({
        voice: p.voice,
        lang: "zh-CN",
        pitch: p.pitch,
        rate: p.rate,
        volume: p.volume,
        timeout: p.timeout,
      });
      await synth.ttsPromise(text, tmp);
    };

    try {
      await runOnce();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isConnReset =
        /ECONNRESET/i.test(msg) ||
        // 某些库会把 code 挂在 error 上
        ((e as any)?.code && String((e as any).code).toUpperCase() === "ECONNRESET");
      const isTimeout =
        /\bTimed out\b/i.test(msg) ||
        /\btimeout\b/i.test(msg) ||
        ((e as any)?.code && String((e as any).code).toUpperCase() === "ETIMEDOUT");

      if (isConnReset) {
        // 轻量重试一次：对偶发断连更稳，不改变接口契约
        await new Promise((r) => setTimeout(r, 350));
        try {
          await runOnce();
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          throw new Error(
            `[tts] stage=edge_tts_synthesis(op=${opts?.operationStage ?? "ttsPromise"}) retry_failed: ${msg2} · voice=${params.voice} pitch=${params.pitch} rate=${params.rate} volume=${params.volume} timeout=${params.timeout} style=${style}`
          );
        }
        return await readFile(tmp);
      }

      if (isTimeout) {
        // 超时更常见于环境/网络抖动：保守重试一次
        // - 拉长 timeout
        // - 回退到默认 pitch/rate/volume，避免某些组合导致 provider 更慢
        await new Promise((r) => setTimeout(r, 200));
        try {
          await runOnce({
            timeout: Math.max(Number(params.timeout) || 0, 25_000) + 20_000,
            pitch: "default",
            rate: "default",
            volume: "default",
          });
          return await readFile(tmp);
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          throw new Error(
            `[tts] stage=edge_tts_synthesis(op=${opts?.operationStage ?? "ttsPromise"}) retry_failed: ${msg2} · voice=${params.voice} pitch=${params.pitch} rate=${params.rate} volume=${params.volume} timeout=${params.timeout} style=${style}`
          );
        }
      }

      throw new Error(
        `[tts] stage=edge_tts_synthesis(op=${opts?.operationStage ?? "ttsPromise"}) failed: ${msg} · voice=${params.voice} pitch=${params.pitch} rate=${params.rate} volume=${params.volume} timeout=${params.timeout} style=${style}`
      );
    }
    return await readFile(tmp);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
