-- Messages are scoped to the authenticated user only.
-- The service-role key (used by the backend) bypasses RLS; browser clients
-- cannot reach these rows because RLS is enabled with no policies.
--
-- The column layout mirrors the seed data used by the UI: `content` holds the
-- message text and `sent_at` holds the server timestamp. Do not rename these
-- columns without updating the types and components that read them.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  sent_at timestamptz not null default now()
);

create index if not exists messages_sent_at_idx on public.messages (sent_at);

alter table public.messages enable row level security;
