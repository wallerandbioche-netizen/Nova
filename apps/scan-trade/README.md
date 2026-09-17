# Scan Trade

> Scanne ton chart. Comprends le setup. Prépare ton plan.

Scan Trade transforme une capture d'écran de graphique en analyse structurée :
tendance, structure de marché, niveaux clés, scénario potentiel avec zone
d'entrée, stop loss, take profits et ratio risque/rendement — ou un refus
motivé quand rien ne se justifie.

**Ce que Scan Trade n'est pas** : un conseiller en investissement, un robot de
trading, une connexion à un courtier. Aucun ordre n'est transmis, aucune
performance n'est promise, aucun taux de réussite n'est affiché.

---

## Sommaire

- [Principes non négociables](#principes-non-négociables)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données](#base-de-données)
- [Stockage des captures](#stockage-des-captures)
- [Fournisseur IA](#fournisseur-ia)
- [Configuration Stripe](#configuration-stripe)
- [Développement local](#développement-local)
- [Tests](#tests)
- [Déploiement en production](#déploiement-en-production)
- [Sécurité](#sécurité)
- [API](#api)
- [Décisions d'architecture](#décisions-darchitecture)
- [Évolutions prévues](#évolutions-prévues)

---

## Principes non négociables

Ces règles sont implémentées, testées, et ne sont pas des intentions.

| Principe                     | Où il vit                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Rien n'est inventé**       | Le prompt interdit d'extrapoler un prix, un timeframe ou un indicateur absent ; l'UI affiche « Non identifié » |
| **Le refus est une réponse** | `NO_TRADE` et `INSUFFICIENT_DATA` sont des issues normales ; leurs niveaux sont effacés à la validation        |
| **Aucun résultat douteux**   | `validateAnalysisResponse` rejette un plan incohérent plutôt que de l'afficher avec une réserve                |
| **Le R:R est recalculé**     | Le ratio annoncé par le modèle n'est jamais affiché tel quel : il est recalculé depuis les niveaux             |
| **Isolation stricte**        | Aucune requête de lecture n'existe sans filtre `userId` ; testé explicitement                                  |
| **Pas de simulation muette** | Sans clé IA, l'endpoint échoue avec une erreur de configuration explicite — jamais une fausse analyse          |

---

## Architecture

```
Navigateur
    │
    ├── Pages publiques (SSR)          landing, tarifs, mentions légales
    ├── Pages privées (SSR + garde)    dashboard, analyses, historique, compte
    └── Route handlers (Node runtime)  /api/*
            │
            ├── server/session.ts      identité du demandeur (Auth.js, JWT)
            ├── server/usage.ts        abonnement + quotas (extensible)
            ├── features/*/service.ts  logique métier
            │        │
            │        ├── AnalysisRepository  → PostgreSQL (Prisma)
            │        ├── StorageDriver       → bucket privé S3 / disque local
            │        └── AIAnalysisService   → fournisseur vision + validation
            │
            └── Stripe (checkout, portail, webhook signé)
```

**Stack** : Next.js 15 (App Router) · React 19 · TypeScript strict ·
Tailwind CSS 3 · Prisma 6 · PostgreSQL · Auth.js v5 · Stripe · Vitest.

Chaque dépendance externe est derrière une interface (`StorageDriver`,
`AIAnalysisProvider`, `RateLimitStore`, `Mailer`, `AnalysisRepository`).
Changer de fournisseur revient à écrire une implémentation et à la brancher
dans `src/server/services.ts`.

---

## Structure du projet

```text
apps/scan-trade/
  prisma/
    schema.prisma                  modèle de données
    migrations/                    migration initiale versionnée
  src/
    app/
      (marketing)/                 landing, tarifs, conditions, confidentialité, contact
      (auth)/                      connexion, inscription, mots de passe
      (app)/                       dashboard, analyses, historique, abonnement, paramètres, compte
      onboarding/                  parcours en trois étapes
      api/                         route handlers REST
      layout.tsx  globals.css  not-found.tsx  error.tsx  robots.ts  sitemap.ts
    components/
      ui/                          Button, Input, Select, Card, Badge, Modal, Toast, Dropdown…
      layout/                      Navbar, Sidebar, Footer, Disclaimer
      analysis/                    TradePlanCard, KeyLevelsCard, ChartAnalysisCard, UploadZone…
      billing/  brand/  marketing/
    features/
      auth/                        inscription, réinitialisation, suppression de compte
      analysis/                    service, repository, écrans de scan
      billing/                     abonnement, événements Stripe
      settings/                    formulaires du compte
    lib/
      ai/                          prompt, schéma, validation, fournisseur Anthropic
      storage/                     drivers S3 et local, validation d'upload
      stripe/  auth/  db/  mail/  rate-limit/
      env.ts  errors.ts  logger.ts
    server/                        session, usage, composition, helpers HTTP
    types/  utils/
```

---

## Installation

Prérequis : **Node ≥ 20.11**, **pnpm 10**, **PostgreSQL ≥ 14**.

```bash
# Depuis la racine du monorepo
pnpm install --filter @scan-trade/web

cd apps/scan-trade
cp .env.example .env
```

Renseignez au minimum `DATABASE_URL` et `AUTH_SECRET`, puis :

```bash
pnpm db:migrate       # applique la migration initiale
pnpm dev              # http://localhost:3000
```

L'application démarre sans clé Stripe ni clé IA : la landing page, l'inscription
et la connexion fonctionnent, et chaque fonctionnalité non configurée affiche un
message explicite plutôt qu'un écran cassé. Les lacunes sont listées dans les
logs au démarrage (`boot.configuration_incomplete`).

---

## Variables d'environnement

Toutes les variables sont **côté serveur uniquement**. Le projet ne contient
aucun `NEXT_PUBLIC_*` secret. Le fichier `.env.example` liste les noms ; aucune
valeur réelle n'est versionnée.

### Obligatoires

| Variable       | Rôle                                                                |
| -------------- | ------------------------------------------------------------------- |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL                                      |
| `AUTH_SECRET`  | Signe les sessions. `openssl rand -base64 48`                       |
| `APP_URL`      | Origine publique — redirections Stripe et liens de réinitialisation |

### Analyse IA

| Variable               | Défaut                      | Rôle                                      |
| ---------------------- | --------------------------- | ----------------------------------------- |
| `AI_PROVIDER`          | `anthropic`                 | Seul fournisseur implémenté               |
| `AI_API_KEY`           | —                           | **Requis pour lancer un scan**            |
| `AI_MODEL`             | `claude-opus-5`             | Modèle vision utilisé                     |
| `AI_BASE_URL`          | `https://api.anthropic.com` | Utile pour un proxy d'entreprise          |
| `AI_TIMEOUT_MS`        | `90000`                     | Au-delà, l'analyse est marquée en timeout |
| `AI_MAX_OUTPUT_TOKENS` | `4096`                      | Plafond de la réponse structurée          |

### Stockage

| Variable                    | Défaut     | Rôle                                                   |
| --------------------------- | ---------- | ------------------------------------------------------ |
| `STORAGE_DRIVER`            | `local`    | `local` (développement) ou `s3` (production)           |
| `STORAGE_LOCAL_DIR`         | `.storage` | Répertoire du driver local, hors de `public/`          |
| `STORAGE_BUCKET`            | —          | Bucket **privé**                                       |
| `STORAGE_REGION`            | `auto`     | Région S3                                              |
| `STORAGE_ENDPOINT`          | —          | Requis pour R2, MinIO, Supabase                        |
| `STORAGE_ACCESS_KEY_ID`     | —          | Identifiant S3                                         |
| `STORAGE_SECRET_ACCESS_KEY` | —          | Clé secrète S3                                         |
| `STORAGE_FORCE_PATH_STYLE`  | `true`     | Requis par R2, MinIO et Supabase                       |
| `STORAGE_SIGNED_URL_TTL`    | `300`      | Durée de vie des URLs signées, en secondes (30 à 3600) |

### Stripe

| Variable                | Rôle                                       |
| ----------------------- | ------------------------------------------ |
| `STRIPE_SECRET_KEY`     | Clé secrète du compte                      |
| `STRIPE_PRICE_ID`       | Identifiant du prix récurrent 19,90 €/mois |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature de l'endpoint webhook  |

### E-mail, limites et options

| Variable                 | Défaut     | Rôle                                                               |
| ------------------------ | ---------- | ------------------------------------------------------------------ |
| `RESEND_API_KEY`         | —          | Sans elle, les liens de réinitialisation sont écrits dans les logs |
| `MAIL_FROM`              | —          | Expéditeur des e-mails transactionnels                             |
| `MAX_UPLOAD_BYTES`       | `8388608`  | Taille maximale d'une capture (8 Mo)                               |
| `ANALYSIS_MONTHLY_LIMIT` | `0`        | Quota mensuel par utilisateur. `0` = illimité (plan du MVP)        |
| `RATE_LIMIT_DRIVER`      | `database` | `database` (serverless) ou `memory` (processus unique)             |
| `GOOGLE_CLIENT_ID`       | —          | Active la connexion Google si les deux sont renseignées            |
| `GOOGLE_CLIENT_SECRET`   | —          |                                                                    |
| `LOG_LEVEL`              | `info`     | `debug`, `info`, `warn`, `error`                                   |

---

## Base de données

PostgreSQL via Prisma. Le schéma couvre : `users`, `accounts`, `sessions`,
`verification_tokens`, `password_reset_tokens`, `subscriptions`,
`processed_stripe_events`, `analyses`, `analysis_levels`, `analysis_reasoning`,
`technical_observations`, `usage_events` et `rate_limit_counters`.

```bash
pnpm db:migrate          # développement : crée et applique une migration
pnpm db:migrate:deploy   # production : applique les migrations existantes
pnpm db:reset            # réinitialise complètement (destructif)
pnpm db:studio           # explorateur Prisma
```

**Index** — `analyses(userId, createdAt DESC)` et `analyses(userId, status)`
pour l'historique paginé ; contraintes uniques sur `stripeCustomerId` et
`stripeSubscriptionId` pour que la réconciliation d'un webhook soit une seule
requête ; `password_reset_tokens(tokenHash)` unique, `usage_events(userId, kind,
createdAt)` pour les compteurs.

**Suppressions en cascade** — effacer un utilisateur efface ses analyses, leurs
niveaux, leur raisonnement, ses sessions et ses jetons. Les fichiers du bucket
sont supprimés _avant_ les lignes, car après, plus rien ne dit quels objets lui
appartenaient.

---

## Stockage des captures

Les captures sont des données personnelles. Elles sont écrites dans un bucket
**privé**, sous un nom généré côté serveur
(`analyses/<userId>/<uuid>.<ext>`) — le nom de fichier envoyé par le navigateur
n'est jamais réutilisé.

Une capture ne parvient au navigateur que par `GET /api/analyses/:id/image`,
qui vérifie la propriété en base à chaque requête, puis redirige vers une URL
signée de courte durée (driver `s3`) ou relaie les octets (driver `local`).

Le driver `local` écrit sur le disque de l'instance : il convient au
développement, pas à la production. Un démarrage en production avec
`STORAGE_DRIVER=local` est signalé en erreur dans les logs.

### Configurer un bucket privé

<details>
<summary>Cloudflare R2</summary>

```env
STORAGE_DRIVER=s3
STORAGE_BUCKET=scan-trade
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_FORCE_PATH_STYLE=true
```

N'activez **pas** l'accès public au bucket.

</details>

<details>
<summary>Supabase Storage (endpoint S3)</summary>

```env
STORAGE_DRIVER=s3
STORAGE_BUCKET=charts
STORAGE_REGION=<region>
STORAGE_ENDPOINT=https://<project>.supabase.co/storage/v1/s3
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_FORCE_PATH_STYLE=true
```

Créez le bucket en mode privé.

</details>

<details>
<summary>AWS S3</summary>

```env
STORAGE_DRIVER=s3
STORAGE_BUCKET=scan-trade-charts
STORAGE_REGION=eu-west-3
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_FORCE_PATH_STYLE=false
```

Laissez « Block all public access » activé.

</details>

---

## Fournisseur IA

`AIAnalysisService` est le seul point d'entrée pour analyser un graphique. Il
possède le timeout, la journalisation et — surtout — la validation, de sorte
qu'aucun appelant ne peut enregistrer une réponse non vérifiée.

**Où mettre la clé** : `AI_API_KEY` dans `.env` (local) ou dans les variables
d'environnement de l'hébergeur (production). Sans elle,
`POST /api/analyses/:id/scan` renvoie une erreur de configuration explicite et
l'analyse est marquée `FAILED` avec le code `configuration_error`. **Aucune
analyse n'est simulée.**

### Le contrat de réponse

Le modèle répond par un appel d'outil dont le schéma est décrit dans
`src/lib/ai/schema.ts`. La réponse passe ensuite deux portes :

1. **Forme** — validation Zod du schéma complet.
2. **Cohérence** — `src/lib/ai/validate.ts` :
   - direction LONG ou SHORT obligatoire pour un scénario ;
   - `entryMin ≤ entryMax`, prix finis et strictement positifs ;
   - stop loss sous la zone d'entrée en LONG, au-dessus en SHORT ;
   - take profits dans le sens du trade, TP2 au-delà de TP1 ;
   - tout niveau hors d'une bande de ×5 autour de l'entrée est refusé (erreur de
     décimale) ;
   - **le ratio risque/rendement est recalculé** depuis les niveaux ; un écart
     important avec la valeur annoncée ajoute un avertissement visible ;
   - un `no_trade` ou `insufficient_data` voit tous ses prix effacés.

Une réponse qui échoue à la seconde porte n'est pas affichée : l'analyse passe
en `FAILED` et l'utilisateur lit « Analyse indisponible — les données générées
sont incohérentes », avec un bouton pour relancer.

### Brancher un autre fournisseur

1. Implémentez `AIAnalysisProvider` dans `src/lib/ai/providers/`.
2. Sélectionnez-le dans `getAIConfig()` et `getAIAnalysisService()`.

Rien d'autre ne change : la validation, le stockage et l'UI sont indépendants du
fournisseur.

---

## Configuration Stripe

### 1. Créer le produit et le prix

Dans le dashboard Stripe : **Produits → Ajouter un produit**.

- Nom : `Scan Trade Pro`
- Tarification : **récurrente**, `19,90 €`, mensuelle
- Copiez l'identifiant du prix (`price_…`) dans `STRIPE_PRICE_ID`

### 2. Activer le portail client

**Paramètres → Facturation → Portail client** : autorisez l'annulation de
l'abonnement et la mise à jour du moyen de paiement.

### 3. Configurer le webhook

En local :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copiez le whsec_… affiché dans STRIPE_WEBHOOK_SECRET
```

En production : **Développeurs → Webhooks → Ajouter un endpoint**,
URL `https://votre-domaine/api/stripe/webhook`, avec les événements :

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
```

### Ce que garantit l'implémentation

- La signature est vérifiée sur **les octets exacts** reçus ; une signature
  invalide renvoie 400 (Stripe cesse de réessayer) et n'écrit rien.
- Chaque `event.id` traité est enregistré : un renvoi de Stripe ne rejoue pas
  l'effet.
- Le webhook est la source de vérité. La page de confirmation relit la session
  côté serveur, mais ne fait jamais confiance au retour navigateur.
- Aucune donnée bancaire ne transite par Scan Trade ni n'est stockée.

---

## Développement local

```bash
pnpm dev              # serveur de développement
pnpm typecheck        # TypeScript strict
pnpm test             # suite de tests
pnpm build            # build de production
```

Depuis la racine du monorepo :

```bash
pnpm dev:scan-trade
pnpm build:scan-trade
pnpm lint             # ESLint sur tout l'espace de travail
pnpm format           # Prettier
```

Une base PostgreSQL locale rapide :

```bash
docker run --name scan-trade-db -e POSTGRES_USER=scan_trade \
  -e POSTGRES_PASSWORD=scan_trade -e POSTGRES_DB=scan_trade \
  -p 5432:5432 -d postgres:16
```

**Réinitialisation de mot de passe en local** : sans `RESEND_API_KEY`, le lien
est écrit dans les logs du serveur (`mail.console_driver`). Copiez-le depuis le
terminal.

---

## Tests

```bash
pnpm test           # 133 tests
pnpm test:watch
```

| Fichier                                  | Ce qui est couvert                                                   |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `features/analysis/service.test.ts`      | **Isolation entre utilisateurs**, création, suppression, scan, retry |
| `lib/ai/validate.test.ts`                | Plans cohérents, plans rejetés, NO TRADE, données insuffisantes      |
| `lib/storage/upload.test.ts`             | Signatures de fichiers, taille, extension, génération de clé         |
| `features/billing/stripe-events.test.ts` | Webhook : idempotence, attribution, statuts, formats d'API           |
| `features/billing/subscription.test.ts`  | Droits d'accès, fenêtre de grâce, états affichés                     |
| `lib/auth/auth.test.ts`                  | Politique de mot de passe, hachage, jetons de réinitialisation       |
| `lib/rate-limit/rate-limit.test.ts`      | Fenêtres, cloisonnement, dégradation ouverte                         |
| `server/http.test.ts`                    | Aucune stack trace, aucun nom de variable d'environnement exposé     |
| `lib/logger.test.ts`                     | Caviardage des secrets, conservation des métriques                   |
| `lib/ai/anthropic.test.ts`               | Récupération d'un JSON renvoyé en prose                              |

Le test central : **un utilisateur A ne peut ni lire, ni lister, ni modifier, ni
supprimer, ni scanner une analyse de B**, et une identifiant forgé renvoie
exactement la même réponse qu'un identifiant inexistant.

---

## Déploiement en production

### Vercel (recommandé)

1. **Base de données** — Neon, Supabase ou RDS. Récupérez `DATABASE_URL`.
2. **Projet Vercel** — importez le dépôt, puis :
   - Root Directory : `apps/scan-trade`
   - Build Command : `pnpm build`
   - Install Command : `pnpm install --frozen-lockfile`
3. **Variables d'environnement** — renseignez celles listées plus haut. `APP_URL`
   doit être l'URL finale du déploiement.
4. **Migrations** — depuis votre poste, avec le `DATABASE_URL` de production :

   ```bash
   pnpm db:migrate:deploy
   ```

5. **Webhook Stripe** — créez l'endpoint sur `https://<domaine>/api/stripe/webhook`
   et reportez le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
6. **Vérifiez le démarrage** — les logs doivent contenir `boot.ready` sans
   `boot.configuration_incomplete`.

`maxDuration` est fixé à 120 s sur la route de scan ; sur le plan Hobby de
Vercel la limite effective est plus basse, ce qui peut tronquer une analyse
longue. Le plan Pro est conseillé.

### Autre hébergeur

L'application est un serveur Next.js standard :

```bash
pnpm build
pnpm start          # écoute sur $PORT
```

Prérequis : runtime Node (les routes utilisent `node:crypto`, Prisma et le SDK
S3 — aucune n'est compatible edge), PostgreSQL accessible, et les variables
d'environnement.

### Liste de contrôle avant mise en ligne

- [ ] `AUTH_SECRET` généré aléatoirement, propre à cet environnement
- [ ] `STORAGE_DRIVER=s3` et bucket **privé**
- [ ] Webhook Stripe créé, `STRIPE_WEBHOOK_SECRET` renseigné
- [ ] `RESEND_API_KEY` et `MAIL_FROM` renseignés, sinon aucun e-mail ne part
- [ ] `APP_URL` = domaine réel (HTTPS)
- [ ] Migrations appliquées
- [ ] Adresses de contact réelles dans `src/app/(marketing)/contact/page.tsx`
- [ ] Mentions légales relues par un juriste pour votre juridiction

---

## Sécurité

**Autorisation** — toute lecture passe par un `userId` issu de la session
serveur. Le repository n'expose aucune recherche par identifiant seul : la
signature est toujours `(id, userId)`. La garde du layout est une commodité, pas
la frontière de sécurité ; chaque route handler revérifie.

**Upload** — extension, type MIME déclaré, taille, puis **signature binaire**.
C'est elle qui décide : un script renommé `chart.png` est refusé. Le nom du
fichier stocké est un UUID généré par le serveur.

**Mots de passe** — bcrypt, coût 12. Les jetons de réinitialisation ne sont
stockés que sous forme de hachage SHA-256, expirent en 30 minutes, ne servent
qu'une fois, et leur usage révoque toutes les sessions.

**Énumération** — « mot de passe oublié » répond identiquement que l'adresse
existe ou non. Une analyse appartenant à autrui renvoie un 404 identique à celui
d'une analyse inexistante.

**Limitation de débit** — connexion (par compte, pour résister à la rotation
d'IP), inscription, réinitialisation, upload, scan, facturation, suppression de
compte. Compteurs en base pour tenir sur plusieurs instances.

**En-têtes** — `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, et `Cache-Control: no-store` sur toute
l'API.

**Journalisation** — JSON structuré. Les clés sensibles (mot de passe, secret,
jeton, autorisation, cookie, signature, carte, IBAN) sont caviardées avant
sérialisation. Les compteurs de tokens, eux, sont conservés : ce sont des
métriques.

**Confidentialité** — supprimer une analyse supprime sa capture ; supprimer un
compte supprime tout et résilie l'abonnement. Les captures ne servent pas à
entraîner un modèle.

---

## API

Toutes les routes privées vérifient l'authentification. Les erreurs suivent la
forme `{ "error": { "code", "message", "details"? } }`.

| Méthode  | Route                         | Rôle                                      |
| -------- | ----------------------------- | ----------------------------------------- |
| `POST`   | `/api/auth/register`          | Créer un compte                           |
| `POST`   | `/api/auth/password/forgot`   | Demander un lien de réinitialisation      |
| `POST`   | `/api/auth/password/reset`    | Définir un nouveau mot de passe           |
| `*`      | `/api/auth/[...nextauth]`     | Auth.js (connexion, déconnexion, OAuth)   |
| `POST`   | `/api/analyses`               | Envoyer une capture et ouvrir une analyse |
| `GET`    | `/api/analyses`               | Lister ses analyses (paginé, filtrable)   |
| `GET`    | `/api/analyses/:id`           | Obtenir une analyse                       |
| `DELETE` | `/api/analyses/:id`           | Supprimer une analyse et sa capture       |
| `POST`   | `/api/analyses/:id/scan`      | Lancer l'analyse IA                       |
| `GET`    | `/api/analyses/:id/image`     | Servir la capture (propriété vérifiée)    |
| `POST`   | `/api/stripe/create-checkout` | Ouvrir une session Stripe Checkout        |
| `POST`   | `/api/stripe/create-portal`   | Ouvrir le portail client Stripe           |
| `POST`   | `/api/stripe/webhook`         | Recevoir les événements Stripe (signé)    |
| `POST`   | `/api/onboarding`             | Enregistrer les réponses d'onboarding     |
| `PATCH`  | `/api/account/profile`        | Modifier nom et préférences               |
| `POST`   | `/api/account/password`       | Changer de mot de passe                   |
| `POST`   | `/api/account/delete`         | Supprimer définitivement le compte        |

### Codes d'erreur

`unauthenticated` · `forbidden` · `not_found` · `validation_error` ·
`conflict` · `rate_limited` · `subscription_required` · `quota_exceeded` ·
`upload_invalid` · `upload_too_large` · `ai_unavailable` · `ai_timeout` ·
`ai_invalid_response` · `analysis_in_progress` · `storage_error` ·
`billing_error` · `configuration_error` · `internal_error`

---

## Décisions d'architecture

**Analyse en deux appels plutôt qu'un** — `POST /api/analyses` stocke la capture
et crée la ligne ; `POST /api/analyses/:id/scan` appelle le modèle. Un scan qui
échoue, ou un onglet fermé pendant l'analyse, laisse malgré tout une analyse
lisible dans l'historique, relançable sans réenvoyer l'image.

**`imageKey` plutôt qu'`imageUrl`** — le cahier des charges mentionnait une URL,
mais une URL d'image privée est signée et temporaire : la stocker reviendrait à
persister une valeur périmée. La base garde la clé de l'objet ; l'URL est
produite à la demande.

**Niveaux sur une échelle dédiée, pas en surimpression du chart** — le modèle
renvoie des prix, pas des coordonnées en pixels. Dessiner sur la capture
supposerait de deviner où tracer. Les niveaux sont donc tracés sur leur propre
échelle de prix, à côté de la liste, et l'image d'origine reste intacte.

**`Float` plutôt que `Decimal`** — les niveaux sont indicatifs et lus sur un
graphique ; la double précision les représente exactement à l'échelle utile, et
`Decimal` imposerait des conversions à chaque frontière JSON sans gain réel.

**Rate limiting en base** — un compteur en mémoire ne protège rien sur une
plateforme serverless, où chaque instance repart de zéro.

**Limitation de la connexion par compte** — limiter par IP laisse passer une
attaque distribuée sur un compte précis ; la clé est donc l'adresse e-mail
visée.

**Auth.js en stratégie JWT** — les identifiants l'exigent, et cela évite une
requête en base à chaque lecture de session. L'adaptateur Prisma reste branché
pour que Google, s'il est activé, persiste correctement ses comptes.

---

## Évolutions prévues

L'architecture les anticipe sans les implémenter :

- **Quotas et crédits** — `usage_events` enregistre déjà chaque scan ;
  `ANALYSIS_MONTHLY_LIMIT` active un plafond sans migration.
- **Plans supplémentaires** — `subscriptions.stripePriceId` distingue déjà les
  prix ; il reste à mapper un prix vers un ensemble de droits.
- **Multi-timeframes / captures multiples** — `analyses` est la racine ; une
  table d'images rattachées suffirait.
- **Journal de trading, statistiques, alertes, watchlist** — modules additionnels
  rattachés à `userId`.
- **Application mobile** — les routes REST sont déjà le seul point d'entrée de la
  logique métier.

---

## Avertissement

Scan Trade fournit des informations et analyses à caractère éducatif et
informatif. Les scénarios, niveaux et analyses générés ne constituent pas des
conseils financiers personnalisés ni une garantie de résultat. Le trading
comporte des risques importants de perte en capital. L'utilisateur reste seul
responsable de ses décisions.
