-- Run this once in the Supabase SQL Editor for an existing drawer_projects
-- table. It preserves every current project.

alter table public.drawer_projects
  add column if not exists abandoned_year smallint
  check (abandoned_year between 1900 and 2100);

grant insert (abandoned_year) on table public.drawer_projects to anon;

drop policy if exists "Anyone can submit a pending drawer project"
  on public.drawer_projects;

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

create index if not exists drawer_projects_chronological_order
  on public.drawer_projects
  (moderation_status, abandoned_year desc nulls last, created_at desc);
