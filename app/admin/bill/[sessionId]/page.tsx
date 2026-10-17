import { notFound } from "next/navigation";
import { pageAdmin } from "@/lib/guard";
import { getMenu, getSessionWorkspace } from "@/lib/business";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { BillingScreen } from "@/components/billing-screen";

export const dynamic = "force-dynamic";

export default async function BillPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const staff = await pageAdmin();
  const { sessionId } = await params;

  const [ws, menu] = await Promise.all([
    getSessionWorkspace(sessionId),
    getMenu(),
  ]);
  if (!ws.session) notFound();

  const tableLabel = ws.table?.label ?? "Table";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title={`${tableLabel} · bill`} />
      <main className="px-4 py-4">
        <BillingScreen
          w={{
            tableLabel,
            session: {
              id: ws.session.id,
              status: ws.session.status,
              opened_at: ws.session.opened_at,
            },
            bill: ws.bill,
            orders: ws.orders,
            items: ws.items,
            payments: ws.payments,
            discounts: ws.discounts,
            splits: ws.splits,
            menuItems: menu.items,
          }}
        />
      </main>
      <StaffNav role={staff.role} />
    </div>
  );
}
