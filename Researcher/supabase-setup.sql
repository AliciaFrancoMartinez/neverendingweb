-- Run this once in the Supabase SQL Editor for the project used by the site.
-- The public may submit projects and read approved entries. Only the project
-- owner (through the Supabase dashboard) can publish, hide, edit, or delete.

create extension if not exists pgcrypto;

create table if not exists public.drawer_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 120),
  topic text not null check (char_length(topic) between 1 and 80),
  stage text not null check (stage in ('idea', 'planning', 'data', 'analysis', 'writing', 'other')),
  abandoned_year smallint check (abandoned_year between 1900 and 2100),
  description text not null check (char_length(description) between 1 and 1200),
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'hidden'))
);

-- Safe to rerun for projects created before the year field was introduced.
alter table public.drawer_projects
  add column if not exists abandoned_year smallint
  check (abandoned_year between 1900 and 2100);

alter table public.drawer_projects enable row level security;

revoke all on table public.drawer_projects from anon;
grant select on table public.drawer_projects to anon;
grant insert (title, topic, stage, abandoned_year, description, display_name)
  on table public.drawer_projects to anon;

drop policy if exists "Anyone can read published drawer projects" on public.drawer_projects;
create policy "Anyone can read published drawer projects"
  on public.drawer_projects
  for select
  to anon
  using (moderation_status = 'published');

drop policy if exists "Anyone can submit a pending drawer project" on public.drawer_projects;
create policy "Anyone can submit a pending drawer project"
  on public.drawer_projects
  for insert
  to anon
  with check (
    moderation_status = 'pending'
    and abandoned_year between 1900 and extract(year from current_date)::int
    and char_length(title) between 1 and 120
    and char_length(topic) between 1 and 80
    and char_length(description) between 1 and 1200
    and (display_name is null or char_length(display_name) between 1 and 80)
  );

create index if not exists drawer_projects_public_order
  on public.drawer_projects (moderation_status, created_at desc);

create index if not exists drawer_projects_chronological_order
  on public.drawer_projects
  (moderation_status, abandoned_year desc nulls last, created_at desc);
