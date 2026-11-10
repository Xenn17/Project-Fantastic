-- F4NTASTIC · Satu divisi bisa punya SAMPAI 2 LEADER.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH semua file divisi
-- (roster → leader-manage → multi-leader → capacity → edit → add-by-ml → profile-complete). Aman dijalankan ulang.
-- Kalau nanti salah satu file divisi lama dijalankan ulang, jalankan file ini lagi sesudahnya.
--
-- Model:
--   * f4_division_leaders: kunci (division_id, profile_id) → maksimal 2 baris per divisi (dijaga trigger).
--   * Satu akun tetap boleh memimpin beberapa divisi.
--   * Kedua leader sama-sama bisa mengedit divisi & mengelola member (f4_can_manage_roster sudah memakai EXISTS).
--   * f4_divisions.leader_name = "leader1 & leader2" (urut waktu diangkat).

begin;

-- ---------- tabel: kunci baru (division_id, profile_id) ----------
alter table public.f4_division_leaders drop constraint if exists f4_division_leaders_pkey;
alter table public.f4_division_leaders add constraint f4_division_leaders_pkey primary key (division_id, profile_id);
create index if not exists f4_division_leaders_profile_idx on public.f4_division_leaders (profile_id);

create or replace function public.f4_leaders_max_two()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- serialise per divisi supaya dua admin yang menambah leader bersamaan tidak menghasilkan 3 leader
  perform pg_advisory_xact_lock(hashtext('f4_division_leaders'), new.division_id::int);
  if (select count(*) from public.f4_division_leaders l
      where l.division_id = new.division_id and l.profile_id <> new.profile_id) >= 2 then
    raise exception 'DIV % sudah punya 2 leader. Lepas salah satu leader dulu.', lpad(new.division_id::text, 2, '0');
  end if;
  return new;
end;
$$;
revoke all on function public.f4_leaders_max_two() from public;
drop trigger if exists f4_leaders_max_two on public.f4_division_leaders;
create trigger f4_leaders_max_two before insert or update of division_id, profile_id on public.f4_division_leaders
  for each row execute function public.f4_leaders_max_two();

-- ---------- sinkron: leader_name = gabungan nama leader ----------
create or replace function public.f4_division_sync(p_division smallint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_division is null then return; end if;
  update public.f4_divisions d set
    member_count = least(25, public.f4_division_headcount(p_division)),
    leader_name = (select string_agg(coalesce(nullif(p.username, ''), p.full_name), ' & ' order by l.assigned_at, p.username)
                   from public.f4_division_leaders l join public.profiles p on p.id = l.profile_id
                   where l.division_id = p_division),
    version = d.version + 1,
    updated_at = now()
  where d.id = p_division;
end;
$$;
revoke all on function public.f4_division_sync(smallint) from public;

-- ---------- tambah leader (TIDAK lagi menggantikan leader lama). p_profile_id null = kosongkan semua leader ----------
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
    if exists (select 1 from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = p_profile_id) then
      return; -- sudah leader di divisi ini
    end if;
    if not public.f4_profile_is_member(p_profile_id) then
      raise exception 'Leader harus akun dengan status Member.';
    end if;
    select count(*) into v_count from (
      select r.profile_id from public.f4_division_roster r where r.division_id = p_division
      union select l.profile_id from public.f4_division_leaders l where l.division_id = p_division
      union select p_profile_id
    ) x;
    if v_count > v_cap then
      raise exception 'Divisi % sudah penuh (%/%).', p_division, v_count - 1, v_cap;
    end if;
    insert into public.f4_division_leaders (division_id, profile_id, assigned_by)
    values (p_division, p_profile_id, auth.uid());
  end if;
  perform public.f4_division_sync(p_division);
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'LEADER_SET', null, jsonb_build_object('profile_id', p_profile_id));
end;
$$;
revoke all on function public.f4_set_division_leader(smallint, uuid) from public;
grant execute on function public.f4_set_division_leader(smallint, uuid) to authenticated;

-- ---------- lepas SATU leader dari satu divisi (leader lain tetap) ----------
create or replace function public.f4_remove_division_leader(p_division smallint, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.f4_is_staff() then
    raise exception 'Hanya admin, developer, atau owner yang bisa melepas leader.' using errcode = '42501';
  end if;
  delete from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = p_profile_id;
  if found then
    perform public.f4_division_sync(p_division);
    insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
    values (p_division, auth.uid(), 'LEADER_REMOVE', jsonb_build_object('profile_id', p_profile_id), null);
  end if;
end;
$$;
revoke all on function public.f4_remove_division_leader(smallint, uuid) from public;
grant execute on function public.f4_remove_division_leader(smallint, uuid) to authenticated;

-- ---------- keanggotaan: p_is_leader menambah (bukan mengganti) leader ----------
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
      on conflict (division_id, profile_id) do nothing;
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

do $$ declare i smallint; begin
  for i in select id from public.f4_divisions loop perform public.f4_division_sync(i); end loop;
end $$;

commit;
