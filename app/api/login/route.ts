import { NextResponse, type NextRequest } from "next/server";
import { loginWithPin, setStaffCookie } from "@/lib/auth";
import { roleHome } from "@/lib/perms";
import { appBaseUrl } from "@/lib/app-url";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Plain, JS-free staff sign-in.
 *
 * The login screen is a normal HTML `<form>` that POSTs here. This keeps sign-in
 * working even when a phone's browser never executes our client bundle, which is
 * the failure mode that made the PIN screen look "dead" on the LAN. Success sets
 * the cookie and 303-redirects (POST -> GET); failure redirects back with a flag
 * so the page can show the message itself.
 *
 * Redirects are built from `appBaseUrl()` (the caller's own Host header) rather
 * than `req.url`, because `req.url` follows whatever interface the server bound
 * to — e.g. `http://0.0.0.0:3000`, which no phone can reach.
 */
export async function POST(req: NextRequest) {
  const base = await appBaseUrl();
  const form = await req.formData();
  const staff = await loginWithPin(String(form.get("pin") ?? ""));

  if (!staff) {
    await new Promise((r) => setTimeout(r, 350)); // soften brute force
    return NextResponse.redirect(`${base}/login?error=1`, 303);
  }

  await setStaffCookie(staff);
  await writeAudit({
    actorStaffId: staff.id,
    actorName: staff.name,
    action: "staff.login",
    entity: "staff",
    entityId: staff.id,
  });

  return NextResponse.redirect(`${base}${roleHome(staff.role)}`, 303);
}
