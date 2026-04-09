"use client";

import { cn } from "@/lib/utils";

type Props = {
  questionIdsInOrder: string[];
  answeredIds: Set<string>;
  selectedSlotIndex: number;
  onSelectSlot: (slotIndex: number) => void;
  disabled?: boolean;
  /** 并入外层 Card 时可传入以去掉重复边框/阴影 */
  className?: string;
};

/**
 * 题号导航：已答题为绿色，当前题为高亮描边（可放入侧栏 Card）。
 */
export function QuizQuestionNav({
  questionIdsInOrder,
  answeredIds,
  selectedSlotIndex,
  onSelectSlot,
  disabled,
  className,
}: Props) {
  return (
    <nav
      className={cn(
        "quiz-question-nav rounded-xl border border-slate-200 bg-white p-3 shadow-sm",
        className
      )}
      aria-label="题号导航"
    >
      <p className="mb-1.5 text-xs font-medium text-slate-600 md:mb-2">题号</p>
      <p className="quiz-question-nav-hint">
        可任意顺序作答；完成后题号变为绿色。
      </p>
      <div className="quiz-question-nav-grid">
        {questionIdsInOrder.map((id, i) => {
          const answered = answeredIds.has(id);
          const selected = i === selectedSlotIndex;
          return (
            <button
              key={`${id}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSlot(i)}
              className={cn(
                "flex items-center justify-center rounded-lg font-semibold transition-colors",
                answered &&
                  "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600",
                !answered &&
                  selected &&
                  "bg-brand-600 text-white ring-2 ring-brand-300 ring-offset-2",
                !answered &&
                  !selected &&
                  "bg-slate-100 text-slate-800 hover:bg-slate-200"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
