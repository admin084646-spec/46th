import Link from "next/link";
import { getTableByToken, getMenu, getLiveSession, getSessionWorkspace } from "@/lib/business";
import { getGuestSession } from "@/lib/auth";
import { CustomerApp } from "@/components/customer-app";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TablePage({
  params,
}: {
  params: Promise<{ qr: string }>;
}) {
  const { qr } = await params;
  const table = await getTableByToken(qr);

  if (!table) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <Card className="p-6 text-center">
          <h1 className="font-semibold text-ink">QR code not recognised</h1>
          <p className="text-sm text-muted mt-2">
            Please ask our staff for help, or scan the QR code on your table again.
          </p>
          <Link href="/" className="text-brand text-sm mt-4 inline-block underline">
            Back to home
          </Link>
        </Card>
      </main>
    );
  }

  const menu = await getMenu();
  const guest = await getGuestSession();

  let initial = null;
  if (guest && guest.tableId === table.id) {
    const live = await getLiveSession(table.id);
    if (live && live.id === guest.sessionId) {
      const ws = await getSessionWorkspace(live.id);
      initial = {
        sessionId: live.id,
        sessionStatus: live.status,
        orders: ws.orders,
        items: ws.items,
        tickets: ws.tickets,
        bill: ws.bill,
        payments: ws.payments,
        requests: ws.requests,
      };
    }
  }

  return (
    <CustomerApp
      qr={qr}
      tableLabel={table.label}
      categories={menu.categories}
      items={menu.items}
      guest={guest ? { label: guest.label, sessionId: guest.sessionId } : null}
      initial={initial}
    />
  );
}
