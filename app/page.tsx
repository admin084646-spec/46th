import Link from "next/link";
import { dbConfigured } from "@/lib/supabase";
import { Button, Card } from "@/components/ui";
import { IconQr, IconLock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const configured = dbConfigured();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 flex-1">
      <div className="text-center mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white text-2xl font-bold mb-3">
          M
        </div>
        <h1 className="text-xl font-bold text-ink leading-tight">
          Mittal&apos;s Shudh Shakahari Bhojanalaya
        </h1>
        <p className="text-sm text-muted mt-1">
          Pure Vegetarian · Model Town, Panipat
        </p>
      </div>

      {!configured ? (
        <Card className="p-4 mb-4 border-red-soft bg-red-soft/40">
          <p className="text-sm font-semibold text-red">Database not configured</p>
          <p className="text-xs text-muted mt-1">
            Add Supabase keys to <code>.env.local</code> and run the SQL migration.
          </p>
        </Card>
      ) : null}

      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-brand mt-0.5">
            <IconQr size={24} />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Ordering at your table</h2>
            <p className="text-sm text-muted mt-1">
              Scan the QR code on your table to see the menu and place an order. No
              app or login needed. Everyone at the table shares one bill.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-brand mt-0.5">
            <IconLock size={24} />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Staff &amp; Owner</h2>
            <p className="text-sm text-muted mt-1">
              A 6-digit PIN is required every time — cashier, kitchen, waiter
              and owner workspaces.
            </p>
          </div>
        </div>
        <Link href="/login">
          <Button block size="lg">
            Staff sign in
          </Button>
        </Link>
      </Card>

      <p className="text-center text-xs text-muted mt-6">
        Open 10:00 AM – 10:30 PM · +91 98765 43210
      </p>
    </main>
  );
}
