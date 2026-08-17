import Link from 'next/link'
import type { LibraryItem } from '@/lib/data/loaders'
import { compactNumber, contentHref, providerLabel } from './format'
import { Icon } from './icons'

function transcriptStatus(item: LibraryItem) {
  if (item.provider === 'tiktok') return 'LÉGENDE + PERFORMANCES IMPORTÉES'
  if (item.transcript?.status === 'available') return `TRANSCRIT · ${compactNumber(item.transcript.wordCount)} MOTS`
  if (item.transcript?.status === 'authorization_required') return 'TRANSCRIPTION À AUTORISER'
  if (item.transcript) return 'SOUS-TITRES INDISPONIBLES'
  return 'TRANSCRIPTION EN ATTENTE'
}

export function SyncedLibrary({ items, total }: { items: LibraryItem[]; total: number }) {
  if (!total) {
    return (
      <section className="synced-library is-empty">
        <div>
          <span>CONTENUS SYNCHRONISÉS</span>
          <h2>En attente du premier contenu.</h2>
        </div>
        <p>Lance la synchronisation globale juste au-dessus.</p>
      </section>
    )
  }

  return (
    <section className="synced-library">
      <div className="synced-library-head">
        <div>
          <span>CONTENUS SYNCHRONISÉS</span>
          <h2>La matière est là.</h2>
        </div>
        <p>{total} contenu{total > 1 ? 's' : ''} récent{total > 1 ? 's' : ''}</p>
      </div>
      <div className="synced-content-list">
        {items.map((item, index) => {
          const isVideo = item.provider === 'youtube' || item.kind === 'video'
          const metric = isVideo ? item.payload.viewCount : item.payload.downloadsCount
          const label = isVideo ? 'vues' : 'écoutes'
          const href = contentHref(item)
          const contentType = isVideo ? 'VIDÉO' : 'ÉPISODE'
          const row = (
            <>
              <span className="synced-content-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="synced-content-copy">
                <small>
                  {providerLabel(item.provider).toUpperCase()} · {contentType}
                  {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString('fr-FR')}` : ''}
                  {' · '}{transcriptStatus(item)}
                </small>
                <strong>{item.title}</strong>
              </span>
              <span className="synced-content-metric"><b>{compactNumber(metric)}</b><small>{label}</small></span>
              <Icon name={href ? 'arrow' : 'check'} size={17} />
            </>
          )
          if (!href) return <article key={item.id}>{row}</article>
          return href.startsWith('http')
            ? <a key={item.id} href={href} target="_blank" rel="noreferrer">{row}</a>
            : <Link key={item.id} href={href}>{row}</Link>
        })}
      </div>
    </section>
  )
}
