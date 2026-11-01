-- Run once in the Supabase SQL editor (Database > SQL editor), after
-- supabase/schema.sql and after accounts exist. The backend validates the
-- caller's JWT and writes messages with the service-role key, so RLS here is
-- primarily a defense-in-depth guard; the service-role key bypasses it.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id),
  content text not null,
  sent_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Ordered feed for the chat window.
create index if not exists messages_sent_at_idx on public.messages (sent_at);
