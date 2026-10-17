import "server-only";
import { adminDb } from "./supabase";
import { istBoundsForInput } from "./format";
import type { Bill, Discount, Order, OrderItem, Payment } from "./types";

const IST_MS = 5.5 * 60 * 60 * 1000;

export interface PopularItem {
  name: string;
  qty: number;
  totalMinor: number;
}

export interface RangeSummary {
  orders: number;
  bills: number;
  grossMinor: number;
  discountsMinor: number;
  netMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  byMethod: { cash: number; upi: number; card: number };
  hourly: { hour: number; totalMinor: number }[];
  popular: PopularItem[];
}

export async function getRangeSummary(
  fromInput: string,
  toInput: string
): Promise<RangeSummary> {
  const db = adminDb();
  const from = istBoundsForInput(fromInput).start.toISOString();
  const to = istBoundsForInput(toInput).end.toISOString();

  const [{ data: orders }, { data: payments }, { data: discounts }, { data: bills }] =
    await Promise.all([
      db
        .from("orders")
        .select("*")
        .gte("created_at", from)
        .lt("created_at", to),
      db
        .from("payments")
        .select("*")
        .eq("status", "verified")
        .gte("created_at", from)
        .lt("created_at", to),
      db.from("discounts").select("*").gte("created_at", from).lt("created_at", to),
      db.from("bills").select("*"),
    ]);

  const orderList = (orders as Order[]) ?? [];
  const approved = orderList.filter((o) => o.status === "approved");
  const orderIds = approved.map((o) => o.id);

  let items: OrderItem[] = [];
  if (orderIds.length) {
    const { data: itemRows } = await db
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);
    items = (itemRows as OrderItem[]) ?? [];
  }

  const grossMinor = approved.reduce((s, o) => s + o.total_minor, 0);
  const discountsMinor = ((discounts as Discount[]) ?? []).reduce(
    (s, d) => s + d.amount_minor,
    0
  );

  const byMethod = { cash: 0, upi: 0, card: 0 };
  for (const p of ((payments as Payment[]) ?? [])) {
    if (p.method === "cash") byMethod.cash += p.amount_minor;
    else if (p.method === "upi") byMethod.upi += p.amount_minor;
    else if (p.method === "card") byMethod.card += p.amount_minor;
  }
  const collectedMinor = byMethod.cash + byMethod.upi + byMethod.card;

  const outstandingMinor = ((bills as Bill[]) ?? [])
    .filter((b) => b.status !== "paid")
    .reduce((s, b) => s + Math.max(0, b.total_minor - b.paid_minor), 0);

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, totalMinor: 0 }));
  for (const o of approved) {
    const hr = new Date(new Date(o.created_at).getTime() + IST_MS).getUTCHours();
    hourly[hr].totalMinor += o.total_minor;
  }

  const popularMap = new Map<string, PopularItem>();
  for (const it of items) {
    const cur = popularMap.get(it.item_name) ?? {
      name: it.item_name,
      qty: 0,
      totalMinor: 0,
    };
    cur.qty += it.qty;
    cur.totalMinor += it.unit_price_minor * it.qty;
    popularMap.set(it.item_name, cur);
  }
  const popular = [...popularMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const billCount = new Set(orderList.map((o) => o.session_id)).size;

  return {
    orders: orderList.length,
    bills: billCount,
    grossMinor,
    discountsMinor,
    netMinor: grossMinor - discountsMinor,
    collectedMinor,
    outstandingMinor,
    byMethod,
    hourly,
    popular,
  };
}

export interface OutstandingBillRow {
  bill: Bill;
  tableLabel: string;
  sessionStatus: string;
}

export async function getOutstandingBills(): Promise<OutstandingBillRow[]> {
  const db = adminDb();
  const { data: bills } = await db
    .from("bills")
    .select("*")
    .neq("status", "paid")
    .order("created_at");
  const list = (bills as Bill[]) ?? [];
  if (!list.length) return [];

  const sessionIds = list.map((b) => b.session_id);
  const { data: sessions } = await db
    .from("table_sessions")
    .select("id,table_id,status")
    .in("id", sessionIds);
  const sessionRows = (sessions as Array<{ id: string; table_id: string; status: string }>) ?? [];
  const tableIds = [...new Set(sessionRows.map((s) => s.table_id))];
  const { data: tables } = tableIds.length
    ? await db.from("dining_tables").select("id,label").in("id", tableIds)
    : { data: [] as Array<{ id: string; label: string }> };
  const tableRows = (tables as Array<{ id: string; label: string }>) ?? [];

  return list.map((bill) => {
    const session = sessionRows.find((s) => s.id === bill.session_id);
    const table = tableRows.find((t) => t.id === session?.table_id);
    return {
      bill,
      tableLabel: table?.label ?? "Table",
      sessionStatus: session?.status ?? "unknown",
    };
  });
}

export interface StaffPerf {
  name: string;
  approvals: number;
  cancels: number;
  discounts: number;
  requests: number;
  cleared: number;
  total: number;
}

export async function getStaffPerformance(
  fromInput: string,
  toInput: string
): Promise<StaffPerf[]> {
  const from = istBoundsForInput(fromInput).start.toISOString();
  const to = istBoundsForInput(toInput).end.toISOString();
  const { data } = await adminDb()
    .from("audit_log")
    .select("actor_name,action")
    .gte("created_at", from)
    .lt("created_at", to);

  const map = new Map<string, StaffPerf>();
  for (const row of (data as Array<{ actor_name: string | null; action: string }>) ?? []) {
    const name = row.actor_name ?? "Unknown";
    const cur =
      map.get(name) ??
      ({
        name,
        approvals: 0,
        cancels: 0,
        discounts: 0,
        requests: 0,
        cleared: 0,
        total: 0,
      } as StaffPerf);
    if (row.action === "order.approved") cur.approvals++;
    else if (row.action === "order.cancelled") cur.cancels++;
    else if (row.action === "bill.discount") cur.discounts++;
    else if (row.action === "request.completed") cur.requests++;
    else if (row.action === "table.cleared") cur.cleared++;
    cur.total++;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
