# B. Technical architecture

## 1. Décisions techniques (ADR condensés)

| # | Décision | Raison | Alternative écartée |
| --- | --- | --- | --- |
| 1 | **Monorepo pnpm workspaces** | Types et règles métier partagés entre API et mobile sans publication | Polyrepo (duplication des types) |
| 2 | **Fastify** plutôt que NestJS | Surface d'API réduite, démarrage rapide, plugins/hooks suffisants pour une architecture modulaire explicite ; moins de magie décorateur à maintenir | NestJS |
| 3 | **PostgreSQL + Prisma** | Contraintes FK, index composites, migrations versionnées, typage bout-en-bout | TypeORM, Drizzle |
| 4 | **Zod partout** (`packages/validation`) | Une seule définition body/query/params + sortie LLM + formulaires mobiles | class-validator |
| 5 | **Moteur financier isolé** (`packages/finance`) | Aucun calcul financier critique dans l'UI ; testable unitairement, pur, sans I/O | Calculs dans les contrôleurs |
| 6 | **Providers derrière interfaces** | Marché/News/LLM/Notifications/Paiement/Stockage remplaçables sans réécrire l'app | Appels SDK directs |
| 7 | **Redis optionnel en dev** | `RedisCache` si `REDIS_URL`, sinon `MemoryCache` — même interface, dev sans infra | Redis obligatoire |
| 8 | **BullMQ si Redis, sinon scheduler in-process** | Les jobs restent exécutables en local ; même interface `JobQueue` | Cron externe |
| 9 | **Hash mot de passe `scrypt` (node:crypto)** | Aucune dépendance native à compiler, paramètres OWASP configurables | bcrypt/argon2 natifs |
| 10 | **JWT access court + refresh rotatif hashé en base** | Révocation réelle, détection de réutilisation de token | Session serveur pure |
| 11 | **Expo + expo-router** | iOS/Android/web à partir d'une base, routage par fichiers lisible | RN CLI nu |
| 12 | **TanStack Query + cache persistant** | Offline « dernières données connues » avec `asOf` explicite | Redux + fetch manuel |

## 2. Vue d'ensemble

```
┌──────────────────────── apps/mobile (Expo / React Native / TS) ───────────────────────┐
│  expo-router  •  @nova/ui (design system)  •  TanStack Query (+ persistance offline)  │
│  Jamais d'appel LLM direct. Jamais de calcul financier critique.                       │
└───────────────────────────────────────┬───────────────────────────────────────────────┘
                                        │ HTTPS REST + JWT (access 15 min / refresh rotatif)
┌───────────────────────────────────────▼───────────────────────────────────────────────┐
│                         apps/api (Fastify + TypeScript)                                │
│                                                                                        │
│  http/          plugins (auth, rate-limit, errors, request-id, compression, cors)      │
│  modules/       auth users investor-profiles portfolios positions assets market-data    │
│                 news news-analysis personalization daily-briefs learning journal        │
│                 notifications subscriptions audit-logs account                          │
│                 (chaque module : model → service → validation → routes → tests)         │
│  services/      market-data news portfolio personalization ai notifications analytics   │
│                 storage payments  (orchestration + providers)                           │
│  infrastructure database (Prisma) • cache (Redis|Memory) • jobs (BullMQ|in-process)     │
└───────┬──────────────────────┬─────────────────────┬───────────────────┬───────────────┘
        │                      │                     │                   │
   PostgreSQL              Redis (cache          Providers externes   Jobs planifiés
   (source de vérité)      + files de jobs)      (marché, news, LLM)  (06:00 Europe/Paris)
```

## 3. Flux IA imposé

```
Source primaire → Donnée structurée → Moteur métier (déterministe) → IA → Explication
```

Concrètement :

1. `NewsService` ingère, normalise, déduplique, classe.
2. `ScoringService` (pur, testé) calcule `importanceScore`, `confidenceScore`, horizon.
3. `PortfolioService` + `packages/finance` calculent l'exposition réelle de l'utilisateur.
4. `PersonalizationService` croise (2) et (3) → `portfolioRelevanceScore`.
5. `AiService` reçoit **uniquement** un contexte structuré et validé, et renvoie un JSON validé par Zod.
6. En cas d'échec de validation : 1 retry contrôlé, puis **fallback déterministe** rédigé par le moteur
   métier (jamais d'erreur brute à l'utilisateur, jamais de contenu inventé).

Le LLM n'est jamais une source de vérité : il ne reçoit aucun chiffre qu'il devrait inventer, et
toute donnée chiffrée affichée provient de la base, pas du modèle.

## 4. Découpage par responsabilité

| Couche | Responsabilité | Interdits |
| --- | --- | --- |
| `apps/mobile` | Affichage, saisie, états UI, cache offline | Calcul financier, appel LLM, décision d'autorisation |
| `apps/api/http` | Transport, authN/authZ, rate limit, mapping d'erreurs | Règle métier |
| `apps/api/modules/*` | Règle métier par domaine, autorisations | Accès direct à un SDK externe |
| `apps/api/services/*` | Orchestration + adaptation des providers | Accès HTTP entrant |
| `packages/finance` | Mathématiques de portefeuille (pur) | I/O, Prisma, réseau |
| `packages/validation` | Schémas Zod partagés | Logique métier |
| `packages/types` | Types de domaine partagés | Runtime lourd |
| `packages/ui` | Design system RN | Appels réseau |

## 5. Sécurité (résumé — détail dans `docs/07-security.md`)

- L'identité vient **toujours** du token vérifié (`request.user.id`), jamais du body.
- Chaque accès à une ressource utilisateur passe par un garde de propriété (`assertOwnership`).
- Rate limiting configurable par route sensible (login, register, reset, AI chat).
- Secrets uniquement par variables d'environnement ; `.env` ignoré par git ; `.env.example` fourni.
- Audit log sur les actions sensibles (login, reset, suppression de compte, export de données).
- Aucun montant de portefeuille envoyé aux analytics.

## 6. Environnements

| Env | Base | Cache/Jobs | Providers | Déploiement |
| --- | --- | --- | --- | --- |
| development | Postgres local | Memory (ou Redis local) | `demo` | `pnpm dev:api` |
| staging | Postgres managé | Redis managé | réels en clé de test | automatique sur `main` |
| production | Postgres managé (chiffré au repos) | Redis managé | réels | **validation manuelle requise** |
