import { QuizPlay } from "./quiz-play";

export default async function QuizSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <QuizPlay sessionId={sessionId} />;
}
