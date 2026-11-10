-- F4NTASTIC · Divisi berbasis akun (jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei,
-- SETELAH supabase-divisions.sql dan supabase-multi-role.sql).
--
-- Apa yang dilakukan file ini:
--   1. Menghapus data lama: semua baris f4_division_members (nickname + ID ML) dan nama leader teks.
--      Nomor WhatsApp, squad ID, kapasitas, deskripsi divisi TIDAK dihapus.
--   2. Membuat tabel f4_division_roster: 1 akun (profiles) = maksimal 1 divisi.
--   3. RPC f4_set_profile_division(): dipakai admin di Manage Role untuk memasukkan akun ke divisi / jadikan leader.
--   4. RPC f4_division_roster(): daftar member per divisi untuk halaman /devisi, HANYA data publik
--      (tanpa email, telepon, tanggal lahir, ID ML).
-- Aman dijalankan ulang.

begin;

-- ---------- 0. kolom f4_divisions: leader & jumlah member sekarang dihitung dari roster ----------
alter table public.f4_divisions alter column leader_name drop not null;
alter table public.f4_divisions alter column member_count set default 0;
alter table public.f4_divisions drop constraint if exists f4_divisions_member_count_check;
alter table public.f4_divisions add constraint f4_divisions_member_count_check check (member_count between 0 and 25);

-- ---------- 1. roster: akun → divisi ----------
create table if not exists public.f4_division_roster (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  division_id smallint not null references public.f4_divisions(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null
);
create index if not exists f4_division_roster_division_idx on public.f4_division_roster(division_id);

alter table public.f4_division_roster enable row level security;
drop policy if exists f4_roster_read on public.f4_division_roster;
create policy f4_roster_read on public.f4_division_roster for select to authenticated
  using (public.f4_directory_has_access() or profile_id = auth.uid());
-- Tidak ada policy insert/update/delete: semua perubahan lewat RPC f4_set_profile_division (security definer).

-- leader yang dihapus akunnya tidak boleh mengunci penghapusan profil
alter table public.f4_division_leaders drop constraint if exists f4_division_leaders_profile_id_fkey;
alter table public.f4_division_leaders add constraint f4_division_leaders_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

-- ---------- 2. hapus data lama (sesuai permintaan: member + nama leader; WA tetap) ----------
delete from public.f4_division_members;
update public.f4_divisions set leader_name = null, member_count = 0;

-- leader berbasis akun yang sudah ada tetap dipertahankan → masukkan juga ke roster divisinya
insert into public.f4_division_roster (profile_id, division_id, assigned_by)
select distinct on (l.profile_id) l.profile_id, l.division_id, l.assigned_by
from public.f4_division_leaders l
order by l.profile_id, l.assigned_at desc
on conflict (profile_id) do nothing;
delete from public.f4_division_leaders l
where not exists (select 1 from public.f4_division_roster r where r.profile_id = l.profile_id and r.division_id = l.division_id);

-- ---------- 3. sinkron angka member_count + leader_name dari roster ----------
create or replace function public.f4_division_sync(p_division smallint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_division is null then return; end if;
  update public.f4_divisions d set
    member_count = least(25, (select count(*) from public.f4_division_roster r where r.division_id = p_division)),
    leader_name = (select coalesce(nullif(p.username, ''), p.full_name)
                   from public.f4_division_leaders l join public.profiles p on p.id = l.profile_id
                   where l.division_id = p_division),
    version = d.version + 1,
    updated_at = now()
  where d.id = p_division;
end;
$$;
revoke all on function public.f4_division_sync(smallint) from public;

do $$ declare i smallint; begin
  for i in select id from public.f4_divisions loop perform public.f4_division_sync(i); end loop;
end $$;

-- ---------- 4. RPC admin: masukkan akun ke divisi (atau keluarkan) ----------
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
    delete from public.f4_division_leaders l where l.profile_id = p_target_id;
    delete from public.f4_division_roster r where r.profile_id = p_target_id;
  else
    select d.capacity into v_cap from public.f4_divisions d where d.id = p_division_id;
    if v_cap is null then raise exception 'Divisi % tidak ada.', p_division_id; end if;
    select count(*) into v_count from public.f4_division_roster r
      where r.division_id = p_division_id and r.profile_id <> p_target_id;
    if v_count >= v_cap then
      raise exception 'Divisi % sudah penuh (%/%).', p_division_id, v_count, v_cap;
    end if;

    insert into public.f4_division_roster as r (profile_id, division_id, assigned_by)
    values (p_target_id, p_division_id, auth.uid())
    on conflict (profile_id) do update
      set division_id = excluded.division_id,
          assigned_by = excluded.assigned_by,
          assigned_at = case when r.division_id = excluded.division_id then r.assigned_at else now() end;

    -- leader hanya untuk divisinya sendiri
    delete from public.f4_division_leaders l
      where l.profile_id = p_target_id and (not coalesce(p_is_leader, false) or l.division_id <> p_division_id);
    if coalesce(p_is_leader, false) then
      -- leader lama divisi ini tetap jadi member biasa
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
         jsonb_build_object('profile_id', p_target_id, 'division_id', p_division_id, 'is_leader', coalesce(p_is_leader, false))
  from unnest(array_remove(array[v_old, p_division_id], null)) as x
  group by x;

  return query
    select p_target_id, p_division_id,
           exists (select 1 from public.f4_division_leaders l where l.profile_id = p_target_id and l.division_id = p_division_id);
end;
$$;
revoke all on function public.f4_set_profile_division(uuid, smallint, boolean) from public;
grant execute on function public.f4_set_profile_division(uuid, smallint, boolean) to authenticated;

-- ---------- 5. RPC publik (untuk member yang login): roster + info akun publik ----------
create or replace function public.f4_division_roster()
returns table (
  division_id smallint, profile_id uuid, is_leader boolean, assigned_at timestamptz,
  username text, full_name text, avatar_url text, roles text[], main_hero text, game_role text,
  profile_gallery text[], member_since timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.division_id, p.id,
         exists (select 1 from public.f4_division_leaders l where l.division_id = r.division_id and l.profile_id = p.id),
         r.assigned_at,
         p.username, p.full_name, p.avatar_url,
         coalesce(nullif(p.roles, '{}'), array[coalesce(p.role, 'member')]),
         p.main_hero, p.game_role, coalesce(p.profile_gallery, '{}'), p.created_at
  from public.f4_division_roster r
  join public.profiles p on p.id = r.profile_id
  where public.f4_directory_has_access()
  order by r.division_id, lower(coalesce(p.username, p.full_name, ''));
$$;
revoke all on function public.f4_division_roster() from public;
grant execute on function public.f4_division_roster() to authenticated;

commit;
