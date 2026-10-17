import { cn } from "@/lib/cn";

/* Reusable, no-edge-cutting UI primitives. Mobile-first. */

type ButtonVariant =
  | "primary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "subtle";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-strong active:bg-brand-strong shadow-sm",
  success: "bg-green text-white hover:brightness-95 shadow-sm",
  danger: "bg-red text-white hover:brightness-95 shadow-sm",
  outline:
    "border border-border bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  subtle: "bg-surface-2 text-ink hover:brightness-95 border border-border",
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
}) {
  const sizes = {
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-11 px-4 text-sm",
    lg: "min-h-12 px-5 text-base",
  } as const;
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none select-none",
        sizes[size],
        block && "w-full",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(33,29,24,0.04)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink truncate">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

type Tone = "neutral" | "brand" | "green" | "amber" | "red" | "blue";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand-strong",
  green: "bg-green-soft text-green",
  amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red",
  blue: "bg-blue-soft text-blue",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* Status labels — never colour-only: always a text label too. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    pending: { tone: "amber", label: "Pending approval" },
    approved: { tone: "blue", label: "Approved" },
    preparing: { tone: "blue", label: "Preparing" },
    ready: { tone: "green", label: "Ready for pickup" },
    picked_up: { tone: "brand", label: "Picked up" },
    served: { tone: "green", label: "Served" },
    rejected: { tone: "red", label: "Rejected" },
    cancelled: { tone: "red", label: "Cancelled" },
    unpaid: { tone: "amber", label: "Unpaid" },
    partial: { tone: "amber", label: "Partially paid" },
    paid: { tone: "green", label: "Paid" },
    active: { tone: "green", label: "Occupied" },
    awaiting_clearance: { tone: "brand", label: "Awaiting clearance" },
    closed: { tone: "neutral", label: "Closed" },
    ack: { tone: "blue", label: "Acknowledged" },
    done: { tone: "green", label: "Completed" },
    void: { tone: "neutral", label: "Voided" },
    verified: { tone: "green", label: "Verified" },
  };
  const s = map[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
        {label} {required ? <span className="text-red">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted mt-1">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea {...props} className={cn(inputBase, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, props.className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-hidden
    />
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function Banner({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5 text-sm",
        TONES[tone]
      )}
      role="status"
    >
      {children}
    </div>
  );
}

/** Metric tile for dashboards/reports. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold mt-1 tabular-nums",
          tone === "green" && "text-green",
          tone === "red" && "text-red",
          tone === "brand" && "text-brand-strong",
          tone === "amber" && "text-amber"
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted mt-0.5">{hint}</p> : null}
    </Card>
  );
}
