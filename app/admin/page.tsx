import Link from "next/link";
import { pageAdmin } from "@/lib/guard";
import { getOpenServiceRequests, getPendingOrders } from "@/lib/queries";
import { getTableBoard } from "@/lib/business";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { Approvals } from "@/components/approvals";
import { ServiceRequests } from "@/components/service-requests";
import { SectionTitle, Stat, Button, Card } from "@/components/ui";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const staff = await pageAdmin();
  const [pending, requests, board] = await Promise.all([
    getPendingOrders(),
    getOpenServiceRequests(),
    getTableBoard(),
  ]);

  const occupied = board.filter((b) => b.session);
  const unpaid = board.filter(
    (b) => b.session && b.bill && b.bill.status !== "paid"
  );
  const outstanding = unpaid.reduce(
    (s, b) =>
      s + Math.max(0, (b.bill?.total_minor ?? 0) - (b.bill?.paid_minor ?? 0)),
    0
  );
  const ready = board.reduce((s, b) => s + b.activeTicketCount, 0);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Counter" />

      <main className="px-4 py-4 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Awaiting approval" value={String(pending.length)} tone={pending.length ? "amber" : "neutral"} />
          <Stat label="Occupied tables" value={String(occupied.length)} />
          <Stat label="Open requests" value={String(requests.length)} tone={requests.length ? "brand" : "neutral"} />
          <Stat label="Outstanding" value={formatINR(outstanding)} tone={outstanding ? "amber" : "neutral"} />
        </div>

        <section>
          <SectionTitle
            title="Approvals"
            subtitle="Approve to send a ticket to the kitchen"
            right={
              <Link href="/admin/tables">
                <Button size="sm" variant="outline">
                  Tables
                </Button>
              </Link>
            }
          />
          <Approvals rows={pending} />
        </section>

        <section>
          <SectionTitle
            title="Service requests"
            subtitle={`${ready} active kitchen ticket${ready === 1 ? "" : "s"}`}
          />
          <ServiceRequests requests={requests} />
        </section>

        <section>
          <SectionTitle title="Live tables" subtitle="Tap a table to open its bill" />
          {occupied.length === 0 ? (
            <Card className="p-4 text-sm text-muted">All tables are free.</Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {occupied.map((b) => (
                <Link
                  key={b.table.id}
                  href={`/admin/bill/${b.session!.id}`}
                  className="rounded-2xl border border-border bg-surface p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{b.table.label}</span>
                    {b.pendingCount > 0 ? (
                      <span className="text-[11px] rounded-full bg-amber-soft text-amber px-2 py-0.5 font-medium">
                        {b.pendingCount} new
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {b.bill ? formatINR(b.bill.total_minor) : "No bill yet"}
                  </p>
                  <p className="text-xs mt-0.5">
                    {b.bill?.status === "paid" ? (
                      <span className="text-green font-medium">Paid · clear me</span>
                    ) : b.bill ? (
                      <span className="text-amber font-medium">
                        Due {formatINR(Math.max(0, b.bill.total_minor - b.bill.paid_minor))}
                      </span>
                    ) : (
                      <span className="text-muted">Seated</span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <StaffNav role={staff.role} />
    </div>
  );
}
