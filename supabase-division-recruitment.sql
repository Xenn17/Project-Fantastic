-- F4NTASTIC · Leader membuka / menutup rekrutmen divisinya + memilih role yang sedang dicari.
-- Jalankan di Supabase SQL Editor project uxkieyunztzhiwrocnei SETELAH supabase-division-leader-manage.sql.
-- Izin sama dengan Manage Devisi (f4_can_manage_roster): admin/dev/owner, leader resmi divisi,
-- atau Leader Squad yang menjadi anggota divisi itu. Aman dijalankan ulang.

begin;

create or replace function public.f4_set_division_recruitment(p_division smallint, p_status text, p_roles text[])
returns table (recruitment_status text, role_needs jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_status text := upper(coalesce(p_status, ''));
  v_roles text[];
  v_old text;
begin
  if not public.f4_can_manage_roster(p_division) then
    raise exception 'Kamu tidak punya izin mengatur rekrutmen divisi ini.' using errcode = '42501';
  end if;
  if v_status not in ('RECRUITING', 'CLOSED') then
    raise exception 'Status rekrutmen tidak dikenal.';
  end if;
  -- hanya role yang dikenal, tanpa duplikat, urutan tetap
  select coalesce(array_agg(r order by array_position(array['EXP','JUNG','GOLD','MID','ROAM'], r)), '{}')
    into v_roles
  from (select distinct upper(trim(x)) as r from unnest(coalesce(p_roles, '{}')) x) s
  where r in ('EXP', 'JUNG', 'GOLD', 'MID', 'ROAM');

  select d.recruitment_status into v_old from public.f4_divisions d where d.id = p_division;
  if v_old is null then raise exception 'Divisi % tidak ada.', p_division; end if;

  update public.f4_divisions d
     set recruitment_status = v_status,
         role_needs = to_jsonb(v_roles),
         version = d.version + 1,
         updated_at = now()
   where d.id = p_division;

  if v_old is distinct from v_status then
    insert into public.f4_division_activity (division_id, event_type, message)
    values (p_division,
            case when v_status = 'RECRUITING' then 'RECRUITMENT_OPENED' else 'RECRUITMENT_CLOSED' end,
            case when v_status = 'RECRUITING'
                 then 'DIV ' || lpad(p_division::text, 2, '0') || ' membuka rekrutmen' ||
                      case when cardinality(v_roles) > 0 then ' · mencari ' || array_to_string(v_roles, ', ') else '' end
                 else 'DIV ' || lpad(p_division::text, 2, '0') || ' menutup rekrutmen' end);
  end if;
  insert into public.f4_division_audit (division_id, actor_id, action, before_data, after_data)
  values (p_division, auth.uid(), 'RECRUITMENT_SET',
          jsonb_build_object('recruitment_status', v_old),
          jsonb_build_object('recruitment_status', v_status, 'role_needs', to_jsonb(v_roles)));

  return query select v_status, to_jsonb(v_roles);
end;
$$;
revoke all on function public.f4_set_division_recruitment(smallint, text, text[]) from public;
grant execute on function public.f4_set_division_recruitment(smallint, text, text[]) to authenticated;

commit;
