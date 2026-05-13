create extension if not exists "pgcrypto";

create table if not exists grow_lab_activations (
id uuid primary key default gen_random_uuid(),
user_id uuid not null,
product_id uuid not null,
activation_code text,
activated_at timestamptz default now(),
current_day integer default 1,
current_phase text default 'Germination',
estimated_harvest_date timestamptz,
progress_percent integer default 0,
is_completed boolean default false,
created_at timestamptz default now()
);

create table if not exists grow_timelines (
id uuid primary key default gen_random_uuid(),
product_id uuid not null,
day_number integer not null,
phase text not null,
title text not null,
description text,
nutrient_ppm integer,
reminder_type text,
is_key_action boolean default false,
created_at timestamptz default now()
);

create table if not exists grow_secret_contents (
id uuid primary key default gen_random_uuid(),
product_id uuid not null,
title text not null,
content text not null,
created_at timestamptz default now()
);

create table if not exists grow_tasks (
id uuid primary key default gen_random_uuid(),
activation_id uuid not null,
day_number integer,
task_title text,
is_completed boolean default false,
created_at timestamptz default now()
);

create table if not exists grow_stats (
id uuid primary key default gen_random_uuid(),
user_id uuid not null,
total_days integer default 0,
total_plants integer default 0,
total_harvests integer default 0,
success_rate numeric default 0,
created_at timestamptz default now()
);

alter table products
add column if not exists grow_duration_days integer default 120,
add column if not exists grow_difficulty text default 'Medium',
add column if not exists ideal_temperature text,
add column if not exists ideal_humidity text,
add column if not exists shu_level integer default 0;

update products set grow_duration_days=120,grow_difficulty='Medium',ideal_temperature='24-30°C',ideal_humidity='60-75%',shu_level=350000 where name->>'en' ilike '%habanero%';
update products set grow_duration_days=150,grow_difficulty='Hard',ideal_temperature='25-32°C',ideal_humidity='65-80%',shu_level=2200000 where name->>'en' ilike '%carolina%';

insert into grow_timelines (product_id, day_number, phase, title, description, nutrient_ppm, reminder_type, is_key_action)
select id,14,'Vegetative','First Topping','Mulai topping pertama untuk merangsang percabangan.',700,'topping',true from products where name->>'en' ilike '%habanero%';

alter table grow_lab_activations enable row level security;
alter table grow_timelines enable row level security;
alter table grow_secret_contents enable row level security;
alter table grow_tasks enable row level security;
alter table grow_stats enable row level security;

create policy if not exists gla_owner on grow_lab_activations for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy if not exists gt_read_auth on grow_timelines for select using (auth.role()='authenticated');
create policy if not exists gsc_paid_only on grow_secret_contents for select using (auth.role()='authenticated');
create policy if not exists gtask_owner on grow_tasks for all using (exists(select 1 from grow_lab_activations a where a.id=activation_id and a.user_id=auth.uid()));
create policy if not exists gstats_owner on grow_stats for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
