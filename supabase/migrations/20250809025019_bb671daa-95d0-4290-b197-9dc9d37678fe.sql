-- Create assistant_debounce table for robust, idempotent debounce per ticket
create table if not exists public.assistant_debounce (
  ticket_id uuid primary key,
  client_id uuid not null,
  instance_id text not null,
  chat_id text not null,
  debounce_until timestamptz not null,
  scheduled boolean not null default true,
  lock_version integer not null default 0,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS with permissive policies (edge functions use service role)
alter table public.assistant_debounce enable row level security;
create policy "Allow all operations on assistant_debounce"
  on public.assistant_debounce
  for all
  using (true)
  with check (true);

-- Helpful indexes
create index if not exists idx_assistant_debounce_until on public.assistant_debounce (debounce_until);
create index if not exists idx_assistant_debounce_scheduled on public.assistant_debounce (scheduled);
create index if not exists idx_assistant_debounce_chat on public.assistant_debounce (chat_id);
