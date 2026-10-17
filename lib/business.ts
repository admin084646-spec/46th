import "server-only";
import { adminDb } from "./supabase";
import type {
  Bill,
  Category,
  DiningTable,
  Discount,
  KitchenTicket,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  ServiceRequest,
  TableSession,
  BillSplit,
} from "./types";

const LIVE = ["active", "awaiting_clearance"] as const;

/* --------------------------- lookups ----------------------------------- */

export async function getTableByToken(
  token: string
): Promise<DiningTable | null> {
  const { data } = await adminDb()
    .from("dining_tables")
    .select("*")
    .eq("qr_token", token)
    .maybeSingle();
  return (data as DiningTable) ?? null;
}

export async function getTables(): Promise<DiningTable[]> {
  const { data } = await adminDb()
    .from("dining_tables")
    .select("*")
    .order("label");
  return (data as DiningTable[]) ?? [];
}

export async function getMenu(): Promise<{
  categories: Category[];
  items: MenuItem[];
}> {
  const db = adminDb();
  const [{ data: categories }, { data: items }] = await Promise.all([
    db.from("menu_categories").select("*").order("sort"),
    db.from("menu_items").select("*").order("sort"),
  ]);
  return {
    categories: (categories as Category[]) ?? [],
    items: (items as MenuItem[]) ?? [],
  };
}

/* --------------------------- sessions ---------------------------------- */

export async function getLiveSession(
  tableId: string
): Promise<TableSession | null> {
  const { data } = await adminDb()
    .from("table_sessions")
    .select("*")
    .eq("table_id", tableId)
    .in("status", LIVE as unknown as string[])
    .maybeSingle();
  return (data as TableSession) ?? null;
}

/**
 * Race-safe: relies on the DB partial unique index so simultaneous QR scans
 * can never create two live sessions for one table.
 */
export async function getOrCreateActiveSession(
  tableId: string
): Promise<TableSession> {
  const existing = await getLiveSession(tableId);
  if (existing) return existing;

  const { data, error } = await adminDb()
    .from("table_sessions")
    .insert({ table_id: tableId, status: "active" })
    .select("*")
    .single();

  if (error || !data) {
    // lost the race — read the winner
    const again = await getLiveSession(tableId);
    if (again) return again;
    throw error ?? new Error("Could not open table session");
  }
  return data as TableSession;
}

export async function nextRoundNo(sessionId: string): Promise<number> {
  const { data } = await adminDb()
    .from("orders")
    .select("round_no")
    .eq("session_id", sessionId)
    .order("round_no", { ascending: false })
    .limit(1);
  const max = (data as Array<{ round_no: number }> | null)?.[0]?.round_no ?? 0;
  return max + 1;
}

/* --------------------------- billing ----------------------------------- */

export async function ensureBill(sessionId: string): Promise<Bill> {
  const db = adminDb();
  const { data } = await db
    .from("bills")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (data) return data as Bill;

  const { data: created, error } = await db
    .from("bills")
    .insert({ session_id: sessionId })
    .select("*")
    .single();
  if (error || !created) {
    const { data: again } = await db
      .from("bills")
      .select("*")
      .eq("session_id", sessionId)
      .single();
    if (again) return again as Bill;
    throw error ?? new Error("Could not create bill");
  }
  return created as Bill;
}

/** Recompute subtotal/discount/total/paid from source records. Never trusts UI. */
export async function recomputeBill(sessionId: string): Promise<Bill> {
  const db = adminDb();
  const bill = await ensureBill(sessionId);

  const { data: orders } = await db
    .from("orders")
    .select("id")
    .eq("session_id", sessionId)
    .eq("status", "approved");
  const orderIds = ((orders as Array<{ id: string }>) ?? []).map((o) => o.id);

  let subtotal = 0;
  if (orderIds.length) {
    const { data: items } = await db
      .from("order_items")
      .select("unit_price_minor,qty")
      .in("order_id", orderIds);
    subtotal = ((items as Array<{ unit_price_minor: number; qty: number }>) ?? [])
      .reduce((s, i) => s + i.unit_price_minor * i.qty, 0);
  }

  const { data: discounts } = await db
    .from("discounts")
    .select("amount_minor")
    .eq("bill_id", bill.id);
  const discount = ((discounts as Array<{ amount_minor: number }>) ?? []).reduce(
    (s, d) => s + d.amount_minor,
    0
  );

  const total = Math.max(0, subtotal - discount);

  const { data: payments } = await db
    .from("payments")
    .select("amount_minor")
    .eq("bill_id", bill.id)
    .eq("status", "verified");
  const paid = ((payments as Array<{ amount_minor: number }>) ?? []).reduce(
    (s, p) => s + p.amount_minor,
    0
  );

  const status: Bill["status"] =
    total <= 0 ? (paid > 0 ? "paid" : "unpaid") : paid <= 0
      ? "unpaid"
      : paid < total
        ? "partial"
        : "paid";

  const { data: updated } = await db
    .from("bills")
    .update({
      subtotal_minor: subtotal,
      discount_minor: discount,
      total_minor: total,
      paid_minor: paid,
      status,
      paid_at: status === "paid" ? bill.paid_at ?? new Date().toISOString() : null,
    })
    .eq("id", bill.id)
    .select("*")
    .single();

  return (updated as Bill) ?? bill;
}

/* --------------------------- composite read ---------------------------- */

export interface SessionWorkspace {
  session: TableSession | null;
  table: DiningTable | null;
  bill: Bill | null;
  orders: Order[];
  items: OrderItem[];
  tickets: KitchenTicket[];
  requests: ServiceRequest[];
  payments: Payment[];
  discounts: Discount[];
  splits: BillSplit[];
}

export async function getSessionWorkspace(
  sessionId: string
): Promise<SessionWorkspace> {
  const db = adminDb();
  const { data: session } = await db
    .from("table_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  const s = (session as TableSession) ?? null;

  const [table, bill, orders, tickets, requests, splits] = await Promise.all([
    s
      ? db.from("dining_tables").select("*").eq("id", s.table_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("bills").select("*").eq("session_id", sessionId).maybeSingle(),
    db
      .from("orders")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at"),
    db.from("kitchen_tickets").select("*"),
    db
      .from("service_requests")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
    db.from("bill_splits").select("*"),
  ]);

  const orderIds = ((orders.data as Order[]) ?? []).map((o) => o.id);
  const billId = (bill.data as Bill | null)?.id ?? null;

  const [items, payments, discounts] = await Promise.all([
    orderIds.length
      ? db.from("order_items").select("*").in("order_id", orderIds).order("item_name")
      : Promise.resolve({ data: [] }),
    billId
      ? db.from("payments").select("*").eq("bill_id", billId).order("created_at")
      : Promise.resolve({ data: [] }),
    billId
      ? db.from("discounts").select("*").eq("bill_id", billId).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  const allTickets = ((tickets.data as KitchenTicket[]) ?? []).filter((t) =>
    orderIds.includes(t.order_id)
  );
  const allSplits = ((splits.data as BillSplit[]) ?? []).filter(
    (sp) => sp.bill_id === billId
  );

  return {
    session: s,
    table: (table.data as DiningTable) ?? null,
    bill: (bill.data as Bill) ?? null,
    orders: (orders.data as Order[]) ?? [],
    items: (items.data as OrderItem[]) ?? [],
    tickets: allTickets,
    requests: (requests.data as ServiceRequest[]) ?? [],
    splits: allSplits,
    payments: (payments.data as Payment[]) ?? [],
    discounts: (discounts.data as Discount[]) ?? [],
  };
}

/* --------------------------- table board ------------------------------- */

export interface TableBoardRow {
  table: DiningTable;
  session: TableSession | null;
  bill: Bill | null;
  pendingCount: number;
  activeTicketCount: number;
  requestCount: number;
  approvedTotal: number;
}

export async function getTableBoard(): Promise<TableBoardRow[]> {
  const db = adminDb();
  const tables = await getTables();
  const { data: sessions } = await db
    .from("table_sessions")
    .select("*")
    .in("status", LIVE as unknown as string[]);

  const sessionList = (sessions as TableSession[]) ?? [];
  const sessionIds = sessionList.map((s) => s.id);

  const [bills, orders, tickets, requests] = await Promise.all([
    sessionIds.length
      ? db.from("bills").select("*").in("session_id", sessionIds)
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? db
          .from("orders")
          .select("id,session_id,status")
          .in("session_id", sessionIds)
      : Promise.resolve({ data: [] }),
    db
      .from("kitchen_tickets")
      .select("id,order_id,status")
      .in("status", ["approved", "preparing", "ready", "picked_up"]),
    sessionIds.length
      ? db
          .from("service_requests")
          .select("id,session_id,status")
          .in("session_id", sessionIds)
          .neq("status", "done")
      : Promise.resolve({ data: [] }),
  ]);

  return tables.map((table) => {
    const session = sessionList.find((s) => s.table_id === table.id) ?? null;
    const bill = ((bills.data as Bill[]) ?? []).find(
      (b) => b.session_id === session?.id
    ) ?? null;
    const myOrders = ((orders.data as Array<{ id: string; session_id: string; status: string }>) ?? [])
      .filter((o) => o.session_id === session?.id);
    const myOrderIds = myOrders.map((o) => o.id);
    const pendingCount = myOrders.filter((o) => o.status === "pending").length;
    const activeTicketCount = ((tickets.data as Array<{ order_id: string; status: string }>) ?? [])
      .filter((t) => myOrderIds.includes(t.order_id)).length;
    const requestCount = ((requests.data as Array<{ session_id: string; status: string }>) ?? [])
      .filter((r) => r.session_id === session?.id).length;

    return {
      table,
      session,
      bill,
      pendingCount,
      activeTicketCount,
      requestCount,
      approvedTotal: bill?.total_minor ?? 0,
    };
  });
}
