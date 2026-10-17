"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconX } from "./icons";

/** Bottom-sheet on mobile, centred dialog on larger screens. Never clips. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  // The overlay must be positioned against the viewport, so it is portalled to
  // document.body. Why: `position: fixed` is captured by the nearest ancestor
  // that has a `backdrop-filter`/`filter`/`transform` — the sticky guest header
  // uses `backdrop-blur`, so a Modal rendered inside it came out anchored to
  // the header's ~64px box, rendered mostly ABOVE the screen with its close
  // button unreachable, while the body scroll lock stayed on. Portalling to
  // body escapes every such ancestor.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-surface shadow-xl pop-in",
          className
        )}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-ink truncate">{title}</h3>
          <button
            onClick={onClose}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-surface-2"
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
