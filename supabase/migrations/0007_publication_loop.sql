-- Boucle de mesure : ce qu'un short devient une fois publié.
-- Quand un short est marqué publié, Aneto le cherche à chaque synchronisation
-- parmi les nouveaux formats courts, le rattache, puis suit ses performances.
-- C'est ce retour qui permet à Patterns de dire ce qui marche vraiment.

create table if not exists public.short_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Le short proposé par Aneto.
  source_content_item_id uuid not null references public.content_items(id) on delete cascade,
  candidate_key text not null,
  clip_title text not null,
  -- Le contenu publié retrouvé sur une plateforme (null tant qu'introuvable).
  published_content_item_id uuid references public.content_items(id) on delete set null,
  match_confidence text not null default 'pending'
    check (match_confidence in ('pending', 'automatic', 'confirmed', 'not_found')),
  marked_at timestamptz not null default now(),
  matched_at timestamptz,
  -- Dernier relevé de performance du contenu publié.
  metrics jsonb not null default '{}'::jsonb,
  metrics_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_content_item_id, candidate_key)
);

create index if not exists short_publications_org_idx
  on public.short_publications (organization_id, marked_at desc);

create index if not exists short_publications_pending_idx
  on public.short_publications (organization_id, match_confidence)
  where match_confidence = 'pending';

alter table public.short_publications enable row level security;

create policy "short_publications_read_member"
  on public.short_publications for select
  using (public.is_organization_member(organization_id));

revoke insert, update, delete on public.short_publications from anon, authenticated;
