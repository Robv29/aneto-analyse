# Aneto

Aneto est le système nerveux éditorial d'un média. Il transforme les signaux dispersés, la mémoire des décisions et le Media DNA en quelques actions préparées et justifiées.

## Lancer le produit

```bash
npm install
npm run dev
```

Copiez `.env.example` vers `.env.local` pour activer Supabase et les connecteurs. Sans configuration, l'application affiche un écran d'attente explicite — aucune donnée fictive n'est mélangée au produit.

## Architecture (refonte 2026-08)

- **UI React native** : les six vues (Priorités, Analyses, Shorts, Relations, Historique, Veille) sont des Server Components Next.js avec de petits îlots clients (synchronisation, analyse IA, décisions, palette `⌘ K`). Aucun rechargement de page : les mutations passent par les routes API puis `router.refresh()`.
- **Lecture ciblée** : chaque page charge uniquement ses données (`lib/data/loaders.ts`). Les extraits candidats sont matérialisés en base (`clip_candidates`) au moment de la synchronisation, jamais recalculés au rendu.
- **Moteur de jobs** : la file `sync_runs` (claim SQL `FOR UPDATE SKIP LOCKED`) est drainée avec un budget temps par le cron nocturne et par les déclenchements manuels, scopés à l'organisation. Les runs abandonnés sont libérés par `release_stale_sync_runs`, l'historique est purgé par `purge_finished_sync_runs`.
- **Synchronisation incrémentale** : YouTube relit les 100 vidéos les plus récentes et ne repagine au-delà que s'il découvre des vidéos inconnues ; TikTok pagine jusqu'à 60 vidéos.
- **IA historisée** : chaque analyse éditoriale est stockée dans `ai_analyses` (modèle, version, extraits, étude de marché). Incrémenter `EDITORIAL_ANALYSIS_VERSION` relance l'analyse sans toucher aux données. Le pool gratuit OpenRouter est refusé : le modèle par défaut est `anthropic/claude-haiku-4.5` (surchargez `OPENROUTER_MODEL` avec un modèle payant précis).

## Authentification et données réelles

- connexion Supabase par e-mail et mot de passe ;
- création atomique d'une organisation et de son propriétaire ;
- lectures serveur isolées par organisation (RLS systématique) ;
- décisions, contenus, sources, extraits et mémoire chargés depuis Supabase.

Pour activer le mode connecté : appliquez les migrations `supabase/migrations` **dans l'ordre (0001 → 0005)**, renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, puis créez un utilisateur dans Supabase Auth. L'utilisateur est dirigé vers l'onboarding lors de sa première connexion.

> ⚠️ La migration `0005_execution_engine.sql` est requise par cette version : elle remplace `claim_next_sync_run()` et crée `clip_candidates` et `ai_analyses`.

## Connecteurs

- **Ausha** : jeton Public API vérifié puis chiffré en AES-256-GCM (`source_credentials`), synchronisation idempotente et relançable.
- **YouTube** : OAuth Google (lecture seule), vidéos + statistiques + sous-titres + rétention d'audience.
- **TikTok** : OAuth TikTok (lecture seule), dernières vidéos publiques et performances.

La synchronisation nocturne (02:00 UTC, `vercel.json`) nécessite `SUPABASE_SERVICE_ROLE_KEY`, `ANETO_CREDENTIAL_ENCRYPTION_KEY` et `CRON_SECRET`. Elle respecte les réponses `429` et leur délai `Retry-After`, limite les tentatives et conserve les erreurs dans `sync_runs`.

## Qualité

```bash
npm run check   # tsc --noEmit + tests
npm run build
```

La CI exécute les deux. Les en-têtes de sécurité (CSP, X-Frame-Options, Referrer-Policy) sont définis dans `next.config.mjs`.
