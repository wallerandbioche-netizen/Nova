# SCAN TRADE — application web

Analyse de graphiques assistée par IA : structure de marché, niveaux clés, confluence,
plan de trade et gestion du risque. Le produit est construit autour d'une idée simple —
**une analyse structurée, pas une génération de signaux** — et il doit pouvoir conclure
qu'il n'y a rien à faire.

## Démarrer

```bash
pnpm install
pnpm dev:web          # http://localhost:3100
```

Aucune clé d'API n'est nécessaire : l'application fonctionne entièrement avec son moteur
déterministe et des données de marché **simulées**, signalées comme telles partout où
elles apparaissent.

Autres commandes, depuis la racine du dépôt :

```bash
pnpm build:web                             # build de production
pnpm --filter @scantrade/web test          # tests unitaires du moteur
pnpm --filter @scantrade/web build:demo    # bundle de démonstration statique
pnpm lint
```

### Démonstration statique

`demo/` rassemble les mêmes composants dans un bundle autonome à routage par
ancre, pour héberger l'interface sur un serveur de fichiers. Le moteur tourne
alors dans le navigateur : quand aucune route d'API ne répond, `requestAnalysis`
bascule sur `runLocalAnalysis` et l'analyse reste complète. La lecture de
capture d'écran, elle, annonce son indisponibilité au lieu de produire un
résultat.

## Écrans

| Route           | Rôle                                                                  |
| --------------- | --------------------------------------------------------------------- |
| `/`             | Accueil : raccourcis, compteurs, dernières analyses, opportunités     |
| `/analyser`     | Analyzer : graphique + panneau d'analyse, ou lecture d'une capture    |
| `/marches`      | Balayage des instruments suivis et de leur biais courant              |
| `/journal`      | Historique filtrable des analyses et statistiques                     |
| `/analyse/[id]` | Résultat complet d'une analyse (verdict, plan, raisonnement, risque)  |
| `/abonnement`   | Formules ; le plan gratuit laisse le verdict visible, le reste flouté |
| `/profil`       | Compte, abonnement, apparence, profil de risque et calibrage          |

## Architecture

```
src/
  app/            routes App Router + routes d'API (/api/analyze, /api/market-data)
  components/     layout, ui, charts, analysis, dashboard, markets, history, upload
  lib/
    analysis/     moteur déterministe (voir ci-dessous)
    market-data/  abstraction fournisseur + générateur OHLC simulé
    ai/           couche de raisonnement (abstraction + fournisseurs + schémas)
    storage/      journal et préférences (localStorage)
    mock-data/    scénarios de démonstration produits par le moteur
  types/          modèle de données partagé
```

### Le moteur d'analyse

Le pipeline est entièrement déterministe et vit dans `lib/analysis` :

```
données OHLC
  → indicateurs        (EMA 20/50/200, RSI, MACD, ATR, VWAP, volume)
  → structure          (swings, HH/HL/LH/LL, BOS, CHoCH)
  → niveaux            (zones de support / résistance, jamais un prix exact)
  → liquidité          (extrêmes équivalents, balayages, faux départs, reprises)
  → figures            (avalement, mèche de rejet, momentum, cassure, retest)
  → régime             (tendance / range, momentum, volume, volatilité)
  → multi-unités       (contexte, structure, exécution, alignement)
  → confluence         (9 facteurs pondérés → score signé 0–10)
  → setup              (8 configurations candidates, la meilleure est retenue)
  → filtres de risque  (confluence, alignement, volatilité, stop, R/R)
  → analyse finale     (setup complet, ou NO TRADE motivé)
```

Chaque prix, niveau, ratio et score affiché provient de ce pipeline.

### La couche de raisonnement

`lib/ai/analyze-chart.ts` est le point d'entrée unique. Il exécute d'abord le moteur, puis
confie le résultat à un `ReasoningProvider` :

- `providers/deterministic.ts` — actif par défaut, rédige à partir des seules valeurs calculées ;
- `providers/anthropic.ts` — utilisé si `ANTHROPIC_API_KEY` est défini. Le modèle **commente**
  l'analyse ; sa réponse est validée par un schéma Zod (`lib/ai/schema.ts`) et rejetée en cas
  d'écart, auquel cas la rédaction déterministe reprend la main.

Le modèle ne produit jamais un prix, un niveau ou un score : il n'en a pas la permission dans
le schéma de sortie, et les champs numériques de l'analyse ne sont pas alimentés par lui.

### Lecture d'une capture d'écran

`POST /api/analyze/screenshot` passe l'image à `extractFromScreenshot()`. Sans modèle de vision
configuré — ou si l'image ne permet pas de lire assez de bougies — la route répond
`readable: false` et l'interface affiche **« Données visuelles insuffisantes pour une analyse
fiable »** avec la liste de ce qui manque. Aucune donnée n'est inventée pour combler un trou.

### Données de marché

`lib/market-data` expose `getMarketData()` derrière une interface `MarketDataProvider`. Le
fournisseur livré est **simulé** : générateur OHLC déterministe, identique côté serveur et
côté client, avec des séries plus courtes découpées dans la même série canonique pour que la
vignette, la sparkline et le moteur voient exactement le même marché. Brancher un flux réel
consiste à enregistrer un autre fournisseur, sans toucher au moteur ni à l'interface.

## Principes tenus dans le code

- Le score de confluence mesure **l'accord entre facteurs**, pas une probabilité de gain, et
  l'interface le rappelle à chaque affichage.
- **NO TRADE est un résultat de premier rang** : il est présenté avec ses causes machine
  (`NoTradeCode`) et ses explications, au même niveau qu'une configuration valide.
- Les niveaux sont des **zones** ; un indicateur n'est jamais lu seul (un RSI > 70 n'est pas un
  signal de vente, c'est une mesure d'extension) ; les données manquantes sont affichées comme
  indisponibles.
- Les performances passées, simulées ou non, ne préjugent pas des performances futures — et le
  moteur de backtest (`lib/analysis/backtest.ts`) le rappelle dans son rapport.

## Configuration

Voir `.env.example`. Tout est optionnel ; aucune clé n'est jamais exposée au navigateur, les
appels au modèle se font depuis les routes d'API (`runtime = 'nodejs'`).

## Tests

`pnpm --filter @scantrade/web test` couvre les parties critiques : calcul du risque et du
R/R, dimensionnement de position, indicateurs, détection de structure, confluence, conditions
de NO TRADE, cohérence des setups, backtest et validation des schémas de sortie du modèle.
