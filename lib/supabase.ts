import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Server-only Supabase client using the service_role key.
 * Bypasses RLS — ALL authorization is enforced by our own code paths.
 */
let cached: SupabaseClient | null = null;

export function adminDb(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "mittals-ros-server" } },
    });
  }
  return cached;
}

export function dbConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.serviceKey);
}
