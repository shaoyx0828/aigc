import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";
import WebSocket from "ws";

const require = createRequire(import.meta.url);
const drm = require("node-edge-tts/dist/drm.js") as {
  TRUSTED_CLIENT_TOKEN: string;
  generateSecMsGecToken: () => string;
  CHROMIUM_FULL_VERSION: string;
};

const DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return c;
    }
  });
}

function buildSsml(opts: {
  lang: string;
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
  text: string;
  expressAs?: { style: string; role?: string; styleDegree?: string };
}): string {
  const inner = `<prosody rate="${opts.rate}" pitch="${opts.pitch}" volume="${opts.volume}">
            ${escapeXml(opts.text)}
          </prosody>`;
  const voiced =
    opts.expressAs != null
      ? (() => {
          const ea = opts.expressAs;
          let attrs = `style="${escapeXml(ea.style)}"`;
          if (ea.role) attrs = `role="${escapeXml(ea.role)}" ${attrs}`;
          if (ea.styleDegree != null) {
            attrs += ` styledegree="${escapeXml(ea.styleDegree)}"`;
          }
          return `<mstts:express-as ${attrs}>
          ${inner}
        </mstts:express-as>`;
        })()
      : inner;

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${opts.lang}">
        <voice name="${escapeXml(opts.voice)}">
          ${voiced}
        </voice>
      </speak>`;
}

function connectEdgeTtsWs(): Promise<WebSocket> {
  const ver = drm.CHROMIUM_FULL_VERSION.split(".")[0] ?? "143";
  const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${drm.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${drm.generateSecMsGecToken()}&Sec-MS-GEC-Version=1-${drm.CHROMIUM_FULL_VERSION}`;

  return new Promise((resolve, reject) => {
    const wsConnect = new WebSocket(wsUrl, {
      host: "speech.platform.bing.com",
      origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      headers: {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver}.0.0.0 Safari/537.36 Edg/${ver}.0.0.0`,
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    wsConnect.on("open", () => {
      wsConnect.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n
          {
            "context": {
              "synthesis": {
                "audio": {
                  "metadataoptions": {
                    "sentenceBoundaryEnabled": "false",
                    "wordBoundaryEnabled": "true"
                  },
                  "outputFormat": "${DEFAULT_OUTPUT_FORMAT}"
                }
              }
            }
          }
        `);
      resolve(wsConnect);
    });
    wsConnect.on("error", reject);
  });
}

export type EdgeTtsSsmlSynthOptions = {
  text: string;
  audioPath: string;
  voice: string;
  lang: string;
  rate: string;
  pitch: string;
  volume: string;
  timeout: number;
  /** style 必填；role 可选（如 Boy），不填时更像自然讲述而非角色扮演 */
  expressAs?: { style: string; role?: string; styleDegree?: string };
};

/**
 * 与 node-edge-tts 相同协议，可注入 mstts:express-as（讲述风格 / 可选角色）。
 */
export function synthesizeEdgeTtsToPath(
  opts: EdgeTtsSsmlSynthOptions
): Promise<void> {
  const ssml = buildSsml({
    lang: opts.lang,
    voice: opts.voice,
    rate: opts.rate,
    pitch: opts.pitch,
    volume: opts.volume,
    text: opts.text,
    expressAs: opts.expressAs,
  });

  return (async () => {
    const _wsConnect = await connectEdgeTtsWs();
    return new Promise<void>((resolve, reject) => {
      const audioStream = createWriteStream(opts.audioPath);
      const timeout = setTimeout(() => reject(new Error("Edge TTS timed out")), opts.timeout);
      _wsConnect.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
        if (isBinary) {
          const separator = "Path:audio\r\n";
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const sepIdx = buf.indexOf(separator);
          if (sepIdx === -1) return;
          const index = sepIdx + separator.length;
          const audioData = buf.subarray(index);
          audioStream.write(audioData);
        } else {
          const message = data.toString();
          if (message.includes("Path:error")) {
            clearTimeout(timeout);
            _wsConnect.close();
            audioStream.destroy();
            reject(new Error("Edge TTS synthesis error"));
            return;
          }
          if (message.includes("Path:turn.end")) {
            audioStream.end();
            audioStream.on("finish", () => {
              _wsConnect.close();
              clearTimeout(timeout);
              resolve();
            });
          }
        }
      });
      _wsConnect.on("error", (e: Error) => {
        clearTimeout(timeout);
        reject(e);
      });
      const requestId = randomBytes(16).toString("hex");
      _wsConnect.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
          ssml
      );
    });
  })();
}
