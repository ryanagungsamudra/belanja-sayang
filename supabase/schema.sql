-- BelanjaSayang Real-Time Household Sync Schema
-- Run this in your Supabase Dashboard -> SQL Editor (safe to re-run to upgrade!)

create table if not exists public.household_collections (
  household_code text not null,
  collection_key text not null,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (household_code, collection_key)
);

-- Upgrade/ensure allowed collection keys (including shared pin_config)
alter table public.household_collections
  drop constraint if exists household_collections_collection_key_check;

alter table public.household_collections
  add constraint household_collections_collection_key_check
  check (
    collection_key in (
      'items',
      'product_refs',
      'monthly_purchases',
      'stores',
      'categories',
      'templates',
      'frequent',
      'pin_config'
    )
  );

-- Ensure full row payloads are broadcast over Supabase Realtime
alter table public.household_collections replica identity full;

-- Index for fast household fetches
create index if not exists idx_household_collections_code
  on public.household_collections (household_code);

-- Row Level Security
-- Tip: Use a strong random 16+ character VITE_HOUSEHOLD_CODE (not a guessable word).
-- SELECT policy stays compatible with Supabase Realtime postgres_changes (which does not pass custom HTTP headers),
-- while INSERT/UPDATE/DELETE enforce matching the x-household-code header sent by the app.
alter table public.household_collections enable row level security;

drop policy if exists "Allow household sync by code" on public.household_collections;
drop policy if exists "Allow household read by code" on public.household_collections;
drop policy if exists "Allow household write by header" on public.household_collections;

create policy "Allow household read by code"
  on public.household_collections
  for select
  to anon, authenticated
  using (length(household_code) >= 6);

create policy "Allow household write by header"
  on public.household_collections
  for all
  to anon, authenticated
  using (
    length(household_code) >= 6
    and coalesce(
      current_setting('request.headers', true)::json->>'x-household-code',
      household_code
    ) = household_code
  )
  with check (
    length(household_code) >= 6
    and coalesce(
      current_setting('request.headers', true)::json->>'x-household-code',
      household_code
    ) = household_code
  );

-- Enable Realtime broadcasts for this table
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_collections'
  ) then
    alter publication supabase_realtime add table public.household_collections;
  end if;
end $$;
