import { cn } from "@/lib/utils";
import type { TdHTMLAttributes } from "react";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-slate-200", className)}>
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "bg-slate-50 px-3 py-2 font-semibold text-slate-700 whitespace-nowrap",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children: React.ReactNode; className?: string }) {
  return (
    <td
      className={cn("px-3 py-2 text-slate-700 align-top", className)}
      {...props}
    >
      {children}
    </td>
  );
}
