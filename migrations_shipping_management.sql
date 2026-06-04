-- Shipping Cost Management schema (admin-editable zone pricing)
create table if not exists public.shipping_zones (
  id bigserial primary key,
  zone_code text,
  region_name text,
  price numeric,
  currency text default 'IDR',
  zone_name text,
  district_match text,
  province_match text,
  base_rate integer not null default 0,
  extra_per_kg integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_zones add column if not exists zone_code text;
alter table public.shipping_zones add column if not exists region_name text;
alter table public.shipping_zones add column if not exists price numeric;
alter table public.shipping_zones add column if not exists currency text default 'IDR';
alter table public.shipping_zones add column if not exists updated_at timestamptz default now();

create unique index if not exists shipping_zones_zone_code_key on public.shipping_zones(zone_code);

create table if not exists public.shipping_settings (
  id integer primary key,
  international_flat_rate integer not null default 0,
  is_international_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists stock integer not null default 0;

insert into public.shipping_settings (id, international_flat_rate, is_international_enabled)
values (1, 2, true)
on conflict (id) do update set international_flat_rate = excluded.international_flat_rate, is_international_enabled = excluded.is_international_enabled;

insert into public.shipping_zones (zone_code, region_name, price, currency, zone_name, district_match, province_match, base_rate, extra_per_kg, is_active)
values
  ('11', 'Kecamatan Turen', 8000, 'IDR', 'Kecamatan Turen', 'turen', 'jawa timur', 8000, 0, true),
  ('24', 'Kabupaten Malang', 10000, 'IDR', 'Kabupaten Malang', 'malang', 'jawa timur', 10000, 0, true),
  ('37', 'Provinsi Jawa Timur', 15000, 'IDR', 'Provinsi Jawa Timur', null, 'jawa timur', 15000, 0, true),
  ('62', 'Indonesia', 30000, 'IDR', 'Indonesia', null, null, 30000, 0, true),
  ('98', 'Luar Negeri', 2, 'USD', 'Luar Negeri', null, null, 2, 0, true)
on conflict (zone_code) do update set
  region_name = excluded.region_name,
  price = excluded.price,
  currency = excluded.currency,
  zone_name = excluded.zone_name,
  district_match = excluded.district_match,
  province_match = excluded.province_match,
  base_rate = excluded.base_rate,
  extra_per_kg = excluded.extra_per_kg,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists shipping_zones_set_updated_at on public.shipping_zones;
create trigger shipping_zones_set_updated_at
before update on public.shipping_zones
for each row execute function public.set_updated_at();

drop trigger if exists shipping_settings_set_updated_at on public.shipping_settings;
create trigger shipping_settings_set_updated_at
before update on public.shipping_settings
for each row execute function public.set_updated_at();

alter table public.shipping_zones enable row level security;

drop policy if exists "Allow authenticated read shipping zones" on public.shipping_zones;
create policy "Allow authenticated read shipping zones"
on public.shipping_zones for select
to authenticated
using (true);

drop policy if exists "Allow admin full access shipping zones" on public.shipping_zones;
create policy "Allow admin full access shipping zones"
on public.shipping_zones for all
to authenticated
using (is_admin())
with check (is_admin());
