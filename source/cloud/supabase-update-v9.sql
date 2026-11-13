-- ═══════════════════════════════════════════════════════════════
-- Économat Pro · mise à jour v9 : MESSAGERIE (chat)
-- À exécuter UNE fois : Supabase → SQL Editor → coller → Run.
-- Peut être relancé sans risque (idempotent).
-- ═══════════════════════════════════════════════════════════════
-- Salons :
--   'general'                 → tous les comptes actifs
--   'dm:<uuidA>:<uuidB>'      → conversation privée entre 2 personnes
--                               (uuidA < uuidB, seuls ces 2 comptes la lisent)
-- Pièces jointes : recette ou ingrédient, stockées en JSON dans le message.

create table if not exists public.chat_messages (
  id           bigint generated always as identity primary key,
  channel      text not null,
  author       uuid not null references auth.users(id) on delete cascade,
  author_name  text not null default '',
  body         text not null default '',
  attach       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_ch_idx on public.chat_messages (channel, id);
create index if not exists chat_messages_author_idx on public.chat_messages (author, created_at);

-- RLS activée SANS aucune politique : personne ne lit/écrit la table en direct,
-- tout passe par les fonctions ci-dessous (qui vérifient les droits).
alter table public.chat_messages enable row level security;

-- Le salon est-il accessible à la personne connectée ?
create or replace function public.chat_can(p_channel text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active() and (
    p_channel = 'general'
    or (
      p_channel ~ '^dm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(p_channel, ':', 2) < split_part(p_channel, ':', 3)
      and auth.uid()::text in (split_part(p_channel, ':', 2), split_part(p_channel, ':', 3))
      and exists (select 1 from public.profiles p
                  where p.id::text = case when auth.uid()::text = split_part(p_channel, ':', 2)
                                          then split_part(p_channel, ':', 3) else split_part(p_channel, ':', 2) end
                    and p.status = 'active')
    )
  );
$$;

-- Envoyer un message (texte et/ou pièce jointe)
create or replace function public.chat_send(p_channel text, p_body text, p_attach jsonb default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_row public.chat_messages;
begin
  if not public.chat_can(p_channel) then raise exception 'Conversation inaccessible'; end if;
  p_body := btrim(coalesce(p_body, ''));
  if p_body = '' and p_attach is null then raise exception 'Message vide'; end if;
  if length(p_body) > 4000 then raise exception 'Message trop long (4000 caractères max)'; end if;
  if p_attach is not null and length(p_attach::text) > 200000 then raise exception 'Pièce jointe trop volumineuse'; end if;
  if (select count(*) from public.chat_messages where author = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Trop de messages, patiente un instant';
  end if;
  select coalesce(nullif(btrim(display_name), ''), split_part(email, '@', 1), '') into v_name from public.profiles where id = auth.uid();
  insert into public.chat_messages (channel, author, author_name, body, attach)
  values (p_channel, auth.uid(), coalesce(v_name, ''), p_body, p_attach) returning * into v_row;
  return json_build_object('id', v_row.id, 'author', v_row.author, 'name', v_row.author_name, 'body', v_row.body, 'attach', v_row.attach, 'at', v_row.created_at);
end $$;

-- Lire un salon : p_after = 0 → les p_limit derniers ; sinon les nouveaux depuis p_after
create or replace function public.chat_list(p_channel text, p_after bigint default 0, p_limit integer default 80) returns json
language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  if not public.chat_can(p_channel) then raise exception 'Conversation inaccessible'; end if;
  p_limit := least(greatest(coalesce(p_limit, 80), 1), 200);
  select coalesce(json_agg(x order by x.id), '[]'::json) into v from (
    select * from (
      select m.id, m.author, m.author_name as name, m.body, m.attach, m.created_at as at
      from public.chat_messages m
      where m.channel = p_channel and m.id > coalesce(p_after, 0)
      order by m.id desc limit p_limit
    ) t
  ) x;
  return v;
end $$;

-- Personnes avec qui discuter (comptes actifs, moi exclu)
create or replace function public.chat_users() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'Compte non actif'; end if;
  return (select coalesce(json_agg(json_build_object('id', p.id, 'name', coalesce(nullif(btrim(p.display_name), ''), split_part(p.email, '@', 1), 'Sans nom')) order by lower(coalesce(nullif(btrim(p.display_name), ''), p.email))), '[]'::json)
          from public.profiles p where p.status = 'active' and p.id <> auth.uid());
end $$;

-- Mes conversations : dernier message de chaque salon (sert aussi aux pastilles « non lu »)
create or replace function public.chat_threads() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'Compte non actif'; end if;
  return (select coalesce(json_agg(t order by t.last_id desc), '[]'::json) from (
    select distinct on (m.channel) m.channel, m.id as last_id, m.author as last_author, m.author_name as last_name,
           left(m.body, 80) as last_body, (m.attach is not null) as last_attach, m.created_at as last_at
    from public.chat_messages m
    where m.channel = 'general'
       or (m.channel like 'dm:%' and auth.uid()::text in (split_part(m.channel, ':', 2), split_part(m.channel, ':', 3)))
    order by m.channel, m.id desc
  ) t);
end $$;

-- Supprimer un message (le sien ; un administrateur peut tout supprimer)
create or replace function public.chat_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'Compte non actif'; end if;
  delete from public.chat_messages where id = p_id and (author = auth.uid() or public.is_admin());
end $$;

revoke all on function public.chat_can(text) from public, anon;
revoke all on function public.chat_send(text, text, jsonb) from public, anon;
revoke all on function public.chat_list(text, bigint, integer) from public, anon;
revoke all on function public.chat_users() from public, anon;
revoke all on function public.chat_threads() from public, anon;
revoke all on function public.chat_delete(bigint) from public, anon;
grant execute on function public.chat_can(text) to authenticated;
grant execute on function public.chat_send(text, text, jsonb) to authenticated;
grant execute on function public.chat_list(text, bigint, integer) to authenticated;
grant execute on function public.chat_users() to authenticated;
grant execute on function public.chat_threads() to authenticated;
grant execute on function public.chat_delete(bigint) to authenticated;
