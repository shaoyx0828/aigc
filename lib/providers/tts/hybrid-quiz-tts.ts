"use client";

import { getTtsClientConfig } from "@/src/config/tts";
import type { TTSProvider } from "./interface";
import { BrowserTTSProvider } from "./browser-tts";

/**
 * 优先走服务端 Edge TTS（童声向神经网络）；失败或无法播放时回退浏览器朗读（同样偏童声）。
 */
export class HybridQuizTTSProvider implements TTSProvider {
  private readonly browser = new BrowserTTSProvider();
  private gen = 0;
  private edgeAudio: HTMLAudioElement | null = null;
  private edgeUrl: string | null = null;

  private bumpAndCleanup(): void {
    this.gen++;
    if (this.edgeAudio) {
      this.edgeAudio.pause();
      this.edgeAudio = null;
    }
    if (this.edgeUrl) {
      URL.revokeObjectURL(this.edgeUrl);
      this.edgeUrl = null;
    }
    this.browser.stop();
  }

  private static async blobLooksLikeMp3(blob: Blob): Promise<boolean> {
    if (blob.size < 16) return false;
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const frame =
      head[0] === 0xff && head.length > 1 && (head[1]! & 0xe0) === 0xe0;
    const id3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
    return frame || id3;
  }

  speak(text: string): Promise<void> {
    this.bumpAndCleanup();
    const my = this.gen;

    return (async () => {
      const fallbackBrowser = async () => {
        if (my !== this.gen) return;
        await this.browser.speak(text);
      };

      try {
        const ctrl = new AbortController();
        const ttsMs = Math.max(getTtsClientConfig().externalTimeoutMs, 25_000);
        const timer = window.setTimeout(() => ctrl.abort(), ttsMs);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, style: "preschoolBoy" }),
          cache: "no-store",
          signal: ctrl.signal,
        });
        window.clearTimeout(timer);

        if (!res.ok) {
          await fallbackBrowser();
          return;
        }

        const blob = await res.blob();
        if (my !== this.gen) return;

        if (!(await HybridQuizTTSProvider.blobLooksLikeMp3(blob))) {
          await fallbackBrowser();
          return;
        }

        const url = URL.createObjectURL(blob);
        this.edgeUrl = url;
        const audio = new Audio(url);
        this.edgeAudio = audio;

        try {
          await audio.play();
        } catch {
          URL.revokeObjectURL(url);
          if (this.edgeUrl === url) this.edgeUrl = null;
          this.edgeAudio = null;
          await fallbackBrowser();
          return;
        }

        await new Promise<void>((resolve) => {
          const done = () => {
            URL.revokeObjectURL(url);
            if (this.edgeUrl === url) this.edgeUrl = null;
            if (this.edgeAudio === audio) this.edgeAudio = null;
            resolve();
          };
          audio.onended = done;
          audio.onerror = done;
        });
        if (my !== this.gen) return;
      } catch {
        await fallbackBrowser();
      }
    })();
  }

  stop(): void {
    this.bumpAndCleanup();
  }
}
