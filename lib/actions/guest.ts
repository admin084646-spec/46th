"use server";

import { getGuestSession } from "@/lib/auth";
import { adminDb } from "@/lib/supabase";
import { nextRoundNo } from "@/lib/business";
import { writeAudit } from "@/lib/audit";
import { signal } from "@/lib/signal";
import { sessionTopic } from "@/lib/topics";
import { ok, err, ERR_SESSION_ENDED, type ActionResult } from "@/lib/action-result";
import type { MenuItem, TableSession } from "@/lib/types";

export interface CartLine {
  menu_item_id: string;
  qty: number;
  note?: string;
}

export async function submitOrderAction(input: {
  items: CartLine[];
  note?: string;
  idempotencyKey: string;
}): Promise<ActionResult<{ orderNo: number }>> {
  const guest = await getGuestSession();
  if (!guest) return err("Your session ended. Please scan the QR code again.");

  const db = adminDb();
  const { data: sessionRow } = await db
    .from("table_sessions")
    .select("*")
    .eq("id", guest.sessionId)
    .maybeSingle();
  const session = sessionRow as TableSession | null;
  if (!session || session.status !== "active") {
    // The cookie references a session that was cleared (or removed) at the
    // counter. Give the client a machine-readable code so it can offer a
    // one-tap rejoin instead of a dead end.
    return err(
      "Your table session has ended (the counter may have cleared the table).",
      ERR_SESSION_ENDED
    );
  }

  const clean = (input.items ?? []).filter((l) => l.qty > 0 && l.menu_item_id);
  if (!clean.length) return err("Your cart is empty.");

  // Idempotency: never create the same order twice.
  const { data: dup } = await db
    .from("orders")
    .select("order_no")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (dup) return ok({ orderNo: (dup as { order_no: number }).order_no });

  // Authoritative prices + availability (client prices are never trusted).
  const ids = clean.map((l) => l.menu_item_id);
  const { data: menuRows } = await db.from("menu_items").select("*").in("id", ids);
  const menu = (menuRows as MenuItem[]) ?? [];
  for (const line of clean) {
    const mi = menu.find((m) => m.id === line.menu_item_id);
    if (!mi) return err("Some items are no longer available. Please refresh.");
    if (!mi.is_available) return err(`${mi.name} is sold out right now.`);
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
      status: "pending",
      source: "customer",
      customer_label: guest.label,
      special_note: input.note?.trim().slice(0, 300) || null,
      total_minor: total,
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single();

  if (error || !order) {
    const { data: again } = await db
      .from("orders")
      .select("order_no")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (again) return ok({ orderNo: (again as { order_no: number }).order_no });
    return err("Could not place your order. Please try again.");
  }

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

  await writeAudit({
    actorName: guest.label,
    action: "order.submitted",
    entity: "order",
    entityId: order.id,
    after: { round, total, items: clean.length },
  });
  await signal(["role:admin", sessionTopic(session.id)], "refresh", {
    reason: "order_submitted",
  });

  return ok({ orderNo: order.order_no });
}

export async function requestServiceAction(input: {
  type: "waiter" | "bill" | "water" | "custom";
  note?: string;
}): Promise<ActionResult> {
  const guest = await getGuestSession();
  if (!guest) return err("Your session ended. Please scan the QR code again.");
  const db = adminDb();

  const { data: sessionRow } = await db
    .from("table_sessions")
    .select("id, status")
    .eq("id", guest.sessionId)
    .maybeSingle();
  if (!sessionRow || sessionRow.status !== "active") {
    return err(
      "Your table session has ended — rejoin to send requests.",
      ERR_SESSION_ENDED
    );
  }

  const { error } = await db.from("service_requests").insert({
    session_id: guest.sessionId,
    table_label: guest.tableLabel,
    type: input.type,
    note: input.note?.trim().slice(0, 200) || null,
    status: "pending",
  });
  if (error) return err("Could not send your request. Please try again.");

  await signal(["role:waiter", sessionTopic(guest.sessionId)], "refresh", {
    reason: "service_request",
  });
  return ok();
}
