-- Read-only smoke test. Run AFTER supabase-auth.sql in Supabase SQL Editor.
-- No user records are modified by this file.
select 'profiles_table' as check_name,
       case when to_regclass('public.profiles') is not null then 'PASS' else 'FAIL' end as result;
select 'username_exists_rpc' as check_name,
       case when to_regprocedure('public.f4_username_exists(text)') is not null then 'PASS' else 'FAIL' end as result;
select 'username_login_rpc' as check_name,
       case when to_regprocedure('public.f4_login_email_for_username(text)') is not null then 'PASS' else 'FAIL' end as result;
select 'new_auth_user_trigger' as check_name,
       case when exists(select 1 from pg_trigger where tgname='f4_on_auth_user_created' and not tgisinternal) then 'PASS' else 'FAIL' end as result;
select 'profile_guard_trigger' as check_name,
       case when exists(select 1 from pg_trigger where tgname='f4_guard_profile_changes_trigger' and not tgisinternal) then 'PASS' else 'FAIL' end as result;
select 'avatar_bucket' as check_name,
       case when exists(select 1 from storage.buckets where id='f4ntastic-avatars') then 'PASS' else 'FAIL' end as result;
select 'arlec_role' as check_name, username, email, role,
       case when role='developer' then 'PASS' else 'CHECK MIGRATION / USERNAME' end as result
from public.profiles where lower(username)='arlec';
select 'missing_profile_rows' as check_name, count(*) as count
from auth.users au left join public.profiles p on p.id=au.id where p.id is null;
