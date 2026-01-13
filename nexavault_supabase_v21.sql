-- NexaVault Supabase schema v21
drop table if exists collection_items;
drop table if exists collections;
drop table if exists media_items;

create table media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  tmdb_id int not null,
  title text,
  media_type text,
  poster text,
  rating numeric,
  created_at timestamptz default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections on delete cascade,
  media_item_id uuid references media_items on delete cascade,
  unique(collection_id, media_item_id)
);

alter table media_items enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;

create policy "user owns media"
on media_items for all
using (auth.uid() = user_id);

create policy "user owns collections"
on collections for all
using (auth.uid() = user_id);

create policy "user owns collection items"
on collection_items for all
using (
  exists (
    select 1 from collections
    where collections.id = collection_items.collection_id
    and collections.user_id = auth.uid()
  )
);
