// Honest connectivity + schema check. Run: pnpm db:check
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("✗ .env.local is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  "staff",
  "shifts",
  "attendance",
  "menu_categories",
  "menu_items",
  "dining_tables",
  "table_sessions",
  "orders",
  "order_items",
  "kitchen_tickets",
  "service_requests",
  "bills",
  "bill_splits",
  "bill_split_items",
  "payments",
  "discounts",
  "refunds",
  "audit_log",
  "notifications",
];

let missing = 0;
for (const t of TABLES) {
  // A real GET (not HEAD) so a missing table actually reports its error.
  const { count, error } = await db
    .from(t)
    .select("*", { count: "exact" })
    .limit(1);
  if (error) {
    missing++;
    console.log(`✗ ${t.padEnd(18)} ${error.message}`);
  } else {
    console.log(`✓ ${t.padEnd(18)} ${count ?? 0} row(s)`);
  }
}

if (missing) {
  console.log(
    `\n${missing} table(s) missing — run supabase/migrations/0001_init.sql in the Supabase SQL Editor.`
  );
  process.exit(1);
}
console.log("\nAll tables present. If the counts are 0, run: pnpm seed");
