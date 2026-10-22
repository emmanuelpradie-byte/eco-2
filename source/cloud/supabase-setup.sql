-- ════════════════════════════════════════════════════════════════
--  Économat Pro — espace en ligne (Supabase)
--  À coller UNE FOIS dans Supabase → SQL Editor → New query → Run.
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
--
--  • Espace perso : recettes, catalogue, fournisseurs, bons de chaque personne
--    (visibles uniquement par elle, sur tous ses appareils).
--  • Recettes partagées : visibles par tous les comptes, modifiables
--    uniquement par la personne qui les a partagées.
--  • Documents joints (PDF, images) : lisibles par leur propriétaire, et par
--    tous quand ils sont joints à une recette partagée.
--  • Administration : le premier compte créé est administrateur. Il valide
--    les nouveaux comptes, peut bloquer ou supprimer un compte, et retirer
--    n'importe quel partage. Un compte en attente ou bloqué n'a accès à rien.
--
--  • Partage : dossiers protégés par mot de passe, bons d'économat et PDF.
--
--  Mise à jour : relancer ce script en entier ajoute ce qui manque.
-- ════════════════════════════════════════════════════════════════

-- Espace perso
create table if not exists public.user_docs (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null,
  id          text not null,
  data        jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);
alter table public.user_docs drop constraint if exists user_docs_kind_check;
alter table public.user_docs add constraint user_docs_kind_check check (kind in ('ing','rec','sup','ord','cfg'));
create index if not exists user_docs_updated on public.user_docs (user_id, updated_at);

-- Recettes partagées
create table if not exists public.shared_recipes (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_name  text,
  data        jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default clock_timestamp()
);
create index if not exists shared_recipes_updated on public.shared_recipes (updated_at);

-- Documents joints
create table if not exists public.attachments (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text,
  mime        text,
  size        integer,
  data        text,
  created_at  timestamptz not null default now()
);

-- Horodatage côté serveur (sert à la synchronisation)
create or replace function public.touch_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists user_docs_touch on public.user_docs;
create trigger user_docs_touch before insert or update on public.user_docs for each row execute function public.touch_row();
drop trigger if exists shared_recipes_touch on public.shared_recipes;
create trigger shared_recipes_touch before insert or update on public.shared_recipes for each row execute function public.touch_row();

-- Un document est lisible par tous s'il est joint à une recette partagée


-- ── Comptes et administration ───────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  status        text not null default 'pending',
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('pending','active','blocked','deleted'));

create table if not exists public.settings (
  key    text primary key,
  value  jsonb
);
insert into public.settings(key,value) values ('require_approval','true'::jsonb) on conflict (key) do nothing;

create table if not exists public.invites (
  code        text primary key,
  created_by  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked     boolean not null default false,
  uses        integer not null default 0
);

-- Comptes déjà créés avant l'administration : actifs ; le plus ancien devient administrateur
insert into public.profiles(id,email,display_name,status,is_admin,created_at)
  select u.id, u.email, u.raw_user_meta_data->>'display_name', 'active', false, coalesce(u.created_at, now())
  from auth.users u on conflict (id) do nothing;
update public.profiles set is_admin = true
  where id = (select id from public.profiles where status='active' order by created_at asc limit 1)
    and not exists (select 1 from public.profiles where is_admin);

-- Chaque inscription crée un profil : actif si c'est le tout premier compte,
-- s'il vient d'un lien d'invitation de l'administrateur, ou si la validation
-- est désactivée ; sinon en attente de validation.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean := not exists (select 1 from public.profiles where is_admin);
  v_code text := new.raw_user_meta_data->>'invite';
  ok_invite boolean := false;
  need_ok boolean := coalesce((select (value #>> '{}')::boolean from public.settings where key='require_approval'), true);
begin
  if v_code is not null and v_code <> '' then
    update public.invites set uses = uses + 1
      where invites.code = v_code and not revoked and (expires_at is null or expires_at > now());
    ok_invite := found;
  end if;
  insert into public.profiles(id,email,display_name,status,is_admin)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name',
          case when first_user or ok_invite or not need_ok then 'active' else 'pending' end,
          first_user)
  on conflict (id) do nothing;
  return new;
exception when others then
  -- l'inscription ne doit jamais échouer à cause du profil : compte en attente
  begin
    insert into public.profiles(id,email,status) values (new.id, new.email, 'pending') on conflict (id) do nothing;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Changement d'adresse email (confirmé) : le profil suit
create or replace function public.handle_user_email_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users for each row execute function public.handle_user_email_changed();

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and status = 'active' from public.profiles where id = auth.uid()), false)
$$;
-- Mon compte : statut, rôle, et réglage de validation
create or replace function public.me() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', coalesce((select status from public.profiles where id = auth.uid()), 'pending'),
    'admin',  public.is_admin(),
    'approval', coalesce((select (value #>> '{}')::boolean from public.settings where key='require_approval'), true))
$$;
-- Mon nom : mis à jour sur le profil ET sur mes recettes déjà partagées
create or replace function public.set_my_name(p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := left(btrim(coalesce(p_name,'')), 80);
begin
  update public.profiles set display_name = n where id = auth.uid();
  if n <> '' then
    update public.shared_recipes set owner_name = n
      where owner = auth.uid() and not deleted and owner_name is distinct from n;
  end if;
end $$;

-- ── Partage : dossiers protégés par mot de passe ────────────────
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

-- Actions réservées à l'administrateur
create or replace function public.admin_check() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administrateur' using errcode = '42501'; end if;
end $$;
create or replace function public.admin_set_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if p_user = auth.uid() then raise exception 'Tu ne peux pas changer ton propre statut'; end if;
  if p_status not in ('pending','active','blocked') then raise exception 'Statut inconnu'; end if;
  update public.profiles set status = p_status where id = p_user and status <> 'deleted';
end $$;
create or replace function public.admin_set_admin(p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if p_user = auth.uid() and not p_admin then raise exception 'Nomme d’abord un autre administrateur, puis demande-lui de te retirer'; end if;
  update public.profiles set is_admin = p_admin where id = p_user and status = 'active';
end $$;
-- Supprimer un compte : ses données sont effacées, ses partages retirés,
-- et il ne peut plus rien faire (l'adresse email reste réservée).
create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  if p_user = auth.uid() then raise exception 'Tu ne peux pas supprimer ton propre compte'; end if;
  update public.shared_recipes set deleted = true, data = null where owner = p_user and not deleted;
  delete from public.attachments where owner = p_user;
  delete from public.user_docs where user_id = p_user;
  delete from public.invites where created_by = p_user;
  update public.profiles set status = 'deleted', is_admin = false where id = p_user;
end $$;
-- Rétablir un compte supprimé : il retrouve l'accès (sa sauvegarde en ligne a été
-- effacée à la suppression : elle revient depuis ses appareils à sa reconnexion).
create or replace function public.admin_restore_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  update public.profiles set status = 'active' where id = p_user and status = 'deleted';
end $$;
create or replace function public.admin_unshare(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  update public.shared_recipes set deleted = true, data = '{"by":"admin"}'::jsonb where id = p_id and not deleted;
end $$;
create or replace function public.admin_unshare_folder(p_owner uuid, p_folder text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.admin_check();
  update public.shared_recipes set deleted = true, data = '{"by":"admin"}'::jsonb
    where owner = p_owner and not deleted and coalesce(data->>'folder','') = p_folder;
  get diagnostics n = row_count; return n;
end $$;
create or replace function public.admin_set_approval(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  insert into public.settings(key,value) values ('require_approval', to_jsonb(p_on))
    on conflict (key) do update set value = excluded.value;
end $$;
-- Lien d'invitation de l'administrateur : valable 30 jours, plusieurs personnes
create or replace function public.admin_invite() returns json
language plpgsql security definer set search_path = public as $$
declare c text; e timestamptz;
begin
  perform public.admin_check();
  select code, expires_at into c, e from public.invites
    where created_by = auth.uid() and not revoked and expires_at > now() + interval '7 days'
    order by expires_at desc limit 1;
  if c is null then
    c := replace(gen_random_uuid()::text, '-', '');
    e := now() + interval '30 days';
    insert into public.invites(code, created_by, expires_at) values (c, auth.uid(), e);
  end if;
  return json_build_object('code', c, 'expires_at', e);
end $$;
create or replace function public.admin_revoke_invites() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check();
  update public.invites set revoked = true where not revoked;
end $$;

-- ── Sécurité ligne par ligne ─────────────────────────────────────
alter table public.user_docs      enable row level security;
alter table public.shared_recipes enable row level security;
alter table public.attachments    enable row level security;

drop policy if exists user_docs_own on public.user_docs;
create policy user_docs_own on public.user_docs for all to authenticated
  using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());

drop policy if exists shared_read on public.shared_recipes;
create policy shared_read on public.shared_recipes for select to authenticated
  using (public.is_active() and public.share_visible(owner, coalesce(data->>'folder','')));
drop policy if exists shared_insert on public.shared_recipes;
create policy shared_insert on public.shared_recipes for insert to authenticated with check (owner = auth.uid() and public.is_active());
drop policy if exists shared_update on public.shared_recipes;
create policy shared_update on public.shared_recipes for update to authenticated
  using (owner = auth.uid() and public.is_active()) with check (owner = auth.uid() and public.is_active());

drop policy if exists att_read on public.attachments;
create policy att_read on public.attachments for select to authenticated
  using (public.is_active() and (owner = auth.uid() or public.attachment_is_shared(id)));
drop policy if exists att_insert on public.attachments;
create policy att_insert on public.attachments for insert to authenticated with check (owner = auth.uid() and public.is_active());
drop policy if exists att_update on public.attachments;
create policy att_update on public.attachments for update to authenticated
  using (owner = auth.uid() and public.is_active()) with check (owner = auth.uid() and public.is_active());
drop policy if exists att_delete on public.attachments;
create policy att_delete on public.attachments for delete to authenticated using (owner = auth.uid() and public.is_active());

revoke all on public.user_docs, public.shared_recipes, public.attachments from anon;
grant select, insert, update on public.user_docs, public.shared_recipes to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;
alter table public.share_locks   enable row level security;
alter table public.share_unlocks enable row level security;
revoke all on public.share_locks, public.share_unlocks from anon, authenticated;
revoke execute on function public.attachment_is_shared(text) from public, anon;
grant execute on function public.attachment_is_shared(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.invites  enable row level security;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
drop policy if exists invites_read on public.invites;
create policy invites_read on public.invites for select to authenticated using (public.is_admin());
revoke all on public.profiles, public.settings, public.invites from anon;
grant select on public.profiles, public.settings, public.invites to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_changed() from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['is_active()','is_admin()','me()','set_my_name(text)','admin_check()','admin_set_status(uuid,text)','admin_set_admin(uuid,boolean)',
    'admin_delete_user(uuid)','admin_restore_user(uuid)','admin_unshare(text)','admin_unshare_folder(uuid,text)','admin_set_approval(boolean)','admin_invite()','admin_revoke_invites()',
    'share_visible(uuid,text)','set_share_lock(text,text)','rename_share_lock(text,text)','unlock_share(uuid,text,text)','my_share_locks()','locked_shares()'] loop
    execute 'revoke execute on function public.'||f||' from public, anon';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
end $$;
