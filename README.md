# Aneto

Aneto est le système nerveux éditorial d’un média. Il transforme les signaux dispersés, la mémoire des décisions et le Media DNA en quelques actions préparées et justifiées.

## Lancer le prototype

```bash
npm install
npm run dev
```

Copiez `.env.example` vers `.env.local` pour activer Supabase et les connecteurs. Sans configuration officielle, les intégrations restent masquées.

## Pari produit de la V1

Le produit ne cherche pas à exposer plus de données. Il répond d’abord à une question quotidienne : **que veux-tu accomplir aujourd’hui ?** Puis ses agents préparent le workflow et ne demandent qu’une validation.

Le prototype permet de :

- lancer un workflow depuis une intention ;
- consulter quatre décisions quotidiennes déjà préparées ;
- comprendre une prédiction grâce à Media DNA ;
- explorer un Knowledge Graph interactif ;
- revoir ce qu’Aneto a appris dans sa mémoire longue ;
- découvrir les opportunités détectées par la veille Research ;
- ouvrir une palette de commandes avec `⌘ K` ou `Ctrl K`.

La V3 fait commencer l’expérience par ce qu’Aneto a appris pendant l’absence de l’utilisateur. Le mouvement reste réservé à la circulation des connaissances, à l’arrivée d’un signal et à la respiration du cerveau.

## Fondation applicative

Le Lot 0 migre le prototype vers Next.js App Router. Les modules disposent maintenant de routes partageables, d’états d’erreur et de chargement, d’un healthcheck (`/api/health`), d’un contrat Supabase multi-tenant avec RLS et d’un socle de tests/CI.

## Authentification et données réelles

Le Lot 1 ajoute le premier chemin multi-tenant exploitable :

- connexion Supabase par e-mail et mot de passe ;
- création atomique d’une organisation et de son propriétaire ;
- lectures serveur isolées par organisation ;
- paramètres et déconnexion ;
- décisions, contenus, sources et mémoire chargés depuis Supabase ;
- mode démonstration explicitement signalé lorsque Supabase n’est pas configuré.

Pour activer le mode connecté, appliquez les migrations `supabase/migrations` dans l’ordre, renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, puis créez un utilisateur dans Supabase Auth. L’utilisateur est dirigé vers l’onboarding lors de sa première connexion.

## Synchronisation Ausha

Le connecteur utilise le jeton Public API documenté par Ausha. Un propriétaire d’organisation renseigne le jeton et l’identifiant de l’émission dans Paramètres ; le jeton est vérifié auprès d’Ausha, chiffré en AES-256-GCM puis stocké séparément des contenus.

La synchronisation est idempotente, relançable et planifiée chaque nuit à 02:00 UTC. Elle respecte les réponses `429` et leur délai `Retry-After`, limite les tentatives et conserve les erreurs dans `sync_runs`. Son activation nécessite également `SUPABASE_SERVICE_ROLE_KEY`, `ANETO_CREDENTIAL_ENCRYPTION_KEY` et `CRON_SECRET`.
