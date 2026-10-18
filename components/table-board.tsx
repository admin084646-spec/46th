"use client";

import Link from "next/link";
import { useLive } from "@/components/live";
import { formatINR } from "@/lib/money";
import { formatTime } from "@/lib/format";
import { Badge, Card } from "@/components/ui";

interface Row {
  table: { id: string; label: string };
  session: {
    id: string;
    status: string;
    opened_at: string;
  } | null;
  bill: { total_minor: number; paid_minor: number; status: string } | null;
  pendingCount: number;
  activeTicketCount: number;
  requestCount: number;
}

export function TableBoard({ rows }: { rows: Row[] }) {
  useLive(["role:admin"], 25000);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {rows.map((r) => {
        const due = r.bill
          ? Math.max(0, r.bill.total_minor - r.bill.paid_minor)
          : 0;
        const live = !!r.session;
        const inner = (
          <Card className={"p-3 h-full " + (live ? "" : "opacity-90")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{r.table.label}</span>
              {r.pendingCount > 0 ? (
                <span className="text-[11px] rounded-full bg-amber-soft text-amber px-2 py-0.5 font-medium">
                  {r.pendingCount} new
                </span>
              ) : r.requestCount > 0 ? (
                <span className="text-[11px] rounded-full bg-blue-soft text-blue px-2 py-0.5 font-medium">
                  help
                </span>
              ) : null}
            </div>

            {live ? (
              <>
                <p className="text-xs text-muted mt-1">
                  Since {formatTime(r.session!.opened_at)}
                </p>
                <p className="text-sm font-semibold mt-1 tabular-nums">
                  {r.bill ? formatINR(r.bill.total_minor) : "No bill yet"}
                </p>
                {r.bill?.status === "paid" ? (
                  <p className="text-xs text-green font-medium mt-0.5">
                    Paid · ready to clear
                  </p>
                ) : r.bill ? (
                  <p className="text-xs text-amber font-medium mt-0.5">
                    Due {formatINR(due)}
                  </p>
                ) : (
                  <p className="text-xs text-muted mt-0.5">Seated</p>
                )}
                {r.activeTicketCount > 0 ? (
                  <p className="text-xs text-muted mt-1">
                    {r.activeTicketCount} ticket
                    {r.activeTicketCount === 1 ? "" : "s"} in kitchen
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-2">
                <Badge tone="neutral">Free</Badge>
              </div>
            )}
          </Card>
        );

        return live ? (
          <Link key={r.table.id} href={`/admin/bill/${r.session!.id}`}>
            {inner}
          </Link>
        ) : (
          <div key={r.table.id}>{inner}</div>
        );
      })}
    </div>
  );
}
