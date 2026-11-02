-- F4NTASTIC APPLICATION AUDIT
-- Mencatat siapa (admin/developer/owner) yang menerima atau menolak pendaftar.
-- Jalankan setelah supabase-application-auth.sql.

alter table public.applications add column if not exists accepted_by uuid references auth.users(id) on delete set null;
alter table public.applications add column if not exists rejected_by uuid references auth.users(id) on delete set null;
alter table public.applications add column if not exists accepted_by_name text;
alter table public.applications add column if not exists rejected_by_name text;

create index if not exists applications_accepted_by_idx on public.applications(accepted_by);
create index if not exists applications_rejected_by_idx on public.applications(rejected_by);