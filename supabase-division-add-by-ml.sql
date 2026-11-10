-- F4NTASTIC · Tambah member ke divisi pakai ID Mobile Legends.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH supabase-multi-role.sql dan file-file divisi
-- (roster → leader-manage → multi-leader → capacity → edit). Aman dijalankan ulang.
--
-- Alur: Leader / admin mengetik ID ML persis di popup Edit Divisi → akun pemilik ID itu ditemukan (walau masih
-- Tamu / Calon Member) → TAMBAH = akun dijadikan Member + masuk divisi.
-- Keamanan:
--   * hanya pengelola divisi (f4_can_manage_roster) yang bisa mencari / menambah;
--   * pencarian harus ID ML PERSIS (bukan sebagian) dan tidak pernah mengembalikan ID ML-nya;
--   * kenaikan role dibatasi: Tamu / Calon Member → Member saja, hanya lewat fungsi ini.

begin;

-- 1. pengaman role (sama dengan supabase-multi-role.sql + satu pengecualian sempit, lihat "f4.promote_member")
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
    elsif (new.role is distinct from old.role or new.roles is distinct from old.roles)
      -- single exception: f4_division_add_member_by_ml() may promote Tamu / Calon Member to plain Member
      -- (flag is transaction-local and keyed to the target id, so it cannot be set from the API)
      and not (coalesce(current_setting('f4.promote_member', true), '') = new.id::text
               and highest_role = 'member'
               and public.f4_role_rank(old.role) < public.f4_role_rank('member')) then
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
    new.avatar_updated_at := now();
  else new.avatar_updated_at := old.avatar_updated_at;
  end if;
  return new;
end;
$$;

-- 2. cari akun berdasarkan ID ML persis
create or replace function public.f4_division_find_by_ml(p_division smallint, p_ml_id text)
returns table (id uuid, username text, full_name text, avatar_url text, role text, in_division smallint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_ml text := regexp_replace(coalesce(p_ml_id, ''), '\D', '', 'g');
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if length(v_ml) < 5 then return; end if;
  return query
    select p.id, p.username, p.full_name, p.avatar_url, p.role,
           (select r.division_id from public.f4_division_roster r where r.profile_id = p.id)
    from public.profiles p
    where regexp_replace(coalesce(p.ml_id, ''), '\D', '', 'g') = v_ml
    limit 3;
end;
$$;
revoke all on function public.f4_division_find_by_ml(smallint, text) from public;
grant execute on function public.f4_division_find_by_ml(smallint, text) to authenticated;

-- 3. tambah ke divisi berdasarkan ID ML (+ jadikan Member kalau masih Tamu / Calon Member)
create or replace function public.f4_division_add_member_by_ml(p_division smallint, p_ml_id text)
returns table (profile_id uuid, username text, promoted boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_ml text := regexp_replace(coalesce(p_ml_id, ''), '\D', '', 'g');
  v_target public.profiles;
  v_matches int;
  v_cap smallint;
  v_count int;
  v_promoted boolean := false;
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if length(v_ml) < 5 then raise exception 'ID ML tidak valid.'; end if;

  select count(*) into v_matches from public.profiles p where regexp_replace(coalesce(p.ml_id, ''), '\D', '', 'g') = v_ml;
  if v_matches = 0 then raise exception 'Tidak ada akun dengan ID ML itu. Pastikan pemiliknya sudah daftar & mengisi ID ML di profil.'; end if;
  if v_matches > 1 then raise exception 'ID ML ini dipakai lebih dari satu akun. Minta admin untuk mengecek.'; end if;
  select * into v_target from public.profiles p where regexp_replace(coalesce(p.ml_id, ''), '\D', '', 'g') = v_ml for update;

  if exists (select 1 from public.f4_division_roster r where r.profile_id = v_target.id) then
    raise exception 'Akun ini sudah terdaftar di divisi lain. Minta admin untuk memindahkannya.';
  end if;
  select d.capacity into v_cap from public.f4_divisions d where d.id = p_division;
  if v_cap is null then raise exception 'Divisi % tidak ada.', p_division; end if;
  v_count := public.f4_division_headcount(p_division);
  if v_count >= v_cap and not exists (select 1 from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = v_target.id) then
    raise exception 'Divisi % sudah penuh (%/%).', p_division, v_count, v_cap;
  end if;

  -- Tamu / Calon Member → Member (role lain dibiarkan)
  if not public.f4_profile_is_member(v_target.id) then
    perform set_config('f4.promote_member', v_target.id::text, true);
    update public.profiles p set roles = array['member']::text[] where p.id = v_target.id;
    perform set_config('f4.promote_member', '', true);
    v_promoted := true;
  end if;

  insert into public.f4_division_roster (profile_id, division_id, assigned_by) values (v_target.id, p_division, auth.uid());
  perform public.f4_division_sync(p_division);
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'ROSTER_ADD_BY_ML', jsonb_build_object('role', v_target.role),
          jsonb_build_object('profile_id', v_target.id, 'promoted_to_member', v_promoted));

  return query select v_target.id, v_target.username, v_promoted;
end;
$$;
revoke all on function public.f4_division_add_member_by_ml(smallint, text) from public;
grant execute on function public.f4_division_add_member_by_ml(smallint, text) to authenticated;

commit;
