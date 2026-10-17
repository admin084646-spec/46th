import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin } from "@/lib/guard";
import { getSessionWorkspace } from "@/lib/business";
import { BUSINESS } from "@/lib/business-info";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import type { OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await pageAdmin();
  const { sessionId } = await params;
  const ws = await getSessionWorkspace(sessionId);
  if (!ws.session) notFound();

  const approvedOrders = ws.orders.filter((o) => o.status === "approved");
  const approvedIds = new Set(approvedOrders.map((o) => o.id));
  const lines: OrderItem[] = ws.items.filter((i) => approvedIds.has(i.order_id));
  const due = ws.bill
    ? Math.max(0, ws.bill.total_minor - ws.bill.paid_minor)
    : 0;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 text-ink">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/admin/bill/${sessionId}`}
          className="text-sm font-medium text-brand"
        >
          ← Back to bill
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 print:border-0 print:p-0">
        <div className="text-center">
          <h1 className="text-base font-bold">{BUSINESS.name}</h1>
          <p className="text-xs text-muted mt-1">{BUSINESS.tagline}</p>
          {BUSINESS.addressLines.map((l) => (
            <p key={l} className="text-xs text-muted">
              {l}
            </p>
          ))}
          <p className="text-xs text-muted">Phone {BUSINESS.phone}</p>
        </div>

        <div className="mt-4 border-y border-dashed border-border py-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Table</span>
            <span className="font-semibold">{ws.table?.label ?? "—"}</span>
          </div>
          {ws.bill ? (
            <div className="flex justify-between">
              <span className="text-muted">Bill No.</span>
              <span className="font-semibold">#{ws.bill.bill_no}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-muted">Date</span>
            <span>{formatDateTime(new Date().toISOString())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Guests' session start</span>
            <span>{formatDateTime(ws.session.opened_at)}</span>
          </div>
        </div>

        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="py-1 font-medium">Item</th>
              <th className="py-1 font-medium text-center">Qty</th>
              <th className="py-1 font-medium text-right">Rate</th>
              <th className="py-1 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((it) => (
              <tr key={it.id} className="border-b border-border/60">
                <td className="py-1 pr-2">
                  {it.item_name}
                  {it.note ? (
                    <span className="block text-[10px] text-muted">
                      {it.note}
                    </span>
                  ) : null}
                </td>
                <td className="py-1 text-center tabular-nums">{it.qty}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatINR(it.unit_price_minor)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatINR(it.unit_price_minor * it.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 text-xs">
          <Row label="Subtotal" value={formatINR(ws.bill?.subtotal_minor ?? 0)} />
          {(ws.bill?.discount_minor ?? 0) > 0 ? (
            <Row
              label="Discount"
              value={`− ${formatINR(ws.bill!.discount_minor)}`}
            />
          ) : null}
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatINR(ws.bill?.total_minor ?? 0)}
            </span>
          </div>
        </div>

        <div className="mt-3 text-xs">
          <Row label="Paid" value={formatINR(ws.bill?.paid_minor ?? 0)} />
          <Row label="Balance due" value={formatINR(due)} />
        </div>

        {ws.payments.filter((p) => p.status !== "void").length ? (
          <div className="mt-3 text-xs">
            <p className="font-semibold mb-1">Payment breakdown</p>
            {ws.payments
              .filter((p) => p.status !== "void")
              .map((p) => (
                <Row
                  key={p.id}
                  label={`${p.method.toUpperCase()} ${p.status === "pending" ? "(unverified)" : ""}`}
                  value={formatINR(p.amount_minor)}
                />
              ))}
          </div>
        ) : null}

        {ws.splits.length ? (
          <div className="mt-3 text-xs">
            <p className="font-semibold mb-1">
              Split {ws.splits[0].kind === "person" ? "equally" : "by items"}
            </p>
            {ws.splits.map((s) => (
              <Row
                key={s.id}
                label={s.label}
                value={formatINR(s.amount_minor)}
              />
            ))}
          </div>
        ) : null}

        <p className="mt-4 border-t border-dashed border-border pt-3 text-center text-[11px] text-muted">
          {BUSINESS.note}
          <br />
          Thank you — please visit again! 🙏
        </p>
      </div>

      <style>{`
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
