# ANETO — Audit fonctionnel préalable à la Phase API 1

**Date :** 10 août 2026  
**Périmètre :** dépôt local, comportement frontend et méthode de déploiement actuelle  
**Verdict :** passage en production bloqué pour un usage client payant

## Résumé exécutif

L’interface est convaincante, mais l’application est encore une démonstration entièrement locale.

Constats mesurables :

- 0 appel réseau applicatif ;
- 0 API route ;
- 0 base de données et 0 persistance locale ;
- 0 authentification, organisation ou permission ;
- 0 intégration officielle ;
- 0 job, queue, webhook ou moteur de synchronisation ;
- 0 test automatisé ;
- 0 état loading, erreur, vide, offline ou retry ;
- 0 commit dans la branche `main` ;
- le code déployé sur Vercel est emballé dynamiquement dans une page Next.js qui n’existe pas dans le dépôt.

Les interactions actuelles modifient uniquement l’objet JavaScript `state`. Un rechargement efface chaque validation, workflow préparé, sélection et décision.

## Challenge de l’ordre proposé

Brancher Ausha immédiatement après la navigation serait une erreur. Une intégration réelle nécessite d’abord :

1. une application identique en local, dans GitHub et sur Vercel ;
2. une authentification et une isolation par organisation ;
3. une base de données avec provenance des données ;
4. un stockage sécurisé des autorisations OAuth ;
5. un moteur de jobs observable, idempotent et relançable ;
6. un socle de tests.

Sans cette fondation, les données d’un client pourraient être mélangées, perdues ou resynchronisées plusieurs fois. La fondation devient donc le lot P0, avant Ausha.

## État réel par zone

### Structure et navigation

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Parité dépôt / production | Deux architectures différentes : statique localement, wrapper Next.js généré pour Vercel | Une application versionnée et reproductible partout | P0 | 2 j | Aucune |
| Historique Git | Branche `main` sans commit | Historique, branches, revue et rollback | P0 | 0,5 j | Parité dépôt |
| Navigation latérale | Change une variable en mémoire, sans URL ni historique navigateur | Routes réelles, deep links, retour et restauration | P0 | 2 j | Architecture applicative |
| Aujourd’hui | Vue rendue depuis des constantes | Vue alimentée par décisions persistées | P0 | 3 j | Auth, BDD, moteur de décision |
| Intelligence | Module visible avec prédiction fictive | Route réelle, données datées et preuves consultables | P1 | 5 j | BDD, Media DNA |
| Graph | Vue réelle mais graphe codé en dur | Route, requêtes de voisinage et navigation illimitée | P1 | 6 j | Modèle de graphe, BDD |
| Mémoire | Timeline statique | Événements persistés, filtrables et consultables | P1 | 4 j | Event store |
| Research | Opportunités statiques | Résultats du moteur Research avec provenance | P1 | 5 j | Connecteurs, jobs |
| Profil `RV` | Élément visuel non interactif | Menu profil fonctionnel ou élément masqué | P0 | 1 j | Auth |
| Paramètres | Absent | Route intégrations, compte, équipe et préférences | P0 | 3 j | Auth, connecteurs |
| `/admin` | Absent | Synchronisations, jobs, erreurs, quotas et événements | P1 | 5 j | Observabilité, jobs |

### Accueil et recommandations

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Comprendre le signal nocturne | Ouvre un tiroir générique | Ouvre la preuve Research « restaurant » | P0 | 2 j | Research detail |
| Republier Thomas Fantini | Tiroir texte puis faux bouton de planification | Episode → analyse → preuves → actions → validation → préparation → publication | P0 | 6 j | Routes, BDD, publication |
| Créer un Reel | Même tiroir générique | Générateur avec épisode, séquences, hooks, sous-titres et rendus | P1 | 10–15 j | Stockage média, transcription, IA |
| CTR YouTube en baisse | Même tiroir générique | Comparateur de miniatures, historique et variantes | P1 | 5 j | YouTube Analytics, stockage |
| Mot-clé restaurant | Même tiroir générique | Research detail avec tendances, sources et invités | P1 | 4 j | Research, provenance |
| Valider et planifier | Change uniquement le texte du bouton | Crée une décision et une action planifiée persistées | P0 | 4 j | BDD, jobs, calendrier éditorial |
| Créer un épisode | Panneau de quatre étapes simulées | Workflow durable avec étapes, sorties et reprise | P0 | 6 j | Moteur de workflow |
| Préparer un tournage | Panneau simulé | Recherche, trame et checklist persistées | P1 | 5 j | Research, documents |
| Analyser les performances | Panneau simulé | Analyse réelle provenant des plateformes | P1 | 5 j | Connecteurs analytics |
| Chercher un invité | Panneau simulé | Recherche, scoring et fiche invité | P1 | 6 j | Research, graphe |
| Créer 10 Shorts | Panneau simulé | Pipeline média durable et exportable | P2 | 12–18 j | Transcription, stockage, rendu |
| Ouvrir le résultat | Réexécute le même état du panneau | Ouvre l’artefact produit par le workflow | P0 | 2 j | Stockage des sorties |

### Recherche et raccourcis

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Palette `⌘ K` | S’ouvre correctement | Recherche universelle et commandes dans la même surface | P0 | 5 j | Index de recherche, routes |
| Champ de palette | Accepte du texte sans le lire | Recherche instantanée, navigation clavier, aucun résultat | P0 | inclus | Index de recherche |
| Suggestions de palette | Ouvrent les panneaux simulés | Déclenchent des workflows durables | P0 | inclus | Workflows |
| Recherche globale | Ouvre la palette sans rechercher | Episodes, invités, entreprises, mots-clés, commentaires, publications, décisions et actions | P0 | 6 j | Modèle de données, index |
| Recherche du Graph | Bouton sans listener | Filtre et centre un nœud réel | P1 | 3 j | API Graph |
| `N` | Absent | Nouvel épisode | P1 | 0,5 j | Route épisode |
| `R`, `G`, `M`, `I` | Absents | Navigation vers les modules | P1 | 0,5 j | Routes |
| `?` | Absent | Aide complète des raccourcis | P1 | 1 j | Aucun |
| `⌘ F` dans Graph | Affiché mais inactif | Focus de la recherche Graph | P0 | 0,5 j | Recherche Graph |

### Intelligence et Media DNA

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Confiance 91 % | Constante sans provenance | Score daté, version du modèle et méthode | P1 | 3 j | Media DNA, provenance |
| Prédiction 78 % | Constante | Prédiction calculée, historisée et évaluable | P1 | 8–12 j | Dataset réel, pipeline ML |
| Tout préparer | Ouvre un workflow simulé | Lance un job durable et observable | P0 | 4 j | Workflow engine |
| 5 traits Media DNA | `div` non interactifs | Chacun ouvre preuves, épisodes, performances et historique | P1 | 5 j | Media DNA API |
| Ligne de preuves | Articles statiques | Evénements consultables avec source et avant/après | P1 | 3 j | Mémoire |
| Dernière évolution | Date fictive | Horodatage réel de recalcul | P1 | 1 j | Media DNA jobs |

### Knowledge Graph

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| 8 nœuds | Constantes JavaScript | Entités chargées par API avec pagination de voisinage | P1 | 5 j | Schéma de graphe |
| Clic nœud | Met à jour une fiche locale | Charge l’entité, ses relations et son historique | P1 | 3 j | API Graph |
| Fiche nœud | Statistiques génériques, 47/12 et 94/87 | Statistiques propres à chaque entité | P1 | 3 j | Agrégations |
| Bouton recommandation | Ouvre toujours Thomas Fantini | Ouvre la recommandation liée au nœud sélectionné | P0 | 1 j | Routage recommandation |
| Relations | Traits non interactifs | Relations sélectionnables et expliquées | P1 | 3 j | API Graph |
| Exploration | Un seul voisinage codé en dur | Expansion progressive sans fin et retour | P1 | 5 j | API Graph, cache |
| Glisser | Promesse affichée mais comportement absent | Pan, zoom, drag ou texte masqué | P0 | 2 j | Bibliothèque Graph |
| Clavier | `Enter` fonctionne sur les nœuds | Flèches, focus visible et annonces accessibles | P1 | 2 j | Accessibilité Graph |

### Mémoire

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Compteurs 128/286/174/42 | Constantes | Agrégats de l’organisation avec période | P1 | 2 j | Event store |
| Timeline | Articles non interactifs | Chaque événement ouvre avant, après, décision, impact et commentaire IA | P1 | 4 j | Event store, détail |
| Provenance | Absente | Source, date, modèle, confiance et origine | P0 | 3 j | Schéma commun |
| Filtres | Absents | Type, période, contenu, plateforme et impact | P2 | 2 j | API mémoire |
| Correction humaine | Absente | Corriger ou invalider un apprentissage | P1 | 4 j | Permissions, audit trail |

### Research

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| 4 opportunités | Boutons sans listener | Page détail avec sources, analyse et décision | P0 | 4 j | Research API |
| 8 sources actives | Indicateur fictif | Etat réel par connecteur | P1 | 2 j | Sync engine |
| Prochain scan 02:00 | Texte fictif | Planification réelle, fuseau et historique | P1 | 2 j | Scheduler |
| Scores +42/92/+118 | Constantes | Méthode, période et confiance accessibles | P1 | 3 j | Scoring |
| Sources | Noms décoratifs | Filtres et détails par source | P2 | 2 j | Research API |

### Etats, feedback et accessibilité

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Loading / skeleton | Absents | Etat par module et action | P0 | 2 j | Data fetching |
| Erreur / retry | Absents | Message utile, identifiant et relance | P0 | 2 j | Error model |
| Vide | Absent | Explication et première action | P0 | 1 j | Chaque module |
| Synchronisation | Simulée | Progression, dernière synchro et fraîcheur | P0 | 2 j | Sync engine |
| Offline | Absent | Bannière, lecture du cache et reprise | P1 | 3 j | Cache local |
| Notifications | Absentes | Feedback succès, échec et job terminé | P0 | 2 j | Event model |
| Focus modal | Aucun piège/restauration de focus | Focus initial, boucle, retour au déclencheur | P0 | 2 j | Composants dialog |
| Attributs dialog | Absents | `role=dialog`, nom accessible, `aria-modal` | P0 | 0,5 j | Dialogs |
| Zones cliquables | Plusieurs éléments visuels non interactifs | Transformer en contrôles ou masquer | P0 | 2 j | Audit écran par écran |

## Fondation technique obligatoire

| Composant | État actuel | Comportement attendu | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Application Next.js versionnée | Wrapper Vercel généré hors dépôt | App Router, build reproductible et même code partout | P0 | 3 j | Aucune |
| Authentification | Absente | Connexion, session, récupération et déconnexion | P0 | 3–5 j | Fournisseur auth |
| Multi-tenant | Absent | Organisation, membres, rôles et isolation | P0 | 4–6 j | Auth, BDD |
| Base de données | Absente | Schéma versionné, migrations, RLS et index | P0 | 5–8 j | Choix BDD |
| Provenance commune | Absente | Source, observed_at, synced_at, confiance et external_id | P0 | 3 j | BDD |
| Coffre OAuth | Absent | Tokens chiffrés, rotation et révocation | P0 | 3 j | Auth, backend |
| Contrat connecteur | Absent | Interface commune pull, webhook, quota et erreurs | P0 | 3 j | BDD |
| Moteur de jobs | Absent | Jobs idempotents, retries, backoff et dead letters | P0 | 6–10 j | BDD, queue |
| Observabilité | Absente | Logs structurés, traces, métriques et alertes | P0 | 3–5 j | Jobs, backend |
| Tests | Absents | Unitaires, intégration connecteurs et E2E critiques | P0 | 4–6 j initial | Architecture stable |
| CI/CD Git | Absent | Preview, tests, promotion et rollback | P0 | 2 j | Git, tests |

## Intégrations officielles

Les estimations supposent que les comptes développeur, applications OAuth et autorisations nécessaires sont disponibles.

| Connecteur | État actuel | Première définition de terminé | Priorité | Estimation | Dépendances |
|---|---|---|---|---:|---|
| Ausha | Absent | Connexion, catalogue, épisodes, statistiques, webhook/polling, retry | P1 | 6–9 j | Fondation complète, accès API |
| YouTube | Absent | OAuth, chaînes, vidéos, Analytics, miniatures, quotas et reprise | P1 | 8–12 j | Fondation complète, Google Cloud |
| Instagram | Absent | Meta OAuth, médias, insights, quotas et erreurs d’autorisation | P1 | 10–15 j | Fondation, app Meta validée |
| TikTok | Absent | OAuth, vidéos, analytics disponibles, quotas et revue d’application | P1 | 10–15 j | Fondation, app TikTok validée |
| Spotify | Absent | Contrat réservé et écran de connexion masqué | P2 | 2 j de préparation | Contrat connecteur |
| Apple Podcasts | Absent | Contrat réservé et écran masqué | P2 | 2 j de préparation | Contrat connecteur |
| LinkedIn | Absent | Contrat réservé et écran masqué | P2 | 2 j de préparation | Contrat connecteur |
| Search Console / Analytics | Absents | Contrat Google commun préparé | P2 | 3 j de préparation | OAuth Google |
| OpenAI / Anthropic | Absents | Gateway IA avec journalisation, coûts et évaluations | P1 | 5–8 j | BDD, observabilité |

## Découpage recommandé

### Lot 0 — Rendre le produit développable, 4 à 6 semaines

- application Next.js versionnée ;
- Git et CI/CD ;
- authentification et multi-tenant ;
- BDD, provenance et migrations ;
- jobs, logs et tests ;
- routes réelles et états communs.

### Lot 1 — Premier vertical slice réel, 2 à 3 semaines

Un seul parcours terminé de bout en bout : connecter Ausha, synchroniser un épisode, l’afficher, ouvrir une recommandation fondée sur ses données, la valider et retrouver la décision dans la mémoire.

### Lot 2 — YouTube et décisions éditoriales, 3 à 5 semaines

YouTube Analytics, CTR, miniatures, comparaison, Research detail et recherche universelle.

### Lot 3 — Media DNA et Graph réels, 4 à 7 semaines

Calcul Media DNA, preuves, mémoire longue, entités et relations navigables.

### Lot 4 — Instagram, TikTok et pipelines média, 5 à 8 semaines

Connecteurs soumis aux validations des plateformes, génération Reel/Short et publication contrôlée.

## Estimation globale

Pour une équipe expérimentée de deux développeurs produit, un designer-développeur et un profil data/IA à temps partiel : **4 à 7 mois** pour atteindre l’ensemble du critère de validation annoncé.

Ce n’est pas un sprint. La première preuve de produit réel doit être le vertical slice Ausha, pas quatre intégrations superficielles en parallèle.

## Checklist de sortie de l’audit

- [x] Tous les contrôles visibles recensés
- [x] Faux comportements distingués des comportements persistants
- [x] Navigation, Graph, Intelligence, Mémoire et Research inspectés
- [x] Recherche et raccourcis inspectés
- [x] Etats et accessibilité inspectés
- [x] APIs, synchronisation, données et admin inspectés
- [x] Priorités, estimations et dépendances documentées
- [x] Risque de divergence dépôt / production identifié
- [ ] Accès développeur Ausha disponible
- [ ] Accès Google Cloud / YouTube disponible
- [ ] Application Meta disponible et validée
- [ ] Application TikTok disponible et validée
- [ ] Choix d’authentification confirmé
- [ ] Choix de base de données confirmé

## Décision de gate

**Aucune fonctionnalité API ne doit être commencée avant validation du Lot 0.**

L’audit est terminé. La prochaine action recommandée est de versionner l’application réellement déployée dans le dépôt et de construire le socle Next.js/auth/BDD/jobs/tests. L’interface validée doit rester visuellement inchangée pendant cette migration.
