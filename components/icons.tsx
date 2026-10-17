/* Minimal inline SVG icon set (stroke-based, currentColor). */

type IconProps = { className?: string; size?: number };

function base(size = 20, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

export const IconHome = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const IconReceipt = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);

export const IconFire = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 1-2 1-2 2 2 3 4 3 6a6 6 0 1 1-12 0c0-4 3-6 6-11z" />
  </svg>
);

export const IconBell = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10.5 19a2 2 0 0 0 3 0" />
  </svg>
);

export const IconChart = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconUser = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
  </svg>
);

export const IconPlus = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconCheck = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </svg>
);

export const IconX = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconClock = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconPrint = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M7 8V3h10v5" />
    <rect x="4" y="8" width="16" height="8" rx="2" />
    <path d="M7 16h10v5H7z" />
  </svg>
);

export const IconDownload = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const IconQr = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM21 14v3M14 21h7" />
  </svg>
);

export const IconTrash = ({ size, className }: { className?: string; size?: number }) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export const IconLogout = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M15 4h4v16h-4" />
    <path d="M10 12H3M6 8l-3 4 3 4" />
  </svg>
);

export const IconLock = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconChevronRight = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** Backspace (delete-left) — used on the PIN keypad. Drawn as SVG so no font
 *  has to supply the ⌫ glyph (Poppins does not ship it; tofu boxes look broken). */
export const IconBackspace = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
    <path d="m12 9 6 6M18 9l-6 6" />
  </svg>
);
