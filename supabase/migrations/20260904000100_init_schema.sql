-- wassupday — initial schema: profiles, events, tasks
--
-- Security model
-- ==============
-- * Row Level Security is ON for every table. There is no code path that reads
--   or writes a row without a policy check.
-- * Every policy is scoped `to authenticated` and keyed on `(select auth.uid())`.
--   The `anon` role is granted nothing, so an unauthenticated request sees an
--   empty database.
-- * `user_id` columns default to `auth.uid()` AND are re-checked by the INSERT
--   policy's WITH CHECK — a client cannot write rows for another user even if it
--   forges the column.
-- * SECURITY DEFINER functions pin `search_path` to '' and fully schema-qualify
--   every reference, closing the classic search_path privilege-escalation hole.
-- * All access from the app goes through PostgREST / supabase-js query builders
--   (parameterized). No string-built SQL, so there is no SQL-injection surface.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Shared: updated_at auto-touch
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text
                 constraint profiles_display_name_len
                 check (display_name is null or char_length(display_name) between 1 and 60),
  timezone     text not null default 'UTC'
                 constraint profiles_timezone_len
                 check (char_length(timezone) between 1 and 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Per-user profile, 1:1 with auth.users. Row is created by the handle_new_user trigger.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- A user can read and update only their own profile.
-- No INSERT policy: rows are created solely by the trigger below.
-- No DELETE policy: profiles disappear only via the auth.users cascade.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- New-user hook: create a profile row when auth.users gains a row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'timezone'), ''), 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null
                constraint events_title_len check (char_length(title) between 1 and 200),
  description text
                constraint events_description_len check (description is null or char_length(description) <= 2000),
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  location    text
                constraint events_location_len check (location is null or char_length(location) <= 200),
  category    text not null default 'other'
                constraint events_category_valid
                check (category in ('class', 'meeting', 'personal', 'health', 'social', 'other')),
  source      text not null default 'manual'
                constraint events_source_valid check (source in ('manual', 'import', 'ai')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_time_order check (end_time >= start_time)
);

create index events_user_start_idx on public.events (user_id, start_time);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy events_select_own
  on public.events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy events_insert_own
  on public.events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy events_update_own
  on public.events for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy events_delete_own
  on public.events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title              text not null
                       constraint tasks_title_len check (char_length(title) between 1 and 200),
  description        text
                       constraint tasks_description_len check (description is null or char_length(description) <= 2000),
  due_date           timestamptz,
  priority           text not null default 'medium'
                       constraint tasks_priority_valid check (priority in ('low', 'medium', 'high')),
  estimated_duration integer
                       constraint tasks_duration_range
                       check (estimated_duration is null or (estimated_duration > 0 and estimated_duration <= 1440)),
  status             text not null default 'todo'
                       constraint tasks_status_valid check (status in ('todo', 'completed')),
  source             text not null default 'manual'
                       constraint tasks_source_valid check (source in ('manual', 'import', 'ai')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);
create index tasks_user_due_idx on public.tasks (user_id, due_date);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy tasks_select_own
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy tasks_insert_own
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy tasks_update_own
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy tasks_delete_own
  on public.tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Grants: least privilege
--   anon         -> nothing
--   authenticated-> table DML only; row visibility still gated by RLS
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
revoke all on public.events   from anon, authenticated;
revoke all on public.tasks    from anon, authenticated;

grant select, update           on public.profiles to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.tasks  to authenticated;

-- Trigger functions are never called directly by clients.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
