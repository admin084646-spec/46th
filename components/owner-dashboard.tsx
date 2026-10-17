import Link from "next/link";
import { formatINR } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/format";
import { Card, SectionTitle, Stat } from "@/components/ui";
import type { AuditEntry } from "@/lib/types";
import type {
  OutstandingBillRow,
  PopularItem,
  RangeSummary,
  StaffPerf,
} from "@/lib/reports";

export function OwnerDashboard({
  summary,
  outstanding,
  staff,
  audit,
  rangeLabel,
}: {
  summary: RangeSummary;
  outstanding: OutstandingBillRow[];
  staff: StaffPerf[];
  audit: AuditEntry[];
  rangeLabel: string;
}) {
  const maxHour = Math.max(1, ...summary.hourly.map((h) => h.totalMinor));
  const maxPopular = Math.max(1, ...summary.popular.map((p) => p.totalMinor));
  const mixTotal =
    summary.byMethod.cash + summary.byMethod.upi + summary.byMethod.card || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Net sales" value={formatINR(summary.netMinor)} hint={rangeLabel} tone="brand" />
        <Stat label="Collected" value={formatINR(summary.collectedMinor)} />
        <Stat
          label="Outstanding"
          value={formatINR(summary.outstandingMinor)}
          tone={summary.outstandingMinor > 0 ? "amber" : "neutral"}
        />
        <Stat label="Bills" value={String(summary.bills)} hint={`${summary.orders} orders`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Gross" value={formatINR(summary.grossMinor)} />
        <Stat label="Discounts" value={formatINR(summary.discountsMinor)} />
        <Stat
          label="Avg bill"
          value={formatINR(
            summary.bills ? Math.round(summary.netMinor / summary.bills) : 0
          )}
        />
      </div>

      {/* Payment mix */}
      <section>
        <SectionTitle title="Payment mix" subtitle="Verified collections only" />
        <Card className="p-4 space-y-3">
          {(["cash", "upi", "card"] as const).map((m) => {
            const v = summary.byMethod[m];
            const pct = Math.round((v / mixTotal) * 100);
            return (
              <div key={m}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-ink capitalize">{m}</span>
                  <span className="tabular-nums text-muted">
                    {formatINR(v)} · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      {/* Hourly */}
      <section>
        <SectionTitle title="Sales by hour" subtitle={rangeLabel} />
        <Card className="p-4">
          {summary.hourly.length === 0 ? (
            <p className="text-sm text-muted">No sales in this range.</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {summary.hourly.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand/80"
                    style={{
                      height: `${Math.max(2, (h.totalMinor / maxHour) * 100)}%`,
                    }}
                    title={`${h.hour}:00 · ${formatINR(h.totalMinor)}`}
                  />
                  <span className="text-[9px] text-muted tabular-nums">
                    {String(h.hour).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Popular */}
      <section>
        <SectionTitle title="Popular items" subtitle="By revenue in range" />
        <Card className="p-4">
          {summary.popular.length === 0 ? (
            <p className="text-sm text-muted">No items sold in this range.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.popular.slice(0, 10).map((p: PopularItem) => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink truncate pr-2">{p.name}</span>
                    <span className="tabular-nums text-muted shrink-0">
                      {p.qty} · {formatINR(p.totalMinor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green"
                      style={{
                        width: `${Math.max(
                          4,
                          (p.totalMinor / maxPopular) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Outstanding */}
      <section>
        <SectionTitle
          title="Outstanding bills"
          subtitle="Unpaid or partially paid — chase these"
        />
        {outstanding.length === 0 ? (
          <Card className="p-4 text-sm text-green">
            Nothing outstanding. Every bill is settled. 🎉
          </Card>
        ) : (
          <div className="space-y-2">
            {outstanding.map((o) => (
              <Link
                key={o.bill.id}
                href={`/admin/bill/${o.bill.session_id}`}
                className="block"
              >
                <Card className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {o.tableLabel}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-amber">
                      {formatINR(
                        Math.max(0, o.bill.total_minor - o.bill.paid_minor)
                      )}{" "}
                      due
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Bill #{o.bill.bill_no} · session {o.sessionStatus} ·{" "}
                    {formatDateTime(o.bill.created_at)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Staff */}
      <section>
        <SectionTitle title="Staff activity" subtitle={rangeLabel} />
        <Card className="p-4 overflow-x-auto">
          {staff.length === 0 ? (
            <p className="text-sm text-muted">No staff activity logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 font-medium">Staff</th>
                  <th className="py-1.5 font-medium text-center">Approved</th>
                  <th className="py-1.5 font-medium text-center">Cancel</th>
                  <th className="py-1.5 font-medium text-center">Disc</th>
                  <th className="py-1.5 font-medium text-center">Cleared</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.name} className="border-t border-border">
                    <td className="py-1.5 text-ink">{s.name}</td>
                    <td className="py-1.5 text-center tabular-nums">{s.approvals}</td>
                    <td className="py-1.5 text-center tabular-nums">{s.cancels}</td>
                    <td className="py-1.5 text-center tabular-nums">{s.discounts}</td>
                    <td className="py-1.5 text-center tabular-nums">{s.cleared}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      {/* Audit */}
      <section>
        <SectionTitle
          title="Audit trail"
          subtitle="Every sensitive action, who and when"
        />
        <Card className="p-4">
          {audit.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {audit.slice(0, 40).map((a) => (
                <li key={a.id} className="text-sm border-b border-border/60 pb-2 last:border-0">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-ink">{a.action}</span>
                    <span className="text-xs text-muted shrink-0">
                      {formatTime(a.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {a.actor_name ?? "System"}
                    {a.entity ? ` · ${a.entity}` : ""}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
