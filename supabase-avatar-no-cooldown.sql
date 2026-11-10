-- F4NTASTIC · Hapus cooldown 24 jam ganti foto profil.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei. Aman dijalankan ulang.
-- Isi = pengaman profil terbaru (supabase-multi-role.sql, termasuk pengecualian Tamu → Member dari
-- supabase-division-add-by-ml.sql) TANPA cek "Avatar can only be changed once every 24 hours".

begin;

create or replace function public.f4_guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_roles text[];
  normalized_roles text[];
  highest_role text := 'tamu';
  candidate text;
  max_actor int;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.role := 'tamu';
      new.roles := array['tamu']::text[];
      select lower(au.email), coalesce(nullif(lower(trim(au.raw_user_meta_data ->> 'username')), ''), lower(split_part(au.email, '@', 1)))
        into new.email, new.username from auth.users au where au.id = auth.uid();
    end if;
    if new.avatar_url is not null then new.avatar_updated_at := now(); end if;
    return new;
  end if;

  normalized_roles := public.f4_normalize_roles(new.roles);
  if normalized_roles is null or cardinality(normalized_roles) = 0 then
    raise exception 'Role tidak dikenal';
  end if;
  foreach candidate in array normalized_roles loop
    if public.f4_role_rank(candidate) > public.f4_role_rank(highest_role) then highest_role := candidate; end if;
  end loop;
  new.roles := normalized_roles;
  new.role := highest_role;

  if auth.uid() is not null then
    select coalesce(p.roles, array[p.role]) into actor_roles from public.profiles p where p.id = auth.uid();
    if old.id = auth.uid() then
      new.role := old.role;
      new.roles := old.roles;
      new.username := old.username;
      new.email := old.email;
    elsif (new.role is distinct from old.role or new.roles is distinct from old.roles)
      -- single exception: f4_division_add_member_by_ml() may promote Tamu / Calon Member to plain Member
      -- (flag is transaction-local and keyed to the target id, so it cannot be set from the API)
      and not (coalesce(current_setting('f4.promote_member', true), '') = new.id::text
               and highest_role = 'member'
               and public.f4_role_rank(old.role) < public.f4_role_rank('member')) then
      if actor_roles is null or not (actor_roles && array['admin','developer','owner']::text[]) then
        raise exception 'Role cannot be changed by this account';
      end if;
      select max(public.f4_role_rank(x)) into max_actor from unnest(actor_roles) x;
      max_actor := coalesce(max_actor, -1);
      if public.f4_role_rank(old.role) > max_actor then
        raise exception 'Tidak bisa mengubah role akun yang lebih tinggi dari role kamu sendiri';
      end if;
      if public.f4_role_rank(highest_role) > max_actor then
        raise exception 'Role tujuan terlalu tinggi';
      end if;
    end if;
    if new.username is distinct from old.username or new.id is distinct from old.id or (new.email is distinct from old.email and not exists(select 1 from auth.users au where au.id = auth.uid() and lower(au.email) = lower(new.email))) then
      raise exception 'Account identity fields are managed by the authentication system';
    end if;
  end if;

  if new.avatar_url is distinct from old.avatar_url then
    new.avatar_updated_at := now();
  else new.avatar_updated_at := old.avatar_updated_at;
  end if;
  return new;
end;
$$;

commit;
