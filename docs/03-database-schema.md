# C. Database schema

Source de vérité : `apps/api/prisma/schema.prisma`. Ce document explique les choix.

## 1. Diagramme relationnel

```
User ─1:1─ InvestorProfile
 │   ─1:1─ NotificationPreference
 │   ─1:1─ Subscription
 │   ─1:n─ Portfolio ─1:n─ Position ─n:1─ Asset
 │   ─1:n─ DailyBrief ─1:n─ DailyBriefItem ─n:1─ News
 │   ─1:n─ JournalEntry (─n:1─ Asset, nullable)
 │   ─1:n─ LearningProgress ─n:1─ LearningLesson
 │   ─1:n─ Notification
 │   ─1:n─ RefreshToken / PasswordResetToken
 │   ─1:n─ AiConversation ─1:n─ AiMessage
 └─  ─1:n─ AuditLog (userId nullable)

News ─1:1─ NewsAnalysis
 │   ─n:n─ Asset   (NewsAsset, avec relevance)
 └─  ─n:n─ Sector  (NewsSector, avec relevance)

Asset ─1:n─ MarketPrice
Asset ─n:1─ Sector (nullable)
MarketIndex ─1:n─ MarketIndexQuote   (CAC 40, S&P 500, Or, Pétrole, Bitcoin…)
MarketTheme ─1:n─ MarketThemeReading (Market Radar : taux, inflation, énergie…)
```

## 2. Conventions

- **Clés primaires** : UUID v4 (`@default(uuid())`) — pas d'ID séquentiel exposé.
- **Montants** : `Decimal(24, 8)` pour quantités et prix (jamais `Float` sur de la donnée financière).
- **Devise** : ISO 4217 stockée à côté de chaque montant ; `baseCurrency` sur le portefeuille.
- **Soft delete** : `deletedAt` sur `User` (suppression logique puis purge, cf. rétention RGPD).
- **Horodatage** : `createdAt` / `updatedAt` systématiques, en UTC.
- **Donnée de démonstration** : `isDemo Boolean @default(false)` sur `Asset`, `News`, `MarketPrice`,
  `MarketIndexQuote`, `DailyBrief`. Remonté jusqu'à l'UI — règle absolue n° 58.
- **Cascade** : toutes les données rattachées à un utilisateur sont `onDelete: Cascade`
  (suppression de compte réellement effective).

## 3. Index

| Table | Index | Raison |
| --- | --- | --- |
| `users` | `email` unique | login |
| `assets` | `symbol`, `isin` unique nullable, `(assetType)`, `(sectorId)` | recherche & agrégats |
| `market_prices` | `(assetId, timestamp)` unique, `(timestamp)` | séries temporelles, dernier prix |
| `market_index_quotes` | `(indexId, timestamp)` unique, `(timestamp)` | overview marchés |
| `news` | `(publishedAt)`, `(category, publishedAt)`, `externalId` unique nullable, `contentHash` unique | tri, dédoublonnage |
| `news_assets` | `(newsId, assetId)` unique, `(assetId)` | jointure exposition |
| `news_analysis` | `newsId` unique, `(importanceScore)` | sélection du top 5 |
| `daily_briefs` | `(userId, date)` unique | 1 brief / jour / utilisateur |
| `positions` | `(portfolioId, assetId)` unique | pas de doublon de ligne |
| `journal_entries` | `(userId, createdAt)` | pagination |
| `notifications` | `(userId, createdAt)`, `(userId, readAt)` | badge non-lus |
| `audit_logs` | `(userId, createdAt)`, `(action, createdAt)` | investigation |
| `refresh_tokens` | `tokenHash` unique, `(userId)` | rotation & révocation |

## 4. Règles d'intégrité métier

- `positions.quantity > 0`, `positions.averagePrice >= 0` (validés en Zod + contrainte applicative).
- `news.contentHash` = SHA-256(titre normalisé + source) → déduplication déterministe.
- `news_analysis.importanceScore|confidenceScore` ∈ [0, 100] (entiers).
- `daily_briefs` porte `generatedAt` **et** `dataAsOf` : l'UI n'affiche jamais un contenu daté
  comme s'il était actuel.
- `subscriptions.status` est écrit **uniquement** par le backend (webhook provider), jamais par le client.

## 5. Rétention / RGPD

| Donnée | Rétention |
| --- | --- |
| Compte supprimé | anonymisation immédiate (`deletedAt`, email haché) puis purge à J+30 |
| `audit_logs` | 12 mois |
| `market_prices` | 5 ans |
| `news` | 24 mois |
| `refresh_tokens` expirés | purge quotidienne |
| Export utilisateur | JSON complet à la demande (`GET /account/export`) |
