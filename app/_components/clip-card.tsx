import Link from 'next/link'
import type { BoardClip } from '@/lib/data/loaders'
import { formatClipTime } from '@/src/clips.mjs'
import { buildClipCopyText } from '@/src/openrouter.mjs'
import { CopyClipButton } from './copy-clip-button'
import { Icon } from './icons'

const scorecardLabels: Array<[string, keyof NonNullable<BoardClip['scorecard']>]> = [
  ['Hook', 'hook'],
  ['Autonomie', 'autonomy'],
  ['Tension', 'tension'],
  ['Conversation', 'conversation'],
  ['Fidélité', 'fidelity'],
]

export function ClipCard({ clip, index }: { clip: BoardClip; index: number }) {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(clip.externalId)}&t=${clip.start}s`
  const hasEditorialKit = clip.aiEnhanced && Boolean(clip.caption)
  const copyText = hasEditorialKit ? buildClipCopyText(clip) as string : ''

  return (
    <article className={`clip-card ${clip.aiEnhanced ? 'is-ai' : ''}`}>
      <div className="clip-rank">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>{clip.score}</strong>
        <small>SCORE<br />DE CUT</small>
      </div>
      <div className="clip-source">
        <small>VIDÉO SOURCE</small>
        <strong>{clip.contentTitle}</strong>
        <span>{formatClipTime(clip.start)} → {formatClipTime(clip.end)} · {clip.duration} sec</span>
        {clip.retention
          ? <em>Rétention relative · {Math.round(clip.retention.relativeRetentionPerformance * 100)}/100</em>
          : <em>Classement sémantique · rétention à importer</em>}
      </div>
      <div className="clip-proposal">
        <small>{clip.aiEnhanced ? 'TITRE DU COMITÉ IA' : 'TITRE PROPOSÉ'}</small>
        <h2>{clip.title}</h2>
        <div className="clip-hook">
          <span>{clip.aiEnhanced ? 'HOOK IA' : 'HOOK'}</span>
          <p>{clip.publicationHook}</p>
        </div>
        {clip.rationale ? <p className="clip-ai-rationale"><Icon name="spark" size={12} /> {clip.rationale}</p> : null}
        {hasEditorialKit ? (
          <>
            <div className="clip-market-angle">
              <small>ANGLE · {clip.targetAudience}</small>
              <p>{clip.marketAngle}</p>
              {clip.whyNow ? <em><strong>Pourquoi maintenant :</strong> {clip.whyNow}</em> : null}
            </div>
            {clip.scorecard ? (
              <div className="clip-scorecard">
                <small>LECTURE DU COMITÉ IA</small>
                {scorecardLabels.map(([label, key]) => (
                  <span key={key}>
                    <em>{label}</em>
                    <i style={{ ['--score' as string]: `${clip.scorecard![key] * 10}%` }}></i>
                    <b>{clip.scorecard![key]}/10</b>
                  </span>
                ))}
              </div>
            ) : null}
            {clip.risk ? <div className="clip-challenge"><small>CONTRE-ARGUMENT</small><p>{clip.risk}</p></div> : null}
            {clip.testHypothesis ? <div className="clip-test"><small>TEST À MESURER</small><p>{clip.testHypothesis}</p></div> : null}
            <div className="clip-caption">
              <small>TEXTE PRÊT À PUBLIER</small>
              <p>{clip.caption}</p>
              <div>{clip.hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <small className="hashtag-caveat">Hashtags de découvrabilité à tester · pas une tendance temps réel</small>
              {clip.platformFit.length ? <em>{clip.platformFit.join(' · ')}</em> : null}
            </div>
          </>
        ) : null}
        <blockquote>
          <small>PASSAGE RÉELLEMENT PRONONCÉ</small>
          {clip.excerpt}
        </blockquote>
        <div className="clip-reasons">{clip.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
      </div>
      <div className="clip-actions">
        {hasEditorialKit && copyText ? <CopyClipButton text={copyText} /> : null}
        <a href={watchUrl} target="_blank" rel="noreferrer">Voir au bon moment <Icon name="play" size={14} /></a>
        <Link className="secondary-link" href={`/transcripts/${encodeURIComponent(clip.contentItemId)}`}>
          Lire la transcription <Icon name="arrow" size={13} />
        </Link>
      </div>
    </article>
  )
}

export function ClipPreview({ clips }: { clips: BoardClip[] }) {
  return (
    <section className="clip-preview">
      <div className="section-label">
        <span>LES CUTS À REGARDER D’ABORD</span>
        <em>Texte exact · timecode exact · aucun extrait inventé</em>
      </div>
      <div className="clip-preview-grid">
        {clips.map((clip, index) => (
          <article key={clip.id}>
            <span>{String(index + 1).padStart(2, '0')} · {clip.score}/100</span>
            <small>{clip.contentTitle}</small>
            <h3>{clip.title}</h3>
            <p>« {clip.hook} »</p>
            <footer>
              <strong>{formatClipTime(clip.start)} → {formatClipTime(clip.end)}</strong>
              <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(clip.externalId)}&t=${clip.start}s`} target="_blank" rel="noreferrer">
                Voir <Icon name="play" size={13} />
              </a>
            </footer>
          </article>
        ))}
      </div>
      <Link className="clip-preview-all" href="/clips">Voir tous les extraits <Icon name="arrow" size={15} /></Link>
    </section>
  )
}
