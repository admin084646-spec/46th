"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/components/live";
import { sessionTopic, MENU_TOPIC } from "@/lib/topics";
import {
  submitOrderAction,
  requestServiceAction,
} from "@/lib/actions/guest";
import { joinTableAction, renameGuestAction } from "@/lib/actions/auth";
import { formatINR } from "@/lib/money";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge, Banner, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { Modal } from "@/components/modal";
import {
  IconBell,
  IconCheck,
  IconMinus,
  IconPlus,
  IconReceipt,
} from "@/components/icons";
import type {
  Bill,
  Category,
  KitchenTicket,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  ServiceRequest,
} from "@/lib/types";

interface Props {
  qr: string;
  tableLabel: string;
  categories: Category[];
  items: MenuItem[];
  guest: { label: string; sessionId: string } | null;
  initial: {
    sessionId: string;
    sessionStatus: string;
    orders: Order[];
    items: OrderItem[];
    tickets: KitchenTicket[];
    bill: Bill | null;
    payments: Payment[];
    requests: ServiceRequest[];
  } | null;
}

type Tab = "menu" | "orders" | "bill" | "help";

/** How long to wait for the counter before offering a retry (ms). */
const JOIN_TIMEOUT_MS = 20000;

export function CustomerApp({
  qr,
  tableLabel,
  categories,
  items: menuItems,
  guest,
  initial,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("menu");
  const [joinState, setJoinState] = useState<"idle" | "joining" | "error">(
    guest ? "idle" : "joining"
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [orderNote, setOrderNote] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sessionId = guest?.sessionId ?? initial?.sessionId ?? null;
  useLive(
    [sessionId ? sessionTopic(sessionId) : "", MENU_TOPIC].filter(Boolean),
    9000
  );

  // Join on first load (no cookie yet). This must never spin forever: if the
  // counter is unreachable (phone on the wrong Wi-Fi, server restarting, stale
  // build) we stop waiting and offer a retry instead of an endless "Setting up…".
  useEffect(() => {
    if (guest) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      setJoinState("joining");
      try {
        const res = await Promise.race([
          joinTableAction(qr),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("join-timeout")),
              JOIN_TIMEOUT_MS
            );
          }),
        ]);
        if (cancelled) return;
        if (!res.ok) {
          setJoinState("error");
          setJoinError(res.error);
          return;
        }
        router.refresh();
      } catch {
        if (cancelled) return;
        setJoinState("error");
        setJoinError(
          "We couldn't reach the counter. Make sure you're on the restaurant Wi-Fi, then try again."
        );
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [guest, qr, router, joinAttempt]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    for (const it of initial?.items ?? []) {
      const arr = map.get(it.order_id) ?? [];
      arr.push(it);
      map.set(it.order_id, arr);
    }
    return map;
  }, [initial?.items]);

  const ticketByOrder = useMemo(() => {
    const map = new Map<string, KitchenTicket>();
    for (const t of initial?.tickets ?? []) map.set(t.order_id, t);
    return map;
  }, [initial?.tickets]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const item = menuItems.find((m) => m.id === id);
          return item && qty > 0 ? { item, qty } : null;
        })
        .filter(Boolean) as Array<{ item: MenuItem; qty: number }>,
    [cart, menuItems]
  );

  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce(
    (s, l) => s + l.item.price_minor * l.qty,
    0
  );

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function remove(id: string) {
    setCart((c) => {
      const next = { ...c };
      const q = (next[id] ?? 0) - 1;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setNotice(null);
    const res = await submitOrderAction({
      items: cartLines.map((l) => ({
        menu_item_id: l.item.id,
        qty: l.qty,
        note: lineNotes[l.item.id],
      })),
      note: orderNote,
      idempotencyKey:
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now())),
    });
    setSubmitting(false);
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setCart({});
    setLineNotes({});
    setOrderNote("");
    setReviewOpen(false);
    setTab("orders");
    setToast("Order sent to the counter for approval");
    router.refresh();
  }

  async function requestService(
    type: "waiter" | "bill" | "water" | "custom",
    note?: string
  ) {
    const res = await requestServiceAction({ type, note });
    if (!res.ok) setNotice(res.error);
    else {
      setToast("Request sent — a waiter will be with you");
      router.refresh();
    }
  }

  /* ------------------------------ joining ------------------------------ */
  if (!guest && joinState !== "idle") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        {joinState === "joining" ? (
          <Card className="p-8">
            <Spinner className="mx-auto text-brand" />
            <p className="text-sm text-muted mt-3">
              Setting up {tableLabel}…
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <h1 className="font-semibold text-ink">Couldn&apos;t start</h1>
            <p className="text-sm text-muted mt-2">{joinError}</p>
            <Button
              className="mt-4"
              block
              onClick={() => {
                setJoinError(null);
                setJoinAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </Card>
        )}
      </main>
    );
  }

  const currentLabel = guest?.label ?? "Guest";

  return (
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{tableLabel}</p>
            <h1 className="font-semibold text-ink truncate">
              Mittal&apos;s Shudh Shakahari
            </h1>
          </div>
          <GuestName
            label={currentLabel}
            onSaved={(l) => {
              setToast(`You&apos;re ordering as ${l}`);
              router.refresh();
            }}
          />
        </div>
      </header>

      {notice ? (
        <div className="px-4 pt-3">
          <Banner tone="red">{notice}</Banner>
        </div>
      ) : null}

      <div className="px-4 pt-4 flex-1">
        {tab === "menu" ? (
          <MenuTab
            categories={categories}
            items={menuItems}
            cart={cart}
            onAdd={add}
            onRemove={remove}
          />
        ) : null}
        {tab === "orders" ? (
          <OrdersTab
            orders={initial?.orders ?? []}
            itemsByOrder={itemsByOrder}
            ticketByOrder={ticketByOrder}
            currentLabel={currentLabel}
          />
        ) : null}
        {tab === "bill" ? (
          <BillTab
            bill={initial?.bill ?? null}
            payments={initial?.payments ?? []}
            orders={initial?.orders ?? []}
            itemsByOrder={itemsByOrder}
            onRequestBill={() => requestService("bill")}
          />
        ) : null}
        {tab === "help" ? (
          <HelpTab onRequest={requestService} />
        ) : null}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && tab === "menu" ? (
        <div className="fixed left-0 right-0 bottom-16 z-30 px-4">
          <button
            onClick={() => setReviewOpen(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-brand text-white px-4 py-3 shadow-lg active:bg-brand-strong"
          >
            <span className="text-sm font-medium">
              {cartCount} item{cartCount > 1 ? "s" : ""} · {formatINR(cartTotal)}
            </span>
            <span className="text-sm font-semibold inline-flex items-center gap-1">
              Review <IconPlus size={16} />
            </span>
          </button>
        </div>
      ) : null}

      {/* Bottom nav */}
      <nav className="fixed left-0 right-0 bottom-0 z-30 border-t border-border bg-surface safe-bottom">
        <div className="mx-auto flex w-full max-w-md">
          <TabButton
            active={tab === "menu"}
            onClick={() => setTab("menu")}
            label="Menu"
            icon={<IconPlus size={20} />}
          />
          <TabButton
            active={tab === "orders"}
            onClick={() => setTab("orders")}
            label="Orders"
            icon={<IconCheck size={20} />}
          />
          <TabButton
            active={tab === "bill"}
            onClick={() => setTab("bill")}
            label="Bill"
            icon={<IconReceipt size={20} />}
          />
          <TabButton
            active={tab === "help"}
            onClick={() => setTab("help")}
            label="Help"
            icon={<IconBell size={20} />}
          />
        </div>
      </nav>

      {/* Review sheet */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review your order"
      >
        {cartLines.length === 0 ? (
          <EmptyState title="Your cart is empty" />
        ) : (
          <div className="space-y-3">
            {cartLines.map((l) => (
              <div key={l.item.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {l.item.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatINR(l.item.price_minor)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <QtyBtn onClick={() => remove(l.item.id)}>
                      <IconMinus size={16} />
                    </QtyBtn>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {l.qty}
                    </span>
                    <QtyBtn onClick={() => add(l.item.id)}>
                      <IconPlus size={16} />
                    </QtyBtn>
                  </div>
                </div>
                <input
                  value={lineNotes[l.item.id] ?? ""}
                  onChange={(e) =>
                    setLineNotes((n) => ({ ...n, [l.item.id]: e.target.value }))
                  }
                  placeholder="Add a note (e.g. less spicy)"
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm"
                />
                <p className="text-right text-sm font-semibold mt-1 tabular-nums">
                  {formatINR(l.item.price_minor * l.qty)}
                </p>
              </div>
            ))}

            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">
                Note for the kitchen (optional)
              </label>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Any overall instructions"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5">
              <span className="text-sm font-medium">Total</span>
              <span className="text-base font-bold tabular-nums">
                {formatINR(cartTotal)}
              </span>
            </div>

            <p className="text-xs text-muted">
              Your order will be sent to the counter for approval before the
              kitchen starts cooking.
            </p>

            <Button block size="lg" onClick={submit} disabled={submitting}>
              {submitting ? <Spinner /> : null}
              {submitting ? "Sending…" : "Send order for approval"}
            </Button>
          </div>
        )}
      </Modal>

      {toast ? (
        <div className="fixed left-0 right-0 top-3 z-50 px-4">
          <div className="mx-auto max-w-md pop-in rounded-xl bg-ink text-white px-4 py-2.5 text-sm shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------- Menu -------------------------------- */

function MenuTab({
  categories,
  items,
  cart,
  onAdd,
  onRemove,
}: {
  categories: Category[];
  items: MenuItem[];
  cart: Record<string, number>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const sorted = [...categories].sort((a, b) => a.sort - b.sort);

  return (
    <div>
      <div className="scroll-x -mx-4 px-4 pb-2 flex gap-2">
        {sorted.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setActive(c.id);
              document
                .getElementById(`cat-${c.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium border",
              active === c.id
                ? "bg-brand text-white border-brand"
                : "bg-surface text-muted border-border"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {sorted.map((c) => {
        const catItems = items
          .filter((i) => i.category_id === c.id)
          .sort((a, b) => a.sort - b.sort);
        if (!catItems.length) return null;
        return (
          <section key={c.id} id={`cat-${c.id}`} className="pt-4 scroll-mt-32">
            <h2 className="text-sm font-semibold text-ink mb-2">{c.name}</h2>
            <div className="space-y-2">
              {catItems.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-ink">
                            {item.name}
                          </p>
                          {!item.is_available ? (
                            <Badge tone="red">Sold out</Badge>
                          ) : null}
                        </div>
                        {item.description ? (
                          <p className="text-xs text-muted mt-0.5">
                            {item.description}
                          </p>
                        ) : null}
                        <p className="text-sm font-semibold mt-1 tabular-nums">
                          {formatINR(item.price_minor)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {!item.is_available ? null : qty > 0 ? (
                          <div className="flex items-center gap-2">
                            <QtyBtn onClick={() => onRemove(item.id)}>
                              <IconMinus size={16} />
                            </QtyBtn>
                            <span className="w-5 text-center text-sm font-semibold tabular-nums">
                              {qty}
                            </span>
                            <QtyBtn onClick={() => onAdd(item.id)}>
                              <IconPlus size={16} />
                            </QtyBtn>
                          </div>
                        ) : (
                          <Button size="sm" variant="subtle" onClick={() => onAdd(item.id)}>
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------- Orders ------------------------------- */

function OrdersTab({
  orders,
  itemsByOrder,
  ticketByOrder,
  currentLabel,
}: {
  orders: Order[];
  itemsByOrder: Map<string, OrderItem[]>;
  ticketByOrder: Map<string, KitchenTicket>;
  currentLabel: string;
}) {
  if (!orders.length) {
    return (
      <EmptyState
        title="No orders yet"
        hint="Add dishes from the Menu tab and send them for approval."
      />
    );
  }
  const sorted = [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return (
    <div className="space-y-3">
      {sorted.map((o) => {
        const ticket = ticketByOrder.get(o.id);
        const items = itemsByOrder.get(o.id) ?? [];
        return (
          <Card key={o.id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Round {o.round_no}</span>
                {o.customer_label === currentLabel ? (
                  <Badge tone="brand">You</Badge>
                ) : (
                  <Badge tone="neutral">{o.customer_label ?? "Guest"}</Badge>
                )}
              </div>
              <span className="text-xs text-muted">{formatTime(o.created_at)}</span>
            </div>

            <ul className="mt-2 space-y-1">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex justify-between text-sm text-muted"
                >
                  <span className="truncate pr-2">
                    {it.qty} × {it.item_name}
                  </span>
                  <span className="tabular-nums shrink-0">
                    {formatINR(it.unit_price_minor * it.qty)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3">
              <StatusTracker order={o} ticket={ticket} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function StatusTracker({
  order,
  ticket,
}: {
  order: Order;
  ticket: KitchenTicket | undefined;
}) {
  if (order.status === "rejected") {
    return (
      <Banner tone="red">
        Not approved — {order.reject_reason ?? "please ask staff"}
      </Banner>
    );
  }
  if (order.status === "cancelled") {
    return (
      <Banner tone="red">
        Cancelled — {order.cancel_reason ?? "please ask staff"}
      </Banner>
    );
  }
  if (order.status === "pending") {
    return <Banner tone="amber">Waiting for counter approval…</Banner>;
  }

  const steps = ["Approved", "Preparing", "Ready", "Served"];
  const t = ticket?.status ?? "approved";
  const idx =
    t === "approved"
      ? 0
      : t === "preparing"
        ? 1
        : t === "ready"
          ? 2
          : 3;

  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex-1">
          <div
            className={cn(
              "h-1.5 rounded-full",
              i <= idx ? "bg-green" : "bg-surface-2"
            )}
          />
          <p
            className={cn(
              "mt-1 text-[11px] text-center",
              i <= idx ? "text-green font-medium" : "text-muted"
            )}
          >
            {s}
          </p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Bill -------------------------------- */

function BillTab({
  bill,
  payments,
  orders,
  itemsByOrder,
  onRequestBill,
}: {
  bill: Bill | null;
  payments: Payment[];
  orders: Order[];
  itemsByOrder: Map<string, OrderItem[]>;
  onRequestBill: () => void;
}) {
  const approved = orders.filter((o) => o.status === "approved");
  const lines = approved.flatMap((o) => itemsByOrder.get(o.id) ?? []);
  const due = bill ? Math.max(0, bill.total_minor - bill.paid_minor) : 0;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-2">Your table&apos;s bill</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing on the bill yet. Approved items appear here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((it) => (
              <li key={it.id} className="flex justify-between text-sm">
                <span className="text-muted truncate pr-2">
                  {it.qty} × {it.item_name}
                </span>
                <span className="tabular-nums shrink-0">
                  {formatINR(it.unit_price_minor * it.qty)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {bill ? (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatINR(bill.subtotal_minor)} />
            {bill.discount_minor > 0 ? (
              <Row
                label="Discount"
                value={`− ${formatINR(bill.discount_minor)}`}
              />
            ) : null}
            <Row label="Total" value={formatINR(bill.total_minor)} bold />
            <Row label="Paid" value={formatINR(bill.paid_minor)} />
            <Row label="Due" value={formatINR(due)} bold />
            <div className="pt-1">
              <Badge
                tone={
                  bill.status === "paid"
                    ? "green"
                    : bill.status === "partial"
                      ? "amber"
                      : "neutral"
                }
              >
                {bill.status === "paid"
                  ? "Fully paid"
                  : bill.status === "partial"
                    ? "Partially paid"
                    : "Unpaid"}
              </Badge>
            </div>
          </div>
        ) : null}
      </Card>

      {payments.filter((p) => p.status !== "void").length ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Payments recorded</h3>
          <ul className="space-y-1.5">
            {payments
              .filter((p) => p.status !== "void")
              .map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-muted capitalize">
                    {p.method} {p.status === "pending" ? "(verifying)" : ""}
                  </span>
                  <span className="tabular-nums">{formatINR(p.amount_minor)}</span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <Button block size="lg" variant="outline" onClick={onRequestBill}>
        <IconReceipt size={18} /> Request the bill
      </Button>
      <p className="text-xs text-muted text-center">
        Payment is settled at the counter. The table stays reserved for you
        until staff clear it.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={cn("text-muted", bold && "text-ink font-semibold")}>
        {label}
      </span>
      <span className={cn("tabular-nums", bold && "font-bold")}>{value}</span>
    </div>
  );
}

/* -------------------------------- Help -------------------------------- */

function HelpTab({
  onRequest,
}: {
  onRequest: (
    type: "waiter" | "bill" | "water" | "custom",
    note?: string
  ) => Promise<void>;
}) {
  const [custom, setCustom] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  async function go(
    type: "waiter" | "bill" | "water" | "custom",
    note?: string
  ) {
    setSending(type);
    await onRequest(type, note);
    setSending(null);
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Need something?</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="subtle"
            onClick={() => go("waiter")}
            disabled={sending === "waiter"}
          >
            Call a waiter
          </Button>
          <Button
            variant="subtle"
            onClick={() => go("water")}
            disabled={sending === "water"}
          >
            Water / cutlery
          </Button>
          <Button
            variant="subtle"
            onClick={() => go("bill")}
            disabled={sending === "bill"}
          >
            Request bill
          </Button>
          <Button
            variant="subtle"
            onClick={() => go("waiter", "Please come to the table")}
            disabled={sending === "waiter"}
          >
            Assistance
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Custom request</h3>
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          placeholder="e.g. extra plates, no onion in one dish"
        />
        <Button
          block
          className="mt-2"
          disabled={!custom.trim() || sending === "custom"}
          onClick={async () => {
            await go("custom", custom);
            setCustom("");
          }}
        >
          Send request
        </Button>
      </Card>
    </div>
  );
}

/* ------------------------------ utilities ------------------------------ */

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
        active ? "text-brand" : "text-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function QtyBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-surface-2 text-ink active:scale-95"
    >
      {children}
    </button>
  );
}

function GuestName({
  label,
  onSaved,
}: {
  label: string;
  onSaved: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(label);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setValue(label);
          setOpen(true);
        }}
        className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink"
      >
        {label} ✎
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Your name">
        <p className="text-sm text-muted mb-2">
          This helps staff and your table-mates know who ordered what.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base"
          placeholder="e.g. Ankit"
        />
        <Button
          block
          className="mt-3"
          disabled={saving || !value.trim()}
          onClick={async () => {
            setSaving(true);
            const res = await renameGuestAction(value);
            setSaving(false);
            if (res.ok) {
              setOpen(false);
              onSaved(res.data?.label ?? value);
            }
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </Modal>
    </>
  );
}
