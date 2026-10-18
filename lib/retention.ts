import "server-only";
import { adminDb } from "./supabase";

/**
 * Retention pruning for the free tier (500 MB database).
 *
 * What is deleted:
 *  - notifications older than 7 days   (feature removed — nothing reads them)
 *  - audit_log older than 90 days      (staff performance already only reads
 *                                       the selected range; 90 days of trail
 *                                       is plenty for a restaurant)
 *  - kitchen_tickets older than 60 days(terminal kitchen data; no report
 *                                       reads old tickets)
 *  - order_items of sessions CLOSED more than 45 days ago (the heaviest
 *                                       table by far; "popular items" in
 *                                       reports only works for recent
 *                                       ranges — every rupee figure stays
 *                                       exact, computed from orders/bills
 *                                       which are NEVER deleted)
 *
 * What is NEVER deleted: table_sessions, orders, bills, payments, discounts,
 * bill_splits — the owner's books. long-term money history survives.
 *
 * Runs at most once per 6 hours, piggybacking on staff page renders. Every
 * statement is wrapped so pruning can never break a page.
 */

const DAY = 24 * 60 * 60 * 1000;
const THROTTLE_MS = 6 * 60 * 60 * 1000;

let lastRun = 0;

export async function maybePrune(): Promise<void> {
  const now = Date.now();
  if (now - lastRun < THROTTLE_MS) return;
  lastRun = now;

  try {
    const db = adminDb();
    const iso = (days: number) =>
      new Date(now - days * DAY).toISOString();

    await db
      .from("notifications")
      .delete()
      .lt("created_at", iso(7));
    await db
      .from("audit_log")
      .delete()
      .lt("created_at", iso(90));
    await db
      .from("kitchen_tickets")
      .delete()
      .lt("created_at", iso(60));

    // order_items of long-closed sessions — children only, money rows stay.
    const { data: oldClosed } = await db
      .from("table_sessions")
      .select("id")
      .eq("status", "closed")
      .lt("closed_at", iso(45));
    const sessionIds = ((oldClosed ?? []) as Array<{ id: string }>).map(
      (r) => r.id
    );
    if (sessionIds.length) {
      const { data: oldOrders } = await db
        .from("orders")
        .select("id")
        .in("session_id", sessionIds)
        .lt("created_at", iso(45));
      const orderIds = ((oldOrders ?? []) as Array<{ id: string }>).map(
        (r) => r.id
      );
      if (orderIds.length) {
        await db.from("order_items").delete().in("order_id", orderIds);
      }
    }
  } catch {
    /* pruning must never break a page */
  }
}
