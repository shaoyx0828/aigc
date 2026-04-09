import { formatAccuracy } from "@/lib/utils";
import { Table, Th, Td } from "@/components/ui/table";
import type { SourceChannel } from "@prisma/client";

const channelLabel: Record<SourceChannel, string> = {
  link: "链接",
  qrcode: "二维码",
  other: "其他",
};

export interface LeaderboardRow {
  id: string;
  nickname: string;
  /** 脱敏手机号，用于区分重名 */
  phoneMask: string;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  totalDurationSec: number;
  finishedAt: string | null;
  sourceChannel: SourceChannel;
}

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        暂无已完成场次，先完成一次答题吧。
      </p>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>姓名</Th>
          <Th>手机（脱敏）</Th>
          <Th>总分</Th>
          <Th>正确率</Th>
          <Th>用时</Th>
          <Th>渠道</Th>
          <Th>完成时间</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.map((r, i) => {
          const totalQ = r.correctCount + r.wrongCount;
          return (
            <tr key={r.id}>
              <Td>{i + 1}</Td>
              <Td className="font-medium text-slate-900">{r.nickname}</Td>
              <Td className="tabular-nums text-slate-600">{r.phoneMask}</Td>
              <Td>{r.totalScore}</Td>
              <Td>{formatAccuracy(r.correctCount, totalQ)}</Td>
              <Td>{r.totalDurationSec}s</Td>
              <Td>{channelLabel[r.sourceChannel]}</Td>
              <Td className="whitespace-nowrap text-xs text-slate-500">
                {r.finishedAt ? new Date(r.finishedAt).toLocaleString("zh-CN") : "—"}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
