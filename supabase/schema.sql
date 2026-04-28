create table if not exists public.memostudy_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  preferred_locale text not null default 'en',
  updated_at timestamptz not null default now()
);

create table if not exists public.memostudy_user_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.memostudy_profiles enable row level security;
alter table public.memostudy_user_snapshots enable row level security;

create policy "Users can read own profile"
on public.memostudy_profiles
for select
using (auth.uid() = id);

create policy "Users can upsert own profile"
on public.memostudy_profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.memostudy_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read own snapshot"
on public.memostudy_user_snapshots
for select
using (auth.uid() = user_id);

create policy "Users can insert own snapshot"
on public.memostudy_user_snapshots
for insert
with check (auth.uid() = user_id);

create policy "Users can update own snapshot"
on public.memostudy_user_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
