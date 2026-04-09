import type { Question } from "@prisma/client";
import { QuestionType } from "@prisma/client";
import { choicesMatch } from "./normalization";
import { defaultShortAnswerJudge } from "./short-answer-judge";

export interface GradeResult {
  isCorrect: boolean;
  scoreAwarded: number;
  normalizedAnswer: string;
}

/**
 * 根据题型与用户答案计算得分与是否正确。
 * 简答题：按 KeywordShortAnswerJudge 比例 × 题目分值，full 视为正确 isCorrect=true。
 */
export function gradeAnswer(
  question: Pick<
    Question,
    | "type"
    | "correctOption"
    | "canonicalAnswer"
    | "keywords"
    | "score"
  >,
  userAnswerRaw: string
): GradeResult {
  const trimmed = userAnswerRaw.trim();
  const normalizedAnswer = trimmed;

  if (question.type === QuestionType.single_choice) {
    const ok = choicesMatch(question.correctOption, trimmed);
    return {
      isCorrect: ok,
      scoreAwarded: ok ? question.score : 0,
      normalizedAnswer: trimmed,
    };
  }

  if (question.type === QuestionType.true_false) {
    const ok = choicesMatch(question.correctOption, trimmed);
    return {
      isCorrect: ok,
      scoreAwarded: ok ? question.score : 0,
      normalizedAnswer: trimmed,
    };
  }

  // short_answer
  const judged = defaultShortAnswerJudge.judge({
    userText: trimmed,
    canonicalAnswer: question.canonicalAnswer,
    keywordsCsv: question.keywords,
    maxScore: question.score,
  });

  const scoreAwarded = Math.round(question.score * judged.ratio);
  const isCorrect = judged.verdict === "full";

  return {
    isCorrect,
    scoreAwarded,
    normalizedAnswer: trimmed,
  };
}
