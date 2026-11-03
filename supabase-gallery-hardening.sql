-- F4NTASTIC gallery security hardening.
-- Run only in the NEW gallery Supabase project after the base schema/policies.
-- Admin, developer, and owner accounts can manage gallery content.
drop policy if exists "Managers can view manager list" on public.gallery_managers;
create policy "Gallery managers can view manager list"
on public.gallery_managers for select to authenticated
using (public.is_gallery_manager());

drop policy if exists "Developers manage admin accounts" on public.gallery_managers;
create policy "Developers manage admin accounts"
on public.gallery_managers for all to authenticated
using (
  (select public.is_gallery_developer())
  and role = 'admin'
)
with check (
  (select public.is_gallery_developer())
  and role = 'admin'
);

drop policy if exists "Managers can view activity logs" on public.gallery_activity_logs;
create policy "Managers can view activity logs"
on public.gallery_activity_logs for select to authenticated
using (public.is_gallery_manager());

drop policy if exists "Managers can insert own activity logs" on public.gallery_activity_logs;
create policy "Managers can insert own activity logs"
on public.gallery_activity_logs for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and public.is_gallery_manager()
);

-- Ensure role helpers are executable by signed-in clients, while table RLS remains authoritative.
grant execute on function public.is_gallery_manager() to authenticated;
grant execute on function public.is_gallery_developer() to authenticated;
grant execute on function public.get_gallery_role() to authenticated;
