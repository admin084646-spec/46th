import "server-only";
import { redirect } from "next/navigation";
import { getStaffSession, type StaffSession } from "./auth";
import { can, hasAdmin, roleHome } from "./perms";

export async function currentStaff(): Promise<StaffSession | null> {
  return getStaffSession();
}

/** Redirect helper for server pages. */
export async function pageStaff(): Promise<StaffSession> {
  const staff = await getStaffSession();
  if (!staff) redirect("/login");
  return staff;
}

export async function pageAdmin(): Promise<StaffSession> {
  const staff = await pageStaff();
  if (!hasAdmin(staff)) redirect(roleHome(staff.role));
  return staff;
}

export async function pageKitchen(): Promise<StaffSession> {
  const staff = await pageStaff();
  if (!can.updateKitchen(staff)) redirect(roleHome(staff.role));
  return staff;
}

export async function pageWaiter(): Promise<StaffSession> {
  const staff = await pageStaff();
  if (!can.serveOrders(staff) && !can.handleRequests(staff))
    redirect(roleHome(staff.role));
  return staff;
}

export async function pageOwner(): Promise<StaffSession> {
  const staff = await pageStaff();
  if (!can.viewReports(staff)) redirect(roleHome(staff.role));
  return staff;
}

/**
 * Guard a staff action. Returns the session, or an ActionResult error.
 * Usage: const g = await guard(can.approveOrders); if (!g.ok) return g;
 */
export async function guard(
  check: (s: StaffSession | null) => boolean
): Promise<
  | { ok: true; staff: StaffSession }
  | { ok: false; error: string }
> {
  const staff = await getStaffSession();
  if (!staff) return { ok: false, error: "Please sign in again." } as const;
  if (!check(staff))
    return { ok: false, error: "You don't have permission for this action." } as const;
  return { ok: true, staff };
}
