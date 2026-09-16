# D. API contract

Base URL : `/v1` — toutes les routes ci-dessous sont préfixées.
Documentation interactive générée : `GET /docs` (OpenAPI 3 via `@fastify/swagger`).

## Conventions

- **Auth** : `Authorization: Bearer <accessToken>` (JWT, 15 min). Refresh via cookie/`refreshToken`.
- **Identité** : le serveur lit l'identité depuis le token. Un `userId` envoyé par le client est ignoré.
- **Erreurs** : enveloppe unique.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Requête invalide",
    "requestId": "01J…",
    "details": []
  }
}
```

Codes : `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`CONFLICT` (409), `RATE_LIMITED` (429), `UPSTREAM_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).
Le détail technique d'une 500 n'est jamais renvoyé au client — seulement `requestId`, présent dans les logs.

- **Pagination** : `?limit=20&cursor=<opaque>` → `{ "items": [...], "nextCursor": "…", "hasMore": true }`.
- **Fraîcheur & démo** : toute ressource portant de la donnée de marché ou d'actualité inclut

```json
{
  "meta": {
    "asOf": "2026-09-16T06:02:11.000Z",
    "isDemo": true,
    "sources": [{ "name": "…", "url": "…" }]
  }
}
```

## Auth

| Méthode | Route                   | Corps                                           | Réponse                                                        | Rate limit       |
| ------- | ----------------------- | ----------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| POST    | `/auth/register`        | `{ email, password, firstName, acceptedTerms }` | `{ user, tokens }`                                             | 5 / 15 min / IP  |
| POST    | `/auth/login`           | `{ email, password }`                           | `{ user, tokens }`                                             | 10 / 15 min / IP |
| POST    | `/auth/refresh`         | `{ refreshToken }`                              | `{ tokens }`                                                   | 60 / h           |
| POST    | `/auth/logout`          | `{ refreshToken? }`                             | `204`                                                          | —                |
| POST    | `/auth/forgot-password` | `{ email }`                                     | `202` (réponse constante)                                      | 5 / h / IP       |
| POST    | `/auth/reset-password`  | `{ token, password }`                           | `204`                                                          | 5 / h / IP       |
| GET     | `/auth/me`              | —                                               | `{ user, investorProfile, onboardingCompleted, subscription }` | —                |

## Profile

| Méthode | Route                            | Description                                                                                        |
| ------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET     | `/profile`                       | Profil utilisateur + préférences                                                                   |
| PATCH   | `/profile`                       | `{ firstName?, locale?, theme?, contentDepth? }`                                                   |
| GET     | `/profile/investor`              | Profil investisseur                                                                                |
| PATCH   | `/profile/investor`              | `{ investmentGoal?, investmentHorizon?, experienceLevel?, riskTolerance?, interestedAssetTypes? }` |
| POST    | `/profile/onboarding/complete`   | Clôture l'onboarding (idempotent)                                                                  |
| GET     | `/profile/notifications` / PATCH | Préférences de notification                                                                        |

## Portfolios & positions

| Méthode | Route                       | Description                                                                                          |
| ------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET     | `/portfolios`               | Liste des portefeuilles de l'utilisateur                                                             |
| POST    | `/portfolios`               | `{ name, baseCurrency }`                                                                             |
| GET     | `/portfolios/:id`           | Détail + **analytics calculées serveur** (valeur, allocation, géo, secteurs, concentration, devises) |
| PATCH   | `/portfolios/:id`           | `{ name?, baseCurrency? }`                                                                           |
| DELETE  | `/portfolios/:id`           | `204`                                                                                                |
| GET     | `/portfolios/:id/positions` | Positions + valorisation                                                                             |
| POST    | `/portfolios/:id/positions` | `{ symbol \| assetId, quantity, averagePrice, currency }`                                            |
| PATCH   | `/positions/:id`            | `{ quantity?, averagePrice?, currency? }`                                                            |
| DELETE  | `/positions/:id`            | `204`                                                                                                |
| GET     | `/portfolios/:id/exposure`  | Exposition consolidée (secteurs, zones, thèmes)                                                      |

## Markets

| Méthode | Route                                 | Description                                                             |
| ------- | ------------------------------------- | ----------------------------------------------------------------------- |
| GET     | `/markets/overview`                   | Indices : CAC 40, S&P 500, Nasdaq, Euro Stoxx 50, Or, Pétrole, Bitcoin  |
| GET     | `/markets/radar`                      | Market Radar : thèmes + importance + évolution + exposition utilisateur |
| GET     | `/assets?query=&type=&limit=&cursor=` | Recherche d'actifs                                                      |
| GET     | `/assets/:id`                         | Détail d'un actif (+ position de l'utilisateur si existante)            |
| GET     | `/assets/:id/prices?range=1M`         | Série de prix (`1W`,`1M`,`3M`,`1Y`)                                     |

## News

| Méthode | Route                                              | Description                                                             |
| ------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| GET     | `/news?category=&limit=&cursor=&personalized=true` | Fil d'actualité, trié par pertinence personnalisée                      |
| GET     | `/news/:id`                                        | Détail factuel + sources                                                |
| GET     | `/news/:id/analysis`                               | « Pourquoi cela vous concerne ? » (analyse + exposition + incertitudes) |

## Daily Brief

| Méthode | Route                           | Description                                                                                    |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET     | `/brief/today`                  | Brief du jour ; si indisponible, renvoie le dernier disponible avec `isStale: true` et sa date |
| GET     | `/brief/history?limit=&cursor=` | Historique (limité selon le plan)                                                              |
| GET     | `/brief/:id`                    | Brief détaillé                                                                                 |

## AI

| Méthode | Route                                         | Description                                                   | Rate limit                   |
| ------- | --------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| POST    | `/ai/chat`                                    | `{ message, conversationId?, depth: "simple" \| "detailed" }` | 20 / h (free) — configurable |
| POST    | `/ai/explain-news`                            | `{ newsId, depth }`                                           | 30 / h                       |
| POST    | `/ai/explain-portfolio`                       | `{ portfolioId, question?, depth }`                           | 30 / h                       |
| GET     | `/ai/conversations` / `/ai/conversations/:id` | Historique de conversation                                    |

Réponse IA (toujours cette forme, validée par Zod avant affichage) :

```json
{
  "shortAnswer": "…",
  "whatWeKnow": ["…"],
  "whyItMatters": "…",
  "portfolioRelevance": "…",
  "uncertainties": ["…"],
  "sources": [{ "name": "…", "url": "…", "publishedAt": "…" }],
  "confidence": 0.82,
  "disclaimer": "…",
  "generatedBy": { "provider": "demo", "model": "nova-deterministic-v1", "isFallback": false }
}
```

## Learning

| Méthode | Route                             | Description                                |
| ------- | --------------------------------- | ------------------------------------------ |
| GET     | `/learning?difficulty=&category=` | Leçons adaptées au niveau de l'utilisateur |
| GET     | `/learning/:id`                   | Contenu de la leçon + quiz                 |
| POST    | `/learning/:id/complete`          | `{ quizScore? }`                           |
| GET     | `/learning/progress`              | Progression                                |
| GET     | `/learning/daily`                 | Leçon du jour (liée au thème dominant)     |

## Journal

| Méthode | Route                     | Description                                                                            |
| ------- | ------------------------- | -------------------------------------------------------------------------------------- |
| GET     | `/journal?limit=&cursor=` | Entrées                                                                                |
| POST    | `/journal`                | `{ portfolioId?, assetId?, action, quantity?, price?, reason, horizon?, conviction? }` |
| GET     | `/journal/:id`            | Entrée + rappel « ce que vous pensiez »                                                |
| PATCH   | `/journal/:id` / DELETE   | Modification / suppression                                                             |

## Notifications

| Méthode | Route                        | Description               |
| ------- | ---------------------------- | ------------------------- |
| GET     | `/notifications?unreadOnly=` | Liste                     |
| PATCH   | `/notifications/:id/read`    | Marquer lue               |
| POST    | `/notifications/read-all`    | Tout marquer lu           |
| POST    | `/notifications/devices`     | Enregistrer un token push |

## Subscription & account

| Méthode | Route                     | Description                                                                       |
| ------- | ------------------------- | --------------------------------------------------------------------------------- |
| GET     | `/subscriptions/plans`    | Catalogue de plans (jamais codé en dur dans l'app)                                |
| GET     | `/subscriptions/me`       | Statut d'abonnement — **le backend est la source de vérité**                      |
| POST    | `/subscriptions/checkout` | Crée une session chez le `PaymentProvider`                                        |
| POST    | `/subscriptions/webhook`  | Webhook signé du prestataire (hors auth JWT)                                      |
| GET     | `/account/export`         | Export RGPD (JSON)                                                                |
| DELETE  | `/account`                | `{ password, confirmation: "SUPPRIMER" }` → suppression logique + purge planifiée |

## Système

| Méthode | Route           | Description                      |
| ------- | --------------- | -------------------------------- |
| GET     | `/health`       | Liveness                         |
| GET     | `/health/ready` | Readiness (DB, cache, providers) |
| GET     | `/docs`         | OpenAPI                          |
