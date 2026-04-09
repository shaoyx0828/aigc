import {
  buildQuestionSpeech,
  type QuestionSpeechVariant,
} from "@/lib/config/tts";

export function wrapAutoQuestionNarration(
  speakText: string,
  variant: QuestionSpeechVariant = "first"
): string {
  return buildQuestionSpeech(speakText.trim(), variant);
}

export function wrapReplayQuestionNarration(
  speakText: string,
  variant: QuestionSpeechVariant = "first"
): string {
  return buildQuestionSpeech(speakText.trim(), variant);
}
