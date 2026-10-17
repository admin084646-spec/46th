import { pageAdmin } from "@/lib/guard";
import { getMenu } from "@/lib/business";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { MenuAvailability } from "@/components/menu-availability";
import { SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const staff = await pageAdmin();
  const { categories, items } = await getMenu();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Menu availability" />
      <main className="px-4 py-4">
        <SectionTitle
          title="Menu"
          subtitle="Mark items sold out — guests see it instantly"
        />
        <MenuAvailability categories={categories} items={items} />
      </main>
      <StaffNav role={staff.role} />
    </div>
  );
}
