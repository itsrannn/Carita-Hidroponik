create extension if not exists "pgcrypto";

alter table if exists public.products
  add column if not exists grow_duration_days integer default 120;

create table if not exists public.grow_lab_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  activated_at timestamptz not null default now(),
  current_day integer not null default 1,
  current_phase text,
  estimated_harvest_date timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.grow_timelines (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  day_number integer not null,
  phase text,
  title text not null,
  description text not null,
  nutrient_ppm integer,
  reminder_type text,
  created_at timestamptz not null default now(),
  unique(product_id, day_number)
);

create table if not exists public.grow_secret_contents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.grow_lab_activations enable row level security;
alter table public.grow_timelines enable row level security;
alter table public.grow_secret_contents enable row level security;

create policy "grow_activation_owner_select" on public.grow_lab_activations for select using (auth.uid() = user_id);
create policy "grow_activation_owner_insert" on public.grow_lab_activations for insert with check (auth.uid() = user_id);
create policy "grow_timeline_read_authenticated" on public.grow_timelines for select using (auth.role() = 'authenticated');
create policy "grow_secret_read_authenticated" on public.grow_secret_contents for select using (auth.role() = 'authenticated');

insert into public.grow_timelines (product_id, day_number, phase, title, description, nutrient_ppm, reminder_type)
select p.id, x.day_number, x.phase, x.title, x.description, x.nutrient_ppm, x.reminder_type
from public.products p
cross join (
  values
    (1, 'Germination', 'Mulai semai benih', 'Jaga media tetap lembap dan terang tidak langsung.', 150, 'daily_check'),
    (14, 'Seedling', 'Topping pertama', 'Mulai topping pertama untuk merangsang percabangan.', 550, 'weekly_task'),
    (30, 'Vegetative', 'Perkuat vegetatif', 'Naikkan intensitas cahaya dan sirkulasi udara.', 900, 'daily_check')
) as x(day_number, phase, title, description, nutrient_ppm, reminder_type)
where p.name ilike any(array['%Carolina Reaper%', '%Habanero%'])
on conflict do nothing;
