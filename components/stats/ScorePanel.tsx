import { Card } from "@/components/ui/card";

export function ScorePanel({
  answeredCount,
  total,
}: {
  answeredCount: number;
  total: number;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="text-xs text-slate-500">进度</p>
        <p className="text-lg font-semibold text-slate-900">
          已作答 {Math.min(answeredCount, total)} / {total} 题
        </p>
      </div>
    </Card>
  );
}
