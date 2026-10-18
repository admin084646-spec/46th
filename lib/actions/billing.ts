"use server";

import { guard } from "@/lib/guard";
import { can } from "@/lib/perms";
import { adminDb } from "@/lib/supabase";
import { ensureBill, recomputeBill } from "@/lib/business";
import { writeAudit } from "@/lib/audit";
import { signal } from "@/lib/signal";
import { roleTopic, sessionTopic } from "@/lib/topics";
import { ok, err, type ActionResult } from "@/lib/action-result";
import type { OrderItem, PaymentMethod, TableSession } from "@/lib/types";

async function billSession(billId: string): Promise<string | null> {
  const { data } = await adminDb()
    .from("bills")
    .select("session_id")
    .eq("id", billId)
    .maybeSingle();
  return (data as { session_id: string } | null)?.session_id ?? null;
}

async function afterBillingChange(sessionId: string, reason: string) {
  await recomputeBill(sessionId);
  await signal(
    [
      roleTopic("admin"),
      roleTopic("owner"),
      roleTopic("waiter"),
      sessionTopic(sessionId),
    ],
    "refresh",
    { reason }
  );
}

/* ---------------------------- discount ---------------------------- */

export async function applyDiscountAction(
  billId: string,
  amountMinor: number,
  reason: string
): Promise<ActionResult> {
  const g = await guard(can.applyDiscount);
  if (!g.ok) return g;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0)
    return err("Enter a valid discount amount.");
  if (!reason?.trim()) return err("A reason is required for a discount.");

  const sessionId = await billSession(billId);
  if (!sessionId) return err("Bill not found.");

  const db = adminDb();
  const { data: bill } = await db
    .from("bills")
    .select("subtotal_minor")
    .eq("id", billId)
    .maybeSingle();
  const subtotal = (bill as { subtotal_minor: number } | null)?.subtotal_minor ?? 0;
  if (amountMinor > subtotal) return err("Discount cannot exceed the bill subtotal.");

  await db.from("discounts").insert({
    bill_id: billId,
    amount_minor: Math.round(amountMinor),
    reason: reason.trim().slice(0, 200),
    staff_id: g.staff.id,
  });

  await afterBillingChange(sessionId, "discount");
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "bill.discount",
    entity: "bill",
    entityId: billId,
    reason,
    after: { amount_minor: amountMinor },
  });
  return ok();
}

/* ---------------------------- payments ---------------------------- */

export async function addPaymentAction(
  billId: string,
  amountMinor: number,
  method: PaymentMethod,
  ref?: string
): Promise<ActionResult> {
  const g = await guard(can.recordPayment);
  if (!g.ok) return g;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0)
    return err("Enter a valid amount.");
  if (!["cash", "upi", "card"].includes(method))
    return err("Choose a payment method.");

  const sessionId = await billSession(billId);
  if (!sessionId) return err("Bill not found.");

  // Cash is verified on the spot. UPI/card must be verified separately —
  // an initiation or screenshot is NOT proof of collection.
  const isCash = method === "cash";
  const now = new Date().toISOString();

  const db = adminDb();
  const { error } = await db.from("payments").insert({
    bill_id: billId,
    amount_minor: Math.round(amountMinor),
    method,
    status: isCash ? "verified" : "pending",
    verified: isCash,
    ref: ref?.trim().slice(0, 120) || null,
    recorded_by: g.staff.id,
    verified_by: isCash ? g.staff.id : null,
    verified_at: isCash ? now : null,
  });
  if (error) return err("Could not record payment.");

  await afterBillingChange(sessionId, "payment_recorded");
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "payment.recorded",
    entity: "bill",
    entityId: billId,
    after: { amount_minor: amountMinor, method, verified: isCash },
  });
  return ok();
}

export async function verifyPaymentAction(
  paymentId: string
): Promise<ActionResult> {
  const g = await guard(can.verifyPayment);
  if (!g.ok) return g;
  const db = adminDb();
  const { data: row } = await db
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!row) return err("Payment not found.");
  const payment = row as { bill_id: string; status: string };

  await db
    .from("payments")
    .update({
      verified: true,
      status: "verified",
      verified_by: g.staff.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  const sessionId = await billSession(payment.bill_id);
  if (sessionId) await afterBillingChange(sessionId, "payment_verified");
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "payment.verified",
    entity: "payment",
    entityId: paymentId,
    before: { status: payment.status },
    after: { status: "verified" },
  });
  return ok();
}

export async function voidPaymentAction(
  paymentId: string,
  reason: string
): Promise<ActionResult> {
  const g = await guard(can.verifyPayment);
  if (!g.ok) return g;
  if (!reason?.trim()) return err("A reason is required.");
  const db = adminDb();
  const { data: row } = await db
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!row) return err("Payment not found.");
  const payment = row as { bill_id: string; status: string };

  await db
    .from("payments")
    .update({ status: "void", verified: false })
    .eq("id", paymentId);

  const sessionId = await billSession(payment.bill_id);
  if (sessionId) await afterBillingChange(sessionId, "payment_void");
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "payment.voided",
    entity: "payment",
    entityId: paymentId,
    reason,
    before: { status: payment.status },
    after: { status: "void" },
  });
  return ok();
}

/* ---------------------------- splits ---------------------------- */

export async function splitByPeopleAction(
  billId: string,
  people: number
): Promise<ActionResult<{ per: number }>> {
  const g = await guard(can.splitBill);
  if (!g.ok) return g;
  const n = Math.floor(people);
  if (!Number.isFinite(n) || n < 2) return err("Choose at least 2 people.");

  const sessionId = await billSession(billId);
  if (!sessionId) return err("Bill not found.");
  const bill = await recomputeBill(sessionId);
  if (bill.total_minor <= 0) return err("There is nothing to split yet.");

  const total = bill.total_minor;
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  const db = adminDb();
  await db.from("bill_splits").delete().eq("bill_id", billId);
  const rows = Array.from({ length: n }, (_, i) => ({
    bill_id: billId,
    kind: "person" as const,
    label: `Person ${i + 1}`,
    amount_minor: i === 0 ? base + remainder : base,
  }));
  await db.from("bill_splits").insert(rows);

  const sum = rows.reduce((s, r) => s + r.amount_minor, 0);
  if (sum !== total) return err("Split did not reconcile; please retry.");

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "bill.split",
    entity: "bill",
    entityId: billId,
    after: { kind: "person", people: n, total },
  });
  await signal([roleTopic("admin"), sessionTopic(sessionId)], "refresh", {
    reason: "bill_split",
  });
  return ok({ per: base });
}

export interface ItemSplitGroup {
  label: string;
  order_item_ids: string[];
}

export async function splitByItemsAction(
  billId: string,
  groups: ItemSplitGroup[]
): Promise<ActionResult> {
  const g = await guard(can.splitBill);
  if (!g.ok) return g;
  if (!groups?.length) return err("Add at least one split group.");

  const sessionId = await billSession(billId);
  if (!sessionId) return err("Bill not found.");
  const bill = await recomputeBill(sessionId);

  const db = adminDb();
  const { data: orderRows } = await db
    .from("orders")
    .select("id")
    .eq("session_id", sessionId)
    .eq("status", "approved");
  const orderIds = ((orderRows as Array<{ id: string }>) ?? []).map((o) => o.id);
  let items: OrderItem[] = [];
  if (orderIds.length) {
    const { data: itemRows } = await db
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);
    items = (itemRows as OrderItem[]) ?? [];
  }
  if (!items.length) return err("There is nothing to split yet.");

  // every item must be assigned exactly once
  const assigned = new Map<string, number>();
  for (const grp of groups) {
    for (const id of grp.order_item_ids ?? []) {
      assigned.set(id, (assigned.get(id) ?? 0) + 1);
    }
  }
  for (const it of items) {
    const c = assigned.get(it.id) ?? 0;
    if (c !== 1)
      return err("Every item must be assigned to exactly one person.");
  }
  for (const id of assigned.keys()) {
    if (!items.some((it) => it.id === id))
      return err("A selected item no longer exists.");
  }

  const subtotal = items.reduce((s, it) => s + it.unit_price_minor * it.qty, 0);
  const total = bill.total_minor;
  const discountFactor = subtotal > 0 ? total / subtotal : 1;

  const raw = groups.map((grp) => {
    const amount = grp.order_item_ids.reduce((s, id) => {
      const it = items.find((x) => x.id === id)!;
      return s + it.unit_price_minor * it.qty;
    }, 0);
    return { label: grp.label, raw: amount, ids: grp.order_item_ids };
  });

  const scaled = raw.map((r) => Math.floor(r.raw * discountFactor));
  const diff = total - scaled.reduce((s, v) => s + v, 0);
  scaled[scaled.length - 1] += diff;
  if (scaled.some((v) => v < 0)) return err("Could not reconcile the split.");

  await db.from("bill_splits").delete().eq("bill_id", billId);
  for (let i = 0; i < raw.length; i++) {
    const { data: splitRow } = await db
      .from("bill_splits")
      .insert({
        bill_id: billId,
        kind: "item",
        label: raw[i].label || `Person ${i + 1}`,
        amount_minor: scaled[i],
      })
      .select("*")
      .single();
    if (splitRow) {
      await db.from("bill_split_items").insert(
        raw[i].ids.map((id) => {
          const it = items.find((x) => x.id === id)!;
          return {
            split_id: (splitRow as { id: string }).id,
            order_item_id: id,
            qty: it.qty,
            amount_minor: Math.floor(it.unit_price_minor * it.qty * discountFactor),
          };
        })
      );
    }
  }

  const sum = scaled.reduce((s, v) => s + v, 0);
  if (sum !== total) return err("Split did not reconcile; please retry.");

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "bill.split",
    entity: "bill",
    entityId: billId,
    after: { kind: "item", groups: raw.length, total },
  });
  await signal([roleTopic("admin"), sessionTopic(sessionId)], "refresh", {
    reason: "bill_split",
  });
  return ok();
}

export async function clearSplitsAction(billId: string): Promise<ActionResult> {
  const g = await guard(can.splitBill);
  if (!g.ok) return g;
  const sessionId = await billSession(billId);
  await adminDb().from("bill_splits").delete().eq("bill_id", billId);
  if (sessionId)
    await signal([roleTopic("admin"), sessionTopic(sessionId)], "refresh", {
      reason: "bill_split_cleared",
    });
  return ok();
}

/* ---------------------------- table clearance ---------------------------- */

export async function clearTableAction(
  sessionId: string,
  force: boolean,
  reason?: string
): Promise<ActionResult> {
  const g = await guard(can.clearTable);
  if (!g.ok) return g;

  const db = adminDb();
  const { data: sessionRow } = await db
    .from("table_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sessionRow) return err("Session not found.");
  const session = sessionRow as TableSession;
  if (session.status === "closed") return err("This table is already cleared.");

  const bill = await ensureBill(sessionId);
  if (bill.status !== "paid" && !force) {
    return err("This bill is not fully paid. Use an override to clear anyway.");
  }
  if (force && !reason?.trim()) {
    return err("A reason is required to force-clear an unpaid table.");
  }

  // Reject any leftover pending orders so nothing dangles.
  await db
    .from("orders")
    .update({
      status: "rejected",
      reject_reason: "Table cleared",
    })
    .eq("session_id", sessionId)
    .eq("status", "pending");

  await db
    .from("table_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      cleared_by: g.staff.id,
    })
    .eq("id", sessionId);

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "table.cleared",
    entity: "table_session",
    entityId: sessionId,
    reason: force ? `FORCE: ${reason}` : reason ?? null,
    before: { status: session.status, paid: bill.status === "paid" },
    after: { status: "closed" },
  });
  await signal(
    [roleTopic("admin"), roleTopic("waiter"), roleTopic("owner"), sessionTopic(sessionId)],
    "refresh",
    { reason: "table_cleared" }
  );
  return ok();
}

export async function markAwaitingClearanceAction(
  sessionId: string
): Promise<ActionResult> {
  const g = await guard(can.clearTable);
  if (!g.ok) return g;
  const db = adminDb();
  const bill = await ensureBill(sessionId);
  if (bill.status !== "paid") return err("The bill must be fully paid first.");
  await db
    .from("table_sessions")
    .update({ status: "awaiting_clearance" })
    .eq("id", sessionId)
    .eq("status", "active");
  await signal([roleTopic("admin"), roleTopic("waiter")], "refresh", {
    reason: "awaiting_clearance",
  });
  return ok();
}
