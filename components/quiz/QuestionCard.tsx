import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuestionType, Difficulty } from "@prisma/client";

const typeLabel: Record<QuestionType, string> = {
  single_choice: "单选题",
  true_false: "判断题",
  short_answer: "简答题",
};

const diffLabel: Record<Difficulty, string> = {
  easy: "易",
  medium: "中",
  hard: "难",
};

export function QuestionCard({
  category,
  type,
  difficulty,
  question,
  optionA,
  optionB,
  optionC,
  optionD,
  /** 单选题：在卡片内点选 A–D */
  selectedSingleChoice,
  onSelectSingleChoice,
  optionSelectDisabled,
}: {
  category: string;
  type: QuestionType;
  difficulty: Difficulty;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedSingleChoice?: string | null;
  onSelectSingleChoice?: (key: string) => void;
  optionSelectDisabled?: boolean;
}) {
  const opts = [
    { k: "A", v: optionA },
    { k: "B", v: optionB },
    { k: "C", v: optionC },
    { k: "D", v: optionD },
  ].filter((o) => o.v);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{category}</Badge>
        <Badge className="bg-brand-50 text-brand-800">{typeLabel[type]}</Badge>
        <Badge className="bg-amber-50 text-amber-800">难度 {diffLabel[difficulty]}</Badge>
      </div>
      <p className="text-base font-medium leading-relaxed text-slate-900">{question}</p>
      {opts.length > 0 &&
        type === "single_choice" &&
        onSelectSingleChoice != null && (
          <ul className="space-y-2 text-sm text-slate-800">
            {opts.map((o) => {
              const selected = selectedSingleChoice === o.k;
              return (
                <li key={o.k}>
                  <button
                    type="button"
                    disabled={optionSelectDisabled}
                    onClick={() => onSelectSingleChoice(o.k)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      selected
                        ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    )}
                    aria-pressed={selected}
                  >
                    <span className="font-semibold text-brand-700">{o.k}.</span>{" "}
                    {o.v}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      {opts.length > 0 &&
        !(type === "single_choice" && onSelectSingleChoice != null) && (
          <ul className="space-y-2 text-sm text-slate-700">
            {opts.map((o) => (
              <li key={o.k} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-brand-700">{o.k}.</span> {o.v}
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}
