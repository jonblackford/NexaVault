-- Create collections table for NexaVault
-- Run this in Supabase SQL Editor as the project owner

create table if not exists collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  name text not null,
  created_at timestamptz default now()
);

-- Index for faster lookups by user
create index if not exists collections_user_idx on collections(user_id);

-- Optional RLS example (adjust to your project's auth setup):
-- enable row level security;
-- create policy "Users can manage their collections" on collections
--   for all using (auth.uid() = user_id);

-- Note: If using Supabase's example auth schema, you may need to replace
-- gen_random_uuid() with uuid_generate_v4() depending on extensions available.
