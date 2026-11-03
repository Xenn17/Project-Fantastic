-- F4NTASTIC ROLE MODEL — FINAL
-- Satu akun dapat memiliki beberapa role.
-- Hierarki: Tamu < Calon Member < Member < Leader Squad < Admin < Developer < Owner
-- Aturan:
--   - Status keanggotaan (Tamu / Calon Member / Member) bersifat eksklusif.
--   - Leader Squad, Admin, Developer, Owner otomatis terhitung sebagai Member.
--   - Kolom lama `role` disinkronkan ke role tertinggi (untuk tampilan lama).
-- File ini IDEMPOTEN: aman dijalankan ulang, dan sudah mencakup isi
-- supabase-role-management.sql + supabase-multi-role.sql sebelumnya.

-- 1. Peringkat role.
create or replace function public.f4_role_rank(p_role text)
returns int language sql immutable set search_path = public, pg_temp as $$
  select case lower(p_role)
    when 'tamu' then 0 when 'calon_member' then 1 when 'member' then 2
    when 'leader_squad' then 3 when 'admin' then 4 when 'developer' then 5
    when 'owner' then 6 else -1 end;

-- 2. Kolom roles (array).
alter table public.profiles add column if not exists roles text[] not null default array['tamu']::text[];

-- Backfill akun lama (idempotent: hanya menyentuh baris yang masih default/legacy).
update public.profiles
set roles = case
  when role in ('leader_squad','admin','developer','owner') then array['member', role]::text[]
  else array[coalesce(role, 'tamu')]::text[]
end
where roles is null or cardinality(roles) = 0 or roles = array['tamu']::text[];

alter table public.profiles drop constraint if exists profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check check (
  roles <@ array['tamu','calon_member','member','leader_squad','admin','developer','owner']::text[]
  and cardinality(roles) > 0
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in ('tamu','calon_member','member','leader_squad','admin','developer','owner')
);

-- 3. Normalisasi role (dipakai trigger + fungsi setter).
--    - Status keanggotaan eksklusif: Tamu hilang bila ada status di atasnya,
--      Calon Member hilang bila sudah Member atau lebih.
--    - Role pengelola otomatis menambah Member.
create or replace function public.f4_normalize_roles(p_roles text[])
returns text[] language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v text[];
begin
  select array_agg(distinct lower(trim(x)) order by lower(trim(x)))
    into v
    from unnest(coalesce(p_roles, array[]::text[])) x
    where trim(x) <> '';
  if v is null or cardinality(v) = 0
     or not (v <@ array['tamu','calon_member','member','leader_squad','admin','developer','owner']::text[]) then
    return null;
  end if;
  if v && array['calon_member','member','leader_squad','admin','developer','owner']::text[] then
    v := array(select x from unnest(v) x where x <> 'tamu');
  end if;
  if v && array['member','leader_squad','admin','developer','owner']::text[] then
    v := array(select x from unnest(v) x where x <> 'calon_member');
  end if;
  if v && array['leader_squad','admin','developer','owner']::text[]
     and not (array['member']::text[] <@ v) then
    v := array_append(v, 'member');
  end if;
  return v;
end;
$$;
revoke all on function public.f4_normalize_roles(text[]) from public;
grant execute on function public.f4_normalize_roles(text[]) to authenticated;

-- 4. Helper aman untuk policy / query.
create or replace function public.f4_has_role(p_role text)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.roles @> array[lower(p_role)]::text[] or p.role = lower(p_role))
  );
$$;
revoke all on function public.f4_has_role(text) from public;
grant execute on function public.f4_has_role(text) to authenticated;

create or replace function public.f4_is_staff()
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select public.f4_has_role('admin') or public.f4_has_role('developer') or public.f4_has_role('owner');
$$;
revoke all on function public.f4_is_staff() from public;
grant execute on function public.f4_is_staff() to authenticated;

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles" on public.profiles
for select to authenticated
using (auth.uid() = id or public.f4_is_staff());

-- 5. Trigger guard:
--    - INSERT (akun baru) => ['tamu'].
--    - Role dinormalisasi (status eksklusif + member otomatis).
--    - `role` (tunggal) = role tertinggi.
--    - Pemilik tidak bisa mengubah role sendiri.
--    - Perubahan role hanya oleh pengelola; tidak boleh melewati peringkatnya.
create or replace function public.f4_guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_roles text[];
  normalized_roles text[];
  highest_role text := 'tamu';
  candidate text;
  max_actor int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.role := 'tamu';
      new.roles := array['tamu']::text[];
      select lower(au.email), coalesce(nullif(lower(trim(au.raw_user_meta_data ->> 'username')), ''), lower(split_part(au.email, '@', 1)))
        into new.email, new.username from auth.users au where au.id = auth.uid();
    end if;
    if new.avatar_url is not null then new.avatar_updated_at := now(); end if;
    return new;
  end if;

  normalized_roles := public.f4_normalize_roles(new.roles);
  if normalized_roles is null or cardinality(normalized_roles) = 0 then
    raise exception 'Role tidak dikenal';
  end if;
  foreach candidate in array normalized_roles loop
    if public.f4_role_rank(candidate) > public.f4_role_rank(highest_role) then highest_role := candidate; end if;
  end loop;
  new.roles := normalized_roles;
  new.role := highest_role;

  if auth.uid() is not null then
    select coalesce(p.roles, array[p.role]) into actor_roles from public.profiles p where p.id = auth.uid();
    if old.id = auth.uid() then
      new.role := old.role;
      new.roles := old.roles;
      new.username := old.username;
      new.email := old.email;
    elsif new.role is distinct from old.role or new.roles is distinct from old.roles then
      if actor_roles is null or not (actor_roles && array['admin','developer','owner']::text[]) then
        raise exception 'Role cannot be changed by this account';
      end if;
      select max(public.f4_role_rank(x)) into max_actor from unnest(actor_roles) x;
      max_actor := coalesce(max_actor, -1);
      if public.f4_role_rank(old.role) > max_actor then
        raise exception 'Tidak bisa mengubah role akun yang lebih tinggi dari role kamu sendiri';
      end if;
      if public.f4_role_rank(highest_role) > max_actor then
        raise exception 'Role tujuan terlalu tinggi';
      end if;
    end if;
    if new.username is distinct from old.username or new.id is distinct from old.id or (new.email is distinct from old.email and not exists(select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = lower(new.email))) then
      raise exception 'Account identity fields are managed by the authentication system';
    end if;
  end if;

  if new.avatar_url is distinct from old.avatar_url then
    if auth.uid() is not null and old.avatar_updated_at is not null and now() < old.avatar_updated_at + interval '24 hours' then raise exception 'Avatar can only be changed once every 24 hours'; end if;
    new.avatar_updated_at := now();
  else new.avatar_updated_at := old.avatar_updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists f4_guard_profile_changes_trigger on public.profiles;
create trigger f4_guard_profile_changes_trigger before insert or update on public.profiles for each row execute function public.f4_guard_profile_changes();

-- 6. Fungsi aman multi-role untuk halaman Manage Role.
drop function if exists public.f4_set_profile_role(uuid, text);
drop function if exists public.f4_set_profile_roles(uuid, text[]);
create or replace function public.f4_set_profile_roles(p_target_id uuid, p_roles text[])
returns public.profiles language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  actor_roles text[];
  target public.profiles;
  clean_roles text[];
  max_actor int;
  max_target int;
begin
  select coalesce(p.roles, array[p.role]) into actor_roles from public.profiles p where p.id = auth.uid();
  if actor_roles is null or not (actor_roles && array['admin','developer','owner']::text[]) then
    raise exception 'Hanya admin, developer, atau owner yang dapat mengelola role';
  end if;
  if p_target_id = auth.uid() then
    raise exception 'Tidak dapat mengubah role akun sendiri';
  end if;
  select * into target from public.profiles where id = p_target_id for update;
  if not found then raise exception 'Profil tidak ditemukan'; end if;
  clean_roles := public.f4_normalize_roles(p_roles);
  if clean_roles is null or cardinality(clean_roles) = 0 then
    raise exception 'Role tidak dikenal';
  end if;
  select max(public.f4_role_rank(x)) into max_actor from unnest(actor_roles) x;
  max_actor := coalesce(max_actor, -1);
  select max(public.f4_role_rank(x)) into max_target from unnest(coalesce(target.roles, array[target.role])) x;
  max_target := coalesce(max_target, -1);
  if max_target > max_actor then
    raise exception 'Tidak bisa mengubah role akun yang lebih tinggi dari role kamu sendiri';
  end if;
  if (select max(public.f4_role_rank(x)) from unnest(clean_roles) x) > max_actor then
    raise exception 'Role tujuan terlalu tinggi';
  end if;
  update public.profiles set roles = clean_roles where id = p_target_id returning * into target;
  return target;
end;
$$;
revoke all on function public.f4_set_profile_roles(uuid, text[]) from public;
grant execute on function public.f4_set_profile_roles(uuid, text[]) to authenticated;

-- 7. Policy laporan (termasuk role baru).
drop policy if exists "Members create own reports" on public.reports;
create policy "Members create own reports" on public.reports
for insert to authenticated
with check (
  reporter_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('tamu','calon_member','member','leader_squad','admin','developer','owner'))
);

drop policy if exists "Admins manage reports" on public.reports;
create policy "Admins manage reports" on public.reports
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','developer','owner')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','developer','owner')));

drop policy if exists "Members read own report evidence" on storage.objects;
create policy "Members read own report evidence" on storage.objects
for select to authenticated
using (
  bucket_id='complaint-evidence'
  and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','developer','owner')))
);

-- 8. Daftar target pengaduan: semua akun.
create or replace function public.f4_member_list()
returns table (id uuid, username text, full_name text, avatar_url text)
language sql security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.full_name, p.avatar_url from public.profiles p order by p.username asc;
$$;
revoke all on function public.f4_member_list() from public;
grant execute on function public.f4_member_list() to authenticated;

create or replace function public.f4_member_search(p_query text)
returns table (id uuid, username text, full_name text, avatar_url text)
language sql security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.full_name, p.avatar_url
  from public.profiles p
  where lower(p.username) like '%' || lower(trim(p_query)) || '%' or lower(coalesce(p.full_name,'')) like '%' || lower(trim(p_query)) || '%'
  order by p.username asc
  limit 8;
$$;
revoke all on function public.f4_member_search(text) from public;
grant execute on function public.f4_member_search(text) to authenticated;