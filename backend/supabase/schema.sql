-- Run this once in the Supabase SQL editor (Database > SQL editor).
--
-- Conversations live in two tables: `users` (with passwords hashed by the
-- backend) and `messages`. Row level security is enabled on both tables with no
-- policies, so browser clients can only reach rows through the service-role
-- key used server-side by the auth backend.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.users enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at);

alter table public.messages enable row level security;
