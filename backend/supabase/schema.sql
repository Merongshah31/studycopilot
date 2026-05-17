-- StudyPilot backend schema (for migrated Supabase CRUD)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  name text not null default '',
  email text not null unique,
  password text not null default '',
  course text not null default '',
  subjects jsonb not null default '[]'::jsonb,
  provider text not null default '',
  provider_id text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists users_provider_provider_id_idx on public.users(provider, provider_id);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'Untitled task',
  deadline date null,
  priority text not null default 'low' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_created_at_idx on public.tasks(user_id, created_at desc);
create index if not exists tasks_user_id_deadline_idx on public.tasks(user_id, deadline);

create table if not exists public.google_calendar_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  access_token text null,
  refresh_token text null,
  scope text null,
  token_type text null,
  expiry_date bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_chats (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_chats_user_id_updated_at_idx on public.assistant_chats(user_id, updated_at desc);

create table if not exists public.assistant_messages (
  id uuid primary key,
  chat_id uuid not null references public.assistant_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_chat_id_created_at_idx on public.assistant_messages(chat_id, created_at);

create table if not exists public.assistant_memories (
  user_id uuid primary key references public.users(id) on delete cascade,
  memory_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_imports (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  file_name text not null default 'schedule.pdf',
  storage_path text not null default '',
  status text not null default 'previewed' check (status in ('previewed', 'imported', 'failed')),
  total_items integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_imports_user_id_created_at_idx on public.schedule_imports(user_id, created_at desc);

-- Optional RLS (recommended if you later use anon/authenticated direct client access)
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.google_calendar_tokens enable row level security;
alter table public.assistant_chats enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_memories enable row level security;
alter table public.schedule_imports enable row level security;

-- Service-role backend can bypass RLS; these are for authenticated users if needed later.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='tasks_owner_access'
  ) then
    create policy tasks_owner_access on public.tasks
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assistant_memories' and policyname='assistant_memories_owner_access'
  ) then
    create policy assistant_memories_owner_access on public.assistant_memories
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='schedule_imports' and policyname='schedule_imports_owner_access'
  ) then
    create policy schedule_imports_owner_access on public.schedule_imports
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='google_calendar_tokens' and policyname='google_calendar_tokens_owner_access'
  ) then
    create policy google_calendar_tokens_owner_access on public.google_calendar_tokens
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
