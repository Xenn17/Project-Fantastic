-- F4NTASTIC ROLE MANAGEMENT MIGRATION
-- Jalankan file ini SEKALI di Supabase SQL Editor pada proyek yang benar.
-- (Supabase Auth skinning boleh: menu Database > SQL Editor > New query > paste > Run.)
-- Backup database dulu sebelum migrasi.
--
-- Yang dilakukan file ini:
--   1. Role baru: 'tamu' (default akun baru), 'member', 'leader_squad',
--      'admin', 'developer', 'owner'.
--   2. Trigger guard diubah: hanya admin/developer/owner yang boleh mengganti
--      role user lain, dan tidak bisa menetapkan role di atas role-nya sendiri.
--   3. Fungsi aman f4_set_profile_role() dipakai halaman Manage Role
--      (tidak membuka UPDATE langsung ke tabel profiles dari browser).
--   4. Policy laporan diperluas agar role baru tetap bisa membuat pengaduan.
--
-- Catatan: akun dengan role 'member' yang sudah ada TETAP 'member';
-- hanya akun BARU yang otomatis menjadi 'tamu'.

-- ============================================================
-- 0. Helper peringkat role (semakin tinggi, semakin berkuasa)
-- ============================================================
create or replace function public.f4_role_rank(p_role text)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(p_role)
    when 'tamu' then 0
    when 'member' then 1
    when 'leader_squad' then 2
    when 'admin' then 3
    when 'developer' then 4
    when 'owner' then 5
    else -1
  end;
$$;
revoke all on function public.f4_role_rank(text) from public;
grant execute on function public.f4_role_rank(text) to authenticated;

-- ============================================================
-- 1. Kolom role: default 'tamu' + daftar role lengkap
-- ============================================================
alter table public.profiles alter column role set default 'tamu';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in ('tamu','calon_member','member','leader_squad','admin','developer','owner')
);

-- ============================================================
-- 2. Helper staff diperluas: admin / developer / owner
-- ============================================================
create or replace function public.f4_is_staff()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','developer','owner')
  );
$$;
revoke all on function public.f4_is_staff() from public;
grant execute on function public.f4_is_staff() to authenticated;

-- Policy baca semua profil untuk pengelola (dipakai halaman Manage Role).
drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles" on public.profiles
for select to authenticated
using (auth.uid() = id or public.f4_is_staff());

-- ============================================================
-- 3. Guard profile: izinkan pengelola mengganti role user lain,
--    blokir self-promotion, blokir kenaikan di atas role pengelola.
-- ============================================================
create or replace function public.f4_guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_role text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      -- Semua akun baru mulai sebagai TAMU; tidak boleh memilih role sendiri.
      new.role := 'tamu';
      select lower(au.email), coalesce(nullif(lower(trim(au.raw_user_meta_data ->> 'username')), ''), lower(split_part(au.email, '@', 1)))
        into new.email, new.username from auth.users au where au.id = auth.uid();
    end if;
    if new.avatar_url is not null then new.avatar_updated_at := now(); end if;
    return new;
  end if;

  if auth.uid() is not null then
    if old.id = auth.uid() then
      -- Pemilik akun tidak boleh mengganti role/identitas; pertahankan nilai lama
      -- alih-alih melempar error, karena upsert memicu cabang INSERT lebih dulu.
      new.role := old.role;
      new.username := old.username;
      new.email := old.email;
    elsif new.role is distinct from old.role then
      -- Perubahan role hanya boleh dilakukan pengelola
      -- (admin/developer/owner) dan tidak boleh menetapkan role
      -- yang peringkatnya lebih tinggi dari role pengelola itu sendiri.
      select role into actor_role from public.profiles where id = auth.uid();
      if actor_role is null
         or actor_role not in ('admin','developer','owner')
         or public.f4_role_rank(new.role) > public.f4_role_rank(actor_role) then
        raise exception 'Role cannot be changed by this account';
      end if;
    end if;
    if new.username is distinct from old.username or new.id is distinct from old.id or (new.email is distinct from old.email and not exists(select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = lower(new.email))) then
      raise exception 'Account identity fields are managed by the authentication system';
    end if;
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

-- ============================================================
-- 4. Fungsi aman ganti role — dipanggil dari halaman Manage Role.
--    SECURITY DEFINER + validasi ketat, jadi browser tidak punya akses
--    UPDATE langsung ke kolom role.
-- ============================================================
create or replace function public.f4_set_profile_role(
  p_target_id uuid,
  p_role text
) returns public.profiles
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_actor_role text;
  v_row public.profiles;
begin
  select role into v_actor_role from public.profiles where id = auth.uid();
  if v_actor_role is null or v_actor_role not in ('admin','developer','owner') then
    raise exception 'Hanya admin, developer, atau owner yang dapat mengelola role';
  end if;
  if p_role is null or public.f4_role_rank(p_role) < 0 then
    raise exception 'Role tidak dikenal';
  end if;
  if p_target_id = auth.uid() then
    raise exception 'Tidak dapat mengubah role akun sendiri';
  end if;
  if public.f4_role_rank(p_role) > public.f4_role_rank(v_actor_role) then
    raise exception 'Role tujuan tidak boleh lebih tinggi dari role kamu sendiri';
  end if;
  select * into v_row from public.profiles where id = p_target_id for update;
  if not found then
    raise exception 'Profil tidak ditemukan';
  end if;
  -- Tidak bisa mengubah role akun yang saat ini lebih tinggi dari role kamu.
  if public.f4_role_rank(v_row.role) > public.f4_role_rank(v_actor_role) then
    raise exception 'Tidak bisa mengubah role akun yang lebih tinggi dari role kamu sendiri';
  end if;
  update public.profiles set role = p_role where id = p_target_id returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.f4_set_profile_role(uuid, text) from public;
grant execute on function public.f4_set_profile_role(uuid, text) to authenticated;

-- ============================================================
-- 5. Policy laporan diperluas ke role baru
-- ============================================================
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

-- Role baru ikut muncul pada pilihan target pengaduan.
create or replace function public.f4_member_list()
returns table (id uuid, username text, full_name text, avatar_url text)
language sql security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.full_name, p.avatar_url
  from public.profiles p
  where p.role in ('tamu','calon_member','member','leader_squad','admin','developer','owner')
  order by p.username asc;
$$;
revoke all on function public.f4_member_list() from public;
grant execute on function public.f4_member_list() to authenticated;

create or replace function public.f4_member_search(p_query text)
returns table (id uuid, username text, full_name text, avatar_url text)
language sql security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.full_name, p.avatar_url
  from public.profiles p
  where p.role in ('tamu','calon_member','member','leader_squad','admin','developer','owner')
    and (lower(p.username) like '%' || lower(trim(p_query)) || '%' or lower(coalesce(p.full_name,'')) like '%' || lower(trim(p_query)) || '%')
  order by p.username asc
  limit 8;
$$;
revoke all on function public.f4_member_search(text) from public;
grant execute on function public.f4_member_search(text) to authenticated;

-- Owner juga termasuk staff untuk membaca bukti laporan.
drop policy if exists "Members read own report evidence" on storage.objects;
create policy "Members read own report evidence" on storage.objects
for select to authenticated
using (
  bucket_id='complaint-evidence'
  and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','developer','owner')))
);