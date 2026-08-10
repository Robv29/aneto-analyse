create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('ausha', 'youtube', 'instagram', 'tiktok', 'spotify', 'apple_podcasts', 'linkedin', 'google')),
  external_account_id text,
  state text not null default 'disconnected' check (state in ('disconnected', 'connected', 'syncing', 'error', 'paused')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  cursor text,
  attempt integer not null default 1 check (attempt > 0),
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  kind text not null check (kind in ('episode', 'video', 'reel', 'short', 'publication')),
  external_id text,
  title text not null,
  published_at timestamptz,
  source_observed_at timestamptz,
  synced_at timestamptz,
  confidence numeric(5,4) check (confidence between 0 and 1),
  provenance jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_id, external_id)
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  title text not null,
  rationale text not null,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'scheduled', 'completed', 'failed')),
  confidence numeric(5,4) check (confidence between 0 and 1),
  evidence jsonb not null default '[]'::jsonb,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memory_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_id uuid references public.decisions(id) on delete set null,
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  before_state jsonb,
  after_state jsonb,
  impact jsonb not null default '{}'::jsonb,
  source text not null,
  confidence numeric(5,4) check (confidence between 0 and 1),
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index content_items_org_published_idx on public.content_items (organization_id, published_at desc);
create index decisions_org_status_idx on public.decisions (organization_id, status, created_at desc);
create index memory_events_org_observed_idx on public.memory_events (organization_id, observed_at desc);
create index sync_runs_source_created_idx on public.sync_runs (source_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.sources enable row level security;
alter table public.sync_runs enable row level security;
alter table public.content_items enable row level security;
alter table public.decisions enable row level security;
alter table public.memory_events enable row level security;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

create policy "profiles_read_self" on public.profiles for select using (id = auth.uid());
create policy "memberships_read_org" on public.memberships for select using (public.is_organization_member(organization_id));
create policy "organizations_read_member" on public.organizations for select using (public.is_organization_member(id));
create policy "sources_read_member" on public.sources for select using (public.is_organization_member(organization_id));
create policy "sync_runs_read_member" on public.sync_runs for select using (public.is_organization_member(organization_id));
create policy "content_items_read_member" on public.content_items for select using (public.is_organization_member(organization_id));
create policy "decisions_read_member" on public.decisions for select using (public.is_organization_member(organization_id));
create policy "memory_events_read_member" on public.memory_events for select using (public.is_organization_member(organization_id));

revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
