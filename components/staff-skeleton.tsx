import { StaffNav } from "@/components/staff-nav";
import type { Role } from "@/lib/types";

/**
 * Streaming placeholder for staff segments. It renders the same skeleton
 * chrome as the real page (header strip, stat cards, panels, bottom nav) so a
 * navigation swaps screens instantly instead of freezing on the old one while
 * the dynamic segment waits on Supabase.
 *
 * Server component — no hooks, safe everywhere. The bottom bar is the real
 * `StaffNav`, so it never disappears mid-navigation.
 */
export function StaffSkeleton({ role }: { role: Role }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <header className="brand-band sticky top-0 z-20 border-b border-brand-strong/40 shadow-[0_2px_10px_rgba(127,42,13,0.25)] no-print">
        <div className="mx-auto w-full max-w-3xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="h-2 w-24 rounded-full animate-pulse bg-white/25" />
            <div className="h-4 w-44 rounded-full animate-pulse bg-white/25" />
          </div>
          <div className="h-10 w-10 shrink-0 rounded-xl animate-pulse bg-white/20" />
        </div>
      </header>

      <main className="px-4 py-4 space-y-5" aria-busy="true" aria-label="Loading">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[74px] rounded-2xl border border-border bg-surface animate-pulse"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>

        <div className="h-5 w-36 rounded-full animate-pulse bg-surface-2" />

        <div className="h-44 rounded-2xl border border-border bg-surface animate-pulse" />
        <div
          className="h-64 rounded-2xl border border-border bg-surface animate-pulse"
          style={{ animationDelay: "140ms" }}
        />
      </main>

      <StaffNav role={role} />
    </div>
  );
}
