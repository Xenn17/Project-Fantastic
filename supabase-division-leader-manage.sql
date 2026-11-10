-- F4NTASTIC · Leader Squad boleh mengelola member DIVISINYA SENDIRI.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH supabase-division-roster.sql.
--
-- Aturan:
--   * Pengelola divisi X = admin/developer/owner, ATAU leader resmi divisi X (f4_division_leaders),
--     ATAU akun ber-role leader_squad yang terdaftar di roster divisi X.
--   * Non-admin hanya bisa MENAMBAH akun Member yang belum punya divisi (tidak bisa "mengambil" member divisi lain).
--   * Non-admin bisa MENGELUARKAN member dari divisinya, kecuali dirinya sendiri dan leader divisi.
--   * Memindah antar divisi & memilih leader tetap hanya admin (Manage Role).
-- Aman dijalankan ulang.

begin;

create or replace function public.f4_can_manage_roster(p_division smallint)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    public.f4_is_staff()
    or exists (select 1 from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = auth.uid())
    or (public.f4_has_role('leader_squad')
        and exists (select 1 from public.f4_division_roster r where r.division_id = p_division and r.profile_id = auth.uid()))
  );
$$;
revoke all on function public.f4_can_manage_roster(smallint) from public;
grant execute on function public.f4_can_manage_roster(smallint) to authenticated;

-- akun yang boleh masuk divisi: role Member ke atas
create or replace function public.f4_profile_is_member(p_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id
      and (coalesce(p.roles, '{}') && array['member','leader_squad','admin','developer','owner']::text[]
           or p.role in ('member','leader_squad','admin','developer','owner'))
  );
$$;
revoke all on function public.f4_profile_is_member(uuid) from public;

-- ---------- cari akun yang bisa ditambahkan (belum punya divisi) ----------
-- versi lebih baru (supabase-division-requests.sql) punya tipe hasil lain → hapus dulu
drop function if exists public.f4_division_candidates(smallint, text);
create function public.f4_division_candidates(p_division smallint, p_query text)
returns table (id uuid, username text, full_name text, avatar_url text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if length(v_q) < 2 then return; end if;
  return query
    select p.id, p.username, p.full_name, p.avatar_url
    from public.profiles p
    where not exists (select 1 from public.f4_division_roster r where r.profile_id = p.id)
      and public.f4_profile_is_member(p.id)
      and (lower(coalesce(p.username, '')) like '%' || v_q || '%' or lower(coalesce(p.full_name, '')) like '%' || v_q || '%')
    order by p.username
    limit 10;
end;
$$;
revoke all on function public.f4_division_candidates(smallint, text) from public;
grant execute on function public.f4_division_candidates(smallint, text) to authenticated;

-- ---------- tambah member ----------
-- versi lebih baru (supabase-division-requests.sql) punya tipe hasil lain → hapus dulu
drop function if exists public.f4_division_add_member(smallint, uuid);
create function public.f4_division_add_member(p_division smallint, p_target_id uuid)
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
revoke all on function public.f4_division_add_member(smallint, uuid) from public;
grant execute on function public.f4_division_add_member(smallint, uuid) to authenticated;

-- ---------- keluarkan member ----------
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
revoke all on function public.f4_division_remove_member(smallint, uuid) from public;
grant execute on function public.f4_division_remove_member(smallint, uuid) to authenticated;

commit;
