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

create index if not exists media_tasks_user_id_idx on public.media_tasks(user_id);
create index if not exists media_tasks_status_idx on public.media_tasks(status);
create index if not exists media_tasks_created_idx on public.media_tasks(created_at desc);
create index if not exists media_results_task_id_idx on public.media_results(media_task_id);
create unique index if not exists media_results_task_position_idx on public.media_results(media_task_id, position);
create index if not exists media_task_events_task_id_created_idx on public.media_task_events(media_task_id, created_at desc);

alter table public.media_tasks enable row level security;
alter table public.media_results enable row level security;
alter table public.media_task_events enable row level security;

drop policy if exists "media_tasks_select_own" on public.media_tasks;
create policy "media_tasks_select_own" on public.media_tasks
  for select using (auth.uid() = user_id);

drop policy if exists "media_tasks_insert_own" on public.media_tasks;
create policy "media_tasks_insert_own" on public.media_tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "media_tasks_update_own" on public.media_tasks;
create policy "media_tasks_update_own" on public.media_tasks
  for update using (auth.uid() = user_id);

drop policy if exists "media_tasks_delete_own" on public.media_tasks;
create policy "media_tasks_delete_own" on public.media_tasks
  for delete using (auth.uid() = user_id);

drop policy if exists "media_results_select_own" on public.media_results;
create policy "media_results_select_own" on public.media_results
  for select using (
    exists (
      select 1
      from public.media_tasks t
      where t.id = media_results.media_task_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "media_task_events_select_own" on public.media_task_events;
create policy "media_task_events_select_own" on public.media_task_events
  for select using (
    exists (
      select 1
      from public.media_tasks t
      where t.id = media_task_events.media_task_id
        and t.user_id = auth.uid()
    )
  );
