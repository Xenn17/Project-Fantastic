-- F4NTASTIC · Calon Member bisa membuka /devisi, permintaan masuk divisi, dan tambah non-member lewat username.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH semua file divisi
-- (roster → leader-manage → multi-leader → capacity → edit → add-by-ml → profile-complete → two-leaders).
-- Aman dijalankan ulang.
--
-- 1. /devisi bisa dibuka Calon Member (sebelumnya hanya Member ke atas).
-- 2. Akun yang belum punya divisi bisa MENGAJUKAN masuk ke satu divisi (1 permintaan aktif per akun).
--    Leader / Leader Squad divisi itu / admin bisa MENERIMA atau MENOLAK.
--    Diterima → masuk divisi; kalau masih Tamu / Calon Member otomatis jadi Member.
-- 3. Tambah member lewat username / nama sekarang juga menampilkan Tamu & Calon Member
--    (yang belum punya divisi). Saat dimasukkan, mereka otomatis jadi Member — sama seperti tambah lewat ID ML.

begin;

-- ---------- 1. akses direktori: Calon Member ke atas ----------
create or replace function public.f4_directory_has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.roles && array['calon_member','member','leader_squad','admin','developer','owner']::text[]
           or p.role in ('calon_member','member','leader_squad','admin','developer','owner'))
  )
$$;
revoke all on function public.f4_directory_has_access() from public;
grant execute on function public.f4_directory_has_access() to authenticated;

-- ---------- helper: Tamu / Calon Member → Member (dipakai fungsi lain, tidak bisa dipanggil dari API) ----------
create or replace function public.f4_promote_to_member(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.f4_profile_is_member(p_id) then return false; end if;
  -- flag transaksi-lokal yang dikenali trigger f4_guard_profile_changes (lihat supabase-division-add-by-ml.sql)
  perform set_config('f4.promote_member', p_id::text, true);
  update public.profiles p set roles = array['member']::text[] where p.id = p_id;
  perform set_config('f4.promote_member', '', true);
  return true;
end;
$$;
revoke all on function public.f4_promote_to_member(uuid) from public;

-- ---------- 3. cari akun tanpa divisi (semua role), tambahkan + jadikan Member ----------
drop function if exists public.f4_division_candidates(smallint, text);
create function public.f4_division_candidates(p_division smallint, p_query text)
returns table (id uuid, username text, full_name text, avatar_url text, role text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_q text := lower(trim(coalesce(p_query, '')));
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if length(v_q) < 2 then return; end if;
  return query
    select p.id, p.username, p.full_name, p.avatar_url, coalesce(p.role, 'tamu')
    from public.profiles p
    where not exists (select 1 from public.f4_division_roster r where r.profile_id = p.id)
      and (lower(coalesce(p.username, '')) like '%' || v_q || '%' or lower(coalesce(p.full_name, '')) like '%' || v_q || '%')
    order by (lower(coalesce(p.username, '')) = v_q) desc, p.username
    limit 10;
end;
$$;
revoke all on function public.f4_division_candidates(smallint, text) from public;
grant execute on function public.f4_division_candidates(smallint, text) to authenticated;

drop function if exists public.f4_division_add_member(smallint, uuid);
create function public.f4_division_add_member(p_division smallint, p_target_id uuid)
returns boolean -- true = akun dinaikkan jadi Member
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare v_cap smallint; v_count int; v_role text; v_promoted boolean;
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = p_target_id for update;
  if not found then raise exception 'Akun tidak ditemukan.'; end if;
  if exists (select 1 from public.f4_division_roster r where r.profile_id = p_target_id) then
    raise exception 'Akun ini sudah terdaftar di divisi lain. Minta admin untuk memindahkannya.';
  end if;
  select d.capacity into v_cap from public.f4_divisions d where d.id = p_division;
  if v_cap is null then raise exception 'Divisi % tidak ada.', p_division; end if;
  v_count := public.f4_division_headcount(p_division);
  if v_count >= v_cap and not exists (select 1 from public.f4_division_leaders l where l.division_id = p_division and l.profile_id = p_target_id) then
    raise exception 'Divisi % sudah penuh (%/%).', p_division, v_count, v_cap;
  end if;
  v_promoted := public.f4_promote_to_member(p_target_id);
  insert into public.f4_division_roster (profile_id, division_id, assigned_by) values (p_target_id, p_division, auth.uid());
  perform public.f4_division_sync(p_division);
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'ROSTER_ADD', jsonb_build_object('role', v_role),
          jsonb_build_object('profile_id', p_target_id, 'promoted_to_member', v_promoted));
  return v_promoted;
end;
$$;
revoke all on function public.f4_division_add_member(smallint, uuid) from public;
grant execute on function public.f4_division_add_member(smallint, uuid) to authenticated;

-- ---------- 2. permintaan masuk divisi ----------
create table if not exists public.f4_division_requests (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  division_id smallint not null references public.f4_divisions(id) on delete cascade,
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);
create unique index if not exists f4_division_requests_one_pending on public.f4_division_requests (profile_id) where status = 'pending';
create index if not exists f4_division_requests_division_idx on public.f4_division_requests (division_id, status);

alter table public.f4_division_requests enable row level security;
drop policy if exists f4_division_requests_read on public.f4_division_requests;
create policy f4_division_requests_read on public.f4_division_requests for select to authenticated
  using (profile_id = auth.uid() or public.f4_can_manage_roster(division_id));
-- tidak ada policy insert/update/delete: semua lewat RPC di bawah

-- ajukan
create or replace function public.f4_division_request_join(p_division smallint, p_message text default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint; v_cap smallint;
begin
  if auth.uid() is null or not public.f4_directory_has_access() then
    raise exception 'Hanya Calon Member ke atas yang bisa mengajukan masuk divisi.' using errcode = '42501';
  end if;
  if not public.f4_profile_is_complete(auth.uid()) then
    raise exception 'Lengkapi profil kamu dulu sebelum mengajukan masuk divisi.';
  end if;
  if exists (select 1 from public.f4_division_roster r where r.profile_id = auth.uid()) then
    raise exception 'Kamu sudah terdaftar di sebuah divisi.';
  end if;
  if exists (select 1 from public.f4_division_requests q where q.profile_id = auth.uid() and q.status = 'pending') then
    raise exception 'Kamu masih punya permintaan yang menunggu. Batalkan dulu kalau mau pindah tujuan.';
  end if;
  select d.capacity into v_cap from public.f4_divisions d where d.id = p_division;
  if v_cap is null then raise exception 'Divisi % tidak ada.', p_division; end if;
  if public.f4_division_headcount(p_division) >= v_cap then
    raise exception 'Divisi % sudah penuh.', p_division;
  end if;
  insert into public.f4_division_requests (profile_id, division_id, message)
  values (auth.uid(), p_division, nullif(left(trim(coalesce(p_message, '')), 300), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.f4_division_request_join(smallint, text) from public;
grant execute on function public.f4_division_request_join(smallint, text) to authenticated;

-- batalkan permintaan sendiri
create or replace function public.f4_division_request_cancel()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.f4_division_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
  where profile_id = auth.uid() and status = 'pending';
$$;
revoke all on function public.f4_division_request_cancel() from public;
grant execute on function public.f4_division_request_cancel() to authenticated;

-- daftar permintaan menunggu untuk satu divisi (pengelola divisi)
create or replace function public.f4_division_requests_pending(p_division smallint)
returns table (id bigint, profile_id uuid, username text, full_name text, avatar_url text, role text,
               game_role text, main_hero text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  return query
    select q.id, p.id, p.username, p.full_name, p.avatar_url, coalesce(p.role, 'tamu'), p.game_role, p.main_hero, q.message, q.created_at
    from public.f4_division_requests q join public.profiles p on p.id = q.profile_id
    where q.division_id = p_division and q.status = 'pending'
    order by q.created_at;
end;
$$;
revoke all on function public.f4_division_requests_pending(smallint) from public;
grant execute on function public.f4_division_requests_pending(smallint) to authenticated;

-- jumlah permintaan menunggu per divisi yang bisa dikelola pemanggil (untuk badge ✎)
create or replace function public.f4_division_request_counts()
returns table (division_id smallint, pending int)
language sql stable security definer set search_path = public, pg_temp as $$
  select q.division_id, count(*)::int
  from public.f4_division_requests q
  where q.status = 'pending' and public.f4_can_manage_roster(q.division_id)
  group by q.division_id;
$$;
revoke all on function public.f4_division_request_counts() from public;
grant execute on function public.f4_division_request_counts() to authenticated;

-- terima / tolak
create or replace function public.f4_division_request_decide(p_request bigint, p_approve boolean)
returns boolean -- true = akun dinaikkan jadi Member
language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.f4_division_requests; v_cap smallint; v_count int; v_promoted boolean := false;
begin
  select * into q from public.f4_division_requests r where r.id = p_request for update;
  if not found or q.status <> 'pending' then
    raise exception 'Permintaan ini sudah tidak aktif.';
  end if;
  if not public.f4_can_manage_roster(q.division_id) then
    raise exception 'Kamu tidak punya izin mengelola divisi ini.' using errcode = '42501';
  end if;
  if coalesce(p_approve, false) then
    perform 1 from public.profiles p where p.id = q.profile_id for update;
    if exists (select 1 from public.f4_division_roster r where r.profile_id = q.profile_id) then
      update public.f4_division_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid() where id = q.id;
      raise exception 'Akun ini sudah masuk divisi lain.';
    end if;
    select d.capacity into v_cap from public.f4_divisions d where d.id = q.division_id;
    v_count := public.f4_division_headcount(q.division_id);
    if v_count >= v_cap then
      raise exception 'Divisi % sudah penuh (%/%).', q.division_id, v_count, v_cap;
    end if;
    v_promoted := public.f4_promote_to_member(q.profile_id);
    insert into public.f4_division_roster (profile_id, division_id, assigned_by) values (q.profile_id, q.division_id, auth.uid());
    perform public.f4_division_sync(q.division_id);
    insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
    values (q.division_id, auth.uid(), 'REQUEST_APPROVE', jsonb_build_object('request_id', q.id),
            jsonb_build_object('profile_id', q.profile_id, 'promoted_to_member', v_promoted));
  end if;
  -- (diterima: trigger di bawah sudah menandai permintaan ini; tandai lagi dengan status yang benar)
  update public.f4_division_requests
     set status = case when coalesce(p_approve, false) then 'approved' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid()
   where id = q.id;
  return v_promoted;
end;
$$;
revoke all on function public.f4_division_request_decide(bigint, boolean) from public;
grant execute on function public.f4_division_request_decide(bigint, boolean) to authenticated;

-- akun yang masuk divisi lewat jalur apa pun → permintaan menunggu miliknya ditutup
create or replace function public.f4_roster_close_requests()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.f4_division_requests
     set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
   where profile_id = new.profile_id and status = 'pending';
  return new;
end;
$$;
revoke all on function public.f4_roster_close_requests() from public;
drop trigger if exists f4_roster_close_requests on public.f4_division_roster;
create trigger f4_roster_close_requests after insert or update of division_id on public.f4_division_roster
  for each row execute function public.f4_roster_close_requests();

commit;
