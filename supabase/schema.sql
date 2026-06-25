create extension if not exists pgcrypto;

create type public.search_task_status as enum (
  'queued',
  'processing',
  'completed',
  'failed',
  'expired'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  prefix text not null,
  active boolean not null default true,
  requests_per_minute integer not null default 20,
  daily_limit integer not null default 1000,
  monthly_limit integer not null default 10000,
  max_results_per_task integer not null default 10,
  scraping_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint api_keys_limits_check check (
    requests_per_minute > 0
    and daily_limit > 0
    and monthly_limit > 0
    and max_results_per_task between 1 and 20
  )
);

create table if not exists public.search_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  query text not null,
  search_type text not null default 'web',
  status public.search_task_status not null default 'queued',
  requested_results integer not null default 5,
  successful_results integer not null default 0,
  failed_results integer not null default 0,
  callback_url text,
  callback_secret text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  constraint search_tasks_requested_results_check check (requested_results between 1 and 20)
);

create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.search_tasks(id) on delete cascade,
  position integer not null,
  title text,
  url text not null,
  canonical_url text,
  domain text,
  snippet text,
  raw_content text,
  cleaned_content text,
  published_at timestamptz,
  relevance_score numeric,
  scrape_status text not null default 'pending',
  error_message text,
  selected_for_final_answer boolean not null default false,
  created_at timestamptz not null default now(),
  constraint search_results_position_check check (position > 0)
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.search_tasks(id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.final_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.search_tasks(id) on delete cascade,
  summary text,
  key_findings jsonb not null default '[]'::jsonb,
  final_answer text,
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_search_task_id uuid references public.search_tasks(id) on delete set null,
  mode text not null default 'real_event',
  query text not null,
  event_name text,
  event_date date,
  location text,
  event_description text,
  desired_media text,
  media_kind text not null default 'both',
  source_preference text not null default 'all',
  status public.search_task_status not null default 'queued',
  requested_results integer not null default 10,
  successful_results integer not null default 0,
  failed_results integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  constraint media_tasks_requested_results_check check (requested_results between 1 and 30),
  constraint media_tasks_media_kind_check check (media_kind in ('images', 'videos', 'both')),
  constraint media_tasks_mode_check check (mode in ('real_event', 'stock_basic'))
);

create table if not exists public.media_results (
  id uuid primary key default gen_random_uuid(),
  media_task_id uuid not null references public.media_tasks(id) on delete cascade,
  position integer not null,
  title text,
  source_url text not null,
  media_url text,
  thumbnail_url text,
  source_domain text,
  source_type text not null default 'web',
  media_kind text not null default 'page',
  description text,
  author text,
  published_at timestamptz,
  relevance_score numeric,
  license_note text,
  selected_for_video boolean not null default false,
  created_at timestamptz not null default now(),
  constraint media_results_position_check check (position > 0)
);

create table if not exists public.media_task_events (
  id uuid primary key default gen_random_uuid(),
  media_task_id uuid not null references public.media_tasks(id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists search_tasks_user_id_idx on public.search_tasks(user_id);
create index if not exists search_tasks_api_key_created_idx on public.search_tasks(api_key_id, created_at desc);
create index if not exists search_tasks_status_idx on public.search_tasks(status);
create index if not exists search_results_task_id_idx on public.search_results(task_id);
create unique index if not exists search_results_task_position_idx on public.search_results(task_id, position);
create index if not exists task_events_task_id_created_idx on public.task_events(task_id, created_at desc);
create index if not exists media_tasks_user_id_idx on public.media_tasks(user_id);
create index if not exists media_tasks_status_idx on public.media_tasks(status);
create index if not exists media_tasks_created_idx on public.media_tasks(created_at desc);
create index if not exists media_results_task_id_idx on public.media_results(media_task_id);
create unique index if not exists media_results_task_position_idx on public.media_results(media_task_id, position);
create index if not exists media_task_events_task_id_created_idx on public.media_task_events(media_task_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.search_tasks enable row level security;
alter table public.search_results enable row level security;
alter table public.task_events enable row level security;
alter table public.final_reports enable row level security;
alter table public.media_tasks enable row level security;
alter table public.media_results enable row level security;
alter table public.media_task_events enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "api_keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);

create policy "api_keys_insert_own" on public.api_keys
  for insert with check (auth.uid() = user_id);

create policy "api_keys_update_own" on public.api_keys
  for update using (auth.uid() = user_id);

create policy "search_tasks_select_own" on public.search_tasks
  for select using (auth.uid() = user_id);

create policy "search_results_select_own" on public.search_results
  for select using (
    exists (
      select 1
      from public.search_tasks t
      where t.id = search_results.task_id
        and t.user_id = auth.uid()
    )
  );

create policy "task_events_select_own" on public.task_events
  for select using (
    exists (
      select 1
      from public.search_tasks t
      where t.id = task_events.task_id
        and t.user_id = auth.uid()
    )
  );

create policy "final_reports_select_own" on public.final_reports
  for select using (
    exists (
      select 1
      from public.search_tasks t
      where t.id = final_reports.task_id
        and t.user_id = auth.uid()
    )
  );

create policy "media_tasks_select_own" on public.media_tasks
  for select using (auth.uid() = user_id);

create policy "media_tasks_insert_own" on public.media_tasks
  for insert with check (auth.uid() = user_id);

create policy "media_tasks_update_own" on public.media_tasks
  for update using (auth.uid() = user_id);

create policy "media_tasks_delete_own" on public.media_tasks
  for delete using (auth.uid() = user_id);

create policy "media_results_select_own" on public.media_results
  for select using (
    exists (
      select 1
      from public.media_tasks t
      where t.id = media_results.media_task_id
        and t.user_id = auth.uid()
    )
  );

create policy "media_task_events_select_own" on public.media_task_events
  for select using (
    exists (
      select 1
      from public.media_tasks t
      where t.id = media_task_events.media_task_id
        and t.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
