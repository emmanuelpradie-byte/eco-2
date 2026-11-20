-- v8 : journal des copies / téléchargements de partages (lisible par l'administrateur seulement)
create table if not exists public.share_copies (
  id bigserial primary key,
  item_id text not null,
  owner uuid,
  owner_name text,
  item_name text,
  item_type text,
  folder text,
  action text not null default 'copy',
  copier uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists share_copies_created on public.share_copies(created_at desc);
alter table public.share_copies enable row level security;
revoke all on public.share_copies from anon, authenticated;

-- noté par l'appli quand quelqu'un copie (ou ouvre un document) partagé
create or replace function public.log_share_copy(p_item text, p_action text default 'copy')
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.shared_recipes%rowtype;
begin
  if auth.uid() is null or not public.is_active() then return false; end if;
  select * into r from public.shared_recipes where id = p_item;
  if not found or r.owner = auth.uid() then return false; end if;
  insert into public.share_copies(item_id, owner, owner_name, item_name, item_type, folder, action, copier)
  values (r.id, r.owner, r.owner_name, r.data->>'name', coalesce(r.data->>'type','rec'), nullif(r.data->>'folder',''),
          case when p_action in ('copy','open') then p_action else 'copy' end, auth.uid());
  return true;
end $$;
revoke all on function public.log_share_copy(text, text) from public, anon;
grant execute on function public.log_share_copy(text, text) to authenticated;

-- liste pour l'administrateur
create or replace function public.admin_share_copies()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur' using errcode = '42501'; end if;
  return (select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select c.id, c.item_id, c.item_name, c.item_type, c.folder, c.action, c.created_at, c.owner,
           coalesce(po.display_name, c.owner_name, split_part(po.email,'@',1)) as owner_name,
           c.copier, coalesce(pc.display_name, split_part(pc.email,'@',1)) as copier_name, pc.email as copier_email
    from public.share_copies c
    left join public.profiles po on po.id = c.owner
    left join public.profiles pc on pc.id = c.copier
    order by c.created_at desc limit 2000) x);
end $$;
revoke all on function public.admin_share_copies() from public, anon;
grant execute on function public.admin_share_copies() to authenticated;
