-- F4NTASTIC PASSWORD RESET (PURE RESEND)
-- Token reset password buatan sendiri; email dikirim lewat Resend dari Edge Function.
-- Token disimpan sebagai hash SHA-256, bukan plaintext.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx on public.password_reset_tokens(user_id);
create index if not exists password_reset_tokens_expiry_idx on public.password_reset_tokens(expires_at);

alter table public.password_reset_tokens enable row level security;
revoke all on public.password_reset_tokens from anon, authenticated;

-- Cari user berdasarkan email (khusus service_role / Edge Function).
create or replace function public.f4_find_user_by_email(p_email text)
returns uuid language sql security definer set search_path = public, auth, pg_temp as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.f4_find_user_by_email(text) from public;
grant execute on function public.f4_find_user_by_email(text) to service_role;

-- Bersihkan token lama (dipanggil Edge Function sesekali).
create or replace function public.f4_cleanup_reset_tokens()
returns void language sql security definer set search_path = public, pg_temp as $$
  delete from public.password_reset_tokens
  where expires_at < now() - interval '1 day' or (used_at is not null and used_at < now() - interval '1 day');
$$;
revoke all on function public.f4_cleanup_reset_tokens() from public;
grant execute on function public.f4_cleanup_reset_tokens() to service_role;