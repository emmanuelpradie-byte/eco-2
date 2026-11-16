-- v6 : un retrait de partage fait par l'administrateur est marqué {"by":"admin"}
-- (déjà appliqué sur ton projet Supabase — rien à faire)
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
