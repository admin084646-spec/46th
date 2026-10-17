"use server";

import { redirect } from "next/navigation";
import { getGuestSession, setGuestCookie, clearGuestCookie } from "@/lib/auth";
import { getTableByToken, getOrCreateActiveSession } from "@/lib/business";
import { signal } from "@/lib/signal";
import { sessionTopic } from "@/lib/topics";
import { ok, err, type ActionResult } from "@/lib/action-result";

function randomCode(len = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Guest joins (or re-joins) the table's live session. No login required. */
export async function joinTableAction(
  qrToken: string
): Promise<ActionResult<{ label: string; tableLabel: string; sessionId: string }>> {
  const table = await getTableByToken(qrToken);
  if (!table) return err("This QR code is not valid.");

  const session = await getOrCreateActiveSession(table.id);
  if (session.status !== "active") {
    return err(
      "This table's bill is closed and awaiting clearance. Please ask staff for help."
    );
  }

  const existing = await getGuestSession();
  if (
    existing &&
    existing.tableId === table.id &&
    existing.sessionId === session.id
  ) {
    return ok({
      label: existing.label,
      tableLabel: table.label,
      sessionId: session.id,
    });
  }

  const guest = {
    sessionId: session.id,
    tableId: table.id,
    tableLabel: table.label,
    label: `Guest ${randomCode()}`,
  };
  await setGuestCookie(guest);
  await signal(["role:admin", sessionTopic(session.id)], "refresh", {
    reason: "guest_joined",
  });
  return ok({
    label: guest.label,
    tableLabel: table.label,
    sessionId: session.id,
  });
}

export async function renameGuestAction(
  label: string
): Promise<ActionResult<{ label: string }>> {
  const existing = await getGuestSession();
  if (!existing) return err("Your session has ended. Please scan again.");
  const clean = (label || "").trim().slice(0, 40);
  if (!clean) return err("Please enter a name.");
  await setGuestCookie({ ...existing, label: clean });
  return ok({ label: clean });
}

export async function leaveTableAction(): Promise<void> {
  await clearGuestCookie();
  redirect("/");
}
