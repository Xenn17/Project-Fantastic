-- F4NTASTIC · Setiap divisi = maksimal 25 orang (leader termasuk).
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei (setelah supabase-divisions.sql).
-- Aman dijalankan ulang.

begin;

update public.f4_divisions set capacity = 25, version = version + 1, updated_at = now()
where capacity <> 25;

alter table public.f4_divisions alter column capacity set default 25;
-- kunci di 25 supaya tidak bisa diubah lewat editor / API
alter table public.f4_divisions drop constraint if exists f4_divisions_capacity_check;
alter table public.f4_divisions add constraint f4_divisions_capacity_check check (capacity = 25);

commit;
