"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/components/live";
import {
  addExtraItemsAction,
  setTicketStatusAction,
} from "@/lib/actions/service";
import { ServiceRequests } from "@/components/service-requests";
import { formatINR } from "@/lib/money";
import { formatTime, minutesSince } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import type { KitchenTicket, MenuItem, OrderItem, ServiceRequest } from "@/lib/types";

export interface WaiterTicketRow {
  ticket: KitchenTicket;
  orderNo: number;
  items: OrderItem[];
}

export interface WaiterSession {
  id: string;
  label: string;
  due: number;
}

export function WaiterBoard({
  tickets,
  requests,
  sessions,
  menuItems,
}: {
  tickets: WaiterTicketRow[];
  requests: ServiceRequest[];
  sessions: WaiterSession[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLive(["role:waiter", "role:kitchen"], 6000);

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

  const ready = tickets.filter((t) => t.ticket.status === "ready");
  const pickedUp = tickets.filter((t) => t.ticket.status === "picked_up");

  return (
    <div className="space-y-6">
      {error ? <Banner tone="red">{error}</Banner> : null}

      <section>
        <SectionTitle
          title="Ready to serve"
          subtitle="Collect from the pass and serve to the table"
        />
        {tickets.length === 0 ? (
          <EmptyState
            title="Nothing at the pass"
            hint="Kitchen tickets appear here when they are ready."
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {[...ready, ...pickedUp].map((row) => {
              const age = minutesSince(row.ticket.ready_at ?? row.ticket.created_at);
              return (
                <Card key={row.ticket.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-ink truncate">
                        {row.ticket.table_label}
                      </span>
                      <Badge tone="neutral">#{row.orderNo}</Badge>
                    </div>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        age >= 5 ? "text-red font-semibold" : "text-muted"
                      )}
                    >
                      {formatTime(row.ticket.ready_at ?? row.ticket.created_at)}
                      {" · "}
                      {age}m
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {row.items.map((it) => (
                      <li key={it.id} className="flex text-sm text-ink">
                        <span className="font-semibold tabular-nums pr-1">
                          {it.qty}×
                        </span>
                        <span>{it.item_name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    {row.ticket.status === "ready" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={busy === "pu" + row.ticket.id}
                        onClick={() =>
                          act("pu" + row.ticket.id, () =>
                            setTicketStatusAction(row.ticket.id, "picked_up")
                          )
                        }
                      >
                        {busy === "pu" + row.ticket.id ? <Spinner /> : null}{" "}
                        Picked up
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="success"
                      className="flex-1"
                      disabled={busy === "sv" + row.ticket.id}
                      onClick={() =>
                        act("sv" + row.ticket.id, () =>
                          setTicketStatusAction(row.ticket.id, "served")
                        )
                      }
                    >
                      {busy === "sv" + row.ticket.id ? <Spinner /> : null}{" "}
                      Served
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title="Guest requests"
          subtitle="Attend quickly — guests see the status live"
        />
        <ServiceRequests requests={requests} />
      </section>

      <AddItems sessions={sessions} menuItems={menuItems} act={act} busy={busy} />
    </div>
  );
}

function AddItems({
  sessions,
  menuItems,
  act,
  busy,
}: {
  sessions: WaiterSession[];
  menuItems: MenuItem[];
  act: (
    tag: string,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) => Promise<void>;
  busy: string | null;
}) {
  const [sessionId, setSessionId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menuItems
      .filter((m) => m.is_available)
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [menuItems, query]);

  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ menu_item_id: id, qty }));

  const cartTotal = lines.reduce((s, l) => {
    const m = menuItems.find((x) => x.id === l.menu_item_id);
    return s + (m?.price_minor ?? 0) * l.qty;
  }, 0);

  if (!sessions.length) {
    return (
      <section>
        <SectionTitle title="Add items for a table" />
        <Card className="p-4 text-sm text-muted">
          No seated tables right now.
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle
        title="Add items for a table"
        subtitle="For items requested verbally — no approval needed, straight to kitchen"
      />
      <Card className="p-4">
        <label className="block">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">
            Table
          </span>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">Choose a seated table…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.due > 0 ? ` · due ${formatINR(s.due)}` : ""}
              </option>
            ))}
          </select>
        </label>

        {sessionId ? (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            />
            <div className="mt-2 max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {filtered.map((m) => {
                const qty = cart[m.id] ?? 0;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{m.name}</p>
                      <p className="text-xs text-muted tabular-nums">
                        {formatINR(m.price_minor)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qty > 0 ? (
                        <button
                          className="h-8 w-8 rounded-lg border border-border bg-surface-2"
                          onClick={() =>
                            setCart((c) => {
                              const n = { ...c };
                              const v = (n[m.id] ?? 0) - 1;
                              if (v <= 0) delete n[m.id];
                              else n[m.id] = v;
                              return n;
                            })
                          }
                        >
                          −
                        </button>
                      ) : null}
                      {qty > 0 ? (
                        <span className="w-5 text-center text-sm font-semibold tabular-nums">
                          {qty}
                        </span>
                      ) : null}
                      <button
                        className="h-8 w-8 rounded-lg border border-border bg-surface-2"
                        onClick={() =>
                          setCart((c) => ({ ...c, [m.id]: (c[m.id] ?? 0) + 1 }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Note for kitchen (optional)"
              className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            />

            <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
              <span className="text-muted">
                {lines.reduce((s, l) => s + l.qty, 0)} items
              </span>
              <span className="font-semibold tabular-nums">
                {formatINR(cartTotal)}
              </span>
            </div>

            <Button
              block
              className="mt-3"
              disabled={!lines.length || busy === "extra"}
              onClick={async () => {
                await act("extra", () =>
                  addExtraItemsAction(sessionId, lines, note)
                );
                setCart({});
                setNote("");
              }}
            >
              {busy === "extra" ? <Spinner /> : null} Send to kitchen
            </Button>
          </>
        ) : null}
      </Card>
    </section>
  );
}
