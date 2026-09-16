# Fournisseurs externes

NOVA fonctionne intégralement sans aucune clé d'API, en **mode démonstration**. Ce document
explique comment brancher un fournisseur réel, fournisseur par fournisseur.

Règle absolue : tant qu'un fournisseur réel n'est pas configuré, toute donnée affichée porte la
mention `DEMO DATA`, dans l'API (`meta.isDemo`) comme dans l'interface.

## 1. Données de marché — `MarketDataProvider`

Interface : `apps/api/src/services/market-data/providers/market-data-provider.ts`

| Implémentation           | Sélection                            | Comportement                                                                       |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `DemoMarketDataProvider` | `MARKET_DATA_PROVIDER=demo` (défaut) | Séries déterministes dérivées d'un hash du symbole et du jour. Aucun appel réseau. |
| `HttpMarketDataProvider` | `MARKET_DATA_PROVIDER=http`          | Appelle `MARKET_DATA_API_URL`, valide chaque réponse par Zod.                      |

Contrat HTTP attendu (adaptable par un proxy de quelques lignes devant n'importe quel fournisseur) :

```http
GET /quotes?symbols=MC.PA,AAPL
→ [{ "symbol": "MC.PA", "price": 645.2, "previousClose": 641.0, "currency": "EUR", "timestamp": "2026-09-16T17:30:00Z" }]

GET /indices?keys=cac40,sp500
→ [{ "key": "cac40", "value": 7650.2, "previousClose": 7620.0, "currency": "EUR", "timestamp": "…" }]

GET /candles?symbol=MC.PA&range=1M
→ [{ "timestamp": "…", "open": 1, "high": 2, "low": 0.5, "close": 1.5, "volume": 100000 }]

GET /fx?base=EUR&currencies=USD,GBP
→ { "USD": 0.92, "GBP": 1.17 }          // valeur d'une unité de la devise en EUR

GET /search?q=lvmh
→ [{ "symbol": "MC.PA", "name": "LVMH", "assetType": "stock", "currency": "EUR", "exchange": "Euronext Paris", "country": "FR", "isin": "FR0000121014" }]

GET /health → 200
```

Pour brancher un fournisseur au protocole différent, écrire une classe implémentant
`MarketDataProvider` et l'ajouter au `switch` de `providers/index.ts`. Aucune autre partie du
code n'est à modifier.

**Licences** : les données de marché en temps réel sont soumises à licence. Le MVP utilise des
cours de clôture et affiche systématiquement leur date.

## 2. Actualités — `NewsProvider`

Interface : `apps/api/src/services/news/providers/news-provider.ts`

```http
GET /news?since=2026-09-15T00:00:00Z&limit=50
→ { "items": [{
      "id": "…",              // identifiant fournisseur, pour une ingestion idempotente
      "title": "…",
      "summary": "…",
      "body": "…",            // optionnel
      "source": "Reuters",
      "url": "https://…",
      "publishedAt": "…",
      "language": "fr",
      "category": "central_banks",   // optionnel : simple indice, NOVA reclasse
      "symbols": ["MC.PA"]           // optionnel
    }] }
```

La catégorie fournie n'est qu'un indice : la classification, l'extraction de thèmes, le
rattachement aux actifs et le scoring sont réalisés par NOVA (`ScoringService`), afin que le
classement reste explicable et indépendant du fournisseur.

**Droits** : ne stocker que titre, résumé, source, URL et date. NOVA ne republie pas le contenu
intégral d'un article.

## 3. Modèle de langage — `LLMProvider`

Interface : `apps/api/src/services/ai/providers/llm-provider.ts`

| Implémentation                | Sélection                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DemoLlmProvider`             | `LLM_PROVIDER=demo` (défaut) — compose une réponse déterministe à partir du contexte, sans appeler de modèle |
| `AnthropicLlmProvider`        | `LLM_PROVIDER=anthropic` + `LLM_API_KEY`                                                                     |
| `OpenAiCompatibleLlmProvider` | `LLM_PROVIDER=openai-compatible` + `LLM_API_URL` + `LLM_API_KEY`                                             |

Quel que soit le fournisseur, le pipeline reste :

```
contexte structuré et minimisé → modèle → JSON → validation Zod → détection de formulations
interdites → vérification des sources → affichage
                       ↘ échec → 1 retry → réponse déterministe
```

Ce qui est envoyé au modèle (`AiContext`) : le profil investisseur, des **pourcentages**
d'exposition, une **tranche** de valeur de portefeuille, et l'actualité concernée. Jamais
l'identité, l'e-mail, l'identifiant de compte ni le montant exact.

## 4. Notifications — `NotificationProvider`

`demo` (par défaut : la notification est enregistrée et visible dans l'app, rien n'est poussé)
ou `expo` (`NOTIFICATION_PROVIDER=expo`, `EXPO_ACCESS_TOKEN`). Les tokens signalés invalides par
le transport sont supprimés automatiquement.

## 5. E-mail transactionnel — `MailProvider`

`log` en développement : le message est écrit dans les logs, rien n'est envoyé — et la
configuration **refuse de démarrer en production** avec ce fournisseur, pour qu'une
réinitialisation de mot de passe ne puisse jamais échouer silencieusement.

`http` : POST `{ from, to, subject, text, html }` vers `MAIL_API_URL`.

## 6. Paiement — `PaymentProvider`

`none` par défaut : l'abonnement premium est présenté comme « bientôt disponible » et le
checkout renvoie une erreur explicite — plutôt qu'un bouton qui ne fonctionne pas.

`stripe` : implémentation directe de l'API REST, avec **vérification de la signature du
webhook** en temps constant et rejet des rejeux de plus de cinq minutes. Le statut d'abonnement
n'est écrit qu'à partir d'un événement vérifié.

## 7. Stockage — `StorageProvider`

`local` par défaut (exports RGPD). L'interface est prête pour un stockage S3-compatible ;
l'adaptateur n'est pas fourni et la sélection `s3` journalise un avertissement explicite plutôt
que de prétendre fonctionner.

## 8. Analytics

`none` par défaut. En mode `http`, seuls le nom de l'événement, une référence pseudonyme et une
liste blanche de propriétés non financières sont transmis. La liste est appliquée dans le code
(`AnalyticsService.sanitizeProperties`), pas laissée à la discipline des appelants.
