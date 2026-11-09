-- F4NTASTIC APPLICATION SOCIALS
-- Username Instagram / TikTok pendaftar + status verifikasi follow oleh admin.
-- Jalankan di Supabase SQL Editor setelah supabase-application-auth.sql.
--
-- API resmi Instagram & TikTok tidak memberikan daftar follower akun kita. Karena itu panel admin
-- memakai file export resmi ("Download your information") yang diupload admin: daftar followers
-- dicocokkan di browser admin (file tidak dikirim ke server), lalu hanya status cocok yang disimpan.
-- Aman dijalankan ulang.

alter table public.applications add column if not exists instagram text;
alter table public.applications add column if not exists tiktok text;
alter table public.applications add column if not exists follow_verified boolean not null default false;
alter table public.applications add column if not exists follow_verified_at timestamptz;
-- Per jaringan (diisi otomatis oleh "Cek Follow Otomatis" di panel admin dari file export followers).
alter table public.applications add column if not exists instagram_verified boolean not null default false;
alter table public.applications add column if not exists instagram_verified_at timestamptz;
alter table public.applications add column if not exists tiktok_verified boolean not null default false;
alter table public.applications add column if not exists tiktok_verified_at timestamptz;

-- Hanya huruf, angka, titik, dan underscore (tanpa @), maksimal 30/24 karakter.
alter table public.applications drop constraint if exists applications_instagram_format;
alter table public.applications add constraint applications_instagram_format
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.applications drop constraint if exists applications_tiktok_format;
alter table public.applications add constraint applications_tiktok_format
  check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{2,24}$');

-- Update (verifikasi) sudah dicakup policy "Staff update applications" di supabase-application-auth.sql.
