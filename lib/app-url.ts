import "server-only";
import { headers } from "next/headers";

/**
 * The absolute origin the guest's phone should use.
 *
 * Order of preference:
 *  1. NEXT_PUBLIC_APP_URL — set this in production to your real domain.
 *  2. The host the staff member is browsing on right now. This is the right
 *     answer in development too: if the cashier opens the page from the LAN
 *     address, the QR codes encode that LAN address and phones can reach it.
 */
export async function appBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

/** True when the origin is only reachable from this machine. */
export function isLoopbackOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
}
