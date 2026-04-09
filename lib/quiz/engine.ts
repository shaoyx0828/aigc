import type { Question, QuizSession } from "@prisma/client";
import { parseQuestionOrder } from "@/lib/utils";
import { gradeAnswer } from "./scoring";

/**
 * 根据会话中的题目顺序与已答数量，解析当前应作答的题目。
 */
export function getCurrentQuestion(
  session: Pick<QuizSession, "questionOrder">,
  answeredCount: number,
  questionsById: Map<string, Question>
): Question | null {
  const order = parseQuestionOrder(session.questionOrder);
  if (answeredCount >= order.length) return null;
  const qid = order[answeredCount];
  return questionsById.get(qid) ?? null;
}

/**
 * 本场总题数 */
export function getTotalQuestions(session: Pick<QuizSession, "questionOrder">) {
  return parseQuestionOrder(session.questionOrder).length;
}

export { gradeAnswer };
