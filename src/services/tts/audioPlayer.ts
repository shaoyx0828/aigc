/**
 * 单例 HTMLAudioElement：外部 TTS 二进制 / URL 播放，避免叠音。
 * 播放失败时 Promise reject，便于上层记录原因并 fallback，而非静默当作成功结束。
 */

type EndFn = () => void;

let objectUrl: string | null = null;
let audio: HTMLAudioElement | null = null;
let endedHandler: (() => void) | null = null;
let errorHandler: (() => void) | null = null;

function cleanupHandlers(a: HTMLAudioElement) {
  if (endedHandler) {
    a.removeEventListener("ended", endedHandler);
    endedHandler = null;
  }
  if (errorHandler) {
    a.removeEventListener("error", errorHandler);
    errorHandler = null;
  }
}

function revokeObjectUrl(): void {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

export function stopTtsAudio(): void {
  if (typeof window === "undefined") return;
  revokeObjectUrl();
  if (audio) {
    cleanupHandlers(audio);
    try {
      audio.pause();
      audio.src = "";
    } catch {
      /* ignore */
    }
    audio = null;
  }
}

export function playTtsAudioFromBlob(
  blob: Blob,
  onEnd?: EndFn,
  onStart?: () => void
): Promise<void> {
  if (typeof window === "undefined") {
    onEnd?.();
    return Promise.resolve();
  }

  stopTtsAudio();

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    objectUrl = url;
    const a = new Audio();
    audio = a;

    const finishOk = () => {
      cleanupHandlers(a);
      revokeObjectUrl();
      if (audio === a) audio = null;
      onEnd?.();
      resolve();
    };

    const fail = (err: Error) => {
      cleanupHandlers(a);
      revokeObjectUrl();
      if (audio === a) audio = null;
      reject(err);
    };

    endedHandler = finishOk;
    errorHandler = () => fail(new Error("AUDIO_ELEMENT_ERROR"));
    a.addEventListener("ended", endedHandler);
    a.addEventListener("error", errorHandler);

    a.src = url;
    a.onplaying = () => {
      onStart?.();
      a.onplaying = null;
    };

    void a.play().catch((e) => {
      const err =
        e instanceof Error ? e : new Error(typeof e === "string" ? e : "AUDIO_PLAY_REJECTED");
      if (err.message === "AUDIO_PLAY_REJECTED" && !(e instanceof Error)) {
        err.message = "AUDIO_PLAY_REJECTED";
      }
      fail(err);
    });
  });
}

export function playTtsAudioFromUrl(
  url: string,
  onEnd?: EndFn,
  onStart?: () => void
): Promise<void> {
  if (typeof window === "undefined") {
    onEnd?.();
    return Promise.resolve();
  }

  stopTtsAudio();

  return new Promise((resolve, reject) => {
    const a = new Audio();
    audio = a;

    const finishOk = () => {
      cleanupHandlers(a);
      if (audio === a) audio = null;
      onEnd?.();
      resolve();
    };

    const fail = (err: Error) => {
      cleanupHandlers(a);
      if (audio === a) audio = null;
      reject(err);
    };

    endedHandler = finishOk;
    errorHandler = () => fail(new Error("AUDIO_ELEMENT_ERROR"));
    a.addEventListener("ended", endedHandler);
    a.addEventListener("error", errorHandler);

    a.src = url;
    a.onplaying = () => {
      onStart?.();
      a.onplaying = null;
    };

    void a.play().catch((e) => {
      const err = e instanceof Error ? e : new Error("AUDIO_PLAY_REJECTED");
      fail(err);
    });
  });
}
