import { pageKitchen } from "@/lib/guard";
import { getKitchenTickets } from "@/lib/queries";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { KitchenBoard } from "@/components/kitchen-board";
import { SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const staff = await pageKitchen();
  const rows = await getKitchenTickets(["approved", "preparing", "ready"]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Kitchen display" />
      <main className="px-4 py-4">
        <SectionTitle
          title="Tickets"
          subtitle="Oldest first · tap to move a ticket forward"
        />
        <KitchenBoard rows={rows} />
      </main>
      <StaffNav role={staff.role} />
    </div>
  );
}
