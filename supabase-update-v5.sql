-- Économat Pro — mise à jour v5 : mots de passe sur les dossiers partagés
-- (à lancer une fois ; peut être relancé sans risque)
create extension if not exists pgcrypto with schema extensions;

-- Dossiers partagés protégés par mot de passe
create table if not exists public.share_locks (
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  folder      text not null,
  pw_hash     text not null,
  updated_at  timestamptz not null default now(),
  primary key (owner, folder)
);
create table if not exists public.share_unlocks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  folder      text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, owner, folder)
);
-- Visible : mes partages, ceux d'un dossier sans mot de passe, ou déjà déverrouillé
-- (l'administrateur voit tout, pour pouvoir modérer).
create or replace function public.share_visible(p_owner uuid, p_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_owner = auth.uid()
      or public.is_admin()
      or not exists (select 1 from public.share_locks l where l.owner = p_owner and l.folder = coalesce(p_folder,''))
      or exists (select 1 from public.share_unlocks u where u.user_id = auth.uid() and u.owner = p_owner and u.folder = coalesce(p_folder,''))
$$;
-- Mettre / changer / retirer (mot de passe vide) le mot de passe d'un de mes dossiers.
-- Changer le mot de passe oblige les autres à le saisir de nouveau.
create or replace function public.set_share_lock(p_folder text, p_pw text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_active() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if coalesce(btrim(p_folder),'') = '' then raise exception 'Choisis un dossier'; end if;
  delete from public.share_unlocks where owner = auth.uid() and folder = p_folder;
  if coalesce(p_pw,'') = '' then
    delete from public.share_locks where owner = auth.uid() and folder = p_folder;
  else
    if length(p_pw) < 4 then raise exception 'Mot de passe trop court (4 caractères minimum)'; end if;
    insert into public.share_locks(owner, folder, pw_hash) values (auth.uid(), p_folder, crypt(p_pw, gen_salt('bf')))
      on conflict (owner, folder) do update set pw_hash = excluded.pw_hash, updated_at = now();
  end if;
end $$;
create or replace function public.rename_share_lock(p_old text, p_new text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  if coalesce(btrim(p_new),'') = '' or p_old = p_new then return; end if;
  update public.share_locks set folder = p_new where owner = auth.uid() and folder = p_old
    and not exists (select 1 from public.share_locks where owner = auth.uid() and folder = p_new);
  update public.share_unlocks set folder = p_new where owner = auth.uid() and folder = p_old
    and not exists (select 1 from public.share_unlocks u2 where u2.owner = auth.uid() and u2.folder = p_new and u2.user_id = share_unlocks.user_id);
end $$;
-- Saisir le mot de passe d'un dossier d'un autre compte (une fois suffit, sur tous ses appareils)
create or replace function public.unlock_share(p_owner uuid, p_folder text, p_pw text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if not public.is_active() then raise exception 'Action non autorisée' using errcode = '42501'; end if;
  select pw_hash into h from public.share_locks where owner = p_owner and folder = p_folder;
  if h is null then return true; end if;
  if crypt(coalesce(p_pw,''), h) = h then
    insert into public.share_unlocks(user_id, owner, folder) values (auth.uid(), p_owner, p_folder) on conflict do nothing;
    return true;
  end if;
  perform pg_sleep(0.8);   -- freine les essais au hasard
  return false;
end $$;
-- Mes dossiers protégés
create or replace function public.my_share_locks() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(folder order by folder), '[]'::json) from public.share_locks where owner = auth.uid()
$$;
-- Dossiers protégés des autres : nom, auteur, nombre d'éléments, déjà déverrouillé ou non
create or replace function public.locked_shares() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'owner', l.owner,
      'owner_name', coalesce((select s.owner_name from public.shared_recipes s where s.owner = l.owner and not s.deleted order by s.updated_at desc limit 1),
                             (select p.display_name from public.profiles p where p.id = l.owner)),
      'folder', l.folder,
      'n', (select count(*) from public.shared_recipes s where s.owner = l.owner and not s.deleted and coalesce(s.data->>'folder','') = l.folder),
      'unlocked', public.share_visible(l.owner, l.folder))), '[]'::json)
  from public.share_locks l
  where public.is_active() and l.owner <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = l.owner and p.status = 'active')
$$;

create or replace function public.attachment_is_shared(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shared_recipes s
    where not s.deleted
      and s.data -> 'attachments' @> jsonb_build_array(jsonb_build_object('id', p_id))
      and public.share_visible(s.owner, coalesce(s.data->>'folder',''))
  )
$$;

drop policy if exists shared_read on public.shared_recipes;
create policy shared_read on public.shared_recipes for select to authenticated
  using (public.is_active() and public.share_visible(owner, coalesce(data->>'folder','')));

alter table public.share_locks   enable row level security;
alter table public.share_unlocks enable row level security;
revoke all on public.share_locks, public.share_unlocks from anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['share_visible(uuid,text)','set_share_lock(text,text)','rename_share_lock(text,text)','unlock_share(uuid,text,text)','my_share_locks()','locked_shares()','attachment_is_shared(text)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
end $$;
