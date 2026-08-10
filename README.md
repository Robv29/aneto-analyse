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
