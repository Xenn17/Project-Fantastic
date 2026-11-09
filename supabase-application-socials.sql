-- F4NTASTIC APPLICATION SOCIALS
-- Username Instagram / TikTok pendaftar + status verifikasi follow oleh admin.
-- Jalankan di Supabase SQL Editor setelah supabase-application-auth.sql.
--
-- API resmi Instagram & TikTok tidak memberikan daftar follower akun kita, jadi pendaftar mengupload
-- screenshot bukti follow (daftar Following milik mereka sendiri) dan admin mengeceknya di panel admin.
-- Aman dijalankan ulang.

alter table public.applications add column if not exists instagram text;
alter table public.applications add column if not exists tiktok text;
alter table public.applications add column if not exists follow_verified boolean not null default false;
alter table public.applications add column if not exists follow_verified_at timestamptz;
-- Screenshot bukti follow (URL di bucket application-screenshots), dicek manual oleh admin.
alter table public.applications add column if not exists instagram_proof text;
alter table public.applications add column if not exists tiktok_proof text;

-- Hanya huruf, angka, titik, dan underscore (tanpa @), maksimal 30/24 karakter.
alter table public.applications drop constraint if exists applications_instagram_format;
alter table public.applications add constraint applications_instagram_format
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.applications drop constraint if exists applications_tiktok_format;
alter table public.applications add constraint applications_tiktok_format
  check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{2,24}$');

-- Update (verifikasi) sudah dicakup policy "Staff update applications" di supabase-application-auth.sql.
