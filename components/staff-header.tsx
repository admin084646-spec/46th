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
    <header className="brand-band sticky top-0 z-20 border-b border-brand-strong/40 shadow-[0_2px_10px_rgba(127,42,13,0.25)] no-print">
      <div className="mx-auto w-full max-w-3xl px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
            {ROLE_LABEL[staff.role]} · {staff.name}
          </p>
          <h1 className="text-lg font-bold text-white truncate">
            {title ?? "Mittal's Shudh Shakahari"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="grid h-10 w-10 place-items-center rounded-xl bg-white/12 text-white transition hover:bg-white/20 active:scale-95"
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
