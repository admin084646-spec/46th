"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  IconBell,
  IconChart,
  IconFire,
  IconHome,
  IconQr,
  IconReceipt,
} from "@/components/icons";
import type { Role } from "@/lib/types";

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (path: string) => boolean;
}

const admin: Item[] = [
  { href: "/admin", label: "Counter", icon: <IconHome size={20} />, match: (p) => p === "/admin" },
  { href: "/admin/tables", label: "Tables", icon: <IconQr size={20} /> },
  { href: "/admin/menu", label: "Menu", icon: <IconReceipt size={20} /> },
];

const waiter: Item[] = [
  { href: "/waiter", label: "Floor", icon: <IconBell size={20} /> },
];

const kitchen: Item[] = [
  { href: "/kitchen", label: "Kitchen", icon: <IconFire size={20} /> },
];

const owner: Item[] = [
  { href: "/owner", label: "Reports", icon: <IconChart size={20} /> },
];

export function StaffNav({ role }: { role: Role }) {
  const pathname = usePathname();

  // OPTIMISTIC TAP: highlight the tapped item on the same frame the finger
  // lifts, instead of waiting for the route to finish loading. Staff segments
  // are `force-dynamic` and stream DB work, and `usePathname` only flips after
  // the server response lands — without this the bar felt dead for ~1s.
  const [tapped, setTapped] = useState<string | null>(null);

  // Clear the optimistic state once the real pathname catches up, or after a
  // safety timeout (navigation cancelled / back gesture).
  useEffect(() => {
    if (!tapped) return;
    if (pathname === tapped || pathname.startsWith(tapped + "/")) {
      setTapped(null);
      return;
    }
    const t = setTimeout(() => setTapped(null), 4000);
    return () => clearTimeout(t);
  }, [pathname, tapped]);

  const items =
    role === "admin"
      ? admin
      : role === "waiter"
        ? waiter
        : role === "kitchen"
          ? kitchen
          : owner;

  return (
    <nav
      id="staff-nav"
      className="frost fixed left-0 right-0 bottom-0 z-30 border-t border-border/70 safe-bottom no-print"
    >
      <div className="mx-auto flex w-full max-w-3xl gap-0.5 px-2 pt-2">
        {items.map((it) => {
          const real = it.match
            ? it.match(pathname)
            : pathname === it.href || pathname.startsWith(it.href + "/");
          const active = tapped ? tapped === it.href : real;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setTapped(it.href)}
              data-active={active ? "true" : "false"}
              aria-current={real ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 pb-2.5 pt-2 text-[11px] font-semibold",
                "select-none touch-manipulation rounded-xl transition-colors",
                active
                  ? "text-brand"
                  : "text-muted hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-full max-w-[4.5rem] place-items-center rounded-xl",
                  "transition-all duration-150 ease-out active:scale-[0.94]",
                  active
                    ? "bg-brand-soft shadow-[inset_0_0_0_1px_rgba(194,65,12,0.18)]"
                    : "bg-transparent",
                )}
              >
                {it.icon}
              </span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
