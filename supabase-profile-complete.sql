-- F4NTASTIC · Akun dengan profil belum lengkap tidak bisa dimasukkan ke divisi.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH file-file divisi
-- (roster → leader-manage → multi-leader → capacity → edit → add-by-ml). Aman dijalankan ulang.
--
-- "Lengkap" = 6 data wajib di profil terisi: full_name, phone, ml_id, ml_server, gender, birth_date
-- (sama dengan tanda * di halaman profil). Berlaku untuk semua jalur: Manage Role, Edit Divisi,
-- tambah via ID ML, dan memilih leader. Anggota lama yang sudah terlanjur di divisi tidak dikeluarkan.

begin;

create or replace function public.f4_profile_is_complete(p_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id
      and nullif(trim(coalesce(p.full_name, '')), '') is not null
      and nullif(trim(coalesce(p.phone, '')), '') is not null
      and nullif(trim(coalesce(p.ml_id, '')), '') is not null
      and nullif(trim(coalesce(p.ml_server, '')), '') is not null
      and nullif(trim(coalesce(p.gender::text, '')), '') is not null
      and p.birth_date is not null
  );
$$;
revoke all on function public.f4_profile_is_complete(uuid) from public;
grant execute on function public.f4_profile_is_complete(uuid) to authenticated;

create or replace function public.f4_require_complete_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- only new placements: inserting, or swapping in a different account
  if tg_op = 'UPDATE' and new.profile_id is not distinct from old.profile_id then
    return new;
  end if;
  if not public.f4_profile_is_complete(new.profile_id) then
    raise exception 'Profil akun ini belum lengkap (nama lengkap, no. HP, jenis kelamin, tanggal lahir, ID ML, server ML). Minta pemiliknya melengkapi profil dulu.';
  end if;
  return new;
end;
$$;
revoke all on function public.f4_require_complete_profile() from public;

drop trigger if exists f4_roster_require_complete on public.f4_division_roster;
create trigger f4_roster_require_complete before insert or update of profile_id on public.f4_division_roster
  for each row execute function public.f4_require_complete_profile();

drop trigger if exists f4_leaders_require_complete on public.f4_division_leaders;
create trigger f4_leaders_require_complete before insert or update of profile_id on public.f4_division_leaders
  for each row execute function public.f4_require_complete_profile();

commit;
