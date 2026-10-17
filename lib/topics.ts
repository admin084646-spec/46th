/* Realtime topics. Server broadcasts a lightweight "refresh" ping;
   clients refetch authoritative, permission-checked data. */

export const roleTopic = (role: "admin" | "kitchen" | "waiter" | "owner") =>
  `role:${role}`;

export const sessionTopic = (sessionId: string) => `session:${sessionId}`;

/** Global topic for menu availability changes — customers listen too. */
export const MENU_TOPIC = "menu";
export const MENU_ADMIN_TOPIC = "menu:admin";

export const ALL_STAFF_TOPICS = [
  "role:admin",
  "role:kitchen",
  "role:waiter",
  "role:owner",
] as const;
