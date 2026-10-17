# Mittal's Shudh Shakahari Bhojanalaya — Restaurant Operating System

One Next.js app runs the whole restaurant: customer QR ordering, counter
approval, kitchen display, waiter floor service, combined billing, payments,
receipts and owner reports.

Pure vegetarian · Panipat, Haryana · **no GST anywhere** (no tax lines, ever).

---

## 1. One-time setup (do this once)

### Step 1 — Create the database tables

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open the file `supabase/migrations/0001_init.sql` from this project.
3. Copy **everything** in it, paste it into the SQL Editor, and click **Run**.
4. You should see **"Success. No rows returned"**.

That single file creates every table, the safe-guard rules, and the starting
data:
- 6 staff logins (PINs below)
- 9 menu categories and **51 dishes**, priced and ready to sell
- 10 tables with their own QR codes

> The file is safe to run again — it rebuilds the app tables from scratch.

**Verify it worked:** run this in the SQL Editor and you should get `51`:

```sql
select count(*) from public.menu_items;
```

### Step 2 — Start the app

```bash
pnpm install
pnpm build
pnpm start -H 0.0.0.0 -p 3000
```

Then open <http://localhost:3000>.

**To use it from phones** (cashier tablet, waiter phones, and every customer
table) all devices must be on the **same Wi-Fi**, and they open this computer's
address — for example <http://192.168.29.14:3000>. Find the address by running
`ipconfig` and looking for **IPv4 Address**. Always start with `-H 0.0.0.0`;
without it, only this computer can reach the app.

> **Use `pnpm build` + `pnpm start` — never `pnpm dev` — for the restaurant.**
> Development mode can leave the app stuck on a loading screen. Only one of the
> two can run at a time on port 3000, so stop the old one first. If a screen ever
> gets stuck loading, stop it, delete the `.next` folder, then run the two
> commands above again.

---

## 2. Staff PINs (6 digits)

| Who | PIN | Lands on |
|---|---|---|
| Owner (Mittal Ji) | `000001` | `/owner` reports |
| Cashier / Admin (Front Desk) | `000002` | `/admin` counter |
| Waiter (Ramesh) | `000003` | `/waiter` floor |
| Waiter (Suresh) | `000004` | `/waiter` floor |
| Kitchen Head | `000005` | `/kitchen` display |
| Kitchen Cook | `000006` | `/kitchen` display |

The owner can also open the counter screens — to remove that power later, edit
the owner row's `perms` to `{}` in Supabase.

> **These PINs are not shown anywhere inside the app** — the sign-in screen no
> longer lists them, so nobody standing at the counter can read them. Keep this
> file somewhere private.
>
> A PIN is asked for **every time** someone signs in, and the app forgets the
> sign-in when the browser is closed. That is on purpose: the counter device is
> shared.

---

## 3. Customer ordering

Each table has a private link. Print the QR code for a table from the admin
screen, or just open the link directly:

```
http://192.168.29.14:3000/t/t01-xxxxxxxxxx
```

(Use your computer's own Wi-Fi address in place of `192.168.29.14`.)

Get the real token for any table from Supabase:

```sql
select label, qr_token from public.dining_tables order by label;
```

Guests scan → pick their name → browse the menu → send an order. The order goes
to the **counter for approval** first. Only after the cashier approves it does a
ticket appear in the kitchen.

---

## 4. The rules the app enforces

- **One table = one session = one bill.** Every phone at a table joins the same
  combined bill. A table is only freed when staff clear it.
- **Nothing reaches the kitchen without approval.** Customers can't edit an
  order after sending it. Only staff can reject (before approval) or cancel
  (after approval) — always with a reason, always logged.
- **Prices come from the server**, never from the phone.
- **A payment only counts once verified.** UPI/card are held as *pending* until
  a staff member confirms them; cash is instant.
- **Splits always add up** to the exact bill total.
- **Every sensitive action is audited** — who, what, when, why, before/after.
- **No tax, no stock tracking, no online payment, no customer accounts.**

---

## 5. Daily flow

1. **Cashier** signs in at `/login` with their 6-digit PIN. A PIN is required
   every time — the app does not keep anyone signed in on the shared device.
2. Guests scan the table QR and order.
3. **Cashier** approves orders (`/admin`) → the kitchen gets tickets.
4. **Kitchen** moves tickets New → Preparing → Ready (`/kitchen`).
5. **Waiter** picks up and serves, answers guest requests, can add extra items
   verbally requested (`/waiter`).
6. **Cashier** opens the table's bill (`/admin/tables` → table) and records
   payments, discounts and splits; prints the receipt; clears the table.
7. **Owner** reviews the day's sales, popular items, staff activity, outstanding
   bills and the audit trail (`/owner`).

There is **no shift or attendance (in/out) system** — you sign in and start
working, and the owner reports show the day's sales directly.

---

## 6. If something looks wrong

| Symptom | Fix |
|---|---|
| A screen is stuck on a loading spinner (e.g. "Setting up Table 1…") | The app was started with `pnpm dev`, or an old build is being served. Stop it, delete the `.next` folder, then run `pnpm build` and `pnpm start -H 0.0.0.0 -p 3000`. |
| Taps work but the page will not scroll down (laptop or phone) | Old cached page. Close the browser tab and open a fresh one, then hard-refresh. Fixed in the app itself on 17 Oct 2026 (a CSS rule and a popup were locking the scroll) — after updating to this build, clear the browser cache once so the new files load. |
| A popup forms opened but looks cut off / can't be closed (e.g. "Your name") | Fixed on 17 Oct 2026 — the popup now always shows as a full bottom-sheet on the phone screen. Refresh once after updating; if a tab is already showing the half-hidden popup, just reload the page. |
| Phones can't open the link at all | Use the computer's Wi-Fi address (`ipconfig` → IPv4 Address), not `localhost`, and make sure the server was started with `-H 0.0.0.0`. Allow it through the Windows firewall on **Private** networks. |
| "Invalid PIN" for every PIN | The SQL in Step 1 hasn't run yet. |
| Menu is empty | Same — re-run the SQL, check `select count(*) from public.menu_items`. |
| Table link says invalid | The QR token doesn't match any row in `dining_tables`. |
| Tables don't appear in the API | In Supabase: Database → API → "Reload schema". |
