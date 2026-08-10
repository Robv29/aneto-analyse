create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

create or replace function public.create_organization_with_owner(
  organization_name text,
  organization_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  new_organization_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication_required';
  end if;

  if length(trim(organization_name)) < 2 or organization_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'invalid_organization';
  end if;

  insert into public.profiles (id) values (actor_id) on conflict (id) do nothing;
  insert into public.organizations (name, slug)
  values (trim(organization_name), organization_slug)
  returning id into new_organization_id;

  insert into public.memberships (organization_id, user_id, role)
  values (new_organization_id, actor_id, 'owner');

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "decisions_insert_editor"
  on public.decisions for insert
  with check (
    exists (
      select 1 from public.memberships
      where organization_id = decisions.organization_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'editor')
    )
  );

create policy "decisions_update_editor"
  on public.decisions for update
  using (
    exists (
      select 1 from public.memberships
      where organization_id = decisions.organization_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'editor')
    )
  );
