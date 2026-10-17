export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me",
};

export function assertServerEnv() {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!env.serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.sessionSecret) missing.push("SESSION_SECRET");
  if (missing.length) {
    throw new Error(
      "Missing environment variables: " + missing.join(", ") + ". Check .env.local"
    );
  }
}
