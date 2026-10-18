"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/components/live";
import { approveOrderAction, rejectOrderAction } from "@/lib/actions/orders";
import { formatINR } from "@/lib/money";
import { formatTime, minutesSince } from "@/lib/format";
import { Badge, Banner, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { Modal } from "@/components/modal";
import type { PendingOrderRow } from "@/lib/queries";

export function Approvals({ rows }: { rows: PendingOrderRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingOrderRow | null>(null);
  const [reason, setReason] = useState("");

  useLive(["role:admin"], 30000);

  async function approve(row: PendingOrderRow) {
    setBusy(row.order.id);
    setError(null);
    const res = await approveOrderAction(row.order.id);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(rejecting.order.id);
    const res = await rejectOrderAction(rejecting.order.id, reason);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else {
      setRejecting(null);
      setReason("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Banner tone="red">{error}</Banner> : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No orders waiting"
          hint="New customer orders appear here for approval."
        />
      ) : (
        rows.map((row) => {
          const waited = minutesSince(row.order.created_at);
          const urgent = waited >= 4;
          return (
            <Card key={row.order.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-ink">{row.tableLabel}</span>
                  <Badge tone="brand">Round {row.order.round_no}</Badge>
                </div>
                <span
                  className={
                    "text-xs " + (urgent ? "text-red font-semibold" : "text-muted")
                  }
                >
                  {formatTime(row.order.created_at)} · {waited}m
                </span>
              </div>

              <p className="text-xs text-muted mt-1">
                {row.order.customer_label ?? "Guest"} · Order #{row.order.order_no}
              </p>

              <ul className="mt-2 space-y-1">
                {row.items.map((it) => (
                  <li key={it.id} className="flex justify-between text-sm">
                    <span className="text-ink">
                      {it.qty} × {it.item_name}
                      {it.note ? (
                        <span className="text-muted"> · {it.note}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-muted">
                      {formatINR(it.unit_price_minor * it.qty)}
                    </span>
                  </li>
                ))}
              </ul>

              {row.order.special_note ? (
                <p className="mt-2 text-xs text-amber bg-amber-soft rounded-lg px-2.5 py-1.5">
                  Note: {row.order.special_note}
                </p>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm font-bold tabular-nums">
                  {formatINR(
                    row.items.reduce(
                      (s, it) => s + it.unit_price_minor * it.qty,
                      0
                    )
                  )}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejecting(row);
                      setReason("");
                    }}
                    disabled={busy === row.order.id}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => approve(row)}
                    disabled={busy === row.order.id}
                  >
                    {busy === row.order.id ? <Spinner /> : null}
                    Approve &amp; send
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject order"
      >
        <p className="text-sm text-muted">
          Tell the guest why this order can&apos;t be accepted.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          placeholder="e.g. item sold out, please re-order"
        />
        <Button
          block
          variant="danger"
          className="mt-3"
          disabled={busy === rejecting?.order.id}
          onClick={reject}
        >
          Reject order
        </Button>
      </Modal>
    </div>
  );
}
