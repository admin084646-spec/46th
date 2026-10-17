import type { StaffSession } from "@/lib/auth";
import { IconLogout } from "./icons";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Cashier / Admin",
  waiter: "Waiter",
  kitchen: "Kitchen",
};

export function StaffHeader({
  staff,
  title,
  right,
}: {
  staff: StaffSession;
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border no-print">
      <div className="mx-auto w-full max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {ROLE_LABEL[staff.role]} · {staff.name}
          </p>
          <h1 className="font-semibold text-ink truncate">
            {title ?? "Mittal's Shudh Shakahari"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-border bg-surface text-muted"
              aria-label="Sign out"
            >
              <IconLogout size={18} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
