alter table public.sources
  add column if not exists oauth_scopes text[] not null default '{}'::text[];

create table if not exists public.content_transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null unique references public.content_items(id) on delete cascade,
  source text not null check (source in ('youtube_captions', 'audio_transcription')),
  status text not null check (status in ('available', 'unavailable', 'authorization_required', 'error')),
  language text,
  track_kind text,
  caption_track_id text,
  plain_text text,
  word_count integer not null default 0 check (word_count >= 0),
  keywords text[] not null default '{}'::text[],
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'available' and plain_text is not null) or status <> 'available')
);

create index if not exists content_transcripts_org_status_idx
  on public.content_transcripts (organization_id, status, updated_at desc);

alter table public.content_transcripts enable row level security;

create policy "content_transcripts_read_member"
  on public.content_transcripts for select
  using (public.is_organization_member(organization_id));

revoke insert, update, delete on public.content_transcripts from anon, authenticated;
