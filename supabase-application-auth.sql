-- F4NTASTIC APPLICATION AUTH + ACCEPTANCE EMAIL
-- Jalankan setelah supabase-applications.sql dan supabase-multi-role.sql.
-- 1. Pendaftaran Join Team hanya boleh dibuat oleh akun yang sedang login.
-- 2. Email pendaftar diambil otomatis dari akun Auth (tidak bisa dipalsukan).
-- 3. Screenshot hanya boleh diunggah ke folder milik user yang login.

alter table public.applications add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.applications add column if not exists email text;
alter table public.applications add column if not exists social_follow_confirmed boolean not null default false;
alter table public.applications add column if not exists accepted_email_sent_at timestamptz;

create index if not exists applications_user_id_idx on public.applications(user_id);
create index if not exists applications_email_idx on public.applications(lower(email));

-- Simpan email akun yang login sebagai sumber yang tervalidasi.
create or replace function public.f4_prepare_application()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  new.user_id := auth.uid();
  select lower(email) into new.email from auth.users where id = auth.uid();
  new.social_follow_confirmed := true;
  return new;
end;
$$;
drop trigger if exists f4_prepare_application_trigger on public.applications;
create trigger f4_prepare_application_trigger before insert on public.applications for each row execute function public.f4_prepare_application();

alter table public.applications enable row level security;
revoke all on public.applications from anon;
grant select, insert on public.applications to authenticated;

drop policy if exists "Allow public application inserts" on public.applications;
create policy "Authenticated users create own applications" on public.applications
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Authenticated users read own applications" on public.applications;
create policy "Authenticated users read own applications" on public.applications
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Allow admin panel reads" on public.applications;
create policy "Staff read applications" on public.applications
for select to authenticated using (public.f4_is_staff());

drop policy if exists "Allow admin panel updates" on public.applications;
create policy "Staff update applications" on public.applications
for update to authenticated using (public.f4_is_staff()) with check (public.f4_is_staff());

drop policy if exists "Allow admin panel deletes" on public.applications;
create policy "Staff delete applications" on public.applications
for delete to authenticated using (public.f4_is_staff());

-- Cek duplikat ID ML / WhatsApp secara aman tanpa membaca seluruh baris.
create or replace function public.f4_application_duplicate(p_ml_id text, p_whatsapp text)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.applications a
    where (lower(regexp_replace(trim(a.ml_id),'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(trim(p_ml_id),'[^a-zA-Z0-9]','','g')) and trim(coalesce(p_ml_id,'')) <> '')
       or (regexp_replace(trim(a.whatsapp),'[^0-9]','','g') = regexp_replace(trim(p_whatsapp),'[^0-9]','','g') and trim(coalesce(p_whatsapp,'')) <> '')
  );
$$;
revoke all on function public.f4_application_duplicate(text, text) from public;
grant execute on function public.f4_application_duplicate(text, text) to authenticated;

-- Screenshot hanya boleh diunggah ke folder milik user yang login.
drop policy if exists "Allow application screenshot uploads" on storage.objects;
create policy "Authenticated users upload own application screenshots" on storage.objects
for insert to authenticated
with check (bucket_id = 'application-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);