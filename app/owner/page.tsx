import { pageOwner } from "@/lib/guard";
import {
  getOutstandingBills,
  getRangeSummary,
  getStaffPerformance,
} from "@/lib/reports";
import { getAuditLog } from "@/lib/queries";
import { istDateInput } from "@/lib/format";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { ReportRange } from "@/components/report-range";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

function isDate(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await pageOwner();
  const sp = await searchParams;
  const rawFrom = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const rawTo = Array.isArray(sp.to) ? sp.to[0] : sp.to;

  const today = istDateInput();
  const from = isDate(rawFrom) ? rawFrom : today;
  const to = isDate(rawTo) ? rawTo : today;

  const [summary, outstanding, staffPerf, audit] = await Promise.all([
    getRangeSummary(from, to),
    getOutstandingBills(),
    getStaffPerformance(from, to),
    getAuditLog(60),
  ]);

  const rangeLabel = from === to ? `For ${from}` : `${from} → ${to}`;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Owner reports" />
      <main className="px-4 py-4 space-y-5">
        <section>
          <SectionTitle
            title="Reports"
            subtitle="No GST — figures are your true net sales"
          />
          <ReportRange from={from} to={to} />
        </section>

        <OwnerDashboard
          summary={summary}
          outstanding={outstanding}
          staff={staffPerf}
          audit={audit}
          rangeLabel={rangeLabel}
        />
      </main>
      <StaffNav role={staff.role} />
    </div>
  );
}
