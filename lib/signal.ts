import { env } from "./env";

/**
 * Best-effort realtime broadcast. Clients also poll, so a failed broadcast
 * never loses an update — it just arrives a few seconds later.
 */
export async function signal(
  topics: string | string[],
  event = "refresh",
  payload: Record<string, unknown> = {}
): Promise<void> {
  const list = (Array.isArray(topics) ? topics : [topics]).filter(Boolean);
  if (!list.length || !env.supabaseUrl || !env.anonKey) return;
  try {
    await fetch(`${env.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      body: JSON.stringify({
        messages: list.map((topic) => ({ topic, event, payload })),
      }),
      cache: "no-store",
    });
  } catch {
    /* ignore — polling fallback covers delivery */
  }
}
