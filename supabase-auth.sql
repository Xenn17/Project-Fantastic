-- Jalankan sekali di Supabase SQL Editor.
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, username text not null unique, email text not null unique, created_at timestamptz not null default now());
alter table public.profiles enable row level security;
drop policy if exists "Public can check usernames" on public.profiles;
create policy "Public can check usernames" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to anon, authenticated with check (true);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
