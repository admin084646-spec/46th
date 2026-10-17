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

    const timer =
      intervalMs > 0
        ? window.setInterval(() => router.refresh(), intervalMs)
        : 0;

    return () => {
      for (const ch of channels) {
        try {
          supabase.removeChannel(ch);
        } catch {
          /* noop */
        }
      }
      if (timer) window.clearInterval(timer);
    };
  }, [key, intervalMs, enabled, router]);
}
