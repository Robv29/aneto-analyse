create table public.source_credentials (
  source_id uuid primary key references public.sources(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1 check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.source_credentials enable row level security;
revoke all on public.source_credentials from anon, authenticated;

alter table public.sync_runs
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists idempotency_key text;

create unique index if not exists sync_runs_idempotency_idx
  on public.sync_runs (source_id, idempotency_key);

create index if not exists sync_runs_queue_idx
  on public.sync_runs (status, available_at, created_at)
  where status = 'queued';

create policy "sources_insert_admin"
  on public.sources for insert
  with check (
    exists (
      select 1 from public.memberships
      where organization_id = sources.organization_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy "sources_update_admin"
  on public.sources for update
  using (
    exists (
      select 1 from public.memberships
      where organization_id = sources.organization_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy "sync_runs_insert_editor"
  on public.sync_runs for insert
  with check (
    exists (
      select 1 from public.memberships
      where organization_id = sync_runs.organization_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'editor')
    )
  );

create or replace function public.claim_next_sync_run()
returns setof public.sync_runs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.sync_runs
  set status = 'running',
      started_at = coalesce(started_at, now()),
      locked_at = now()
  where id = (
    select id
    from public.sync_runs
    where status = 'queued' and available_at <= now()
    order by available_at, created_at
    for update skip locked
    limit 1
  )
  returning *;
end;
$$;

revoke all on function public.claim_next_sync_run() from public, anon, authenticated;
grant execute on function public.claim_next_sync_run() to service_role;
