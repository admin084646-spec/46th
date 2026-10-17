"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLive } from "@/components/live";
import { sessionTopic } from "@/lib/topics";
import {
  addPaymentAction,
  applyDiscountAction,
  clearSplitsAction,
  clearTableAction,
  markAwaitingClearanceAction,
  splitByItemsAction,
  splitByPeopleAction,
  verifyPaymentAction,
  voidPaymentAction,
} from "@/lib/actions/billing";
import {
  approveOrderAction,
  cancelOrderAction,
  correctOrderAction,
  rejectOrderAction,
} from "@/lib/actions/orders";
import { formatINR, formatINRPlain } from "@/lib/money";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { Modal } from "@/components/modal";
import type {
  Bill,
  BillSplit,
  Discount,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
} from "@/lib/types";

export interface BillingWorkspace {
  tableLabel: string;
  session: { id: string; status: string; opened_at: string };
  bill: Bill | null;
  orders: Order[];
  items: OrderItem[];
  payments: Payment[];
  discounts: Discount[];
  splits: BillSplit[];
  menuItems: MenuItem[];
}

function rupeesToMinor(input: string): number {
  const n = parseFloat(input.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function BillingScreen({ w }: { w: BillingWorkspace }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useLive(["role:admin", sessionTopic(w.session.id)], 7000);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const it of w.items) {
      const arr = m.get(it.order_id) ?? [];
      arr.push(it);
      m.set(it.order_id, arr);
    }
    return m;
  }, [w.items]);

  const paidVerified = w.payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + p.amount_minor, 0);
  const pendingPay = w.payments
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.amount_minor, 0);
  const due = w.bill ? Math.max(0, w.bill.total_minor - w.bill.paid_minor) : 0;

  async function run(
    tag: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okNote?: string
  ) {
    setBusy(tag);
    setError(null);
    setNote(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) setError(res.error ?? "Something went wrong");
    else {
      if (okNote) setNote(okNote);
      router.refresh();
    }
  }

  const orders = [...w.orders].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      {error ? <Banner tone="red">{error}</Banner> : null}
      {note ? <Banner tone="green">{note}</Banner> : null}

      {/* Summary */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              {w.tableLabel}
            </p>
            <p className="text-lg font-bold text-ink tabular-nums">
              {formatINR(w.bill?.total_minor ?? 0)}
            </p>
            <p className="text-xs text-muted mt-0.5">
              Since {formatTime(w.session.opened_at)} ·{" "}
              {w.bill ? `Bill #${w.bill.bill_no}` : "No bill yet"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {w.bill ? <StatusBadge status={w.bill.status} /> : null}
            <StatusBadge status={w.session.status} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Mini label="Subtotal" value={formatINR(w.bill?.subtotal_minor ?? 0)} />
          <Mini
            label="Discount"
            value={"− " + formatINR(w.bill?.discount_minor ?? 0)}
          />
          <Mini label="Due" value={formatINR(due)} accent={due > 0} />
        </div>

        <div className="flex gap-2 mt-3">
          <Link href={`/admin/bill/${w.session.id}/receipt`} className="flex-1">
            <Button block variant="outline" size="sm">
              Print / save receipt
            </Button>
          </Link>
        </div>
      </Card>

      {/* Orders */}
      <section>
        <SectionTitle
          title="Orders on this table"
          subtitle="Cancel or correct an order — everything is audited"
        />
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                items={itemsByOrder.get(o.id) ?? []}
                menuItems={w.menuItems}
                busy={busy}
                run={run}
              />
            ))}
          </div>
        )}
      </section>

      {/* Payments */}
      <section>
        <SectionTitle
          title="Payments"
          subtitle="Cash is verified instantly. UPI / card must be verified by staff."
        />
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <Mini label="Verified" value={formatINR(paidVerified)} />
            <Mini label="Pending" value={formatINR(pendingPay)} accent={pendingPay > 0} />
            <Mini label="Due" value={formatINR(due)} accent={due > 0} />
          </div>

          {w.payments.length === 0 ? (
            <p className="text-sm text-muted">No payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {w.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatINR(p.amount_minor)}
                      </span>
                      <Badge tone="neutral">{p.method.toUpperCase()}</Badge>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {formatTime(p.created_at)}
                      {p.ref ? ` · ref ${p.ref}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {p.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="success"
                        disabled={busy === "v" + p.id}
                        onClick={() =>
                          run("v" + p.id, () => verifyPaymentAction(p.id))
                        }
                      >
                        {busy === "v" + p.id ? <Spinner /> : null} Verify
                      </Button>
                    ) : null}
                    {p.status !== "void" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === "x" + p.id}
                        onClick={() => {
                          const reason = window.prompt(
                            "Reason for voiding this payment?"
                          );
                          if (!reason) return;
                          run("x" + p.id, () =>
                            voidPaymentAction(p.id, reason)
                          );
                        }}
                      >
                        Void
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <AddPayment
            due={due}
            busy={busy}
            onAdd={(amount, method, ref) =>
              run("addpay", () =>
                addPaymentAction(w.bill?.id ?? "", amount, method, ref)
              )
            }
            disabled={!w.bill}
          />
        </Card>
      </section>

      {/* Discount */}
      <section>
        <DiscountForm
          subtotal={w.bill?.subtotal_minor ?? 0}
          discounts={w.discounts}
          busy={busy}
          onSubmit={(amount, reason) =>
            run("disc", () =>
              applyDiscountAction(w.bill?.id ?? "", amount, reason)
            )
          }
          disabled={!w.bill}
        />
      </section>

      {/* Splits */}
      {w.bill ? (
        <SplitPanel
          bill={w.bill}
          items={w.items}
          orders={w.orders}
          splits={w.splits}
          busy={busy}
          run={run}
        />
      ) : null}

      {/* Clear table */}
      <section>
        <SectionTitle
          title="Table clearance"
          subtitle="Clear only after the bill is settled — this closes the table."
        />
        <Card className="p-4">
          {w.session.status === "closed" ? (
            <Banner tone="neutral">This table is already cleared.</Banner>
          ) : w.bill?.status === "paid" ? (
            <>
              {w.session.status !== "awaiting_clearance" ? (
                <Button
                  variant="outline"
                  block
                  className="mb-2"
                  disabled={busy === "await"}
                  onClick={() =>
                    run("await", () =>
                      markAwaitingClearanceAction(w.session.id)
                    )
                  }
                >
                  Mark awaiting clearance
                </Button>
              ) : null}
              <Button
                variant="success"
                block
                disabled={busy === "clear"}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Clear ${w.tableLabel}? The table becomes free for new guests.`
                    )
                  )
                    return;
                  run("clear", () => clearTableAction(w.session.id, false));
                }}
              >
                {busy === "clear" ? <Spinner /> : null} Clear table
              </Button>
            </>
          ) : (
            <ForceClear
              label={w.tableLabel}
              busy={busy}
              onForce={(reason) =>
                run("clear", () => clearTableAction(w.session.id, true, reason))
              }
            />
          )}
        </Card>
      </section>
    </div>
  );
}

/* ------------------------------- pieces ------------------------------- */

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums mt-0.5",
          accent ? "text-amber" : "text-ink"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OrderCard({
  order,
  items,
  menuItems,
  busy,
  run,
}: {
  order: Order;
  items: OrderItem[];
  menuItems: MenuItem[];
  busy: string | null;
  run: (
    tag: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okNote?: string
  ) => Promise<void>;
}) {
  const [correcting, setCorrecting] = useState(false);
  const total = items.reduce((s, it) => s + it.unit_price_minor * it.qty, 0);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-ink">Round {order.round_no}</span>
          <Badge tone="neutral">{order.customer_label ?? "Guest"}</Badge>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-xs text-muted mt-0.5">{formatTime(order.created_at)}</p>

      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between text-sm">
            <span className="text-ink truncate pr-2">
              {it.qty} × {it.item_name}
              {it.note ? <span className="text-muted"> · {it.note}</span> : null}
            </span>
            <span className="tabular-nums text-muted shrink-0">
              {formatINR(it.unit_price_minor * it.qty)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums">{formatINR(total)}</span>
        <div className="flex gap-1.5">
          {order.status === "pending" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === "r" + order.id}
                onClick={() =>
                  run("r" + order.id, () =>
                    rejectOrderAction(order.id, "Rejected at counter")
                  )
                }
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="success"
                disabled={busy === "a" + order.id}
                onClick={() =>
                  run("a" + order.id, () => approveOrderAction(order.id))
                }
              >
                Approve
              </Button>
            </>
          ) : null}
          {order.status === "approved" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCorrecting(true)}
              >
                Correct
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === "c" + order.id}
                onClick={() => {
                  const reason = window.prompt(
                    "Reason for cancelling this order?"
                  );
                  if (!reason) return;
                  run("c" + order.id, () =>
                    cancelOrderAction(order.id, reason)
                  );
                }}
              >
                Cancel
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <CorrectModal
        open={correcting}
        onClose={() => setCorrecting(false)}
        order={order}
        items={items}
        menuItems={menuItems}
        busy={busy}
        onSubmit={(lines, reason) =>
          run("k" + order.id, () =>
            correctOrderAction(order.id, lines, reason)
          ).then(() => setCorrecting(false))
        }
      />
    </Card>
  );
}

function CorrectModal({
  open,
  onClose,
  order,
  items,
  menuItems,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  items: OrderItem[];
  menuItems: MenuItem[];
  busy: string | null;
  onSubmit: (
    lines: { menu_item_id: string; qty: number; unit_price_minor?: number; note?: string }[],
    reason: string
  ) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.qty]))
  );
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");

  const lines: {
    menu_item_id: string;
    qty: number;
    unit_price_minor?: number;
    note?: string;
  }[] = items
    .filter((it) => !!it.menu_item_id && (qty[it.id] ?? it.qty) > 0)
    .map((it) => ({
      menu_item_id: it.menu_item_id as string,
      qty: qty[it.id] ?? it.qty,
      unit_price_minor: it.unit_price_minor,
      note: it.note ?? undefined,
    }));

  if (extra) {
    const mi = menuItems.find((m) => m.id === extra);
    if (mi) lines.push({ menu_item_id: mi.id, qty: 1 });
    else {
      const match = menuItems.find((m) => m.name === extra);
      if (match) lines.push({ menu_item_id: match.id, qty: 1 });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Correct round ${order.round_no}`}>
      <p className="text-sm text-muted">
        Adjust quantities or add an item the guest asked for verbally. This
        replaces the order lines and is recorded in the audit log.
      </p>

      <div className="mt-3 space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5"
          >
            <span className="text-sm text-ink truncate pr-2">
              {it.item_name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="h-8 w-8 rounded-lg border border-border bg-surface-2"
                onClick={() =>
                  setQty((q) => ({
                    ...q,
                    [it.id]: Math.max(0, (q[it.id] ?? it.qty) - 1),
                  }))
                }
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">
                {qty[it.id] ?? it.qty}
              </span>
              <button
                className="h-8 w-8 rounded-lg border border-border bg-surface-2"
                onClick={() =>
                  setQty((q) => ({ ...q, [it.id]: (q[it.id] ?? it.qty) + 1 }))
                }
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="block mt-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">
          Add an item
        </span>
        <select
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">— none —</option>
          {menuItems
            .filter((m) => m.is_available)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {formatINR(m.price_minor)}
              </option>
            ))}
        </select>
      </label>

      <label className="block mt-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">
          Reason (required)
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. guest changed their mind"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </label>

      <Button
        block
        className="mt-4"
        disabled={!reason.trim() || busy === "k" + order.id}
        onClick={() => onSubmit(lines, reason)}
      >
        {busy === "k" + order.id ? <Spinner /> : null} Save correction
      </Button>
    </Modal>
  );
}

function AddPayment({
  due,
  busy,
  onAdd,
  disabled,
}: {
  due: number;
  busy: string | null;
  onAdd: (minor: number, method: PaymentMethod, ref?: string) => void;
  disabled: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-semibold text-ink mb-2">Record a payment</p>
      <div className="grid grid-cols-3 gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder={formatINRPlain(due)}
          className="col-span-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm tabular-nums"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className="col-span-1 rounded-xl border border-border bg-surface px-2 py-2.5 text-sm"
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
        </select>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Ref (optional)"
          className="col-span-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setAmount(formatINRPlain(due))}
          className="text-xs font-medium text-brand"
        >
          Use full due
        </button>
      </div>
      <Button
        block
        className="mt-2"
        variant="subtle"
        disabled={disabled || busy === "addpay" || !amount.trim()}
        onClick={() => {
          onAdd(rupeesToMinor(amount), method, ref);
          setAmount("");
          setRef("");
        }}
      >
        {busy === "addpay" ? <Spinner /> : null} Add payment
      </Button>
      <p className="text-xs text-muted mt-2">
        UPI / card payments are held as <strong>pending</strong> until a staff
        member verifies them from the bank app.
      </p>
    </div>
  );
}

function DiscountForm({
  subtotal,
  discounts,
  busy,
  onSubmit,
  disabled,
}: {
  subtotal: number;
  discounts: Discount[];
  busy: string | null;
  onSubmit: (minor: number, reason: string) => void;
  disabled: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const total = discounts.reduce((s, d) => s + d.amount_minor, 0);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink">Discount</p>
      <p className="text-xs text-muted mt-0.5">
        Applied to {formatINR(subtotal)} · already given {formatINR(total)}
      </p>
      <div className="flex gap-2 mt-3">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="₹ amount"
          className="w-28 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm tabular-nums"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="flex-1 min-w-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </div>
      <Button
        block
        variant="outline"
        className="mt-2"
        disabled={disabled || busy === "disc" || !amount.trim() || !reason.trim()}
        onClick={() => {
          onSubmit(rupeesToMinor(amount), reason);
          setAmount("");
          setReason("");
        }}
      >
        {busy === "disc" ? <Spinner /> : null} Apply discount
      </Button>
    </Card>
  );
}

function SplitPanel({
  bill,
  items,
  orders,
  splits,
  busy,
  run,
}: {
  bill: Bill;
  items: OrderItem[];
  orders: Order[];
  splits: BillSplit[];
  busy: string | null;
  run: (
    tag: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okNote?: string
  ) => Promise<void>;
}) {
  const [people, setPeople] = useState("2");
  const [mode, setMode] = useState<"none" | "people" | "items">("none");
  const [groups, setGroups] = useState(2);
  const [assign, setAssign] = useState<Record<string, string>>({});

  const approvedOrders = orders.filter((o) => o.status === "approved");
  const approvedOrderIds = new Set(approvedOrders.map((o) => o.id));
  const live = items.filter((i) => approvedOrderIds.has(i.order_id));

  return (
    <section>
      <SectionTitle
        title="Split the bill"
        subtitle="Splits always reconcile exactly to the bill total"
      />
      <Card className="p-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "people" ? "primary" : "outline"}
            onClick={() => setMode("people")}
          >
            By people
          </Button>
          <Button
            size="sm"
            variant={mode === "items" ? "primary" : "outline"}
            onClick={() => setMode("items")}
          >
            By items
          </Button>
          {splits.length ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "clr"}
              onClick={() => run("clr", () => clearSplitsAction(bill.id))}
            >
              {busy === "clr" ? <Spinner /> : null} Clear
            </Button>
          ) : null}
        </div>

        {mode === "people" ? (
          <div className="mt-3 flex items-end gap-2">
            <label className="flex-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Number of people
              </span>
              <input
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <Button
              variant="subtle"
              disabled={busy === "splitp"}
              onClick={() => {
                const n = parseInt(people, 10);
                if (!n || n < 2) return;
                run("splitp", () => splitByPeopleAction(bill.id, n));
              }}
            >
              {busy === "splitp" ? <Spinner /> : null} Split equally
            </Button>
          </div>
        ) : null}

        {mode === "items" ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">People:</span>
              {Array.from({ length: groups }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium"
                >
                  Person {i + 1}
                </span>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGroups((g) => Math.min(8, g + 1))}
              >
                + Person
              </Button>
            </div>

            {live.length === 0 ? (
              <p className="text-sm text-muted">No approved items to split.</p>
            ) : (
              <div className="space-y-2">
                {live.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5"
                  >
                    <span className="text-sm text-ink truncate pr-2">
                      {it.qty} × {it.item_name}
                    </span>
                    <select
                      value={assign[it.id] ?? "0"}
                      onChange={(e) =>
                        setAssign((a) => ({ ...a, [it.id]: e.target.value }))
                      }
                      className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                    >
                      {Array.from({ length: groups }).map((_, i) => (
                        <option key={i} value={String(i)}>
                          Person {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <Button
              block
              variant="subtle"
              disabled={busy === "spliti" || live.length === 0}
              onClick={() => {
                const built = Array.from({ length: groups }, (_, i) => ({
                  label: `Person ${i + 1}`,
                  order_item_ids: live
                    .filter((it) => (assign[it.id] ?? "0") === String(i))
                    .map((it) => it.id),
                })).filter((g) => g.order_item_ids.length > 0);
                run("spliti", () => splitByItemsAction(bill.id, built));
              }}
            >
              {busy === "spliti" ? <Spinner /> : null} Create item split
            </Button>
          </div>
        ) : null}

        {splits.length ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-sm font-semibold mb-2">
              {splits[0].kind === "person" ? "Equal split" : "Item split"}
            </p>
            <ul className="space-y-1.5">
              {splits.map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="tabular-nums font-medium">
                    {formatINR(s.amount_minor)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between text-sm font-bold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatINR(splits.reduce((s, x) => s + x.amount_minor, 0))}
              </span>
            </p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function ForceClear({
  label,
  busy,
  onForce,
}: {
  label: string;
  busy: string | null;
  onForce: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <Banner tone="amber">
        This bill is not fully paid. Clearing anyway requires a reason and is
        flagged to the owner.
      </Banner>
      <Button
        block
        variant="outline"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        Force clear {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Force clear table">
        <p className="text-sm text-muted">
          This closes the table with an unpaid balance. The owner will see this
          in the audit log and outstanding report.
        </p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
        />
        <Button
          block
          variant="danger"
          className="mt-3"
          disabled={!reason.trim() || busy === "clear"}
          onClick={() => onForce(reason)}
        >
          {busy === "clear" ? <Spinner /> : null} Force clear
        </Button>
      </Modal>
    </>
  );
}
