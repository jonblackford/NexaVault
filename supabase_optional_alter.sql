-- Optional: run in Supabase SQL editor if you want full release-date sorting.
-- (Only needed if you set USE_RELEASE_DATE_COLUMN = true in app.js)
alter table public.media_items
  add column if not exists release_date text;

-- Ensure cast_list exists (if you renamed from cast)
alter table public.media_items
  add column if not exists cast_list text;
