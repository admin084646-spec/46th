export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: string };

export const ok = <T,>(data?: T): ActionResult<T> => ({ ok: true, data });
export const err = (error: string, code?: string): ActionResult<never> => ({
  ok: false,
  error,
  code,
});

/** Thrown/result code when the guest cookie points at a session that has
 * ended (cleared at the counter or deleted). The client uses it to offer
 * a one-tap rejoin instead of a dead end. */
export const ERR_SESSION_ENDED = "SESSION_ENDED";
