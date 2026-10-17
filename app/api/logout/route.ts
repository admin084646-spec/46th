import { NextResponse, type NextRequest } from "next/server";
import { clearStaffCookie } from "@/lib/auth";
import { appBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * Plain, JS-free sign-out. Mirrors `/api/login` so the header's sign-out button
 * is a normal form POST and never depends on the client bundle.
 */
export async function POST(_req: NextRequest) {
  const base = await appBaseUrl();
  await clearStaffCookie();
  return NextResponse.redirect(`${base}/login`, 303);
}
