import type { Role } from "./types";
import type { StaffSession } from "./auth";

/** Owner can hold limited admin powers only when explicitly granted. */
export function hasAdmin(s: StaffSession | null): boolean {
  if (!s) return false;
  if (s.role === "admin") return true;
  return s.perms?.admin === true;
}

export function isOwner(s: StaffSession | null): boolean {
  return s?.role === "owner";
}

export function isKitchen(s: StaffSession | null): boolean {
  return s?.role === "kitchen";
}

export function isWaiter(s: StaffSession | null): boolean {
  return s?.role === "waiter";
}

/* Action-level permissions (server-enforced). */
export const can = {
  approveOrders: (s: StaffSession | null) => hasAdmin(s),
  rejectOrders: (s: StaffSession | null) => hasAdmin(s),
  cancelOrders: (s: StaffSession | null) => hasAdmin(s),
  correctOrders: (s: StaffSession | null) => hasAdmin(s),
  manageMenu: (s: StaffSession | null) => hasAdmin(s),
  applyDiscount: (s: StaffSession | null) => hasAdmin(s),
  recordPayment: (s: StaffSession | null) => hasAdmin(s),
  verifyPayment: (s: StaffSession | null) => hasAdmin(s),
  clearTable: (s: StaffSession | null) => hasAdmin(s),
  splitBill: (s: StaffSession | null) => hasAdmin(s),
  viewReports: (s: StaffSession | null) => isOwner(s) || hasAdmin(s),
  viewAudit: (s: StaffSession | null) => isOwner(s) || hasAdmin(s),
  updateKitchen: (s: StaffSession | null) => isKitchen(s) || hasAdmin(s),
  serveOrders: (s: StaffSession | null) => isWaiter(s) || hasAdmin(s),
  handleRequests: (s: StaffSession | null) => isWaiter(s) || hasAdmin(s),
  addExtraItems: (s: StaffSession | null) => isWaiter(s) || hasAdmin(s),
};

export function roleHome(role: Role | undefined): string {
  switch (role) {
    case "owner":
      return "/owner";
    case "admin":
      return "/admin";
    case "waiter":
      return "/waiter";
    case "kitchen":
      return "/kitchen";
    default:
      return "/login";
  }
}
