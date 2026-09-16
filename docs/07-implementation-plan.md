# G. Implementation plan

Ordre imposé par le cahier des charges, avec les critères de sortie de chaque phase.
Une phase n'est close que si : le code compile (`typecheck`), les tests passent, les erreurs et
permissions sont gérées, et la fonctionnalité est utilisable de bout en bout.

| Phase | Contenu | Critère de sortie |
| --- | --- | --- |
| 1 | Scaffold monorepo, TS strict, ESLint, Prettier, Vitest, `.env.example` | `pnpm typecheck && pnpm test` verts |
| 2 | Prisma : schéma, migration initiale, seed démo | `db:migrate` + `db:seed` rejouables |
| 3 | Core API (config, logger, erreurs, cache, rate limit) + Auth complet | Tests d'intégration auth verts |
| 4 | Onboarding (profil investisseur, complétion) | Parcours 8 étapes persisté |
| 5 | Portefeuille : assets, positions, moteur financier | Tests unitaires du moteur + autorisations |
| 6 | Dashboard (agrégation) | `GET /dashboard` complet en une requête |
| 7 | News : pipeline, dédoublonnage, scoring | Scoring déterministe testé |
| 8 | Market data : interfaces + provider démo | Overview + séries de prix |
| 9 | Daily Brief : service, job 06:00, fallback « stale » | Brief régénérable, jamais présenté comme frais à tort |
| 10 | Personalization engine | `portfolioRelevanceScore` testé |
| 11 | AI Coach : `LLMProvider`, garde-fous, validation de sortie | Fallback déterministe si LLM KO |
| 12 | Learning | Leçons + progression + quiz |
| 13 | Journal | CRUD + rappel à 6 mois |
| 14 | Notifications | Préférences + génération par les jobs |
| 15 | Abonnements | Plans configurables, statut serveur, webhook |
| 16 | Durcissement sécurité | Revue OWASP, audit log, en-têtes |
| 17 | Tests | Unitaires, intégration, E2E du parcours complet |
| 18 | Performance | Cache, pagination, index, skeletons |
| 19 | DevOps | CI lint → typecheck → tests → build, déploiement documenté |

## Roadmap post-MVP (architecture déjà prête, non activée)

- **V2** : import CSV (`ImportProvider`), connexions brokers (`BrokerProvider`), alertes
  personnalisées, comparaison à un benchmark, rapports mensuels.
- **V3** : données temps réel selon licences, fonctionnalités premium avancées, recommandations
  personnalisées **après validation réglementaire** (module `advisory` isolé, désactivé par flag).
- **V4** : infrastructure de conseil/gestion selon juridiction et statut réglementaire.

Le module de recommandation, quand il existera, vivra dans un module séparé
(`modules/advisory`), derrière un feature flag, avec ses propres audit logs et sa propre
validation de conformité. Rien dans le MVP ne produit de recommandation personnalisée.
