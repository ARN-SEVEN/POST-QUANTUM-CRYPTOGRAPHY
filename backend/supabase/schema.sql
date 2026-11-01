-- Run this once in the Supabase SQL editor (Database > SQL editor).
--
-- Users live in a plain table because this backend checks passwords itself;
-- Supabase Auth (auth.users) is not used. Row level security is enabled with
-- no policies, so anon/authenticated browser clients cannot read these rows at
-- all. The backend uses the service-role key, which bypasses RLS.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.users enable row level security;
