-- Laras / FIT database schema
-- Jalankan di Supabase SQL Editor setelah membuat project.
create extension if not exists pgcrypto;

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_logs_user_date_idx
  on public.daily_logs (user_id, log_date desc);

alter table public.daily_logs enable row level security;

drop policy if exists "Users can read own daily logs" on public.daily_logs;
create policy "Users can read own daily logs"
  on public.daily_logs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily logs" on public.daily_logs;
create policy "Users can insert own daily logs"
  on public.daily_logs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily logs" on public.daily_logs;
create policy "Users can update own daily logs"
  on public.daily_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own daily logs" on public.daily_logs;
create policy "Users can delete own daily logs"
  on public.daily_logs for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_logs_updated_at on public.daily_logs;
create trigger daily_logs_updated_at
before update on public.daily_logs
for each row execute procedure public.set_updated_at();
