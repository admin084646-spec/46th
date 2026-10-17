"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function ReportRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function go(nf: string, nt: string) {
    setF(nf);
    setT(nt);
    router.push(`/owner?from=${nf}&to=${nt}`);
  }

  const today = to;
  const weekAgo = isoDaysAgo(6);
  const monthStart = isoDaysAgo(29);

  const input =
    "rounded-xl border border-border bg-surface px-3 py-2.5 text-sm tabular-nums";

  return (
    <div className="space-y-2">
      <div className="scroll-x flex gap-2">
        {[
          { label: "Today", f: today, t: today },
          { label: "Last 7 days", f: weekAgo, t: today },
          { label: "Last 30 days", f: monthStart, t: today },
        ].map((p) => {
          const active = f === p.f && t === p.t;
          return (
            <button
              key={p.label}
              onClick={() => go(p.f, p.t)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface text-muted"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex-1 min-w-[9rem]">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            From
          </span>
          <input
            type="date"
            value={f}
            onChange={(e) => setF(e.target.value)}
            className={cn("mt-1 w-full", input)}
          />
        </label>
        <label className="flex-1 min-w-[9rem]">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            To
          </span>
          <input
            type="date"
            value={t}
            onChange={(e) => setT(e.target.value)}
            className={cn("mt-1 w-full", input)}
          />
        </label>
        <button
          onClick={() => go(f, t)}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white active:bg-brand-strong"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
