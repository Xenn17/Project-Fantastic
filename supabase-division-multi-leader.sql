-- F4NTASTIC · Satu akun bisa jadi LEADER di lebih dari satu divisi.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH:
--   1. supabase-division-roster.sql   2. supabase-division-leader-manage.sql
--
-- Model:
--   * Keanggotaan (f4_division_roster): 1 akun = maksimal 1 divisi (tidak berubah).
--   * Kepemimpinan (f4_division_leaders): 1 divisi = 1 leader, tapi 1 akun boleh memimpin BANYAK divisi.
--     Leader otomatis tampil & terhitung di setiap divisi yang dia pimpin, walau keanggotaannya di divisi lain.
-- Aman dijalankan ulang.

begin;

-- ---------- isi divisi = anggota roster ∪ leader divisi ----------
create or replace function public.f4_division_headcount(p_division smallint)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from (
    select r.profile_id from public.f4_division_roster r where r.division_id = p_division
    union
    select l.profile_id from public.f4_division_leaders l where l.division_id = p_division
  ) x;
$$;
revoke all on function public.f4_division_headcount(smallint) from public;

create or replace function public.f4_division_sync(p_division smallint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_division is null then return; end if;
  update public.f4_divisions d set
    member_count = least(25, public.f4_division_headcount(p_division)),
    leader_name = (select coalesce(nullif(p.username, ''), p.full_name)
                   from public.f4_division_leaders l join public.profiles p on p.id = l.profile_id
                   where l.division_id = p_division),
    version = d.version + 1,
    updated_at = now()
  where d.id = p_division;
end;
$$;
revoke all on function public.f4_division_sync(smallint) from public;

-- ---------- keanggotaan: TIDAK lagi mencabut kepemimpinan di divisi lain ----------
create or replace function public.f4_set_profile_division(p_target_id uuid, p_division_id smallint, p_is_leader boolean default false)
returns table (profile_id uuid, division_id smallint, is_leader boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_old smallint;
  v_count int;
  v_cap smallint;
begin
  if auth.uid() is null or not public.f4_is_staff() then
    raise exception 'Hanya admin, developer, atau owner yang bisa mengatur divisi.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'Akun tidak ditemukan.';
  end if;
  select r.division_id into v_old from public.f4_division_roster r where r.profile_id = p_target_id;

  if p_division_id is null then
    delete from public.f4_division_roster r where r.profile_id = p_target_id;
  else
    select d.capacity into v_cap from public.f4_divisions d where d.id = p_division_id;
    if v_cap is null then raise exception 'Divisi % tidak ada.', p_division_id; end if;
    select count(*) into v_count from (
      select r.profile_id from public.f4_division_roster r where r.division_id = p_division_id
      union
      select l.profile_id from public.f4_division_leaders l where l.division_id = p_division_id
    ) x where x.profile_id <> p_target_id;
    if v_count >= v_cap then
      raise exception 'Divisi % sudah penuh (%/%).', p_division_id, v_count, v_cap;
    end if;
    insert into public.f4_division_roster as r (profile_id, division_id, assigned_by)
    values (p_target_id, p_division_id, auth.uid())
    on conflict (profile_id) do update
      set division_id = excluded.division_id,
          assigned_by = excluded.assigned_by,
          assigned_at = case when r.division_id = excluded.division_id then r.assigned_at else now() end;
    if coalesce(p_is_leader, false) then
      insert into public.f4_division_leaders (division_id, profile_id, assigned_by)
      values (p_division_id, p_target_id, auth.uid())
      on conflict (division_id) do update set profile_id = excluded.profile_id, assigned_by = excluded.assigned_by, assigned_at = now();
    end if;
  end if;

  perform public.f4_division_sync(v_old);
  if p_division_id is distinct from v_old then perform public.f4_division_sync(p_division_id); end if;

  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  select x, auth.uid(), 'ROSTER_ASSIGN',
         jsonb_build_object('profile_id', p_target_id, 'division_id', v_old),
         jsonb_build_object('profile_id', p_target_id, 'division_id', p_division_id)
  from unnest(array_remove(array[v_old, p_division_id], null)) as x
  group by x;

  return query
    select p_target_id, p_division_id,
           exists (select 1 from public.f4_division_leaders l where l.profile_id = p_target_id and l.division_id = p_division_id);
end;
$$;
revoke all on function public.f4_set_profile_division(uuid, smallint, boolean) from public;
grant execute on function public.f4_set_profile_division(uuid, smallint, boolean) to authenticated;

-- ---------- set / kosongkan leader satu divisi (p_profile_id null = tanpa leader) ----------
create or replace function public.f4_set_division_leader(p_division smallint, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_cap smallint; v_count int;
begin
  if auth.uid() is null or not public.f4_is_staff() then
    raise exception 'Hanya admin, developer, atau owner yang bisa memilih leader.' using errcode = '42501';
  end if;
  select d.capacity into v_cap from public.f4_divisions d where d.id = p_division;
  if v_cap is null then raise exception 'Divisi % tidak ada.', p_division; end if;

  if p_profile_id is null then
    delete from public.f4_division_leaders l where l.division_id = p_division;
  else
    if not public.f4_profile_is_member(p_profile_id) then
      raise exception 'Leader harus akun dengan status Member.';
    end if;
    -- leader baru menambah 1 orang kalau dia belum ada di divisi itu (leader lama yang bukan anggota roster ikut keluar)
    select count(*) into v_count from (
      select r.profile_id from public.f4_division_roster r where r.division_id = p_division
      union select p_profile_id
    ) x;
    if v_count > v_cap then
      raise exception 'Divisi % sudah penuh (%/%).', p_division, v_count - 1, v_cap;
    end if;
    insert into public.f4_division_leaders (division_id, profile_id, assigned_by)
    values (p_division, p_profile_id, auth.uid())
    on conflict (division_id) do update set profile_id = excluded.profile_id, assigned_by = excluded.assigned_by, assigned_at = now();
  end if;
  perform public.f4_division_sync(p_division);
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'LEADER_SET', null, jsonb_build_object('profile_id', p_profile_id));
end;
$$;
revoke all on function public.f4_set_division_leader(smallint, uuid) from public;
grant execute on function public.f4_set_division_leader(smallint, uuid) to authenticated;

-- ---------- tambah member (leader/admin): kapasitas = roster ∪ leader ----------
create or replace function public.f4_division_add_member(p_division smallint, p_target_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_cap smallint; v_count int;
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if exists (select 1 from public.f4_division_roster r where r.profile_id = p_target_id) then
    raise exception 'Akun ini sudah terdaftar di divisi lain. Minta admin untuk memindahkannya.';
  end if;
  if not public.f4_profile_is_member(p_target_id) then
    raise exception 'Hanya akun dengan status Member yang bisa dimasukkan ke divisi.';
  end if;
  select d.capacity into v_cap from public.f4_divisions d where d.id = p_division;
  if v_cap is null then raise exception 'Divisi % tidak ada.', p_division; end if;
  v_count := public.f4_division_headcount(p_division);
  if v_count >= v_cap and not exists (select 1 from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = p_target_id) then
    raise exception 'Divisi % sudah penuh (%/%).', p_division, v_count, v_cap;
  end if;
  insert into public.f4_division_roster (profile_id, division_id, assigned_by) values (p_target_id, p_division, auth.uid());
  perform public.f4_division_sync(p_division);
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'ROSTER_ADD', null, jsonb_build_object('profile_id', p_target_id));
end;
$$;

-- ---------- keluarkan: hanya dari divisi ini (kepemimpinan di divisi lain tetap) ----------
create or replace function public.f4_division_remove_member(p_division smallint, p_target_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.f4_division_roster r where r.profile_id = p_target_id and r.division_id = p_division)
     and not exists (select 1 from public.f4_division_leaders l where l.profile_id = p_target_id and l.division_id = p_division) then
    raise exception 'Akun ini tidak ada di divisi %.', p_division;
  end if;
  if not public.f4_is_staff() then
    if p_target_id = auth.uid() then
      raise exception 'Kamu tidak bisa mengeluarkan dirimu sendiri. Minta admin.';
    end if;
    if exists (select 1 from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = p_target_id) then
      raise exception 'Leader divisi hanya bisa dikeluarkan oleh admin.';
    end if;
  end if;
  delete from public.f4_division_leaders l where l.profile_id = p_target_id and l.division_id = p_division;
  delete from public.f4_division_roster r where r.profile_id = p_target_id and r.division_id = p_division;
  perform public.f4_division_sync(p_division);
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'ROSTER_REMOVE', jsonb_build_object('profile_id', p_target_id), null);
end;
$$;

-- ---------- roster publik: anggota + leader (in_roster = anggota tetap divisi itu) ----------
drop function if exists public.f4_division_roster();
create function public.f4_division_roster()
returns table (
  division_id smallint, profile_id uuid, is_leader boolean, in_roster boolean, assigned_at timestamptz,
  username text, full_name text, avatar_url text, roles text[], main_hero text, game_role text,
  profile_gallery text[], member_since timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  with m as (
    select r.division_id, r.profile_id, true as in_roster, r.assigned_at from public.f4_division_roster r
    union all
    select l.division_id, l.profile_id, false, l.assigned_at from public.f4_division_leaders l
    where not exists (select 1 from public.f4_division_roster r where r.profile_id = l.profile_id and r.division_id = l.division_id)
  )
  select m.division_id, p.id,
         exists (select 1 from public.f4_division_leaders l where l.division_id = m.division_id and l.profile_id = p.id),
         m.in_roster, m.assigned_at,
         p.username, p.full_name, p.avatar_url,
         coalesce(nullif(p.roles, '{}'), array[coalesce(p.role, 'member')]),
         p.main_hero, p.game_role, coalesce(p.profile_gallery, '{}'), p.created_at
  from m join public.profiles p on p.id = m.profile_id
  where public.f4_directory_has_access()
  order by m.division_id, lower(coalesce(p.username, p.full_name, ''));
$$;
revoke all on function public.f4_division_roster() from public;
grant execute on function public.f4_division_roster() to authenticated;

do $$ declare i smallint; begin
  for i in select id from public.f4_divisions loop perform public.f4_division_sync(i); end loop;
end $$;

commit;
