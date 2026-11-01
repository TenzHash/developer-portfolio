-- ============================================================
-- Portfolio database for a NEW Supabase project
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- 1) PROJECTS ------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'Website & Web App Development',
  summary       text,
  tags          text[] not null default '{}',
  demo_url      text default '',
  github_url    text default '',
  image_url     text default '',
  media_urls    text[] not null default '{}',
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

-- 2) SOCIAL POSTS (filled by the sync-social Edge Function) --
create table if not exists public.social_posts (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null check (platform in ('facebook','instagram')),
  external_id  text not null,
  caption      text,
  media_url    text,
  media_type   text,
  permalink    text,
  posted_at    timestamptz,
  is_hidden    boolean not null default false,   -- hide a post from the site without deleting it
  synced_at    timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists social_posts_posted_at_idx on public.social_posts (posted_at desc);

-- 3) ROW LEVEL SECURITY --------------------------------------
alter table public.projects     enable row level security;
alter table public.social_posts enable row level security;

-- Anyone can read (the public website)
create policy "Public can read projects"
  on public.projects for select using (true);

create policy "Public can read visible social posts"
  on public.social_posts for select using (is_hidden = false);

-- Only signed-in admin can write
create policy "Admin can insert projects"
  on public.projects for insert to authenticated with check (true);
create policy "Admin can update projects"
  on public.projects for update to authenticated using (true) with check (true);
create policy "Admin can delete projects"
  on public.projects for delete to authenticated using (true);

create policy "Admin can read all social posts"
  on public.social_posts for select to authenticated using (true);
create policy "Admin can update social posts"
  on public.social_posts for update to authenticated using (true) with check (true);
create policy "Admin can delete social posts"
  on public.social_posts for delete to authenticated using (true);
-- (The Edge Function writes with the service-role key, which bypasses RLS.)

-- 4) STORAGE BUCKETS -----------------------------------------
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true),
       ('social-media',    'social-media',    true)
on conflict (id) do nothing;

create policy "Public can view portfolio media"
  on storage.objects for select using (bucket_id in ('portfolio-media','social-media'));

create policy "Admin can upload portfolio media"
  on storage.objects for insert to authenticated with check (bucket_id = 'portfolio-media');
create policy "Admin can update portfolio media"
  on storage.objects for update to authenticated using (bucket_id = 'portfolio-media');
create policy "Admin can delete portfolio media"
  on storage.objects for delete to authenticated using (bucket_id = 'portfolio-media');

-- 5) OPTIONAL: auto-sync social posts every 6 hours ----------
-- Needs the pg_cron + pg_net extensions (Dashboard -> Database -> Extensions).
-- Replace YOUR-PROJECT-REF and YOUR-SERVICE-ROLE-KEY, then uncomment and run.
--
-- select cron.schedule(
--   'sync-social-every-6h', '0 */6 * * *',
--   $$ select net.http_post(
--        url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-social',
--        headers := jsonb_build_object('Authorization','Bearer YOUR-SERVICE-ROLE-KEY','Content-Type','application/json')
--      ); $$
-- );
