import type { STTProvider } from "./interface";
import { extractSingleChoiceLetter } from "@/lib/quiz/speech-choice";

function scoreTranscriptForChoice(text: string, confidence: number): number {
  const extracted = extractSingleChoiceLetter(text);
  const c =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? confidence
      : 0.5;
  if (extracted) return 100 + c;
  return c;
}

function pickBestTranscript(result: SpeechRecognitionResult): string {
  let best = "";
  let bestScore = -1;
  const len = result.length;
  for (let i = 0; i < len; i++) {
    const alt = result[i];
    if (!alt) continue;
    const text = alt.transcript ?? "";
    const conf = alt.confidence;
    const s = scoreTranscriptForChoice(text, conf);
    if (s > bestScore) {
      bestScore = s;
      best = text;
    }
  }
  return best;
}

type RecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * 使用浏览器 Web Speech API（Chrome / Edge 等，需 HTTPS 或 localhost）。

 * 中文识别：`lang = zh-CN`。

 */

export class BrowserWebSpeechSTTProvider implements STTProvider {

  static isSupported(): boolean {

    return getRecognitionCtor() !== null;

  }



  listenOnce(): Promise<string> {

    const Ctor = getRecognitionCtor();

    if (!Ctor) return Promise.resolve("");



    return new Promise((resolve) => {

      const rec = new Ctor();

      let settled = false;

      const timeoutMs = 25_000;



      const finish = (text: string) => {

        if (settled) return;

        settled = true;

        window.clearTimeout(timer);

        try {

          rec.stop();

        } catch {

          /* already stopped */

        }

        resolve(text.trim());

      };



      const timer = window.setTimeout(() => {

        try {

          rec.abort();

        } catch {

          /* */

        }

        finish("");

      }, timeoutMs);



      rec.lang = "zh-CN";

      rec.interimResults = false;

      rec.continuous = false;

      rec.maxAlternatives = 8;



      rec.onresult = (event: SpeechRecognitionEvent) => {

        const last = event.results.length - 1;

        const res = event.results[last];

        const transcript =
          res && res.length > 0 ? pickBestTranscript(res) : "";

        finish(transcript);

      };



      rec.onerror = (event: SpeechRecognitionErrorEvent) => {

        window.clearTimeout(timer);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {

          finish("");

          return;

        }

        if (

          event.error === "no-speech" ||

          event.error === "aborted" ||

          event.error === "audio-capture"

        ) {

          finish("");

          return;

        }

        finish("");

      };



      rec.onend = () => {

        window.clearTimeout(timer);

        if (!settled) finish("");

      };



      try {

        rec.start();

      } catch {

        window.clearTimeout(timer);

        finish("");

      }

    });

  }

}
