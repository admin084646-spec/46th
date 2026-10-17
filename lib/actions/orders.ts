"use server";

import { guard } from "@/lib/guard";
import { can } from "@/lib/perms";
import { adminDb } from "@/lib/supabase";
import { recomputeBill } from "@/lib/business";
import { writeAudit, pushNotification } from "@/lib/audit";
import { signal } from "@/lib/signal";
import { roleTopic, sessionTopic, MENU_TOPIC } from "@/lib/topics";
import { ok, err, type ActionResult } from "@/lib/action-result";
import type {
  DiningTable,
  MenuItem,
  Order,
  OrderItem,
  TableSession,
} from "@/lib/types";

interface OrderContext {
  order: Order;
  items: OrderItem[];
  session: TableSession | null;
  table: DiningTable | null;
}

async function loadOrderContext(orderId: string): Promise<OrderContext | null> {
  const db = adminDb();
  const { data: orderRow } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) return null;
  const order = orderRow as Order;
  const [{ data: items }, { data: sessionRow }] = await Promise.all([
    db.from("order_items").select("*").eq("order_id", orderId).order("item_name"),
    db
      .from("table_sessions")
      .select("*")
      .eq("id", order.session_id)
      .maybeSingle(),
  ]);
  const session = (sessionRow as TableSession) ?? null;
  let table: DiningTable | null = null;
  if (session) {
    const { data: t } = await db
      .from("dining_tables")
      .select("*")
      .eq("id", session.table_id)
      .maybeSingle();
    table = (t as DiningTable) ?? null;
  }
  return { order, items: (items as OrderItem[]) ?? [], session, table };
}

/* ------------------------- approve ------------------------- */

export async function approveOrderAction(
  orderId: string
): Promise<ActionResult> {
  const g = await guard(can.approveOrders);
  if (!g.ok) return g;

  const ctx = await loadOrderContext(orderId);
  if (!ctx) return err("Order not found.");
  if (ctx.order.status !== "pending")
    return err("This order was already handled.");

  const db = adminDb();
  const { data: updated } = await db
    .from("orders")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: g.staff.id,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!updated) return err("This order was already handled.");

  // Only approval creates a kitchen ticket.
  await db.from("kitchen_tickets").insert({
    order_id: orderId,
    table_label: ctx.table?.label ?? "Table",
    status: "approved",
  });

  await recomputeBill(ctx.order.session_id);
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "order.approved",
    entity: "order",
    entityId: orderId,
    after: { status: "approved" },
  });
  await pushNotification({
    role: "kitchen",
    type: "ticket_new",
    title: `${ctx.table?.label ?? "Table"} · new ticket #${ctx.order.order_no}`,
    payload: { orderId, tableLabel: ctx.table?.label },
  });
  await signal(
    [
      roleTopic("kitchen"),
      roleTopic("admin"),
      roleTopic("waiter"),
      sessionTopic(ctx.order.session_id),
    ],
    "refresh",
    { reason: "order_approved" }
  );
  return ok();
}

/* ------------------------- reject ------------------------- */

export async function rejectOrderAction(
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const g = await guard(can.rejectOrders);
  if (!g.ok) return g;
  const ctx = await loadOrderContext(orderId);
  if (!ctx) return err("Order not found.");
  if (ctx.order.status !== "pending")
    return err("Only pending orders can be rejected.");

  const db = adminDb();
  const { data: updated } = await db
    .from("orders")
    .update({
      status: "rejected",
      reject_reason: reason?.trim().slice(0, 200) || "Rejected by staff",
      reviewed_at: new Date().toISOString(),
      reviewed_by: g.staff.id,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!updated) return err("This order was already handled.");

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "order.rejected",
    entity: "order",
    entityId: orderId,
    reason,
    before: { status: "pending" },
    after: { status: "rejected" },
  });
  await signal([roleTopic("admin"), sessionTopic(ctx.order.session_id)], "refresh", {
    reason: "order_rejected",
  });
  return ok();
}

/* ------------------------- cancel (post-approval) ------------------------- */

export async function cancelOrderAction(
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const g = await guard(can.cancelOrders);
  if (!g.ok) return g;
  const ctx = await loadOrderContext(orderId);
  if (!ctx) return err("Order not found.");
  if (ctx.order.status !== "approved")
    return err("Only approved orders can be cancelled.");

  const db = adminDb();
  await db
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: reason?.trim().slice(0, 200) || "Cancelled by staff",
      reviewed_at: new Date().toISOString(),
      reviewed_by: g.staff.id,
    })
    .eq("id", orderId)
    .eq("status", "approved");

  // Keep the kitchen and bill consistent: drop the ticket.
  await db.from("kitchen_tickets").delete().eq("order_id", orderId);
  await recomputeBill(ctx.order.session_id);

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "order.cancelled",
    entity: "order",
    entityId: orderId,
    reason,
    before: { status: "approved" },
    after: { status: "cancelled" },
  });
  await signal(
    [
      roleTopic("kitchen"),
      roleTopic("admin"),
      roleTopic("waiter"),
      sessionTopic(ctx.order.session_id),
    ],
    "refresh",
    { reason: "order_cancelled" }
  );
  return ok();
}

/* ------------------------- correct (audited) ------------------------- */

export interface CorrectionLine {
  menu_item_id: string;
  qty: number;
  unit_price_minor?: number;
  note?: string;
}

export async function correctOrderAction(
  orderId: string,
  lines: CorrectionLine[],
  reason: string
): Promise<ActionResult> {
  const g = await guard(can.correctOrders);
  if (!g.ok) return g;
  if (!reason?.trim()) return err("A reason is required for corrections.");

  const ctx = await loadOrderContext(orderId);
  if (!ctx) return err("Order not found.");
  if (ctx.order.status !== "approved" && ctx.order.status !== "pending")
    return err("This order can no longer be corrected.");

  const clean = (lines ?? []).filter((l) => l.qty > 0 && l.menu_item_id);
  if (!clean.length) return err("An order must keep at least one item.");

  const db = adminDb();
  const ids = clean.map((l) => l.menu_item_id);
  const { data: menuRows } = await db.from("menu_items").select("*").in("id", ids);
  const menu = (menuRows as MenuItem[]) ?? [];

  const before = ctx.items.map((i) => ({
    item_name: i.item_name,
    qty: i.qty,
    unit_price_minor: i.unit_price_minor,
    note: i.note,
  }));

  await db.from("order_items").delete().eq("order_id", orderId);
  await db.from("order_items").insert(
    clean.map((l) => {
      const mi = menu.find((m) => m.id === l.menu_item_id);
      return {
        order_id: orderId,
        menu_item_id: l.menu_item_id,
        item_name: mi?.name ?? "Item",
        unit_price_minor:
          typeof l.unit_price_minor === "number" && l.unit_price_minor >= 0
            ? l.unit_price_minor
            : mi?.price_minor ?? 0,
        qty: l.qty,
        note: l.note?.trim().slice(0, 200) || null,
      };
    })
  );

  const newTotal = clean.reduce((sum, l) => {
    const mi = menu.find((m) => m.id === l.menu_item_id);
    const price =
      typeof l.unit_price_minor === "number" && l.unit_price_minor >= 0
        ? l.unit_price_minor
        : mi?.price_minor ?? 0;
    return sum + price * l.qty;
  }, 0);
  await db.from("orders").update({ total_minor: newTotal }).eq("id", orderId);
  await recomputeBill(ctx.order.session_id);

  const after = clean.map((l) => {
    const mi = menu.find((m) => m.id === l.menu_item_id);
    return {
      item_name: mi?.name ?? "Item",
      qty: l.qty,
      unit_price_minor:
        typeof l.unit_price_minor === "number" && l.unit_price_minor >= 0
          ? l.unit_price_minor
          : mi?.price_minor ?? 0,
      note: l.note ?? null,
    };
  });

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "order.corrected",
    entity: "order",
    entityId: orderId,
    reason,
    before: { items: before },
    after: { items: after },
  });
  await signal(
    [roleTopic("kitchen"), roleTopic("admin"), sessionTopic(ctx.order.session_id)],
    "refresh",
    { reason: "order_corrected" }
  );
  return ok();
}

/* ------------------------- menu availability ------------------------- */

export async function setItemAvailabilityAction(
  menuItemId: string,
  available: boolean
): Promise<ActionResult> {
  const g = await guard(can.manageMenu);
  if (!g.ok) return g;
  const db = adminDb();
  const { data: before } = await db
    .from("menu_items")
    .select("name,is_available")
    .eq("id", menuItemId)
    .maybeSingle();
  if (!before) return err("Menu item not found.");

  await db
    .from("menu_items")
    .update({ is_available: available })
    .eq("id", menuItemId);

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "menu.availability",
    entity: "menu_item",
    entityId: menuItemId,
    before,
    after: { is_available: available },
  });
  await signal([MENU_TOPIC, roleTopic("admin")], "refresh", {
    reason: "menu_availability",
  });
  return ok();
}
