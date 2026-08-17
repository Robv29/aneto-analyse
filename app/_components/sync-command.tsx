'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Icon } from './icons'

type SyncCommandProps = {
  sourceLabels: string[]
  connectedCount: number
  latestSync: string | null
}

// Îlot client : déclenche la synchronisation puis rafraîchit les données du
// serveur via router.refresh(). Aucun rechargement complet de page.
export function SyncCommand({ sourceLabels, connectedCount, latestSync }: SyncCommandProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'success' | 'error' | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const syncAll = async () => {
    setSyncing(true)
    setMessage(null)
    setTone(null)
    try {
      const response = await fetch('/api/sync/all', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'La synchronisation n’a pas pu démarrer.')
      setMessage(result.message)
      setTone(result.status === 'succeeded' ? 'success' : 'error')
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La synchronisation n’a pas pu démarrer.')
      setTone('error')
    } finally {
      setSyncing(false)
    }
  }

  const busy = syncing || isRefreshing
  return (
    <section className={`sync-command ${busy ? 'is-syncing' : ''}`}>
      <div className="sync-command-copy">
        <span>MISE À JOUR GLOBALE</span>
        <p>{sourceLabels.length ? sourceLabels.join(' + ') : 'Connecte une première source dans les paramètres.'}</p>
      </div>
      <button id="sync-all" type="button" onClick={syncAll} disabled={busy || !connectedCount}>
        <span className="sync-command-icon"><Icon name="sync" size={26} /></span>
        <strong>{busy ? 'Synchronisation en cours…' : 'Tout synchroniser'}</strong>
        <small>
          {busy
            ? 'Aneto interroge toutes tes plateformes'
            : connectedCount
              ? `${connectedCount} source${connectedCount > 1 ? 's' : ''} en un seul clic`
              : 'Aucune source connectée'}
        </small>
        <Icon name="arrow" size={20} />
      </button>
      <div className="sync-command-meta">
        <span>{latestSync ? `Dernière mise à jour · ${new Date(latestSync).toLocaleString('fr-FR')}` : 'Aucune synchronisation terminée'}</span>
        <span>Les données restent en lecture seule</span>
      </div>
      {message ? (
        <p className={`sync-feedback ${tone === 'success' ? 'is-success' : 'is-error'}`} role="status">{message}</p>
      ) : null}
    </section>
  )
}

// Barre compacte du tableau de bord : un bouton, un statut, pas de section géante.
export function SyncBar({ connectedCount, latestSync }: { connectedCount: number; latestSync: string | null }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<'success' | 'error' | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const syncAll = async () => {
    setSyncing(true)
    setMessage(null)
    setTone(null)
    try {
      const response = await fetch('/api/sync/all', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'La synchronisation n’a pas pu démarrer.')
      setMessage(result.message)
      setTone(result.status === 'succeeded' ? 'success' : 'error')
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La synchronisation n’a pas pu démarrer.')
      setTone('error')
    } finally {
      setSyncing(false)
    }
  }

  const busy = syncing || isRefreshing
  return (
    <div className="dash-syncbar">
      <button type="button" onClick={syncAll} disabled={busy || !connectedCount}>
        <Icon name="sync" size={14} />
        {busy ? 'Synchronisation…' : 'Synchroniser'}
      </button>
      <span className={`dash-sync-status ${tone === 'success' ? 'is-success' : tone === 'error' ? 'is-error' : ''}`} role="status">
        {message ?? (latestSync ? `Dernière mise à jour · ${new Date(latestSync).toLocaleString('fr-FR')}` : 'Aucune synchronisation terminée')}
      </span>
    </div>
  )
}

export function SyncRetryButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const retry = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/sync/all', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'La synchronisation n’a pas pu démarrer.')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La synchronisation n’a pas pu démarrer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button id="sync-from-clips" type="button" onClick={retry} disabled={disabled || busy}>
        {busy ? 'Synchronisation…' : label} <Icon name="sync" size={16} />
      </button>
      {error ? <p className="sync-feedback is-error" role="status">{error}</p> : null}
    </>
  )
}
