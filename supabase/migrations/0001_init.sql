-- ============================================================================
--  Mittal's Shudh Shakahari Bhojanalaya — Restaurant Operating System
--  Schema + Seed data
--
--  HOW TO RUN:  Supabase dashboard -> SQL Editor -> New query -> paste ALL of
--               this -> Run.   Safe to re-run (it drops & recreates app tables).
--
--  Security model: the Next.js SERVER talks to Postgres with the service_role
--  key (bypasses RLS). The browser never reads tables directly. RLS is left
--  ENABLED with NO policies = default deny for anon/authenticated.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Clean slate (reverse dependency order)
-- ---------------------------------------------------------------------------
drop table if exists public.notifications       cascade;
drop table if exists public.audit_log            cascade;
drop table if exists public.refunds              cascade;
drop table if exists public.discounts            cascade;
drop table if exists public.payments             cascade;
drop table if exists public.bill_split_items     cascade;
drop table if exists public.bill_splits          cascade;
drop table if exists public.bills                cascade;
drop table if exists public.service_requests     cascade;
drop table if exists public.kitchen_tickets      cascade;
drop table if exists public.order_items          cascade;
drop table if exists public.orders               cascade;
drop table if exists public.table_sessions       cascade;
drop table if exists public.dining_tables        cascade;
drop table if exists public.menu_items           cascade;
drop table if exists public.menu_categories      cascade;
drop table if exists public.attendance           cascade;
drop table if exists public.shifts               cascade;
drop table if exists public.staff                cascade;

drop sequence if exists public.order_no_seq;
drop sequence if exists public.kot_no_seq;
drop sequence if exists public.bill_no_seq;

create sequence public.order_no_seq start 1001;
create sequence public.kot_no_seq   start 2001;
create sequence public.bill_no_seq  start 3001;

-- ---------------------------------------------------------------------------
-- 1. Staff, shifts, attendance
-- ---------------------------------------------------------------------------
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null check (role in ('owner','admin','waiter','kitchen')),
  pin_hash    text not null,
  active      boolean not null default true,
  perms       jsonb not null default '{}'::jsonb,   -- e.g. {"admin": true} to grant owner admin powers
  created_at  timestamptz not null default now()
);

create table public.shifts (
  id                   uuid primary key default gen_random_uuid(),
  opened_by            uuid not null references public.staff(id),
  opened_at            timestamptz not null default now(),
  closed_by            uuid references public.staff(id),
  closed_at            timestamptz,
  expected_cash_minor  integer not null default 0 check (expected_cash_minor >= 0),
  expected_upi_minor   integer not null default 0 check (expected_upi_minor >= 0),
  expected_card_minor  integer not null default 0 check (expected_card_minor >= 0),
  actual_cash_minor    integer not null default 0 check (actual_cash_minor >= 0),
  actual_upi_minor     integer not null default 0 check (actual_upi_minor >= 0),
  actual_card_minor    integer not null default 0 check (actual_card_minor >= 0),
  note                 text
);
create index shifts_open_idx on public.shifts (closed_at);

create table public.attendance (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.staff(id),
  clock_in   timestamptz not null default now(),
  clock_out  timestamptz,
  shift_id   uuid references public.shifts(id)
);
create index attendance_open_idx on public.attendance (staff_id, clock_out);

-- ---------------------------------------------------------------------------
-- 2. Menu
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  sort  integer not null default 0
);

create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.menu_categories(id),
  name          text not null,
  description   text,
  price_minor   integer not null check (price_minor >= 0),   -- paise
  is_available  boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);
create index menu_items_cat_idx on public.menu_items (category_id, sort);

-- ---------------------------------------------------------------------------
-- 3. Tables & sessions
-- ---------------------------------------------------------------------------
create table public.dining_tables (
  id        uuid primary key default gen_random_uuid(),
  label     text not null,
  qr_token  text not null unique
);

create table public.table_sessions (
  id           uuid primary key default gen_random_uuid(),
  table_id     uuid not null references public.dining_tables(id),
  status       text not null default 'active' check (status in ('active','awaiting_clearance','closed')),
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  cleared_by   uuid references public.staff(id)
);

-- THE core invariant: at most ONE non-closed session per table.
create unique index one_live_session_per_table
  on public.table_sessions (table_id)
  where status <> 'closed';

-- ---------------------------------------------------------------------------
-- 4. Orders & order items
-- ---------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_no          bigint not null default nextval('public.order_no_seq'),
  session_id        uuid not null references public.table_sessions(id),
  round_no          integer not null default 1,
  status            text not null default 'pending'
                      check (status in ('pending','approved','rejected','cancelled')),
  source            text not null default 'customer'
                      check (source in ('customer','waiter','admin')),
  created_by_staff  uuid references public.staff(id),
  customer_label    text,
  special_note      text,
  total_minor       integer not null default 0 check (total_minor >= 0),
  idempotency_key   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.staff(id),
  reject_reason     text,
  cancel_reason     text
);
create unique index orders_idempotency_idx on public.orders (idempotency_key) where idempotency_key is not null;
create index orders_session_idx on public.orders (session_id, created_at);
create index orders_status_idx  on public.orders (status, created_at);

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  menu_item_id       uuid references public.menu_items(id),
  item_name          text not null,             -- snapshot at order time
  unit_price_minor   integer not null check (unit_price_minor >= 0),
  qty                integer not null check (qty > 0),
  note               text,
  line_total_minor   integer generated always as (unit_price_minor * qty) stored
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 5. Kitchen tickets (1:1 with an approved order)
-- ---------------------------------------------------------------------------
create table public.kitchen_tickets (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references public.orders(id),
  ticket_no     bigint not null default nextval('public.kot_no_seq'),
  table_label   text not null,
  status        text not null default 'approved'
                  check (status in ('approved','preparing','ready','picked_up','served')),
  printed       boolean not null default false,
  picked_up_by  uuid references public.staff(id),
  served_by     uuid references public.staff(id),
  created_at    timestamptz not null default now(),
  ready_at      timestamptz,
  served_at     timestamptz
);
create index kitchen_status_idx on public.kitchen_tickets (status, created_at);

-- ---------------------------------------------------------------------------
-- 6. Service requests
-- ---------------------------------------------------------------------------
create table public.service_requests (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.table_sessions(id),
  table_label    text not null,
  type           text not null check (type in ('waiter','bill','water','custom')),
  note           text,
  status         text not null default 'pending' check (status in ('pending','ack','done')),
  created_at     timestamptz not null default now(),
  acked_at       timestamptz,
  acked_by       uuid references public.staff(id),
  done_at        timestamptz,
  done_by        uuid references public.staff(id)
);
create index service_status_idx on public.service_requests (status, created_at);

-- ---------------------------------------------------------------------------
-- 7. Billing
-- ---------------------------------------------------------------------------
create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  bill_no         bigint not null default nextval('public.bill_no_seq'),
  session_id      uuid not null unique references public.table_sessions(id),
  status          text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  subtotal_minor  integer not null default 0 check (subtotal_minor >= 0),
  discount_minor  integer not null default 0 check (discount_minor >= 0),
  total_minor     integer not null default 0 check (total_minor >= 0),
  paid_minor      integer not null default 0 check (paid_minor >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  paid_at         timestamptz
);

create table public.bill_splits (
  id            uuid primary key default gen_random_uuid(),
  bill_id       uuid not null references public.bills(id) on delete cascade,
  kind          text not null check (kind in ('item','person')),
  label         text not null,
  amount_minor  integer not null default 0 check (amount_minor >= 0),
  created_at    timestamptz not null default now()
);
create index bill_splits_bill_idx on public.bill_splits (bill_id);

create table public.bill_split_items (
  id             uuid primary key default gen_random_uuid(),
  split_id       uuid not null references public.bill_splits(id) on delete cascade,
  order_item_id  uuid not null references public.order_items(id),
  qty            integer not null check (qty > 0),
  amount_minor   integer not null default 0 check (amount_minor >= 0)
);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  bill_id      uuid not null references public.bills(id),
  amount_minor integer not null check (amount_minor > 0),
  method       text not null check (method in ('cash','upi','card')),
  status       text not null default 'verified' check (status in ('pending','verified','void')),
  verified     boolean not null default false,
  ref          text,
  recorded_by  uuid not null references public.staff(id),
  verified_by  uuid references public.staff(id),
  created_at   timestamptz not null default now(),
  verified_at  timestamptz
);
create index payments_bill_idx on public.payments (bill_id);

create table public.discounts (
  id            uuid primary key default gen_random_uuid(),
  bill_id       uuid not null references public.bills(id),
  amount_minor  integer not null check (amount_minor >= 0),
  type          text not null default 'flat',
  reason        text,
  staff_id      uuid not null references public.staff(id),
  created_at    timestamptz not null default now()
);

create table public.refunds (
  id           uuid primary key default gen_random_uuid(),
  bill_id      uuid not null references public.bills(id),
  payment_id   uuid references public.payments(id),
  amount_minor integer not null check (amount_minor > 0),
  method       text not null check (method in ('cash','upi','card')),
  reason       text,
  staff_id     uuid not null references public.staff(id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Audit + notifications
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id              bigserial primary key,
  actor_staff_id  uuid references public.staff(id),
  actor_name      text,
  action          text not null,
  entity          text not null,
  entity_id       text,
  reason          text,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz not null default now()
);
create index audit_created_idx on public.audit_log (created_at desc);
create index audit_entity_idx  on public.audit_log (entity, entity_id);

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  audience_role  text check (audience_role in ('owner','admin','waiter','kitchen')),
  audience_staff uuid references public.staff(id),
  type           text not null,
  title          text not null,
  payload        jsonb,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index notifications_idx on public.notifications (read, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger bills_touch before update on public.bills
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 10. Row Level Security — ENABLED, NO POLICIES (server uses service_role)
-- ---------------------------------------------------------------------------
alter table public.staff              enable row level security;
alter table public.shifts             enable row level security;
alter table public.attendance         enable row level security;
alter table public.menu_categories    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.dining_tables      enable row level security;
alter table public.table_sessions     enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.kitchen_tickets    enable row level security;
alter table public.service_requests   enable row level security;
alter table public.bills              enable row level security;
alter table public.bill_splits        enable row level security;
alter table public.bill_split_items   enable row level security;
alter table public.payments           enable row level security;
alter table public.discounts          enable row level security;
alter table public.refunds            enable row level security;
alter table public.audit_log          enable row level security;
alter table public.notifications      enable row level security;

-- ============================================================================
--  SEED DATA
-- ============================================================================

-- --- Staff (6-digit PINs, bcrypt-hashed) -----------------------------------
-- PINs: Owner 000001 | Admin 000002 | Waiters 000003 / 000004 | Kitchen 000005 / 000006
insert into public.staff (name, role, pin_hash, perms) values
 ('Mittal Ji (Owner)', 'owner',   '$2b$10$Et7ohMWr8aTeiCpIwqmUj.Up/emdFcdHDVgDCuYnm2Ty2gwUrjyX.', '{"admin": true}'::jsonb),
 ('Front Desk (Cashier)', 'admin','$2b$10$GfIVG3lX8yqfLj7T/jUyM.KHg2xGk9Po9880ekLtbJWjEkcyeqJz6', '{}'::jsonb),
 ('Ramesh (Waiter)', 'waiter',    '$2b$10$WpmnyRdkcDUm2d/k83XNeeR7prNFup9jQpoYoNo6Sc/JuT9JUzywS', '{}'::jsonb),
 ('Suresh (Waiter)', 'waiter',    '$2b$10$7B1UbXWLHDvJhz1WlndH6u/MEvBT4eZOhYlkp6IJQi88QT1T4odgW', '{}'::jsonb),
 ('Kitchen Head',    'kitchen',   '$2b$10$B8JCroM0CnrHJXTauHhhI.4gEAbGNW4.voMt7PbqLPRFQYg9Xhgka', '{}'::jsonb),
 ('Kitchen Cook',    'kitchen',   '$2b$10$KC3lXoU/3EyJpwIdg2WufOSN65zeqjpQ4pk0FJ5PFcbCKgYkuFnx.', '{}'::jsonb);

-- --- Menu categories --------------------------------------------------------
insert into public.menu_categories (name, sort) values
 ('Starters', 1),
 ('North Indian Main Course', 2),
 ('Roti and Breads', 3),
 ('Rice and Biryani', 4),
 ('South Indian', 5),
 ('Indo-Chinese', 6),
 ('Thali and Combos', 7),
 ('Desserts', 8),
 ('Beverages', 9);

-- --- Menu items (price in paise = ₹ x 100) ----------------------------------
insert into public.menu_items (category_id, name, description, price_minor, sort)
select c.id, v.name, v.descr, v.price, v.sort
from (values
  -- Starters
  ('Starters','Tomato Soup','Classic tangy tomato shorba',11000,1),
  ('Starters','Sweet Corn Soup','Creamy sweet corn soup',12000,2),
  ('Starters','Paneer Tikka','Char-grilled marinated cottage cheese',24000,3),
  ('Starters','Hara Bhara Kebab','Spinach & green pea patties',19000,4),
  ('Starters','Veg Spring Roll','Crispy vegetable rolls',18000,5),
  ('Starters','Crispy Corn','Golden fried sweet corn tossed with spices',20000,6),
  -- North Indian Main Course
  ('North Indian Main Course','Paneer Butter Masala','Paneer in rich tomato-butter gravy',29000,1),
  ('North Indian Main Course','Shahi Paneer','Creamy royal paneer curry',28000,2),
  ('North Indian Main Course','Kadai Paneer','Paneer with peppers in kadai masala',27000,3),
  ('North Indian Main Course','Palak Paneer','Paneer in smooth spinach gravy',25000,4),
  ('North Indian Main Course','Dal Makhani','Slow-cooked black lentils with butter',23000,5),
  ('North Indian Main Course','Dal Tadka','Yellow dal tempered with ghee & spices',18000,6),
  ('North Indian Main Course','Mix Veg','Seasonal vegetables in spiced gravy',22000,7),
  ('North Indian Main Course','Chole Masala','Chickpeas in Punjabi masala',19000,8),
  ('North Indian Main Course','Malai Kofta','Paneer dumplings in creamy gravy',26000,9),
  ('North Indian Main Course','Mushroom Masala','Mushrooms in spiced onion-tomato gravy',25000,10),
  -- Roti and Breads
  ('Roti and Breads','Tandoori Roti','Whole wheat roti from the tandoor',2500,1),
  ('Roti and Breads','Butter Roti','Tandoori roti brushed with butter',3000,2),
  ('Roti and Breads','Butter Naan','Soft naan finished with butter',5000,3),
  ('Roti and Breads','Garlic Naan','Naan topped with garlic & coriander',7000,4),
  ('Roti and Breads','Lachha Paratha','Flaky layered paratha',6000,5),
  ('Roti and Breads','Stuffed Kulcha','Kulcha stuffed with spiced filling',9000,6),
  -- Rice and Biryani
  ('Rice and Biryani','Steamed Rice','Plain steamed basmati rice',13000,1),
  ('Rice and Biryani','Jeera Rice','Basmati rice tempered with cumin',16000,2),
  ('Rice and Biryani','Veg Pulao','Fragrant rice with mixed vegetables',19000,3),
  ('Rice and Biryani','Veg Dum Biryani','Dum-cooked biryani with vegetables',24000,4),
  ('Rice and Biryani','Peas Pulao','Rice cooked with green peas',18000,5),
  -- South Indian
  ('South Indian','Plain Dosa','Crispy rice-lentil crepe',11000,1),
  ('South Indian','Masala Dosa','Dosa with spiced potato filling',15000,2),
  ('South Indian','Mysore Masala Dosa','Spicy Mysore-style dosa',17000,3),
  ('South Indian','Idli Sambhar','Steamed idlis with sambhar',10000,4),
  ('South Indian','Medu Vada','Crispy lentil doughnuts',11000,5),
  ('South Indian','Uttapam','Thick savoury pancake with toppings',14000,6),
  -- Indo-Chinese
  ('Indo-Chinese','Veg Hakka Noodles','Wok-tossed noodles with vegetables',19000,1),
  ('Indo-Chinese','Veg Fried Rice','Fried rice with mixed vegetables',18000,2),
  ('Indo-Chinese','Veg Manchurian','Veg balls in tangy Manchurian sauce',21000,3),
  ('Indo-Chinese','Chilli Paneer','Paneer tossed in spicy chilli sauce',25000,4),
  ('Indo-Chinese','Veg Momos','Steamed vegetable dumplings',15000,5),
  -- Thali and Combos
  ('Thali and Combos','Mini Veg Thali','Assorted mini vegetarian platter',22000,1),
  ('Thali and Combos','Punjabi Special Thali','Grand Punjabi vegetarian platter',32000,2),
  ('Thali and Combos','Dal Rice Combo','Comforting dal with steamed rice',18000,3),
  ('Thali and Combos','Chole Bhature','Spiced chickpeas with fluffy bhature',16000,4),
  -- Desserts
  ('Desserts','Gulab Jamun (2 Pieces)','Soft milk dumplings in syrup',8000,1),
  ('Desserts','Rasmalai (2 Pieces)','Chilled cottage cheese in saffron milk',11000,2),
  ('Desserts','Vanilla Ice Cream','Classic vanilla scoop',9000,3),
  ('Desserts','Gajar Ka Halwa','Warm carrot halwa',10000,4),
  -- Beverages
  ('Beverages','Sweet Lassi','Chilled sweet yogurt drink',9000,1),
  ('Beverages','Masala Chaas','Spiced buttermilk',5000,2),
  ('Beverages','Fresh Lime Soda','Refreshing lime & soda',7000,3),
  ('Beverages','Masala Tea','Spiced Indian tea',3500,4),
  ('Beverages','Cold Coffee','Chilled blended coffee',12000,5)
) as v(cat, name, descr, price, sort)
join public.menu_categories c on c.name = v.cat;

-- --- 10 dining tables with unique QR tokens ---------------------------------
insert into public.dining_tables (label, qr_token)
select 'Table ' || i,
       't' || lpad(i::text, 2, '0') || '-' || substr(md5(random()::text || i::text || clock_timestamp()::text), 1, 10)
from generate_series(1, 10) as i;

-- ============================================================================
--  DONE.  Verify:  select count(*) from public.menu_items;   -- expect 51
-- ============================================================================
