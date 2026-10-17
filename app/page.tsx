import Link from "next/link";
import { dbConfigured } from "@/lib/supabase";
import { Button, Card, Badge } from "@/components/ui";
import { IconQr, IconLock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const configured = dbConfigured();

  return (
    <main className="flex-1">
      {/* Brand hero — the one committed band on this page */}
      <section className="brand-band px-4 pb-12 pt-10 text-center rounded-b-2xl">
        <div className="relative mx-auto mb-4 h-16 w-16">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/12 text-white text-3xl font-bold ring-1 ring-white/25 shadow-pop">
            M
          </span>
          {/* Shudh mark — the green dot that means vegetarian */}
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-green ring-2 ring-white/70"
          >
            <span className="h-2 w-2 rounded-full bg-white/90" />
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">
          Mittal&apos;s Shudh Shakahari Bhojanalaya
        </h1>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70 mt-2">
          Pure Vegetarian · Model Town, Panipat
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green-soft" />
            100% Shudh Shakahari
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
            <IconQr size={13} />
            QR table ordering
          </span>
        </div>
      </section>

      <div className="mx-auto w-full max-w-xl px-4 pb-10">
        {!configured ? (
          <Card className="p-4 mb-4 -mt-6 relative border-red-soft bg-red-soft/40">
            <p className="text-sm font-semibold text-red">Database not configured</p>
            <p className="text-xs text-muted mt-1">
              Add Supabase keys to <code>.env.local</code> and run the SQL migration.
            </p>
          </Card>
        ) : null}

        <Card className="p-5 relative -mt-8 mb-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <IconQr size={20} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink">
                Ordering at your table
              </h2>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                Scan the QR code on your table to see the menu and place an
                order. No app or login needed. Everyone at the table shares one
                bill.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <IconLock size={20} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink">Staff &amp; Owner</h2>
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
      </div>
    </main>
  );
}
