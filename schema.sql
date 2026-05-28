-- ══════════════════════════════════════════════
-- АГУУЛАХЫН СИСТЕМ — SUPABASE SQL СХЕМ
-- ══════════════════════════════════════════════

-- 1. PROFILES (хэрэглэгчийн профайл)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  business_name text,
  subscription_status text not null default 'trial' 
    check (subscription_status in ('trial','active','expired')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  subscription_ends_at timestamptz,
  created_at timestamptz default now()
);

-- 2. PRODUCTS (бараа) — хэрэглэгч бүрийн өөрийн бараа
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  unit_price numeric not null default 0,
  stock integer not null default 0,
  added_date date default current_date,
  created_at timestamptz default now()
);

-- 3. ORDERS (захиалга)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  day_seq integer not null default 1,
  phone text not null,
  address text not null,
  delivery_fee numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending','delivered','cancelled')),
  created_at timestamptz default now()
);

-- 4. ORDER ITEMS (захиалгын бараанууд — нэг захиалга олон бараатай)
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric not null default 0
);

-- 5. RESTOCK LOG (цэнэглэлтийн бүртгэл)
create table public.restock_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null,
  type text not null default 'in' check (type in ('in','out')),
  note text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- 6. PAYMENTS (төлбөрийн бүртгэл)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric not null,
  method text not null default 'qpay' check (method in ('qpay','bank_transfer','manual')),
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  reference_code text,
  confirmed_at timestamptz,
  period_start date,
  period_end date,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY — хэрэглэгч бүр өөрийнхийг л харна
-- ══════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.restock_log enable row level security;
alter table public.payments enable row level security;

-- profiles
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- products
create policy "products_own" on public.products
  for all using (auth.uid() = user_id);

-- orders
create policy "orders_own" on public.orders
  for all using (auth.uid() = user_id);

-- order_items — захиалгаараа шүүнэ
create policy "order_items_own" on public.order_items
  for all using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- restock_log
create policy "restock_own" on public.restock_log
  for all using (auth.uid() = user_id);

-- payments
create policy "payments_own" on public.payments
  for all using (auth.uid() = user_id);

-- ══════════════════════════════════════════════
-- TRIGGER — шинэ хэрэглэгч бүртгүүлэхэд профайл үүсгэнэ
-- ══════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, business_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'business_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ══════════════════════════════════════════════
-- FUNCTION — захиалгын өдрийн дэс дугаар автоматаар
-- ══════════════════════════════════════════════

create or replace function public.get_day_seq(p_user_id uuid, p_date date)
returns integer language plpgsql as $$
declare
  v_seq integer;
begin
  select coalesce(max(day_seq), 0) + 1
  into v_seq
  from public.orders
  where user_id = p_user_id and date = p_date;
  return v_seq;
end;
$$;
