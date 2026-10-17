import "server-only";
import { adminDb } from "./supabase";
import type {
  AppNotification,
  AuditEntry,
  KitchenTicket,
  Order,
  OrderItem,
  Role,
  ServiceRequest,
} from "./types";

/* --------------------------- pending approvals --------------------------- */

export interface PendingOrderRow {
  order: Order;
  items: OrderItem[];
  tableLabel: string;
}

export async function getPendingOrders(): Promise<PendingOrderRow[]> {
  const db = adminDb();
  const { data: orders } = await db
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const list = (orders as Order[]) ?? [];
  if (!list.length) return [];

  const sessionIds = [...new Set(list.map((o) => o.session_id))];
  const orderIds = list.map((o) => o.id);

  const [{ data: sessions }, { data: items }] = await Promise.all([
    db.from("table_sessions").select("id,table_id").in("id", sessionIds),
    db.from("order_items").select("*").in("order_id", orderIds),
  ]);

  const sessionRows = (sessions as Array<{ id: string; table_id: string }>) ?? [];
  const tableIds = [...new Set(sessionRows.map((s) => s.table_id))];
  const { data: tables } = tableIds.length
    ? await db.from("dining_tables").select("id,label").in("id", tableIds)
    : { data: [] as Array<{ id: string; label: string }> };
  const tableRows = (tables as Array<{ id: string; label: string }>) ?? [];

  return list.map((order) => {
    const session = sessionRows.find((s) => s.id === order.session_id);
    const table = tableRows.find((t) => t.id === session?.table_id);
    return {
      order,
      items: ((items as OrderItem[]) ?? []).filter(
        (i) => i.order_id === order.id
      ),
      tableLabel: table?.label ?? "Table",
    };
  });
}

/* --------------------------- kitchen tickets --------------------------- */

export interface TicketRow {
  ticket: KitchenTicket;
  orderNo: number;
  items: OrderItem[];
}

/* --------------------------- service requests --------------------------- */

export async function getOpenServiceRequests(): Promise<ServiceRequest[]> {
  const { data } = await adminDb()
    .from("service_requests")
    .select("*")
    .neq("status", "done")
    .order("created_at", { ascending: true });
  return (data as ServiceRequest[]) ?? [];
}

/* --------------------------- audit & notifications --------------------------- */

export async function getAuditLog(limit = 200): Promise<AuditEntry[]> {
  const { data } = await adminDb()
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AuditEntry[]) ?? [];
}

export async function getNotifications(
  role: Role,
  limit = 30
): Promise<AppNotification[]> {
  const { data } = await adminDb()
    .from("notifications")
    .select("*")
    .eq("audience_role", role)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AppNotification[]) ?? [];
}

/* --------------------------- audit search --------------------------- */

export async function getKitchenTickets(
  statuses: KitchenTicket["status"][] = ["approved", "preparing", "ready"]
): Promise<TicketRow[]> {
  const db = adminDb();
  const { data: tickets } = await db
    .from("kitchen_tickets")
    .select("*")
    .in("status", statuses)
    .order("created_at", { ascending: true });
  const list = (tickets as KitchenTicket[]) ?? [];
  if (!list.length) return [];
  const orderIds = list.map((t) => t.order_id);
  const [{ data: orders }, { data: items }] = await Promise.all([
    db.from("orders").select("id,order_no").in("id", orderIds),
    db
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("item_name"),
  ]);
  const orderRows = (orders as Array<{ id: string; order_no: number }>) ?? [];
  return list.map((ticket) => ({
    ticket,
    orderNo: orderRows.find((o) => o.id === ticket.order_id)?.order_no ?? 0,
    items: ((items as OrderItem[]) ?? []).filter(
      (i) => i.order_id === ticket.order_id
    ),
  }));
}

export async function getWaiterTickets(): Promise<TicketRow[]> {
  return getKitchenTickets(["ready", "picked_up"]);
}

export async function searchAudit(filters: {
  action?: string;
  entity?: string;
  fromIso?: string;
  toIso?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  let q = adminDb()
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 300);
  if (filters.action) q = q.ilike("action", `%${filters.action}%`);
  if (filters.entity) q = q.eq("entity", filters.entity);
  if (filters.fromIso) q = q.gte("created_at", filters.fromIso);
  if (filters.toIso) q = q.lte("created_at", filters.toIso);
  const { data } = await q;
  return (data as AuditEntry[]) ?? [];
}
