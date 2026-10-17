"use client";

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
  const items =
    role === "admin"
      ? admin
      : role === "waiter"
        ? waiter
        : role === "kitchen"
          ? kitchen
          : owner;

  return (
    <nav className="fixed left-0 right-0 bottom-0 z-30 border-t border-border bg-surface safe-bottom no-print">
      <div className="mx-auto flex w-full max-w-3xl">
        {items.map((it) => {
          const active = it.match
            ? it.match(pathname)
            : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-brand" : "text-muted"
              )}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
