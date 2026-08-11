import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAuthenticatedOrganization } from '@/lib/auth/organization'

export const dynamic = 'force-dynamic'

export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedOrganization()
  if (!context) redirect('/login')

  const { id } = await params
  const [{ data: content }, { data: transcript }] = await Promise.all([
    context.supabase
      .from('content_items')
      .select('id, title, kind, external_id')
      .eq('id', id)
      .eq('organization_id', context.organizationId)
      .maybeSingle(),
    context.supabase
      .from('content_transcripts')
      .select('status, language, track_kind, plain_text, updated_at')
      .eq('content_item_id', id)
      .eq('organization_id', context.organizationId)
      .maybeSingle(),
  ])

  if (!content) notFound()
  const available = transcript?.status === 'available' && transcript.plain_text

  return (
    <main className="transcript-page">
      <header>
        <Link href="/" className="auth-logo" aria-label="Retour à Aneto">A</Link>
        <div>
          <span>ANETO / TRANSCRIPTION</span>
          <h1>{content.title}</h1>
        </div>
        <Link href="/">Retour au produit</Link>
      </header>

      <section className="transcript-meta">
        <span>{content.kind === 'video' ? 'YOUTUBE' : 'AUSHA'}</span>
        <span>{transcript?.language ? `LANGUE · ${transcript.language.toUpperCase()}` : 'LANGUE INCONNUE'}</span>
        <span>{transcript?.track_kind === 'ASR' ? 'SOUS-TITRES AUTOMATIQUES' : 'SOUS-TITRES FOURNIS'}</span>
        {transcript?.updated_at ? <span>MISE À JOUR · {new Date(transcript.updated_at).toLocaleString('fr-FR')}</span> : null}
      </section>

      {available ? (
        <article className="transcript-copy">{transcript.plain_text}</article>
      ) : (
        <section className="transcript-empty">
          <span>TRANSCRIPTION INDISPONIBLE</span>
          <h2>{transcript?.status === 'authorization_required' ? 'Autorisation Google nécessaire.' : 'Aucune piste de sous-titres exploitable.'}</h2>
          <p>{transcript?.status === 'authorization_required'
            ? 'Renouvelle l’autorisation YouTube dans les paramètres, puis relance la synchronisation.'
            : 'YouTube ne fournit pas encore de piste téléchargeable pour cette vidéo.'}</p>
          <Link href="/settings">Ouvrir les paramètres</Link>
        </section>
      )}
    </main>
  )
}
