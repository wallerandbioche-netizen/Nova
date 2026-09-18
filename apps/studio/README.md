# Nova Studio

> Collez le lien d'une annonce, obtenez une vidéo immobilière cinématique.

Nova Studio transforme les photos d'une annonce (Airbnb, Booking, Vrbo, site d'agence, ou vos
propres fichiers) en un montage vidéo professionnel : recadrages intelligents, mouvements de
caméra subtils, transitions élégantes, rythme maîtrisé.

**La vidéo produite est uniquement visuelle.** Pas de voix off, pas de musique, pas de son du
tout, pas de texte, pas de titre, pas de prix, pas de logo, pas de sticker. Les images du montage
sont exactement les photos fournies par l'utilisateur : aucune image n'est générée ni retouchée.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Le parcours](#le-parcours)
- [Architecture](#architecture)
- [Le moteur vidéo](#le-moteur-vidéo)
- [Import des annonces : ce qui marche, ce qui ne marche pas](#import-des-annonces--ce-qui-marche-ce-qui-ne-marche-pas)
- [Variables d'environnement](#variables-denvironnement)
- [Commandes](#commandes)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Sécurité et confidentialité](#sécurité-et-confidentialité)
- [Limites connues et suites](#limites-connues-et-suites)

---

## Démarrage rapide

Prérequis : **Node ≥ 20.11**, **pnpm 10**, **PostgreSQL 16**. Rien d'autre — ni Redis, ni compte
Stripe, ni clé d'IA ne sont nécessaires pour faire tourner le produit de bout en bout.

```bash
# 1. Dépendances (à la racine du monorepo)
pnpm install

# 2. Configuration
cp apps/studio/.env.example apps/studio/.env
#   puis renseignez DATABASE_URL et AUTH_SECRET

# 3. Base de données
pnpm --filter @nova/studio db:push     # crée le schéma
pnpm --filter @nova/studio db:seed     # compte + annonce de démonstration

# 4. Lancement
pnpm dev:studio                        # http://localhost:3100
```

Le seed crée un compte utilisable immédiatement :

| e-mail             | mot de passe       | crédits |
| ------------------ | ------------------ | ------- |
| `demo@nova.studio` | `demo-nova-studio` | 25      |

**Mode démonstration.** Dans l'application, le bouton **« Essayer avec un exemple »** (page
« Créer une vidéo ») importe 14 photos d'orientations et de pièces variées, générées localement
dans `public/demo`. Il permet de tester tout le pipeline — import, analyse, sélection, montage,
rendu, téléchargement — sans dépendre d'une plateforme tierce.

> Techniquement, ce bouton envoie l'URL sentinelle `https://demo.nova.studio/villa`, reconnue par
> `DemoImporter`. **Ce domaine n'existe pas** : il n'est valable qu'à l'intérieur de
> l'application et ne mène nulle part dans un navigateur. C'est pourquoi l'interface n'en fait
> jamais un lien.

> Le rendu utilise Chromium via Remotion. En local, Remotion télécharge son propre navigateur au
> premier rendu ; si vous en avez déjà un, pointez `REMOTION_BROWSER_EXECUTABLE` dessus.

---

## Le parcours

```
URL (ou upload)  →  photos  →  sélection  →  style  →  format  →  durée  →  rendu  →  MP4
```

1. **Import** — l'URL est validée, la plateforme reconnue, les photos publiques récupérées.
   Si ce n'est pas possible, l'interface bascule sur l'import manuel : jamais d'impasse.
2. **Analyse** — chaque photo est mesurée une seule fois : dimensions, netteté, exposition,
   empreinte perceptuelle, pièce (d'après la légende de l'annonce), point focal.
3. **Sélection automatique** — doublons écartés, photos trop petites exclues, quota par pièce,
   ordre narratif (extérieur → pièces de vie → chambres → extérieur → vue). L'utilisateur peut
   tout modifier : sélectionner, désélectionner, réordonner par glisser-déposer, supprimer.
4. **Montage** — un storyboard déterministe est calculé : durée de chaque plan, mouvement de
   caméra adapté à la photo, transitions.
5. **Rendu** — Remotion produit un MP4 H.264, sans piste audio.
6. **Livraison** — lecture dans le navigateur, téléchargement du MP4, régénération possible avec
   d'autres réglages sans retélécharger ni réanalyser les photos.

---

## Architecture

```
apps/studio
├── prisma/schema.prisma        11 modèles : User, Session, Listing, ListingImage, Video,
│                               VideoScene, GenerationJob, CreditTransaction, Subscription,
│                               Payment, SystemConfig
├── src/app                     Pages (landing, auth, dashboard) et API REST
├── src/components              UI : primitives (shadcn-like) + composants produit
├── src/lib
│   ├── auth                    Sessions en base + mots de passe scrypt
│   ├── config                  Environnement validé (Zod), prix et crédits configurables
│   ├── credits                 CreditService : transactions PostgreSQL, idempotence
│   ├── demo                    Jeu de photos de démonstration généré localement
│   ├── image-analysis          ImageAnalyzer : heuristique (sharp) ou vision (optionnelle)
│   ├── importers               ListingImporter : Generic, Airbnb, Booking, Vrbo, Demo
│   ├── jobs                    JobQueue : in-process (dev) ou BullMQ/Redis (prod)
│   ├── selection               Déduplication, scoring, ordre narratif
│   ├── storage                 StorageProvider : disque local signé ou S3/R2/Supabase
│   ├── stripe                  PaymentProvider : offres, checkout, webhooks
│   └── video                   Formats, styles, cadrage, durées, storyboard, VideoRenderer
├── src/remotion                Composition Remotion (images et mouvements, rien d'autre)
├── src/server                  Services métier (listings, images, vidéos, rendu)
└── src/workers                 Worker de rendu dédié (BullMQ)
```

Chaque dépendance externe est derrière une interface — `ListingImporter`, `ImageAnalyzer`,
`VideoRenderer`, `StorageProvider`, `JobQueue`, `CreditService` — pour pouvoir changer de
fournisseur sans réécrire l'application.

### API

| Méthode  | Route                          | Rôle                                            |
| -------- | ------------------------------ | ----------------------------------------------- |
| `POST`   | `/api/auth/signup`             | Création de compte (+ crédits offerts)          |
| `POST`   | `/api/auth/login` / `logout`   | Session                                         |
| `POST`   | `/api/listings/import`         | Import d'une annonce depuis une URL             |
| `POST`   | `/api/listings/manual`         | Projet vide pour un import manuel               |
| `GET`    | `/api/listings/:id`            | Annonce + photos + sélection recommandée        |
| `POST`   | `/api/listings/:id/analyze`    | Recalcule doublons et sélection                 |
| `POST`   | `/api/listings/:id/images`     | Upload de photos (multipart)                    |
| `DELETE` | `/api/listings/:id/images`     | Suppression d'une photo                         |
| `GET`    | `/api/videos`                  | Mes vidéos                                      |
| `POST`   | `/api/videos`                  | Création d'un projet vidéo                      |
| `GET`    | `/api/videos/:id`              | Détail d'une vidéo                              |
| `PATCH`  | `/api/videos/:id`              | Renommage et réglages                           |
| `POST`   | `/api/videos/:id/regenerate`   | Génération / régénération (réglages optionnels) |
| `GET`    | `/api/videos/:id/status`       | Progression réelle du rendu                     |
| `POST`   | `/api/videos/:id/duplicate`    | Duplication d'un projet                         |
| `DELETE` | `/api/videos/:id`              | Suppression (fichiers compris)                  |
| `GET`    | `/api/credits`                 | Solde, coût, historique, offres                 |
| `POST`   | `/api/billing/checkout`        | Session Stripe Checkout                         |
| `POST`   | `/api/billing/webhook`         | Webhook Stripe (signature vérifiée)             |
| `GET`    | `/api/files/*`                 | Fichiers privés via URL signée expirante        |
| `DELETE` | `/api/account`                 | Suppression du compte et de toutes les données  |

### Chaîne de génération

```
Frontend → POST /api/videos/:id/regenerate → crédits débités → GenerationJob (QUEUED)
        → queue (in-process ou Redis/BullMQ) → worker
        → storyboard → Remotion → MP4 → stockage → COMPLETED
Frontend ← polling GET /api/videos/:id/status (progression réelle)
```

Statuts : `QUEUED → PROCESSING → RENDERING → UPLOADING → COMPLETED` (ou `FAILED`).
**Un rendu qui échoue est remboursé automatiquement.**

---

## Le moteur vidéo

- **Cadrage.** Le recadrage porte exactement le ratio de sortie : une photo n'est jamais
  déformée, et jamais encadrée de bandes noires. Le cadre est construit autour du **point focal**
  détecté (là où se concentre le détail de l'image), et ne sort jamais des limites de la photo.
- **Ken Burns.** Huit mouvements (`slowZoomIn`, `slowZoomOut`, `panLeft/Right/Up/Down`,
  `subtlePush`, `subtlePull`), choisis selon l'orientation de la photo — une photo portrait n'est
  pas balayée horizontalement — et jamais deux fois de suite. L'amplitude d'un panoramique ne
  dépasse jamais la marge réellement disponible dans l'image.
- **Transitions.** Fondu enchaîné, dissolution, fondu, glissé très léger. Rien de clignotant,
  aucune rotation, aucun effet 3D, aucun glitch.
- **Rythme.** Chaque style définit une longueur de plan, une variation, une amplitude et une
  durée de transition. Les plans d'ouverture et de fin sont tenus plus longtemps.

| Style       | Plan moyen | Mouvement    | Transition |
| ----------- | ---------- | ------------ | ---------- |
| `CINEMATIC` | ~2,9 s     | lent, subtil | 0,7 s      |
| `MODERN`    | ~2,2 s     | plus vif     | 0,45 s     |
| `LUXURY`    | ~3,6 s     | très subtil  | 0,9 s      |
| `DYNAMIC`   | ~1,6 s     | marqué       | 0,32 s     |

Formats : **9:16** (1080×1920), **16:9** (1920×1080), **1:1** (1080×1080).
Durées : **15 s**, **30 s**, **45 s** ou **automatique** (~2 s de vidéo par photo sur le style par
défaut : 10 photos ≈ 22 s, 15 ≈ 32 s, 20 ≈ 42 s). La durée demandée est celle de la vidéo finie,
transitions comprises.

Le montage est **déterministe** : mêmes photos + mêmes réglages + même graine ⇒ même vidéo.

---

## Import des annonces : ce qui marche, ce qui ne marche pas

Le produit lit **uniquement des données publiques**, en s'identifiant comme un robot et en
respectant `robots.txt`. Il ne contourne **jamais** un CAPTCHA, une authentification, ni une
protection anti-bot, et ne tente pas de se faire passer pour un navigateur.

| Source                              | Comportement attendu                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| Site d'agence, page perso, OpenGraph | Fonctionne généralement : photos issues des métadonnées publiques  |
| Vrbo / Abritel                       | Partiel, selon les métadonnées exposées                           |
| Booking.com                          | Souvent partiel : quelques photos, rarement la galerie complète   |
| Airbnb                               | **Généralement aucune photo** : la galerie est rendue côté client |
| `https://demo.nova.studio/...`       | Jeu de démonstration complet, généré localement                   |

Lorsque l'import ne donne rien — ce qui est un cas normal, pas une erreur —, l'utilisateur reçoit
un message clair et un bouton **« Importer les photos »** : le parcours continue avec ses propres
fichiers, et le résultat est identique.

Pour aller plus loin en production : passer par les **API officielles** des plateformes lorsque
vous y avez droit (programme partenaire Airbnb, Booking Connectivity, Expedia/Vrbo). Ces
intégrations se branchent en implémentant `ListingImporter`, sans toucher au reste du code.

---

## Variables d'environnement

Le fichier `.env.example` fait foi. L'essentiel :

| Variable                      | Obligatoire        | Rôle                                                  |
| ----------------------------- | ------------------ | ----------------------------------------------------- |
| `DATABASE_URL`                | oui                | PostgreSQL                                            |
| `AUTH_SECRET`                 | oui en production  | Signe les cookies de session et les URL de fichiers   |
| `APP_URL`                     | oui en production  | URL publique (retours Stripe)                         |
| `STORAGE_DRIVER`              | non (`local`)      | `local` ou `s3`                                       |
| `STORAGE_*`                   | si `s3`            | Endpoint, bucket, clés (bucket **privé**)             |
| `REDIS_URL` + `INLINE_RENDER` | non                | `INLINE_RENDER=false` + Redis ⇒ worker de rendu dédié |
| `REMOTION_BROWSER_EXECUTABLE` | non                | Chromium existant pour le rendu                       |
| `STRIPE_*`                    | non                | Sans Stripe, seuls les boutons d'achat sont inactifs  |
| `AI_API_KEY`                  | non                | Affine la détection des pièces et le cadrage          |
| `MAX_UPLOAD_BYTES`            | non (15 Mo)        | Taille maximale par fichier                           |

Aucun secret n'est écrit dans le code : tout passe par l'environnement.

---

## Commandes

```bash
pnpm dev:studio                                # développement (port 3100)
pnpm build:studio                              # build de production
pnpm --filter @nova/studio start               # serveur de production
pnpm --filter @nova/studio worker              # worker de rendu (Redis requis)

pnpm --filter @nova/studio db:push             # applique le schéma
pnpm --filter @nova/studio db:migrate          # migration versionnée
pnpm --filter @nova/studio db:seed             # données de démonstration
pnpm --filter @nova/studio demo:assets         # (re)génère les photos de démo

pnpm --filter @nova/studio test                # tests unitaires
pnpm --filter @nova/studio test:integration    # tests avec base de données
pnpm --filter @nova/studio render:smoke        # rendu réel de bout en bout (MP4 sur disque)
pnpm --filter @nova/studio remotion:studio     # studio Remotion (inspection du montage)

pnpm lint && pnpm typecheck                    # qualité (monorepo entier)
```

---

## Tests

- **Unitaires** (`tests/*.test.ts`) — validation d'URL et SSRF, `robots.txt`, extraction des
  métadonnées, hachage perceptuel, sélection et déduplication, ordre narratif, analyse d'image,
  mathématiques de cadrage (ratio préservé, cadre toujours dans l'image), storyboard
  (déterminisme, durées, mouvements, transitions), erreurs d'API et limitation de débit.
- **Intégration** (`tests/integration/*.test.ts`, base réelle) — crédits sous concurrence
  (cinq générations simultanées sur trois crédits : trois réussites, jamais quatre), idempotence,
  remboursement, cloisonnement entre utilisateurs, et le parcours complet
  URL → import → analyse → sélection → vidéo → rendu → stockage → suppression.
- **Rendu réel** — `render:smoke` produit un vrai MP4 et vérifie la chaîne complète.

---

## Déploiement

| Brique          | Recommandation                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| Web / API       | Vercel, Fly.io, Railway ou un conteneur Node                                    |
| Base de données | PostgreSQL managé (Neon, Supabase, RDS)                                         |
| Stockage        | Cloudflare R2, S3 ou Supabase Storage — **bucket privé**, `STORAGE_DRIVER=s3`   |
| File d'attente  | Redis managé (Upstash, Redis Cloud)                                             |
| Rendu           | Machine ou conteneur avec CPU, RAM et Chromium — **pas** une fonction serverless |

Le rendu vidéo est l'unique brique exigeante : 30 secondes de 1080×1920 demandent environ une
minute de CPU. En production, mettez `INLINE_RENDER=false`, renseignez `REDIS_URL` et lancez un
ou plusieurs workers (`pnpm --filter @nova/studio worker`) sur des machines dédiées ; le nombre
de workers est le levier de montée en charge.

Étapes :

1. Provisionner PostgreSQL, le bucket et Redis.
2. `pnpm --filter @nova/studio db:deploy` (migrations).
3. Déployer le web avec les variables d'environnement.
4. Déployer les workers avec les mêmes variables et `INLINE_RENDER=false`.
5. Créer les prix Stripe, renseigner `STRIPE_PRICE_*`, et pointer le webhook sur
   `POST /api/billing/webhook`.

---

## Sécurité et confidentialité

- Sessions opaques côté client, **hachées** en base ; mots de passe en scrypt.
- Toute lecture ou écriture est filtrée par `userId` **dans la requête SQL** : modifier un
  identifiant dans l'URL renvoie 404, jamais la ressource d'un autre (couvert par des tests).
- Validation Zod de toutes les entrées, limitation de débit sur l'import, l'upload, le rendu et
  l'authentification.
- Fichiers **privés par défaut** : accès uniquement par URL signée et expirante.
- Protection SSRF à l'import : adresses privées, locales et de métadonnées cloud refusées ;
  taille et durée de téléchargement plafonnées.
- Webhook Stripe vérifié sur les octets reçus.
- Suppression réelle : supprimer un projet ou un compte supprime aussi les fichiers stockés.

---

## Limites connues et suites

**Limites assumées aujourd'hui**

- Airbnb et Booking n'exposent pas leurs galeries publiquement : l'import manuel reste la voie
  fiable tant qu'un accès API officiel n'est pas en place.
- La détection des pièces repose sur les légendes de l'annonce ; sans légende, la photo reste
  « Autre » (et le montage reste correct). Une clé `AI_API_KEY` améliore ce point.
- La limitation de débit est en mémoire : à déplacer vers Redis dès qu'il y a plusieurs instances.
- Les photos de démonstration sont des illustrations générées localement, pas des photographies.

**Prochaines améliorations recommandées**

1. Intégrations officielles (Airbnb, Booking, Vrbo) derrière `ListingImporter`.
2. Aperçu du montage avant rendu avec `@remotion/player` (déjà installé) pour éviter des rendus
   inutiles.
3. Rendu distribué (Remotion Lambda ou pool de workers) et file prioritaire par offre.
4. Détection de sujet par vision sur les photos sans légende, pour affiner le point focal.
5. Sous-titrage optionnel et musique — **hors périmètre volontaire** du produit actuel.
6. Journal d'audit et quotas par organisation pour une offre agence multi-utilisateurs.
