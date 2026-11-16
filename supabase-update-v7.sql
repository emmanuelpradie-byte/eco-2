-- v7 : catalogue d'ingrédients commun (géré par l'administrateur, lu par tous)
create table if not exists public.ref_ingredients (
  id text primary key,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
drop trigger if exists ref_ingredients_touch on public.ref_ingredients;
create trigger ref_ingredients_touch before insert or update on public.ref_ingredients for each row execute function public.touch_row();
alter table public.ref_ingredients enable row level security;
drop policy if exists ref_read on public.ref_ingredients;
create policy ref_read on public.ref_ingredients for select to authenticated using (public.is_active());
drop policy if exists ref_insert on public.ref_ingredients;
create policy ref_insert on public.ref_ingredients for insert to authenticated with check (public.is_admin());
drop policy if exists ref_update on public.ref_ingredients;
create policy ref_update on public.ref_ingredients for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.ref_ingredients from anon;
grant select, insert, update on public.ref_ingredients to authenticated;
