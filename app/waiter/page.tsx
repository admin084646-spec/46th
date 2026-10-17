import { pageWaiter } from "@/lib/guard";
import { getOpenServiceRequests, getWaiterTickets } from "@/lib/queries";
import { getMenu, getTableBoard } from "@/lib/business";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { WaiterBoard } from "@/components/waiter-board";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  const staff = await pageWaiter();
  const [tickets, requests, board, menu] = await Promise.all([
    getWaiterTickets(),
    getOpenServiceRequests(),
    getTableBoard(),
    getMenu(),
  ]);

  const sessions = board
    .filter((b) => b.session && b.session.status === "active")
    .map((b) => ({
      id: b.session!.id,
      label: b.table.label,
      due: Math.max(
        0,
        (b.bill?.total_minor ?? 0) - (b.bill?.paid_minor ?? 0)
      ),
    }));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Floor" />
      <main className="px-4 py-4">
        <WaiterBoard
          tickets={tickets}
          requests={requests}
          sessions={sessions}
          menuItems={menu.items}
        />
      </main>
      <StaffNav role={staff.role} />
    </div>
  );
}
