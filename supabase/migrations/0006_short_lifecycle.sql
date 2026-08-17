-- Cycle de vie des shorts.
-- 1. Un short copié puis publié est marqué comme tel : il disparaît des
--    propositions et n'est jamais reproposé.
-- 2. ai_analyses accepte plusieurs lots par vidéo (bouton « nouveaux shorts »
--    sur la dernière vidéo) : l'unicité par version saute, les kits sont
--    fusionnés à la lecture par candidate_key.

alter table public.clip_candidates
  add column if not exists status text not null default 'proposed'
    check (status in ('proposed', 'published', 'dismissed')),
  add column if not exists published_at timestamptz;

create index if not exists clip_candidates_org_status_idx
  on public.clip_candidates (organization_id, status, score desc);

alter table public.ai_analyses
  drop constraint if exists ai_analyses_content_item_id_kind_version_key;

-- 3. ai_analyses accueille aussi des analyses transverses (« ce qui marche »
--    sur tous les réseaux) : rattachées à l'organisation, pas à un contenu.
alter table public.ai_analyses
  alter column content_item_id drop not null;

alter table public.ai_analyses
  drop constraint if exists ai_analyses_kind_check;

alter table public.ai_analyses
  add constraint ai_analyses_kind_check
  check (kind in ('editorial_clips', 'performance_insights'));

alter table public.ai_analyses
  add column if not exists payload jsonb not null default '{}'::jsonb;
