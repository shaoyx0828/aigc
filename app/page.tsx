import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  isQuizOpenForPlayers,
  QUIZ_DEADLINE_LABEL,
} from "@/lib/quiz/quiz-deadline";

/** 须按「当前时间」判断是否开放，不可在构建时写死 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  const quizOpen = isQuizOpenForPlayers();

  return (
    <div className="space-y-8">
      <section className="text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <div className="relative aspect-square w-[7.5rem] overflow-hidden rounded-2xl bg-[var(--background)] sm:w-[8.5rem]">
            <Image
              src="/avatar/longxiaoxi.png"
              alt="中天火箭吉祥物"
              width={200}
              height={200}
              className="h-full w-full object-contain object-center"
              priority
              sizes="(max-width: 640px) 120px, 136px"
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          中天火箭在线答题
        </h1>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {quizOpen ? (
            <Link href="/quiz/start">
              <Button size="lg" className="w-full min-w-[200px] sm:w-auto">
                开始答题
              </Button>
            </Link>
          ) : (
            <Button size="lg" className="w-full min-w-[200px] sm:w-auto" disabled>
              答题已截止
            </Button>
          )}
        </div>
      </section>

      <Card className="mx-auto max-w-lg space-y-3">
        <CardTitle>活动说明</CardTitle>
        <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
          <li>
            输入<strong>姓名</strong>与<strong>11 位手机号</strong>开始答题；<strong>姓名可与他人重复</strong>
            ，系统以<strong>手机号</strong>区分不同参赛人；同一手机号仅可完成一次，不可重复答题
          </li>
          <li>
            答题形式为单选题；系统从题库中<strong>随机抽取 20 道题</strong>，且<strong>题目顺序随机打乱</strong>
            ，可在页面右侧任意顺序点题号作答，整场限时{" "}
            <strong>30 分钟</strong>
          </li>
          <li>
            答完全部题目后提示完成，答题节点为{" "}
            <strong className="text-slate-800">{QUIZ_DEADLINE_LABEL}</strong>
            ；截止后系统关闭答题，统计由管理员后台导出。
          </li>
        </ul>
      </Card>

      <p className="text-center text-xs text-slate-400">
        在手机或电脑上打开本页面链接即可参与答题
      </p>
    </div>
  );
}
