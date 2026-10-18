"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
}

/**
 * Subscribe to realtime refresh signals for a set of topics, and poll as a
 * safety net. On any signal the current route refetches authoritative,
 * permission-checked server data.
 *
 * Polling is visibility-gated: a phone lying on the table in someone's pocket
 * (page hidden) must not burn server/DB cycles every few seconds. When the
 * tab becomes visible again it refreshes immediately.
 */
export function useLive(topics: string[], intervalMs = 8000, enabled = true) {
  const router = useRouter();
  const key = topics.join("|");

  useEffect(() => {
    if (!enabled || !key) return;
    const supabase = getClient();
    const channels = key
      .split("|")
      .filter(Boolean)
      .map((topic) =>
        supabase
          .channel(topic)
          .on("broadcast", { event: "refresh" }, () => router.refresh())
          .subscribe()
      );

    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer =
      intervalMs > 0 ? window.setInterval(tick, intervalMs) : 0;

    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      for (const ch of channels) {
        try {
          supabase.removeChannel(ch);
        } catch {
          /* noop */
        }
      }
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, intervalMs, enabled, router]);
}
