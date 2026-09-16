# NOVA

> Votre copilote personnel pour comprendre vos investissements.

NOVA relie l'actualité financière, les marchés et **votre portefeuille** pour répondre chaque
matin à une question que les applications de news ne posent pas : _pourquoi cela me concerne ?_

Au lieu d'afficher « le pétrole monte de 3 % », NOVA affiche le fait, calcule votre exposition
réelle, explique le lien possible — au conditionnel — et dit explicitement ce qu'on ne sait pas.

---

## Sommaire

- [Ce que fait NOVA](#ce-que-fait-nova)
- [Principes non négociables](#principes-non-négociables)
- [Architecture](#architecture)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Démarrage local](#démarrage-local)
- [Base de données](#base-de-données)
- [Tests](#tests)
- [Build et déploiement](#build-et-déploiement)
- [Fournisseurs externes](#fournisseurs-externes)
- [Conventions de code](#conventions-de-code)
- [État du MVP](#état-du-mvp)
- [Documentation](#documentation)

---

## Ce que fait NOVA

```
MON PROFIL → MON PORTEFEUILLE → CE QUI SE PASSE AUJOURD'HUI → CE QUI EST IMPORTANT POUR MOI
    → POURQUOI → CE QUE J'APPRENDS → MES DÉCISIONS → MON HISTORIQUE → personnalisation
```

| Module                            | Description                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Daily Brief**                   | Une synthèse personnalisée générée à 06:00, stockée, jamais régénérée à l'ouverture               |
| **Pourquoi cela vous concerne ?** | Fait, contexte, actifs concernés, **votre exposition chiffrée**, hypothèse, incertitudes, sources |
| **Portefeuille**                  | Valorisation, allocation, concentration, exposition sectorielle, géographique et thématique       |
| **Market Radar**                  | Les thèmes qui portent l'actualité, et votre exposition à chacun                                  |
| **AI Coach**                      | Des réponses structurées, sourcées, avec leurs limites — jamais de conseil                        |
| **Learning**                      | Des leçons de deux minutes, adaptées au niveau déclaré                                            |
| **Journal**                       | Vos décisions et leurs raisons, relues plus tard sans jugement                                    |

Hors périmètre, volontairement : trading, robo-advisor, connexion à un courtier, recommandation
personnalisée d'investissement.

## Principes non négociables

Ces règles sont appliquées par le code et couvertes par des tests, pas seulement écrites ici.

1. **Aucune donnée financière inventée.** Sans cours connu, une position est « valorisation
   indisponible », jamais zéro. Toute donnée de démonstration porte la mention `DEMO DATA`, de
   la base jusqu'à l'écran.
2. **L'IA est une couche d'explication, pas une source de vérité.**
   `Source → donnée structurée → moteur métier → IA → explication`. Aucun chiffre affiché ne
   provient d'un modèle.
3. **Une hypothèse n'est jamais présentée comme un fait.** Le type épistémique (`fact`, `data`,
   `analysis`, `hypothesis`, `uncertainty`) est porté par les types TypeScript jusqu'à l'UI.
4. **Aucun calcul financier dans l'interface.** Tout passe par `packages/finance`, pur et testé.
5. **L'identité vient du jeton, jamais du client.** Un `userId` envoyé dans une requête est ignoré.
6. **Pas de dark pattern.** Aucun bouton d'achat, aucune notification anxiogène, aucune urgence
   artificielle, aucun score présenté comme une prévision.
7. **Rien de factice.** Pas de bouton inerte : quand une intégration n'est pas configurée, le
   produit le dit (« bientôt disponible ») plutôt que de faire semblant.

## Architecture

```
apps/
  api/        Fastify + Prisma + PostgreSQL — modules métier, services, jobs
  mobile/     Expo + React Native + expo-router — 30 écrans
packages/
  types/      Types de domaine partagés
  validation/ Schémas Zod (API, formulaires, sortie du LLM)
  config/     Plans, pondérations de scoring, taxonomie, constantes
  finance/    Moteur financier pur (valorisation, allocation, exposition)
  ui/         Design system React Native (tokens + 24 composants)
infrastructure/
  docker-compose.yml, Dockerfile.api
docs/         Architecture produit et technique, schéma, API, écrans, design, sécurité…
```

Détail : [`docs/02-technical-architecture.md`](docs/02-technical-architecture.md).

**Stack** : TypeScript strict de bout en bout · Fastify 5 · Prisma 6 · PostgreSQL 16 ·
Redis (optionnel) · BullMQ · Zod · Expo 53 · React Native 0.79 · TanStack Query · Vitest.

## Installation

Prérequis : **Node.js ≥ 20.11**, **pnpm 10**, **PostgreSQL 16** (Docker suffit).

```bash
git clone <repository> nova && cd nova
pnpm install

# Infrastructure locale (PostgreSQL + Redis)
pnpm infra:up

# Configuration
cp .env.example apps/api/.env
#   Pour un démarrage immédiat, seules DATABASE_URL et JWT_SECRET sont nécessaires.
#   Générer un secret : openssl rand -base64 48

# Base de données
pnpm db:migrate
pnpm db:seed
```

Le seed crée les données de référence, un univers de 18 actifs de démonstration avec 90 jours
de cours synthétiques, 12 actualités, 10 leçons rédigées et un compte de démonstration :

```
demo@nova.app / demo-nova-2026
```

## Variables d'environnement

Toutes les variables sont documentées dans [`.env.example`](.env.example) et **validées au
démarrage** : l'API refuse de démarrer si une configuration est incohérente (secret d'exemple en
production, fournisseur sélectionné sans son endpoint, absence de Redis en production…).

| Variable               | Obligatoire   | Rôle                                       |
| ---------------------- | ------------- | ------------------------------------------ |
| `DATABASE_URL`         | oui           | Connexion PostgreSQL                       |
| `JWT_SECRET`           | oui           | Signature des jetons (≥ 32 caractères)     |
| `REDIS_URL`            | en production | Cache partagé et file de jobs              |
| `MARKET_DATA_PROVIDER` | non (`demo`)  | `demo` ou `http`                           |
| `NEWS_PROVIDER`        | non (`demo`)  | `demo` ou `http`                           |
| `LLM_PROVIDER`         | non (`demo`)  | `demo`, `anthropic` ou `openai-compatible` |
| `MAIL_PROVIDER`        | en production | `log` (dev) ou `http`                      |
| `PAYMENT_PROVIDER`     | non (`none`)  | `none` ou `stripe`                         |
| `RATE_LIMIT_*`         | non           | Limites configurables par route sensible   |

Aucun secret n'est exposé au client : l'application mobile ne connaît que l'URL de l'API.

## Démarrage local

```bash
pnpm dev:api        # API sur http://localhost:4000, documentation sur /docs
pnpm dev:mobile     # Expo — i (iOS), a (Android), w (web)
```

Sans aucune clé d'API, le produit est **entièrement fonctionnel** en mode démonstration : les
cours, les actualités et les explications de NOVA sont déterministes et clairement étiquetés.

## Base de données

```bash
pnpm db:migrate                                  # migration de développement
pnpm --filter @nova/api exec prisma migrate deploy   # application en CI/production
pnpm db:seed                                     # données de référence + démonstration
pnpm --filter @nova/api db:reset                 # réinitialisation complète (destructif)
pnpm --filter @nova/api exec prisma studio       # exploration
```

Schéma : [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) — 24 modèles,
conventions expliquées dans [`docs/03-database-schema.md`](docs/03-database-schema.md).

## Tests

```bash
pnpm test              # tous les tests unitaires (171)
pnpm test:integration  # intégration + E2E (53), nécessite PostgreSQL
pnpm lint
pnpm -r typecheck
```

| Suite                    | Couverture                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/finance`       | Arrondis symétriques, conversion de devises, prix manquants signalés plutôt que supposés, portefeuille vide, concentration |
| `packages/validation`    | Politique de mot de passe, montants non finis rejetés, contrat de sortie du LLM, formulations interdites                   |
| `packages/ui`            | Contraste WCAG AA de toute la palette, en clair et en sombre                                                               |
| `apps/api` (unitaires)   | Scoring déterministe, hachage de mots de passe, jetons, cache, pagination, audit                                           |
| `apps/api` (intégration) | Authentification et rotation des jetons, isolation entre utilisateurs, portefeuille, actualités, garde-fous IA, quotas     |
| `apps/api` (E2E)         | Le parcours complet du MVP, de l'inscription à la suppression du compte                                                    |

## Build et déploiement

```bash
pnpm build                                        # packages + API
docker build -f infrastructure/Dockerfile.api -t nova-api .
```

Pipeline et procédure détaillés : [`docs/10-deployment.md`](docs/10-deployment.md).
La production exige une validation manuelle.

## Fournisseurs externes

Chaque intégration externe est derrière une interface (`MarketDataProvider`, `NewsProvider`,
`LLMProvider`, `NotificationProvider`, `MailProvider`, `PaymentProvider`, `StorageProvider`),
avec une implémentation de démonstration et une implémentation réelle. Contrats HTTP attendus et
procédure de branchement : [`docs/08-providers.md`](docs/08-providers.md).

## Conventions de code

- **TypeScript strict**, `noUncheckedIndexedAccess` compris. Pas de `any`.
- **Une responsabilité par fichier**, pas de fichier fourre-tout ; un module = modèle, service,
  validation, routes, tests.
- **Les commentaires expliquent le pourquoi**, pas le quoi — en particulier les règles
  prudentielles qui ne se devinent pas à la lecture du code.
- **Les schémas Zod sont la frontière** : rien d'externe n'entre sans être parsé.
- **Français** pour tout ce que lit un utilisateur, **anglais** pour le code et les commentaires.
- Commits conventionnels (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## État du MVP

Les critères de réussite du cahier des charges (§60) sont couverts par le test E2E
`apps/api/src/e2e/user-journey.test.ts` :

- [x] Créer un compte, terminer l'onboarding, créer un portefeuille, ajouter des positions
- [x] Consulter son exposition et son Daily Brief
- [x] Ouvrir une actualité et comprendre pourquoi elle le concerne
- [x] Poser une question à NOVA, suivre une leçon, créer une entrée de journal
- [x] Modifier ses paramètres, se déconnecter, supprimer son compte
- [x] Rencontrer des erreurs (réseau, ressource absente, IA indisponible) sans casser l'application

Préparé mais non activé : import CSV, connexion à un courtier, alertes personnalisées,
comparaison à un benchmark, recommandations personnalisées (sous réserve de validation
réglementaire — voir [`docs/07-implementation-plan.md`](docs/07-implementation-plan.md)).

## Documentation

| Document                                                         | Contenu                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [01 — Architecture produit](docs/01-product-architecture.md)     | Vision, boucle produit, personas, garde-fous |
| [02 — Architecture technique](docs/02-technical-architecture.md) | Décisions, découpage, flux IA                |
| [03 — Schéma de données](docs/03-database-schema.md)             | Conventions, index, rétention                |
| [04 — Contrat d'API](docs/04-api-contract.md)                    | Toutes les routes, erreurs, pagination       |
| [05 — Carte des écrans](docs/05-screen-map.md)                   | Navigation et 30 écrans                      |
| [06 — Design system](docs/06-design-system.md)                   | Tokens, typographie, accessibilité           |
| [07 — Plan d'implémentation](docs/07-implementation-plan.md)     | Phases et roadmap                            |
| [08 — Fournisseurs](docs/08-providers.md)                        | Brancher des données réelles                 |
| [09 — Sécurité](docs/09-security.md)                             | Mesures implémentées et points ouverts       |
| [10 — Déploiement](docs/10-deployment.md)                        | Environnements, pipeline, jobs               |

---

**Avertissement.** NOVA fournit une information pédagogique et contextuelle. NOVA ne délivre pas
de conseil en investissement personnalisé, n'exécute aucune transaction et n'a accès à aucun
compte. Les performances passées ne préjugent pas des performances futures.
