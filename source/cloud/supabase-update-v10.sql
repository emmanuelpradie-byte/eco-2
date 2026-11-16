-- Économat Pro · mise à jour v10 : RECETTES DE BASE DANS LE PARTAGE
-- (déjà appliquée sur ton Supabase ; à garder pour une réinstallation)
-- À lancer en 2 parties (Supabase → SQL Editor → Run).

-- ══════════ PARTIE 1 ══════════
alter table public.shared_recipes
  add column if not exists base boolean not null default false;

create or replace function public.shared_base_guard()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if old.base then
    if new.deleted and not old.deleted
       and coalesce(new.data->>'by','') <> 'admin' then
      return old;
    end if;
    if not new.deleted then
      new.base := true;
      new.owner_name := 'Économat Pro';
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists shared_base_guard on public.shared_recipes;
create trigger shared_base_guard
  before update on public.shared_recipes
  for each row execute function public.shared_base_guard();

-- ══════════ PARTIE 2 ══════════
update public.shared_recipes s
   set base = true, owner_name = 'Économat Pro'
  from public.profiles p
 where p.id = s.owner
   and p.email = 'emmanuelpradie@gmail.com'
   and not s.deleted;

create or replace function public.admin_share_base(
  p_id text, p_on boolean
)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  perform public.admin_check();
  if p_on then
    update public.shared_recipes
       set base = true, owner_name = 'Économat Pro'
     where id = p_id and not deleted;
  else
    update public.shared_recipes
       set deleted = true, data = '{"by":"admin"}'::jsonb
     where id = p_id and base;
  end if;
end
$fn$;
revoke all on function public.admin_share_base(text, boolean)
  from public, anon;
grant execute on function public.admin_share_base(text, boolean)
  to authenticated;
