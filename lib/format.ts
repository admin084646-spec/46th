const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** Minutes elapsed since a timestamp (for "waiting long" flags). */
export function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Start/end of the current IST day as UTC Date objects. */
export function istDayBounds(d: Date = new Date()): { start: Date; end: Date } {
  const istNow = new Date(d.getTime() + IST_OFFSET_MS);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const day = istNow.getUTCDate();
  const startUtc = Date.UTC(y, m, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  return { start: new Date(startUtc), end: new Date(startUtc + 24 * 3600 * 1000) };
}

/** yyyy-mm-dd in IST for date inputs. */
export function istDateInput(d: Date = new Date()): string {
  const istNow = new Date(d.getTime() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10);
}

export function addDaysToInput(value: string, days: number): string {
  const [y, m, day] = value.split("-").map(Number);
  const base = Date.UTC(y, (m || 1) - 1, day || 1);
  const next = new Date(base + days * 24 * 3600 * 1000);
  return next.toISOString().slice(0, 10);
}

/** Convert a yyyy-mm-dd IST date string to UTC bounds. */
export function istBoundsForInput(value: string): { start: Date; end: Date } {
  const [y, m, day] = value.split("-").map(Number);
  const startUtc = Date.UTC(y, (m || 1) - 1, day || 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  return { start: new Date(startUtc), end: new Date(startUtc + 24 * 3600 * 1000) };
}
