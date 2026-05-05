-- Shipping Cost Management schema
create table if not exists public.shipping_zones (
  id bigserial primary key,
  zone_name text not null,
  district_match text,
  province_match text,
  base_rate integer not null default 0,
  extra_per_kg integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_settings (
  id integer primary key,
  international_flat_rate integer not null default 0,
  is_international_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.shipping_settings (id, international_flat_rate, is_international_enabled)
values (1, 0, false)
on conflict (id) do nothing;

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
