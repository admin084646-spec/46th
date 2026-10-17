import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { adminDb } from "./supabase";
import { env } from "./env";
import type { Role, Staff } from "./types";

const STAFF_COOKIE = "mos_staff";
const GUEST_COOKIE = "mos_guest";
const DAY = 60 * 60 * 24;

function key() {
  return new TextEncoder().encode(env.sessionSecret);
}

/**
 * `secure: true` cookies are silently DROPPED by browsers over plain HTTP — which
 * is exactly how this app is used on the restaurant Wi-Fi
 * (`http://192.168.x.x:3000`). Marking cookies Secure there makes sign-in loop
 * forever. So only mark them Secure when the request really is HTTPS (direct, or
 * behind a proxy that sets `x-forwarded-proto`).
 */
async function secureCookies(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  const origin = h.get("origin") ?? h.get("referer") ?? "";
  if (origin) return origin.startsWith("https://");
  return false;
}

export interface StaffSession {
  id: string;
  name: string;
  role: Role;
  perms: Record<string, unknown>;
}

export interface GuestSession {
  sessionId: string;
  tableId: string;
  tableLabel: string;
  label: string;
}

/* ------------------------------- staff ---------------------------------- */

export async function loginWithPin(pin: string): Promise<StaffSession | null> {
  const clean = (pin || "").replace(/\D/g, "");
  if (clean.length !== 6) return null;
  const { data, error } = await adminDb()
    .from("staff")
    .select("id,name,role,perms,active,pin_hash")
    .eq("active", true);
  if (error || !data) return null;
  for (const row of data as Array<Staff & { pin_hash: string }>) {
    if (await compare(clean, row.pin_hash)) {
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        perms: (row.perms as Record<string, unknown>) ?? {},
      };
    }
  }
  return null;
}

export async function setStaffCookie(session: StaffSession) {
  const token = await new SignJWT({ ...session, kind: "staff" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key());
  const store = await cookies();
  // Deliberately a *session* cookie (no maxAge): the browser discards it when
  // it closes, so a shared counter device asks for the PIN again next time
  // instead of staying unlocked for 30 days.
  store.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookies(),
    path: "/",
  });
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.kind !== "staff") return null;
    return {
      id: String(payload.id),
      name: String(payload.name),
      role: payload.role as Role,
      perms: (payload.perms as Record<string, unknown>) ?? {},
    };
  } catch {
    return null;
  }
}

export async function clearStaffCookie() {
  (await cookies()).delete(STAFF_COOKIE);
}

/* ------------------------------- guest ---------------------------------- */

export async function setGuestCookie(g: GuestSession) {
  const token = await new SignJWT({ ...g, kind: "guest" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(key());
  const store = await cookies();
  store.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookies(),
    path: "/",
    maxAge: DAY,
  });
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.kind !== "guest") return null;
    return {
      sessionId: String(payload.sessionId),
      tableId: String(payload.tableId),
      tableLabel: String(payload.tableLabel),
      label: String(payload.label),
    };
  } catch {
    return null;
  }
}

export async function clearGuestCookie() {
  (await cookies()).delete(GUEST_COOKIE);
}
