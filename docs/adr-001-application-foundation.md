# ADR-001 — Fondation applicative du Lot 0

**Statut :** Accepté  
**Date :** 10 août 2026

## Contexte

La production utilisait un wrapper Next.js généré au moment du déploiement, absent du dépôt. L’application locale était un serveur statique sans routes, authentification, base de données ou tests.

## Décision

- Next.js 16 App Router devient l’unique application locale et distante.
- Les lectures internes seront réalisées dans des Server Components.
- Les mutations UI utiliseront des Server Actions.
- Les webhooks et intégrations externes utiliseront des Route Handlers.
- Supabase fournira PostgreSQL, Auth et RLS.
- Chaque donnée métier portera sa provenance, ses dates d’observation/synchronisation et sa confiance.
- L’interface existante reste un composant client provisoire pendant la migration incrémentale.

## Conséquences

- Les URLs sont partageables et le retour navigateur fonctionne.
- Le build déployé peut désormais être reproduit depuis Git.
- Aucune intégration n’est visible avant configuration de ses secrets.
- Le code client historique devra être remplacé progressivement par des composants React reliés aux données réelles.

## Prochaines actions

1. Configurer le projet Supabase et appliquer la migration.
2. Ajouter le parcours de connexion et la création d’organisation.
3. Connecter le premier vertical slice Ausha.
4. Remplacer la recommandation Thomas Fantini par une décision persistée.
