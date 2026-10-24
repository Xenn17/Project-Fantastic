-- F4NTASTIC AUTH + PROFILE HARDENING MIGRATION
-- Jalankan di Supabase SQL Editor pada proyek yang benar. Cadangkan database sebelum migrasi.
-- Script ini tidak mengubah role pengguna menjadi Developer secara otomatis.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists ml_id text;
alter table public.profiles add column if not exists ml_server text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_updated_at timestamptz;

-- Only allow known roles; all new rows default to member.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','admin','developer'));
alter table public.profiles alter column role set default 'member';

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Public can check usernames" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Username availability and username login use narrow SECURITY DEFINER RPCs instead of public table reads.
create or replace function public.f4_username_exists(p_username text)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
revoke all on function public.f4_username_exists(text) from public;
grant execute on function public.f4_username_exists(text) to anon, authenticated;

create or replace function public.f4_login_email_for_username(p_username text)
returns text language sql security definer set search_path = public, pg_temp as $$
  select email from public.profiles where lower(username) = lower(trim(p_username)) limit 1;
$$;
revoke all on function public.f4_login_email_for_username(text) from public;
grant execute on function public.f4_login_email_for_username(text) to anon, authenticated;

-- Automatically create the profile for email/password and OAuth signups.
create or replace function public.f4_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  chosen_username text;
  chosen_name text;
begin
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Member');
  chosen_username := lower(coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1), 'member'));
  chosen_username := regexp_replace(chosen_username, '[^a-z0-9._-]', '', 'g');
  if length(chosen_username) < 3 then chosen_username := 'member_' || substr(replace(new.id::text, '-', ''), 1, 8); end if;
  if exists(select 1 from public.profiles where lower(username) = chosen_username and id <> new.id) then
    chosen_username := left(chosen_username, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles(id, full_name, username, email, role)
  values(new.id, chosen_name, chosen_username, lower(new.email), 'member')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists f4_on_auth_user_created on auth.users;
create trigger f4_on_auth_user_created after insert on auth.users for each row execute function public.f4_handle_new_auth_user();

-- Backfill existing Auth users missing a profile. Conflicting usernames get a stable suffix.
do $$
declare u record; base_username text; candidate text;
begin
  for u in select au.id, au.email, au.raw_user_meta_data from auth.users au left join public.profiles p on p.id=au.id where p.id is null loop
    base_username := lower(regexp_replace(coalesce(nullif(trim(u.raw_user_meta_data->>'username'),''), split_part(u.email,'@',1), 'member'), '[^a-z0-9._-]', '', 'g'));
    if length(base_username) < 3 then base_username := 'member_' || substr(replace(u.id::text,'-',''),1,8); end if;
    candidate := base_username;
    if exists(select 1 from public.profiles where lower(username)=candidate) then candidate := left(base_username,15) || '_' || substr(replace(u.id::text,'-',''),1,8); end if;
    insert into public.profiles(id,full_name,username,email,role)
    values(u.id, coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1),'Member'), candidate, lower(u.email), 'member')
    on conflict (id) do nothing;
  end loop;
end $$;

-- Prevent self-assigned roles and enforce the avatar 24-hour cooldown in the database.
create or replace function public.f4_guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.role := 'member';
      select lower(au.email), coalesce(nullif(lower(trim(au.raw_user_meta_data ->> 'username')), ''), lower(split_part(au.email, '@', 1)))
        into new.email, new.username from auth.users au where au.id = auth.uid();
    end if;
    if new.avatar_url is not null then new.avatar_updated_at := now(); end if;
    return new;
  end if;
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Role cannot be changed by the account owner';
  end if;
  if auth.uid() is not null and (new.username is distinct from old.username or new.id is distinct from old.id or (new.email is distinct from old.email and not exists(select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = lower(new.email)))) then
    raise exception 'Account identity fields are managed by the authentication system';
  end if;
  if new.avatar_url is distinct from old.avatar_url then
    if auth.uid() is not null and old.avatar_updated_at is not null and now() < old.avatar_updated_at + interval '24 hours' then
      raise exception 'Avatar can only be changed once every 24 hours';
    end if;
    new.avatar_updated_at := now();
  else
    new.avatar_updated_at := old.avatar_updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists f4_guard_profile_changes_trigger on public.profiles;
create trigger f4_guard_profile_changes_trigger before insert or update on public.profiles for each row execute function public.f4_guard_profile_changes();

-- Promote the requested existing username if present. Verify the account identity in the SQL result after migration.
update public.profiles set role = 'developer' where lower(username) = 'arlec';

-- Public-read avatar bucket: uploads are restricted to each authenticated user's own folder.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('f4ntastic-avatars','f4ntastic-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "F4 avatars upload own folder" on storage.objects;
drop policy if exists "F4 avatars update own folder" on storage.objects;
drop policy if exists "F4 avatars delete own folder" on storage.objects;
create policy "F4 avatars upload own folder" on storage.objects for insert to authenticated with check (bucket_id='f4ntastic-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "F4 avatars update own folder" on storage.objects for update to authenticated using (bucket_id='f4ntastic-avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id='f4ntastic-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "F4 avatars delete own folder" on storage.objects for delete to authenticated using (bucket_id='f4ntastic-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

