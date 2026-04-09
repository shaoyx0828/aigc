import { NextResponse } from "next/server";
import { isQuizOpenForPlayers } from "@/lib/quiz/quiz-deadline";

export const dynamic = "force-dynamic";

/** GET：是否仍可对大众开放答题（无需登录） */
export async function GET() {
  return NextResponse.json({
    open: isQuizOpenForPlayers(),
  });
}
