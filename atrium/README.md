# Atrium

Transforme un dossier de photos en une courte vidéo immobilière.

Vous déposez les photos de votre logement, l'application les lit, comprend les
espaces, retient les meilleures vues, les met dans un ordre qui raconte quelque
chose, anime chacune d'elles et rend un MP4.

**La vidéo ne contient que vos photographies.** Ni musique, ni voix, ni texte,
ni logo, ni sous-titre, ni élément graphique — seulement des mouvements de
caméra et des fondus.

---

## Démarrer

```bash
cd atrium
npm install
npm run dev
```

Puis ouvrez <http://localhost:3000>.

Aucune configuration n'est nécessaire. Déposez vos photos sur la page
d'accueil — c'est tout le parcours. Partir d'un lien d'annonce reste possible,
replié sous le dépôt.

Pour voir le produit fonctionner sans annonce — ou si votre réseau ne permet
pas d'atteindre le site —, le lien « voir un exemple » de l'accueil monte une
séquence à partir d'un jeu de photos dessiné localement. Ces images servent à
juger le moteur (cadrage, mouvements, transitions) sur des formats variés ;
elles ne représentent aucun logement, et la vidéo produite le signale.

Pour vérifier que l'environnement peut produire une vidéo :

```bash
npm run doctor
```

### Toutes les commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement sur le port 3000 |
| `npm run build` | Compilation de production |
| `npm start` | Sert la compilation de production |
| `npm test` | Tests unitaires (cadrage, mouvements, déduplication, robots.txt) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, sans émission |
| `npm run doctor` | Vérifie ffmpeg, ses filtres et la configuration |
| `npm run samples` | (Re)génère le jeu de photos de démonstration |
| `npm run render:local -- <dossier> --format 9:16` | Rend une vidéo depuis un dossier de photos, sans interface |

### Rendre une vidéo sans passer par l'interface

```bash
npm run render:local -- ~/Photos/appartement --format 16:9
```

La commande affiche l'analyse de chaque photo, la séquence retenue, les photos
écartées et pourquoi, puis le chemin du MP4 produit. C'est le chemin le plus
court pour juger du rendu.

### Configuration

Copiez `.env.example` en `.env.local` et ajustez. Toutes les variables sont
optionnelles ; `.env.example` documente chacune d'elles. Aucune clé n'est
écrite dans le code.

```bash
cp .env.example .env.local
```

Pour utiliser un modèle de vision plutôt que l'analyse locale :

```bash
ANTHROPIC_API_KEY=...        # dans .env.local, jamais dans le dépôt
VISION_PROVIDER=anthropic
```

---

## Choix techniques

### FFmpeg plutôt que Remotion

Les deux ont été considérés.

**Remotion** rend chaque image dans un Chromium headless, à partir de
composants React. C'est décisif quand la vidéo contient du texte, des
graphiques, une interface ou une composition dynamique — et c'est précisément
ce que cette vidéo ne doit pas contenir. On paierait un navigateur par rendu
(installation lourde, mémoire, une image à la fois) pour n'utiliser aucune de
ses forces.

**FFmpeg** travaille en natif, sur un graphe de filtres. Le produit se réduit à
trois opérations — recadrer, déplacer la fenêtre, fondre — qui sont exactement
ce que `crop`, `zoompan` et `xfade` savent faire. Un binaire unique, un rendu
déterministe, et un temps de traitement de l'ordre de quelques secondes par
plan.

**FFmpeg est retenu.** `VideoRenderer` reste une interface : si la feuille de
route demandait un jour du texte ou des surimpressions, un moteur Remotion
viendrait s'y brancher sans toucher au reste.

### Comment un plan est fabriqué

`crop` d'ffmpeg ne sait pas faire varier la taille de sa fenêtre au fil du
temps, et `zoompan` ne sait cadrer qu'au format de son entrée. Chacun pris
seul, aucun ne suffit. La chaîne combine donc les deux :

```
sharp (une fois)          ffmpeg (par image)
┌──────────────────┐      ┌──────────┐   ┌──────────┐
│ découpe la zone  │ ───▶ │  crop    │──▶│ zoompan  │──▶ 1080×1920
│ utile, l'agrandit│      │ déplace  │   │ resserre │
└──────────────────┘      └──────────┘   └──────────┘
```

Le suréchantillonnage est confié à sharp, une seule fois, sur la seule zone
utile de la photo : ffmpeg n'a plus qu'à y découper. C'est ce qui évite de
rééchantillonner l'image entière trente fois par seconde, et ce qui donne un
mouvement sans à-coups — la fenêtre se déplace dans une image deux fois plus
définie que la sortie, donc au demi-pixel.

Un détail qui compte : la courbe de mouvement n'est pas un `smoothstep` pur.
Un quart de la course est linéaire, pour que la caméra ne s'immobilise jamais
tout à fait — sans quoi chaque fin de plan trahit le diaporama au moment du
fondu.

### Analyse des photos

Deux implémentations derrière la même interface `VisionAnalyzer` :

- **`AnthropicVisionAnalyzer`** — envoie les photos par lots à un modèle de
  vision multimodal et récupère un JSON validé par schéma. Les mesures
  purement physiques (luminosité, netteté) restent celles calculées
  localement : un modèle n'a aucun avantage pour les estimer. Si un lot échoue,
  ce lot seul bascule sur l'analyse locale.
- **`HeuristicVisionAnalyzer`** — analyse locale déterministe : statistiques
  d'image, carte d'énergie pour le point focal, lecture des légendes de
  l'annonce. Aucun réseau, aucune clé.

Le second n'est pas un bouchon : il fait tourner tout le pipeline, et c'est lui
qui répond quand aucune clé n'est configurée. Il reste nettement moins fin que
le premier sur le classement des espaces, en particulier sur des photos sans
légende.

### Préparation des photos dans le navigateur

Les photos sont réduites à 2800 pixels et réencodées avant d'être envoyées. Un
lot de photos de téléphone passe ainsi de plus de cent mégaoctets à quelques-uns,
sans rien coûter à la qualité : le serveur applique de toute façon cette limite,
et le rendu travaille sur une définition bien supérieure à celle de la sortie.

`createImageBitmap` est appelé avec `imageOrientation: 'from-image'`, ce qui
applique l'orientation EXIF aux pixels — sans quoi une photo prise à la
verticale arriverait couchée une fois ses métadonnées perdues au réencodage.

L'envoi passe par `XMLHttpRequest` : c'est le seul moyen d'obtenir un événement
de progression d'envoi, et une barre qui n'avance pas sur un lot de vingt
photos donne l'impression que rien ne se passe.

### Harmonisation de l'exposition

Des photos prises au fil des heures alternent pièces claires et pièces sombres.
Enchaînées, elles donnent une vidéo qui clignote — c'est ce qui trahit le plus
nettement un montage amateur.

La série est sa propre référence : aucune exposition idéale n'est visée, un
logement clair reste clair. Chaque plan est seulement rapproché de la médiane,
à 60 % de l'écart, dans une amplitude de ±8 %. Une série déjà homogène — écart
inter-déciles inférieur à 0,08 — traverse l'étape sans être touchée, et une
seule photo aberrante ne suffit pas à déclencher le traitement de toutes les
autres.

`npm run render:local` affiche la correction appliquée à chaque plan.

### Sources de photos

`ListingSource` abstrait l'origine des photos. Quatre implémentations :
`UploadedPhotosSource` (le parcours principal), `AirbnbListingSource`,
`LocalFolderListingSource` et `DemoListingSource`. Changer de source ne touche
ni au pipeline, ni à l'interface.

**Sur Airbnb.** Un lien d'annonce déclenche la récupération de ses vraies
photos, depuis sa page publique, après vérification de `robots.txt` et avec un
user-agent déclaré. **Aucune protection anti-robot, aucun CAPTCHA et aucun
mécanisme d'accès ne sont contournés** : un refus, une page de vérification ou
une absence de photo produisent une erreur, et l'écran d'erreur propose
d'importer vos photos — qui donnent exactement le même résultat.

**Aucune photo n'est jamais substituée à une autre.** La démonstration est une
source distincte, qui ne répond qu'à une demande explicite (`demo:` dans le
champ, ou le lien « voir un exemple »), et la vidéo produite est signalée comme
telle à l'écran. Un lien qu'on ne peut pas lire doit le dire ; l'illustrer avec
d'autres images reviendrait à mentir sur le contenu de la vidéo.

`AIRBNB_FETCH_MODE=disabled` refuse toute URL, pour un déploiement qui ne veut
fonctionner que par import.

---

## Structure

```
atrium/
├── scripts/                 outils de ligne de commande
│   ├── doctor.ts              vérification de l'environnement
│   ├── make-samples.ts        génération des photos de démonstration
│   └── render-local.ts        rendu depuis un dossier, sans interface
└── src/
    ├── app/
    │   ├── page.tsx                   accueil
    │   ├── comment-ca-marche/         explication
    │   ├── p/[id]/                    progression, puis résultat
    │   └── api/
    │       ├── projects/              création, état, changement de format
    │       ├── uploads/               import de photos
    │       ├── media/[...path]/       diffusion des fichiers, requêtes partielles
    │       └── samples/[file]/        photos de la démonstration d'accueil
    ├── components/
    │   ├── ui/                        Button, Reveal, ProgressRing, Logo
    │   ├── landing/                   Header, CreateForm, Showcase
    │   ├── project/                   ProgressPanel, ErrorPanel, suivi
    │   └── video/                     VideoStage, FormatPicker
    ├── lib/
    │   ├── listing/                   sources d'annonces, robots.txt, URL
    │   ├── vision/                    analyseurs, scoring, légendes
    │   ├── images/                    statistiques, empreinte perceptuelle
    │   ├── video/                     cadrage, plans, courbes, rendu ffmpeg
    │   ├── samples/                   générateur de photos de démonstration
    │   ├── storage/                   pilote de stockage
    │   ├── jobs/                      file de travaux
    │   └── db/                        dépôt de projets
    ├── services/                      ingestion, analyse, storyboard, rendu, pipeline
    └── types/                         domaine et vues d'API
```

## Pipeline

```
Photos déposées (ou lien d'annonce)
   ↓  récupération            ListingSource
   ↓  normalisation           sharp : orientation, définition, encodage
   ↓  empreinte               dHash 64 bits
   ↓  analyse                 VisionAnalyzer
   ↓  scoring                 qualité, composition, pénalités
   ↓  déduplication           distance de Hamming, la meilleure du groupe
   ↓  sélection               plafonds par espace, 5 à 12 photos
   ↓  storyboard              ordre, durées, mouvements, transitions
   ↓  cadrage                 cadre de départ et d'arrivée par plan
   ↓  exposition              harmonisation entre les plans
   ↓  rendu                   un segment par plan
   ↓  montage                 fondus enchaînés, fermeture au noir
   ↓  encodage                H.264, MP4, faststart
URL de téléchargement
```

Le pipeline est asynchrone. `POST /api/projects` dépose un travail et répond
immédiatement ; l'interface suit l'avancement par interrogation de
`GET /api/projects/:id`.

### Ce que le storyboard décide

- **L'ordre** : une vue d'ensemble ouvre, puis les pièces de vie, les chambres,
  les espaces d'eau, le dehors, et une dernière vue large referme. Les
  chapitres absents sont sautés ; une annonce à dominante extérieure commence
  par le dehors.
- **Les durées** : 3,4 à 4,4 s pour l'ouverture et la clôture, 2,3 à 3,8 s
  ailleurs, selon la qualité de chaque photo, avec une variation déterministe
  pour rompre l'effet métronome. L'ensemble est ramené entre 16 et 42 s.
- **Les mouvements** : proposés par l'analyse à partir du point focal, puis
  arbitrés pour la variété — jamais deux fois le même d'affilée, jamais trois
  travellings avant de suite. Si une photo n'offre pas assez de course pour le
  panoramique demandé, il devient un travelling, et c'est ce mouvement-là qui
  est consigné.
- **Les transitions** : fondu enchaîné entre deux espaces, fondu plus long
  entre deux vues du même espace, respiration avant le plan final.

## Formats

`9:16` (défaut), `16:9`, `4:5`. Le choix n'apparaît qu'après la première
vidéo : au premier écran, l'utilisateur n'a rien à décider. Changer de format
recalcule les cadrages — ils dépendent du rapport de sortie — et relance le
seul rendu.

## Design

Le système est défini dans `src/app/globals.css` : deux encres, quatre gris, un
accent employé pour le seul point actif de la progression. Rayons discrets,
contours fins plutôt qu'ombres, animations de 110 à 620 ms, et respect de
`prefers-reduced-motion`. Mode sombre pris en charge.

## Hors périmètre du MVP

Comptes utilisateurs, paiement, tableau de bord, collaboration, musique, voix,
texte, génération vidéo par modèle. Le dépôt de projets est en mémoire et la
file de travaux est en processus : les deux sont derrière une interface
(`ProjectRepository`, `JobQueue`) et se remplacent par une base et une file
persistantes sans toucher aux services.
