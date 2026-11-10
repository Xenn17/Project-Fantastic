-- F4NTASTIC · Popup "Edit Divisi" di /devisi (menggantikan division-editor.html & manage-division.html).
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH file-file divisi sebelumnya
-- (roster → leader-manage → multi-leader → capacity). Aman dijalankan ulang.
--
-- Yang boleh edit divisi X = sama dengan pengelola member (f4_can_manage_roster):
-- admin/developer/owner, leader resmi divisi X, atau Leader Squad yang anggota divisi X.

begin;

-- kapasitas boleh diubah 1..25 (tidak dikunci 25 lagi)
alter table public.f4_divisions drop constraint if exists f4_divisions_capacity_check;
alter table public.f4_divisions add constraint f4_divisions_capacity_check check (capacity between 1 and 25);

-- ---------- simpan data divisi ----------
create or replace function public.f4_update_division(
  p_division smallint,
  p_squad_id text,
  p_whatsapp text,
  p_capacity smallint,
  p_status text,
  p_roles text[],
  p_description text,
  p_logo_url text
)
returns setof public.f4_divisions
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_old public.f4_divisions;
  v_status text := upper(coalesce(p_status, 'CLOSED'));
  v_roles text[];
  v_count int;
  v_logo text := nullif(trim(coalesce(p_logo_url, '')), '');
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengedit divisi ini.' using errcode = '42501';
  end if;
  select * into v_old from public.f4_divisions d where d.id = p_division;
  if v_old.id is null then raise exception 'Divisi % tidak ada.', p_division; end if;
  if v_status not in ('RECRUITING', 'CLOSED') then raise exception 'Status rekrutmen tidak dikenal.'; end if;

  v_count := public.f4_division_headcount(p_division);
  if p_capacity is null or p_capacity < 1 or p_capacity > 25 then
    raise exception 'Kapasitas harus 1 sampai 25.';
  end if;
  if p_capacity < v_count then
    raise exception 'Kapasitas tidak boleh lebih kecil dari jumlah anggota sekarang (%).', v_count;
  end if;
  if length(coalesce(p_description, '')) > 700 then raise exception 'Deskripsi maksimal 700 karakter.'; end if;
  if length(coalesce(p_squad_id, '')) > 30 then raise exception 'Squad ID maksimal 30 karakter.'; end if;
  if v_logo is not null and (v_logo !~ '^https://' or length(v_logo) > 600) then
    raise exception 'URL foto divisi tidak valid.';
  end if;

  select coalesce(array_agg(r order by array_position(array['EXP','JUNG','GOLD','MID','ROAM'], r)), '{}')
    into v_roles
  from (select distinct upper(trim(x)) as r from unnest(coalesce(p_roles, '{}')) x) s
  where r in ('EXP', 'JUNG', 'GOLD', 'MID', 'ROAM');
  if v_status = 'CLOSED' then v_roles := '{}'; end if;

  update public.f4_divisions d set
    squad_id = nullif(trim(coalesce(p_squad_id, '')), ''),
    whatsapp = left(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'), 20),
    capacity = p_capacity,
    recruitment_status = v_status,
    role_needs = to_jsonb(v_roles),
    description = trim(coalesce(p_description, '')),
    logo_url = v_logo,
    version = d.version + 1,
    updated_at = now()
  where d.id = p_division;

  if v_old.recruitment_status is distinct from v_status then
    insert into public.f4_division_activity (division_id, event_type, message)
    values (p_division,
            case when v_status = 'RECRUITING' then 'RECRUITMENT_OPENED' else 'RECRUITMENT_CLOSED' end,
            case when v_status = 'RECRUITING'
                 then 'DIV ' || lpad(p_division::text, 2, '0') || ' membuka rekrutmen' ||
                      case when cardinality(v_roles) > 0 then ' · mencari ' || array_to_string(v_roles, ', ') else '' end
                 else 'DIV ' || lpad(p_division::text, 2, '0') || ' menutup rekrutmen' end);
  end if;
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  select p_division, auth.uid(), 'UPDATE_DIVISION', to_jsonb(v_old), to_jsonb(d) from public.f4_divisions d where d.id = p_division;

  return query select * from public.f4_divisions d where d.id = p_division;
end;
$$;
revoke all on function public.f4_update_division(smallint, text, text, smallint, text, text[], text, text) from public;
grant execute on function public.f4_update_division(smallint, text, text, smallint, text, text[], text, text) to authenticated;

-- ---------- foto profil divisi (storage) ----------
-- file disimpan di  f4ntastic-division-logos/<nomor divisi>/<nama file>
create or replace function public.f4_can_manage_division_folder(p_folder text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_folder is null or p_folder !~ '^[0-9]{1,2}$' then return false; end if;
  if p_folder::int not between 1 and 41 then return false; end if;
  return public.f4_can_manage_roster(p_folder::smallint);
end;
$$;
revoke all on function public.f4_can_manage_division_folder(text) from public;
grant execute on function public.f4_can_manage_division_folder(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('f4ntastic-division-logos', 'f4ntastic-division-logos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "F4 division logos read" on storage.objects;
drop policy if exists "F4 division logos upload" on storage.objects;
drop policy if exists "F4 division logos update" on storage.objects;
drop policy if exists "F4 division logos delete" on storage.objects;
create policy "F4 division logos read" on storage.objects for select to authenticated
  using (bucket_id = 'f4ntastic-division-logos');
create policy "F4 division logos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'f4ntastic-division-logos' and public.f4_can_manage_division_folder((storage.foldername(name))[1]));
create policy "F4 division logos update" on storage.objects for update to authenticated
  using (bucket_id = 'f4ntastic-division-logos' and public.f4_can_manage_division_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'f4ntastic-division-logos' and public.f4_can_manage_division_folder((storage.foldername(name))[1]));
create policy "F4 division logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'f4ntastic-division-logos' and public.f4_can_manage_division_folder((storage.foldername(name))[1]));

commit;
