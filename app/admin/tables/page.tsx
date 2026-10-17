import Link from "next/link";
import { pageAdmin } from "@/lib/guard";
import { getTableBoard } from "@/lib/business";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { TableBoard } from "@/components/table-board";
import { Button, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const staff = await pageAdmin();
  const rows = await getTableBoard();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Tables" />
      <main className="px-4 py-4">
        <SectionTitle
          title="All tables"
          subtitle="One live session per table · tap an occupied table to open its bill"
        />
        <Link href="/admin/qr" className="mb-3 block">
          <Button block variant="outline" size="sm">
            Print table QR codes
          </Button>
        </Link>
        <TableBoard rows={rows} />
      </main>
      <StaffNav role={staff.role} />
    </div>
  );
}
