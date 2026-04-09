import { QuestionType } from "@prisma/client";

/** 单选 / 判断等选择题默认倒计时（秒） */
export const CHOICE_QUESTION_TIME_LIMIT_SEC = 3 * 60;

/** 简答题默认倒计时（秒） */
export const SHORT_ANSWER_TIME_LIMIT_SEC = 10 * 60;

export function defaultTimeLimitSecForQuestionType(type: QuestionType): number {
  return type === QuestionType.short_answer
    ? SHORT_ANSWER_TIME_LIMIT_SEC
    : CHOICE_QUESTION_TIME_LIMIT_SEC;
}
