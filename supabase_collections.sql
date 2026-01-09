-- Create Collections tables (run in Supabase SQL Editor)
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  collection_id uuid not null references public.collections(id) on delete cascade,
  media_item_id bigint not null references public.media_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, collection_id, media_item_id)
);

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own" on public.collections
for select using (auth.uid() = user_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own" on public.collections
for insert with check (auth.uid() = user_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own" on public.collections
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own" on public.collections
for delete using (auth.uid() = user_id);

drop policy if exists "collection_items_select_own" on public.collection_items;
create policy "collection_items_select_own" on public.collection_items
for select using (auth.uid() = user_id);

drop policy if exists "collection_items_insert_own" on public.collection_items;
create policy "collection_items_insert_own" on public.collection_items
for insert with check (auth.uid() = user_id);

drop policy if exists "collection_items_delete_own" on public.collection_items;
create policy "collection_items_delete_own" on public.collection_items
for delete using (auth.uid() = user_id);
