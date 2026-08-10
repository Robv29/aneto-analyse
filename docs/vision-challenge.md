# Aneto — challenge produit et cap V1

## L’idée initiale mise sous tension

L’ambition d’un « directeur éditorial IA » connecté à toutes les plateformes est séduisante, mais elle repose sur quatre hypothèses fragiles :

1. Plus d’automatisations produiraient mécaniquement plus de valeur.
2. Tous les profils — podcasteur, agence, média ou grand groupe — auraient le même problème prioritaire.
3. Une architecture multi-agents serait un avantage visible pour l’utilisateur.
4. La donnée disponible serait suffisamment propre et comparable pour permettre immédiatement de bonnes décisions.

Le risque principal est de construire une couche technique spectaculaire qui augmente le volume de contenu sans améliorer sa qualité ni la confiance de l’équipe.

## Le vrai problème

Les équipes éditoriales ne manquent pas d’outils de production ou de tableaux de bord. Elles manquent d’une boucle de décision courte entre ce qu’elles publient, ce qu’elles apprennent et ce qu’elles doivent faire ensuite.

Le problème caché n’est donc pas « comment produire plus ? », mais « comment choisir la prochaine action sans se noyer dans des signaux contradictoires ? ».

## Pari retenu

Aneto devient une couche de décision éditoriale. Chaque jour, le produit formule une recommandation unique, montre les preuves qui la soutiennent, estime son niveau de confiance et prépare une action réversible.

**Job-to-be-done :** quand plusieurs contenus et plateformes produisent des signaux difficiles à comparer, je veux savoir quelle action éditoriale prioriser et pourquoi, afin d’avancer vite sans décider à l’intuition seule.

## Ce que la V1 refuse volontairement

- les 200 automatisations ;
- la publication omnicanale complète ;
- neuf agents présentés comme des fonctionnalités ;
- tous les personas dès le premier jour ;
- la promesse de remplacer un directeur éditorial.

## Utilisateur initial

Une petite équipe éditoriale ou un créateur professionnel publiant un format long et plusieurs déclinaisons chaque semaine. Ce segment a assez de données pour ressentir la douleur, mais pas assez de ressources pour employer un analyste dédié.

## Risque fatal et test le moins cher

Le risque fatal est que l’équipe n’accorde pas assez de confiance à la recommandation pour changer son planning. Le premier test ne demande pas de construire tous les connecteurs : produire manuellement une recommandation hebdomadaire à partir des exports de dix équipes, puis mesurer combien sont acceptées, exécutées et jugées utiles après sept jours.

## Critère de validation

Passer à l’automatisation seulement si au moins 60 % des recommandations sont exécutées et si les utilisateurs demandent spontanément la recommandation suivante. La métrique centrale n’est pas le nombre de contenus générés, mais le **taux de décisions recommandées mises en œuvre**.
