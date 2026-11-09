-- F4NTASTIC APPLICATION FOLLOW PROOF
-- Screenshot bukti follow Instagram & TikTok dari pendaftar Join Team.
-- Jalankan di Supabase SQL Editor (project uxkieyunztzhiwrocnei) setelah supabase-application-auth.sql.
-- Aman dijalankan ulang.
--
-- API resmi Instagram & TikTok tidak memberikan daftar follower akun kita, jadi pendaftar mengupload
-- screenshot daftar Following milik mereka sendiri. Admin melihat buktinya di panel admin lalu
-- langsung TERIMA / TOLAK.

alter table public.applications add column if not exists instagram_proof text;
alter table public.applications add column if not exists tiktok_proof text;
