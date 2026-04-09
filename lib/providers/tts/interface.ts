/**
 * TTS 抽象：后续可接入云端 TTS、定制音色等。
 */
export interface TTSProvider {
  speak(text: string): Promise<void>;
  stop?: () => void;
}
