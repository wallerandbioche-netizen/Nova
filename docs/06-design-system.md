# F. Design system — NOVA

Implémentation : `packages/ui` (tokens + composants React Native).

## 1. Intention

Premium, calme, factuel. L'utilisateur doit se sentir **informé**, jamais **pressé**.
Référence émotionnelle : un rapport bien composé, pas une salle de marché.

Interdits explicites : néons, dégradés décoratifs, animations gratuites, rouge/vert omniprésent,
tickers clignotants, boutons « BUY » agressifs, densité de salle des marchés.

## 2. Tokens de couleur

Les couleurs sont définies par rôle sémantique, jamais par valeur brute dans les écrans.

| Token              | Light     | Dark      | Usage                        |
| ------------------ | --------- | --------- | ---------------------------- |
| `background`       | `#FBFBFA` | `#0E1012` | Fond d'écran                 |
| `surface`          | `#FFFFFF` | `#16191C` | Cartes                       |
| `surfaceSecondary` | `#F4F4F2` | `#1E2226` | Zones secondaires, skeletons |
| `textPrimary`      | `#14171A` | `#F2F4F5` | Titres, valeurs              |
| `textSecondary`    | `#5B6470` | `#98A2AE` | Descriptions, métadonnées    |
| `textTertiary`     | `#8A94A0` | `#6C7783` | Légendes, `asOf`             |
| `border`           | `#E4E5E2` | `#282D33` | Séparateurs 1 px             |
| `accent`           | `#1F5D4C` | `#5FB49C` | Marque, CTA principal        |
| `accentMuted`      | `#E8F1ED` | `#16302A` | Fond d'accent discret        |
| `positive`         | `#1F6B4A` | `#5FB48A` | Variation positive           |
| `negative`         | `#8C3A2E` | `#D3897C` | Variation négative           |
| `warning`          | `#8A6A1F` | `#D9B55F` | Attention, incertitude       |
| `info`             | `#2A5470` | `#7FAFCB` | Contexte, pédagogie          |
| `demo`             | `#6B4E8A` | `#B79BD4` | Badge DEMO DATA              |

`positive` / `negative` sont volontairement désaturés : ce ne sont pas des feux de signalisation.
**Une variation n'est jamais signalée uniquement par la couleur** : signe (`+`/`−`), flèche
(`▲`/`▼`) et libellé accessible (`en hausse de 1,2 %`) accompagnent systématiquement la valeur.

Contraste : tous les couples texte/fond visent WCAG AA (≥ 4,5:1 pour le texte courant,
≥ 3:1 pour le texte large) — vérifié par test unitaire (`packages/ui/src/theme/contrast.test.ts`).

## 3. Thème

`ThemeProvider` suit `useColorScheme()` par défaut (`system`), avec override explicite
`light` / `dark` persisté dans les préférences utilisateur.

## 4. Typographie

Famille unique : **Inter** (fallback système). Une seule famille, pas de police décorative.

| Style        | Taille / interligne | Graisse | Usage                           |
| ------------ | ------------------- | ------- | ------------------------------- |
| `display`    | 34 / 40             | 600     | Valeur de portefeuille          |
| `h1`         | 26 / 32             | 600     | Titre d'écran                   |
| `h2`         | 20 / 26             | 600     | Titre de section                |
| `h3`         | 17 / 24             | 600     | Titre de carte                  |
| `body`       | 16 / 24             | 400     | Texte courant                   |
| `bodyStrong` | 16 / 24             | 600     | Emphase                         |
| `small`      | 14 / 20             | 400     | Secondaire                      |
| `caption`    | 12 / 16             | 500     | Source, date, badge             |
| `mono`       | 16 / 24             | 500     | Chiffres alignés (tabular-nums) |

Les chiffres utilisent `fontVariant: ['tabular-nums']` pour éviter le sautillement des valeurs.

## 5. Espacement, rayons, élévation

Échelle 4 px : `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`.
Rayons : `sm 8 · md 12 · lg 16 · full 999`. Marge d'écran : 20 px.
Élévation : une seule ombre très discrète sur les cartes flottantes ; sinon bordure 1 px.

## 6. Composants (`packages/ui`)

`Button` · `IconButton` · `Input` · `Select` · `Card` · `Badge` · `Tag` · `Avatar` ·
`BottomSheet` · `Modal` · `Toast` · `Skeleton` · `EmptyState` · `ErrorState` · `OfflineBanner` ·
`NewsCard` · `AssetCard` · `PortfolioCard` · `MetricCard` · `Chart` (sparkline + barres) ·
`ProgressBar` · `SectionHeader` · `SourceList` · `AIMessage` · `ChatInput` · `ValueChange` ·
`DemoBadge` · `ConfidenceIndicator` · `AllocationBar` · `ListRow` · `SegmentedControl`.

Chaque composant expose les états pertinents : `default`, `pressed`, `focused`, `disabled`, `loading`.

## 7. Accessibilité

- Zone tactile minimale 44 × 44 pt (`hitSlop` quand l'élément visuel est plus petit).
- `accessibilityRole`, `accessibilityLabel`, `accessibilityState` sur tout élément interactif.
- Les valeurs financières exposent un label parlé complet (« portefeuille : 12 480 euros, en baisse de 1,2 % aujourd'hui »).
- Support de `allowFontScaling` — aucune hauteur fixe sur un conteneur de texte.
- Focus visible sur web (`outline` conservé), navigation clavier possible.
- Aucune information portée uniquement par la couleur ou uniquement par une icône.

## 8. Mouvement

Transitions ≤ 200 ms, easing standard, uniquement fonctionnelles (apparition de contenu,
feuille modale, pression de bouton). Respect de « réduire les animations » du système.

## 9. Règles de contenu

- Dates et heures localisées, toujours accompagnées de `Dernière mise à jour : …`.
- Montants formatés selon la devise du portefeuille (`Intl.NumberFormat`, locale `fr-FR` par défaut).
- Aucune formulation impérative d'investissement (« achetez », « profitez de »).
- Les hypothèses utilisent le conditionnel ; les incertitudes ont leur propre bloc visuel.
