import Link from "next/link";
import QRCode from "qrcode";
import { pageAdmin } from "@/lib/guard";
import { getTables } from "@/lib/business";
import { appBaseUrl, isLoopbackOrigin } from "@/lib/app-url";
import { StaffHeader } from "@/components/staff-header";
import { StaffNav } from "@/components/staff-nav";
import { PrintButton } from "@/components/print-button";
import { Banner, Button, Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TableQrPage() {
  const staff = await pageAdmin();
  const [tables, origin] = await Promise.all([getTables(), appBaseUrl()]);

  const withQr = await Promise.all(
    tables.map(async (t) => {
      const url = `${origin}/t/${t.qr_token}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
        color: { dark: "#111111", light: "#ffffff" },
      });
      return { label: t.label, url, svg };
    })
  );

  const loopback = isLoopbackOrigin(origin);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 flex flex-col pb-24">
      <StaffHeader staff={staff} title="Table QR codes" />

      <main className="px-4 py-4">
        <div className="no-print mb-4 flex items-center justify-between gap-2">
          <Link href="/admin/tables">
            <Button size="sm" variant="outline">
              ← Back to tables
            </Button>
          </Link>
          <PrintButton label="Print these codes" />
        </div>

        {loopback ? (
          <div className="no-print mb-4">
            <Banner tone="amber">
              These QR codes point at <strong>{origin}</strong>, which only works
              on this computer — a phone cannot open it. To print codes that
              guests can actually scan, open this page using your computer&apos;s
              Wi-Fi address instead, for example{" "}
              <strong>http://192.168.1.5:3000/admin/qr</strong> (run{" "}
              <code>ipconfig</code> to find it, look for{" "}
              <em>IPv4 Address</em>). In production, set{" "}
              <code>NEXT_PUBLIC_APP_URL</code> to your real domain.
            </Banner>
          </div>
        ) : null}

        <div className="no-print">
          <SectionTitle
            title="Print and stick one on each table"
            subtitle={`Guests scan with their phone camera — no app to install. Codes point at ${origin}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 print:grid-cols-2">
          {withQr.map((t) => (
            <Card
              key={t.label}
              className="p-3 text-center break-inside-avoid print:border print:shadow-none"
            >
              <p className="text-sm font-bold text-ink">{t.label}</p>
              <div
                className="mx-auto mt-1.5 w-full max-w-[190px] [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: t.svg }}
              />
              <p className="mt-1.5 text-[10px] leading-snug text-muted">
                Scan to see the menu and order
                <br />
                <span className="break-all">{t.url}</span>
              </p>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted print:mt-4">
          Mittal&apos;s Shudh Shakahari Bhojanalaya · Pure Vegetarian
        </p>
      </main>

      <StaffNav role={staff.role} />
    </div>
  );
}
