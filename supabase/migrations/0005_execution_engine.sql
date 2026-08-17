-- Lot refonte P1 : moteur d'exécution fiable.
-- 1. claim_next_sync_run accepte un filtre d'organisation pour qu'une requête
--    utilisateur ne traite jamais les runs d'un autre tenant.
-- 2. release_stale_sync_runs libère les runs abandonnés par une fonction tuée.
-- 3. purge_finished_sync_runs borne la croissance de la table.
-- 4. clip_candidates matérialise les extraits calculés à la synchronisation.
-- 5. ai_analyses historise chaque analyse IA au lieu d'écraser un JSONB.
-- 6. Unicité des décisions actives, jusqu'ici garantie seulement en code applicatif.

drop function if exists public.claim_next_sync_run();

create or replace function public.claim_next_sync_run(target_organization_id uuid default null)
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
    where status = 'queued'
      and available_at <= now()
      and (target_organization_id is null or organization_id = target_organization_id)
    order by available_at, created_at
    for update skip locked
    limit 1
  )
  returning *;
end;
$$;

revoke all on function public.claim_next_sync_run(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_sync_run(uuid) to service_role;

create or replace function public.release_stale_sync_runs(stale_minutes integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  with stale as (
    select id, attempt
    from public.sync_runs
    where status = 'running'
      and locked_at is not null
      and locked_at < now() - make_interval(mins => stale_minutes)
    for update skip locked
  ),
  requeued as (
    update public.sync_runs runs
    set status = case when stale.attempt < 3 then 'queued' else 'failed' end,
        attempt = case when stale.attempt < 3 then stale.attempt + 1 else stale.attempt end,
        available_at = now(),
        locked_at = null,
        finished_at = case when stale.attempt < 3 then null else now() end,
        error_code = 'stale_run_released',
        error_message = 'Run interrompu (délai d''exécution dépassé), remis en file.'
    from stale
    where runs.id = stale.id
    returning runs.id
  )
  select count(*) into released from requeued;
  return released;
end;
$$;

revoke all on function public.release_stale_sync_runs(integer) from public, anon, authenticated;
grant execute on function public.release_stale_sync_runs(integer) to service_role;

create or replace function public.purge_finished_sync_runs(keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  delete from public.sync_runs
  where status in ('succeeded', 'failed', 'cancelled')
    and created_at < now() - make_interval(days => keep_days);
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.purge_finished_sync_runs(integer) from public, anon, authenticated;
grant execute on function public.purge_finished_sync_runs(integer) to service_role;

create table if not exists public.clip_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  candidate_key text not null,
  start_seconds integer not null check (start_seconds >= 0),
  end_seconds integer not null check (end_seconds > start_seconds),
  duration_seconds integer not null check (duration_seconds > 0),
  score integer not null check (score between 0 and 100),
  editorial_score integer not null check (editorial_score between 0 and 100),
  retention jsonb,
  title text not null,
  hook text not null,
  excerpt text not null,
  reasons text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_item_id, candidate_key)
);

create index if not exists clip_candidates_org_score_idx
  on public.clip_candidates (organization_id, score desc);

alter table public.clip_candidates enable row level security;

create policy "clip_candidates_read_member"
  on public.clip_candidates for select
  using (public.is_organization_member(organization_id));

revoke insert, update, delete on public.clip_candidates from anon, authenticated;

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  kind text not null check (kind in ('editorial_clips')),
  version integer not null check (version > 0),
  model text not null,
  clips jsonb not null default '[]'::jsonb,
  market_study jsonb,
  created_at timestamptz not null default now(),
  unique (content_item_id, kind, version)
);

create index if not exists ai_analyses_org_content_idx
  on public.ai_analyses (organization_id, content_item_id, kind, version desc);

alter table public.ai_analyses enable row level security;

create policy "ai_analyses_read_member"
  on public.ai_analyses for select
  using (public.is_organization_member(organization_id));

revoke insert, update, delete on public.ai_analyses from anon, authenticated;

-- Une seule décision active portant un titre donné par organisation.
-- Le code applicatif la vérifiait par lecture ; la base la garantit désormais.
create unique index if not exists decisions_org_active_title_idx
  on public.decisions (organization_id, lower(title))
  where status in ('proposed', 'accepted', 'scheduled');
