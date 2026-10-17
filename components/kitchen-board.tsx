"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/components/live";
import {
  setTicketStatusAction,
  togglePrintedAction,
} from "@/lib/actions/service";
import { formatTime, minutesSince } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge, Banner, Button, Card, EmptyState, Spinner } from "@/components/ui";
import type { KitchenTicket, OrderItem } from "@/lib/types";

export interface KitchenRow {
  ticket: KitchenTicket;
  orderNo: number;
  items: OrderItem[];
}

const COLUMNS: { key: KitchenTicket["status"]; title: string; hint: string }[] = [
  { key: "approved", title: "New tickets", hint: "Approved, not started" },
  { key: "preparing", title: "Preparing", hint: "On the stove" },
  { key: "ready", title: "Ready", hint: "Waiting for pickup" },
];

export function KitchenBoard({ rows }: { rows: KitchenRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLive(["role:kitchen"], 6000);

  async function act(
    tag: string,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setBusy(tag);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) setError(res.error ?? "Something went wrong");
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      {error ? <Banner tone="red">{error}</Banner> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="All caught up"
          hint="New approved orders appear here automatically."
        />
      ) : null}

      {COLUMNS.map((col) => {
        const list = rows.filter((r) => r.ticket.status === col.key);
        if (!list.length) return null;
        return (
          <section key={col.key}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
              <Badge tone={col.key === "ready" ? "green" : "blue"}>
                {list.length}
              </Badge>
              <span className="text-xs text-muted">{col.hint}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {list.map((row) => (
                <TicketCard
                  key={row.ticket.id}
                  row={row}
                  busy={busy}
                  act={act}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TicketCard({
  row,
  busy,
  act,
}: {
  row: KitchenRow;
  busy: string | null;
  act: (
    tag: string,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) => Promise<void>;
}) {
  const { ticket, items, orderNo } = row;
  const age = minutesSince(ticket.created_at);
  const late = age >= 12;
  const id = ticket.id;

  return (
    <Card className={cn("p-3", late && "ring-1 ring-red-soft")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-ink truncate">
            {ticket.table_label}
          </span>
          <Badge tone="neutral">#{orderNo}</Badge>
        </div>
        <span
          className={cn(
            "text-xs tabular-nums",
            late ? "text-red font-semibold" : "text-muted"
          )}
        >
          {formatTime(ticket.created_at)} · {age}m
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between text-sm">
            <span className="text-ink">
              <span className="font-semibold tabular-nums">{it.qty}×</span>{" "}
              {it.item_name}
            </span>
            {it.note ? (
              <span className="text-amber text-xs shrink-0 pl-2 max-w-[45%] text-right">
                {it.note}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {ticket.status === "served" ? (
        <Badge tone="green">Served</Badge>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {ticket.status === "approved" ? (
          <Button
            size="sm"
            block
            disabled={busy === "p" + id}
            onClick={() => act("p" + id, () => setTicketStatusAction(id, "preparing"))}
          >
            {busy === "p" + id ? <Spinner /> : null} Start preparing
          </Button>
        ) : null}
        {ticket.status === "preparing" ? (
          <Button
            size="sm"
            block
            variant="success"
            disabled={busy === "r" + id}
            onClick={() => act("r" + id, () => setTicketStatusAction(id, "ready"))}
          >
            {busy === "r" + id ? <Spinner /> : null} Mark ready
          </Button>
        ) : null}
        {ticket.status === "ready" ? (
          <Badge tone="green">Waiting for waiter</Badge>
        ) : null}
        <button
          onClick={() =>
            act("pr" + id, () => togglePrintedAction(id, !ticket.printed))
          }
          className={cn(
            "h-9 shrink-0 rounded-xl border px-3 text-xs font-medium",
            ticket.printed
              ? "border-green-soft bg-green-soft text-green"
              : "border-border bg-surface text-muted"
          )}
        >
          {ticket.printed ? "Printed" : "Print"}
        </button>
      </div>
    </Card>
  );
}
