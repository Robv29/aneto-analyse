import { getWorkspaceOrDemo } from '@/lib/data/guard'
import { getLibrary, getPatternInsights } from '@/lib/data/loaders'
import { computePerformancePatterns, type PatternRow } from '@/lib/editorial/patterns'
import { AnalyzePatterns } from '../../_components/analyze-patterns'
import { DemoWelcome } from '../../_components/demo-welcome'
import { compactNumber, providerLabel } from '../../_components/format'

export const dynamic = 'force-dynamic'

function PatternList({ title, rows, unit }: { title: string; rows: PatternRow[]; unit: string }) {
  if (!rows.length) return null
  const max = Math.max(...rows.map((row) => row.average), 1)
  return (
    <section className="dash-card">
      <header><span>{title}</span></header>
      <div className="dash-list">
        {rows.map((row) => (
          <div key={row.label} className="dash-row pattern-row">
            <div className="dash-row-copy">
              <strong>{row.label}</strong>
              <small>{row.count} contenu{row.count > 1 ? 's' : ''}{row.lift ? ` · ×${row.lift.toLocaleString('fr-FR')} vs médiane` : ''}</small>
              <i className="pattern-bar" style={{ ['--w' as string]: `${Math.round((row.average / max) * 100)}%` }}></i>
            </div>
            <div className="dash-row-metric">
              <b>{compactNumber(row.average)}</b>
              <small>{unit}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function PatternsPage() {
  const workspace = await getWorkspaceOrDemo()
  if (!workspace) return <DemoWelcome />

  const [library, insights] = await Promise.all([
    getLibrary(workspace),
    getPatternInsights(workspace),
  ])
  const patterns = computePerformancePatterns(library)

  if (patterns.sampleSize < 3) {
    return (
      <div className="dash page-enter">
        <header className="dash-topbar">
          <h1><small>PATTERNS / CE QUI MARCHE</small>Pas encore assez de données.</h1>
        </header>
        <div className="dash-empty">
          <strong>Il faut au moins 3 contenus avec des statistiques.</strong>
          <p>Synchronise tes sources : dès que la bibliothèque est assez fournie, Aneto croise durée, thèmes, hooks, hashtags et plateformes pour te dire ce qui marche le mieux chez toi.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dash page-enter">
      <header className="dash-topbar">
        <h1><small>PATTERNS / CE QUI MARCHE</small>Ce que tes chiffres disent.</h1>
        <div className="dash-sources">
          <span className="dash-source is-connected"><i></i>{patterns.sampleSize} contenus analysés<small>médiane {compactNumber(patterns.medianPrimary)}</small></span>
        </div>
      </header>

      <AnalyzePatterns hasInsights={Boolean(insights)} />

      {insights ? (
        <section className="dash-card dash-decision">
          <span className="dash-decision-meta">LECTURE IA · {new Date(insights.createdAt).toLocaleDateString('fr-FR')}</span>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text)', margin: '0 0 6px' }}>{insights.summary}</p>
          <details className="dash-why" open>
            <summary>Les enseignements et quoi en faire</summary>
            <ul>
              {insights.insights.map((insight) => (
                <li key={insight.finding}>
                  <b>CONSTAT</b>
                  <span>
                    <strong style={{ display: 'block', marginBottom: 3 }}>{insight.finding}</strong>
                    {insight.evidence}
                    <em style={{ display: 'block', marginTop: 5, fontStyle: 'normal', color: 'var(--lime)' }}>→ {insight.action}</em>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : (
        <div className="dash-empty">
          <strong>Les statistiques sont prêtes, la lecture IA attend.</strong>
          <p>Lance la lecture IA : elle croise les chiffres ci-dessous et en tire des actions concrètes pour tes prochaines publications.</p>
        </div>
      )}

      <section className="dash-kpis" aria-label="Par plateforme">
        {patterns.byPlatform.map((platform) => (
          <div key={platform.provider} className="dash-kpi">
            <small>{providerLabel(platform.provider).toUpperCase()}</small>
            <strong>{compactNumber(platform.median)}</strong>
            <span>{platform.count} contenus · médiane{platform.engagementRate !== null ? ` · ${platform.engagementRate.toLocaleString('fr-FR')} % engagement` : ''}</span>
          </div>
        ))}
      </section>

      <div className="dash-main">
        <div className="dash-col">
          <PatternList title="DURÉE : CE QUI PERFORME" rows={patterns.byDuration} unit="vues moy." />
          <PatternList title="THÈMES GAGNANTS" rows={patterns.byTheme} unit="vues moy." />
          <PatternList title="HASHTAGS" rows={patterns.byHashtag} unit="vues moy." />
        </div>
        <div className="dash-col">
          <PatternList title="TYPE DE HOOK (TITRE)" rows={patterns.byHookType} unit="vues moy." />
          <PatternList title="JOUR DE PUBLICATION" rows={patterns.byDay} unit="vues moy." />
        </div>
      </div>
    </div>
  )
}
