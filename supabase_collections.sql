-- NexaVault Collections
-- Run in Supabase SQL editor once.

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  media_item_id bigint not null references public.media_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists collection_items_unique
  on public.collection_items (user_id, collection_id, media_item_id);

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists "collections select own" on public.collections;
create policy "collections select own"
on public.collections for select
using (auth.uid() = user_id);

drop policy if exists "collections insert own" on public.collections;
create policy "collections insert own"
on public.collections for insert
with check (auth.uid() = user_id);

drop policy if exists "collections update own" on public.collections;
create policy "collections update own"
on public.collections for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "collections delete own" on public.collections;
create policy "collections delete own"
on public.collections for delete
using (auth.uid() = user_id);

drop policy if exists "collection_items select own" on public.collection_items;
create policy "collection_items select own"
on public.collection_items for select
using (auth.uid() = user_id);

drop policy if exists "collection_items insert own" on public.collection_items;
create policy "collection_items insert own"
on public.collection_items for insert
with check (auth.uid() = user_id);

drop policy if exists "collection_items delete own" on public.collection_items;
create policy "collection_items delete own"
on public.collection_items for delete
using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.collections to anon, authenticated;
grant select, insert, update, delete on public.collection_items to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
