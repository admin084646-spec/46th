"use server";

import { guard } from "@/lib/guard";
import { can } from "@/lib/perms";
import { adminDb } from "@/lib/supabase";
import { nextRoundNo, recomputeBill } from "@/lib/business";
import { writeAudit, pushNotification } from "@/lib/audit";
import { signal } from "@/lib/signal";
import { roleTopic, sessionTopic } from "@/lib/topics";
import { ok, err, type ActionResult } from "@/lib/action-result";
import type {
  KitchenTicket,
  MenuItem,
  Order,
  TableSession,
} from "@/lib/types";

const KITCHEN_STATES = ["approved", "preparing", "ready"];
const WAITER_STATES = ["picked_up", "served"];

/* ---------------------- kitchen / waiter ticket status ---------------------- */

export async function setTicketStatusAction(
  ticketId: string,
  status: KitchenTicket["status"]
): Promise<ActionResult> {
  const isKitchenTarget = KITCHEN_STATES.includes(status);
  const g = await guard(isKitchenTarget ? can.updateKitchen : can.serveOrders);
  if (!g.ok) return g;
  if (![...KITCHEN_STATES, ...WAITER_STATES].includes(status))
    return err("Unknown status.");

  const db = adminDb();
  const { data: ticketRow } = await db
    .from("kitchen_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticketRow) return err("Ticket not found.");
  const ticket = ticketRow as KitchenTicket;

  const patch: Record<string, unknown> = { status };
  if (status === "ready") patch.ready_at = new Date().toISOString();
  if (status === "picked_up") patch.picked_up_by = g.staff.id;
  if (status === "served") {
    patch.served_by = g.staff.id;
    patch.served_at = new Date().toISOString();
  }
  await db.from("kitchen_tickets").update(patch).eq("id", ticketId);

  const { data: orderRow } = await db
    .from("orders")
    .select("session_id")
    .eq("id", ticket.order_id)
    .maybeSingle();
  const sessionId = (orderRow as { session_id: string } | null)?.session_id;

  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: `ticket.${status}`,
    entity: "kitchen_ticket",
    entityId: ticketId,
    after: { status },
  });

  if (status === "ready") {
    await pushNotification({
      role: "waiter",
      type: "ticket_ready",
      title: `${ticket.table_label} · order #${ticket.ticket_no} ready for pickup`,
      payload: { ticketId, tableLabel: ticket.table_label },
    });
  }

  await signal(
    [
      roleTopic("kitchen"),
      roleTopic("waiter"),
      roleTopic("admin"),
      sessionId ? sessionTopic(sessionId) : "",
    ].filter(Boolean),
    "refresh",
    { reason: "ticket_status" }
  );
  return ok();
}

export async function togglePrintedAction(
  ticketId: string,
  printed: boolean
): Promise<ActionResult> {
  const g = await guard(can.updateKitchen);
  if (!g.ok) return g;
  await adminDb()
    .from("kitchen_tickets")
    .update({ printed })
    .eq("id", ticketId);
  return ok();
}

/* ---------------------- waiter: extra items ---------------------- */

export async function addExtraItemsAction(
  sessionId: string,
  lines: Array<{ menu_item_id: string; qty: number; note?: string }>,
  note?: string
): Promise<ActionResult> {
  const g = await guard(can.addExtraItems);
  if (!g.ok) return g;

  const db = adminDb();
  const { data: sessionRow } = await db
    .from("table_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  const session = sessionRow as TableSession | null;
  if (!session || session.status === "closed")
    return err("This table session is closed.");
  if (session.status !== "active")
    return err("This table is awaiting clearance; ask an admin before adding items.");

  const clean = (lines ?? []).filter((l) => l.qty > 0 && l.menu_item_id);
  if (!clean.length) return err("Add at least one item.");

  const ids = clean.map((l) => l.menu_item_id);
  const { data: menuRows } = await db.from("menu_items").select("*").in("id", ids);
  const menu = (menuRows as MenuItem[]) ?? [];
  for (const line of clean) {
    const mi = menu.find((m) => m.id === line.menu_item_id);
    if (!mi) return err("Some items are unavailable. Please refresh.");
  }

  const round = await nextRoundNo(session.id);
  const total = clean.reduce((sum, l) => {
    const mi = menu.find((m) => m.id === l.menu_item_id)!;
    return sum + mi.price_minor * l.qty;
  }, 0);

  const { data: order, error } = await db
    .from("orders")
    .insert({
      session_id: session.id,
      round_no: round,
      status: "approved", // staff-authorised: skips customer approval
      source: "waiter",
      created_by_staff: g.staff.id,
      special_note: note?.trim().slice(0, 300) || null,
      total_minor: total,
      reviewed_at: new Date().toISOString(),
      reviewed_by: g.staff.id,
    })
    .select("*")
    .single();
  if (error || !order) return err("Could not add items. Please try again.");

  await db.from("order_items").insert(
    clean.map((l) => {
      const mi = menu.find((m) => m.id === l.menu_item_id)!;
      return {
        order_id: order.id,
        menu_item_id: mi.id,
        item_name: mi.name,
        unit_price_minor: mi.price_minor,
        qty: l.qty,
        note: l.note?.trim().slice(0, 200) || null,
      };
    })
  );

  const { data: tableRow } = await db
    .from("dining_tables")
    .select("label")
    .eq("id", session.table_id)
    .maybeSingle();
  const tableLabel = (tableRow as { label: string } | null)?.label ?? "Table";

  await db.from("kitchen_tickets").insert({
    order_id: order.id,
    table_label: tableLabel,
    status: "approved",
  });

  await recomputeBill(session.id);
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "order.staff_added",
    entity: "order",
    entityId: order.id,
    after: { items: clean.length, total },
  });
  await pushNotification({
    role: "kitchen",
    type: "ticket_new",
    title: `${tableLabel} · waiter added items (order #${(order as Order).order_no})`,
    payload: { orderId: order.id },
  });
  await signal(
    [roleTopic("kitchen"), roleTopic("waiter"), roleTopic("admin"), sessionTopic(session.id)],
    "refresh",
    { reason: "staff_items" }
  );
  return ok();
}

/* ---------------------- service requests ---------------------- */

export async function ackRequestAction(id: string): Promise<ActionResult> {
  const g = await guard(can.handleRequests);
  if (!g.ok) return g;
  const db = adminDb();
  const { data: row } = await db
    .from("service_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return err("Request not found.");
  await db
    .from("service_requests")
    .update({
      status: "ack",
      acked_at: new Date().toISOString(),
      acked_by: g.staff.id,
    })
    .eq("id", id);
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "request.acknowledged",
    entity: "service_request",
    entityId: id,
  });
  await signal(
    [roleTopic("waiter"), roleTopic("admin"), sessionTopic((row as { session_id: string }).session_id)],
    "refresh",
    { reason: "request_ack" }
  );
  return ok();
}

export async function completeRequestAction(id: string): Promise<ActionResult> {
  const g = await guard(can.handleRequests);
  if (!g.ok) return g;
  const db = adminDb();
  const { data: row } = await db
    .from("service_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return err("Request not found.");
  await db
    .from("service_requests")
    .update({
      status: "done",
      done_at: new Date().toISOString(),
      done_by: g.staff.id,
    })
    .eq("id", id);
  await writeAudit({
    actorStaffId: g.staff.id,
    actorName: g.staff.name,
    action: "request.completed",
    entity: "service_request",
    entityId: id,
  });
  await signal(
    [roleTopic("waiter"), roleTopic("admin"), sessionTopic((row as { session_id: string }).session_id)],
    "refresh",
    { reason: "request_done" }
  );
  return ok();
}

/* ---------------------- waiter: fetch open tickets ---------------------- */
/* (reads live in lib/queries.ts) */
