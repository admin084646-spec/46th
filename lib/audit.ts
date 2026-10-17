import "server-only";
import { adminDb } from "./supabase";
import type { Role } from "./types";

export interface AuditInput {
  actorStaffId?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function writeAudit(entry: AuditInput): Promise<void> {
  try {
    await adminDb().from("audit_log").insert({
      actor_staff_id: entry.actorStaffId ?? null,
      actor_name: entry.actorName ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      reason: entry.reason ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch {
    /* auditing must never break the main action */
  }
}

export interface NotifyInput {
  role?: Role;
  staffId?: string;
  type: string;
  title: string;
  payload?: unknown;
}

export async function pushNotification(n: NotifyInput): Promise<void> {
  try {
    await adminDb().from("notifications").insert({
      audience_role: n.role ?? null,
      audience_staff: n.staffId ?? null,
      type: n.type,
      title: n.title,
      payload: n.payload ?? null,
    });
  } catch {
    /* notifications are best-effort */
  }
}
