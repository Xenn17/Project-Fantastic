-- F4NTASTIC Division Directory: jalankan setelah backup database dan review role existing.
-- Tidak menyimpan service_role key di browser. Semua perubahan data melewati RLS.
create extension if not exists pgcrypto;
create table if not exists public.f4_divisions (
 id smallint primary key check (id between 1 and 41),
 leader_name text,
 squad_id text,
 whatsapp text,
 member_count smallint not null default 0 check (member_count between 0 and 25),
 capacity smallint not null default 25 check (capacity between 1 and 25),
 recruitment_status text not null default 'CLOSED' check (recruitment_status in ('RECRUITING','CLOSED')),
 description text not null default '', announcement text not null default '',
 role_needs jsonb not null default '[]'::jsonb,
 banner_url text, logo_url text,
 spotlight boolean not null default false,
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 check (member_count <= capacity),
 check (jsonb_typeof(role_needs)='array')
);
create table if not exists public.f4_division_leaders (
 division_id smallint primary key references public.f4_divisions(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 assigned_at timestamptz not null default now(), assigned_by uuid references auth.users(id)
);
create table if not exists public.f4_division_members (
 id uuid primary key default gen_random_uuid(),
 division_id smallint not null references public.f4_divisions(id) on delete restrict,
 nickname varchar(30) not null check (length(trim(nickname)) between 1 and 30),
 ml_id varchar(25) not null check (ml_id ~ '^[0-9]{1,25}$'),
 roles text[] not null check (cardinality(roles) between 1 and 2),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists f4_division_members_ml_id_unique on public.f4_division_members(ml_id);
create index if not exists f4_division_members_division_idx on public.f4_division_members(division_id);
create table if not exists public.f4_division_admin_permissions (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 can_edit_divisions boolean not null default false,
 can_manage_members boolean not null default false,
 granted_by uuid references auth.users(id)
);
create table if not exists public.f4_division_activity (
 id bigint generated always as identity primary key,
 division_id smallint references public.f4_divisions(id) on delete set null,
 event_type text not null check (event_type in ('RECRUITMENT_OPENED','RECRUITMENT_CLOSED','DIVISION_FULL')),
 message text not null, created_at timestamptz not null default now()
);
create table if not exists public.f4_division_audit (
 id bigint generated always as identity primary key,
 division_id smallint not null references public.f4_divisions(id) on delete restrict,
 actor_id uuid references auth.users(id), action text not null,
 before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);

create or replace function public.f4_directory_has_access() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.roles && array['member','leader_squad','admin','developer','owner']::text[] or p.role in ('member','leader_squad','admin','developer','owner')))
$$;
create or replace function public.f4_directory_is_developer() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.roles && array['developer','owner']::text[] or p.role in ('developer','owner')))
$$;
create or replace function public.f4_directory_can_edit(p_division smallint) returns boolean language sql stable security definer set search_path=public as $$
 select public.f4_directory_is_developer()
 or exists(select 1 from public.f4_division_leaders l where l.division_id=p_division and l.profile_id=auth.uid())
 or exists(select 1 from public.f4_division_admin_permissions a where a.profile_id=auth.uid() and a.can_edit_divisions)
$$;
create or replace function public.f4_directory_can_manage_members(p_division smallint) returns boolean language sql stable security definer set search_path=public as $$
 select public.f4_directory_is_developer()
 or exists(select 1 from public.f4_division_leaders l where l.division_id=p_division and l.profile_id=auth.uid())
 or exists(select 1 from public.f4_division_admin_permissions a where a.profile_id=auth.uid() and a.can_manage_members)
$$;
revoke all on function public.f4_directory_has_access() from public;
revoke all on function public.f4_directory_is_developer() from public;
revoke all on function public.f4_directory_can_edit(smallint) from public;
revoke all on function public.f4_directory_can_manage_members(smallint) from public;
grant execute on function public.f4_directory_has_access() to authenticated;
grant execute on function public.f4_directory_is_developer() to authenticated;
grant execute on function public.f4_directory_can_edit(smallint) to authenticated;
grant execute on function public.f4_directory_can_manage_members(smallint) to authenticated;

alter table public.f4_divisions enable row level security;
alter table public.f4_division_leaders enable row level security;
alter table public.f4_division_members enable row level security;
alter table public.f4_division_admin_permissions enable row level security;
alter table public.f4_division_activity enable row level security;
alter table public.f4_division_audit enable row level security;
drop policy if exists f4_divisions_read on public.f4_divisions;
create policy f4_divisions_read on public.f4_divisions for select to authenticated using (public.f4_directory_has_access());
drop policy if exists f4_divisions_update on public.f4_divisions;
create policy f4_divisions_update on public.f4_divisions for update to authenticated using(public.f4_directory_can_edit(id)) with check(public.f4_directory_can_edit(id));
drop policy if exists f4_divisions_insert on public.f4_divisions;
create policy f4_divisions_insert on public.f4_divisions for insert to authenticated with check(public.f4_directory_is_developer());
drop policy if exists f4_division_leaders_read on public.f4_division_leaders;
create policy f4_division_leaders_read on public.f4_division_leaders for select to authenticated using(public.f4_directory_has_access());
drop policy if exists f4_division_leaders_manage on public.f4_division_leaders;
create policy f4_division_leaders_manage on public.f4_division_leaders for all to authenticated using(public.f4_directory_is_developer()) with check(public.f4_directory_is_developer());
drop policy if exists f4_members_read on public.f4_division_members;
create policy f4_members_read on public.f4_division_members for select to authenticated using(public.f4_directory_has_access());
drop policy if exists f4_members_insert on public.f4_division_members;
create policy f4_members_insert on public.f4_division_members for insert to authenticated with check(public.f4_directory_can_manage_members(division_id));
drop policy if exists f4_members_update on public.f4_division_members;
create policy f4_members_update on public.f4_division_members for update to authenticated using(public.f4_directory_can_manage_members(division_id)) with check(public.f4_directory_can_manage_members(division_id));
drop policy if exists f4_members_delete on public.f4_division_members;
create policy f4_members_delete on public.f4_division_members for delete to authenticated using(public.f4_directory_can_manage_members(division_id));
drop policy if exists f4_admin_permissions_read on public.f4_division_admin_permissions;
create policy f4_admin_permissions_read on public.f4_division_admin_permissions for select to authenticated using(public.f4_directory_is_developer() or profile_id=auth.uid());
drop policy if exists f4_admin_permissions_manage on public.f4_division_admin_permissions;
create policy f4_admin_permissions_manage on public.f4_division_admin_permissions for all to authenticated using(public.f4_directory_is_developer()) with check(public.f4_directory_is_developer());
drop policy if exists f4_activity_read on public.f4_division_activity;
create policy f4_activity_read on public.f4_division_activity for select to authenticated using(public.f4_directory_has_access());
drop policy if exists f4_activity_write on public.f4_division_activity;
create policy f4_activity_write on public.f4_division_activity for insert to authenticated with check(public.f4_directory_can_edit(division_id));
drop policy if exists f4_audit_read on public.f4_division_audit;
create policy f4_audit_read on public.f4_division_audit for select to authenticated using(public.f4_directory_is_developer());
drop policy if exists f4_audit_write on public.f4_division_audit;
create policy f4_audit_write on public.f4_division_audit for insert to authenticated with check(public.f4_directory_can_edit(division_id));
-- Catatan: kebijakan SELECT mengharuskan login + role Member atau di atas. Tidak ada akses anon.

-- Seed metadata 41 divisi; aman dijalankan berulang kali dan tidak menimpa data yang sudah diedit.
insert into public.f4_divisions (id,leader_name,squad_id,whatsapp,member_count,capacity,description,announcement)
values
(1,null,'1099438','088213107401',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(2,null,'11398440','0895402659627',0,23,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(3,null,'5765992','088210645366',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(4,null,'194805653','085773615971',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(5,null,'19724722','083876880949',0,21,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(6,null,'11546442','089671155578',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(7,null,'5677841','083896050693',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(8,null,'11354363','0895413758173',0,20,'Divisi tidak aktif berdasarkan data roster.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(9,null,'5842052','089519671130',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(10,null,'11373204','082173732325',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(11,null,'4008674','085184248359',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(12,null,'11425306','+6285185437702',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(13,null,'5816545','085780353947',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(14,null,'11902981','081913232247',0,18,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(15,null,'9900071','085183704839',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(16,null,'11986286','081319495243',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(17,null,'5910426','083160425837',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(18,null,'3299012','082354311211',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(19,null,'11955111','082132672132',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(20,null,'7241869','085822558976',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(21,null,'146258688','08988045220',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(22,null,'12032167','+6588332554',0,19,'Divisi Singapore.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(23,null,'4546398','082285706421',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(24,null,'4750136','+6288289337759',0,19,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(25,null,'12004697','081913232247',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(26,null,'29015498','+6282267891680',0,20,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(27,null,'13675214','083147822758',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(28,null,'9273537','0895413758173',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(29,null,'5685219','+6283188481519',0,21,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(30,null,'11568487','089529940200',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(31,null,'10108168','08158061632',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(32,null,'2879046','082148002700',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(33,null,'5095481','085693606474',0,19,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(34,null,'13751600','082178417416',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(35,null,'10066469','087879165024',0,25,'Divisi tidak aktif berdasarkan data roster.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(36,null,'13310362','08815737442',0,25,'Divisi Militer.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(37,null,'13100529','08815737442',0,20,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(38,null,'12285743','',0,14,'Divisi tidak aktif berdasarkan data roster.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(39,null,'416399461','089659873794',0,25,'Informasi resmi divisi akan dilengkapi oleh Leader.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(40,null,'9060918','+6281286513625',0,23,'Divisi OLD.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.'),
(41,null,'11576655','+6281297267699',0,25,'Divisi META CIKI/COD.','Informasi rekrutmen akan diumumkan melalui pengelola divisi.')
on conflict (id) do nothing;
