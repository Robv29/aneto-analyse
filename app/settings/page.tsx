import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getConnectorConfiguration } from '@/lib/env'
import { asActiveWorkspace, getSessionContext } from '@/lib/data/session'
import { getSources, type WorkspaceSource } from '@/lib/data/loaders'
import { signOut } from '@/app/login/actions'
import { connectAusha, enqueueAushaSync, syncTikTokNow, syncYouTubeNow } from './actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await getSessionContext()
  const feedback = await searchParams
  if (session.mode === 'live' && !session.viewer) redirect('/login')
  const workspace = asActiveWorkspace(session)
  const sources: WorkspaceSource[] = workspace ? await getSources(workspace) : []
  const connectors = getConnectorConfiguration()
  const snapshot = {
    mode: session.mode,
    viewer: session.viewer,
    organization: session.organization,
    sources,
    connectors,
  }
  const ausha = snapshot.sources.find((source) => source.provider === 'ausha')
  const aushaReady = snapshot.connectors.find((connector) => connector.key === 'ausha')?.configured
  const youtube = snapshot.sources.find((source) => source.provider === 'youtube')
  const youtubeReady = snapshot.connectors.find((connector) => connector.key === 'youtube')?.configured
  const youtubeTranscriptionReady = youtube?.oauthScopes.includes('https://www.googleapis.com/auth/youtube.force-ssl')
  const tiktok = snapshot.sources.find((source) => source.provider === 'tiktok')
  const tiktokReady = snapshot.connectors.find((connector) => connector.key === 'tiktok')?.configured
  const instagram = snapshot.sources.find((source) => source.provider === 'instagram')
  const instagramReady = snapshot.connectors.find((connector) => connector.key === 'instagram')?.configured
  const tiktokVideoReady = tiktok?.oauthScopes.includes('video.list')

  return (
    <main className="settings-page">
      <header>
        <Link href="/" className="auth-logo" aria-label="Retour à Aneto">A</Link>
        <div>
          <span>ANETO / PARAMÈTRES</span>
          <h1>{snapshot.organization?.name ?? 'Démonstration'}</h1>
        </div>
        <Link href="/">Retour au produit</Link>
      </header>

      {feedback.error ? <p className="settings-feedback is-error" role="alert">{feedback.error}</p> : null}
      {feedback.success ? <p className="settings-feedback is-success" role="status">{feedback.success}</p> : null}

      <section className="settings-section">
        <div>
          <span>ENVIRONNEMENT</span>
          <h2>{snapshot.mode === 'live' ? 'Espace connecté' : 'Mode démonstration'}</h2>
        </div>
        <p>{snapshot.mode === 'live'
          ? `${snapshot.viewer?.displayName ?? snapshot.viewer?.email} · rôle ${snapshot.organization?.role ?? 'sans organisation'}`
          : 'Aucune donnée affichée dans le produit n’est encore issue d’un compte client.'}</p>
      </section>

      {snapshot.mode === 'live' && aushaReady ? (
        <section className="settings-section connector-control">
          <div>
            <span>AUSHA / PUBLIC API</span>
            <h2>{ausha ? 'Émission connectée' : 'Connecter une émission'}</h2>
          </div>
          {ausha ? (
            <div>
              <p>Dernière synchronisation : {ausha.lastSyncedAt ? new Date(ausha.lastSyncedAt).toLocaleString('fr-FR') : 'jamais'}</p>
              <form action={enqueueAushaSync}>
                <input type="hidden" name="sourceId" value={ausha.id} />
                <button type="submit">Programmer une synchronisation</button>
              </form>
            </div>
          ) : (
            <form action={connectAusha} className="auth-form">
              <label>
                Identifiant de l’émission
                <input name="showId" inputMode="numeric" pattern="[0-9]+" required />
              </label>
              <label>
                Jeton Public API Ausha
                <input name="accessToken" type="password" autoComplete="off" minLength={20} required />
              </label>
              <small>Le jeton est vérifié auprès d’Ausha puis stocké sous forme chiffrée.</small>
              <button type="submit">Vérifier et connecter</button>
            </form>
          )}
        </section>
      ) : null}

      {snapshot.mode === 'live' && youtubeReady ? (
        <section className="settings-section connector-control">
          <div>
            <span>YOUTUBE / OAUTH</span>
            <h2>{youtube ? 'Chaîne connectée' : 'Connecter une chaîne'}</h2>
          </div>
          {youtube ? (
            <div>
              <p>Dernière synchronisation : {youtube.lastSyncedAt ? new Date(youtube.lastSyncedAt).toLocaleString('fr-FR') : 'jamais'}</p>
              <p className={youtubeTranscriptionReady ? 'connector-capability is-ready' : 'connector-capability'}>
                {youtubeTranscriptionReady
                  ? 'Transcription autorisée · Aneto peut lire les pistes de sous-titres de tes vidéos.'
                  : 'Transcription non autorisée · renouvelle l’accès Google pour importer les sous-titres.'}
              </p>
              <form action={syncYouTubeNow}>
                <input type="hidden" name="sourceId" value={youtube.id} />
                <button type="submit">Synchroniser les vidéos maintenant</button>
              </form>
              <Link href="/api/oauth/youtube/start" className="connector-link">{youtubeTranscriptionReady ? 'Renouveler l’autorisation YouTube' : 'Autoriser les transcriptions'}</Link>
              <small>Google regroupe la lecture des sous-titres dans une permission au libellé étendu. Aneto effectue uniquement des appels de lecture et ne modifie aucune vidéo.</small>
            </div>
          ) : (
            <div>
              <p>Connexion officielle Google. Aneto lit les vidéos, statistiques et pistes de sous-titres, sans publier ni supprimer de contenu.</p>
              <Link href="/api/oauth/youtube/start" className="connector-link">Connecter ma chaîne YouTube</Link>
            </div>
          )}
        </section>
      ) : null}

      {snapshot.mode === 'live' ? (
        <section className="settings-section connector-control">
          <div>
            <span>TIKTOK / OAUTH</span>
            <h2>{tiktok ? 'Compte connecté' : 'Connecter @aneto.media'}</h2>
          </div>
          {tiktok ? (
            <div>
              <p>Dernière synchronisation : {tiktok.lastSyncedAt ? new Date(tiktok.lastSyncedAt).toLocaleString('fr-FR') : 'jamais'}</p>
              <p className={tiktokVideoReady ? 'connector-capability is-ready' : 'connector-capability'}>
                {tiktokVideoReady
                  ? 'Autorisation vérifiée · lecture des dernières vidéos publiques et de leurs performances.'
                  : 'Autorisation incomplète · TikTok n’a pas accordé la permission video.list.'}
              </p>
              {tiktokVideoReady ? (
                <form action={syncTikTokNow}>
                  <input type="hidden" name="sourceId" value={tiktok.id} />
                  <button type="submit">Synchroniser TikTok maintenant</button>
                </form>
              ) : null}
              <Link href="/api/oauth/tiktok/start" className="connector-link">{tiktokVideoReady ? 'Renouveler l’autorisation TikTok' : 'Corriger l’autorisation TikTok'}</Link>
            </div>
          ) : tiktokReady ? (
            <div>
              <p>Connexion officielle TikTok. Aneto récupère uniquement les dernières vidéos publiques, leurs légendes et leurs performances.</p>
              <Link href="/api/oauth/tiktok/start" className="connector-link">Connecter mon compte TikTok</Link>
            </div>
          ) : (
            <div>
              <p>Le connecteur est prêt côté Aneto. Il reste à enregistrer la clé et le secret de l’application TikTok dans Vercel.</p>
              <small>URL de redirection à déclarer : https://aneto-analyse.vercel.app/api/oauth/tiktok/callback</small>
            </div>
          )}
        </section>
      ) : null}

      {snapshot.mode === 'live' ? (
        <section className="settings-section connector-control">
          <div>
            <span>INSTAGRAM / OAUTH META</span>
            <h2>{instagram ? 'Compte connecté' : 'Connecter un compte professionnel'}</h2>
          </div>
          {instagram ? (
            <div>
              <p>Dernière synchronisation : {instagram.lastSyncedAt ? new Date(instagram.lastSyncedAt).toLocaleString('fr-FR') : 'jamais'}</p>
              <p className="connector-capability is-ready">
                Publications, Reels et statistiques de portée importés.
              </p>
              <Link href="/api/oauth/instagram/start" className="connector-link">Renouveler l’autorisation Instagram</Link>
              <small>L’autorisation Meta expire au bout de 60 jours : Aneto préviendra quand il faudra la renouveler.</small>
            </div>
          ) : instagramReady ? (
            <div>
              <p>Connexion officielle Meta. Ton compte Instagram doit être <strong>professionnel</strong> et relié à une Page Facebook.</p>
              <Link href="/api/oauth/instagram/start" className="connector-link">Connecter mon compte Instagram</Link>
            </div>
          ) : (
            <div>
              <p>Le connecteur est prêt côté Aneto. Il reste à créer l’application Meta et à enregistrer sa clé et son secret dans Vercel.</p>
              <small>URL de redirection à déclarer : https://aneto-analyse.vercel.app/api/oauth/instagram/callback</small>
            </div>
          )}
        </section>
      ) : null}

      <section className="settings-section integrations-list">
        <div>
          <span>INTÉGRATIONS</span>
          <h2>Sources disponibles</h2>
        </div>
        <div>
          {snapshot.connectors.map((connector) => {
            const source = snapshot.sources.find((item) => item.provider === connector.key)
            const state = source?.state ?? (connector.configured ? 'Prêt à connecter' : 'Non configuré')
            return (
              <article key={connector.key}>
                <strong>{connector.label}</strong>
                <span className={source?.state === 'connected' ? 'is-connected' : ''}>{state}</span>
              </article>
            )
          })}
        </div>
      </section>

      {snapshot.mode === 'live' ? (
        <form action={signOut} className="signout-form">
          <button type="submit">Se déconnecter</button>
        </form>
      ) : null}
    </main>
  )
}
