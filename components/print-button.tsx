"use client";

import { cn } from "@/lib/cn";

export function PrintButton({
  label = "Print / Save as PDF",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      onClick={() => window.print()}
      className={cn(
        "no-print rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white active:bg-brand-strong",
        className
      )}
    >
      {label}
    </button>
  );
}
