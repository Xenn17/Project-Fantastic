-- F4NTASTIC · Setiap divisi = maksimal 25 orang (leader termasuk). Awalnya semua di-set 25.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei (setelah supabase-divisions.sql).
-- Catatan: baris UPDATE di bawah mengembalikan SEMUA divisi ke 25. Cukup jalankan sekali di awal;
-- kalau dijalankan ulang, kapasitas yang sudah diubah leader lewat Edit Divisi ikut kembali ke 25.

begin;

update public.f4_divisions set capacity = 25, version = version + 1, updated_at = now()
where capacity <> 25;

alter table public.f4_divisions alter column capacity set default 25;
-- leader boleh menurunkan kapasitas lewat popup Edit Divisi, tapi tidak pernah lebih dari 25
alter table public.f4_divisions drop constraint if exists f4_divisions_capacity_check;
alter table public.f4_divisions add constraint f4_divisions_capacity_check check (capacity between 1 and 25);

commit;
