# BRAIN.md — Mittal's Restaurant OS

> **READ THIS FIRST.** This is the persistent project memory for this repository.
>
> It exists so a fresh AI agent or developer can understand the **entire** project
> without reading the whole codebase or the previous conversation.
>
> **Trust order when this file conflicts with reality:**
> `runtime evidence / tests` > `source code` > `git history` > `this file` > `assumptions`.
> If this file disagrees with the code, **the code wins** — then fix this file.
>
> **For a new agent, the session-start protocol is at the very bottom (§18).**

---

## Table of contents

1. [What this project is](#1-what-this-project-is)
2. [Stack & versions](#2-stack--versions)
3. [Commands](#3-commands)
4. [Environment variables](#4-environment-variables)
5. [Repository map](#5-repository-map)
6. [Data model](#6-data-model)
7. [The core invariants — PROTECTED](#7-the-core-invariants--protected)
8. [Business rules (product decisions)](#8-business-rules-product-decisions)
9. [Auth model](#9-auth-model)
10. [Realtime model](#10-realtime-model)
11. [Feature registry](#11-feature-registry)
12. [Money handling](#12-money-handling)
13. [Known traps & negative knowledge](#13-known-traps--negative-knowledge)
14. [Verification status](#14-verification-status)
15. [Current state](#15-current-state)
16. [Next work](#16-next-work)
17. [Complete screen & button reference](#17-complete-screen--button-reference)
18. [Session-start protocol](#18-session-start-protocol-for-the-next-agent)

---

## 1. What this project is

**Mittal's Shudh Shakahari Bhojanalaya — Restaurant Operating System.**
A single Next.js app that runs the whole restaurant on phones.

Package name: `mittals-restaurant-os`.
It is a **pure-vegetarian restaurant POS/ordering system** with five workspaces:

| Workspace | Who | Route |
|---|---|---|
| Customer QR menu | Guest, on their own phone | `/t/[qr]` |
| Admin / Cashier | Front desk | `/admin` |
| Kitchen | Cooks (KDS) | `/kitchen` |
| Waiter | Floor staff | `/waiter` |
| Owner | Owner | `/owner` |

**One sentence of the whole product:**
A guest scans the QR sticker on their table → sees the menu → submits an order →
the cashier **approves** it → it becomes a kitchen ticket → the kitchen marks it
ready → the waiter serves it → the cashier collects payment → the table is
**manually cleared**. Multiple phones at the same table share **one session and
one combined bill**.

`README.md` is the **non-technical user guide** (setup, PINs, daily flow).
**This file is the technical source of truth.**

---

## 2. Stack & versions

`[VERIFIED]` — from `package.json` and a successful build.

| Piece | Version / choice | Notes |
|---|---|---|
| Next.js | **16.4.0** | App Router, **Turbopack is the default bundler** |
| React | 19.3.0 | |
| TypeScript | ^5 | strict |
| Tailwind CSS | ^4 | via `@tailwindcss/turbopack` plugin, **not** PostCSS |
| Database | Supabase Postgres | plain SQL migration, **no ORM / no Prisma** |
| DB client | `@supabase/supabase-js` | **service_role key, server-side only** |
| Auth | `bcryptjs` + `jose` | custom PIN → JWT in an httpOnly cookie |
| QR | `qrcode` | server-side SVG generation |
| Package manager | pnpm 11.11.0 | Node 24.x |
| Font | Poppins | via `next/font` in `app/layout.tsx` |

**Not used on purpose:** no Supabase Auth, no ORM, no state library, no UI kit.
`jspdf` is in `dependencies` but **is dead weight / unused** — the receipt is a
print-optimised HTML route instead. Safe to remove.

### ⚠️ Next.js 16 breaking changes that bite here

These differ from most training data. Respect them:

- `params`, `searchParams`, `cookies()`, `headers()` are **async** → always `await`.
- **Turbopack is the default** for `next dev` and `next build`.
- `middleware` was renamed to **`proxy`**.
- Do **not** use canary-only helpers like `forbidden()` / `unauthorized()`.
- Files with `"use server"` may **only export async functions**.
- Next re-adds the `<!-- BEGIN:nextjs-agent-rules -->` block to `AGENTS.md` on
  every `next dev`. That block is not ours; leave it.

---

## 3. Commands

Run everything from the project root (`C:\Users\DELL\Downloads\46`).

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on **http://localhost:3000**. **Never serve phones from this** — see the 2026-10-15 trap in §13 |
| `pnpm build` | Production build (also runs TypeScript) |
| `pnpm start -H 0.0.0.0 -p 3000` | **This is what the restaurant runs.** Production build served to every device on the Wi-Fi. Note the form: `pnpm start -- -H …` does **not** work |
| `npx tsc --noEmit` | Typecheck only — the fastest real check |
| `pnpm db:check` | **Honest** DB connectivity check: lists all 19 tables + row counts |
| `pnpm seed` | Idempotent REST seeder (same data as the SQL seed) |
| `pnpm lint` | ESLint |

> **Exactly one server on port 3000 — and it must be the production one.**
> `next dev` rewrites `.next`; if `next start` then runs against that output it
> serves **dev** chunks (React `*_development`, devtools, the HMR client) that
> never hydrate, so every client screen hangs silently. This is what caused the
> 2026-10-15 "stuck on Setting up Table 1…" report. To switch cleanly: stop the
> old process, `Remove-Item .next -Recurse -Force`, `pnpm build`, then
> `pnpm start -H 0.0.0.0 -p 3000`.

**Windows/PowerShell notes**

- PowerShell treats `[` `]` as wildcards. Use `-LiteralPath` for paths like
  `app\admin\bill\[sessionId]\page.tsx`.
- `pnpm` prints `ERR_PNPM_IGNORED_BUILDS (core-js)` noise; it is harmless **as long
  as** `pnpm-workspace.yaml` has boolean values (see §13).
- Reading files with the `read` tool is UTF-8-correct; PowerShell's console may
  render `—` as mojibake. That's a display artifact, not file corruption.

---

## 4. Environment variables

Values live in **`.env.local`** (git-ignored, present on this machine). Do not
paste secrets into this file or into a commit.

| Variable | Purpose | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key, used **only** for the Realtime broadcast POST | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret.** Bypasses RLS. Never expose to the browser. | same page |
| `SESSION_SECRET` | HS256 signing key for staff/guest JWTs | random 64-hex; rotating it invalidates all sessions |
| `NEXT_PUBLIC_APP_URL` | *Optional.* Absolute origin used in printed QR codes | set in production to the real domain |

`lib/env.ts` reads these and `assertServerEnv()` throws a clear message if one is missing.

> **Security rule:** `SUPABASE_SERVICE_ROLE_KEY` must only ever be imported by
> `server-only` modules. `lib/supabase.ts` imports `server-only` to enforce this at
> build time. **Never import it from a `"use client"` file.**

---

## 5. Repository map

```
46/
├─ app/
│  ├─ layout.tsx                  Root layout, Poppins font, globals.css
│  ├─ page.tsx                    Public landing page (static)
│  ├─ globals.css                 Design tokens + print styles
│  ├─ login/                      Staff PIN login (page + PIN-pad client form)
│  ├─ api/
│  │  ├─ login/route.ts           JS-FREE staff sign-in (plain form POST → 303)
│  │  └─ logout/route.ts          JS-FREE sign-out
│  ├─ t/[qr]/page.tsx             CUSTOMER entry — resolves qr_token → table session
│  ├─ admin/
│  │  ├─ page.tsx                 Counter: pending order approvals
│  │  ├─ tables/page.tsx          Table board → "Print table QR codes" link
│  │  ├─ menu/page.tsx            Sold-out / availability toggles
│  │  ├─ qr/page.tsx              PRINTABLE QR SHEET (10 tables, server-generated SVG)
│  │  └─ bill/[sessionId]/
│  │     ├─ page.tsx              Billing workspace (orders, discount, pay, split, clear)
│  │     └─ receipt/page.tsx      Print-optimised receipt
│  ├─ kitchen/page.tsx            KDS
│  ├─ waiter/page.tsx             Floor / service requests
│  └─ owner/page.tsx              Reports dashboard
│
├─ lib/
│  ├─ env.ts                      Typed env access + assertServerEnv()
│  ├─ supabase.ts                 adminDb (service_role) — "server-only"
│  ├─ types.ts                    ALL hand-written DB types + domain unions
│  ├─ auth.ts                     Staff + guest JWT cookies (bcrypt verify)
│  ├─ perms.ts                    Permission helpers (hasAdmin, etc.)
│  ├─ guard.ts                    Page guards: pageStaff/pageAdmin/pageKitchen/
│  │                              pageWaiter/pageOwner + guard() for actions
│  ├─ action-result.ts            ActionResult type ({ok:true,...}|{ok:false,error})
│  ├─ business.ts                 Domain logic: getSessionWorkspace, ensureBill,
│  │                              recomputeBill, getTableBoard, getMenu
│  ├─ queries.ts                  Read helpers for lists/screens
│  ├─ reports.ts                  Owner reporting + report interfaces
│  ├─ money.ts                    Paise helpers (format, parse, arithmetic)
│  ├─ format.ts                   Dates, labels, misc formatting
│  ├─ audit.ts                    writeAudit() — actor/time/reason/before/after
│  ├─ signal.ts                   Best-effort realtime broadcast (never throws)
│  ├─ topics.ts                   Channel names: role:*, session:*, menu
│  ├─ business-info.ts            BUSINESS — single source for receipt/footer details
│  ├─ app-url.ts                  appBaseUrl() + isLoopbackOrigin() for QR codes
│  ├─ cn.ts                       className merge helper
│  └─ actions/                    "use server" files (async fns only)
│     ├─ auth.ts                  login / logout
│     ├─ guest.ts                 guest session bootstrap
│     ├─ orders.ts                submit / approve / reject / cancel
│     ├─ service.ts               service requests
│     └─ billing.ts               payments, discount, split, clear table
│
├─ components/                    See §11 for which ones are client vs server
├─ scripts/
│  ├─ db-check.mjs                pnpm db:check
│  └─ seed.mjs                    pnpm seed
├─ supabase/migrations/0001_init.sql   445 lines — the whole schema + seed
├─ README.md                      user guide (non-technical)
├─ BRAIN.md                       this file
├─ next.config.ts                 cacheComponents:false + turbopack tailwind rule
└─ pnpm-workspace.yaml            allowBuilds booleans (see §13)
```

### Client vs server components — IMPORTANT

- **`components/ui.tsx` is imported by SERVER components. Never add a hook
  (`useState`, `useEffect`, …) to it.** It must stay server-safe.
- Interactive overlays live in **`components/modal.tsx`** (`"use client"`).
- The big client components are `customer-app.tsx` (959 lines) and
  `billing-screen.tsx` (1099 lines). Both are the natural place for UI logic
  changes in their workspaces.

---

## 6. Data model

`[VERIFIED]` — the migration was executed against real Postgres (PGlite) and all
19 tables were created; `pnpm db:check` confirms them live in Supabase.

**19 tables**

| Group | Tables |
|---|---|
| Staff | `staff` |
| Menu | `menu_categories`, `menu_items` |
| Tables & sessions | `dining_tables`, `table_sessions` |
| Orders | `orders`, `order_items`, `kitchen_tickets` |
| Service | `service_requests` |
| Money | `bills`, `bill_splits`, `bill_split_items`, `payments`, `discounts` |
| System | `audit_log`, `notifications` |
| **Unused** | `shifts`, `attendance`, `refunds` — still in the schema but **no code touches them** (removed 2026-10-14, see §16) |

**3 sequences** (human-facing numbers)

| Sequence | Starts at | Used for |
|---|---|---|
| `order_no_seq` | 1001 | `orders.order_no` |
| `kot_no_seq` | 2001 | `kitchen_tickets.kot_no` |
| `bill_no_seq` | 3001 | `bills.bill_no` |

**Structural facts worth knowing**

- `order_items.line_total_minor` is a **generated column** (`qty * unit_price_minor`).
  `[VERIFIED]` `24000 × 3 = 72000`.
- `kitchen_tickets` is **1:1 with an approved order** (one ticket per order).
- `table_sessions.status` ∈ `active | awaiting_clearance | closed`.
- `staff.role` ∈ `owner | admin | waiter | kitchen`.
- `staff.perms` is jsonb, e.g. `{"admin": true}` grants the owner cashier powers.
- `updated_at` is maintained by `touch_updated_at` triggers.
- **RLS is enabled on all 19 tables with NO policies.** The app talks to Postgres
  through `service_role`, which bypasses RLS entirely. This is intentional:
  authorisation happens in server code (§9), not in the database.
- Money columns are `integer` **paise** with `check (>= 0)` constraints on
  `orders.total_minor` and all `bills.*_minor`. `amount_minor` on payments is
  `check (> 0)`.
- **There is no tax/GST/VAT column anywhere.** This is deliberate (§8).

**Seed data** baked into the migration (`[VERIFIED]` live: 6 / 9 / 51 / 10)

| Table | Rows |
|---|---|
| `staff` | 6 |
| `menu_categories` | 9 |
| `menu_items` | **51** dishes |
| `dining_tables` | 10 |

Seeded staff (name · role · PIN):

| Name | Role | PIN | perms |
|---|---|---|---|
| Mittal Ji (Owner) | owner | `000001` | `{"admin": true}` |
| Front Desk (Cashier) | admin | `000002` | `{}` |
| Ramesh (Waiter) | waiter | `000003` | `{}` |
| Suresh (Waiter) | waiter | `000004` | `{}` |
| Kitchen Head | kitchen | `000005` | `{}` |
| Kitchen Cook | kitchen | `000006` | `{}` |

> `/admin/bill/[sessionId]/receipt` and the QR sheet both read business details from
> `lib/business-info.ts` (`BUSINESS`). Change the restaurant name/address **there**,
> once.

---

## 7. The core invariants — PROTECTED

These are the contracts that make the product correct. **Do not break them to add
a feature.** If a request seems to require breaking one, stop and escalate.

| # | Invariant | Enforced by |
|---|---|---|
| **I1** | One table → **at most one live session** | partial unique index `one_live_session_per_table` |
| **I2** | One session → **one combined bill** across many customer phones | all orders hang off `table_sessions` |
| **I3** | A customer **cannot edit** a submitted order | no update action exposed |
| **I4** | Orders need **admin approval** before a kitchen ticket exists | `orders.status` gate; ticket created only on approve |
| **I5** | Only admin can **reject** (pre-approval) or **cancel** (post-approval), always with a reason | `lib/actions/orders.ts` + `writeAudit()` |
| **I6** | **Manual** table clearance only — nothing auto-closes a session | `clearTable()` in `lib/actions/billing.ts` |
| **I7** | Price is **server-authoritative** — never trust a price from the client | price re-read from `menu_items` on submit |
| **I8** | A payment counts **only when verified**: cash auto-verified, UPI/card must be verified | `payments.verified` flow in `billing.ts` |
| **I9** | Splits must **reconcile to the bill total** | `bill_splits` / `bill_split_items` validation |
| **I10** | Money is **integer paise**, never float | `*_minor` columns + `lib/money.ts` |
| **I11** | **Every sensitive action is audited** with actor / time / reason / before-after | `lib/audit.ts` → `audit_log` |
| **I12** | **No tax, ever** | no tax column; do not add one |

`[VERIFIED]` I1 specifically: the migration test proved a second active session on
the same table is **blocked**, and a **new** session is allowed once the previous
one is closed.

---

## 8. Business rules (product decisions)

These were explicitly agreed with the owner. Treat them as requirements, not
suggestions.

**In scope**

- QR ordering, admin approval, KDS, waiter service, combined billing, payments,
  receipts, owner reporting (**daily sales only** — no shifts/attendance),
  auditing.

**Explicitly OUT of scope — do not add without being asked**

- ❌ Tax / GST / VAT — *anywhere*, ever.
- ❌ Inventory / stock tracking.
- ❌ Online customer payment (no Razorpay/Stripe for guests).
- ❌ Reservations.
- ❌ Mandatory customer accounts (guests stay anonymous).
- ❌ Multi-branch support.

**User decisions to preserve**

- PINs are **6 digits, stored hashed** — the owner said
  *"just give pins of 6 digits, no supabase use in pins"* (i.e. do not use
  Supabase Auth for PINs).
- The owner is **non-technical** and asked for minimal setup. Keep setup to:
  run one SQL file, then `pnpm dev`.
- **"No edge cutting" is mandatory on every screen, customer AND staff:** no
  clipped controls, no accidental page-level horizontal scroll, mobile-first.
  This is a design contract — check it before calling a UI change done.

---

## 9. Auth model

**Not Supabase Auth.** Custom, server-side.

**Staff** (`lib/auth.ts`)

1. Staff types a 6-digit PIN at `/login`.
2. `app/api/login/route.ts` calls `loginWithPin()` (`lib/auth.ts`), which
   bcrypt-compares the PIN against every active `staff.pin_hash`.
3. On match, a **JWT (HS256, `jose`)** is signed with `SESSION_SECRET` and stored
   in the httpOnly cookie **`mos_staff`**. That cookie is a **session cookie**
   (no `maxAge`) and the JWT expires after **24 h**, so closing the browser asks
   for the PIN again. Set 2026-10-15: the previous 30-day persistent login let
   anyone at the counter device walk straight into the cashier workspace.
4. Payload: `{ id, name, role, perms, kind: "staff" }`.
5. **The PIN is required every time.** `/` never offers a shortcut for an existing
   cookie, and `app/login/page.tsx` does **not** auto-redirect an already
   signed-in staff member into their workspace — it always renders the PIN pad.

**Guest** (`lib/auth.ts`)

- An **anonymous** signed cookie **`mos_guest`** binds the guest to a
  `{ sessionId, tableId }`. No account, no password.

**Authorisation**

- `lib/perms.ts` — permission helpers.
- `lib/guard.ts` — `pageStaff()` / `pageAdmin()` / `pageKitchen()` /
  `pageWaiter()` / `pageOwner()` guard **pages** (redirect to `/login`), and
  `guard()` guards **actions**. `guard()` returns a plain
  `{ ok: false, error }` object (not a thrown error) so the return type stays narrow.
- Every sensitive action re-checks permission **server-side** — never rely on the
  UI hiding a button.

---

## 10. Realtime model

Deliberately simple and **best-effort**:

```
server action
  → POST <supabase>/realtime/v1/api/broadcast   (anon key)   [lib/signal.ts]
    → Supabase Broadcast channel (public)
      → the right clients are subscribed (components/live.tsx)
        → router.refresh()   ← clients refetch AUTHORITATIVE data
```

- Broadcast payload is only a **"refresh" ping** — never the data itself.
  Clients always refetch through permission-checked server code.
- Channels (`lib/topics.ts`): `role:admin` `role:kitchen` `role:waiter`
  `role:owner`, `session:<id>`, `menu`, `menu:admin`.
- **Polling fallback:** `useLive(topics, intervalMs = 8000)` also calls
  `router.refresh()` every 8 s. **`signal()` may silently no-op** — polling is what
  guarantees eventual delivery. Never make correctness depend on the broadcast.

---

## 11. Feature registry

| ID | Feature | Status | Primary files | Verification |
|---|---|---|---|---|
| F01 | Customer QR menu & ordering | VERIFIED | `app/t/[qr]/page.tsx`, `components/customer-app.tsx`, `lib/actions/guest.ts` | runtime 200 + menu rendered |
| F02 | Order approval / reject | VERIFIED | `app/admin/page.tsx`, `components/approvals.tsx`, `lib/actions/orders.ts` | build + code |
| F03 | Kitchen display (KDS) | VERIFIED | `app/kitchen/page.tsx`, `components/kitchen-board.tsx` | build + code |
| F04 | Waiter floor & service requests | VERIFIED | `app/waiter/page.tsx`, `components/waiter-board.tsx`, `components/service-requests.tsx` | build + code |
| F05 | Combined billing, discount, split (**refund removed**) | VERIFIED | `app/admin/bill/[sessionId]/page.tsx`, `components/billing-screen.tsx`, `lib/actions/billing.ts` | build + rendered 200 with a live test session |
| F06 | Receipt printing | VERIFIED | `app/admin/bill/[sessionId]/receipt/page.tsx` | build + code |
| F07 | Table board & manual clearance | VERIFIED | `app/admin/tables/page.tsx`, `components/table-board.tsx` | build + code |
| F08 | Menu availability / sold out | VERIFIED | `app/admin/menu/page.tsx`, `components/menu-availability.tsx` | build + code |
| F09 | ~~Shifts, attendance & cash reconciliation~~ **REMOVED** | — | *deleted 2026-10-14* — `/admin/shift` now returns **404** | owner asked for a simpler app |
| F10 | Owner reports (daily sales) | VERIFIED | `app/owner/page.tsx`, `components/owner-dashboard.tsx`, `lib/reports.ts` | build + rendered 200; no shift/refund sections |
| F11 | Audit log | VERIFIED | `lib/audit.ts` | schema + code |
| F12 | Realtime refresh + polling | VERIFIED | `lib/signal.ts`, `lib/topics.ts`, `components/live.tsx` | build + code |
| F13 | **Printable table QR codes** | VERIFIED | `app/admin/qr/page.tsx`, `lib/app-url.ts`, `components/print-button.tsx`, `qrcode` dep | fetched with a real staff cookie: 200, **10 QR SVGs**, 10 labels, correct guest token encoded |

---

## 12. Money handling

- **All money is `integer` paise.** `₹240.00` is stored as `24000`.
- Never use floats for money. Use **`lib/money.ts`** helpers to format/parse.
- `lib/business.ts → recomputeBill()` is the single place the bill total is
  computed. It **clamps with `Math.max(0, subtotal - discount)`** so the
  `check (>= 0)` constraints can never fire on a legitimate path.
- `ensureBill(sessionId)` creates the bill for a session on demand.
- Payments only count when **verified** (I8). Splits must **reconcile** (I9).

---

## 13. Known traps & negative knowledge

### Do not do these

| ❌ Do not | Why |
|---|---|
| Add `useState`/`useEffect` to `components/ui.tsx` | It is imported by **server** components; hooks break the build |
| Import `lib/supabase.ts` from a `"use client"` file | Exposes the **service_role** key to the browser |
| Trust a price sent from the client | Violates I7; always re-read from `menu_items` |
| Add a tax/GST column or line | Explicitly out of scope, forever |
| Allow two live sessions on one table | Violates I1 (index `one_live_session_per_table`) |
| Auto-close a table/session | Violates I6; clearance is manual |
| Make correctness depend on the realtime broadcast | `signal()` is best-effort; polling is the safety net |
| Use `jspdf` | It is installed but **unused**; the receipt is an HTML print route |
| Run `git add` from the project folder | The git root resolves to `C:/` with **zero commits** — changes are working-tree only |
| Re-run `supabase/migrations/0001_init.sql` on live data | It **drops and recreates** every app table. It is re-runnable but **destructive** |
| Mark cookies `secure` from `NODE_ENV` alone | Over LAN **HTTP** the browser silently *drops* the cookie and sign-in loops forever. `lib/auth.ts` now marks Secure only when the request really is HTTPS |
| Build a redirect from `req.url` in a route handler | It follows the bound interface (e.g. `http://0.0.0.0:3000`), which no phone can reach. Use `appBaseUrl()` — the caller's `Host` |
| Expect a **running** `next dev` to notice a route you added/removed | It kept serving the deleted `/admin/shift` until restarted. Restart after route changes |
| Serve the restaurant from `pnpm dev` | 2026-10-15: `next dev` on port 3000 shipped a **dev build** whose React never hydrated in a real browser (`window.next` undefined, no React keys on the DOM, no page error) — every guest sat on "Setting up Table 1…" forever and no `mos_guest` cookie was ever set. Customers must be served by `pnpm start` |
| Reuse a `.next` folder that `next dev` has touched | `next dev` overwrites it, so `next start` then serves dev chunks (`react-dom-client_development`, `next-devtools`, `[turbopack]_browser_dev_hmr-client`) under `/_next/static/…`. `/_next/hmr` 404s, hydration dies silently. Delete `.next` and rebuild |
| Assume a fresh browser proves the homepage is safe | The "Continue as {name}" shortcut only appeared when a 30-day staff cookie already existed. Test **with and without** the cookie |
| Put `overflow-x: hidden` on **both** `html` and `body` | The body becomes a second scroll container (`overflow-y` computes to `auto`). On real devices the page then **refuses to scroll at all** — mouse wheel and touch swipe move 0 px while taps still work. Reproduced 2026-10-17: swipe 0 px with the old rule vs 797 px without. Clip sideways bleed with `overflow-x: clip` on `body` only (globals.css). `clip` creates no scroll container; old browsers that lack `clip` just fall back to `visible` |
| Render a `Modal` inside an ancestor with `backdrop-blur`/`filter`/`transform` | `position: fixed` is captured by that ancestor as its containing block. The sticky guest header uses `backdrop-blur`, so the guest-name modal came out anchored to the header's 64 px box — 179 px of the dialog rendered **above** the screen, its close button unreachable, and the body scroll lock (`overflow: hidden`) stayed on: the page could not be scrolled and the guest could not escape. `components/modal.tsx` now portals to `document.body` |

### Fixed issues worth remembering

- **`pnpm dev` failed with `ERR_PNPM_IGNORED_BUILDS` (core-js).**
  Cause: `pnpm-workspace.yaml` had a **placeholder string** instead of a boolean:
  `core-js: set this to true or false`.
  Fix: set it to a real boolean (`core-js: false`). pnpm 11 requires
  `allowBuilds` values to be `true`/`false`. Keep them booleans.
- **False "tables exist" result.** `supabase-js` with `head: true` + `count:'exact'`
  **silently swallows 404s**, so a missing table looked fine. Always use a real
  `GET` for existence checks — that's why `scripts/db-check.mjs` does.
- **PowerShell + `Invoke-WebRequest` cannot reliably send a `Cookie` header** to
  localhost. It silently produced the login page instead of the protected page.
  Use **Node `fetch`** for authenticated smoke tests (that's how F13 was verified).
- **Staff sign-in looped forever on a real phone ("PIN baar baar maang raha").**
  Two independent causes: (1) both cookies were written with
  `secure: process.env.NODE_ENV === "production"` — over LAN **HTTP** the browser
  rejects the cookie, so every *successful* PIN went straight back to `/login`;
  (2) the login POST relied on the `useActionState` bound-action encoding, which is
  fragile with no JS. Fixed in `lib/auth.ts` (origin-aware `secureCookies()`) and
  by moving sign-in/sign-out to plain form POSTs that hit
  `app/api/login/route.ts` / `app/api/logout/route.ts`.
- **"It just gets stuck on Setting up Table 1…" (2026-10-15).**
  Cause: port 3000 was being served by **`next dev`**, whose stale dev output
  loaded in the browser but **never hydrated** — no JS error, no failed request,
  22 chunks fetched, `pendingResources: []`, yet `window.next === "undefined"`
  and no `__react*` keys on the DOM. The `useEffect` that calls `joinTableAction`
  therefore never ran, so the spinner was permanent. Fix: kill the dev server,
  delete `.next`, `pnpm build`, `pnpm start -H 0.0.0.0 -p 3000`. Also hardened
  `components/customer-app.tsx`: the join is now wrapped in `try/catch` with a
  20 s `Promise.race` timeout, and **Try again** re-runs the join (it used to call
  `router.refresh()`, which could not re-trigger the effect and left the user
  stranded on the error card).

- **"Scroll hi nahi hota — laptop aur phone dono par; taps chalte hain" (2026-10-17).**
  Two independent causes, both reproduced with a real headless Chromium
  (real mouse-wheel + `Input.dispatchTouchEvent` finger swipes, not
  `synthesizeScrollGesture`, which does not work in this harness at all):
  1. **CSS trap in `app/globals.css`.** The old rule
     `html, body { max-width: 100vw; overflow-x: hidden; }` made the body a
     second scroll container. On the real app DOM a finger swipe scrolled
     **0 px** with the old rule injected vs **797 px** with the new rule
     (`overflow-x: clip` on body only, no `max-width: 100vw`).
     `overflow-x: hidden` on `html` **alone** is harmless (885 px) — the body
     half is what kills it.
  2. **Modal inside the `backdrop-blur` header.** `components/customer-app.tsx`
     renders `GuestName` (and its `Modal`) inside the sticky
     `backdrop-blur` header. `backdrop-filter` creates a containing block, so
     the modal's `fixed inset-0` resolved to the **header's 64 px box**, the
     dialog rendered at `top: -179` (mostly above the screen), the close button
     was unreachable, and the modal's body scroll lock stayed on. Measured:
     wrapper box 64 px before the fix → **915 px (full viewport)** after
     portalling `Modal` to `document.body`. After the fix: guest modal opens,
     the X closes it, the body lock restores to "(none)", and a swipe scrolls
     866 px.
  Fix: `app/globals.css` (clip, no html/body overflow pair) +
  `components/modal.tsx` (portal + mounted guard). Note: the modal itself is
  correct — while a sheet is open the body lock is *expected*; the trap was
  that the sheet could not be seen or closed.

- **"Admin bottom nav tap par der se react karta hai" (2026-10-18).**
  Three stacked causes, all fixed the same day:
  1. **No instant feedback.** Staff pages are `force-dynamic` server components
     (up to 3 Supabase queries per navigation) and `usePathname()` flips only
     after the RSC payload lands, so the tap highlight moved ~0.5–1.5 s late.
     Fix: `components/staff-nav.tsx` keeps an **optimistic** `tapped` state set
     in `onClick` (cleared when the real pathname catches up, or after 4 s),
     so the highlight lands the same frame the finger lifts. Measured:
     `data-active` flips in **10 ms**, route swap visible at **46 ms**
     (previously: after the DB round trip).
  2. **Nothing to show while the segment streams.** Without `loading.tsx`,
     dynamic routes are not prefetched at all and the old screen froze.
     Fix: `app/{admin,kitchen,waiter,owner}/loading.tsx` +
     `components/staff-skeleton.tsx` (brand-band shimmer header, stat/panel
     placeholders, and the **real `StaffNav`** so the bar never disappears).
     `prefetch` then caches the loading boundary (verified: skeleton seen
     mid-navigation).
  3. **Legacy touch delay.** `touch-action: manipulation` is now applied to
     `button, a, [role="button"]` in `globals.css`, disabling the
     double-tap-zoom pause that makes taps feel ~300 ms late.
  Regression guards re-run after the UI pass: guest swipe **718 px**, guest
  modal full-viewport (915 px) with lock restore, **0 page errors**.

- **PIN keypad `⌫` rendered as a tofu box (2026-10-18).** Poppins does not ship
  U+232B, so the backspace key showed a broken-glyph rectangle. Replaced with a
  drawn `IconBackspace` SVG in `components/icons.tsx`; `KeyBtn` now forwards
  extra button props (e.g. `aria-label="Backspace"`).

- **"Review bar nav ke peeche chhup gayi" (2026-10-18).** The redesigned guest
  bottom nav grew taller (icon chip + pill layout ≈ 5 rem + safe-area), but the
  floating cart bar still used the old `bottom-16` (64 px) offset — on the
  user's phone the "Review" button was half hidden behind the nav. Fix: the bar
  is now pinned at `bottom-[calc(5.5rem+env(safe-area-inset-bottom))]`, i.e.
  nav height + margin at every inset. Verified: bar bottom 827 px vs nav top
  832 px (5 px clear) at 412×915. **Rule: after any change to fixed bottom
  chrome (nav, safe-bottom, cart bar), re-measure the pair together.**

- **"Order is not being placed — it just says sent for approval" (mirage,
  2026-10-18).** A user of the app read the counter-approval step as an error.
  It is the designed flow (admin approval before tickets). Reproduced
  end-to-end headless with real taps: guest adds 3 items → Review sheet →
  "Send order for approval" → order #1006 `pending` with the amber
  "Waiting for counter approval…" banner → cashier `/admin` shows
  "Awaiting approval 1" → **Approve & send** → order → `approved`,
  kitchen ticket `approved`, guest's Orders tab shows the green
  Approved→Preparing→Ready→Served tracker. The Review sheet itself also states
  the rule, and the pending banner now adds a one-line explainer. **Do not
  reinterpret guest confusion here as a submission bug** — verify with the
  counter first. Test session (order #1006 + bill chain) was fully deleted
  afterwards; **0 open sessions** remain.

- **Design refresh (2026-10-18, "flat/boring UI" request).** Central levers only
  — the component structure is untouched: `app/globals.css` adds warm elevation
  shadow tokens (`shadow-card/lift/pop/sheet`), the `.brand-band` gradient
  identity surface (dark end ≥ #7f2a0d so white small text keeps ≥4.5:1), the
  `.brand-cta` gradient, `.frost` frosted bottom bars, a subtle canvas wash,
  balanced headings, and `prefers-reduced-motion` protection;
  `components/ui.tsx` primitives upgraded (gradient primary Button, dotted
  Badge, bolder Stat/EmptyState/Input focus ring). Every staff/customer header
  now uses `.brand-band`; landing and login got a monogram hero with the green
  Shudh mark. **Guard kept**: `modal.tsx` still portals to `document.body` —
  do not re-nest it under any `backdrop-blur` ancestor; `.frost` bars contain
  no fixed children.

### Environment quirks

- PGlite (used to verify the SQL) lacks `pgcrypto`; the harness strips only
  `create extension if not exists pgcrypto;`. Supabase ships `pgcrypto`, and
  `gen_random_uuid()` is core PG13+, so the statement is harmless on Supabase.
- Windows firewall may prompt on first LAN access — allow **Private** networks so
  phones can reach the dev server.

---

## 14. Verification status

**What has actually been proven** `[VERIFIED]`

- Migration executed against real Postgres (PGlite): **24/24 checks pass** —
  19 tables, RLS on all, seed counts, bcrypt hash validity, re-runnable,
  `one_live_session_per_table` blocks a 2nd session and allows a new session after
  close, generated column `24000×3=72000`, **no tax/GST/VAT column**, 1 ticket per
  order, negative money rejected, zero/unknown-method payment rejected, FK
  enforcement, `order_no` auto-increment (1001→1002), `updated_at` trigger fires.
- **Supabase is live**: `pnpm db:check` → all 19 tables present, counts
  **staff 6, menu_categories 9, menu_items 51, dining_tables 10**.
- `npx tsc --noEmit` → clean.
- `pnpm build` → succeeds; all 13 app routes emitted.
- Runtime smoke (`pnpm start`): `/` 200, `/login` 200, `/t/[qr]` 200 (invalid-token
  card), `/admin` 307 → login.
- Runtime smoke (`pnpm dev`, port 3000): `/` 200, `/login` 200,
  `/t/t01-d1729bcb98` 200, `/admin` 307.
- **F13 verified** with a minted staff JWT: `/admin/qr` returned 200 with
  **15 `<svg>` (10 QR codes + chrome), 10 table labels**, the loopback warning, and
  the correct guest token (`t01-d1729bcb98`) encoded in the QR.

- **2026-10-14 simplification pass** `[VERIFIED]`: `npx tsc --noEmit` → exit 0;
  `pnpm build` → exit 0 and the route table no longer lists `/admin/shift`;
  `/admin/shift` → **404**; with minted staff cookies `/admin`, `/admin/tables`,
  `/admin/menu`, `/admin/qr`, `/kitchen`, `/waiter`, `/owner` → **200**; `/owner`
  HTML contains Net sales / Collected / Outstanding / Staff activity / Audit trail
  and **none** of "Recent shifts" / "Refunds" / "Drawer"; a temporary live session
  rendered `/admin/bill/<sessionId>` → **200** with the discount form and receipt
  and **no** refund UI (the test session was deleted afterwards).
- **2026-10-14 mobile-login fix** `[VERIFIED]` against `pnpm start` in
  **production** over plain HTTP (port 3001): `/login` serves a real
  `<form action="/api/login" method="post">` with a named `pin` input and the
  native `pattern="[0-9]{6}"` guard; wrong PIN → `303 → /login?error=1` and **no**
  cookie; PIN `000002` → `303 → /admin` with
  `Set-Cookie: mos_staff=…; HttpOnly; SameSite=lax` and **no `Secure`**; that
  cookie then returned **200** for `/admin`, `/admin/tables`, `/kitchen`,
  `/waiter` and `/owner`; `/login?error=1` renders "Invalid PIN"; `/api/logout`
  clears the cookie. A POST carrying `Host: 192.168.29.14:3001` (simulating a
  phone) redirected to **`http://192.168.29.14:3001/…`**, not `0.0.0.0`.

- **2026-10-15 stuck-table + PIN-every-time pass** `[VERIFIED]` against a clean
  **production** build (`Remove-Item .next` → `pnpm build` → `pnpm start -H 0.0.0.0 -p 3000`)
  driven by a **real headless Chromium** (patchright), not `fetch`:
  - Served chunks are production (`8` scripts, none matching
    `development|devtools|hmr-client`); **0 console errors** (the old `_next/hmr`
    websocket spam is gone).
  - `/` in a **fresh** browser: **no** "Continue as", shows "Staff sign in",
    **zero cookies**.
  - `/t/t01-d1729bcb98` in a fresh browser: leaves "Setting up…" by itself, sets
    `mos_guest`, and renders the real menu ("Guest UHKH ✎", 9 categories,
    "Tomato Soup ₹110"). `stuck: false`.
  - `/login`: PIN form only; **no** demo PINs printed on screen.
  - Submit PIN `000002` → lands on `/admin`; `mos_staff` is `HttpOnly` with
    `expires: -1` (a **session** cookie, not persistent).
  - Revisit `/login` **while signed in** → still the PIN form, **no** redirect.
  - Revisit `/` **while signed in** → still "Staff sign in", no shortcut.
  - `npx tsc --noEmit` → exit 0; `pnpm build` → exit 0.

- **2026-10-17 scroll + modal pass** `[VERIFIED]` against a fresh production
  build (`pnpm build` → `pnpm start -H 0.0.0.0 -p 3000`) with real input events
  (CDP mouse wheel + raw touch sequences; `synthesizeScrollGesture` does nothing
  in this harness — do not trust it):
  - Computed styles on `/t/[qr]`: `html overflow: visible/visible`,
    `body overflow: clip/visible` — the body is **no longer** a scroll container.
  - Fresh mobile context (412×915, `hasTouch`): finger swipe on the menu scrolls
    **797 px**; four more swipes reach 3029 px with the Beverages tail visible;
    no horizontal overflow (`scrollWidth == clientWidth`).
  - Desktop (1280×720): mouse wheel scrolls the menu **600 px**.
  - Fixed guest/staff navs stay pinned during scroll and remain tappable.
  - Guest-name modal (previously anchored to the 64 px backdrop-blur header):
    wrapper now spans the full viewport (915 px), dialog at
    `top: 672 → bottom: 915` (a real bottom sheet), the X is reachable and
    closes it, after which `document.body` inline style is back to "(none)" and
    a swipe scrolls 866 px.
  - Review sheet: opens with the body lock on (expected), its own content fits,
    the X closes and the lock restores.
  - All staff screens measured post-fix: `/admin` (790 > 720, scrolls 70),
    `/owner` (4030 px, wheel 600), `/admin/tables`, `/kitchen`, `/waiter`
    (short pages, nothing to scroll — expected, content is not cut off).
  - **0 console page errors** throughout.
  - Test residue cleaned afterwards: 1 leftover active session + its 1 service
    request deleted; **0 open sessions** remain.

- **2026-10-18 nav-lag + design refresh pass** `[VERIFIED]` against a fresh
  production build (`tsc` 0, `pnpm build` 0, `pnpm start -H 0.0.0.0 -p 3000`),
  real headless Chromium:
  - **Nav responsiveness**: tapping "Tables" in the admin bottom nav →
    optimistic `data-active` highlight in **10 ms**, route swap at **46 ms**,
    final path `/admin/tables`; skeleton boundary (`main[aria-busy]`) observed
    mid-navigation.
  - **Design/GitHub baseline pushed**: `main → origin/main` at
    `github.com/admin084646-spec/46th` (commit `2924f1d`, no secrets —
    `.env.local` excluded by `.gitignore`).
  - **Regression guards after the redesign**: guest finger swipe **718 px**;
    guest-name modal wrapper full viewport (915 px, `top: 0`) with body lock
    restored to "(none)" on close; landing `.brand-band` computes
    `linear-gradient`; login backspace renders the SVG icon
    (`stillTofuGlyph: false`); screenshots taken of landing, login, guest menu,
    admin, admin/menu, kitchen, owner; **0 console page errors** on desktop and
    mobile contexts.
  - Screenshots (for reference): `%TEMP%\opencode\ui-*.png`.

**What has NOT been verified** — do not claim otherwise

- ❌ **No automated tests exist.** There is no unit/integration/e2e suite.
- ❌ **Not run on a real phone.** The QR → phone-camera → guest ordering path was
  never exercised on real hardware. (Headless Chromium has now covered the guest
  join, the staff PIN flow and the landing page — see the 2026-10-15 entry above —
  but not a physical camera scan.)
- ❌ **The full happy path was not executed end-to-end with real data**
  (approve → kitchen → waiter → pay → clear → owner report). It is implemented and
  builds, but no live click-through is recorded.

---

## 15. Current state

| Area | State |
|---|---|
| Code | **Complete** for all five workspaces; `tsc --noEmit` exit 0 and `pnpm build` exit 0 |
| Database | **Live and seeded** (19 tables, 6/9/51/10); 3 of them are now unused — see §6 |
| Dev server | Works after the `pnpm-workspace.yaml` fix. **But the restaurant must be served by `pnpm start -H 0.0.0.0 -p 3000`** — a dev build left in `.next` broke every client screen (§13) |
| Simplified | **2026-10-14** — shifts, attendance (in/out) and refunds removed at the owner's request; owner reports keep **daily sales** |
| Security | **2026-10-15** — staff cookie is now a **session** cookie (24 h JWT, no `maxAge`); `/` no longer offers a PIN-free "Continue as {name}" shortcut; `/login` never auto-redirects a signed-in user; the demo PIN list was removed from the login screen |
| Scrolling + modals | **2026-10-17** — `app/globals.css` no longer puts `overflow-x: hidden` on html+body (body becomes a dead scroll container); `components/modal.tsx` portals to `document.body` so no `backdrop-blur` ancestor hijacks `position: fixed`. Both reproduced and verified — see §13/§14 |
| Bottom-nav responsiveness | **2026-10-18** — optimistic tap highlight (10 ms) + per-workspace `loading.tsx` skeletons + `touch-action: manipulation`; verified in headless Chromium |
| UI design | **2026-10-18** — brand gradient bands on all headers, frosted bottom bars with active pills, warm elevation shadows, refreshed landing/login heroes with the green Shudh mark; structure/tokens preserved, modal portal kept |
| Version control | **2026-10-18** — local repo recreated inside the project (the drive `C:\` was previously a zero-commit repo); pushed to `github.com/admin084646-spec/46th` `main` (`2924f1d`), `.env.local` never committed |
| Blocker | **None** — mobile login fixed and verified; guest join verified in a real browser |
| Outstanding risk | Zero automated tests; still no real-device (phone camera) verification |

**Guest entry points** (dev, from `dining_tables.qr_token`)

| Table | Path |
|---|---|
| 1 | `/t/t01-d1729bcb98` |
| 2 | `/t/t02-ba4fb38613` |
| 3 | `/t/t03-d8e02457bc` |
| 4 | `/t/t04-2f163f501b` |
| 5 | `/t/t05-02e5a47925` |
| 6 | `/t/t06-85b31f9072` |
| 7 | `/t/t07-81ae8c1197` |
| 8 | `/t/t08-c83cb90533` |
| 9 | `/t/t09-2dd4bfe808` |
| 10 | `/t/t10-d793f5b5ea` |

> QR codes must be printed from **`http://192.168.29.14:3000/admin/qr`** (the LAN
> address), never from `localhost`, or phones cannot open them. The page warns
> about this automatically when opened on a loopback origin.

---

## 16. Next work

### 16.1 Mobile staff login — FIXED 2026-10-14

Was: sign-in looped forever on a phone ("PIN baar baar"). Two causes, both fixed
and verified in production over HTTP (§14):

1. **Cookie dropped over HTTP.** `lib/auth.ts` marked both cookies
   `secure: NODE_ENV === "production"`. On the LAN the origin is
   `http://192.168.x.x:3000`, so the browser rejected the cookie. Now
   `secureCookies()` marks Secure only when the request really is HTTPS
   (`x-forwarded-proto` / `Origin`), so it works on the LAN **and** stays Secure
   behind a real TLS domain.
2. **The login POST depended on the client bundle.** Sign-in and sign-out are now
   plain HTML form POSTs to `app/api/login/route.ts` and
   `app/api/logout/route.ts` (303 + `Set-Cookie`), with errors surfaced via
   `?error=1`. The keypad and dots remain a JS nicety; the form works without JS.

**Still to confirm on hardware:** that the phone itself renders the bundle — run
`pnpm build && pnpm start -H 0.0.0.0 -p 3000` first (production ships downlevelled
JS). If taps are still dead there, it is the device/browser, not the login flow.

**Gotcha:** a *running* `next dev` does not reliably notice added/removed routes —
restart it after such changes.

### 16.1b "Stuck on Setting up Table 1…" + PIN-every-time — FIXED 2026-10-15

- **Stuck table.** Port 3000 was being served by `next dev`, and its output
  **never hydrated in a real browser** (no error — see §13 and §14). Customers were
  served a dev build that could not run. The restaurant now runs
  `pnpm build` + `pnpm start -H 0.0.0.0 -p 3000`; the guest join was verified in a
  real headless browser.
- **Homepage shortcut.** `/` used to show **Continue as {name}** whenever a valid
  30-day staff cookie existed — no PIN. Removed. `/` always shows **Staff sign in**.
- **`/login` auto-redirect.** A signed-in staff member hitting `/login` was bounced
  straight into their workspace. Removed — the PIN pad always renders.
- **Session length.** `mos_staff` went from a 30-day persistent cookie to a
  **session cookie** (no `maxAge`), with a 24 h JWT. Closing the browser asks for
  the PIN again.
- **Printed PINs.** `/login` used to list *all* staff PINs ("Demo PINs — Owner
  000001 · Cashier 000002 …"). Removed — anyone at the counter could read them.
  The PIN list now lives only in this file (§17.3) and `README.md`.
- **Join hardening.** `components/customer-app.tsx` can no longer spin forever:
  `try/catch` + a 20 s timeout, and **Try again** actually re-runs the join.

### 16.2 Remaining work

Nothing here is required for the app to function.

1. **End-to-end live pass**: login `000002` → submit an order as a
   guest → approve at `/admin` → move the ticket in `/kitchen` → serve in
   `/waiter` → bill/pay/clear at `/admin/bill/<sessionId>` → confirm `/owner`.
   Record the result in §14 when done.
2. **Real-device QR test**: same Wi-Fi, print from the LAN address, scan with a
   phone, confirm the two-phones-one-bill rule (I2).
3. **Browser console pass** on `customer-app` and `billing-screen` (headless is
   fine) — these are the two large client components and the likeliest source of
   runtime-only issues.
4. **Add the smallest useful regression tests** for the invariants in §7 — the
   project currently has none, which is its biggest structural risk.
5. **Housekeeping**: remove the unused `jspdf` dependency; optionally add
   `NEXT_PUBLIC_APP_URL` so printed QR codes don't depend on the LAN address.

### If you change something, do this before finishing

- Keep the **change envelope** tight; do not refactor or upgrade dependencies
  while fixing a feature (see §13 for what has bitten this project before).
- Re-check the **"no edge cutting"** rule on any UI change you touch.
- Update the **Feature Registry** (§11), **Verification status** (§14), and
  **Current state** (§15) in this file.
- Never write a status as done without evidence.

---

## 17. Complete screen & button reference

Every screen, every button, what it does and when to use it. `[VERIFIED]` — each
screen's source file was read line by line to build this list.

**How to read this**

- **Bold = the exact text shown on screen.** If you change a button's wording in
  the code, update this section.
- Every button calls a **server action**, and the server **re-checks permission**
  (§9). Hiding a button is never the security boundary.
- Anything that touches money or state is written to `audit_log` with
  who / when / why (invariant I11, §7).
- Colour language (defined in `components/ui.tsx`):

| Colour | Meaning |
|---|---|
| brand (theme colour) | the primary action, or the active tab |
| green | success · paid · ready · done |
| amber | waiting · attention · money still due · something is late |
| red | danger · rejected · cancelled · overdue |
| blue | in progress · informational |
| neutral / grey | idle · closed · voided |

**Button variants** (visual weight, `components/ui.tsx`)

| Variant | Look | Used for |
|---|---|---|
| `primary` | filled brand colour | the main action on a screen |
| `success` | filled green | approving, verifying, serving, clearing |
| `danger` | filled red | rejecting, force-clearing |
| `outline` | bordered, white | secondary / neutral actions |
| `subtle` | light grey fill | tertiary actions, quick picks |
| `ghost` | text only | inline, low-emphasis |

**Universal behaviour:** `Modal` (§5) is a bottom-sheet on phones and a centred
dialog on desktop. It closes on **Esc**, on tapping the dark backdrop, or on the
**✕** button. Every modal has a title bar.

---

### 17.1 Bottom navigation (staff)

Appears at the bottom of every staff screen (`components/staff-nav.tsx`).

| Tab | Route | Shown for |
|---|---|---|
| **Counter** | `/admin` | admin, owner |
| **Tables** | `/admin/tables` | admin, owner |
| **Menu** | `/admin/menu` | admin, owner |
| **Floor** | `/waiter` | waiter |
| **Kitchen** | `/kitchen` | kitchen |
| **Reports** | `/owner` | owner |

**Sign out** — door icon, top-right of every staff screen
(`components/staff-header.tsx`). It is a **plain form POST to `/api/logout`** (no
JS needed), which clears the `mos_staff` cookie and 303-redirects to `/login`.
There is no confirm dialog.

---

### 17.2 Landing page — `/` (`app/page.tsx`)

The screen anyone sees if they open the site root (e.g. a guest who typed the
address instead of scanning the QR).

| Element | What it does | When to use |
|---|---|---|
| **Staff sign in** | goes to `/login` | any staff member starting work |
| Database-not-configured card | red card shown only if `.env.local` keys are missing | a setup problem — fix `.env.local`, then rerun the SQL |

> This page intentionally has **no** customer ordering buttons — a guest must use
> their table's QR link so the order is tied to the right table.
> It also deliberately **never** shortcuts an existing session: since 2026-10-15
> there is no "Continue as {name}" button, so a PIN is required every time.

---

### 17.3 Staff sign in — `/login` (`app/login/login-form.tsx`)

| Element | What it does |
|---|---|
| 6 PIN dots | fill as you type the 6-digit PIN |
| **Type PIN here** field | native input (numeric keyboard on phones) with `pattern="[0-9]{6}"` + `required` enforced by the browser. **Works with zero client-side JS** — the form is a plain POST to `/api/login`. The keypad + dots are only an enhancement on top |
| **1**–**9**, **0** | append that digit (stops at 6) |
| **Clear** | empties the PIN box |
| **⌫** | deletes the last digit |
| **Sign in** | submits the form to `/api/login`. The server sets the cookie and 303-redirects; a wrong PIN comes back as `/login?error=1` |

Wrong PIN → red banner ("Invalid PIN. Please try again."). On success you land on
your role's home: owner → `/owner`, admin → `/admin`, waiter → `/waiter`,
kitchen → `/kitchen`. The cookie is marked `Secure` **only** over HTTPS, so sign-in
also works on the LAN's plain HTTP (`http://192.168.x.x:3000`).

The page **always** shows the PIN pad: since 2026-10-15 it does not bounce an
already signed-in staff member into their workspace, and it no longer prints the
PINs on screen.

**PINs (internal — never shown in the UI):** Owner `000001` · Cashier `000002` ·
Waiters `000003` / `000004` · Kitchen `000005` / `000006`.

---

### 17.4 Customer workspace — `/t/[qr]` (`components/customer-app.tsx`)

Opened by scanning the table QR. Runs in the guest's own phone browser. **No app,
no account.** The guest is bound to the table by an anonymous `mos_guest` cookie.

**On first open** the app silently calls `joinTableAction` — you may briefly see a
spinner card ("Setting up Table N…"). If joining fails you get a card with the
reason and a **Try again** button.

#### Header

| Element | What it does | When to use |
|---|---|---|
| Table name + restaurant name | tells the guest which table they are on | — |
| **{Guest name} ✎** | opens the **Your name** sheet | so table-mates and staff know who ordered what |

**Your name** sheet: a text box (max 40 chars) + **Save** (disabled when empty).
Saving updates the guest label used on orders.

#### Bottom tabs

| Tab | Purpose |
|---|---|
| **Menu** | browse and add dishes |
| **Orders** | track what has been ordered and its progress |
| **Bill** | see the table's running bill |
| **Help** | call a waiter, request water, ask for the bill |

#### Menu tab

| Element | What it does | When to use |
|---|---|---|
| Category chips (Starters, Beverages…) | jump to that section | fast navigation on a long menu |
| **Add** | puts one of that dish in the cart | first time picking a dish |
| **−** / **+** | decrease / increase quantity (appears once qty > 0) | changing the count |
| **Sold out** badge | dish is unavailable; no **Add** button is shown | — |

A dish that the cashier marks unavailable shows as **Sold out** everywhere and
cannot be added. Availability updates live.

#### Cart bar and the review sheet

When the cart has items, a bar appears above the tabs: **"{n} items · ₹amount"
→ "Review +"**. Tapping it opens the **Review your order** sheet:

| Element | What it does | When to use |
|---|---|---|
| **−** / **+** per line | change quantity; removing the last one drops the line | fixing what you picked |
| Note box per line ("Add a note (e.g. less spicy)") | attaches an instruction to that one dish | dishes with special requests |
| "Note for the kitchen" textarea | one overall note for the whole order | general instructions |
| **Total** | live sum | — |
| **Send order for approval** | submits the whole cart. Shows "Sending…" while working | when ready |

> **The order does NOT go to the kitchen yet.** It goes to the counter for
> approval (invariant I4). The sheet says so on screen. On success the app jumps
> to the **Orders** tab and toasts *"Order sent to the counter for approval"*.

#### Orders tab

Each round is a card: **Round N**, a **You** badge (your own order) or the
other guest's name, the time, and the item lines.

| Status shown | Meaning |
|---|---|
| amber **"Waiting for counter approval…"** | submitted, not yet approved |
| 4-step tracker **Approved · Preparing · Ready · Served** | green fills as the kitchen and waiter advance it |
| red **"Not approved — {reason}"** | cashier rejected it before approval |
| red **"Cancelled — {reason}"** | cashier cancelled it after approval |

The guest can only **watch** — there is no edit or cancel button (invariant I3).
Anything they want changed, they ask staff.

If nothing has been ordered the tab shows **"No orders yet"**.

#### Bill tab

Shows the whole table's bill (everyone at the table shares it — invariant I2).

| Element | What it does | When to use |
|---|---|---|
| Item lines | every **approved** item on the table, with qty and amount | checking what is on the bill |
| **Subtotal / Discount / Total / Paid / Due** | the live figures | — |
| Status badge: **Unpaid / Partially paid / Fully paid** | how settled the bill is | — |
| **Payments recorded** | each payment with its method; "(verifying)" marks a UPI/card payment awaiting staff verification | — |
| **Request the bill** | sends a "bill requested" alert to waiter and counter | when the table is ready to pay |

A note under it says payment is settled at the counter and the table stays
reserved until staff clear it. **The guest never pays in the app** (§8).

#### Help tab

| Element | What it does | Sends request type |
|---|---|---|
| **Call a waiter** | alerts the floor | `waiter` |
| **Water / cutlery** | asks for water or cutlery | `water` |
| **Request bill** | same as the Bill tab button | `bill` |
| **Assistance** | general "please come to the table" | `waiter` + note |
| **Custom request** box + **Send request** | free-text message to staff (button disabled when empty) | `custom` |

Each successful request toasts *"Request sent — a waiter will be with you"* and
appears instantly on the waiter and counter screens with a "· 3m ago" timer that
turns **red after 5 minutes**.

---

### 17.5 Counter — `/admin` (`app/admin/page.tsx` + `components/approvals.tsx`, `service-requests.tsx`)

The cashier's home. Four live stat tiles: **Awaiting approval · Occupied tables ·
Open requests · Outstanding**.

#### Approvals section

| Element | What it does | When to use |
|---|---|---|
| **Approve & send** | creates the kitchen ticket and pushes the order to the KDS | order looks correct |
| **Reject** | opens the Reject sheet | item sold out / wrong table / duplicate |

The card shows table, **Round N**, guest name, order number, item lines, any
per-line notes, and the order's special note in amber. A timer shows
`4:12 · 4m` and turns **red once a guest has waited 4+ minutes**.

**Reject order** sheet: a textarea ("e.g. item sold out, please re-order") and a
**Reject order** button (red). The guest sees whatever you type as the reason —
so always type something useful.

#### Service requests section

| Element | What it does | When to use |
|---|---|---|
| **Acknowledge** | marks the request as seen (only while it is `pending`) | you're on your way |
| **Done** | closes the request | it has been handled |

Each request shows the table, the type (**Call waiter · Bill requested ·
Water / cutlery · Custom**), any note, and how long it has been waiting (red at
5+ minutes).

#### Live tables section

A grid of every **occupied** table. Each card shows the bill total, and either
green **"Paid · clear me"** or amber **"Due ₹X"**. **Tap a card to open that
table's bill workspace** (§17.8). The section header has a **Tables** button that
opens the full table board.

---

### 17.6 Tables — `/admin/tables` (`components/table-board.tsx`)

A grid of **all 10 tables**, occupied or free.

| Element | What it does | When to use |
|---|---|---|
| **Print table QR codes** | opens the printable QR sheet (§17.7) | one-time setup, or replacing a damaged sticker |
| A free table card (**Free** badge) | not tappable | — |
| An occupied table card | shows "Since 7:42 PM", the bill total, and **Paid · ready to clear** / **Due ₹X** / **Seated**; **tap to open the bill workspace** | collecting payment / clearing |
| amber **"{n} new"** chip | that table has orders waiting for approval | catch pending work |
| blue **"help"** chip | that table has an open guest request | attend quickly |
| "{n} tickets in kitchen" | active kitchen tickets for that table | check cooking progress |

---

### 17.7 Table QR codes — `/admin/qr` (`app/admin/qr/page.tsx`)

The sheet you print and stick on tables. Each of the 10 cards has the table name,
a **QR code**, and the guest URL underneath.

| Element | What it does | When to use |
|---|---|---|
| **← Back to tables** | returns to the table board | — |
| **Print these codes** | opens the browser print dialog (nav, header and buttons are hidden from the printout; cards avoid page breaks) | printing the stickers |

⚠️ **Read this before printing.** The QR encodes whatever host you are browsing
on. If you open this page at `localhost`, the codes point at `localhost` and **no
phone can open them**. Open the page from the laptop's LAN address instead
(`http://192.168.29.14:3000/admin/qr`) so the codes contain the Wi-Fi address. The
page detects this and shows an amber warning with the `ipconfig` instruction.
In production, set `NEXT_PUBLIC_APP_URL` and the warning disappears (§4).

---

### 17.8 Bill workspace — `/admin/bill/[sessionId]` (`components/billing-screen.tsx`)

The biggest staff screen. Everything for one table's money.

#### Summary card

Shows the table label, the bill total, "Since {time} · Bill #{n}", the bill and
session status badges, and three mini tiles: **Subtotal · Discount · Due**.

| Element | What it does | When to use |
|---|---|---|
| **Print / save receipt** | opens the receipt page (§17.9) | giving the guest a bill |

#### Orders on this table

One card per round, with its item lines (and per-line notes) and total.

| Element | Shown when | What it does |
|---|---|---|
| **Approve** | order is `pending` | approves it and creates the kitchen ticket |
| **Reject** | order is `pending` | rejects it; reason is fixed as "Rejected at counter" |
| **Correct** | order is `approved` | opens the **Correct round N** sheet |
| **Cancel** | order is `approved` | asks for a reason in a prompt, then cancels and audits it |

**Correct round N** sheet — for fixing an approved order without cancelling:

| Element | What it does |
|---|---|
| **−** / **+** per line | change quantities (0 removes the line) |
| **Add an item** dropdown | adds one dish the guest asked for verbally (available items only) |
| **Reason (required)** | why the correction was made |
| **Save correction** | replaces the order lines; disabled until a reason is typed |

> Correcting replaces the lines on the same order, so the kitchen sees the
> corrected ticket. Everything here is audited (I11).

#### Payments

Three mini tiles: **Verified · Pending · Due** (amber when non-zero).

Per payment row: amount, method badge (**CASH / UPI / CARD**), a status badge,
time, and reference if given.

| Element | Shown when | What it does |
|---|---|---|
| **Verify** | status is `pending` (i.e. UPI/card not yet confirmed) | marks the payment verified — **this is when it starts counting** (invariant I8) |
| **Void** | not already voided | asks for a reason, then voids the payment |

**Record a payment**:

| Element | What it does |
|---|---|
| Amount box | the amount; placeholder shows the outstanding due |
| Method dropdown | **Cash · UPI · Card** |
| **Ref (optional)** | UPI/card reference number |
| **Use full due** | fills the amount with the exact outstanding balance |
| **Add payment** | records it. Cash is verified immediately; **UPI/card are held as `pending`** until someone presses **Verify** |

#### Discount

| Element | What it does |
|---|---|
| Amount box | how much to take off |
| Reason box | why (required) |
| **Apply discount** | records it; disabled until both amount and reason are given |

The card shows the subtotal the discount applies to and the total already given.
The bill total is clamped at ₹0 minimum (`recomputeBill`, §12).

#### Split the bill

| Element | What it does |
|---|---|
| **By people** | switch to equal-split mode |
| **By items** | switch to item-split mode |
| **Clear** | removes existing splits (only shown when splits exist) |
| Number of people + **Split equally** | divides the total equally across N people (minimum 2) |
| **+ Person** | adds another person to the item split (max 8) |
| Person dropdown per item | assigns that line to a person |
| **Create item split** | builds the split from the assignments |
| Result list + **Total** | the split lines, always summing exactly to the bill total (invariant I9) |

#### Table clearance

| Element | Shown when | What it does |
|---|---|---|
| **Mark awaiting clearance** | bill fully paid and session is still `active` | flags the table as done but not yet freed |
| **Clear table** | bill fully paid | asks to confirm, then closes the session and frees the table (**manual only**, invariant I6) |
| **Force clear {table}** | bill is **not** fully paid | opens the force-clear sheet |

**Force clear** sheet: warns in amber that an unpaid table is being closed and the
owner will see it, requires a **Reason**, then a red **Force clear** button. Use
only for walkouts — it is audited and shows up in the owner's outstanding report.
If the session is already closed you just see "This table is already cleared."

---

### 17.9 Receipt — `/admin/bill/[sessionId]/receipt`

A clean printable receipt (HTML, not `jspdf`). Shows the business header from
`lib/business-info.ts`, table, bill number, date, session start, the item table
(item / qty / rate / amount), Subtotal, Discount, **Total**, Paid, **Balance
due**, the payment breakdown (with "(unverified)" against pending ones), any
splits, and a thank-you footer.

| Element | What it does |
|---|---|
| **← Back to bill** | returns to the bill workspace |
| **Print / Save as PDF** | opens the print dialog; everything except the receipt is hidden from the printout |

---

### 17.10 Kitchen display — `/kitchen` (`components/kitchen-board.tsx`)

Three columns: **New tickets · Preparing · Ready**. Each has a count badge. The
page refreshes every 6 seconds and on realtime pings.

| Element | Shown when | What it does |
|---|---|---|
| **Start preparing** | ticket is `approved` | moves it to Preparing |
| **Mark ready** | ticket is `preparing` | moves it to Ready and alerts the waiters |
| **Waiting for waiter** badge | ticket is `ready` | no action here — the waiter picks it up |
| **Print** / **Printed** | always | toggles the printed flag (a manual "I have the paper ticket" marker); it turns green when marked printed |

Each ticket shows the table, `#orderno`, the time, the age in minutes (the card
gets a red ring and the timer turns red at **12+ minutes**), item lines with a
bold quantity, and any per-line note in amber on the right.

---

### 17.11 Floor — `/waiter` (`components/waiter-board.tsx`)

#### Ready to serve

Lists tickets that are `ready` or `picked_up`.

| Element | Shown when | What it does |
|---|---|---|
| **Picked up** | ticket is `ready` | marks that the waiter has collected it from the pass |
| **Served** | always | marks it served; the guest's tracker shows all four steps green |

The timer is based on `ready_at` and turns **red at 5+ minutes** — that's food
sitting at the pass.

#### Guest requests

Identical to the counter's list (§17.5): **Acknowledge** then **Done**.

#### Add items for a table

For things a guest asks for verbally — **these skip approval and go straight to
the kitchen**.

| Element | What it does |
|---|---|
| **Table** dropdown | pick a seated table; shows "· due ₹X" so you can see an unpaid balance |
| **Search menu…** | filter the list by name |
| **−** / **+** | change quantities |
| Note for kitchen | optional instruction |
| Running total | item count and amount |
| **Send to kitchen** | creates the order plus a kitchen ticket immediately; disabled when empty |

If no tables are seated it shows "No seated tables right now." instead.

---

### 17.12 Menu availability — `/admin/menu` (`components/menu-availability.tsx`)

The menu grouped by category, each item with an **Available** (green) or **Sold
out** (red) badge.

| Element | What it does | When to use |
|---|---|---|
| **Mark sold out** | hides the item from guests (no Add button) and flags it | a dish ran out |
| **Mark available** | puts it back on the guest menu | it's back |

Guests see the change within seconds (realtime + polling), so this is safe to do
mid-service.

---

### 17.13 Owner reports — `/owner` (`components/owner-dashboard.tsx`, `report-range.tsx`)

Read-only. There are no action buttons here — only the date controls and links.

| Element | What it does |
|---|---|
| **Today** / **Last 7 days** / **Last 30 days** | quick range pills |
| **From** / **To** date pickers | custom range |
| **Apply** | reloads the report for the chosen range |

Sections, top to bottom:

| Section | What it shows |
|---|---|
| Stat tiles (row 1) | **Net sales · Collected · Outstanding · Bills** (with orders count) |
| Stat tiles (row 2) | **Gross · Discounts · Avg bill** |
| **Payment mix** | cash / UPI / card with percentages (verified collections only) |
| **Sales by hour** | bar chart; hover a bar for the exact amount |
| **Popular items** | top 10 by revenue, with qty and amount |
| **Outstanding bills** | unpaid / partial bills; **tap one to jump to that bill workspace** |
| **Staff activity** | table of approved / cancels / discounts / cleared per staff member — this is the accountability view |
| **Audit trail** | last 40 sensitive actions: action, actor, entity, reason, time |

The subtitle on the page says *"No GST — figures are your true net sales."* That
is deliberate (§8) — never add tax.

---

## 18. Session-start protocol (for the next agent)

```
1. Read this file (BRAIN.md) fully.
2. Read README.md only if the task is about user-facing setup.
3. Check the real state, do not assume:
     pnpm db:check          → are the tables still there?
     npx tsc --noEmit       → does it still typecheck?
4. Read the specific files for the task (§5 map + §11 registry).
5. Respect §7 invariants and §8 out-of-scope list. This is the whole point.
6. Make the smallest correct change.
7. Validate: typecheck → build → targeted runtime check (§3 commands).
8. Update §11, §14, §15 of this file with what you actually verified.
```

**One-line summary if you remember nothing else:**
*One table = one session = one bill. Prices come from the server, cash needs no
check, everything else does, the kitchen only sees approved orders, and a human
always clears the table.*
