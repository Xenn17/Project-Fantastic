-- F4NTASTIC · Manage Role: KELUARKAN member & HAPUS AKUN (+ role "Ex Member" dan catatan kapan dikeluarkan).
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH supabase-multi-role.sql dan semua file divisi
-- (paling aman: setelah supabase-division-requests.sql). Aman dijalankan ulang.
--
-- Aturan (dicek di server):
--   * Hanya admin / developer / owner.
--   * Tidak bisa ke akun sendiri.
--   * Hanya ke akun yang role tertingginya DI BAWAH role tertinggi kamu
--     (admin → leader squad ke bawah, developer → admin ke bawah, owner → developer ke bawah).
--
-- KELUARKAN: lepas dari divisi (anggota + leader), permintaan masuk divisi ditutup,
--            role jadi Tamu + Ex Member, dicatat di f4_account_actions (kapan, oleh siapa, alasan, divisi sebelumnya).
-- HAPUS AKUN: akun login (auth.users) + profil dihapus permanen, dicatat juga di f4_account_actions.

begin;

-- ---------- 1. role "ex_member" (tanda, peringkat sama dengan Tamu) ----------
create or replace function public.f4_role_rank(p_role text)
returns int language sql immutable set search_path = public, pg_temp as $$
  select case lower(p_role)
    when 'tamu' then 0 when 'ex_member' then 0 when 'calon_member' then 1 when 'member' then 2
    when 'leader_squad' then 3 when 'admin' then 4 when 'developer' then 5
    when 'owner' then 6 else -1 end;
$$;

alter table public.profiles drop constraint if exists profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check check (
  roles <@ array['tamu','ex_member','calon_member','member','leader_squad','admin','developer','owner']::text[]
  and cardinality(roles) > 0
);

-- Ex Member hanya menempel pada Tamu; hilang otomatis kalau diangkat lagi jadi Calon Member / Member.
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
     or not (v <@ array['tamu','ex_member','calon_member','member','leader_squad','admin','developer','owner']::text[]) then
    return null;
  end if;
  if v && array['calon_member','member','leader_squad','admin','developer','owner']::text[] then
    v := array(select x from unnest(v) x where x not in ('tamu', 'ex_member'));
  end if;
  if v && array['member','leader_squad','admin','developer','owner']::text[] then
    v := array(select x from unnest(v) x where x <> 'calon_member');
  end if;
  if v && array['leader_squad','admin','developer','owner']::text[]
     and not (array['member']::text[] <@ v) then
    v := array_append(v, 'member');
  end if;
  if v = array['ex_member']::text[] then
    v := array['ex_member', 'tamu']::text[];
  end if;
  return v;
end;
$$;
revoke all on function public.f4_normalize_roles(text[]) from public;
grant execute on function public.f4_normalize_roles(text[]) to authenticated;

-- ---------- 2. catatan tindakan akun ----------
create table if not exists public.f4_account_actions (
  id bigint generated always as identity primary key,
  action text not null check (action in ('expel', 'delete')),
  target_id uuid not null,              -- sengaja tanpa FK: catatan tetap ada walau akunnya dihapus
  target_username text,
  target_full_name text,
  target_email text,
  roles_before text[],
  member_division smallint,
  led_divisions smallint[],
  reason text check (reason is null or char_length(reason) <= 300),
  actor_id uuid,
  actor_username text,
  created_at timestamptz not null default now()
);
create index if not exists f4_account_actions_target_idx on public.f4_account_actions (target_id, created_at desc);
alter table public.f4_account_actions enable row level security;
drop policy if exists f4_account_actions_read on public.f4_account_actions;
create policy f4_account_actions_read on public.f4_account_actions for select to authenticated using (public.f4_is_staff());
-- tidak ada policy tulis: hanya lewat fungsi di bawah

-- ---------- 3. cek wewenang ----------
create or replace function public.f4_assert_can_manage_account(p_target_id uuid)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t public.profiles;
  max_actor int;
  max_target int;
begin
  if auth.uid() is null or not public.f4_is_staff() then
    raise exception 'Hanya admin, developer, atau owner yang bisa melakukan ini.' using errcode = '42501';
  end if;
  if p_target_id = auth.uid() then
    raise exception 'Tidak bisa melakukan ini ke akun sendiri.';
  end if;
  select * into t from public.profiles p where p.id = p_target_id for update;
  if not found then raise exception 'Akun tidak ditemukan.'; end if;
  select max(public.f4_role_rank(x)) into max_actor
    from public.profiles p, unnest(coalesce(p.roles, array[p.role])) x where p.id = auth.uid();
  select max(public.f4_role_rank(x)) into max_target from unnest(coalesce(t.roles, array[t.role])) x;
  if coalesce(max_target, -1) >= coalesce(max_actor, -1) then
    raise exception 'Akun ini setara atau lebih tinggi dari role kamu, jadi tidak bisa diubah.';
  end if;
  return t;
end;
$$;
revoke all on function public.f4_assert_can_manage_account(uuid) from public;

create or replace function public.f4_log_account_action(t public.profiles, p_action text, p_reason text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare v_at timestamptz := now();
begin
  insert into public.f4_account_actions
    (action, target_id, target_username, target_full_name, target_email, roles_before,
     member_division, led_divisions, reason, actor_id, actor_username, created_at)
  values
    (p_action, t.id, t.username, t.full_name, t.email, coalesce(t.roles, array[t.role]),
     (select r.division_id from public.f4_division_roster r where r.profile_id = t.id),
     (select array_agg(l.division_id order by l.division_id) from public.f4_division_leaders l where l.profile_id = t.id),
     nullif(left(trim(coalesce(p_reason, '')), 300), ''),
     auth.uid(), (select p.username from public.profiles p where p.id = auth.uid()), v_at);
  return v_at;
end;
$$;
revoke all on function public.f4_log_account_action(public.profiles, text, text) from public;

-- ---------- 4. KELUARKAN ----------
create or replace function public.f4_expel_member(p_target_id uuid, p_reason text default null)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t public.profiles;
  v_at timestamptz;
  v_divs smallint[];
  i smallint;
begin
  t := public.f4_assert_can_manage_account(p_target_id);
  v_at := public.f4_log_account_action(t, 'expel', p_reason);

  select array_agg(distinct x) into v_divs from (
    select r.division_id as x from public.f4_division_roster r where r.profile_id = t.id
    union select l.division_id from public.f4_division_leaders l where l.profile_id = t.id
  ) d;
  delete from public.f4_division_leaders l where l.profile_id = t.id;
  delete from public.f4_division_roster r where r.profile_id = t.id;
  update public.f4_division_requests q set status = 'cancelled', decided_at = v_at, decided_by = auth.uid()
   where q.profile_id = t.id and q.status = 'pending';
  foreach i in array coalesce(v_divs, array[]::smallint[]) loop
    perform public.f4_division_sync(i);
    insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
    values (i, auth.uid(), 'MEMBER_EXPELLED', jsonb_build_object('profile_id', t.id), null);
  end loop;

  -- trigger f4_guard_profile_changes menerima ini: pelaku staff & target di bawah wewenangnya
  update public.profiles p set roles = array['ex_member', 'tamu']::text[] where p.id = t.id;
  return v_at;
end;
$$;
revoke all on function public.f4_expel_member(uuid, text) from public;
grant execute on function public.f4_expel_member(uuid, text) to authenticated;

-- ---------- 5. HAPUS AKUN ----------
-- kolom yang menunjuk ke akun (nullable, ON DELETE NO ACTION / RESTRICT) → ON DELETE SET NULL,
-- supaya catatan lama (siapa yang menyetujui, dsb.) tidak mengunci penghapusan akun.
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, c.confrelid::regclass as ref,
           string_agg(quote_ident(a.attname), ', ' order by a.attnum) as cols
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and c.confdeltype in ('a', 'r')
      and c.conrelid::regclass::text not like 'auth.%'
      and c.conrelid::regclass::text not like 'storage.%'
    group by c.conname, c.conrelid, c.confrelid
    having bool_and(not a.attnotnull)
  loop
    execute format('alter table %s drop constraint %I, add constraint %I foreign key (%s) references %s(id) on delete set null',
                   r.tbl, r.conname, r.conname, r.cols, r.ref);
  end loop;
end $$;

create or replace function public.f4_delete_account(p_target_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  t public.profiles;
  v_divs smallint[];
  i smallint;
  v_table text;
begin
  t := public.f4_assert_can_manage_account(p_target_id);
  perform public.f4_log_account_action(t, 'delete', p_reason);
  select array_agg(distinct x) into v_divs from (
    select r.division_id as x from public.f4_division_roster r where r.profile_id = t.id
    union select l.division_id from public.f4_division_leaders l where l.profile_id = t.id
  ) d;
  begin
    delete from auth.users u where u.id = t.id;          -- profil, roster, leader, permintaan ikut terhapus (cascade)
    delete from public.profiles p where p.id = t.id;     -- jaga-jaga kalau profil tidak ter-cascade
  exception
    when foreign_key_violation then
      get stacked diagnostics v_table = table_name;
      raise exception 'Akun ini masih dipakai di tabel % (misalnya pernah mengunggah foto galeri). Hapus / alihkan data itu dulu.', coalesce(v_table, 'lain');
    when insufficient_privilege then
      raise exception 'Server tidak mengizinkan menghapus akun login dari sini. Hapus lewat Supabase Dashboard → Authentication → Users.';
  end;
  foreach i in array coalesce(v_divs, array[]::smallint[]) loop
    perform public.f4_division_sync(i);
  end loop;
end;
$$;
revoke all on function public.f4_delete_account(uuid, text) from public;
grant execute on function public.f4_delete_account(uuid, text) to authenticated;

commit;
