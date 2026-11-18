-- Économat Pro · mise à jour v11 : DROITS PAR COMPTE (blason, « C », livres)
-- (déjà appliquée sur ton Supabase ; à garder pour une réinstallation)
-- Supabase → SQL Editor → coller → Run.

alter table public.profiles
  add column if not exists perms jsonb not null default '{}'::jsonb;

create or replace function public.me()
returns json
language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'status', coalesce((select status from public.profiles
                        where id = auth.uid()), 'pending'),
    'admin',  public.is_admin(),
    'approval', coalesce((select (value #>> '{}')::boolean
                          from public.settings
                          where key = 'require_approval'), true),
    'perms', coalesce((select perms from public.profiles
                       where id = auth.uid()), '{}'::jsonb))
$fn$;

create or replace function public.admin_set_perm(
  p_user uuid, p_key text, p_on boolean
)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  perform public.admin_check();
  if p_key not in ('crest','cmark','book') then
    raise exception 'Droit inconnu';
  end if;
  update public.profiles
     set perms = coalesce(perms,'{}'::jsonb)
                 || jsonb_build_object(p_key, coalesce(p_on,false))
   where id = p_user;
end
$fn$;
revoke all on function public.admin_set_perm(uuid, text, boolean)
  from public, anon;
grant execute on function public.admin_set_perm(uuid, text, boolean)
  to authenticated;
