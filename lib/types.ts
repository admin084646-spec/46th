export type Role = "owner" | "admin" | "waiter" | "kitchen";

export interface Staff {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  perms: Record<string, unknown> | null;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  sort: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_minor: number;
  is_available: boolean;
  sort: number;
}

export interface DiningTable {
  id: string;
  label: string;
  qr_token: string;
}

export type SessionStatus = "active" | "awaiting_clearance" | "closed";

export interface TableSession {
  id: string;
  table_id: string;
  status: SessionStatus;
  opened_at: string;
  closed_at: string | null;
  cleared_by: string | null;
}

export type OrderStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Order {
  id: string;
  order_no: number;
  session_id: string;
  round_no: number;
  status: OrderStatus;
  source: "customer" | "waiter" | "admin";
  created_by_staff: string | null;
  customer_label: string | null;
  special_note: string | null;
  total_minor: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
  cancel_reason: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  unit_price_minor: number;
  qty: number;
  note: string | null;
}

export type TicketStatus =
  | "approved"
  | "preparing"
  | "ready"
  | "picked_up"
  | "served";

export interface KitchenTicket {
  id: string;
  order_id: string;
  ticket_no: number;
  table_label: string;
  status: TicketStatus;
  printed: boolean;
  picked_up_by: string | null;
  served_by: string | null;
  created_at: string;
  ready_at: string | null;
  served_at: string | null;
}

export type ServiceType = "waiter" | "bill" | "water" | "custom";
export type ServiceStatus = "pending" | "ack" | "done";

export interface ServiceRequest {
  id: string;
  session_id: string;
  table_label: string;
  type: ServiceType;
  note: string | null;
  status: ServiceStatus;
  created_at: string;
  acked_at: string | null;
  acked_by: string | null;
  done_at: string | null;
  done_by: string | null;
}

export type BillStatus = "unpaid" | "partial" | "paid";

export interface Bill {
  id: string;
  bill_no: number;
  session_id: string;
  status: BillStatus;
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  paid_minor: number;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export type PaymentMethod = "cash" | "upi" | "card";

export interface Payment {
  id: string;
  bill_id: string;
  amount_minor: number;
  method: PaymentMethod;
  status: "pending" | "verified" | "void";
  verified: boolean;
  ref: string | null;
  recorded_by: string;
  verified_by: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface BillSplit {
  id: string;
  bill_id: string;
  kind: "item" | "person";
  label: string;
  amount_minor: number;
  created_at: string;
}

export interface BillSplitItem {
  id: string;
  split_id: string;
  order_item_id: string;
  qty: number;
  amount_minor: number;
}

export interface Discount {
  id: string;
  bill_id: string;
  amount_minor: number;
  type: string;
  reason: string | null;
  staff_id: string;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_staff_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

export interface AppNotification {
  id: string;
  audience_role: Role | null;
  audience_staff: string | null;
  type: string;
  title: string;
  payload: unknown;
  read: boolean;
  created_at: string;
}
