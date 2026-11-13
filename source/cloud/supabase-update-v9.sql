-- Économat Pro · mise à jour v9 : MESSAGERIE
-- À lancer en 3 parties, l'une après l'autre (Supabase → SQL Editor → Run).
-- Chaque partie peut être relancée sans risque.

-- ══════════ PARTIE 1 ══════════
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  channel text not null,
  author uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null default '',
  attach jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_ch_idx
  on public.chat_messages (channel, id);
create index if not exists chat_messages_author_idx
  on public.chat_messages (author, created_at);
alter table public.chat_messages enable row level security;

create or replace function public.chat_can(p_channel text)
returns boolean
language plpgsql stable security definer set search_path = public
as $fn$
declare
  a text; b text; other text;
begin
  if not public.is_active() then return false; end if;
  if p_channel = 'general' then return true; end if;
  if p_channel !~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then return false; end if;
  a := split_part(p_channel, ':', 2);
  b := split_part(p_channel, ':', 3);
  if a >= b then return false; end if;
  if auth.uid()::text = a then other := b;
  elsif auth.uid()::text = b then other := a;
  else return false;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id::text = other and p.status = 'active'
  );
end
$fn$;

-- ══════════ PARTIE 2 ══════════
create or replace function public.chat_send(
  p_channel text, p_body text, p_attach jsonb default null
)
returns json
language plpgsql security definer set search_path = public
as $fn$
declare
  v_name text;
  v_row public.chat_messages;
  v_n integer;
begin
  if not public.chat_can(p_channel) then
    raise exception 'Conversation inaccessible';
  end if;
  p_body := btrim(coalesce(p_body, ''));
  if p_body = '' and p_attach is null then
    raise exception 'Message vide';
  end if;
  if length(p_body) > 4000 then
    raise exception 'Message trop long (4000 caractères max)';
  end if;
  if p_attach is not null and length(p_attach::text) > 200000 then
    raise exception 'Pièce jointe trop volumineuse';
  end if;
  select count(*) into v_n from public.chat_messages
  where author = auth.uid()
    and created_at > now() - interval '1 minute';
  if v_n >= 30 then
    raise exception 'Trop de messages, patiente un instant';
  end if;
  select coalesce(nullif(btrim(display_name), ''),
                  split_part(email, '@', 1), '')
  into v_name
  from public.profiles
  where id = auth.uid();
  insert into public.chat_messages (channel, author, author_name, body, attach)
  values (p_channel, auth.uid(), coalesce(v_name, ''), p_body, p_attach)
  returning * into v_row;
  return json_build_object(
    'id', v_row.id,
    'author', v_row.author,
    'name', v_row.author_name,
    'body', v_row.body,
    'attach', v_row.attach,
    'at', v_row.created_at
  );
end
$fn$;

create or replace function public.chat_list(
  p_channel text, p_after bigint default 0, p_limit integer default 80
)
returns json
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v json;
begin
  if not public.chat_can(p_channel) then
    raise exception 'Conversation inaccessible';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 80), 1), 200);
  select coalesce(json_agg(x order by x.id), '[]'::json) into v
  from (
    select m.id, m.author, m.author_name as name,
           m.body, m.attach, m.created_at as at
    from public.chat_messages m
    where m.channel = p_channel
      and m.id > coalesce(p_after, 0)
    order by m.id desc
    limit p_limit
  ) x;
  return v;
end
$fn$;

-- ══════════ PARTIE 3 ══════════
create or replace function public.chat_users()
returns json
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.is_active() then
    raise exception 'Compte non actif';
  end if;
  return (
    select coalesce(json_agg(u order by lower(u.name)), '[]'::json)
    from (
      select p.id,
             coalesce(nullif(btrim(p.display_name), ''),
                      split_part(p.email, '@', 1), 'Sans nom') as name
      from public.profiles p
      where p.status = 'active' and p.id <> auth.uid()
    ) u
  );
end
$fn$;

create or replace function public.chat_threads()
returns json
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.is_active() then
    raise exception 'Compte non actif';
  end if;
  return (
    select coalesce(json_agg(t order by t.last_id desc), '[]'::json)
    from (
      select distinct on (m.channel)
             m.channel,
             m.id as last_id,
             m.author as last_author,
             m.author_name as last_name,
             left(m.body, 80) as last_body,
             (m.attach is not null) as last_attach,
             m.created_at as last_at
      from public.chat_messages m
      where m.channel = 'general'
         or (m.channel like 'dm:%'
             and auth.uid()::text in (split_part(m.channel, ':', 2),
                                      split_part(m.channel, ':', 3)))
      order by m.channel, m.id desc
    ) t
  );
end
$fn$;

create or replace function public.chat_delete(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not public.is_active() then
    raise exception 'Compte non actif';
  end if;
  delete from public.chat_messages
  where id = p_id and (author = auth.uid() or public.is_admin());
end
$fn$;

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
